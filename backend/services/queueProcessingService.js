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

// Pipeline-style caching for queue APIs (same as pipeline status page)
const QUEUE_CACHE_TTL = 30; // 30 seconds for faster updates

// Pre-computed job index for ultra-fast pagination
let jobIndex = {
  regular: { jobs: [], lastUpdated: 0, brandIds: new Set() },
  watchlist: { jobs: [], lastUpdated: 0, brandIds: new Set() }
};

// Pre-computed brand cache for ultra-fast database lookups
let brandCache = new Map(); // brandId -> brandData
let brandCacheLastUpdated = 0;

// Cache refresh intervals - optimized for speed
const JOB_INDEX_REFRESH_INTERVAL = 30000; // 30 seconds for faster updates
const BRAND_CACHE_REFRESH_INTERVAL = 60000; // 1 minute for brand data

// Get cached queue data with ETag support (pipeline-style)
async function getCachedQueueData(queueType, page, limit, sortBy, sortOrder, ifNoneMatch) {
  try {
    // Check cache first
    const cachedData = await getQueueCache(queueType, page, limit, sortBy, sortOrder);
    const cachedETag = await getQueueETag(queueType, page, limit, sortBy, sortOrder);
    
    if (!cachedData || !cachedETag) {
      return null;
    }
    
    // Check if client has matching ETag (HTTP 304 Not Modified)
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

// Set cached queue data with ETag (pipeline-style)
async function setCachedQueueData(queueType, page, limit, data, sortBy, sortOrder) {
  try {
    const etag = generateETag(data);
    
    // Set both cache and ETag
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

// Pre-computed queue counters for O(1) access
async function getPreComputedQueueCounters(redis, queueType) {
  const counterKey = `queue:${queueType}:counters`;
  
  try {
    // First try to get pre-computed counters
    const counters = await redis.hgetall(counterKey);
    
    // If counters exist, return them
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
    
    // Fallback: Read directly from BullMQ queue data structures
    const [waitingJobs, activeJobs, prioritizedCount, completedCount, failedCount, delayedCount] = await Promise.all([
      redis.lrange(`bull:brand-processing:waiting`, 0, -1).catch(() => []),
      redis.lrange(`bull:brand-processing:active`, 0, -1).catch(() => []),
      // Prioritized, completed, failed, and delayed are stored as sorted sets
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
    
    // Cache the real counters for future use
    try {
      await redis.hset(counterKey, realCounters);
      await redis.expire(counterKey, 10); // Cache for 10 seconds
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

// Update queue counters when job state changes (called by background jobs)
async function updateQueueCounters(redis, queueType, stateChange) {
  const counterKey = `queue:${queueType}:counters`;
  
  try {
    const pipeline = redis.pipeline();
    
    // Decrement old state, increment new state
    if (stateChange.fromState) {
      pipeline.hincrby(counterKey, stateChange.fromState, -1);
    }
    if (stateChange.toState) {
      pipeline.hincrby(counterKey, stateChange.toState, 1);
    }
    
    // Update total if needed
    if (stateChange.isNewJob) {
      pipeline.hincrby(counterKey, 'total', 1);
    }
    
    await pipeline.exec();
    logger.info(`Updated ${queueType} queue counters: ${stateChange.fromState} -> ${stateChange.toState}`);
  } catch (error) {
    logger.error(`Error updating queue counters for ${queueType}:`, error);
  }
}

// Ultra-fast brand fetching using pre-computed cache
async function getBrandsFromCache(brandIds) {
  const startTime = process.hrtime.bigint();
  
  try {
    const now = Date.now();
    
    // Check if brand cache needs refresh
    if (brandCache.size === 0 || (now - brandCacheLastUpdated) > BRAND_CACHE_REFRESH_INTERVAL) {
      logger.info('Refreshing brand cache...');
      await refreshBrandCache();
    }
    
    // Get brands from cache (O(1) lookups)
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
    
    // If we have missing brands, fetch them from DB and update cache
    if (missingBrandIds.length > 0) {
      logger.info(`Fetching ${missingBrandIds.length} missing brands from DB`);
      // Require Brand model dynamically to get the latest version
      const { Brand } = require("../models");
      const missingBrands = await Brand.findAll({
        where: { id: { [Op.in]: missingBrandIds } },
        attributes: ["id", "actual_name", "page_id", "category"],
        raw: true,
      });
      
      // Update cache and map
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

// Refresh brand cache with all active brands
async function refreshBrandCache() {
  const startTime = process.hrtime.bigint();
  
  try {
    // Require Brand model dynamically to get the latest version
    const { Brand } = require("../models");
    
    // Get all unique brand IDs from job indices
    const allBrandIds = new Set();
    Object.values(jobIndex).forEach(index => {
      index.brandIds.forEach(brandId => allBrandIds.add(brandId));
    });
    
    if (allBrandIds.size === 0) {
      logger.info('No brand IDs to cache');
      return;
    }
    
    // Fetch all brands in one query
    const brands = await Brand.findAll({
      where: { id: { [Op.in]: Array.from(allBrandIds) } },
      attributes: ["id", "actual_name", "page_id", "category"],
      raw: true,
    });
    
    // Update cache
    brandCache.clear();
    brands.forEach(brand => brandCache.set(brand.id, brand));
    brandCacheLastUpdated = Date.now();
    
    const refreshDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`Brand cache refreshed in ${refreshDuration}ms: ${brands.length} brands cached`);
    
  } catch (error) {
    logger.error('Error refreshing brand cache:', error);
  }
}

// Utility function to chunk arrays
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Background cache warming for hot data (pipeline-style)
let backgroundRefreshInterval = null;
const HOT_DATA_REFRESH_INTERVAL = 300000; // 5 minutes (increased for better performance)
const HOT_PATTERNS = [
  { queueType: 'regular', page: 1, limit: 10, sortBy: 'normal', sortOrder: 'desc' },
  { queueType: 'regular', page: 1, limit: 20, sortBy: 'normal', sortOrder: 'desc' },
  { queueType: 'watchlist', page: 1, limit: 10, sortBy: 'normal', sortOrder: 'desc' },
  { queueType: 'watchlist', page: 1, limit: 20, sortBy: 'normal', sortOrder: 'desc' }
];

// Clear all in-memory caches
function clearInMemoryCaches() {
  try {
    // Clear job index
    jobIndex = {
      regular: { jobs: [], lastUpdated: 0, brandIds: new Set() },
      watchlist: { jobs: [], lastUpdated: 0, brandIds: new Set() }
    };
    
    // Clear brand cache
    brandCache.clear();
    brandCacheLastUpdated = 0;
    
    console.log('QueueProcessingService in-memory caches cleared');
  } catch (error) {
    console.error('Error clearing QueueProcessingService caches:', error);
  }
}

// Start background refresh for hot data
function startBackgroundRefresh() {
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval);
  }
  
  backgroundRefreshInterval = setInterval(async () => {
    try {
      logger.info('Starting background cache warming for hot queue data...');
      
      // Warm job indices first
      const redisRegular = getQueueRedis('regular');
      const redisWatchlist = getQueueRedis('watchlist');
      
      if (redisRegular) await refreshJobIndex(redisRegular, 'regular');
      if (redisWatchlist) await refreshJobIndex(redisWatchlist, 'watchlist');
      
      // Warm brand cache
      await refreshBrandCache();
      
      const refreshPromises = HOT_PATTERNS.map(async (pattern) => {
        try {
          // Refresh cache for hot patterns (pipeline-style)
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
  
  logger.info(`Background refresh started (every ${HOT_DATA_REFRESH_INTERVAL/1000}s)`);
}

// Initialize caches on startup for instant first request
async function initializeCaches() {
  try {
    logger.info('Initializing caches for ultra-fast queue APIs...');
    
    const redisRegular = getQueueRedis('regular');
    const redisWatchlist = getQueueRedis('watchlist');
    
    // Initialize job indices
    if (redisRegular) await refreshJobIndex(redisRegular, 'regular');
    if (redisWatchlist) await refreshJobIndex(redisWatchlist, 'watchlist');
    
    // Initialize brand cache
    await refreshBrandCache();
    
    logger.info('Cache initialization completed - queue APIs ready for sub-second responses!');
  } catch (error) {
    logger.error('Error initializing caches:', error);
  }
}

// Stop background refresh
function stopBackgroundRefresh() {
  if (backgroundRefreshInterval) {
    clearInterval(backgroundRefreshInterval);
    backgroundRefreshInterval = null;
    logger.info('Background refresh stopped');
  }
}

// Performance monitoring and metrics
const performanceMetrics = {
  requestCount: 0,
  totalResponseTime: 0,
  cacheHits: 0,
  cacheMisses: 0,
  averageResponseTime: 0,
  lastReset: Date.now()
};

// Performance monitoring hooks
function recordPerformanceMetrics(responseTime, fromCache = false) {
  performanceMetrics.requestCount++;
  performanceMetrics.totalResponseTime += responseTime;
  performanceMetrics.averageResponseTime = performanceMetrics.totalResponseTime / performanceMetrics.requestCount;
  
  if (fromCache) {
    performanceMetrics.cacheHits++;
  } else {
    performanceMetrics.cacheMisses++;
  }
  
  // Log performance metrics every 100 requests
  if (performanceMetrics.requestCount % 100 === 0) {
    logger.info('Performance Metrics:', {
      requests: performanceMetrics.requestCount,
      avgResponseTime: Math.round(performanceMetrics.averageResponseTime) + 'ms',
      cacheHitRate: Math.round((performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses)) * 100) + '%',
      uptime: Math.round((Date.now() - performanceMetrics.lastReset) / 1000) + 's'
    });
  }
}

// Get performance metrics
function getPerformanceMetrics() {
  return {
    ...performanceMetrics,
    cacheHitRate: performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses) * 100,
    uptime: Date.now() - performanceMetrics.lastReset
  };
}

// Reset performance metrics
function resetPerformanceMetrics() {
  performanceMetrics.requestCount = 0;
  performanceMetrics.totalResponseTime = 0;
  performanceMetrics.cacheHits = 0;
  performanceMetrics.cacheMisses = 0;
  performanceMetrics.averageResponseTime = 0;
  performanceMetrics.lastReset = Date.now();
  logger.info('Performance metrics reset');
}

// Initialize background refresh on module load - optimized for speed
if (process.env.NODE_ENV === 'production') {
  // Initialize caches immediately for ultra-fast first request
  setTimeout(() => {
    initializeCaches();
  }, 1000); // Reduced from 2000ms to 1000ms
  
  // Start background refresh after cache initialization
  setTimeout(() => {
    startBackgroundRefresh();
  }, 3000); // Reduced from 5000ms to 3000ms
} else {
  // In development, initialize caches immediately for testing
  setTimeout(() => {
    initializeCaches();
  }, 500);
  
  setTimeout(() => {
    startBackgroundRefresh();
  }, 1000);
}

// Pre-compute job index for ultra-fast pagination - optimized
async function refreshJobIndex(redis, queueType) {
  const startTime = process.hrtime.bigint();
  
  try {
    // Get job states from BullMQ queue lists (with error handling)
    const jobStates = new Map();
    
    try {
      const [waitingJobs, activeJobs, prioritizedJobs, completedJobs, failedJobs, delayedJobs] = await Promise.all([
        redis.lrange(`bull:brand-processing:waiting`, 0, -1).catch(() => []),
        redis.lrange(`bull:brand-processing:active`, 0, -1).catch(() => []),
        // Prioritized, completed, failed, and delayed are stored as sorted sets
        redis.zrange(`bull:brand-processing:prioritized`, 0, -1).catch(() => []),
        redis.zrange(`bull:brand-processing:completed`, 0, -1).catch(() => []),
        redis.zrange(`bull:brand-processing:failed`, 0, -1).catch(() => []),
        redis.zrange(`bull:brand-processing:delayed`, 0, -1).catch(() => [])
      ]);
      
      // Create job state maps for O(1) lookup with priority order
      // Priority: active > waiting > prioritized > completed > failed > delayed
      delayedJobs.forEach(jobId => jobStates.set(jobId, 'delayed'));
      failedJobs.forEach(jobId => jobStates.set(jobId, 'failed'));
      completedJobs.forEach(jobId => jobStates.set(jobId, 'completed'));
      prioritizedJobs.forEach(jobId => jobStates.set(jobId, 'prioritized'));
      waitingJobs.forEach(jobId => jobStates.set(jobId, 'waiting'));
      activeJobs.forEach(jobId => jobStates.set(jobId, 'active')); // Highest priority - overwrites others
      
      logger.info(`Job states loaded: waiting=${waitingJobs.length}, active=${activeJobs.length}, prioritized=${prioritizedJobs.length}, completed=${completedJobs.length}, failed=${failedJobs.length}, delayed=${delayedJobs.length}`);
    } catch (error) {
      logger.warn(`Error loading job states, continuing without state info: ${error.message}`);
    }
    
    // OPTIMIZATION: Use SCAN instead of KEYS for better performance
    const pattern = "bull:brand-processing:*";
    let cursor = '0';
    const allKeys = [];
    
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      allKeys.push(...result[1]);
    } while (cursor !== '0');
    
    // Filter job keys
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
    
    // OPTIMIZATION: Process in chunks to avoid memory issues
    const chunkSize = 50;
    const jobs = [];
    const brandIds = new Set();
    
    for (let i = 0; i < filteredKeys.length; i += chunkSize) {
      const chunk = filteredKeys.slice(i, i + chunkSize);
      
      // Batch fetch chunk data
      const pipeline = redis.pipeline();
      chunk.forEach(key => pipeline.hgetall(key));
      const results = await pipeline.exec();
      
      results.forEach(([err, jobData], index) => {
        if (err) return;
        
        const jobId = chunk[index].split(":").pop();
        
        // Get actual job state from BullMQ queue lists
        const actualState = jobStates.get(jobId) || 'unknown';
        
        // Handle empty job data (jobs that exist but have no data)
        if (!jobData || Object.keys(jobData).length === 0) {
          jobs.push({
            id: jobId,
            data: { brandId: null, totalAds: [] }, // Default empty data
            timestamp: Date.now(),
            state: actualState
          });
          return;
        }
        
        // Handle jobs with data
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
            // Job exists but has no brandId
            jobs.push({
              id: jobId,
              data: { brandId: null, totalAds: [] },
              timestamp: parseInt(jobData.timestamp) || Date.now(),
              state: actualState
            });
          }
        } catch (parseError) {
          // Job exists but has invalid data
          jobs.push({
            id: jobId,
            data: { brandId: null, totalAds: [] },
            timestamp: Date.now(),
            state: actualState
          });
        }
      });
    }
    
    // Update job index
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

// Ultra-fast job fetching using pre-computed index
async function getJobsOptimized(redis, queueType, pattern = "bull:brand-processing:*") {
  const now = Date.now();
  const indexData = jobIndex[queueType];
  
  // Check if index needs refresh (30 seconds or empty)
  if (!indexData || indexData.jobs.length === 0 || (now - indexData.lastUpdated) > JOB_INDEX_REFRESH_INTERVAL) {
    logger.info(`Refreshing job index for ${queueType} (stale or empty)`);
    await refreshJobIndex(redis, queueType);
  }
  
  // Return job IDs from index (ultra-fast)
  return jobIndex[queueType].jobs.map(job => `bull:brand-processing:${job.id}`);
}

// Ultra-fast job data fetching using pre-computed index
async function getJobDataBatch(redis, jobKeys, queueType) {
  if (jobKeys.length === 0) return [];
  
  const startTime = process.hrtime.bigint();
  
  try {
    // OPTIMIZATION: Use pre-computed index instead of Redis pipeline
    const indexData = jobIndex[queueType];
    
    if (!indexData || indexData.jobs.length === 0) {
      logger.warn(`No job data in index for ${queueType}`);
      return [];
    }
    
    // Create a map for O(1) lookups
    const jobMap = new Map(indexData.jobs.map(job => [job.id, job]));
    
    // Extract job IDs from keys and lookup from index
    const jobs = jobKeys
      .map(key => {
        const jobId = key.split(":").pop();
        return jobMap.get(jobId);
      })
      .filter(Boolean); // Remove undefined entries
    
    const indexDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`Index lookup completed in ${indexDuration}ms, processed ${jobs.length} jobs`);
    
    return jobs;
  } catch (error) {
    logger.error('Error in getJobDataBatch:', error);
    return [];
  }
}

// Get total ads count for regular or watchlist brands (ultra-optimized)
async function getTotalAdsCount(queueType) {
  try {
    const redis = getQueueRedis(queueType);
    
    // OPTIMIZATION: Use pre-computed index instead of Redis operations
    const indexData = jobIndex[queueType];
    
    if (!indexData || indexData.jobs.length === 0) {
      return 0;
    }
    
    // Calculate total ads from pre-computed index (ultra-fast)
    let totalAds = 0;
    indexData.jobs.forEach(job => {
      try {
        if (job.data && job.data.totalAds && Array.isArray(job.data.totalAds)) {
          totalAds += job.data.totalAds.length;
        }
      } catch (error) {
        // Skip invalid jobs
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

    // Ensure queue and redis are available
    if (!queue) {
      logger.error(`Queue not initialized for ${queueType}`);
      throw new Error(`Queue not initialized for ${queueType}`);
    }
    
    if (!redis) {
      logger.error(`Redis not available for ${queueType}`);
      throw new Error(`Redis not available for ${queueType}`);
    }

    // CACHE CHECK: Skip cache if searching (search results shouldn't be cached)
    if (!search || !search.trim()) {
      const cachedResult = await getCachedQueueData(queueType, validPage, validLimit, sortBy, sortOrder, ifNoneMatch);
      if (cachedResult) {
        const cacheDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
        logger.info(`Cache HIT for ${queueType} queue in ${cacheDuration}ms`);
        
        // Record performance metrics
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

    // OPTIMIZATION: Use pre-computed counters for O(1) access
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

    // ULTRA-OPTIMIZED: Use pre-computed index directly (no Redis calls)
    let allJobs = [];
    
    try {
      // Get jobs directly from pre-computed index (ultra-fast)
      const indexData = jobIndex[queueType];
      
      if (indexData && indexData.jobs.length > 0) {
        allJobs = indexData.jobs;
        logger.info(`Ultra-fast job fetching from index: ${allJobs.length} jobs`);
      } else {
        // Fallback: refresh index if empty
        logger.info(`Index empty, refreshing for ${queueType}...`);
        await refreshJobIndex(redis, queueType);
        allJobs = jobIndex[queueType]?.jobs || [];
        logger.info(`Job index refreshed: ${allJobs.length} jobs`);
      }
    } catch (error) {
      logger.error(`Error in ultra-fast job fetching:`, error);
      allJobs = [];
    }

    // Remove duplicates based on job ID (simplified like pipeline status page)
    const uniqueJobs = allJobs
      .filter((job, index, self) => index === self.findIndex((j) => j.id === job.id));

    logger.info(`Found ${uniqueJobs.length} total jobs for ${queueType} queue`);

    // If no valid jobs found, return empty response
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

    // ULTRA-FAST: Extract brand IDs from jobs (already validated in index)
    const brandIds = [...new Set(uniqueJobs.map(job => job.data.brandId))];
    
    // ULTRA-FAST: Get brands from pre-computed cache (O(1) lookups)
    const brandMap = await getBrandsFromCache(brandIds);

    const brandProcessingData = [];

    for (const job of uniqueJobs) {
      try {
        // Safe access to job data with comprehensive null checks
        const jobData = job.data || {};
        const brandId = jobData.brandId;
        
        // Skip jobs without brandId
        if (!brandId) {
          logger.warn(`Skipping job ${job.id} - no brandId found`);
          continue;
        }
        
        // Handle both page_category (string) and page_categories (array)
        let pageCategory = jobData.brandDetails?.page_category;

        if (!pageCategory && jobData.brandDetails?.page_categories) {
          // If page_categories is an array, join them with comma
          pageCategory = Array.isArray(jobData.brandDetails.page_categories)
            ? jobData.brandDetails.page_categories.join(", ")
            : jobData.brandDetails.page_categories;
        }
        const totalAds = jobData.totalAds?.length || 0;

        // O(1) lookup from hash map instead of individual DB query
        const brand = brandMap.get(brandId);

        // If no page category from job data, try to use database category as fallback
        if (!pageCategory && brand?.category) {
          pageCategory = brand.category;
        }

        const finalBrandData = {
          brand_id: brandId,
          page_id: brand?.page_id || "Unknown",
          page_name: brand?.actual_name || "Unknown",
          total_ads: totalAds,
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
        // Continue processing other jobs even if one fails
      }
    }

    // Calculate total ads across all brands
    const totalAdsAcrossAllBrands = brandProcessingData.reduce((sum, brand) => {
      return sum + (parseInt(brand.total_ads) || 0);
    }, 0);

    // Removed console logging

    // Show breakdown by job status
    const statusBreakdown = brandProcessingData.reduce((acc, brand) => {
      const status = brand.job_status;
      if (!acc[status]) {
        acc[status] = { count: 0, totalAds: 0 };
      }
      acc[status].count++;
      acc[status].totalAds += parseInt(brand.total_ads) || 0;
      return acc;
    }, {});


    // Removed top brands console logging


    // SEARCH FILTERING: Apply search if provided (same pattern as queueReadService)
    let filteredBrands = brandProcessingData;
    
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      const normalizedSearchTerm = searchTerm.replace(/\s+/g, '');
      
      logger.info(`Searching ${queueType} brand processing queue for: "${searchTerm}"`);
      
      filteredBrands = brandProcessingData.filter(brand => {
        const brandName = brand.page_name?.toLowerCase() || '';
        const normalizedBrandName = brandName.replace(/\s+/g, '');
        
        return (
          // Original search (with spaces)
          brandName.includes(searchTerm) ||
          // Space-insensitive search
          normalizedBrandName.includes(normalizedSearchTerm) ||
          // ID searches
          brand.brand_id?.toString().includes(searchTerm) ||
          brand.page_id?.toString().includes(searchTerm)
        );
      });
      
      logger.info(`Search results: ${filteredBrands.length} brands found for "${searchTerm}"`);
    }

    // Sort by the specified field and order
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
    // If sortBy is 'normal', keep original order (no sorting)

    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedBrands = filteredBrands.slice(startIndex, endIndex);

    // Calculate total ads for current page
    const currentPageTotalAds = paginatedBrands.reduce((sum, brand) => {
      return sum + (parseInt(brand.total_ads) || 0);
    }, 0);

    // Get total ads count for the queue type (ultra-fast from index)
    const totalAds = await getTotalAdsCount(queueType);

    const totalDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`getBrandProcessingQueue (${queueType}) completed in ${totalDuration}ms - ${brandProcessingData.length} brands processed`);

    // Record performance metrics for cache miss
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

    // CACHE STORAGE: Only cache if not searching (pipeline-style)
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
    // Use the new getBrandProcessingQueue function with watchlist queue type
    return await getBrandProcessingQueue(page, limit, 'watchlist', sortBy, sortOrder, ifNoneMatch, search, environment);
  } catch (error) {
    logger.error("Error in getWatchlistBrandsQueue:", error);
    throw error;
  }
}

// Function to clear all caches when environment changes
function clearAllCaches() {
  try {
    logger.info('🧹 Clearing all queue processing caches for environment switch...');
    
    // Clear cached queue instances
    regularBrandProcessingQueue = null;
    watchlistBrandProcessingQueue = null;
    
    // Clear job indices
    jobIndex = {
      regular: { jobs: [], lastUpdated: 0, brandIds: new Set() },
      watchlist: { jobs: [], lastUpdated: 0, brandIds: new Set() }
    };
    
    // Clear brand cache
    brandCache.clear();
    brandCacheLastUpdated = 0;
    
    logger.info('✅ All queue processing caches cleared successfully');
  } catch (error) {
    logger.error('❌ Error clearing queue processing caches:', error);
  }
}

// Get ALL brand processing jobs without pagination (for dashboard cards)
async function getAllBrandProcessingJobs(queueType = 'regular', ifNoneMatch = null, environment = 'production') {
  try {
    const startTime = process.hrtime.bigint();
    
    // Generate cache key for all jobs
    const cacheKey = `all_brand_processing_jobs:${queueType}:${environment}`;
    
    // Check cache first
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
    
    // Get Redis instance
    const redis = getQueueRedis(queueType, environment);
    if (!redis) {
      throw new Error(`Redis instance not available for queue type: ${queueType}`);
    }
    
    // Get all job IDs from all BullMQ data structures
    const [waitingJobs, activeJobs, prioritizedJobsCount, completedJobs, failedJobs, delayedJobsCount] = await Promise.all([
      redis.lrange(`bull:brand-processing:waiting`, 0, -1).catch(() => []),
      redis.lrange(`bull:brand-processing:active`, 0, -1).catch(() => []),
      // Get prioritized jobs count (for counter)
      redis.zcard(`bull:brand-processing:prioritized`).catch(() => 0),
      redis.zrange(`bull:brand-processing:completed`, 0, -1).catch(() => []),
      redis.zrange(`bull:brand-processing:failed`, 0, -1).catch(() => []),
      // Get delayed jobs count from sorted set (BullMQ stores delayed jobs in a sorted set by timestamp)
      redis.zcard(`bull:brand-processing:delayed`).catch(() => 0)
    ]);
    
    // Get highest priority jobs (lowest scores = highest priority) - only top 2-3 like delayed
    const highestPriorityJobs = await redis.zrange(`bull:brand-processing:prioritized`, 0, 2).catch(() => []);
    logger.info(`Prioritized jobs: count=${prioritizedJobsCount}, highest priority 3 jobs=${highestPriorityJobs.join(', ')}`);
    
    // Get latest 2 delayed jobs (highest scores = most recent timestamps) for detailed data
    const delayedJobsWithScores = await redis.zrevrange(`bull:brand-processing:delayed`, 0, 1, 'WITHSCORES').catch(() => []);
    const delayedJobs = [];
    const delayedTimestamps = {};
    
    // Process delayed jobs with their scores (timestamps)
    for (let i = 0; i < delayedJobsWithScores.length; i += 2) {
      const jobId = delayedJobsWithScores[i];
      const score = delayedJobsWithScores[i + 1];
      
      delayedJobs.push(jobId);
      
      // Convert BullMQ score to actual timestamp
      const timestamp = Number(BigInt(score) >> 12n);
      delayedTimestamps[jobId] = new Date(timestamp).toISOString();
      
      logger.info(`Delayed job ${jobId} scheduled for: ${delayedTimestamps[jobId]}`);
    }
    
    logger.info(`Delayed jobs: count=${delayedJobsCount}, latest 2 jobs=${delayedJobs.join(', ')}`);
    
    // Helper function to get job data from Redis (using same logic as existing API)
    const getJobData = async (jobId, status) => {
      try {
        // Use the same approach as the existing getBrandProcessingQueue function
        const jobData = await redis.hgetall(`bull:brand-processing:${jobId}`);
        
        // Parse job data the same way as the existing API
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
            
            // Get totalAds from the job data (same as existing API)
            totalAds = parsedJob.totalAds?.length || 0;
            
            // Get page category
            pageCategory = parsedJob.brandDetails?.page_category;
            if (!pageCategory && parsedJob.brandDetails?.page_categories) {
              pageCategory = Array.isArray(parsedJob.brandDetails.page_categories)
                ? parsedJob.brandDetails.page_categories.join(", ")
                : parsedJob.brandDetails.page_categories;
            }
            
            createdAt = new Date(parseInt(jobData.timestamp) || Date.now()).toISOString();
            
            // Set appropriate timestamp based on job status
            if (status === 'active') {
              // For active jobs, show when they started processing
              statusTimestamp = jobData.processedOn ? new Date(parseInt(jobData.processedOn)).toISOString() : createdAt;
            } else if (status === 'completed') {
              // For completed jobs, show when they finished
              statusTimestamp = jobData.finishedOn ? new Date(parseInt(jobData.finishedOn)).toISOString() : createdAt;
            } else if (status === 'failed') {
              // For failed jobs, show when they failed
              statusTimestamp = jobData.failedReason ? (jobData.finishedOn ? new Date(parseInt(jobData.finishedOn)).toISOString() : createdAt) : createdAt;
            } else if (status === 'waiting') {
              // For waiting jobs, show when they were created
              statusTimestamp = createdAt;
            } else if (status === 'prioritized') {
              // For prioritized jobs, show when they were created
              statusTimestamp = createdAt;
            } else if (status === 'delayed') {
              // For delayed jobs, show when they were created
              statusTimestamp = createdAt;
            }
          } catch (parseError) {
            logger.warn(`Failed to parse job data for ${jobId}:`, parseError.message);
          }
        }
        
        // If this is a delayed job, get the delayed timestamp
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
    
    // Get job data for all jobs from lists
    const allJobPromises = [];
    
    waitingJobs.forEach(jobId => allJobPromises.push(getJobData(jobId, 'waiting')));
    activeJobs.forEach(jobId => allJobPromises.push(getJobData(jobId, 'active')));
    highestPriorityJobs.forEach(jobId => allJobPromises.push(getJobData(jobId, 'prioritized'))); // Only highest priority jobs
    // Only process first 2 delayed jobs for detailed data
    delayedJobs.forEach(jobId => allJobPromises.push(getJobData(jobId, 'delayed')));
    completedJobs.forEach(jobId => allJobPromises.push(getJobData(jobId, 'completed')));
    failedJobs.forEach(jobId => allJobPromises.push(getJobData(jobId, 'failed')));
    
    const allJobsWithData = await Promise.all(allJobPromises);
    
    // Get brand details for all jobs (convert job IDs to integers)
    const brandIds = [...new Set(allJobsWithData.map(job => parseInt(job.brandId || job.jobId)))];
    
    // Force refresh brand cache for these specific brand IDs if they're missing
    const missingBrandIds = brandIds.filter(id => !brandCache.has(id));
    logger.info(`Brand cache check: ${brandIds.length} total brand IDs, ${missingBrandIds.length} missing`);
    logger.info(`Brand IDs requested: ${brandIds.join(', ')}`);
    logger.info(`Missing brand IDs: ${missingBrandIds.join(', ')}`);
    
    if (missingBrandIds.length > 0) {
      logger.info(`Force refreshing brand cache for ${missingBrandIds.length} missing brands: ${missingBrandIds.join(', ')}`);
      // Get Brand model for the specified environment
      const { getModels } = require("../models");
      const { Brand, Ad } = getModels(environment);
      const missingBrands = await Brand.findAll({
        where: { id: { [Op.in]: missingBrandIds } },
        attributes: ["id", "actual_name", "page_id", "category"],
        raw: true,
      });
      
      // Note: ads_count will be fetched from Redis job data, not from database
      
      logger.info(`Found ${missingBrands.length} brands in database for IDs: ${missingBrandIds.join(', ')}`);
      missingBrands.forEach(brand => {
        logger.info(`Caching brand: ID=${brand.id}, Name=${brand.actual_name}, PageID=${brand.page_id}`);
      });
      
      // Update cache
      missingBrands.forEach(brand => {
        brandCache.set(brand.id, brand);
      });
      brandCacheLastUpdated = Date.now();
      
      logger.info(`Added ${missingBrands.length} brands to cache`);
    }
    
    // Build brand map directly from the brands we fetched
    const brandMap = new Map();
    
    // Add brands that were already in cache
    brandIds.forEach(brandId => {
      if (brandCache.has(brandId)) {
        brandMap.set(brandId.toString(), brandCache.get(brandId));
      }
    });
    
    // Also add newly fetched brands to the map
    if (missingBrandIds.length > 0) {
      const { getModels } = require("../models");
      const { Brand } = getModels(environment);
      const newlyFetchedBrands = await Brand.findAll({
        where: { id: { [Op.in]: missingBrandIds } },
        attributes: ["id", "actual_name", "page_id", "category"],
        raw: true,
      });
      
      newlyFetchedBrands.forEach(brand => {
        brandMap.set(brand.id.toString(), brand);
        brandCache.set(brand.id, brand); // Update cache
      });
    }
    
    logger.info(`Brand map size: ${brandMap.size}, Brand IDs requested: ${brandIds.join(', ')}`);
    logger.info(`Brand map keys: ${Array.from(brandMap.keys()).join(', ')}`);
    
    // Build result with brand details (using same format as existing API)
    const brands = allJobsWithData.map(job => {
      // Use brandId for lookup, not jobId
      const brand = brandMap.get(job.brandId.toString());
      logger.info(`Building result for job ${job.jobId} (brandId: ${job.brandId}): brand=${brand ? `${brand.actual_name} (${brand.page_id})` : 'NOT FOUND'}`);
      
      // Use page category from job data if available, otherwise from database
      let pageCategory = job.pageCategory;
      if (!pageCategory && brand?.category) {
        pageCategory = brand.category;
      }
      
      return {
        brand_id: parseInt(job.brandId || job.jobId),
        page_id: brand?.page_id || "Unknown",
        page_name: brand?.actual_name || "Unknown",
        total_ads: job.totalAds || 0,
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
    
    // Get pre-computed counters and update with correct delayed count
    const counters = await getPreComputedQueueCounters(redis, queueType);
    
    // Update counters with correct prioritized and delayed count
    const updatedCounters = {
      ...counters,
      prioritized: prioritizedJobsCount, // Use actual prioritized count
      delayed: delayedJobsCount, // Use actual delayed count
      total: waitingJobs.length + activeJobs.length + prioritizedJobsCount + delayedJobsCount + completedJobs.length + failedJobs.length
    };
    
    // Calculate total ads across all brands (same as existing API)
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
    
    // Cache the result
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

// Set global reference for cache clearing
global.queueProcessingService = serviceExports;

module.exports = serviceExports;
