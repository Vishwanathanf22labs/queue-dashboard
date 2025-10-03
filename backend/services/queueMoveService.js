const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

// Function to get dynamic Redis keys
function getRedisKeys() {
  return require("../config/constants").REDIS_KEYS;
}

async function movePendingToFailed(queueId, queueType = "regular") {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    logger.info(
      `Moving brand with queue ID ${queueId} from ${queueType} pending to failed queue`
    );

    const redis = getQueueRedis(queueType);
    const pendingQueueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;
    const failedQueueKey = REDIS_KEYS[queueType.toUpperCase()].FAILED_BRANDS;

    // Get all pending brands with scores from sorted set
    const pendingBrands = await redis.zrange(
      pendingQueueKey,
      0,
      -1,
      "WITHSCORES"
    );

    let brandToMove = null;
    let brandMember = null;

    // pendingBrands is [member1, score1, member2, score2, ...]
    for (let i = 0; i < pendingBrands.length; i += 2) {
      try {
        const member = pendingBrands[i];
        const score = pendingBrands[i + 1];

        if (!member) continue;

        const brandData = JSON.parse(member);
        if (brandData.id === queueId) {
          brandToMove = brandData;
          brandMember = member;
          break;
        }
      } catch (parseError) {
        logger.error(`Error parsing brand data:`, parseError);
      }
    }

    if (!brandMember) {
      throw new Error(
        `Brand with queue ID ${queueId} not found in ${queueType} pending queue`
      );
    }

    // Remove from pending sorted set
    await redis.zrem(pendingQueueKey, brandMember);

    const failedBrandData = {
      id: brandToMove.id || brandToMove.brand_id || brandToMove.queue_id,
      page_id: brandToMove.page_id,
    };

    await redis.lpush(failedQueueKey, JSON.stringify(failedBrandData));

    logger.info(
      `Successfully moved brand ${
        brandToMove?.brand_name || queueId
      } from ${queueType} pending to failed queue`
    );

    return {
      moved_brand: failedBrandData,
      queue_id: queueId,
      queue_type: queueType,
      message: `Brand moved from ${queueType} pending to failed queue successfully`,
    };
  } catch (error) {
    logger.error(`Error moving brand from pending to failed queue:`, error);
    throw error;
  }
}

async function moveFailedToPending(brandId, queueType = "regular") {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    logger.info(
      `Moving brand with ID ${brandId} from ${queueType} failed to pending queue`
    );

    const redis = getQueueRedis(queueType);
    const pendingQueueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;
    const failedQueueKey = REDIS_KEYS[queueType.toUpperCase()].FAILED_BRANDS;
    const failedBrands = await redis.lrange(failedQueueKey, 0, -1);

    let brandToMove = null;
    let brandIndex = -1;

    for (let i = 0; i < failedBrands.length; i++) {
      try {
        const brandData = JSON.parse(failedBrands[i]);
        if (
          brandData.id === brandId ||
          brandData.brand_id === brandId ||
          brandData.queue_id === brandId
        ) {
          brandToMove = brandData;
          brandIndex = i;
          break;
        }
      } catch (parseError) {
        logger.error(
          `Error parsing failed brand data at index ${i}:`,
          parseError
        );
      }
    }

    if (brandIndex === -1) {
      throw new Error(
        `Brand with ID ${brandId} not found in ${queueType} failed queue`
      );
    }

    await redis.lrem(failedQueueKey, 1, failedBrands[brandIndex]);

    const pendingBrandData = {
      id: brandToMove.id || brandToMove.brand_id || brandToMove.queue_id,
      page_id: brandToMove.page_id,
    };

    // Add to pending sorted set with default score 3
    const defaultScore = 3;
    await redis.zadd(
      pendingQueueKey,
      defaultScore,
      JSON.stringify(pendingBrandData)
    );

    logger.info(
      `Successfully moved brand ${
        brandToMove?.brand_name || brandId
      } from ${queueType} failed to pending queue`
    );

    return {
      moved_brand: pendingBrandData,
      brand_id: brandId,
      queue_type: queueType,
      message: `Brand moved from ${queueType} failed to pending queue successfully`,
    };
  } catch (error) {
    logger.error(`Error moving brand from failed to pending queue:`, error);
    throw error;
  }
}

