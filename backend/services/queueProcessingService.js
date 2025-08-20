const { PAGINATION, JOB_FETCH_LIMIT } = require("../config/constants");
const { Queue } = require("bullmq");
const redis = require("../config/redis");
const Brand = require("../models/Brand");
const logger = require("../utils/logger");

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

    const jobStates = await getBullMQJobStates();
    const totalJobs = jobStates.totals.total_in_system;

    logger.info("Total Jobs from BullMQ:", totalJobs);

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
        const { brandId, brandDetails, totalAds } = job.data;

        const brand = await Brand.findOne({
          where: { id: brandId },
          attributes: ["actual_name", "page_id", "status"],
          raw: true,
        });

        const jobState = await job.getState();

        brandProcessingData.push({
          job_id: job.id,
          brand_id: brandId,
          page_id: brand?.page_id || brandDetails?.page_id || "Unknown",
          page_name: brand?.actual_name || brandDetails?.page_name || "Unknown",
          job_status: jobState,
          created_at: new Date(job.timestamp).toISOString(),
          processed_at: job.processedOn
            ? new Date(job.processedOn).toISOString()
            : null,
          finished_at: job.finishedOn
            ? new Date(job.finishedOn).toISOString()
            : null,
          progress: job.progress || 0,
          total_ads: totalAds ? totalAds.length : 0,

          likes: brandDetails?.likes || 0,
          page_category: brandDetails?.page_category || "Unknown",
          ig_followers: brandDetails?.ig_followers || 0,
          ig_username: brandDetails?.ig_username || null,

          attempts: job.attemptsMade || 0,
          delay: job.delay || 0,
        });
      } catch (jobError) {
        logger.error(`Error processing job ${job.id}:`, jobError);
      }
    }

    brandProcessingData.sort((a, b) => parseInt(b.job_id) - parseInt(a.job_id));

    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedBrands = brandProcessingData.slice(startIndex, endIndex);

    return {
      brands: paginatedBrands,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: totalJobs,
        total_pages: Math.ceil(totalJobs / validLimit),
      },
      queue_stats: jobStates.job_states,
      totals: jobStates.totals,
    };
  } catch (error) {
    logger.error("Error in getBrandProcessingQueue:", error);
    throw error;
  }
}

module.exports = {
  initializeBullMQQueue,
  getBullMQJobStates,
  getBrandProcessingQueue,
};
