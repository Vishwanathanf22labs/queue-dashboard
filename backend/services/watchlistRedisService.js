const { getWatchlistRedisInstance } = require('../utils/redisSelector');
const logger = require('../utils/logger');

function getRedisKeys(environment = null) {
  const { getRedisKeys } = require('../config/constants');
  return getRedisKeys(environment);
}

async function getWatchlistPendingCount(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const key = REDIS_KEYS.WATCHLIST.PENDING_BRANDS;
    const count = await getWatchlistRedisInstance(environment).zcard(key);
    logger.info(`Watchlist pending count [${environment}]: ${count}`);
    return count;
  } catch (error) {
    logger.error('Error getting watchlist pending count:', error);
    return 0;
  }
}

async function getWatchlistFailedCount(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const key = REDIS_KEYS.WATCHLIST.FAILED_BRANDS;
    const count = await getWatchlistRedisInstance(environment).llen(key);
    logger.info(`Watchlist failed count [${environment}]: ${count}`);
    return count;
  } catch (error) {
    logger.error('Error getting watchlist failed count:', error);
    return 0;
  }
}

async function getWatchlistCompletedCount(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const [pendingItems, failedItems] = await Promise.all([
      getWatchlistRedisInstance(environment).zrange(REDIS_KEYS.WATCHLIST.PENDING_BRANDS, 0, -1),
      getWatchlistRedisInstance(environment).lrange(REDIS_KEYS.WATCHLIST.FAILED_BRANDS, 0, -1)
    ]);

    if (pendingItems.length === 0 && failedItems.length === 0) {
      logger.info('Watchlist queues are empty, completed count: 0');
      return 0;
    }


    const { getWatchlistBrands } = require('./queueReadService');


    const watchlistData = await getWatchlistBrands(1, 10000, null, environment, null);

    if (!watchlistData || !watchlistData.brands || watchlistData.brands.length === 0) {
      logger.info('No watchlist brands found');
      return 0;
    }


    const pendingPageIds = new Set();
    const failedPageIds = new Set();

    pendingItems.forEach(item => {
      try {
        const brandData = JSON.parse(item);
        pendingPageIds.add(brandData.page_id);
      } catch (e) {

      }
    });

    failedItems.forEach(item => {
      try {
        const brandData = JSON.parse(item);
        failedPageIds.add(brandData.page_id);
      } catch (e) {
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

async function getWatchlistStats(environment = 'production') {
  try {
    const [pendingCount, failedCount, completedCount] = await Promise.all([
      getWatchlistPendingCount(environment),
      getWatchlistFailedCount(environment),
      getWatchlistCompletedCount(environment)
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