async function moveAllPendingToFailed() {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    logger.info("Moving ALL regular pending brands to failed queue");

    // Get only regular Redis instance
    const regularRedis = getQueueRedis("regular");

    // Get pending brands from regular queue only
    const regularPendingBrands = await regularRedis.zrange(
      REDIS_KEYS.REGULAR.PENDING_BRANDS,
      0,
      -1,
      "WITHSCORES"
    );

    const totalPendingCount = regularPendingBrands.length / 2;

    if (totalPendingCount === 0) {
      return {
        moved_count: 0,
        message: "No regular pending brands to move",
      };
    }

    const movedBrands = [];
    const regularPipeline = regularRedis.pipeline();

    // Process regular pending brands
    for (let i = 0; i < regularPendingBrands.length; i += 2) {
      try {
        const member = regularPendingBrands[i];
        const score = regularPendingBrands[i + 1];

        if (!member) continue;

        const brandData = JSON.parse(member);

        const failedBrandData = {
          id: brandData.id || brandData.brand_id || brandData.queue_id,
          page_id: brandData.page_id,
        };

        regularPipeline.lpush(
          REDIS_KEYS.REGULAR.FAILED_BRANDS,
          JSON.stringify(failedBrandData)
        );
        movedBrands.push({ ...failedBrandData, queueType: "regular" });
      } catch (parseError) {
        logger.error(`Error parsing regular pending brand data:`, parseError);
      }
    }

    // Clear regular pending queue
    regularPipeline.del(REDIS_KEYS.REGULAR.PENDING_BRANDS);

    // Execute regular pipeline only
    await regularPipeline.exec();

    logger.info(
      `Successfully moved ${movedBrands.length} regular brands from pending to failed queue`
    );

    return {
      moved_count: movedBrands.length,
      moved_brands: movedBrands,
      message: `Moved ${movedBrands.length} regular brands from pending to failed queue successfully`,
    };
  } catch (error) {
    logger.error("Error moving all pending brands to failed queue:", error);
    throw error;
  }
}

async function moveAllFailedToPending() {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    logger.info("Moving ALL regular failed brands to pending queue");

    // Get only regular Redis instance
    const regularRedis = getQueueRedis("regular");

    // Get failed brands from regular queue only
    const regularFailedBrands = await regularRedis.lrange(REDIS_KEYS.REGULAR.FAILED_BRANDS, 0, -1);

    const totalFailedCount = regularFailedBrands.length;

    if (totalFailedCount === 0) {
      return {
        moved_count: 0,
        message: "No regular failed brands to move",
      };
    }

    const movedBrands = [];
    const regularPipeline = regularRedis.pipeline();

    // Process regular failed brands
    for (const failedBrand of regularFailedBrands) {
      try {
        const brandData = JSON.parse(failedBrand);

        const pendingBrandData = {
          id: brandData.id || brandData.brand_id || brandData.queue_id,
          page_id: brandData.page_id,
        };

        // Add to pending sorted set with default score 3
        const defaultScore = 3;
        regularPipeline.zadd(
          REDIS_KEYS.REGULAR.PENDING_BRANDS,
          defaultScore,
          JSON.stringify(pendingBrandData)
        );
        movedBrands.push({ ...pendingBrandData, queueType: "regular" });
      } catch (parseError) {
        logger.error(`Error parsing regular failed brand data:`, parseError);
      }
    }

    // Clear regular failed queue
    regularPipeline.del(REDIS_KEYS.REGULAR.FAILED_BRANDS);

    // Execute regular pipeline only
    await regularPipeline.exec();

    logger.info(
      `Successfully moved ${movedBrands.length} regular brands from failed to pending queue`
    );

    return {
      moved_count: movedBrands.length,
      moved_brands: movedBrands,
      message: `Moved ${movedBrands.length} regular brands from failed to pending queue successfully`,
    };
  } catch (error) {
    logger.error("Error moving all failed brands to pending queue:", error);
    throw error;
  }
}

