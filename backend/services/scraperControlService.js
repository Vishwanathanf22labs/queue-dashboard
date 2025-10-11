const { getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

function getRedisKeys() {
  return require("../config/constants").REDIS_KEYS;
}

async function getScraperStatus(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys();


    const manualStatus = await getGlobalRedis(environment).get(REDIS_KEYS.GLOBAL.SCRAPER_STATUS);


    const startTime = await getGlobalRedis(environment).get(REDIS_KEYS.GLOBAL.SCRAPER_START_TIME);
    const stopTime = await getGlobalRedis(environment).get(REDIS_KEYS.GLOBAL.SCRAPER_STOP_TIME);


    if (manualStatus) {
      return {
        status: manualStatus,
        startTime: startTime,
        stopTime: stopTime
      };
    }

    const currentlyProcessingBrands = await getGlobalRedis(environment).lrange(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING, 0, -1);

    let status = 'stopped';
    let finalStopTime = stopTime;

    if (currentlyProcessingBrands && currentlyProcessingBrands.length > 0) {
      let hasActiveBrands = false;
      let oldestStartTime = null;

      for (const brandData of currentlyProcessingBrands) {
        try {
          const processingData = JSON.parse(brandData);
          const brandStatus = processingData.status?.toLowerCase();

          if (brandStatus && brandStatus !== 'complete' && brandStatus !== 'failed' && brandStatus !== 'error') {
            hasActiveBrands = true;
          }

          const startTime = new Date(processingData.startAt || processingData.added_at);
          if (!oldestStartTime || startTime < oldestStartTime) {
            oldestStartTime = startTime;
          }
        } catch (parseError) {
          logger.warn('Error parsing currently processing data:', parseError);
          hasActiveBrands = true;
        }
      }

      if (hasActiveBrands) {
        if (oldestStartTime) {
          const currentTime = new Date();
          const timeDiffMinutes = (currentTime - oldestStartTime) / (1000 * 60);

          if (timeDiffMinutes >= 15) {
            status = 'stopped';
          } else {
            status = 'running';
          }
        } else {
          status = 'running';
        }
      } else {
        status = 'stopped';
      }
    } else {
      status = 'stopped';
    }

    const result = {
      status: status,
      startTime: startTime,
      stopTime: finalStopTime
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

async function startScraper(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys();


    const currentStatus = await getScraperStatus(environment);

    if (currentStatus.status === 'running') {
      return {
        success: false,
        message: 'Scraper is already running',
        status: 'running',
        startTime: currentStatus.startTime,
        stopTime: currentStatus.stopTime
      };
    }


    const currentTime = new Date().toISOString();

    await Promise.all([
      getGlobalRedis(environment).set(REDIS_KEYS.GLOBAL.SCRAPER_STATUS, 'running'),
      getGlobalRedis(environment).set(REDIS_KEYS.GLOBAL.SCRAPER_START_TIME, currentTime)
    ]);



    logger.info('Scraper started successfully');
    const result = {
      success: true,
      message: 'Scraper started successfully',
      status: 'running',
      startTime: currentTime,
      stopTime: currentStatus.stopTime
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

async function stopScraper(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys();


    const currentStatus = await getScraperStatus(environment);

    if (currentStatus.status === 'stopped' || currentStatus.status === 'not_running') {
      return {
        success: false,
        message: 'Scraper is not currently running',
        status: currentStatus.status,
        startTime: currentStatus.startTime,
        stopTime: currentStatus.stopTime
      };
    }

    const currentTime = new Date().toISOString();

    await Promise.all([
      getGlobalRedis(environment).set(REDIS_KEYS.GLOBAL.SCRAPER_STATUS, 'stopped'),
      getGlobalRedis(environment).set(REDIS_KEYS.GLOBAL.SCRAPER_STOP_TIME, currentTime)
    ]);


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

async function getBrandTiming(environment = 'production') {
  try {
    const data = await getGlobalRedis(environment).hgetall('brand_timing');
    return data || {};
  } catch (error) {
    logger.error('Error fetching brand_timing hash:', error);
    return {};
  }
}

module.exports = {
  getScraperStatus,
  startScraper,
  stopScraper,
  getBrandTiming
};
