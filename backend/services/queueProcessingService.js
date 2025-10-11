const { PAGINATION, JOB_FETCH_LIMIT } = require("../config/constants");
const { Queue } = require("bullmq");
const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { Op } = require("sequelize");
const crypto = require('crypto');
const {
  getQueueCache,
  setQueueCache,
  getQueueETag,
  setQueueETag,
  generateETag,
  getCachedData,
  setCachedData
} = require("./utils/cacheUtils");

let regularBrandProcessingQueue = null;
let watchlistBrandProcessingQueue = null;

const QUEUE_CACHE_TTL = 30;

let jobIndex = {
  regular: { jobs: [], lastUpdated: 0, brandIds: new Set() },
  watchlist: { jobs: [], lastUpdated: 0, brandIds: new Set() }
};

let brandCache = new Map();
let brandCacheLastUpdated = 0;

const JOB_INDEX_REFRESH_INTERVAL = 30000;
const BRAND_CACHE_REFRESH_INTERVAL = 60000;

async function getCachedQueueData(queueType, page, limit, sortBy, sortOrder, ifNoneMatch) {
  try {
    const cachedData = await getQueueCache(queueType, page, limit, sortBy, sortOrder);
    const cachedETag = await getQueueETag(queueType, page, limit, sortBy, sortOrder);

    if (!cachedData || !cachedETag) {
      return null;
    }

    if (ifNoneMatch && ifNoneMatch === cachedETag) {
      return { status: 304, etag: cachedETag };
    }

    return {
      data: cachedData,
      etag: cachedETag,
      fromCache: true
    };
  } catch (error) {
    logger.error('Error getting cached queue data:', error);
    return null;
  }
}

async function setCachedQueueData(queueType, page, limit, data, sortBy, sortOrder) {
  try {
    const etag = generateETag(data);

    await Promise.all([
      setQueueCache(queueType, page, limit, data, sortBy, sortOrder, QUEUE_CACHE_TTL),
      setQueueETag(queueType, page, limit, etag, sortBy, sortOrder, QUEUE_CACHE_TTL)
    ]);

    return etag;
  } catch (error) {
    logger.error('Error setting cached queue data:', error);
    return null;
  }
}

async function getPreComputedQueueCounters(redis, queueType) {
  const counterKey = `queue:${queueType}:counters`;

  try {
    const counters = await redis.hgetall(counterKey);

    if (counters && Object.keys(counters).length > 0) {
      return {
        waiting: parseInt(counters.waiting) || 0,
        active: parseInt(counters.active) || 0,
        prioritized: parseInt(counters.prioritized) || 0,
        delayed: parseInt(counters.delayed) || 0,
        completed: parseInt(counters.completed) || 0,
        failed: parseInt(counters.failed) || 0,
        total: parseInt(counters.total) || 0
      };
    }

    const [waitingJobs, activeJobs, prioritizedCount, completedCount, failedCount, delayedCount] = await Promise.all([
      redis.lrange(`bull:brand-processing:waiting`, 0, -1).catch(() => []),
      redis.lrange(`bull:brand-processing:active`, 0, -1).catch(() => []),
      redis.zcard(`bull:brand-processing:prioritized`).catch(() => 0),
      redis.zcard(`bull:brand-processing:completed`).catch(() => 0),
      redis.zcard(`bull:brand-processing:failed`).catch(() => 0),
      redis.zcard(`bull:brand-processing:delayed`).catch(() => 0)
    ]);

    const realCounters = {
      waiting: waitingJobs.length,
      active: activeJobs.length,
      prioritized: prioritizedCount,
      delayed: delayedCount,
      completed: completedCount,
      failed: failedCount,
      total: waitingJobs.length + activeJobs.length + prioritizedCount + delayedCount + completedCount + failedCount
    };

    try {
      await redis.hset(counterKey, realCounters);
      await redis.expire(counterKey, 10);
    } catch (cacheError) {
      logger.warn(`Failed to cache counters: ${cacheError.message}`);
    }

    return realCounters;
  } catch (error) {
    logger.error(`Error getting pre-computed counters for ${queueType}:`, error);
    return {
      waiting: 0, active: 0, prioritized: 0, delayed: 0, completed: 0, failed: 0, total: 0
    };
  }
}

async function updateQueueCounters(redis, queueType, stateChange) {
  const counterKey = `queue:${queueType}:counters`;

  try {
    const pipeline = redis.pipeline();

    if (stateChange.fromState) {
      pipeline.hincrby(counterKey, stateChange.fromState, -1);
    }
    if (stateChange.toState) {
      pipeline.hincrby(counterKey, stateChange.toState, 1);
    }

    if (stateChange.isNewJob) {
      pipeline.hincrby(counterKey, 'total', 1);
    }

    await pipeline.exec();
    logger.info(`Updated ${queueType} queue counters: ${stateChange.fromState} -> ${stateChange.toState}`);
  } catch (error) {
    logger.error(`Error updating queue counters for ${queueType}:`, error);
  }
}

