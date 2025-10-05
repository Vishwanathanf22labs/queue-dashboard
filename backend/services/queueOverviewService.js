const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");
const watchlistRedisService = require("./watchlistRedisService");

// Function to get dynamic Redis keys
function getRedisKeys() {
  return require("../config/constants").REDIS_KEYS;
}

// Cleanup function to remove completed/failed brands from currently processing queue
async function cleanupCompletedBrands() {
  try {
    const REDIS_KEYS = getRedisKeys();
    const currentlyProcessingBrands = await getGlobalRedis().lrange(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING, 0, -1);
    
    if (!currentlyProcessingBrands || currentlyProcessingBrands.length === 0) {
      return;
    }

    let removedCount = 0;
    const brandsToKeep = [];

    for (let i = 0; i < currentlyProcessingBrands.length; i++) {
      try {
        const processingData = JSON.parse(currentlyProcessingBrands[i]);
        const status = processingData.status?.toLowerCase();
        
        // Remove completed/failed brands (they should not show in "currently scraping")
        if (status && (status === 'completed' || status === 'complete' || status === 'failed' || status === 'error')) {
          logger.info(`Cleanup: Removing ${status} brand ${processingData.brandId} from ${REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING} Redis key`);
          removedCount++;
        } else {
          // Keep this brand in the list (running, processing, active, etc.)
          brandsToKeep.push(currentlyProcessingBrands[i]);
        }
      } catch (parseError) {
        logger.warn(`Cleanup: Error parsing brand data: ${parseError.message}`);
        // If we can't parse, keep it to be safe
        brandsToKeep.push(currentlyProcessingBrands[i]);
      }
    }

    // If we removed any brands, update the Redis key
    if (removedCount > 0) {
      // Clear the current list
      await getGlobalRedis().del(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING);
      
      // Add back only the brands to keep
      if (brandsToKeep.length > 0) {
        await getGlobalRedis().rpush(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING, ...brandsToKeep);
      }
      
      logger.info(`Cleanup completed: removed ${removedCount} completed/failed brands, kept ${brandsToKeep.length} active brands`);
    }
  } catch (error) {
    logger.error('Error during cleanup of completed brands:', error);
  }
}

// Cleanup function to remove running brands from currently processing queue (every 4 hours)
async function cleanupRunningBrands() {
  try {
    const REDIS_KEYS = getRedisKeys();
    const currentlyProcessingBrands = await getGlobalRedis().lrange(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING, 0, -1);
    
    if (!currentlyProcessingBrands || currentlyProcessingBrands.length === 0) {
      return;
    }

    let removedCount = 0;
    const brandsToKeep = [];

    for (let i = 0; i < currentlyProcessingBrands.length; i++) {
      try {
        const processingData = JSON.parse(currentlyProcessingBrands[i]);
        const status = processingData.status?.toLowerCase();
        
        // Remove running brands (keep completed, failed, and other statuses)
        if (status && (status === 'running' || status === 'processing' || status === 'active')) {
          logger.info(`Cleanup: Removing ${status} brand ${processingData.brandId} from ${REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING} Redis key (4-hour cleanup)`);
          removedCount++;
        } else {
          // Keep this brand in the list (completed, failed, etc.)
          brandsToKeep.push(currentlyProcessingBrands[i]);
        }
      } catch (parseError) {
        logger.warn(`Cleanup: Error parsing brand data: ${parseError.message}`);
        // If we can't parse, keep it to be safe
        brandsToKeep.push(currentlyProcessingBrands[i]);
      }
    }

    // If we removed any brands, update the Redis key
    if (removedCount > 0) {
      // Clear the current list
      await getGlobalRedis().del(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING);
      
      // Add back only the brands to keep
      if (brandsToKeep.length > 0) {
        await getGlobalRedis().rpush(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING, ...brandsToKeep);
      }
      
      logger.info(`4-hour cleanup completed: Removed ${removedCount} running brands, kept ${brandsToKeep.length} other brands`);
    }
  } catch (error) {
    logger.error('Error during 4-hour cleanup of running brands:', error);
  }
}

// Start automatic cleanup interval when module loads
let cleanupInterval = null;
let runningCleanupInterval = null;

