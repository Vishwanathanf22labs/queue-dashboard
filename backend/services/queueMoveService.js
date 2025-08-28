const redis = require("../config/redis");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

async function movePendingToFailed(queueId) {
  try {
    logger.info(
      `Moving brand with queue ID ${queueId} from pending to failed queue`
    );

    // Get all pending brands with scores from sorted set
    const pendingBrands = await redis.zrange(QUEUES.PENDING_BRANDS, 0, -1, 'WITHSCORES');

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
        `Brand with queue ID ${queueId} not found in pending queue`
      );
    }

    // Remove from pending sorted set
    await redis.zrem(QUEUES.PENDING_BRANDS, brandMember);

    const failedBrandData = {
      id: brandToMove.id || brandToMove.brand_id || brandToMove.queue_id,
      page_id: brandToMove.page_id
    };

    await redis.lpush(QUEUES.FAILED_BRANDS, JSON.stringify(failedBrandData));

    logger.info(
      `Successfully moved brand ${
        brandToMove?.brand_name || queueId
      } from pending to failed queue`
    );

    return {
      moved_brand: failedBrandData,
      queue_id: queueId,
      message: "Brand moved from pending to failed queue successfully",
    };
  } catch (error) {
    logger.error(`Error moving brand from pending to failed queue:`, error);
    throw error;
  }
}

async function moveFailedToPending(brandId) {
  try {
    logger.info(`Moving brand with ID ${brandId} from failed to pending queue`);

    const failedBrands = await redis.lrange(QUEUES.FAILED_BRANDS, 0, -1);

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
      throw new Error(`Brand with ID ${brandId} not found in failed queue`);
    }

    await redis.lrem(QUEUES.FAILED_BRANDS, 1, failedBrands[brandIndex]);

    const pendingBrandData = {
      id: brandToMove.id || brandToMove.brand_id || brandToMove.queue_id,
      page_id: brandToMove.page_id
    };

    // Add to pending sorted set with default score 3
    const defaultScore = 3;
    await redis.zadd(QUEUES.PENDING_BRANDS, defaultScore, JSON.stringify(pendingBrandData));

    logger.info(
      `Successfully moved brand ${
        brandToMove?.brand_name || brandId
      } from failed to pending queue`
    );

    return {
      moved_brand: pendingBrandData,
      brand_id: brandId,
      message: "Brand moved from failed to pending queue successfully",
    };
  } catch (error) {
    logger.error(`Error moving brand from failed to pending queue:`, error);
    throw error;
  }
}

async function moveAllPendingToFailed() {
  try {
    logger.info("Moving ALL pending brands to failed queue");

    const pendingBrands = await redis.zrange(QUEUES.PENDING_BRANDS, 0, -1, 'WITHSCORES');

    if (pendingBrands.length === 0) {
      return {
        moved_count: 0,
        message: "No pending brands to move",
      };
    }

    const movedBrands = [];
    const pipeline = redis.pipeline();

    // pendingBrands is [member1, score1, member2, score2, ...]
    for (let i = 0; i < pendingBrands.length; i += 2) {
      try {
        const member = pendingBrands[i];
        const score = pendingBrands[i + 1];
        
        if (!member) continue;
        
        const brandData = JSON.parse(member);

        const failedBrandData = {
          id: brandData.id || brandData.brand_id || brandData.queue_id,
          page_id: brandData.page_id
        };

        pipeline.lpush(QUEUES.FAILED_BRANDS, JSON.stringify(failedBrandData));
        movedBrands.push(failedBrandData);
      } catch (parseError) {
        logger.error(`Error parsing pending brand data:`, parseError);
      }
    }

    pipeline.del(QUEUES.PENDING_BRANDS);

    await pipeline.exec();

    logger.info(
      `Successfully moved ${movedBrands.length} brands from pending to failed queue`
    );

    return {
      moved_count: movedBrands.length,
      moved_brands: movedBrands,
      message: `Moved ${movedBrands.length} brands from pending to failed queue successfully`,
    };
  } catch (error) {
    logger.error("Error moving all pending brands to failed queue:", error);
    throw error;
  }
}

