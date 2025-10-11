const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

function getRedisKeys(environment = 'production') {
  return require("../config/constants").getRedisKeys(environment);
}

async function clearAllQueues(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info("Clearing all queues (regular and watchlist pending and failed) and reenqueue list");

    const regularRedis = getQueueRedis('regular', environment);
    const watchlistRedis = getQueueRedis('watchlist', environment);
    const globalRedis = getGlobalRedis(environment);

    const regularPendingCount = await regularRedis.zcard(REDIS_KEYS.REGULAR.PENDING_BRANDS);
    const regularFailedCount = await regularRedis.llen(REDIS_KEYS.REGULAR.FAILED_BRANDS);
    const watchlistPendingCount = await watchlistRedis.zcard(REDIS_KEYS.WATCHLIST.PENDING_BRANDS);
    const watchlistFailedCount = await watchlistRedis.llen(REDIS_KEYS.WATCHLIST.FAILED_BRANDS);
    
    const reenqueueCount = await globalRedis.llen(REDIS_KEYS.GLOBAL.REENQUEUE_KEY);

    await regularRedis.del(REDIS_KEYS.REGULAR.PENDING_BRANDS);
    await regularRedis.del(REDIS_KEYS.REGULAR.FAILED_BRANDS);
    await watchlistRedis.del(REDIS_KEYS.WATCHLIST.PENDING_BRANDS);
    await watchlistRedis.del(REDIS_KEYS.WATCHLIST.FAILED_BRANDS);
    
    await globalRedis.del(REDIS_KEYS.GLOBAL.REENQUEUE_KEY);

    const totalCleared = regularPendingCount + regularFailedCount + watchlistPendingCount + watchlistFailedCount + reenqueueCount;

    logger.info(
      `Successfully cleared all queues and reenqueue list. Removed ${regularPendingCount} regular pending + ${regularFailedCount} regular failed + ${watchlistPendingCount} watchlist pending + ${watchlistFailedCount} watchlist failed + ${reenqueueCount} reenqueue = ${totalCleared} total brands`
    );

    return {
      regular: {
        cleared_pending: regularPendingCount,
        cleared_failed: regularFailedCount,
      },
      watchlist: {
        cleared_pending: watchlistPendingCount,
        cleared_failed: watchlistFailedCount,
      },
      reenqueue: {
        cleared_count: reenqueueCount,
      },
      total_cleared: totalCleared,
      message: `Cleared all queues and reenqueue list: ${totalCleared} total brands (regular: ${regularPendingCount + regularFailedCount}, watchlist: ${watchlistPendingCount + watchlistFailedCount}, reenqueue: ${reenqueueCount})`,
    };
  } catch (error) {
    logger.error("Error clearing all queues:", error);
    throw error;
  }
}

async function clearPendingQueue(queueType = 'regular', environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info(`Clearing entire ${queueType} pending queue`);

    const redis = getQueueRedis(queueType, environment);
    const queueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;
    const pendingCount = await redis.zcard(queueKey);

    await redis.del(queueKey);

    logger.info(
      `Successfully cleared ${queueType} pending queue. Removed ${pendingCount} brands`
    );

    return {
      cleared_count: pendingCount,
      queue_type: queueType,
      message: `Cleared ${pendingCount} brands from ${queueType} pending queue`,
    };
  } catch (error) {
    logger.error(`Error clearing ${queueType} pending queue:`, error);
    throw error;
  }
}

async function clearFailedQueue(queueType = 'regular', environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info(`Clearing entire ${queueType} failed queue`);

    const redis = getQueueRedis(queueType, environment);
    const queueKey = REDIS_KEYS[queueType.toUpperCase()].FAILED_BRANDS;
    const failedCount = await redis.llen(queueKey);

    await redis.del(queueKey);

    logger.info(
      `Successfully cleared ${queueType} failed queue. Removed ${failedCount} brands`
    );

    return {
      cleared_count: failedCount,
      queue_type: queueType,
      message: `Cleared ${failedCount} brands from ${queueType} failed queue`,
    };
  } catch (error) {
    logger.error(`Error clearing ${queueType} failed queue:`, error);
    throw error;
  }
}

async function clearWatchlistPendingQueue(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info("Clearing entire watchlist pending queue");

    const redis = getQueueRedis('watchlist', environment);
    const queueKey = REDIS_KEYS.WATCHLIST.PENDING_BRANDS;
    const pendingCount = await redis.zcard(queueKey);

    await redis.del(queueKey);

    logger.info(
      `Successfully cleared watchlist pending queue. Removed ${pendingCount} brands`
    );

    return {
      cleared_count: pendingCount,
      queue_type: 'watchlist',
      message: `Cleared ${pendingCount} brands from watchlist pending queue`,
    };
  } catch (error) {
    logger.error("Error clearing watchlist pending queue:", error);
    throw error;
  }
}

async function clearWatchlistFailedQueue(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info("Clearing entire watchlist failed queue");

    const redis = getQueueRedis('watchlist', environment);
    const queueKey = REDIS_KEYS.WATCHLIST.FAILED_BRANDS;
    const failedCount = await redis.llen(queueKey);

    await redis.del(queueKey);

    logger.info(
      `Successfully cleared watchlist failed queue. Removed ${failedCount} brands`
    );

    return {
      cleared_count: failedCount,
      queue_type: 'watchlist',
      message: `Cleared ${failedCount} brands from watchlist failed queue`,
    };
  } catch (error) {
    logger.error("Error clearing watchlist failed queue:", error);
    throw error;
  }
}

module.exports = {
  clearAllQueues,
  clearPendingQueue,
  clearFailedQueue,
  clearWatchlistPendingQueue,
  clearWatchlistFailedQueue,
};
