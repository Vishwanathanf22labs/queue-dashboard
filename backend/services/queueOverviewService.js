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
        
        // Keep only brands that are actively processing (not completed or failed)
        if (status && (status === 'completed' || status === 'complete' || status === 'failed' || status === 'error')) {
          logger.info(`Cleanup: Removing ${status} brand ${processingData.brandId} from ${REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING} Redis key`);
          removedCount++;
        } else {
          // Keep this brand in the list (processing, active, etc.)
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

// Start automatic cleanup interval when module loads
let cleanupInterval = null;

// Function to start the cleanup interval
function startCleanupInterval() {
  // Clear any existing interval first
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    logger.info('Cleared existing cleanup interval');
  }
  
  // Start new interval
  cleanupInterval = setInterval(async () => {
    logger.info('Running scheduled cleanup of completed brands...');
    await cleanupCompletedBrands();
    
    // Log next cleanup time
    const nextCleanup = new Date(Date.now() + 4 * 60 * 1000);
    logger.info(`Next cleanup scheduled for: ${nextCleanup.toLocaleString()}`);
  }, 4 * 60 * 1000); // Every 4 minutes
  
  logger.info('Started automatic cleanup interval for completed brands (every 4 minutes)');
  
  // Log the first cleanup time
  const firstCleanup = new Date(Date.now() + 4 * 60 * 1000);
  logger.info(`First cleanup scheduled for: ${firstCleanup.toLocaleString()}`);
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
