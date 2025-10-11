const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");


function getRedisKeys(environment = 'production') {
  return require("../config/constants").getRedisKeys(environment);
}


async function requeueSingleBrand(itemId, namespace, environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const reenqueueKey = REDIS_KEYS.GLOBAL.REENQUEUE_KEY;

    if (!reenqueueKey) {
      throw new Error("REENQUEUE_KEY is not configured");
    }


    const globalRedis = getGlobalRedis(environment);

    const allItems = await globalRedis.lrange(reenqueueKey, 0, -1);

    let itemToRequeue = null;
    let itemIndex = -1;


    for (let i = 0; i < allItems.length; i++) {
      try {
        const parsed = JSON.parse(allItems[i]);
        if (parsed.id?.toString() === itemId.toString() && parsed.namespace === namespace) {
          itemToRequeue = parsed;
          itemIndex = i;
          break;
        }
      } catch (error) {
        logger.error("Error parsing reenqueue item:", error);
      }
    }


    if (!itemToRequeue) {
      throw new Error("Item not found in reenqueue list");
    }


    if (!itemToRequeue.page_id && itemToRequeue.id) {
      try {
        const { Brand } = require("../models");
        const brand = await Brand.findOne({
          where: { id: itemToRequeue.id },
          attributes: ["id", "page_id"],
          raw: true,
        });

        if (brand && brand.page_id) {
          itemToRequeue.page_id = brand.page_id;
        }
      } catch (dbError) {
        logger.error("Error fetching page_id for requeue:", dbError);
      }
    }


    const queueType = namespace === 'watchlist' ? 'watchlist' : 'regular';
    const queueRedis = getQueueRedis(queueType, environment);
    const pendingQueueKey = queueType === 'watchlist'
      ? REDIS_KEYS.WATCHLIST.PENDING_BRANDS
      : REDIS_KEYS.REGULAR.PENDING_BRANDS;


    const queueData = JSON.stringify({
      id: itemToRequeue.id,
      page_id: itemToRequeue.page_id
    });

    await queueRedis.zadd(pendingQueueKey, 100, queueData);

    await globalRedis.lrem(reenqueueKey, 1, allItems[itemIndex]);


    logger.info(`Requeued brand ${itemId} to ${queueType} pending queue with score 100`);


    return {
      success: true,
      message: `Brand requeued successfully to ${queueType} pending queue`,
      queueType
    };
  } catch (error) {
    logger.error("Error requeuing brand:", error);
    throw error;
  }
}


async function requeueAllBrands(namespace, environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const reenqueueKey = REDIS_KEYS.GLOBAL.REENQUEUE_KEY;

    if (!reenqueueKey) {
      throw new Error("REENQUEUE_KEY is not configured");
    }


    const globalRedis = getGlobalRedis(environment);


    const allItems = await globalRedis.lrange(reenqueueKey, 0, -1);

    const queueType = namespace === 'watchlist' ? 'watchlist' : 'regular';
    const queueRedis = getQueueRedis(queueType, environment);
    const pendingQueueKey = queueType === 'watchlist'
      ? REDIS_KEYS.WATCHLIST.PENDING_BRANDS
      : REDIS_KEYS.REGULAR.PENDING_BRANDS;


    let requeuedCount = 0;
    const itemsToRemove = [];


    for (const item of allItems) {
      try {
        const parsed = JSON.parse(item);

        if (parsed.namespace === namespace) {
          let pageId = parsed.page_id;
          if (!pageId && parsed.id) {
            try {
              const { Brand } = require("../models");
              const brand = await Brand.findOne({
                where: { id: parsed.id },
                attributes: ["id", "page_id"],
                raw: true,
              });

              if (brand && brand.page_id) {
                pageId = brand.page_id;
              }
            } catch (dbError) {
              logger.error("Error fetching page_id for requeue all:", dbError);
            }
          }

          const queueData = JSON.stringify({
            id: parsed.id,
            page_id: pageId
          });
          await queueRedis.zadd(pendingQueueKey, 100, queueData);
          itemsToRemove.push(item);
          requeuedCount++;
        }
      } catch (error) {
        logger.error("Error parsing reenqueue item:", error);
      }
    }


    for (const item of itemsToRemove) {
      await globalRedis.lrem(reenqueueKey, 1, item);
    }


    logger.info(`Requeued ${requeuedCount} brands to ${queueType} pending queue with score 100`);


    return {
      success: true,
      message: `${requeuedCount} brands requeued successfully to ${queueType} pending queue`,
      count: requeuedCount,
      queueType
    };
  } catch (error) {
    logger.error("Error requeuing all brands:", error);
    throw error;
  }
}


async function deleteSingleBrand(itemId, namespace, environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const reenqueueKey = REDIS_KEYS.GLOBAL.REENQUEUE_KEY;

    if (!reenqueueKey) {
      throw new Error("REENQUEUE_KEY is not configured");
    }


    const globalRedis = getGlobalRedis(environment);


    const allItems = await globalRedis.lrange(reenqueueKey, 0, -1);

    let itemToDelete = null;


    for (const item of allItems) {
      try {
        const parsed = JSON.parse(item);
        if (parsed.id?.toString() === itemId.toString() && parsed.namespace === namespace) {
          itemToDelete = item;
          break;
        }
      } catch (error) {
        logger.error("Error parsing reenqueue item:", error);
      }
    }


    if (!itemToDelete) {
      throw new Error("Item not found in reenqueue list");
    }


    await globalRedis.lrem(reenqueueKey, 1, itemToDelete);


    logger.info(`Deleted brand ${itemId} from reenqueue list`);


    return {
      success: true,
      message: "Brand deleted successfully from reenqueue list"
    };
  } catch (error) {
    logger.error("Error deleting brand from reenqueue:", error);
    throw error;
  }
}


async function deleteAllBrands(namespace, environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const reenqueueKey = REDIS_KEYS.GLOBAL.REENQUEUE_KEY;

    if (!reenqueueKey) {
      throw new Error("REENQUEUE_KEY is not configured");
    }


    const globalRedis = getGlobalRedis(environment);


    const allItems = await globalRedis.lrange(reenqueueKey, 0, -1);

    let deletedCount = 0;


    for (const item of allItems) {
      try {
        const parsed = JSON.parse(item);

        if (parsed.namespace === namespace) {
          await globalRedis.lrem(reenqueueKey, 1, item);
          deletedCount++;
        }
      } catch (error) {
        logger.error("Error parsing reenqueue item:", error);
      }
    }


    logger.info(`Deleted ${deletedCount} brands from reenqueue list (namespace: ${namespace})`);


    return {
      success: true,
      message: `${deletedCount} brands deleted successfully from reenqueue list`,
      count: deletedCount
    };
  } catch (error) {
    logger.error("Error deleting all brands from reenqueue:", error);
    throw error;
  }
}


module.exports = {
  requeueSingleBrand,
  requeueAllBrands,
  deleteSingleBrand,
  deleteAllBrands,
};
