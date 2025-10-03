const { globalRedis } = require("../config/redis");
const { getQueueRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");

// Function to get dynamic Redis keys
function getRedisKeys() {
  return require("../config/constants").REDIS_KEYS;
}

/**
 * Requeue a single brand from reenqueue list to pending queue
 * @param {string} itemId - The id of the item to requeue
 * @param {string} namespace - 'watchlist' or 'non-watchlist'
 * @returns {Object} - Success status
 */
async function requeueSingleBrand(itemId, namespace) {
  try {
    const REDIS_KEYS = getRedisKeys();
    const reenqueueKey = REDIS_KEYS.GLOBAL.REENQUEUE_KEY;
    
    if (!reenqueueKey) {
      throw new Error("REENQUEUE_KEY is not configured");
    }

    // Get all items from reenqueue list
    const allItems = await globalRedis.lrange(reenqueueKey, 0, -1);
    
    let itemToRequeue = null;
    let itemIndex = -1;

    // Find the item to requeue
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

    // If page_id is missing, fetch it from database
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

    // Determine which queue to add to based on namespace
    const queueType = namespace === 'watchlist' ? 'watchlist' : 'regular';
    const queueRedis = getQueueRedis(queueType);
    const pendingQueueKey = queueType === 'watchlist' 
      ? REDIS_KEYS.WATCHLIST.PENDING_BRANDS 
      : REDIS_KEYS.REGULAR.PENDING_BRANDS;

    // Add to pending queue with score 100
    const queueData = JSON.stringify({
      id: itemToRequeue.id,
      page_id: itemToRequeue.page_id
    });
    
    await queueRedis.zadd(pendingQueueKey, 100, queueData);
    
    // Remove from reenqueue list
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

/**
 * Requeue all brands from reenqueue list to pending queue
 * @param {string} namespace - 'watchlist' or 'non-watchlist'
 * @returns {Object} - Success status with count
 */
async function requeueAllBrands(namespace) {
  try {
    const REDIS_KEYS = getRedisKeys();
    const reenqueueKey = REDIS_KEYS.GLOBAL.REENQUEUE_KEY;
    
    if (!reenqueueKey) {
      throw new Error("REENQUEUE_KEY is not configured");
    }

    // Get all items from reenqueue list
    const allItems = await globalRedis.lrange(reenqueueKey, 0, -1);
    
    // Determine which queue to add to based on namespace
    const queueType = namespace === 'watchlist' ? 'watchlist' : 'regular';
    const queueRedis = getQueueRedis(queueType);
    const pendingQueueKey = queueType === 'watchlist' 
      ? REDIS_KEYS.WATCHLIST.PENDING_BRANDS 
      : REDIS_KEYS.REGULAR.PENDING_BRANDS;

    let requeuedCount = 0;
    const itemsToRemove = [];

    // Process items matching the namespace
    for (const item of allItems) {
      try {
        const parsed = JSON.parse(item);
        
        if (parsed.namespace === namespace) {
          // If page_id is missing, fetch it from database
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
          
          // Add to pending queue with score 100
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

    // Remove all requeued items from reenqueue list
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

/**
 * Delete a single brand from reenqueue list
 * @param {string} itemId - The id of the item to delete
 * @param {string} namespace - 'watchlist' or 'non-watchlist'
 * @returns {Object} - Success status
 */
async function deleteSingleBrand(itemId, namespace) {
  try {
    const REDIS_KEYS = getRedisKeys();
    const reenqueueKey = REDIS_KEYS.GLOBAL.REENQUEUE_KEY;
    
    if (!reenqueueKey) {
      throw new Error("REENQUEUE_KEY is not configured");
    }

    // Get all items from reenqueue list
    const allItems = await globalRedis.lrange(reenqueueKey, 0, -1);
    
    let itemToDelete = null;

    // Find the item to delete
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

    // Remove from reenqueue list
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

/**
 * Delete all brands from reenqueue list by namespace
 * @param {string} namespace - 'watchlist' or 'non-watchlist'
 * @returns {Object} - Success status with count
 */
async function deleteAllBrands(namespace) {
  try {
    const REDIS_KEYS = getRedisKeys();
    const reenqueueKey = REDIS_KEYS.GLOBAL.REENQUEUE_KEY;
    
    if (!reenqueueKey) {
      throw new Error("REENQUEUE_KEY is not configured");
    }

    // Get all items from reenqueue list
    const allItems = await globalRedis.lrange(reenqueueKey, 0, -1);
    
    let deletedCount = 0;

    // Delete items matching the namespace
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
