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

    // 🚀 OPTIMIZATION 1: Fetch only what we need with pagination
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      brandProcessingQueue.getJobs(["waiting"], 0, validLimit * 2), // Only fetch what we need
      brandProcessingQueue.getJobs(["active"], 0, validLimit * 2),
      brandProcessingQueue.getJobs(["delayed"], 0, validLimit * 2),
      brandProcessingQueue.getJobs(["completed"], 0, validLimit * 2),
      brandProcessingQueue.getJobs(["failed"], 0, validLimit * 2),
    ]);

    const allJobs = [
      ...active,
      ...waiting,
      ...delayed,
      ...completed,
      ...failed,
    ];

    if (allJobs.length === 0) {
      return {
        brands: [],
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: 0,
          total_pages: 0,
        },
      };
    }

    // 🚀 OPTIMIZATION 2: Batch collect unique brand IDs
    const uniqueBrandIds = [
      ...new Set(allJobs.map((job) => job.data.brandId).filter(Boolean)),
    ];

    if (uniqueBrandIds.length === 0) {
      return {
        brands: [],
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: 0,
          total_pages: 0,
        },
      };
    }

    // 🚀 OPTIMIZATION 3: Single batch query for all brands
    const brands = await Brand.findAll({
      where: { id: uniqueBrandIds },
      attributes: ["id", "actual_name", "page_id"],
      raw: true,
    });

    // 🚀 OPTIMIZATION 4: Single batch query for watchlist status
    const watchlistBrands = await WatchList.findAll({
      where: { brand_id: uniqueBrandIds },
      attributes: ["brand_id"],
      raw: true,
    });

    // Create lookup maps for O(1) access
    const brandMap = new Map(brands.map((b) => [b.id, b]));
    const watchlistSet = new Set(watchlistBrands.map((w) => w.brand_id));

    // 🚀 OPTIMIZATION 5: Process jobs with O(1) lookups
    const brandProcessingData = [];
    const processedBrandIds = new Set();

    for (const job of allJobs) {
      try {
        const brandId = parseInt(job.data.brandId);
        const pageCategory = job.data.brandDetails?.page_category;
        const totalAds = job.data.totalAds?.length || 0;

        if (brandId && !processedBrandIds.has(brandId)) {
          processedBrandIds.add(brandId);

          const brand = brandMap.get(brandId);
          const isInWatchlist = watchlistSet.has(brandId);

          // Only include regular brands (not watchlist brands)
          if (!isInWatchlist && brand) {
            brandProcessingData.push({
              brand_id: brandId,
              page_id: brand.page_id || "Unknown",
              page_name: brand.actual_name || "Unknown",
              total_ads: totalAds,
              page_category: pageCategory || "Unknown",
              created_at: new Date(job.timestamp).toISOString(),
              is_watchlist: false,
            });
          }
        }
      } catch (jobError) {
        logger.error(`Error processing job ${job.id}:`, jobError);
      }
    }

    brandProcessingData.sort(
      (a, b) => parseInt(b.brand_id) - parseInt(a.brand_id)
    );

    // Apply pagination
    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedBrands = brandProcessingData.slice(startIndex, endIndex);

    return {
      brands: paginatedBrands,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: brandProcessingData.length,
        total_pages: Math.ceil(brandProcessingData.length / validLimit),
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

    // 🚀 OPTIMIZATION 1: Fetch only what we need with pagination
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      brandProcessingQueue.getJobs(["waiting"], 0, validLimit * 2), // Only fetch what we need
      brandProcessingQueue.getJobs(["active"], 0, validLimit * 2),
      brandProcessingQueue.getJobs(["delayed"], 0, validLimit * 2),
      brandProcessingQueue.getJobs(["completed"], 0, validLimit * 2),
      brandProcessingQueue.getJobs(["failed"], 0, validLimit * 2),
    ]);

    const allJobs = [
      ...active,
      ...waiting,
      ...delayed,
      ...completed,
      ...failed,
    ];

    if (allJobs.length === 0) {
      return {
        brands: [],
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: 0,
          total_pages: 0,
        },
      };
    }

    // 🚀 OPTIMIZATION 2: Batch collect unique brand IDs
    const uniqueBrandIds = [
      ...new Set(allJobs.map((job) => job.data.brandId).filter(Boolean)),
    ];

    if (uniqueBrandIds.length === 0) {
      return {
        brands: [],
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: 0,
          total_pages: 0,
        },
      };
    }

    // 🚀 OPTIMIZATION 3: Single batch query for all brands
    const brands = await Brand.findAll({
      where: { id: uniqueBrandIds },
      attributes: ["id", "actual_name", "page_id"],
      raw: true,
    });

    // 🚀 OPTIMIZATION 4: Single batch query for watchlist status
    const watchlistBrands = await WatchList.findAll({
      where: { brand_id: uniqueBrandIds },
      attributes: ["brand_id"],
      raw: true,
    });

    // Create lookup maps for O(1) access
    const brandMap = new Map(brands.map((b) => [b.id, b]));
    const watchlistSet = new Set(watchlistBrands.map((w) => w.brand_id));

    // 🚀 OPTIMIZATION 5: Process jobs with O(1) lookups
    const watchlistJobs = [];
    const processedBrandIds = new Set();

    for (const job of allJobs) {
      const brandId = parseInt(job.data.brandId);
      const pageCategory = job.data.brandDetails?.page_category;
      const totalAds = job.data.totalAds?.length || 0;

      if (
        brandId &&
        !processedBrandIds.has(brandId) &&
        watchlistSet.has(brandId)
      ) {
        processedBrandIds.add(brandId);

        const brand = brandMap.get(brandId);
        if (brand) {
          watchlistJobs.push({
            brand_id: brandId,
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