// NEW FUNCTION: Move only watchlist failed brands to pending queue
async function moveWatchlistFailedToPending() {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    logger.info("Moving watchlist failed brands to pending queue");

    // Get watchlist Redis instance
    const watchlistRedis = getQueueRedis("watchlist");

    // Get all failed brands from Redis
    const failedBrands = await watchlistRedis.lrange(
      REDIS_KEYS.WATCHLIST.FAILED_BRANDS,
      0,
      -1
    );

    if (failedBrands.length === 0) {
      return {
        moved_count: 0,
        message: "No failed brands to move",
      };
    }

    // Get watchlist brands to identify which failed brands are in watchlist
    const { Brand, WatchList } = require("../models");

    // First get all watchlist brand_ids
    const watchlistItems = await WatchList.findAll({
      attributes: ["brand_id"],
      raw: true,
    });

    if (watchlistItems.length === 0) {
      return {
        moved_count: 0,
        message: "No watchlist brands found in database",
      };
    }

    // Get the brand details for watchlist brands
    const watchlistBrandIds = watchlistItems.map((item) => item.brand_id);
    const watchlistBrands = await Brand.findAll({
      where: {
        id: watchlistBrandIds,
      },
      attributes: ["id", "page_id", "actual_name"],
      raw: true,
    });

    // Create a set of watchlist page_ids for fast lookup
    const watchlistPageIds = new Set(
      watchlistBrands.map((brand) => brand.page_id)
    );

    // Filter failed brands to only include watchlist brands
    const watchlistFailedBrands = [];
    const pipeline = watchlistRedis.pipeline();
    let movedCount = 0;

    for (const failedBrand of failedBrands) {
      try {
        const brandData = JSON.parse(failedBrand);
        const pageId = brandData.page_id;

        // Only move if this failed brand is in the watchlist
        if (watchlistPageIds.has(pageId)) {
          const pendingBrandData = {
            id: brandData.id || brandData.brand_id || brandData.queue_id,
            page_id: pageId,
          };

          // Add to watchlist pending sorted set with default score 3
          const defaultScore = 3;
          pipeline.zadd(
            REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
            defaultScore,
            JSON.stringify(pendingBrandData)
          );
          watchlistFailedBrands.push(pendingBrandData);
          movedCount++;
        }
      } catch (parseError) {
        logger.error(`Error parsing failed brand data:`, parseError);
      }
    }

    if (movedCount === 0) {
      return {
        moved_count: 0,
        message: "No watchlist brands found in failed queue",
      };
    }

    // Remove the moved brands from failed queue
    for (const failedBrand of failedBrands) {
      try {
        const brandData = JSON.parse(failedBrand);
        const pageId = brandData.page_id;

        if (watchlistPageIds.has(pageId)) {
          pipeline.lrem(REDIS_KEYS.WATCHLIST.FAILED_BRANDS, 0, failedBrand);
        }
      } catch (parseError) {
        logger.error(
          `Error parsing failed brand data for removal:`,
          parseError
        );
      }
    }

    await pipeline.exec();

    logger.info(
      `Successfully moved ${movedCount} watchlist failed brands to pending queue`
    );

    return {
      moved_count: movedCount,
      moved_brands: watchlistFailedBrands,
      message: `Moved ${movedCount} watchlist failed brands to pending queue successfully`,
    };
  } catch (error) {
    logger.error(
      "Error moving watchlist failed brands to pending queue:",
      error
    );
    throw error;
  }
}

