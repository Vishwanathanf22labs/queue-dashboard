const { PAGINATION, JOB_FETCH_LIMIT } = require("../config/constants");
const { Queue } = require("bullmq");
const redis = require("../config/redis");
const Brand = require("../models/Brand");
const logger = require("../utils/logger");
const WatchList = require("../models/WatchList"); // Added import for WatchList

let brandProcessingQueue = null;

async function initializeBullMQQueue() {
  try {
    if (!brandProcessingQueue) {
      brandProcessingQueue = new Queue("brand-processing", {
        connection: redis,
      });
      logger.info(
        "BullMQ Queue initialized for brand-processing using existing Redis connection"
      );
    }
    return brandProcessingQueue;
  } catch (error) {
    logger.error("Error in initializeBullMQQueue:", error);
    throw error;
  }
}

async function getBullMQJobStates() {
  try {
    await initializeBullMQQueue();

    const jobCounts = await brandProcessingQueue.getJobCounts(
      "waiting",
      "active",
      "delayed",
      "completed",
      "failed"
    );

    logger.info(
      "Total Jobs Created (Redis):",
      (await redis.get("bull:brand-processing:id")) || 0
    );

    const totalInSystem = Object.values(jobCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    return {
      job_states: {
        waiting: jobCounts.waiting || 0,
        active: jobCounts.active || 0,
        delayed: jobCounts.delayed || 0,
        completed: jobCounts.completed || 0,
        failed: jobCounts.failed || 0,
      },
      totals: {
        total_jobs_created: parseInt(
          (await redis.get("bull:brand-processing:id")) || 0
        ),
        total_in_system: totalInSystem,
        success_rate:
          jobCounts.completed + jobCounts.failed > 0
            ? (
                (jobCounts.completed /
                  (jobCounts.completed + jobCounts.failed)) *
                100
              ).toFixed(2)
            : 0,
      },
    };
  } catch (error) {
    logger.error("Error in getBullMQJobStates:", error);
    throw error;
  }
}

async function getBrandProcessingQueue(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT
) {
  try {
    await initializeBullMQQueue();

    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

    const totalJobsCreated = parseInt(
      (await redis.get("bull:brand-processing:id")) || 0
    );

    logger.info("Total Jobs Created:", totalJobsCreated);

    const [waiting, active, delayed, completed, failed] = await Promise.all([
      brandProcessingQueue.getJobs(["waiting"], 0, JOB_FETCH_LIMIT),
      brandProcessingQueue.getJobs(["active"], 0, JOB_FETCH_LIMIT),
      brandProcessingQueue.getJobs(["delayed"], 0, JOB_FETCH_LIMIT),
      brandProcessingQueue.getJobs(["completed"], 0, JOB_FETCH_LIMIT),
      brandProcessingQueue.getJobs(["failed"], 0, JOB_FETCH_LIMIT),
    ]);

    const allJobs = [
      ...active,
      ...waiting,
      ...delayed,
      ...completed,
      ...failed,
    ];
    const brandProcessingData = [];

    for (const job of allJobs) {
      try {
        const brandId = job.data.brandId;
        const pageCategory = job.data.brandDetails?.page_category;
        const totalAds = job.data.totalAds?.length || 0;

        const brand = await Brand.findOne({
          where: { id: brandId },
          attributes: ["actual_name", "page_id"],
          raw: true,
        });

        // Check if brand is in watchlist table
        let isInWatchlist = false;
        try {
          const watchlistBrand = await WatchList.findOne({
            where: { brand_id: brandId },
            attributes: ['brand_id'],
            raw: true
          });
          isInWatchlist = !!watchlistBrand;
        } catch (watchlistError) {
          logger.warn(`Error checking watchlist for brand ${brandId}:`, watchlistError);
          isInWatchlist = false;
        }

        // Only include regular brands (not watchlist brands)
        if (!isInWatchlist) {
          brandProcessingData.push({
            brand_id: brandId,
            page_id: brand?.page_id || "Unknown",
            page_name: brand?.actual_name || "Unknown",
            total_ads: totalAds,
            page_category: pageCategory || "Unknown",
            created_at: new Date(job.timestamp).toISOString(),
            is_watchlist: false
          });
        }
      } catch (jobError) {
        logger.error(`Error processing job ${job.id}:`, jobError);
      }
    }

    brandProcessingData.sort((a, b) => parseInt(b.brand_id) - parseInt(a.brand_id));

    // Count only regular brands (not watchlist)
    const regularBrandsCount = brandProcessingData.length;

    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedBrands = brandProcessingData.slice(startIndex, endIndex);

    return {
      brands: paginatedBrands,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: regularBrandsCount,
        total_pages: Math.ceil(regularBrandsCount / validLimit),
      },

    };
  } catch (error) {
    logger.error("Error in getBrandProcessingQueue:", error);
    throw error;
  }
}