async function getBrandsFromCache(brandIds) {
  const startTime = process.hrtime.bigint();

  try {
    const now = Date.now();

    if (brandCache.size === 0 || (now - brandCacheLastUpdated) > BRAND_CACHE_REFRESH_INTERVAL) {
      logger.info('Refreshing brand cache...');
      await refreshBrandCache();
    }

    const brandMap = new Map();
    const missingBrandIds = [];

    brandIds.forEach(brandId => {
      const intBrandId = parseInt(brandId);
      if (brandCache.has(intBrandId)) {
        brandMap.set(brandId, brandCache.get(intBrandId));
      } else {
        missingBrandIds.push(intBrandId);
      }
    });

    if (missingBrandIds.length > 0) {
      logger.info(`Fetching ${missingBrandIds.length} missing brands from DB`);
      const { Brand } = require("../models");
      const missingBrands = await Brand.findAll({
        where: { id: { [Op.in]: missingBrandIds } },
        attributes: ["id", "actual_name", "page_id", "category", "actual_ads_count"],
        raw: true,
      });

      missingBrands.forEach(brand => {
        brandCache.set(brand.id, brand);
        brandMap.set(brand.id, brand);
      });
    }

    const cacheDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`Brand cache lookup completed in ${cacheDuration}ms: ${brandMap.size}/${brandIds.length} brands found`);

    return brandMap;
  } catch (error) {
    logger.error('Error in brand cache lookup:', error);
    return new Map();
  }
}

async function refreshBrandCache() {
  const startTime = process.hrtime.bigint();

  try {
    const { Brand } = require("../models");

    const allBrandIds = new Set();
    Object.values(jobIndex).forEach(index => {
      index.brandIds.forEach(brandId => allBrandIds.add(brandId));
    });

    if (allBrandIds.size === 0) {
      logger.info('No brand IDs to cache');
      return;
    }

    const brands = await Brand.findAll({
      where: { id: { [Op.in]: Array.from(allBrandIds) } },
      attributes: ["id", "actual_name", "page_id", "category", "actual_ads_count"],
      raw: true,
    });

    brandCache.clear();
    brands.forEach(brand => brandCache.set(brand.id, brand));
    brandCacheLastUpdated = Date.now();

    const refreshDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`Brand cache refreshed in ${refreshDuration}ms: ${brands.length} brands cached`);

  } catch (error) {
    logger.error('Error refreshing brand cache:', error);
  }
}

function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

let backgroundRefreshInterval = null;
const HOT_DATA_REFRESH_INTERVAL = 300000;
const HOT_PATTERNS = [
  { queueType: 'regular', page: 1, limit: 10, sortBy: 'normal', sortOrder: 'desc' },
  { queueType: 'regular', page: 1, limit: 20, sortBy: 'normal', sortOrder: 'desc' },
  { queueType: 'watchlist', page: 1, limit: 10, sortBy: 'normal', sortOrder: 'desc' },
  { queueType: 'watchlist', page: 1, limit: 20, sortBy: 'normal', sortOrder: 'desc' }
];

function clearInMemoryCaches() {
  try {
    jobIndex = {
      regular: { jobs: [], lastUpdated: 0, brandIds: new Set() },
      watchlist: { jobs: [], lastUpdated: 0, brandIds: new Set() }
    };

    brandCache.clear();
    brandCacheLastUpdated = 0;

    console.log('QueueProcessingService in-memory caches cleared');
  } catch (error) {
    console.error('Error clearing QueueProcessingService caches:', error);
  }
}

function startBackgroundRefresh() {
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval);
  }

  backgroundRefreshInterval = setInterval(async () => {
    try {
      logger.info('Starting background cache warming for hot queue data...');

      const redisRegular = getQueueRedis('regular');
      const redisWatchlist = getQueueRedis('watchlist');

      if (redisRegular) await refreshJobIndex(redisRegular, 'regular');
      if (redisWatchlist) await refreshJobIndex(redisWatchlist, 'watchlist');

      await refreshBrandCache();

      const refreshPromises = HOT_PATTERNS.map(async (pattern) => {
        try {
          await getBrandProcessingQueue(
            pattern.page,
            pattern.limit,
            pattern.queueType,
            pattern.sortBy,
            pattern.sortOrder
          );

          logger.info(`Warmed cache for ${pattern.queueType} queue (page ${pattern.page}, limit ${pattern.limit})`);
        } catch (error) {
          logger.error(`Failed to warm cache for ${pattern.queueType}:`, error);
        }
      });

      await Promise.all(refreshPromises);
      logger.info('Background cache warming completed');
    } catch (error) {
      logger.error('Error in background cache warming:', error);
    }
  }, HOT_DATA_REFRESH_INTERVAL);

  logger.info(`Background refresh started (every ${HOT_DATA_REFRESH_INTERVAL / 1000}s)`);
}

async function initializeCaches() {
  try {
    logger.info('Initializing caches for ultra-fast queue APIs...');

    const redisRegular = getQueueRedis('regular');
    const redisWatchlist = getQueueRedis('watchlist');

    if (redisRegular) await refreshJobIndex(redisRegular, 'regular');
    if (redisWatchlist) await refreshJobIndex(redisWatchlist, 'watchlist');

    await refreshBrandCache();

    logger.info('Cache initialization completed - queue APIs ready for sub-second responses!');
  } catch (error) {
    logger.error('Error initializing caches:', error);
  }
}

