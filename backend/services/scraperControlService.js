const { getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

// Function to get dynamic Redis keys
function getRedisKeys() {
  return require("../config/constants").REDIS_KEYS;
}

async function getScraperStatus() {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    
    // First check the manual scraper status from Redis
    const manualStatus = await getGlobalRedis().get(REDIS_KEYS.GLOBAL.SCRAPER_STATUS);
    
    // Get start and stop times from Redis
    const startTime = await getGlobalRedis().get(REDIS_KEYS.GLOBAL.SCRAPER_START_TIME);
    const stopTime = await getGlobalRedis().get(REDIS_KEYS.GLOBAL.SCRAPER_STOP_TIME);
    
    
    if (manualStatus) {
      return {
        status: manualStatus,
        startTime: startTime,
        stopTime: stopTime
      };
    }
    
    // If no manual status, check if there are any brands currently processing
    const currentlyProcessingBrands = await getGlobalRedis().lrange(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING, 0, -1);
    
    let status = 'stopped'; // Default to stopped to match your scraper logic
    // Preserve the original stop time from Redis - don't overwrite it
    let finalStopTime = stopTime;
    
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
            // If it's been more than 15 minutes, consider it stopped
            status = 'stopped';
          } else {
            status = 'running';
          }
        } else {
          status = 'running';
        }
      } else {
        // All brands are completed/failed, so scraper is stopped
        status = 'stopped';
      }
    } else {
      // No brands in the queue at all
      status = 'stopped';
    }
    
    const result = {
      status: status,
      startTime: startTime,
      stopTime: finalStopTime  // Use the preserved stop time
    };
    return result;
  } catch (error) {
    logger.error('Error getting scraper status:', error);
    return {
      status: 'stopped',
      startTime: null,
      stopTime: null
    };
  }
}

async function startScraper() {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    
    // Check if scraper is already running
    const currentStatus = await getScraperStatus();
    
    if (currentStatus.status === 'running') {
      return {
        success: false,
        message: 'Scraper is already running',
        status: 'running',
        startTime: currentStatus.startTime,
        stopTime: currentStatus.stopTime
      };
    }

    // Get current timestamp
    const currentTime = new Date().toISOString();
    
    // Set scraper status to running and store start time in Redis
    await Promise.all([
      getGlobalRedis().set(REDIS_KEYS.GLOBAL.SCRAPER_STATUS, 'running'),
      getGlobalRedis().set(REDIS_KEYS.GLOBAL.SCRAPER_START_TIME, currentTime)
    ]);
    
    // Keep the previous stop time (don't delete it)
    
    logger.info('Scraper started successfully');
    const result = {
      success: true,
      message: 'Scraper started successfully',
      status: 'running',
      startTime: currentTime,
      stopTime: currentStatus.stopTime  // Keep the previous stop time
    };
    return result;
  } catch (error) {
    logger.error('Error starting scraper:', error);
    return {
      success: false,
      message: 'Failed to start scraper',
      status: 'stopped',
      startTime: null,
      stopTime: null
    };
  }
}

async function stopScraper() {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    
    // Check if scraper is running
    const currentStatus = await getScraperStatus();
    
    if (currentStatus.status === 'stopped' || currentStatus.status === 'not_running') {
      return {
        success: false,
        message: 'Scraper is not currently running',
        status: currentStatus.status,
        startTime: currentStatus.startTime,
        stopTime: currentStatus.stopTime
      };
    }

    // Get current timestamp
    const currentTime = new Date().toISOString();
    
    // Set scraper status to stopped and store stop time in Redis
    await Promise.all([
      getGlobalRedis().set(REDIS_KEYS.GLOBAL.SCRAPER_STATUS, 'stopped'),
      getGlobalRedis().set(REDIS_KEYS.GLOBAL.SCRAPER_STOP_TIME, currentTime)
    ]);
    
    // Optionally, you can also clear the currently processing queue
    // await getGlobalRedis().del(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING);
    
    logger.info('Scraper stopped successfully');
    const result = {
      success: true,
      message: 'Scraper stopped successfully',
      status: 'stopped',
      startTime: currentStatus.startTime,
      stopTime: currentTime
    };
    return result;
  } catch (error) {
    logger.error('Error stopping scraper:', error);
    return {
      success: false,
      message: 'Failed to stop scraper',
      status: 'unknown',
      startTime: null,
      stopTime: null
    };
  }
}

module.exports = {
  getScraperStatus,
  startScraper,
  stopScraper
};