// Function to start the cleanup intervals
function startCleanupInterval() {
  // Clear any existing intervals first
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    logger.info('Cleared existing cleanup interval');
  }
  
  if (runningCleanupInterval) {
    clearInterval(runningCleanupInterval);
    logger.info('Cleared existing running cleanup interval');
  }
  
  // Start 4-minute interval for completed/failed brands
  cleanupInterval = setInterval(async () => {
    logger.info('Running scheduled cleanup of completed brands...');
    await cleanupCompletedBrands();
    
    // Log next cleanup time
    const nextCleanup = new Date(Date.now() + 30 * 1000);
    logger.info(`Next cleanup scheduled for: ${nextCleanup.toLocaleString()}`);
  }, 30 * 1000); // Every 30 seconds
  
  // Start 4-hour interval for running brands
  runningCleanupInterval = setInterval(async () => {
    logger.info('Running scheduled cleanup of running brands...');
    await cleanupRunningBrands();
    
    // Log next cleanup time
    const nextCleanup = new Date(Date.now() + 4 * 60 * 60 * 1000);
    logger.info(`Next 4-hour cleanup scheduled for: ${nextCleanup.toLocaleString()}`);
  }, 4 * 60 * 60 * 1000); // Every 4 hours
  
  logger.info('Started automatic cleanup intervals: completed/failed brands (every 30 seconds), running brands (every 4 hours)');
  
  // Log the first cleanup times
  const firstCleanup = new Date(Date.now() + 30 * 1000);
  const firstRunningCleanup = new Date(Date.now() + 4 * 60 * 60 * 1000);
  logger.info(`First cleanup scheduled for: ${firstCleanup.toLocaleString()}`);
  logger.info(`First 4-hour cleanup scheduled for: ${firstRunningCleanup.toLocaleString()}`);
}

// Start the interval
startCleanupInterval();


async function getQueueOverview() {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    // Get regular Redis instance
    const regularRedis = getQueueRedis('regular');
    const watchlistRedis = getQueueRedis('watchlist');
    
    // Get regular queue counts
    const regularPendingCount = await regularRedis.zcard(REDIS_KEYS.REGULAR.PENDING_BRANDS);
    const regularFailedCount = await regularRedis.llen(REDIS_KEYS.REGULAR.FAILED_BRANDS);
    
    // Get watchlist queue counts
    const watchlistPendingCount = await watchlistRedis.zcard(REDIS_KEYS.WATCHLIST.PENDING_BRANDS);
    const watchlistFailedCount = await watchlistRedis.llen(REDIS_KEYS.WATCHLIST.FAILED_BRANDS);

    let activeBrandsCount = 0;
    try {
      // Require Brand model dynamically to get the latest version
      const { Brand } = require("../models");
      const activeBrands = await Brand.count({
        where: { status: "Active" },
      });
      activeBrandsCount = activeBrands;
    } catch (dbError) {
      logger.error("Error counting active brands from database:", dbError);
      activeBrandsCount = 0;
    }

    const currentlyProcessing = await getCurrentlyProcessing();

    // Get watchlist stats
    let watchlistStats = null;
    try {
      watchlistStats = await watchlistRedisService.getWatchlistStats();
    } catch (watchlistError) {
      logger.error("Error getting watchlist stats:", watchlistError);
      watchlistStats = {
        pending_count: 0,
        failed_count: 0
      };
    }

    return {
      queue_counts: {
        // Regular queue counts
        pending: regularPendingCount,
        failed: regularFailedCount,
        active: activeBrandsCount,
        // Watchlist queue counts
        watchlist_pending: watchlistPendingCount,
        watchlist_failed: watchlistFailedCount,
      },
      currently_processing: currentlyProcessing,
      watchlist_stats: watchlistStats,
    };
  } catch (error) {
    logger.error("Error in getQueueOverview:", error);
    throw error;
  }
}

