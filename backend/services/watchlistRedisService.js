const { watchlistRedis } = require('../config/redis');
const logger = require('../utils/logger');
const { REDIS_KEYS } = require('../config/constants');

/**
 * Get count of watchlist pending brands from Redis sorted set
 * @returns {Promise<number>} Count of pending brands
 */
async function getWatchlistPendingCount() {
  try {
    const key = REDIS_KEYS.WATCHLIST.PENDING_BRANDS;
    const count = await watchlistRedis.zcard(key);
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
    const key = REDIS_KEYS.WATCHLIST.FAILED_BRANDS;
    const count = await watchlistRedis.llen(key);
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
    // Get current pending and failed page_ids from Redis
    const [pendingItems, failedItems] = await Promise.all([
      watchlistRedis.zrange(REDIS_KEYS.WATCHLIST.PENDING_BRANDS, 0, -1),
      watchlistRedis.lrange(REDIS_KEYS.WATCHLIST.FAILED_BRANDS, 0, -1)
    ]);
    
    // If both queues are empty, completed count is 0
    if (pendingItems.length === 0 && failedItems.length === 0) {
      logger.info('Watchlist queues are empty, completed count: 0');
      return 0;
    }
    
    // Get all watchlist brands from database
    const Brand = require('../models/Brand');
    const WatchList = require('../models/WatchList');
    
    // Get all watchlist brand_ids
    const watchlistItems = await WatchList.findAll({
      attributes: ['brand_id'],
      raw: true
    });
    
    if (watchlistItems.length === 0) {
      return 0;
    }
    
    const watchlistBrandIds = watchlistItems.map(item => item.brand_id);
    
    // Get the brand details for watchlist brands
    const watchlistBrands = await Brand.findAll({
      where: {
        id: watchlistBrandIds
      },
      attributes: ['id', 'page_id'],
      raw: true
    });
    
    if (watchlistBrands.length === 0) {
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
    
    // Count brands that are NOT in pending or failed queues
    let completedCount = 0;
    watchlistBrands.forEach(brand => {
      if (!pendingPageIds.has(brand.page_id) && !failedPageIds.has(brand.page_id)) {
        completedCount++;
      }
    });
    
    logger.info(`Watchlist completed count: ${completedCount}`);
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
