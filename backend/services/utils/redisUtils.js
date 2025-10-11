const { getQueueRedis } = require("../../utils/redisSelector");


function getWatchlistRedis(environment = 'production') {
  return getQueueRedis('watchlist', environment);
}


function getRegularRedis(environment = 'production') {
  return getQueueRedis('regular', environment);
}


async function getTypesenseBullQueueData(queueType = 'regular', environment = 'production') {
  try {
    const redis = getQueueRedis(queueType, environment);


    const allQueueKeys = await redis.keys("bull:ad-update:*");
    const queueKeys = allQueueKeys.filter(key => {
      return !key.includes(':lock') &&
        !key.includes(':meta') &&
        !key.includes(':marker') &&
        /bull:ad-update:\d+$/.test(key);
    });
    const jobData = new Map();


    for (const key of queueKeys) {
      try {
        const keyType = await redis.type(key);
        if (keyType === 'hash') {
          const jobDataRaw = await redis.hgetall(key);
          if (jobDataRaw && jobDataRaw.data) {
            const adId = JSON.parse(jobDataRaw.data).adid;
            if (adId) {
              jobData.set(adId, true);
            }
          }
        }
      } catch (error) {
        console.warn(`Error parsing ad-update job ${key}:`, error.message);
      }
    }


    return jobData;
  } catch (error) {
    console.warn(`Error getting Ad Update Bull queue data (${queueType}):`, error.message);
    return new Map();
  }
}


async function getTypesenseFailedQueueData(queueType = 'regular', environment = 'production') {
  try {
    const redis = getQueueRedis(queueType, environment);


    const allFailedKeys = await redis.keys("bull:ad-update:failed:*");
    const failedKeys = allFailedKeys.filter(key => {
      return !key.includes(':lock') &&
        !key.includes(':meta') &&
        !key.includes(':marker') &&
        /bull:ad-update:failed:\d+$/.test(key);
    });
    const failedData = new Map();


    for (const key of failedKeys) {
      try {
        const keyType = await redis.type(key);
        if (keyType === 'hash') {
          const jobDataRaw = await redis.hgetall(key);
          if (jobDataRaw && jobDataRaw.data) {
            const adId = JSON.parse(jobDataRaw.data).adid;
            if (adId) {
              failedData.set(adId, true);
            }
          }
        }
      } catch (error) {
        console.warn(`Error parsing ad-update failed job ${key}:`, error.message);
      }
    }


    return failedData;
  } catch (error) {
    console.warn(`Error getting Ad Update failed queue data (${queueType}):`, error.message);
    return new Map();
  }
}


async function getFileUploadBullQueueData(queueType = 'regular', environment = 'production') {
  try {
    const redis = getQueueRedis(queueType, environment);


    const allQueueKeys = await redis.keys("bull:brand-processing:*");
    const queueKeys = allQueueKeys.filter(key => {
      return !key.includes(':lock') &&
        !key.includes(':meta') &&
        !key.includes(':marker') &&
        /bull:brand-processing:\d+$/.test(key);
    });
    const jobData = new Map();


    for (const key of queueKeys) {
      try {
        const keyType = await redis.type(key);
        if (keyType === 'hash') {
          const jobDataRaw = await redis.hgetall(key);
          if (jobDataRaw && jobDataRaw.data) {
            const brandId = JSON.parse(jobDataRaw.data).brandId;
            if (brandId) {
              jobData.set(brandId, true);
            }
          }
        }
      } catch (error) {
        console.warn(`Error parsing brand-processing job ${key}:`, error.message);
      }
    }


    return jobData;
  } catch (error) {
    console.warn(
      `Error getting brand processing Bull queue data (${queueType}):`,
      error.message
    );
    return new Map();
  }
}


module.exports = {
  getTypesenseBullQueueData,
  getTypesenseFailedQueueData,
  getFileUploadBullQueueData,
};