function stopBackgroundRefresh() {
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval);
    backgroundRefreshInterval = null;
    logger.info('Background refresh stopped');
  }
}

const performanceMetrics = {
  requestCount: 0,
  totalResponseTime: 0,
  cacheHits: 0,
  cacheMisses: 0,
  averageResponseTime: 0,
  lastReset: Date.now()
};

function recordPerformanceMetrics(responseTime, fromCache = false) {
  performanceMetrics.requestCount++;
  performanceMetrics.totalResponseTime += responseTime;
  performanceMetrics.averageResponseTime = performanceMetrics.totalResponseTime / performanceMetrics.requestCount;

  if (fromCache) {
    performanceMetrics.cacheHits++;
  } else {
    performanceMetrics.cacheMisses++;
  }

  if (performanceMetrics.requestCount % 100 === 0) {
    logger.info('Performance Metrics:', {
      requests: performanceMetrics.requestCount,
      avgResponseTime: Math.round(performanceMetrics.averageResponseTime) + 'ms',
      cacheHitRate: Math.round((performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses)) * 100) + '%',
      uptime: Math.round((Date.now() - performanceMetrics.lastReset) / 1000) + 's'
    });
  }
}

function getPerformanceMetrics() {
  return {
    ...performanceMetrics,
    cacheHitRate: performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses) * 100,
    uptime: Date.now() - performanceMetrics.lastReset
  };
}

function resetPerformanceMetrics() {
  performanceMetrics.requestCount = 0;
  performanceMetrics.totalResponseTime = 0;
  performanceMetrics.cacheHits = 0;
  performanceMetrics.cacheMisses = 0;
  performanceMetrics.averageResponseTime = 0;
  performanceMetrics.lastReset = Date.now();
  logger.info('Performance metrics reset');
}

if (process.env.NODE_ENV === 'production') {
  setTimeout(() => {
    initializeCaches();
  }, 1000);

  setTimeout(() => {
    startBackgroundRefresh();
  }, 3000);
} else {
  setTimeout(() => {
    initializeCaches();
  }, 500);

  setTimeout(() => {
    startBackgroundRefresh();
  }, 1000);
}

async function refreshJobIndex(redis, queueType) {
  const startTime = process.hrtime.bigint();

  try {
    const jobStates = new Map();

    try {
      const [waitingJobs, activeJobs, prioritizedJobs, completedJobs, failedJobs, delayedJobs] = await Promise.all([
        redis.lrange(`bull:brand-processing:waiting`, 0, -1).catch(() => []),
        redis.lrange(`bull:brand-processing:active`, 0, -1).catch(() => []),
        redis.zrange(`bull:brand-processing:prioritized`, 0, -1).catch(() => []),
        redis.zrange(`bull:brand-processing:completed`, 0, -1).catch(() => []),
        redis.zrange(`bull:brand-processing:failed`, 0, -1).catch(() => []),
        redis.zrange(`bull:brand-processing:delayed`, 0, -1).catch(() => [])
      ]);

      delayedJobs.forEach(jobId => jobStates.set(jobId, 'delayed'));
      failedJobs.forEach(jobId => jobStates.set(jobId, 'failed'));
      completedJobs.forEach(jobId => jobStates.set(jobId, 'completed'));
      prioritizedJobs.forEach(jobId => jobStates.set(jobId, 'prioritized'));
      waitingJobs.forEach(jobId => jobStates.set(jobId, 'waiting'));
      activeJobs.forEach(jobId => jobStates.set(jobId, 'active'));

      logger.info(`Job states loaded: waiting=${waitingJobs.length}, active=${activeJobs.length}, prioritized=${prioritizedJobs.length}, completed=${completedJobs.length}, failed=${failedJobs.length}, delayed=${delayedJobs.length}`);
    } catch (error) {
      logger.warn(`Error loading job states, continuing without state info: ${error.message}`);
    }

    const pattern = "bull:brand-processing:*";
    let cursor = '0';
    const allKeys = [];

    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      allKeys.push(...result[1]);
    } while (cursor !== '0');

    const filteredKeys = allKeys.filter(key =>
      !key.includes(':lock') &&
      !key.includes(':meta') &&
      !key.includes(':marker') &&
      !key.includes(':waiting') &&
      !key.includes(':active') &&
      !key.includes(':prioritized') &&
      !key.includes(':completed') &&
      !key.includes(':failed') &&
      !key.includes(':delayed') &&
      /bull:brand-processing:\d+$/.test(key)
    );

    if (filteredKeys.length === 0) {
      jobIndex[queueType] = { jobs: [], lastUpdated: Date.now(), brandIds: new Set() };
      return;
    }

    const chunkSize = 50;
    const jobs = [];
    const brandIds = new Set();

    for (let i = 0; i < filteredKeys.length; i += chunkSize) {
      const chunk = filteredKeys.slice(i, i + chunkSize);

      const pipeline = redis.pipeline();
      chunk.forEach(key => pipeline.hgetall(key));
      const results = await pipeline.exec();

      results.forEach(([err, jobData], index) => {
        if (err) return;

        const jobId = chunk[index].split(":").pop();

        const actualState = jobStates.get(jobId) || 'unknown';

        if (!jobData || Object.keys(jobData).length === 0) {
          jobs.push({
            id: jobId,
            data: { brandId: null, totalAds: [] },
            timestamp: Date.now(),
            state: actualState
          });
          return;
        }

        if (!jobData.data) return;

        try {
          const job = JSON.parse(jobData.data);

          if (job && job.brandId) {
            jobs.push({
              id: jobId,
              data: job,
              timestamp: parseInt(jobData.timestamp) || Date.now(),
              state: actualState
            });
            brandIds.add(job.brandId);
          } else {
            jobs.push({
              id: jobId,
              data: { brandId: null, totalAds: [] },
              timestamp: parseInt(jobData.timestamp) || Date.now(),
              state: actualState
            });
          }
        } catch (parseError) {
          jobs.push({
            id: jobId,
            data: { brandId: null, totalAds: [] },
            timestamp: Date.now(),
            state: actualState
          });
        }
      });
    }

    jobIndex[queueType] = {
      jobs: jobs,
      lastUpdated: Date.now(),
      brandIds: brandIds
    };

    const refreshDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`Job index refreshed for ${queueType} in ${refreshDuration}ms: ${jobs.length} jobs, ${brandIds.size} unique brands`);

  } catch (error) {
    logger.error(`Error refreshing job index for ${queueType}:`, error);
  }
}