// NEW FUNCTION: Move all watchlist brands from database to pending queue with score 1
async function moveWatchlistToPending() {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    logger.info(
      "Moving all watchlist brands from database to pending queue with score 1"
    );

    // Get all watchlist brands from database
    const { Brand, WatchList } = require("../models");

    const watchlistItems = await WatchList.findAll({
      attributes: ["brand_id"],
      raw: true,
    });

    if (watchlistItems.length === 0) {
      return {
        moved_count: 0,
        message: "No watchlist brands found in database",
      };
    }

    // Get the brand details for watchlist brands
    const watchlistBrandIds = watchlistItems.map((item) => item.brand_id);
    const watchlistBrands = await Brand.findAll({
      where: {
        id: watchlistBrandIds,
      },
      attributes: ["id", "page_id", "actual_name"],
      raw: true,
    });

    if (watchlistBrands.length === 0) {
      return {
        moved_count: 0,
        message: "No watchlist brands found with valid details",
      };
    }

    // Get watchlist Redis instance
    const watchlistRedis = getQueueRedis("watchlist");

    // Get existing pending brands to avoid duplicates
    const existingPendingItems = await watchlistRedis.zrange(
      REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
      0,
      -1
    );
    const existingPageIds = new Set();

    for (const pendingItem of existingPendingItems) {
      try {
        const pendingData = JSON.parse(pendingItem);
        existingPageIds.add(pendingData.page_id);
      } catch (parseError) {
        logger.error(`Error parsing existing pending brand data:`, parseError);
      }
    }

    // Filter out brands that are already in pending queue
    const brandsToAdd = watchlistBrands.filter(
      (brand) => !existingPageIds.has(brand.page_id)
    );

    if (brandsToAdd.length === 0) {
      return {
        moved_count: 0,
        message: "All watchlist brands are already in watchlist pending queue",
      };
    }

    // Add brands to watchlist pending queue with score 1 (priority)
    const pipeline = watchlistRedis.pipeline();
    const addedBrands = [];

    for (const brand of brandsToAdd) {
      const pendingBrandData = {
        id: brand.id,
        page_id: brand.page_id,
      };

      // Add to watchlist pending sorted set with score 1 (priority)
      pipeline.zadd(
        REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
        1,
        JSON.stringify(pendingBrandData)
      );
      addedBrands.push(pendingBrandData);
    }

    await pipeline.exec();

    logger.info(
      `Successfully added ${addedBrands.length} watchlist brands to watchlist pending queue with score 1`
    );

    return {
      moved_count: addedBrands.length,
      moved_brands: addedBrands,
      message: `Successfully added ${addedBrands.length} watchlist brands to watchlist pending queue with priority score 1`,
    };
  } catch (error) {
    logger.error("Error moving watchlist brands to pending queue:", error);
    throw error;
  }
}

// NEW FUNCTION: Move individual watchlist failed brand to pending queue
async function moveIndividualWatchlistFailedToPending(brandIdentifier) {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    logger.info(
      `Moving individual watchlist failed brand ${brandIdentifier} to watchlist pending queue`
    );

    // Get watchlist Redis instance
    const watchlistRedis = getQueueRedis("watchlist");

    // Get all failed brands from Redis
    const failedBrands = await watchlistRedis.lrange(
      REDIS_KEYS.WATCHLIST.FAILED_BRANDS,
      0,
      -1
    );

    if (failedBrands.length === 0) {
      throw new Error("No failed brands found in watchlist failed queue");
    }

    let brandToMove = null;
    let brandIndex = -1;

    // Find the specific brand to move
    for (let i = 0; i < failedBrands.length; i++) {
      try {
        const brandData = JSON.parse(failedBrands[i]);
        if (
          brandData.id === brandIdentifier ||
          brandData.brand_id === brandIdentifier ||
          brandData.page_id === brandIdentifier
        ) {
          brandToMove = brandData;
          brandIndex = i;
          break;
        }
      } catch (parseError) {
        logger.error(
          `Error parsing failed brand data at index ${i}:`,
          parseError
        );
      }
    }

    if (brandIndex === -1) {
      throw new Error(
        `Brand with identifier ${brandIdentifier} not found in watchlist failed queue`
      );
    }

    // Remove from failed queue
    await watchlistRedis.lrem(
      REDIS_KEYS.WATCHLIST.FAILED_BRANDS,
      1,
      failedBrands[brandIndex]
    );

    // Add to watchlist pending queue with default score 3
    const pendingBrandData = {
      id: brandToMove.id || brandToMove.brand_id || brandToMove.queue_id,
      page_id: brandToMove.page_id,
    };

    const defaultScore = 3;
    await watchlistRedis.zadd(
      REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
      defaultScore,
      JSON.stringify(pendingBrandData)
    );

    logger.info(
      `Successfully moved brand ${brandToMove.page_id} from watchlist failed to watchlist pending queue`
    );

    return {
      moved_brand: pendingBrandData,
      brand_identifier: brandIdentifier,
      message:
        "Brand moved from watchlist failed to watchlist pending queue successfully",
    };
  } catch (error) {
    logger.error(
      "Error moving individual watchlist failed brand to pending queue:",
      error
    );
    throw error;
  }
}