async function moveAllFailedToPending() {
  try {
    logger.info("Moving ALL failed brands to pending queue");

    const failedBrands = await redis.lrange(QUEUES.FAILED_BRANDS, 0, -1);

    if (failedBrands.length === 0) {
      return {
        moved_count: 0,
        message: "No failed brands to move",
      };
    }

    const movedBrands = [];
    const pipeline = redis.pipeline();

    for (const failedBrand of failedBrands) {
      try {
        const brandData = JSON.parse(failedBrand);

        const pendingBrandData = {
          id: brandData.id || brandData.brand_id || brandData.queue_id,
          page_id: brandData.page_id
        };

        // Add to pending sorted set with default score 3
        const defaultScore = 3;
        pipeline.zadd(QUEUES.PENDING_BRANDS, defaultScore, JSON.stringify(pendingBrandData));
        movedBrands.push(pendingBrandData);
      } catch (parseError) {
        logger.error(`Error parsing failed brand data:`, parseError);
      }
    }

    pipeline.del(QUEUES.FAILED_BRANDS);

    await pipeline.exec();

    logger.info(
      `Successfully moved ${movedBrands.length} brands from failed to pending queue`
    );

    return {
      moved_count: movedBrands.length,
      moved_brands: movedBrands,
      message: `Moved ${movedBrands.length} brands from failed to pending queue successfully`,
    };
  } catch (error) {
    logger.error("Error moving all failed brands to pending queue:", error);
    throw error;
  }
}

// NEW FUNCTION: Move only watchlist failed brands to pending queue
async function moveWatchlistFailedToPending() {
  try {
    logger.info("Moving watchlist failed brands to pending queue");

    // Get all failed brands from Redis
    const failedBrands = await redis.lrange(QUEUES.FAILED_BRANDS, 0, -1);

    if (failedBrands.length === 0) {
      return {
        moved_count: 0,
        message: "No failed brands to move",
      };
    }

    // Get watchlist brands to identify which failed brands are in watchlist
    const WatchList = require('../models/WatchList');
    const Brand = require('../models/Brand');
    
    // First get all watchlist brand_ids
    const watchlistItems = await WatchList.findAll({
      attributes: ['brand_id'],
      raw: true
    });
    
    if (watchlistItems.length === 0) {
      return {
        moved_count: 0,
        message: "No watchlist brands found in database",
      };
    }
    
    // Get the brand details for watchlist brands
    const watchlistBrandIds = watchlistItems.map(item => item.brand_id);
    const watchlistBrands = await Brand.findAll({
      where: {
        id: watchlistBrandIds
      },
      attributes: ['id', 'page_id', 'actual_name'],
      raw: true
    });

    // Create a set of watchlist page_ids for fast lookup
    const watchlistPageIds = new Set(watchlistBrands.map(brand => brand.page_id));

    // Filter failed brands to only include watchlist brands
    const watchlistFailedBrands = [];
    const pipeline = redis.pipeline();
    let movedCount = 0;

    for (const failedBrand of failedBrands) {
      try {
        const brandData = JSON.parse(failedBrand);
        const pageId = brandData.page_id;

        // Only move if this failed brand is in the watchlist
        if (watchlistPageIds.has(pageId)) {
          const pendingBrandData = {
            id: brandData.id || brandData.brand_id || brandData.queue_id,
            page_id: pageId
          };

          // Add to pending sorted set with default score 3
          const defaultScore = 3;
          pipeline.zadd(QUEUES.PENDING_BRANDS, defaultScore, JSON.stringify(pendingBrandData));
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
          pipeline.lrem(QUEUES.FAILED_BRANDS, 0, failedBrand);
        }
      } catch (parseError) {
        logger.error(`Error parsing failed brand data for removal:`, parseError);
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
    logger.error("Error moving watchlist failed brands to pending queue:", error);
    throw error;
  }
}

module.exports = {
  movePendingToFailed,
  moveFailedToPending,
  moveAllPendingToFailed,
  moveAllFailedToPending,
  moveWatchlistFailedToPending,
};