async function getJobsOptimized(redis, queueType, pattern = "bull:brand-processing:*") {
  const now = Date.now();
  const indexData = jobIndex[queueType];

  if (!indexData || indexData.jobs.length === 0 || (now - indexData.lastUpdated) > JOB_INDEX_REFRESH_INTERVAL) {
    logger.info(`Refreshing job index for ${queueType} (stale or empty)`);
    await refreshJobIndex(redis, queueType);
  }

  return jobIndex[queueType].jobs.map(job => `bull:brand-processing:${job.id}`);
}

async function getJobDataBatch(redis, jobKeys, queueType) {
  if (jobKeys.length === 0) return [];

  const startTime = process.hrtime.bigint();

  try {
    const indexData = jobIndex[queueType];

    if (!indexData || indexData.jobs.length === 0) {
      logger.warn(`No job data in index for ${queueType}`);
      return [];
    }

    const jobMap = new Map(indexData.jobs.map(job => [job.id, job]));

    const jobs = jobKeys
      .map(key => {
        const jobId = key.split(":").pop();
        return jobMap.get(jobId);
      })
      .filter(Boolean);

    const indexDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`Index lookup completed in ${indexDuration}ms, processed ${jobs.length} jobs`);

    return jobs;
  } catch (error) {
    logger.error('Error in getJobDataBatch:', error);
    return [];
  }
}

async function getTotalAdsCount(queueType) {
  try {
    const redis = getQueueRedis(queueType);

    const indexData = jobIndex[queueType];

    if (!indexData || indexData.jobs.length === 0) {
      return 0;
    }

    let totalAds = 0;
    indexData.jobs.forEach(job => {
      try {
        if (job.data && job.data.totalAds && Array.isArray(job.data.totalAds)) {
          totalAds += job.data.totalAds.length;
        }
      } catch (error) {
      }
    });

    logger.info(`${queueType} brands total ads count: ${totalAds}`);
    return totalAds;
  } catch (error) {
    logger.error(`Error getting ${queueType} total ads count:`, error);
    return 0;
  }
}

