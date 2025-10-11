const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { QUEUES, REDIS_KEYS } = require("../config/constants");

async function removePendingBrand(brandId, queueType = 'regular', environment = 'production') {
  try {
    logger.info(`Removing brand with ID ${brandId} from ${queueType} pending queue`);

    const REDIS_KEYS = require("../config/constants").getRedisKeys(environment);
    const redis = getQueueRedis(queueType, environment);
    const queueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;
    const pendingBrands = await redis.zrange(queueKey, 0, -1, 'WITHSCORES');

    let brandToRemove = null;
    let brandMember = null;

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
      throw new Error(`Brand with ID ${brandId} not found in ${queueType} pending queue`);
    }

    await redis.zrem(queueKey, brandMember);

    logger.info(
      `Successfully removed brand ${brandToRemove?.brand_name || brandId
      } from ${queueType} pending queue`
    );

    return {
      removed_brand: brandToRemove,
      brand_id: brandId,
      queue_type: queueType,
      message: `Brand removed from ${queueType} pending queue successfully`,
    };
  } catch (error) {
    logger.error(`Error removing brand from pending queue:`, error);
    throw error;
  }
}

async function removeFailedBrand(brandId, queueType = 'regular', environment = 'production') {
  try {
    logger.info(`Removing brand with ID ${brandId} from ${queueType} failed queue`);

    const REDIS_KEYS = require("../config/constants").getRedisKeys(environment);
    const redis = getQueueRedis(queueType, environment);
    const queueKey = REDIS_KEYS[queueType.toUpperCase()].FAILED_BRANDS;
    const failedBrands = await redis.lrange(queueKey, 0, -1);

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
      throw new Error(`Brand with ID ${brandId} not found in ${queueType} failed queue`);
    }

    await redis.lrem(queueKey, 1, failedBrands[brandIndex]);

    logger.info(
      `Successfully removed brand ${brandToRemove?.brand_name || brandId
      } from ${queueType} failed queue`
    );

    return {
      removed_brand: brandToRemove,
      brand_id: brandId,
      queue_type: queueType,
      message: `Brand removed from ${queueType} failed queue successfully`,
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
