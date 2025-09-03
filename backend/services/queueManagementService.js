const queueClearService = require("./queueClearService");
const queueMoveService = require("./queueMoveService");
const queueRemoveService = require("./queueRemoveService");
const redis = require("../config/redis");
const { QUEUES } = require("../config/constants");
const logger = require("../utils/logger");
const Brand = require("../models/Brand");

async function getQueueStats() {
  try {
    const pendingCount = await redis.zcard(QUEUES.PENDING_BRANDS);
    const failedCount = await redis.llen(QUEUES.FAILED_BRANDS);
    const watchlistPendingCount = await redis.zcard(QUEUES.WATCHLIST_PENDING);
    const watchlistFailedCount = await redis.llen(QUEUES.WATCHLIST_FAILED);

    return {
      pending_count: pendingCount,
      failed_count: failedCount,
      watchlist_pending_count: watchlistPendingCount,
      watchlist_failed_count: watchlistFailedCount,
      total_count:
        pendingCount +
        failedCount +
        watchlistPendingCount +
        watchlistFailedCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error getting queue stats:", error);
    throw error;
  }
}

async function changeBrandScore(queueType, brandName, newScore) {
  try {
    // Define queue configurations
    const queueConfigs = {
      pending: {
        queueKey: QUEUES.PENDING_BRANDS,
        type: "sortedSet",
        description: "pending queue",
      },
      failed: {
        queueKey: QUEUES.FAILED_BRANDS,
        type: "list",
        description: "failed queue",
      },
      watchlist_pending: {
        queueKey: QUEUES.WATCHLIST_PENDING,
        type: "sortedSet",
        description: "watchlist pending queue",
      },
      watchlist_failed: {
        queueKey: QUEUES.WATCHLIST_FAILED,
        type: "list",
        description: "watchlist failed queue",
      },
    };

    const config = queueConfigs[queueType];
    if (!config) {
      throw new Error(`Invalid queue type: ${queueType}`);
    }

    if (config.type === "sortedSet") {
      // Handle sorted set queues (pending and watchlist_pending)
      const allItems = await redis.zrange(config.queueKey, 0, -1, "WITHSCORES");

      let brandFound = false;
      for (let i = 0; i < allItems.length; i += 2) {
        const member = allItems[i];
        const score = allItems[i + 1];

        try {
          const brandData = JSON.parse(member);
          if (brandData.id && brandData.page_id) {
            const brand = await Brand.findOne({ where: { id: brandData.id } });

            if (brand && brand.name.toLowerCase() === brandName.toLowerCase()) {
              // Remove the old entry and add with new score
              await redis.zrem(config.queueKey, member);
              await redis.zadd(config.queueKey, newScore, member);
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
      // Handle list queues (failed and watchlist_failed)
      const allItems = await redis.lrange(config.queueKey, 0, -1);

      let brandFound = false;
      let brandMember = null;
      let currentIndex = -1;

      for (let i = 0; i < allItems.length; i++) {
        const member = allItems[i];

        try {
          const brandData = JSON.parse(member);
          if (brandData.id && brandData.page_id) {
            const brand = await Brand.findOne({ where: { id: brandData.id } });

            if (brand && brand.name.toLowerCase() === brandName.toLowerCase()) {
              brandMember = member;
              currentIndex = i;
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
        throw new Error(
          `Brand "${brandName}" not found in ${config.description}`
        );
      }

      // Parse the new position
      const newPosition = parseInt(newScore);
      if (isNaN(newPosition) || newPosition < 1) {
        throw new Error("Position must be a valid number starting from 1");
      }

      // Convert to 0-based index
      const newIndex = newPosition - 1;

      // Check if position is valid
      if (newIndex >= allItems.length) {
        throw new Error(
          `Position ${newPosition} is out of range. Queue has ${allItems.length} items`
        );
      }

      // If it's the same position, no need to change
      if (currentIndex === newIndex) {
        return {
          success: true,
          message: `Brand "${brandName}" is already at position ${newPosition} in ${config.description}`,
          brandName,
          newPosition,
          queueType,
        };
      }

      // Remove the brand from its current position
      await redis.lrem(config.queueKey, 1, brandMember);

      // Insert the brand at the new position
      if (newIndex === 0) {
        // Insert at the beginning
        await redis.lpush(config.queueKey, brandMember);
      } else {
        // Get the updated items after removal
        const updatedItems = await redis.lrange(config.queueKey, 0, -1);
        if (newIndex - 1 < updatedItems.length) {
          // Insert after the element at newIndex-1
          await redis.linsert(
            config.queueKey,
            "AFTER",
            updatedItems[newIndex - 1],
            brandMember
          );
        } else {
          // Insert at the end
          await redis.rpush(config.queueKey, brandMember);
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
};