async function initializeBullMQQueues() {
  try {
    if (!regularBrandProcessingQueue) {
      const regularRedis = getQueueRedis('regular');
      regularBrandProcessingQueue = new Queue("brand-processing", {
        connection: regularRedis,
      });
      logger.info("BullMQ Queue initialized for regular brand-processing");
    }

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
  queueType = "regular",
  sortBy = "normal",
  sortOrder = "desc",
  ifNoneMatch = null,
  search = null,
  environment = 'production'
) {
  const startTime = process.hrtime.bigint();

  try {
    await initializeBullMQQueues();

    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

    const queue =
      queueType === "watchlist"
        ? watchlistBrandProcessingQueue
        : regularBrandProcessingQueue;
    const redis = getQueueRedis(queueType, environment);

    if (!queue) {
      logger.error(`Queue not initialized for ${queueType}`);
      throw new Error(`Queue not initialized for ${queueType}`);
    }

    if (!redis) {
      logger.error(`Redis not available for ${queueType}`);
      throw new Error(`Redis not available for ${queueType}`);
    }

    if (!search || !search.trim()) {
      const cachedResult = await getCachedQueueData(queueType, validPage, validLimit, sortBy, sortOrder, ifNoneMatch);
      if (cachedResult) {
        const cacheDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
        logger.info(`Cache HIT for ${queueType} queue in ${cacheDuration}ms`);

        recordPerformanceMetrics(cacheDuration, true);

        if (cachedResult.status === 304) {
          return { status: 304, etag: cachedResult.etag };
        }

        return {
          ...cachedResult.data,
          fromCache: true,
          cache_time_ms: Math.round(cacheDuration)
        };
      }
    }

    const preComputedCounters = await getPreComputedQueueCounters(redis, queueType);
    logger.info(`Pre-computed counters for ${queueType}:`, preComputedCounters);

    const totalJobsCreated = parseInt(
      (await redis.get("bull:brand-processing:id")) || 0
    );

    logger.info(`Total Jobs Created (${queueType}):`, totalJobsCreated);
    logger.info(`Queue instance status:`, {
      queueExists: !!queue,
      queueType: queueType,
      redisConnected: !!redis
    });

    let allJobs = [];

    try {
      const indexData = jobIndex[queueType];

      if (indexData && indexData.jobs.length > 0) {
        allJobs = indexData.jobs;
        logger.info(`Ultra-fast job fetching from index: ${allJobs.length} jobs`);
      } else {
        logger.info(`Index empty, refreshing for ${queueType}...`);
        await refreshJobIndex(redis, queueType);
        allJobs = jobIndex[queueType]?.jobs || [];
        logger.info(`Job index refreshed: ${allJobs.length} jobs`);
      }
    } catch (error) {
      logger.error(`Error in ultra-fast job fetching:`, error);
      allJobs = [];
    }

    const uniqueJobs = allJobs
      .filter((job, index, self) => index === self.findIndex((j) => j.id === job.id));

    logger.info(`Found ${uniqueJobs.length} total jobs for ${queueType} queue`);

    if (uniqueJobs.length === 0) {
      logger.warn(`No valid jobs found for ${queueType} queue`);
      const emptyDuration = Number(process.hrtime.bigint() - startTime) / 1000000;

      return {
        brands: [],
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: 0,
          total_pages: 0,
        },
        queue_type: queueType,
        analytics: {
          current_page_total_ads: 0,
          processing_time_ms: Math.round(emptyDuration),
          pre_computed_counters: preComputedCounters,
          performance_metrics: getPerformanceMetrics(),
        },
        total_ads_regular: queueType === 'regular' ? 0 : undefined,
        total_ads_watchlist: queueType === 'watchlist' ? 0 : undefined,
      };
    }

    const brandIds = [...new Set(uniqueJobs.map(job => job.data.brandId))];

    const brandMap = await getBrandsFromCache(brandIds);

    const brandProcessingData = [];

    for (const job of uniqueJobs) {
      try {
        const jobData = job.data || {};
        const brandId = jobData.brandId;

        if (!brandId) {
          logger.warn(`Skipping job ${job.id} - no brandId found`);
          continue;
        }

        let pageCategory = jobData.brandDetails?.page_category;

        if (!pageCategory && jobData.brandDetails?.page_categories) {
          pageCategory = Array.isArray(jobData.brandDetails.page_categories)
            ? jobData.brandDetails.page_categories.join(", ")
            : jobData.brandDetails.page_categories;
        }
        const totalAds = jobData.totalAds?.length || 0;

        const brand = brandMap.get(brandId);

        if (!pageCategory && brand?.category) {
          pageCategory = brand.category;
        }

        const finalBrandData = {
          brand_id: brandId,
          page_id: brand?.page_id || "Unknown",
          page_name: brand?.actual_name || "Unknown",
          total_ads: totalAds,
          actual_ads_count: brand?.actual_ads_count || null,
          page_category: pageCategory || "Unknown",
          created_at: new Date(job.timestamp || Date.now()).toISOString(),
          is_watchlist: queueType === "watchlist",
          queue_type: queueType,
          job_status: job.state || "unknown",
          job_id: job.id,
        };

        brandProcessingData.push(finalBrandData);
      } catch (jobError) {
        logger.error(`Error processing job ${job.id}:`, jobError);
      }
    }

    const totalAdsAcrossAllBrands = brandProcessingData.reduce((sum, brand) => {
      return sum + (parseInt(brand.total_ads) || 0);
    }, 0);


    const statusBreakdown = brandProcessingData.reduce((acc, brand) => {
      const status = brand.job_status;
      if (!acc[status]) {
        acc[status] = { count: 0, totalAds: 0 };
      }
      acc[status].count++;
      acc[status].totalAds += parseInt(brand.total_ads) || 0;
      return acc;
    }, {});




    let filteredBrands = brandProcessingData;

    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      const normalizedSearchTerm = searchTerm.replace(/\s+/g, '');

      logger.info(`Searching ${queueType} brand processing queue for: "${searchTerm}"`);

      filteredBrands = brandProcessingData.filter(brand => {
        const brandName = brand.page_name?.toLowerCase() || '';
        const normalizedBrandName = brandName.replace(/\s+/g, '');

        return (
          brandName.includes(searchTerm) ||
          normalizedBrandName.includes(normalizedSearchTerm) ||
          brand.brand_id?.toString().includes(searchTerm) ||
          brand.page_id?.toString().includes(searchTerm)
        );
      });

      logger.info(`Search results: ${filteredBrands.length} brands found for "${searchTerm}"`);
    }

    if (sortBy !== "normal") {
      filteredBrands.sort((a, b) => {
        let aValue, bValue;

        switch (sortBy) {
          case "total_ads":
            aValue = parseInt(a.total_ads) || 0;
            bValue = parseInt(b.total_ads) || 0;
            break;
          case "brand_id":
            aValue = parseInt(a.brand_id) || 0;
            bValue = parseInt(b.brand_id) || 0;
            break;
          case "created_at":
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
            break;
          case "page_name":
            aValue = (a.page_name || "").toLowerCase();
            bValue = (b.page_name || "").toLowerCase();
            break;
          default:
            aValue = parseInt(a.total_ads) || 0;
            bValue = parseInt(b.total_ads) || 0;
        }

        if (sortOrder === "asc") {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });
    }

    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedBrands = filteredBrands.slice(startIndex, endIndex);

    const currentPageTotalAds = paginatedBrands.reduce((sum, brand) => {
      return sum + (parseInt(brand.total_ads) || 0);
    }, 0);

    const totalAds = await getTotalAdsCount(queueType);

    const totalDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`getBrandProcessingQueue (${queueType}) completed in ${totalDuration}ms - ${brandProcessingData.length} brands processed`);

    recordPerformanceMetrics(totalDuration, false);

    const responseData = {
      brands: paginatedBrands,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: filteredBrands.length,
        total_pages: Math.ceil(filteredBrands.length / validLimit),
      },
      queue_type: queueType,
      analytics: {
        current_page_total_ads: currentPageTotalAds,
        processing_time_ms: Math.round(totalDuration),
        pre_computed_counters: preComputedCounters,
        performance_metrics: getPerformanceMetrics(),
      },
      total_ads_regular: queueType === 'regular' ? totalAds : undefined,
      total_ads_watchlist: queueType === 'watchlist' ? totalAds : undefined,
    };

    if (!search || !search.trim()) {
      try {
        const etag = await setCachedQueueData(queueType, validPage, validLimit, responseData, sortBy, sortOrder);
        if (etag) {
          responseData.etag = etag;
          logger.info(`Cached ${queueType} queue data with ETag: ${etag}`);
        }
      } catch (cacheError) {
        logger.warn('Failed to cache queue data:', cacheError.message);
      }
    }

    return responseData;
  } catch (error) {
    const errorDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.error(`Error in getBrandProcessingQueue (${queueType}) after ${errorDuration}ms:`, error);
    throw error;
  }
}

