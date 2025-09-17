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
  queueType = 'regular',
  sortBy = 'normal',
  sortOrder = 'desc'
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

    // Get all jobs from all states
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      queue.getJobs(["waiting"], 0, JOB_FETCH_LIMIT),
      queue.getJobs(["active"], 0, JOB_FETCH_LIMIT),
      queue.getJobs(["delayed"], 0, JOB_FETCH_LIMIT),
      queue.getJobs(["completed"], 0, JOB_FETCH_LIMIT),
      queue.getJobs(["failed"], 0, JOB_FETCH_LIMIT),
    ]);

    // Also get all individual job keys from Redis
    const jobKeys = await redis.keys("bull:brand-processing:[0-9]*");
    const individualJobs = [];
    
    for (const key of jobKeys) {
      try {
        const jobData = await redis.hgetall(key);
        if (jobData && jobData.data) {
          const job = JSON.parse(jobData.data);
          const jobId = key.split(':').pop();
          individualJobs.push({
            id: jobId,
            data: job,
            timestamp: parseInt(jobData.timestamp) || Date.now(),
            state: jobData.state || 'unknown'
          });
        }
      } catch (error) {
        logger.warn(`Error parsing job ${key}:`, error.message);
      }
    }

    // Show ALL jobs with their states
    const allJobs = [
      ...active.map(job => ({ ...job, state: 'active' })),
      ...waiting.map(job => ({ ...job, state: 'waiting' })),
      ...delayed.map(job => ({ ...job, state: 'delayed' })),
      ...completed.map(job => ({ ...job, state: 'completed' })),
      ...failed.map(job => ({ ...job, state: 'failed' })),
      ...individualJobs
    ];

    // Remove duplicates based on job ID
    const uniqueJobs = allJobs.filter((job, index, self) => 
      index === self.findIndex(j => j.id === job.id)
    );

    logger.info(`Found ${uniqueJobs.length} total jobs (${active.length} active, ${delayed.length} delayed, ${waiting.length} waiting, ${completed.length} completed, ${failed.length} failed)`);
    const brandProcessingData = [];

    for (const job of uniqueJobs) {
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
          job_status: job.state || 'unknown',
          job_id: job.id
        });
      } catch (jobError) {
        logger.error(`Error processing job ${job.id}:`, jobError);
      }
    }

    // Sort by the specified field and order
    if (sortBy !== 'normal') {
      brandProcessingData.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'total_ads':
            aValue = parseInt(a.total_ads) || 0;
            bValue = parseInt(b.total_ads) || 0;
            break;
          case 'brand_id':
            aValue = parseInt(a.brand_id) || 0;
            bValue = parseInt(b.brand_id) || 0;
            break;
          case 'created_at':
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
            break;
          case 'page_name':
            aValue = (a.page_name || '').toLowerCase();
            bValue = (b.page_name || '').toLowerCase();
            break;
          default:
            aValue = parseInt(a.total_ads) || 0;
            bValue = parseInt(b.total_ads) || 0;
        }
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });
    }
    // If sortBy is 'normal', keep original order (no sorting)

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
  limit = PAGINATION.DEFAULT_LIMIT,
  sortBy = 'normal',
  sortOrder = 'desc'
) {
  try {
    // Use the new getBrandProcessingQueue function with watchlist queue type
    return await getBrandProcessingQueue(page, limit, 'watchlist', sortBy, sortOrder);
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
