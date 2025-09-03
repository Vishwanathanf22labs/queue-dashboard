const redis = require("../config/redis");
const logger = require("../utils/logger");
const { REDIS_KEYS, QUEUES } = require("../config/constants");

async function getScraperStatus() {
  try {
    // Check if there are any brands currently processing
    const currentlyProcessingBrands = await redis.lrange(REDIS_KEYS.CURRENTLY_PROCESSING, 0, -1);
    
    let status = 'not_running';
    
    if (currentlyProcessingBrands && currentlyProcessingBrands.length > 0) {
      // Check if any brands are actively processing (not completed/failed)
      let hasActiveBrands = false;
      let oldestStartTime = null;
      
      for (const brandData of currentlyProcessingBrands) {
        try {
          const processingData = JSON.parse(brandData);
          const brandStatus = processingData.status?.toLowerCase();
          
          // Check if this brand is actively processing (not completed/failed)
          if (brandStatus && brandStatus !== 'complete' && brandStatus !== 'failed' && brandStatus !== 'error') {
            hasActiveBrands = true;
          }
          
          // Track the oldest start time for timeout logic
          const startTime = new Date(processingData.startAt || processingData.added_at);
          if (!oldestStartTime || startTime < oldestStartTime) {
            oldestStartTime = startTime;
          }
        } catch (parseError) {
          logger.warn('Error parsing currently processing data:', parseError);
          // If we can't parse, assume it might be active
          hasActiveBrands = true;
        }
      }
      
      if (hasActiveBrands) {
        // Check if the oldest active brand has been running for more than 15 minutes
        if (oldestStartTime) {
          const currentTime = new Date();
          const timeDiffMinutes = (currentTime - oldestStartTime) / (1000 * 60);
          
          if (timeDiffMinutes >= 15) {
            // If it's been more than 15 minutes, consider it not running
            status = 'not_running';
          } else {
            status = 'running';
          }
        } else {
          status = 'running';
        }
      } else {
        // All brands are completed/failed, so scraper is not running
        status = 'not_running';
      }
    } else {
      // No brands in the queue at all
      status = 'not_running';
    }
    
    return {
      status: status
    };
  } catch (error) {
    logger.error('Error getting scraper status:', error);
    return {
      status: 'not_running'
    };
  }
}

module.exports = {
  getScraperStatus
};