async function getWatchlistBrandsQueue(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT,
  sortBy = 'normal',
  sortOrder = 'desc',
  ifNoneMatch = null,
  search = null,
  environment = 'production'
) {
  try {
    return await getBrandProcessingQueue(page, limit, 'watchlist', sortBy, sortOrder, ifNoneMatch, search, environment);
  } catch (error) {
    logger.error("Error in getWatchlistBrandsQueue:", error);
    throw error;
  }
}

function clearAllCaches() {
  try {
    logger.info(' Clearing all queue processing caches for environment switch...');

    regularBrandProcessingQueue = null;
    watchlistBrandProcessingQueue = null;

    jobIndex = {
      regular: { jobs: [], lastUpdated: 0, brandIds: new Set() },
      watchlist: { jobs: [], lastUpdated: 0, brandIds: new Set() }
    };

    brandCache.clear();
    brandCacheLastUpdated = 0;

    logger.info(' All queue processing caches cleared successfully');
  } catch (error) {
    logger.error(' Error clearing queue processing caches:', error);
  }
}

async function getAllBrandProcessingJobs(queueType = 'regular', ifNoneMatch = null, environment = 'production') {
  try {
    const startTime = process.hrtime.bigint();

    const cacheKey = `all_brand_processing_jobs:${queueType}:${environment}`;

    if (ifNoneMatch) {
      const cachedETag = await getQueueETag(cacheKey);
      if (cachedETag === ifNoneMatch) {
        return { status: 304, etag: cachedETag };
      }
    }

    const cachedData = await getQueueCache(cacheKey);
    if (cachedData) {
      const etag = await getQueueETag(cacheKey) || generateETag(cachedData);
      return { ...cachedData, etag, fromCache: true };
    }

    const redis = getQueueRedis(queueType, environment);
    if (!redis) {
      throw new Error(`Redis instance not available for queue type: ${queueType}`);
    }

    const [waitingJobs, activeJobs, prioritizedJobsCount, completedJobs, failedJobs, delayedJobsCount] = await Promise.all([
      redis.lrange(`bull:brand-processing:waiting`, 0, -1).catch(() => []),
      redis.lrange(`bull:brand-processing:active`, 0, -1).catch(() => []),
      redis.zcard(`bull:brand-processing:prioritized`).catch(() => 0),
      redis.zrange(`bull:brand-processing:completed`, 0, -1).catch(() => []),
      redis.zrange(`bull:brand-processing:failed`, 0, -1).catch(() => []),
      redis.zcard(`bull:brand-processing:delayed`).catch(() => 0)
    ]);

    const highestPriorityJobs = await redis.zrange(`bull:brand-processing:prioritized`, 0, 2).catch(() => []);
    logger.info(`Prioritized jobs: count=${prioritizedJobsCount}, highest priority 3 jobs=${highestPriorityJobs.join(', ')}`);

    const delayedJobsWithScores = await redis.zrevrange(`bull:brand-processing:delayed`, 0, 1, 'WITHSCORES').catch(() => []);
    const delayedJobs = [];
    const delayedTimestamps = {};

    for (let i = 0; i < delayedJobsWithScores.length; i += 2) {
      const jobId = delayedJobsWithScores[i];
      const score = delayedJobsWithScores[i + 1];

      delayedJobs.push(jobId);

      const timestamp = Number(BigInt(score) >> 12n);
      delayedTimestamps[jobId] = new Date(timestamp).toISOString();

      logger.info(`Delayed job ${jobId} scheduled for: ${delayedTimestamps[jobId]}`);
    }

    logger.info(`Delayed jobs: count=${delayedJobsCount}, latest 2 jobs=${delayedJobs.join(', ')}`);

    const getJobData = async (jobId, status) => {
      try {
        const jobData = await redis.hgetall(`bull:brand-processing:${jobId}`);

        let totalAds = 0;
        let brandId = jobId;
        let pageCategory = null;
        let createdAt = new Date().toISOString();
        let delayedUntil = null;
        let statusTimestamp = new Date().toISOString();

        if (jobData.data) {
          try {
            const parsedJob = JSON.parse(jobData.data);
            brandId = parsedJob.brandId || jobId;

            totalAds = parsedJob.totalAds?.length || 0;

            pageCategory = parsedJob.brandDetails?.page_category;
            if (!pageCategory && parsedJob.brandDetails?.page_categories) {
              pageCategory = Array.isArray(parsedJob.brandDetails.page_categories)
                ? parsedJob.brandDetails.page_categories.join(", ")
                : parsedJob.brandDetails.page_categories;
            }

            createdAt = new Date(parseInt(jobData.timestamp) || Date.now()).toISOString();

            if (status === 'active') {
              statusTimestamp = jobData.processedOn ? new Date(parseInt(jobData.processedOn)).toISOString() : createdAt;
            } else if (status === 'completed') {
              statusTimestamp = jobData.finishedOn ? new Date(parseInt(jobData.finishedOn)).toISOString() : createdAt;
            } else if (status === 'failed') {
              statusTimestamp = jobData.failedReason ? (jobData.finishedOn ? new Date(parseInt(jobData.finishedOn)).toISOString() : createdAt) : createdAt;
            } else if (status === 'waiting') {
              statusTimestamp = createdAt;
            } else if (status === 'prioritized') {
              statusTimestamp = createdAt;
            } else if (status === 'delayed') {
              statusTimestamp = createdAt;
            }
          } catch (parseError) {
            logger.warn(`Failed to parse job data for ${jobId}:`, parseError.message);
          }
        }

        if (status === 'delayed' && delayedTimestamps[jobId]) {
          delayedUntil = delayedTimestamps[jobId];
        }

        return {
          jobId,
          status,
          brandId,
          totalAds,
          pageCategory,
          createdAt,
          statusTimestamp,
          delayedUntil,
          jobData: jobData.data ? JSON.parse(jobData.data) : null
        };
      } catch (error) {
        logger.warn(`Failed to get job data for ${jobId}:`, error.message);
        return {
          jobId,
          status,
          brandId: jobId,
          totalAds: 0,
          pageCategory: null,
          createdAt: new Date().toISOString(),
          statusTimestamp: new Date().toISOString(),
          delayedUntil: null,
          jobData: null
        };
      }
    };

    const allJobPromises = [];

    waitingJobs.forEach(jobId => allJobPromises.push(getJobData(jobId, 'waiting')));
    activeJobs.forEach(jobId => allJobPromises.push(getJobData(jobId, 'active')));
    highestPriorityJobs.forEach(jobId => allJobPromises.push(getJobData(jobId, 'prioritized')));
    delayedJobs.forEach(jobId => allJobPromises.push(getJobData(jobId, 'delayed')));
    completedJobs.forEach(jobId => allJobPromises.push(getJobData(jobId, 'completed')));
    failedJobs.forEach(jobId => allJobPromises.push(getJobData(jobId, 'failed')));

    const allJobsWithData = await Promise.all(allJobPromises);

    const brandIds = [...new Set(allJobsWithData.map(job => parseInt(job.brandId || job.jobId)))];

    const missingBrandIds = brandIds.filter(id => !brandCache.has(id));
    logger.info(`Brand cache check: ${brandIds.length} total brand IDs, ${missingBrandIds.length} missing`);
    logger.info(`Brand IDs requested: ${brandIds.join(', ')}`);
    logger.info(`Missing brand IDs: ${missingBrandIds.join(', ')}`);

    if (missingBrandIds.length > 0) {
      logger.info(`Force refreshing brand cache for ${missingBrandIds.length} missing brands: ${missingBrandIds.join(', ')}`);
      const { getModels } = require("../models");
      const { Brand, Ad } = getModels(environment);
      const missingBrands = await Brand.findAll({
        where: { id: { [Op.in]: missingBrandIds } },
        attributes: ["id", "actual_name", "page_id", "category", "actual_ads_count"],
        raw: true,
      });


      logger.info(`Found ${missingBrands.length} brands in database for IDs: ${missingBrandIds.join(', ')}`);
      missingBrands.forEach(brand => {
        logger.info(`Caching brand: ID=${brand.id}, Name=${brand.actual_name}, PageID=${brand.page_id}`);
      });

      missingBrands.forEach(brand => {
        brandCache.set(brand.id, brand);
      });
      brandCacheLastUpdated = Date.now();

      logger.info(`Added ${missingBrands.length} brands to cache`);
    }

    const brandMap = new Map();

    brandIds.forEach(brandId => {
      if (brandCache.has(brandId)) {
        brandMap.set(brandId.toString(), brandCache.get(brandId));
      }
    });

    if (missingBrandIds.length > 0) {
      const { getModels } = require("../models");
      const { Brand } = getModels(environment);
      const newlyFetchedBrands = await Brand.findAll({
        where: { id: { [Op.in]: missingBrandIds } },
        attributes: ["id", "actual_name", "page_id", "category", "actual_ads_count"],
        raw: true,
      });

      newlyFetchedBrands.forEach(brand => {
        brandMap.set(brand.id.toString(), brand);
        brandCache.set(brand.id, brand);
      });
    }

    logger.info(`Brand map size: ${brandMap.size}, Brand IDs requested: ${brandIds.join(', ')}`);
    logger.info(`Brand map keys: ${Array.from(brandMap.keys()).join(', ')}`);

    const brands = allJobsWithData.map(job => {
      const brand = brandMap.get(job.brandId.toString());
      logger.info(`Building result for job ${job.jobId} (brandId: ${job.brandId}): brand=${brand ? `${brand.actual_name} (${brand.page_id})` : 'NOT FOUND'}`);

      let pageCategory = job.pageCategory;
      if (!pageCategory && brand?.category) {
        pageCategory = brand.category;
      }

      return {
        brand_id: parseInt(job.brandId || job.jobId),
        page_id: brand?.page_id || "Unknown",
        page_name: brand?.actual_name || "Unknown",
        total_ads: job.totalAds || 0,
        actual_ads_count: brand?.actual_ads_count || null,
        page_category: pageCategory || "Unknown",
        created_at: job.createdAt,
        status_timestamp: job.statusTimestamp,
        delayed_until: job.delayedUntil,
        is_watchlist: queueType === 'watchlist',
        queue_type: queueType,
        job_status: job.status,
        job_id: job.jobId
      };
    });

    const counters = await getPreComputedQueueCounters(redis, queueType);

    const updatedCounters = {
      ...counters,
      prioritized: prioritizedJobsCount,
      delayed: delayedJobsCount,
      total: waitingJobs.length + activeJobs.length + prioritizedJobsCount + delayedJobsCount + completedJobs.length + failedJobs.length
    };

    const totalAdsAcrossAllBrands = brands.reduce((sum, brand) => {
      return sum + (parseInt(brand.total_ads) || 0);
    }, 0);

    const result = {
      brands,
      pagination: {
        current_page: 1,
        per_page: brands.length,
        total_items: brands.length,
        total_pages: 1
      },
      queue_type: queueType,
      analytics: {
        current_page_total_ads: totalAdsAcrossAllBrands,
        processing_time_ms: Math.round(Number(process.hrtime.bigint() - startTime) / 1000000),
        pre_computed_counters: updatedCounters,
        performance_metrics: getPerformanceMetrics()
      },
      total_ads_regular: queueType === 'regular' ? totalAdsAcrossAllBrands : undefined,
      total_ads_watchlist: queueType === 'watchlist' ? totalAdsAcrossAllBrands : undefined
    };

    const etag = generateETag(result);
    await setQueueCache(cacheKey, result, QUEUE_CACHE_TTL);
    await setQueueETag(cacheKey, etag, QUEUE_CACHE_TTL);

    return { ...result, etag, fromCache: false };
  } catch (error) {
    logger.error(`Error in getAllBrandProcessingJobs for ${queueType}:`, error);
    throw error;
  }
}

const serviceExports = {
  initializeBullMQQueues,
  getBullMQJobStates,
  getBrandProcessingQueue,
  getWatchlistBrandsQueue,
  getAllBrandProcessingJobs,
  startBackgroundRefresh,
  stopBackgroundRefresh,
  initializeCaches,
  updateQueueCounters,
  getPerformanceMetrics,
  resetPerformanceMetrics,
  clearAllCaches,
  refreshJobIndex,
  clearInMemoryCaches,
};

global.queueProcessingService = serviceExports;

module.exports = serviceExports;
