const redis = require("../config/redis");
const Brand = require("../models/Brand");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

/**
 * Change brand priority by moving it to a specific position in the queue
 * @param {string} queueType - 'pending' or 'failed'
 * @param {string} brandName - Brand name to search for and move
 * @param {number} newPosition - Target position (1-based, 1 = highest priority)
 * @returns {Object} Result of the priority change operation
 */
async function changeBrandPriority(queueType, brandName, newPosition) {
  try {
    // Validate queue type
    if (!['pending', 'failed'].includes(queueType)) {
      throw new Error('Invalid queue type. Must be "pending" or "failed"');
    }

    // Validate brand name
    if (!brandName || brandName.trim().length < 2) {
      throw new Error('Brand name must be at least 2 characters long');
    }

    // Validate position (must be positive integer)
    if (!Number.isInteger(newPosition) || newPosition < 1) {
      throw new Error('New position must be a positive integer');
    }

    const queueKey = queueType === 'pending' ? QUEUES.PENDING_BRANDS : QUEUES.FAILED_BRANDS;
    const queueName = queueType === 'pending' ? 'pending' : 'failed';

    logger.info(`Changing priority for brand "${brandName}" in ${queueName} queue to position ${newPosition}`);

    // Get current queue length
    const queueLength = await redis.llen(queueKey);
    if (queueLength === 0) {
      throw new Error(`${queueName} queue is empty`);
    }

    // Adjust position to 0-based index and validate
    const targetIndex = newPosition - 1;
    if (targetIndex >= queueLength) {
      throw new Error(`Position ${newPosition} is out of range. Queue has ${queueLength} items`);
    }

    // Find the brand by name in the current queue
    const currentItems = await redis.lrange(queueKey, 0, -1);
    let brandToMove = null;
    let currentIndex = -1;
    const searchTermLower = brandName.toLowerCase();

    for (let i = 0; i < currentItems.length; i++) {
      try {
        const brandData = JSON.parse(currentItems[i]);
        const brandId = brandData.id || brandData.brand_id || brandData.queue_id;
        
        if (brandId) {
          try {
            const brand = await Brand.findOne({
              where: { id: parseInt(brandId) },
              attributes: ["actual_name", "page_id"],
              raw: true,
            });
            
            if (brand && brand.actual_name) {
              const actualBrandName = brand.actual_name;
              // Check if brand name contains search term
              if (actualBrandName.toLowerCase().includes(searchTermLower)) {
                brandToMove = brandData;
                currentIndex = i;
                break;
              }
            }
          } catch (dbError) {
            logger.error(`Error fetching brand ${brandId} from database:`, dbError);
          }
        }
      } catch (parseError) {
        logger.error(`Error parsing brand data at index ${i}:`, parseError);
      }
    }

    if (currentIndex === -1) {
      throw new Error(`Brand with name "${brandName}" not found in ${queueName} queue`);
    }

    // If brand is already at the target position, no need to move
    if (currentIndex === targetIndex) {
      return {
        success: true,
        message: `Brand "${brandName}" is already at position ${newPosition}`,
        brand_name: brandName,
        current_position: newPosition,
        new_position: newPosition,
        queue_type: queueType
      };
    }

    // Create new queue with brand at new position
    const newQueue = [];
    
    // Helper function to clean item data (keep only essential fields)
    const cleanItemData = (itemData) => {
      try {
        const parsed = JSON.parse(itemData);
        // Only keep essential fields, remove all extra metadata
        return JSON.stringify({
          id: parsed.id,
          page_id: parsed.page_id
        });
      } catch (error) {
        // If parsing fails, return original item
        return itemData;
      }
    };
    
    // Build new queue with correct positioning
    for (let i = 0; i < currentItems.length; i++) {
      if (i === currentIndex) {
        // Skip the brand being moved (will be added at target position)
        continue;
      }
      
      if (newQueue.length === targetIndex) {
        // We've reached the target position, add the moved brand here
        newQueue.push(cleanItemData(currentItems[currentIndex]));
      }
      
      // Add the current item (cleaned)
      newQueue.push(cleanItemData(currentItems[i]));
    }
    
    // If target position is at the end, add the moved brand there
    if (newQueue.length === targetIndex) {
      newQueue.push(cleanItemData(currentItems[currentIndex]));
    }
    
    // Clear and rebuild the queue
    await redis.del(queueKey);
    
    // Add all items back in correct order (original format)
    if (newQueue.length > 0) {
      await redis.rpush(queueKey, ...newQueue);
    }



    logger.info(`Successfully moved brand "${brandName}" from position ${currentIndex + 1} to position ${newPosition} in ${queueName} queue`);

    return {
      success: true,
      message: `Brand "${brandName}" priority changed successfully`,
      brand_name: brandName,
      previous_position: currentIndex + 1,
      new_position: newPosition,
      queue_type: queueType
    };

  } catch (error) {
    logger.error(`Error changing brand priority in ${queueType} queue:`, error);
    throw error;
  }
}

/**
 * Move brand to the top (position 1) of the queue for highest priority
 * @param {string} queueType - 'pending' or 'failed'
 * @param {string} brandName - Brand name to move to top
 * @returns {Object} Result of the move to top operation
 */
async function moveBrandToTop(queueType, brandName) {
  return await changeBrandPriority(queueType, brandName, 1);
}

/**
 * Move brand to a specific position in the queue
 * @param {string} queueType - 'pending' or 'failed'
 * @param {string} brandName - Brand name to move
 * @param {number} targetPosition - Target position (1-based)
 * @returns {Object} Result of the move operation
 */
async function moveBrandToPosition(queueType, brandName, targetPosition) {
  return await changeBrandPriority(queueType, brandName, targetPosition);
}







module.exports = {
  changeBrandPriority,
  moveBrandToTop,
  moveBrandToPosition
};
