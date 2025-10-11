const queueClearService = require("./queueClearService");
const queueMoveService = require("./queueMoveService");
const queueRemoveService = require("./queueRemoveService");
const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const { QUEUES } = require("../config/constants");
const logger = require("../utils/logger");

function getRedisKeys(environment = 'production') {
  return require("../config/constants").getRedisKeys(environment);
}

async function getQueueStats() {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    const regularRedis = getQueueRedis('regular');
    const watchlistRedis = getQueueRedis('watchlist');
    
    const regularPendingCount = await regularRedis.zcard(REDIS_KEYS.REGULAR.PENDING_BRANDS);
    const regularFailedCount = await regularRedis.llen(REDIS_KEYS.REGULAR.FAILED_BRANDS);
    
    const watchlistPendingCount = await watchlistRedis.zcard(REDIS_KEYS.WATCHLIST.PENDING_BRANDS);
    const watchlistFailedCount = await watchlistRedis.llen(REDIS_KEYS.WATCHLIST.FAILED_BRANDS);

    return {
      pending_count: regularPendingCount,
      failed_count: regularFailedCount,
      watchlist_pending_count: watchlistPendingCount,
      watchlist_failed_count: watchlistFailedCount,
      total_count:
        regularPendingCount +
        regularFailedCount +
        watchlistPendingCount +
        watchlistFailedCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error getting queue stats:", error);
    throw error;
  }
}

