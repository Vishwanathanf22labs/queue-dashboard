const redis = require("../config/redis");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

async function movePendingToFailed(queueId) {
  try {
    logger.info(
      `Moving brand with queue ID ${queueId} from pending to failed queue`
    );

    const pendingBrands = await redis.lrange(QUEUES.PENDING_BRANDS, 0, -1);

    let brandToMove = null;
    let brandIndex = -1;

    for (let i = 0; i < pendingBrands.length; i++) {
      try {
        const brandData = JSON.parse(pendingBrands[i]);
        if (brandData.id === queueId) {
          brandToMove = brandData;
          brandIndex = i;
          break;
        }
      } catch (parseError) {
        logger.error(`Error parsing brand data at index ${i}:`, parseError);
      }
    }

    if (brandIndex === -1) {
      throw new Error(
        `Brand with queue ID ${queueId} not found in pending queue`
      );
    }

    await redis.lrem(QUEUES.PENDING_BRANDS, 1, pendingBrands[brandIndex]);

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

    await redis.rpush(QUEUES.PENDING_BRANDS, JSON.stringify(pendingBrandData));

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

    const pendingBrands = await redis.lrange(QUEUES.PENDING_BRANDS, 0, -1);

    if (pendingBrands.length === 0) {
      return {
        moved_count: 0,
        message: "No pending brands to move",
      };
    }

    const movedBrands = [];
    const pipeline = redis.pipeline();

    for (const pendingBrand of pendingBrands) {
      try {
        const brandData = JSON.parse(pendingBrand);

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

        pipeline.rpush(QUEUES.PENDING_BRANDS, JSON.stringify(pendingBrandData));
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

module.exports = {
  movePendingToFailed,
  moveFailedToPending,
  moveAllPendingToFailed,
  moveAllFailedToPending,
};