async function getCurrentlyProcessing() {
  try {
    const REDIS_KEYS = getRedisKeys();
    // Get ALL currently processing brands from Redis key (cleanup runs automatically every 5 minutes)
    const currentlyProcessingBrands = await getGlobalRedis().lrange(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING, 0, -1);
    
    if (!currentlyProcessingBrands || currentlyProcessingBrands.length === 0) {
      return null;
    }

    const results = [];
    
    for (let i = 0; i < currentlyProcessingBrands.length; i++) {
      try {
        const processingData = JSON.parse(currentlyProcessingBrands[i]);
        
        // Check if brand is in watchlist table
        let isInWatchlist = false;
        try {
          // Require WatchList model dynamically
          const { WatchList } = require("../models");
          const watchlistBrand = await WatchList.findOne({
            where: { brand_id: parseInt(processingData.brandId) },
            attributes: ['brand_id'],
            raw: true
          });
          isInWatchlist = !!watchlistBrand;
        } catch (watchlistError) {
          logger.warn(`Error checking watchlist for brand ${processingData.brandId}:`, watchlistError);
          isInWatchlist = false;
        }
        
        // Get brand details from database
        // Require Brand model dynamically
        const { Brand } = require("../models");
        const brand = await Brand.findOne({
          where: { id: parseInt(processingData.brandId) },
          attributes: ["name", "actual_name", "page_id", "status"],
          raw: true,
        });

        if (!brand) {
          logger.warn(`Brand with ID ${processingData.brandId} not found in database`);
          // Return the Redis data even if brand not found in database
          results.push({
            brand_id: parseInt(processingData.brandId),
            brand_name: `Brand ${processingData.brandId}`,
            page_id: processingData.pageId || "Unknown",
            status: processingData.status || "Unknown",
            started_at: processingData.startAt || new Date().toISOString(),
            processing_duration: processingData.duration || 0,
            total_ads: processingData.totalAds || 0,
            proxy: processingData.proxy ? (() => {
              try {
                const proxyData = JSON.parse(processingData.proxy);
                return {
                  host: proxyData.proxy?.host,
                  port: proxyData.proxy?.port
                };
              } catch (e) {
                return null;
              }
            })() : null,
            is_watchlist: isInWatchlist
          });
        } else {
          // Parse proxy information if available
          let proxyInfo = null;
          if (processingData.proxy) {
            try {
              proxyInfo = JSON.parse(processingData.proxy);
            } catch (proxyParseError) {
              logger.warn(`Failed to parse proxy data: ${proxyParseError.message}`);
            }
          }

          let brandName;
          // Priority: actual_name > name (only if name is not "Brand") > page_id > Brand ID
          if (brand.actual_name && brand.actual_name.trim() !== '' && brand.actual_name.toLowerCase() !== 'brand') {
            brandName = brand.actual_name;
          } else if (brand.name && brand.name.trim() !== '' && brand.name.toLowerCase() !== 'brand') {
            brandName = brand.name;
          } else if (brand.page_id && brand.page_id.trim() !== '') {
            brandName = brand.page_id;
          } else {
            brandName = `Brand ${processingData.brandId}`;
          }
          
          results.push({
            brand_id: parseInt(processingData.brandId),
            brand_name: brandName,
            page_id: processingData.pageId || brand.page_id || "Unknown",
            status: processingData.status || brand.status || "Unknown",
            started_at: processingData.startAt || new Date().toISOString(),
            processing_duration: processingData.duration || 0,
            total_ads: processingData.totalAds || 0,
            proxy: proxyInfo ? {
              host: proxyInfo.proxy?.host,
              port: proxyInfo.proxy?.port
            } : null,
            is_watchlist: isInWatchlist
          });
        }
      } catch (parseError) {
        logger.error(`Error parsing currently processing brand data at index ${i}:`, parseError);
        // Continue with next brand instead of failing completely
      }
    }

    return results.length > 0 ? results : null;
  } catch (error) {
    logger.error("Error in getCurrentlyProcessing:", error);
    return null;
  }
}

