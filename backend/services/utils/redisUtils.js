const { getQueueRedis } = require("../../utils/redisSelector");

// Use the existing connection pool instead of creating new connections
function getWatchlistRedis(environment = 'production') {
  return getQueueRedis('watchlist', environment);
}

function getRegularRedis(environment = 'production') {
  return getQueueRedis('regular', environment);
}

// Redis Bull queue data functions
async function getTypesenseBullQueueData(queueType = 'regular', environment = 'production') {
  try {
    const redis = getQueueRedis(queueType, environment);

    // Get Ad Update Bull queue data (for Typesense indexing)
    const allQueueKeys = await redis.keys("bull:ad-update:*");
    const queueKeys = allQueueKeys.filter(key => {
      // Exclude lock keys, meta keys, and other non-job keys
      return !key.includes(':lock') && 
             !key.includes(':meta') && 
             !key.includes(':marker') &&
             /bull:ad-update:\d+$/.test(key); // Only numeric job IDs
    });
    const jobData = new Map();

    for (const key of queueKeys) {
      try {
        // Check key type before attempting hgetall
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

    // Get Ad Update failed queue data
    const allFailedKeys = await redis.keys("bull:ad-update:failed:*");
    const failedKeys = allFailedKeys.filter(key => {
      // Exclude lock keys, meta keys, and other non-job keys
      return !key.includes(':lock') && 
             !key.includes(':meta') && 
             !key.includes(':marker') &&
             /bull:ad-update:failed:\d+$/.test(key); // Only numeric job IDs
    });
    const failedData = new Map();

    for (const key of failedKeys) {
      try {
        // Check key type before attempting hgetall
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

    // Get brand processing Bull queue data (for file upload)
    const allQueueKeys = await redis.keys("bull:brand-processing:*");
    const queueKeys = allQueueKeys.filter(key => {
      // Exclude lock keys, meta keys, and other non-job keys
      return !key.includes(':lock') && 
             !key.includes(':meta') && 
             !key.includes(':marker') &&
             /bull:brand-processing:\d+$/.test(key); // Only numeric job IDs
    });
    const jobData = new Map();

    for (const key of queueKeys) {
      try {
        // Check key type before attempting hgetall
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