async function getWatchlistBrandsQueue(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT
) {
  try {
    await initializeBullMQQueue();

    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

    const totalJobsCreated = parseInt(
      (await redis.get("bull:brand-processing:id")) || 0
    );

    logger.info("Total Jobs Created:", totalJobsCreated);

    const [waiting, active, delayed, completed, failed] = await Promise.all([
      brandProcessingQueue.getJobs(["waiting"], 0, JOB_FETCH_LIMIT),
      brandProcessingQueue.getJobs(["active"], 0, JOB_FETCH_LIMIT),
      brandProcessingQueue.getJobs(["delayed"], 0, JOB_FETCH_LIMIT),
      brandProcessingQueue.getJobs(["completed"], 0, JOB_FETCH_LIMIT),
      brandProcessingQueue.getJobs(["failed"], 0, JOB_FETCH_LIMIT),
    ]);

    const allJobs = [
      ...active,
      ...waiting,
      ...delayed,
      ...completed,
      ...failed,
    ];

    // Filter only watchlist brands
    const watchlistJobs = [];
    const brandIds = new Set();

    for (const job of allJobs) {
      const brandId = job.data.brandId;
      const pageCategory = job.data.brandDetails?.page_category;
      const totalAds = job.data.totalAds?.length || 0;

      if (brandId && !brandIds.has(brandId)) {
        brandIds.add(brandId);

        // Get brand details from database
        const brand = await Brand.findOne({
          where: { id: parseInt(brandId) },
          attributes: ["actual_name", "page_id"],
          raw: true,
        });

        if (brand) {
          // Check if this brand is in watchlist
          const WatchList = require("../models/WatchList");
          const isInWatchlist = await WatchList.findOne({
            where: { brand_id: parseInt(brandId) },
            attributes: ['brand_id'],
            raw: true
          });

          // Only include if it's a watchlist brand
          if (isInWatchlist) {
            watchlistJobs.push({
              brand_id: parseInt(brandId),
              page_id: job.data.pageId || brand.page_id || "Unknown",
              page_name: brand.actual_name || "Unknown",
              total_ads: totalAds,
              page_category: pageCategory || "Unknown",
              created_at: job.timestamp || new Date().toISOString(),
              is_watchlist: true,
            });
          }
        }
      }
    }

    // Sort by brand_id
    watchlistJobs.sort((a, b) => b.brand_id - a.brand_id);

    // Apply pagination
    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedBrands = watchlistJobs.slice(startIndex, endIndex);

    return {
      brands: paginatedBrands,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: watchlistJobs.length,
        total_pages: Math.ceil(watchlistJobs.length / validLimit),
      },

    };
  } catch (error) {
    logger.error("Error in getWatchlistBrandsQueue:", error);
    throw error;
  }
}

module.exports = {
  initializeBullMQQueue,
  getBullMQJobStates,
  getBrandProcessingQueue,
  getWatchlistBrandsQueue,
};
