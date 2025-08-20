const queueClearService = require("./queueClearService");
const queueMoveService = require("./queueMoveService");
const queueRemoveService = require("./queueRemoveService");
const redis = require("../config/redis");
const { QUEUES } = require("../config/constants");
const logger = require("../utils/logger");

async function getQueueStats() {
  try {
    const pendingCount = await redis.llen(QUEUES.PENDING_BRANDS);
    const failedCount = await redis.llen(QUEUES.FAILED_BRANDS);

    return {
      pending_count: pendingCount,
      failed_count: failedCount,
      total_count: pendingCount + failedCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error getting queue stats:", error);
    throw error;
  }
}

module.exports = {
  ...queueClearService,
  ...queueMoveService,
  ...queueRemoveService,
  getQueueStats,
};
