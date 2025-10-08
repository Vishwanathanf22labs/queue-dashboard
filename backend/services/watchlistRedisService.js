const { getWatchlistRedisInstance } = require('../utils/redisSelector');
const logger = require('../utils/logger');

// Function to get dynamic Redis keys
function getRedisKeys() {
  return require('../config/constants').REDIS_KEYS;
}

/**
 * Get count of watchlist pending brands from Redis sorted set
 * @returns {Promise<number>} Count of pending brands
 */
async function getWatchlistPendingCount() {
  try {
    const REDIS_KEYS = getRedisKeys();
    const key = REDIS_KEYS.WATCHLIST.PENDING_BRANDS;
    const count = await getWatchlistRedisInstance().zcard(key);
    logger.info(`Watchlist pending count: ${count}`);
    return count;
  } catch (error) {
    logger.error('Error getting watchlist pending count:', error);
    return 0;
  }
}

/**
 * Get count of watchlist failed brands from Redis list
 * @returns {Promise<number>} Count of failed brands
 */
async function getWatchlistFailedCount() {
  try {
    const REDIS_KEYS = getRedisKeys();
    const key = REDIS_KEYS.WATCHLIST.FAILED_BRANDS;
    const count = await getWatchlistRedisInstance().llen(key);
    logger.info(`Watchlist failed count: ${count}`);
    return count;
  } catch (error) {
    logger.error('Error getting watchlist failed count:', error);
    return 0;
  }
}

/**
 * Get count of watchlist completed brands (not in pending or failed queues)
 * @returns {Promise<number>} Count of completed brands
 */
async function getWatchlistCompletedCount() {
  try {
    const REDIS_KEYS = getRedisKeys();
    // Get current pending and failed page_ids from Redis
    const [pendingItems, failedItems] = await Promise.all([
      getWatchlistRedisInstance().zrange(REDIS_KEYS.WATCHLIST.PENDING_BRANDS, 0, -1),
      getWatchlistRedisInstance().lrange(REDIS_KEYS.WATCHLIST.FAILED_BRANDS, 0, -1)
    ]);
    
    // If both queues are empty, completed count is 0
    if (pendingItems.length === 0 && failedItems.length === 0) {
      logger.info('Watchlist queues are empty, completed count: 0');
      return 0;
    }
    

    const { getWatchlistBrands } = require('./queueReadService');
    

    const watchlistData = await getWatchlistBrands(1, 10000, null, null);
    
    if (!watchlistData || !watchlistData.brands || watchlistData.brands.length === 0) {
      logger.info('No watchlist brands found');
      return 0;
    }
    
    // Create sets for fast lookup
    const pendingPageIds = new Set();
    const failedPageIds = new Set();
    
    pendingItems.forEach(item => {
      try {
        const brandData = JSON.parse(item);
        pendingPageIds.add(brandData.page_id);
      } catch (e) {
        // Skip invalid items
      }
    });
    
    failedItems.forEach(item => {
      try {
        const brandData = JSON.parse(item);
        failedPageIds.add(brandData.page_id);
      } catch (e) {
        // Skip invalid items
      }
    });
    

    let completedCount = 0;
    
    watchlistData.brands.forEach(brand => {
      const pageId = brand.page_id;

      if (pendingPageIds.has(pageId)) {
        return; 
      }

      if (failedPageIds.has(pageId)) {
        return; 
      }
      
      if (brand.status === 'Inactive') {
        return; 
      }

      completedCount++;
    });
    
    logger.info(`Watchlist completed count: ${completedCount} (from ${watchlistData.brands.length} total watchlist brands)`);
    return completedCount;
  } catch (error) {
    logger.error('Error getting watchlist completed count:', error);
    return 0;
  }
}

/**
 * Get watchlist stats (pending, failed, and completed counts)
 * @returns {Promise<Object>} Object with pending, failed, and completed counts
 */
async function getWatchlistStats() {
  try {
    const [pendingCount, failedCount, completedCount] = await Promise.all([
      getWatchlistPendingCount(),
      getWatchlistFailedCount(),
      getWatchlistCompletedCount()
    ]);

    return {
      pending_count: pendingCount,
      failed_count: failedCount,
      completed_count: completedCount
    };
  } catch (error) {
    logger.error('Error getting watchlist stats:', error);
    return {
      pending_count: 0,
      failed_count: 0,
      completed_count: 0
    };
  }
}

module.exports = {
  getWatchlistPendingCount,
  getWatchlistFailedCount,
  getWatchlistCompletedCount,
  getWatchlistStats
};
