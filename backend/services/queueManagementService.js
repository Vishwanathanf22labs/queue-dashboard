const queueClearService = require("./queueClearService");
const queueMoveService = require("./queueMoveService");
const queueRemoveService = require("./queueRemoveService");
const redis = require("../config/redis");
const { QUEUES } = require("../config/constants");
const logger = require("../utils/logger");
const Brand = require('../models/Brand');

async function getQueueStats() {
  try {
    const pendingCount = await redis.zcard(QUEUES.PENDING_BRANDS);
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

async function changeBrandScore(queueType, brandName, newScore) {
  try {
    if (queueType === 'pending') {
      // For pending queue (sorted set), we need to find the brand by name and update its score
      const allPendingItems = await redis.zrange(QUEUES.PENDING_BRANDS, 0, -1, 'WITHSCORES');
      
      // Find the brand with matching name
      let brandFound = false;
      for (let i = 0; i < allPendingItems.length; i += 2) {
        const member = allPendingItems[i];
        const score = allPendingItems[i + 1];
        
        try {
          const brandData = JSON.parse(member);
          if (brandData.id && brandData.page_id) {
            // Get brand details from database to match by name
            const brand = await Brand.findOne({ where: { id: brandData.id } });
            
            if (brand && brand.name.toLowerCase() === brandName.toLowerCase()) {
              // Remove the old entry and add with new score
              await redis.zrem(QUEUES.PENDING_BRANDS, member);
              await redis.zadd(QUEUES.PENDING_BRANDS, newScore, member);
              brandFound = true;
              break;
            }
          }
        } catch (parseError) {
          logger.warn(`Failed to parse brand data: ${member}`, parseError);
          continue;
        }
      }
      
      if (!brandFound) {
        throw new Error(`Brand "${brandName}" not found in pending queue`);
      }
      
      return {
        success: true,
        message: `Successfully updated brand "${brandName}" score to ${newScore} in pending queue`,
        brandName,
        newScore,
        queueType
      };
      
    } else if (queueType === 'failed') {
      // For failed queue (list), we need to find the brand by name and update its score
      const allFailedItems = await redis.lrange(QUEUES.FAILED_BRANDS, 0, -1);
      
      // Find the brand with matching name
      let brandFound = false;
      for (let i = 0; i < allFailedItems.length; i++) {
        const member = allFailedItems[i];
        
        try {
          const brandData = JSON.parse(member);
          if (brandData.id && brandData.page_id) {
            // Get brand details from database to match by name
            const brand = await Brand.findOne({ where: { id: brandData.id } });
            
            if (brand && brand.name.toLowerCase() === brandName.toLowerCase()) {
              // Remove the old entry and add with new score (failed queue doesn't use scores, so we'll add to pending)
              await redis.lrem(QUEUES.FAILED_BRANDS, 0, member);
              await redis.zadd(QUEUES.PENDING_BRANDS, newScore, member);
              brandFound = true;
              break;
            }
          }
        } catch (parseError) {
          logger.warn(`Failed to parse brand data: ${member}`, parseError);
          continue;
        }
      }
      
      if (!brandFound) {
        throw new Error(`Brand "${brandName}" not found in failed queue`);
      }
      
      return {
        success: true,
        message: `Successfully moved brand "${brandName}" from failed queue to pending queue with score ${newScore}`,
        brandName,
        newScore,
        queueType
      };
    }
    
    throw new Error(`Invalid queue type: ${queueType}`);
    
  } catch (error) {
    logger.error("Error in changeBrandScore:", error);
    throw error;
  }
}

module.exports = {
  ...queueClearService,
  ...queueMoveService,
  ...queueRemoveService,
  getQueueStats,
  changeBrandScore,
};
