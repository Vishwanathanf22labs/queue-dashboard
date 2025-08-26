const redis = require("../config/redis");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

async function removePendingBrand(brandId) {
  try {
    logger.info(`Removing brand with ID ${brandId} from pending queue`);

    const pendingBrands = await redis.zrange(QUEUES.PENDING_BRANDS, 0, -1, 'WITHSCORES');

    let brandToRemove = null;
    let brandMember = null;

    // pendingBrands is [member1, score1, member2, score2, ...]
    for (let i = 0; i < pendingBrands.length; i += 2) {
      try {
        const member = pendingBrands[i];
        const score = pendingBrands[i + 1];
        
        if (!member) continue;
        
        const brandData = JSON.parse(member);
        if (
          brandData.id === brandId ||
          brandData.brand_id === brandId ||
          brandData.queue_id === brandId
        ) {
          brandToRemove = brandData;
          brandMember = member;
          break;
        }
      } catch (parseError) {
        logger.error(
          `Error parsing pending brand data:`,
          parseError
        );
      }
    }

    if (!brandMember) {
      throw new Error(`Brand with ID ${brandId} not found in pending queue`);
    }

    await redis.zrem(QUEUES.PENDING_BRANDS, brandMember);

    logger.info(
      `Successfully removed brand ${
        brandToRemove?.brand_name || brandId
      } from pending queue`
    );

    return {
      removed_brand: brandToRemove,
      brand_id: brandId,
      message: "Brand removed from pending queue successfully",
    };
  } catch (error) {
    logger.error(`Error removing brand from pending queue:`, error);
    throw error;
  }
}

async function removeFailedBrand(brandId) {
  try {
    logger.info(`Removing brand with ID ${brandId} from failed queue`);

    const failedBrands = await redis.lrange(QUEUES.FAILED_BRANDS, 0, -1);

    let brandToRemove = null;
    let brandIndex = -1;

    for (let i = 0; i < failedBrands.length; i++) {
      try {
        const brandData = JSON.parse(failedBrands[i]);
        if (
          brandData.id === brandId ||
          brandData.brand_id === brandId ||
          brandData.queue_id === brandId
        ) {
          brandToRemove = brandData;
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

    logger.info(
      `Successfully removed brand ${
        brandToRemove?.brand_name || brandId
      } from failed queue`
    );

    return {
      removed_brand: brandToRemove,
      brand_id: brandId,
      message: "Brand removed from failed queue successfully",
    };
  } catch (error) {
    logger.error(`Error removing brand from failed queue:`, error);
    throw error;
  }
}

module.exports = {
  removePendingBrand,
  removeFailedBrand,
};