async function getAllBrandProcessingJobs() {
  try {
    const regularRedis = getQueueRedis('regular');
    const watchlistRedis = getQueueRedis('watchlist');
    
    // Get all job IDs from all Redis queues
    const [regularWaiting, regularActive, regularPrioritized, regularCompleted, regularFailed, regularDelayed] = await Promise.all([
      regularRedis.lrange('bull:brand-processing:waiting', 0, -1).catch(() => []),
      regularRedis.lrange('bull:brand-processing:active', 0, -1).catch(() => []),
      regularRedis.lrange('bull:brand-processing:prioritized', 0, -1).catch(() => []),
      regularRedis.lrange('bull:brand-processing:completed', 0, -1).catch(() => []),
      regularRedis.lrange('bull:brand-processing:failed', 0, -1).catch(() => []),
      regularRedis.lrange('bull:brand-processing:delayed', 0, -1).catch(() => [])
    ]);
    
    const [watchlistWaiting, watchlistActive, watchlistPrioritized, watchlistCompleted, watchlistFailed, watchlistDelayed] = await Promise.all([
      watchlistRedis.lrange('bull:brand-processing:waiting', 0, -1).catch(() => []),
      watchlistRedis.lrange('bull:brand-processing:active', 0, -1).catch(() => []),
      watchlistRedis.lrange('bull:brand-processing:prioritized', 0, -1).catch(() => []),
      watchlistRedis.lrange('bull:brand-processing:completed', 0, -1).catch(() => []),
      watchlistRedis.lrange('bull:brand-processing:failed', 0, -1).catch(() => []),
      watchlistRedis.lrange('bull:brand-processing:delayed', 0, -1).catch(() => [])
    ]);
    
    // Combine all job IDs with their status and queue type
    const allJobs = [];
    
    // Regular jobs
    regularWaiting.forEach(jobId => allJobs.push({ jobId, status: 'waiting', queueType: 'regular' }));
    regularActive.forEach(jobId => allJobs.push({ jobId, status: 'active', queueType: 'regular' }));
    regularPrioritized.forEach(jobId => allJobs.push({ jobId, status: 'prioritized', queueType: 'regular' }));
    regularCompleted.forEach(jobId => allJobs.push({ jobId, status: 'completed', queueType: 'regular' }));
    regularFailed.forEach(jobId => allJobs.push({ jobId, status: 'failed', queueType: 'regular' }));
    regularDelayed.forEach(jobId => allJobs.push({ jobId, status: 'delayed', queueType: 'regular' }));
    
    // Watchlist jobs
    watchlistWaiting.forEach(jobId => allJobs.push({ jobId, status: 'waiting', queueType: 'watchlist' }));
    watchlistActive.forEach(jobId => allJobs.push({ jobId, status: 'active', queueType: 'watchlist' }));
    watchlistPrioritized.forEach(jobId => allJobs.push({ jobId, status: 'prioritized', queueType: 'watchlist' }));
    watchlistCompleted.forEach(jobId => allJobs.push({ jobId, status: 'completed', queueType: 'watchlist' }));
    watchlistFailed.forEach(jobId => allJobs.push({ jobId, status: 'failed', queueType: 'watchlist' }));
    watchlistDelayed.forEach(jobId => allJobs.push({ jobId, status: 'delayed', queueType: 'watchlist' }));
    
    if (allJobs.length === 0) {
      return { regular: [], watchlist: [], counters: { regular: {}, watchlist: {} } };
    }
    
    // Get job details from Redis
    const jobDetails = new Map();
    
    for (const job of allJobs) {
      try {
        const redis = job.queueType === 'regular' ? regularRedis : watchlistRedis;
        const jobData = await redis.hgetall(`bull:brand-processing:${job.jobId}`);
        
        if (jobData && Object.keys(jobData).length > 0) {
          // Parse job data
          const parsedData = {};
          Object.keys(jobData).forEach(key => {
            try {
              parsedData[key] = JSON.parse(jobData[key]);
            } catch {
              parsedData[key] = jobData[key];
            }
          });
          
          jobDetails.set(job.jobId, {
            job_id: job.jobId,
            job_status: job.status,
            queue_type: job.queueType,
            data: parsedData,
            brand_id: parsedData.data?.brandId || parsedData.brandId,
            page_id: parsedData.data?.pageId || parsedData.pageId,
            created_at: parsedData.timestamp || parsedData.createdAt || new Date().toISOString()
          });
        }
      } catch (error) {
        logger.warn(`Error getting job details for ${job.jobId}:`, error);
      }
    }
    
    // Get brand details from database
    const { Brand, WatchList } = require("../models");
    const brandIds = Array.from(new Set(Array.from(jobDetails.values()).map(job => job.brand_id).filter(Boolean)));
    
    if (brandIds.length > 0) {
      const brands = await Brand.findAll({
        where: { id: brandIds },
        attributes: ['id', 'name', 'actual_name', 'page_id', 'page_name'],
        raw: true
      });
      
      const watchlistBrands = await WatchList.findAll({
        where: { brand_id: brandIds },
        attributes: ['brand_id'],
        raw: true
      });
      
      const watchlistBrandIds = new Set(watchlistBrands.map(wb => wb.brand_id));
      const brandMap = new Map(brands.map(brand => [brand.id, brand]));
      
      // Enrich job details with brand information
      for (const [jobId, job] of jobDetails) {
        const brand = brandMap.get(job.brand_id);
        if (brand) {
          job.brand_name = brand.actual_name || brand.name;
          job.page_name = brand.page_name || brand.page_id;
          job.is_watchlist = watchlistBrandIds.has(job.brand_id);
          
          // Get ads count from database if available
          try {
            const { Ad } = require("../models");
            const adCount = await Ad.count({
              where: { brand_id: job.brand_id },
              raw: true
            });
            job.total_ads = adCount;
          } catch (error) {
            job.total_ads = 0;
          }
        }
      }
    }
    
    // Separate regular and watchlist jobs
    const regularJobs = Array.from(jobDetails.values()).filter(job => job.queue_type === 'regular');
    const watchlistJobs = Array.from(jobDetails.values()).filter(job => job.queue_type === 'watchlist');
    
    // Calculate counters
    const regularCounters = {
      waiting: regularWaiting.length,
      active: regularActive.length,
      prioritized: regularPrioritized.length,
      completed: regularCompleted.length,
      failed: regularFailed.length,
      delayed: regularDelayed.length,
      total: regularJobs.length
    };
    
    const watchlistCounters = {
      waiting: watchlistWaiting.length,
      active: watchlistActive.length,
      prioritized: watchlistPrioritized.length,
      completed: watchlistCompleted.length,
      failed: watchlistFailed.length,
      delayed: watchlistDelayed.length,
      total: watchlistJobs.length
    };
    
    return {
      regular: regularJobs,
      watchlist: watchlistJobs,
      counters: {
        regular: regularCounters,
        watchlist: watchlistCounters
      }
    };
    
  } catch (error) {
    logger.error("Error in getAllBrandProcessingJobs:", error);
    return { regular: [], watchlist: [], counters: { regular: {}, watchlist: {} } };
  }
}

