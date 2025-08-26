const redis = require("../config/redis");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

async function clearAllQueues() {
  try {
    logger.info("Clearing all queues (pending and failed)");

    const pendingCount = await redis.zcard(QUEUES.PENDING_BRANDS);
    const failedCount = await redis.llen(QUEUES.FAILED_BRANDS);

    await redis.del(QUEUES.PENDING_BRANDS);
    await redis.del(QUEUES.FAILED_BRANDS);

    const totalCleared = pendingCount + failedCount;

    logger.info(
      `Successfully cleared all queues. Removed ${pendingCount} pending + ${failedCount} failed = ${totalCleared} total brands`
    );

    return {
      cleared_pending: pendingCount,
      cleared_failed: failedCount,
      total_cleared: totalCleared,
      message: `Cleared all queues: ${pendingCount} pending + ${failedCount} failed = ${totalCleared} total brands`,
    };
  } catch (error) {
    logger.error("Error clearing all queues:", error);
    throw error;
  }
}

async function clearPendingQueue() {
  try {
    logger.info("Clearing entire pending queue");

    const pendingCount = await redis.zcard(QUEUES.PENDING_BRANDS);

    await redis.del(QUEUES.PENDING_BRANDS);

    logger.info(
      `Successfully cleared pending queue. Removed ${pendingCount} brands`
    );

    return {
      cleared_count: pendingCount,
      message: `Cleared ${pendingCount} brands from pending queue`,
    };
  } catch (error) {
    logger.error("Error clearing pending queue:", error);
    throw error;
  }
}

async function clearFailedQueue() {
  try {
    logger.info("Clearing entire failed queue");

    const failedCount = await redis.llen(QUEUES.FAILED_BRANDS);

    await redis.del(QUEUES.FAILED_BRANDS);

    logger.info(
      `Successfully cleared failed queue. Removed ${failedCount} brands`
    );

    return {
      cleared_count: failedCount,
      message: `Cleared ${failedCount} brands from failed queue`,
    };
  } catch (error) {
    logger.error("Error clearing failed queue:", error);
    throw error;
  }
}

module.exports = {
  clearAllQueues,
  clearPendingQueue,
  clearFailedQueue,
};