async function changeBrandScore(queueType, brandName, newScore, environment = 'production') {
  try {
    const { getModels } = require("../models");
    const { Brand } = getModels(environment);
    const REDIS_KEYS = getRedisKeys(environment);
    
    const queueConfigs = {
      pending: {
        redis: getQueueRedis('regular', environment),
        queueKey: REDIS_KEYS.REGULAR.PENDING_BRANDS,
        type: "sortedSet",
        description: "regular pending queue",
      },
      failed: {
        redis: getQueueRedis('regular', environment),
        queueKey: REDIS_KEYS.REGULAR.FAILED_BRANDS,
        type: "list",
        description: "regular failed queue",
      },
      watchlist_pending: {
        redis: getQueueRedis('watchlist', environment),
        queueKey: REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
        type: "sortedSet",
        description: "watchlist pending queue",
      },
      watchlist_failed: {
        redis: getQueueRedis('watchlist', environment),
        queueKey: REDIS_KEYS.WATCHLIST.FAILED_BRANDS,
        type: "list",
        description: "watchlist failed queue",
      },
    };

    const config = queueConfigs[queueType];
    if (!config) {
      throw new Error(`Invalid queue type: ${queueType}`);
    }

    if (config.type === "sortedSet") {
      const allItems = await config.redis.zrange(config.queueKey, 0, -1, "WITHSCORES");

      let brandFound = false;
      for (let i = 0; i < allItems.length; i += 2) {
        const member = allItems[i];
        const score = allItems[i + 1];

        try {
          const brandData = JSON.parse(member);
          if (brandData.id && brandData.page_id) {
            const brand = await Brand.findOne({ where: { id: brandData.id } });

            if (brand) {
              const normalizedSearchName = brandName.toLowerCase().replace(/\s+/g, '');
              
      
              const normalizedBrandName = brand.name ? brand.name.toLowerCase().replace(/\s+/g, '') : '';
              const normalizedActualName = brand.actual_name ? brand.actual_name.toLowerCase().replace(/\s+/g, '') : '';
              
        
              const pageIdMatch = brand.page_id && brand.page_id.toString() === brandName;
              
             
              const brandIdMatch = brand.id && brand.id.toString() === brandName;
              

              if (normalizedBrandName === normalizedSearchName || 
                  normalizedActualName === normalizedSearchName ||
                  pageIdMatch || 
                  brandIdMatch) {
                await config.redis.zrem(config.queueKey, member);
                await config.redis.zadd(config.queueKey, newScore, member);
                brandFound = true;
                break;
              }
            }
          }
        } catch (parseError) {
          logger.warn(`Failed to parse brand data: ${member}`, parseError);
          continue;
        }
      }

      if (!brandFound) {
        throw new Error(
          `Brand "${brandName}" not found in ${config.description}`
        );
      }

      return {
        success: true,
        message: `Successfully updated brand "${brandName}" score to ${newScore} in ${config.description}`,
        brandName,
        newScore,
        queueType,
      };
    } else if (config.type === "list") {
      const allItems = await config.redis.lrange(config.queueKey, 0, -1);

      let brandFound = false;
      let brandMember = null;
      let currentIndex = -1;

      for (let i = 0; i < allItems.length; i++) {
        const member = allItems[i];

        try {
          const brandData = JSON.parse(member);
          if (brandData.id && brandData.page_id) {
            const brand = await Brand.findOne({ where: { id: brandData.id } });

            if (brand) {
              const normalizedSearchName = brandName.toLowerCase().replace(/\s+/g, '');
              
              const normalizedBrandName = brand.name ? brand.name.toLowerCase().replace(/\s+/g, '') : '';
              const normalizedActualName = brand.actual_name ? brand.actual_name.toLowerCase().replace(/\s+/g, '') : '';
              
              const pageIdMatch = brand.page_id && brand.page_id.toString() === brandName;
              
              const brandIdMatch = brand.id && brand.id.toString() === brandName;
              
              if (normalizedBrandName === normalizedSearchName || 
                  normalizedActualName === normalizedSearchName ||
                  pageIdMatch || 
                  brandIdMatch) {
                brandMember = member;
                currentIndex = i;
                brandFound = true;
                break;
              }
            }
          }
        } catch (parseError) {
          logger.warn(`Failed to parse brand data: ${member}`, parseError);
          continue;
        }
      }

      if (!brandFound) {
        throw new Error(
          `Brand "${brandName}" not found in ${config.description}`
        );
      }

      const newPosition = parseInt(newScore);
      if (isNaN(newPosition) || newPosition < 1) {
        throw new Error("Position must be a valid number starting from 1");
      }

      const newIndex = newPosition - 1;

      if (newIndex >= allItems.length) {
        throw new Error(
          `Position ${newPosition} is out of range. Queue has ${allItems.length} items`
        );
      }

      if (currentIndex === newIndex) {
        return {
          success: true,
          message: `Brand "${brandName}" is already at position ${newPosition} in ${config.description}`,
          brandName,
          newPosition,
          queueType,
        };
      }

      await config.redis.lrem(config.queueKey, 1, brandMember);

      if (newIndex === 0) {
        await config.redis.lpush(config.queueKey, brandMember);
      } else {
        const updatedItems = await config.redis.lrange(config.queueKey, 0, -1);
        if (newIndex - 1 < updatedItems.length) {
          await config.redis.linsert(
            config.queueKey,
            "AFTER",
            updatedItems[newIndex - 1],
            brandMember
          );
        } else {
          await config.redis.rpush(config.queueKey, brandMember);
        }
      }

      return {
        success: true,
        message: `Successfully moved brand "${brandName}" to position ${newPosition} in ${config.description}`,
        brandName,
        newPosition,
        queueType,
      };
    }
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
  moveWatchlistFailedToPending: queueMoveService.moveWatchlistFailedToPending,
  moveWatchlistToPending: queueMoveService.moveWatchlistToPending,
  moveIndividualWatchlistFailedToPending: queueMoveService.moveIndividualWatchlistFailedToPending,
  clearWatchlistPendingQueue: queueClearService.clearWatchlistPendingQueue,
  clearWatchlistFailedQueue: queueClearService.clearWatchlistFailedQueue,
  moveAllWatchlistPendingToFailed: queueMoveService.moveAllWatchlistPendingToFailed,
  moveAllWatchlistFailedToPending: queueMoveService.moveAllWatchlistFailedToPending,
  cleanupWatchlistFailedQueue: queueMoveService.cleanupWatchlistFailedQueue,
};
