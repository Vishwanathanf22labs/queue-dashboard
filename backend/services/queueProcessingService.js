const { PAGINATION, JOB_FETCH_LIMIT } = require("../config/constants");
const { Queue } = require("bullmq");
const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const Brand = require("../models/Brand");
const logger = require("../utils/logger");
const WatchList = require("../models/WatchList");

let regularBrandProcessingQueue = null;
let watchlistBrandProcessingQueue = null;

async function initializeBullMQQueues() {
  try {
    // Initialize regular brand processing queue
    if (!regularBrandProcessingQueue) {
      const regularRedis = getQueueRedis('regular');
      regularBrandProcessingQueue = new Queue("brand-processing", {
        connection: regularRedis,
      });
      logger.info("BullMQ Queue initialized for regular brand-processing");
    }

    // Initialize watchlist brand processing queue
    if (!watchlistBrandProcessingQueue) {
      const watchlistRedis = getQueueRedis('watchlist');
      watchlistBrandProcessingQueue = new Queue("brand-processing", {
        connection: watchlistRedis,
      });
      logger.info("BullMQ Queue initialized for watchlist brand-processing");
    }

    return { regularBrandProcessingQueue, watchlistBrandProcessingQueue };
  } catch (error) {
    logger.error("Error in initializeBullMQQueues:", error);
    throw error;
  }
}

async function getBullMQJobStates(queueType = 'regular') {
  try {
    await initializeBullMQQueues();

    const queue = queueType === 'watchlist' ? watchlistBrandProcessingQueue : regularBrandProcessingQueue;
    const redis = getQueueRedis(queueType);

    const jobCounts = await queue.getJobCounts(
      "waiting",
      "active",
      "delayed",
      "completed",
      "failed"
    );

    const totalJobsCreated = parseInt(
      (await redis.get("bull:brand-processing:id")) || 0
    );

    logger.info(
      `Total Jobs Created (${queueType} Redis):`,
      totalJobsCreated
    );

    const totalInSystem = Object.values(jobCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    return {
      queue_type: queueType,
      job_states: {
        waiting: jobCounts.waiting || 0,
        active: jobCounts.active || 0,
        delayed: jobCounts.delayed || 0,
        completed: jobCounts.completed || 0,
        failed: jobCounts.failed || 0,
      },
      totals: {
        total_jobs_created: totalJobsCreated,
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
    logger.error(`Error in getBullMQJobStates (${queueType}):`, error);
    throw error;
  }
}

async function getBrandProcessingQueue(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT,
  queueType = 'regular'
) {
  try {
    await initializeBullMQQueues();

    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

    const queue = queueType === 'watchlist' ? watchlistBrandProcessingQueue : regularBrandProcessingQueue;
    const redis = getQueueRedis(queueType);

    const totalJobsCreated = parseInt(
      (await redis.get("bull:brand-processing:id")) || 0
    );

    logger.info(`Total Jobs Created (${queueType}):`, totalJobsCreated);

    const [waiting, active, delayed, completed, failed] = await Promise.all([
      queue.getJobs(["waiting"], 0, JOB_FETCH_LIMIT),
      queue.getJobs(["active"], 0, JOB_FETCH_LIMIT),
      queue.getJobs(["delayed"], 0, JOB_FETCH_LIMIT),
      queue.getJobs(["completed"], 0, JOB_FETCH_LIMIT),
      queue.getJobs(["failed"], 0, JOB_FETCH_LIMIT),
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

        brandProcessingData.push({
          brand_id: brandId,
          page_id: brand?.page_id || "Unknown",
          page_name: brand?.actual_name || "Unknown",
          total_ads: totalAds,
          page_category: pageCategory || "Unknown",
          created_at: new Date(job.timestamp).toISOString(),
          is_watchlist: queueType === 'watchlist',
          queue_type: queueType,
        });
      } catch (jobError) {
        logger.error(`Error processing job ${job.id}:`, jobError);
      }
    }

    brandProcessingData.sort(
      (a, b) => parseInt(b.brand_id) - parseInt(a.brand_id)
    );

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
      queue_type: queueType,
    };
  } catch (error) {
    logger.error(`Error in getBrandProcessingQueue (${queueType}):`, error);
    throw error;
  }
}

async function getWatchlistBrandsQueue(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT
) {
  try {
    // Use the new getBrandProcessingQueue function with watchlist queue type
    return await getBrandProcessingQueue(page, limit, 'watchlist');
  } catch (error) {
    logger.error("Error in getWatchlistBrandsQueue:", error);
    throw error;
  }
}

module.exports = {
  initializeBullMQQueues,
  getBullMQJobStates,
  getBrandProcessingQueue,
  getWatchlistBrandsQueue,
};