async function getQueueStatistics() {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    // Get regular Redis instance
    const regularRedis = getQueueRedis('regular');
    const watchlistRedis = getQueueRedis('watchlist');
    
    // Get regular queue counts
    const regularPendingCount = await regularRedis.zcard(REDIS_KEYS.REGULAR.PENDING_BRANDS);
    const regularFailedCount = await regularRedis.llen(REDIS_KEYS.REGULAR.FAILED_BRANDS);
    
    // Get watchlist queue counts
    const watchlistPendingCount = await watchlistRedis.zcard(REDIS_KEYS.WATCHLIST.PENDING_BRANDS);
    const watchlistFailedCount = await watchlistRedis.llen(REDIS_KEYS.WATCHLIST.FAILED_BRANDS);

    // Require Brand model dynamically to get the latest version
    const { Brand } = require("../models");
    
    const activeBrandsCount = await Brand.count({
      where: { status: "Active" },
    });

    const totalBrandsCount = await Brand.count();

    return {
      queue_stats: {
        // Regular queue stats
        pending_count: regularPendingCount,
        failed_count: regularFailedCount,
        total_queued: regularPendingCount + regularFailedCount,
        // Watchlist queue stats
        watchlist_pending_count: watchlistPendingCount,
        watchlist_failed_count: watchlistFailedCount,
        watchlist_total_queued: watchlistPendingCount + watchlistFailedCount,
        // Combined stats
        total_pending: regularPendingCount + watchlistPendingCount,
        total_failed: regularFailedCount + watchlistFailedCount,
        total_queued_all: regularPendingCount + regularFailedCount + watchlistPendingCount + watchlistFailedCount,
      },
      brand_stats: {
        total_brands: totalBrandsCount,
        active_brands: activeBrandsCount,
      },
    };
  } catch (error) {
    logger.error("Error in getQueueStatistics:", error);
    throw error;
  }
}

// Function to clear all caches when environment changes
function clearAllCaches() {
  try {
    logger.info('🧹 Clearing all queue overview caches for environment switch...');
    
    // Stop any running cleanup intervals
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
      logger.info('Stopped cleanup interval for environment switch');
    }
    
    if (runningCleanupInterval) {
      clearInterval(runningCleanupInterval);
      runningCleanupInterval = null;
      logger.info('Stopped running cleanup interval for environment switch');
    }
    
    // Restart cleanup intervals for the new environment
    startCleanupInterval();
    logger.info('✅ Restarted cleanup intervals for new environment');
    
    logger.info('✅ All queue overview caches cleared successfully');
  } catch (error) {
    logger.error('❌ Error clearing queue overview caches:', error);
  }
}

module.exports = {
  getQueueOverview,
  getCurrentlyProcessing,
  getQueueStatistics,
  cleanupCompletedBrands,
  startCleanupInterval,
  stopCleanupInterval: () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
      logger.info('Stopped automatic cleanup interval');
    }
  },
  clearAllCaches,
};