async function moveAllWatchlistPendingToFailed() {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    logger.info("Moving ALL watchlist pending brands to failed queue");

    const watchlistRedis = getQueueRedis("watchlist");

    // Get all pending brands from watchlist queue
    const watchlistPendingBrands = await watchlistRedis.zrange(
      REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
      0,
      -1,
      "WITHSCORES"
    );

    const totalPendingCount = watchlistPendingBrands.length / 2;

    if (totalPendingCount === 0) {
      return {
        moved_count: 0,
        message: "No watchlist pending brands to move",
      };
    }

    const movedBrands = [];
    const pipeline = watchlistRedis.pipeline();

    // Process watchlist pending brands
    for (let i = 0; i < watchlistPendingBrands.length; i += 2) {
      try {
        const member = watchlistPendingBrands[i];
        const score = watchlistPendingBrands[i + 1];

        if (!member) continue;

        const brandData = JSON.parse(member);

        const failedBrandData = {
          id: brandData.id || brandData.brand_id || brandData.queue_id,
          page_id: brandData.page_id,
        };

        pipeline.lpush(
          REDIS_KEYS.WATCHLIST.FAILED_BRANDS,
          JSON.stringify(failedBrandData)
        );
        movedBrands.push({ ...failedBrandData, queueType: "watchlist" });
      } catch (parseError) {
        logger.error(`Error parsing watchlist pending brand data:`, parseError);
      }
    }

    // Clear watchlist pending queue
    pipeline.del(REDIS_KEYS.WATCHLIST.PENDING_BRANDS);

    // Execute pipeline
    await pipeline.exec();

    logger.info(
      `Successfully moved ${movedBrands.length} watchlist brands from pending to failed queue`
    );

    return {
      moved_count: movedBrands.length,
      moved_brands: movedBrands,
      message: `Moved ${movedBrands.length} watchlist brands from pending to failed queue successfully`,
    };
  } catch (error) {
    logger.error("Error moving all watchlist pending brands to failed queue:", error);
    throw error;
  }
}

async function moveAllWatchlistFailedToPending() {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    logger.info("Moving ALL watchlist failed brands to pending queue");

    const watchlistRedis = getQueueRedis("watchlist");

    // Get all failed brands from watchlist queue
    const watchlistFailedBrands = await watchlistRedis.lrange(
      REDIS_KEYS.WATCHLIST.FAILED_BRANDS,
      0,
      -1
    );

    if (watchlistFailedBrands.length === 0) {
      return {
        moved_count: 0,
        message: "No watchlist failed brands to move",
      };
    }

    const movedBrands = [];
    const pipeline = watchlistRedis.pipeline();

    // Process watchlist failed brands
    for (const failedBrand of watchlistFailedBrands) {
      try {
        const brandData = JSON.parse(failedBrand);

        const pendingBrandData = {
          id: brandData.id || brandData.brand_id || brandData.queue_id,
          page_id: brandData.page_id,
        };

        // Add to pending sorted set with default score 3
        const defaultScore = 3;
        pipeline.zadd(
          REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
          defaultScore,
          JSON.stringify(pendingBrandData)
        );
        movedBrands.push({ ...pendingBrandData, queueType: "watchlist" });
      } catch (parseError) {
        logger.error(`Error parsing watchlist failed brand data:`, parseError);
      }
    }

    // Clear watchlist failed queue
    pipeline.del(REDIS_KEYS.WATCHLIST.FAILED_BRANDS);

    // Execute pipeline
    await pipeline.exec();

    logger.info(
      `Successfully moved ${movedBrands.length} watchlist brands from failed to pending queue`
    );

    return {
      moved_count: movedBrands.length,
      moved_brands: movedBrands,
      message: `Moved ${movedBrands.length} watchlist brands from failed to pending queue successfully`,
    };
  } catch (error) {
    logger.error("Error moving all watchlist failed brands to pending queue:", error);
    throw error;
  }
}

module.exports = {
  movePendingToFailed,
  moveFailedToPending,
  moveAllPendingToFailed,
  moveAllFailedToPending,
  moveWatchlistFailedToPending,
  moveWatchlistToPending,
  moveIndividualWatchlistFailedToPending,
  moveAllWatchlistPendingToFailed,
  moveAllWatchlistFailedToPending,
};
