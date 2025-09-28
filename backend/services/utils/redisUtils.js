const Redis = require("ioredis");
const { getQueueRedis } = require("../../utils/redisSelector");
const { getRedisConfig } = require("../../config/environmentConfig");

// Connect to separate Redis instances for watchlist and regular Bull queues
let watchlistRedis = null;
let regularRedis = null;

try {
  // Get Redis configurations based on current environment
  const watchlistRedisConfig = getRedisConfig('watchlist');
  const regularRedisConfig = getRedisConfig('regular');

  // Watchlist Redis connection
  watchlistRedis = new Redis({
    host: watchlistRedisConfig.host,
    port: watchlistRedisConfig.port,
    password: watchlistRedisConfig.password,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
  });

  watchlistRedis.on("error", (err) => {
    console.warn("Watchlist Redis connection error:", err.message);
    watchlistRedis = null;
  });

  watchlistRedis.on("connect", () => {
    console.log("Watchlist Redis connected successfully");
  });

  // Regular Redis connection
  regularRedis = new Redis({
    host: regularRedisConfig.host,
    port: regularRedisConfig.port,
    password: regularRedisConfig.password,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
  });

  regularRedis.on("error", (err) => {
    console.warn("Regular Redis connection error:", err.message);
    regularRedis = null;
  });

  regularRedis.on("connect", () => {
    console.log("Regular Redis connected successfully");
  });
} catch (error) {
  console.warn("Failed to initialize Redis connections:", error.message);
  watchlistRedis = null;
  regularRedis = null;
}

// Redis Bull queue data functions
async function getTypesenseBullQueueData(queueType = 'regular') {
  try {
    const redis = queueType === 'watchlist' ? watchlistRedis : regularRedis;
    if (!redis) return new Map();

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

async function getTypesenseFailedQueueData(queueType = 'regular') {
  try {
    const redis = queueType === 'watchlist' ? watchlistRedis : regularRedis;
    if (!redis) return new Map();

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

async function getFileUploadBullQueueData(queueType = 'regular') {
  try {
    const redis = queueType === 'watchlist' ? watchlistRedis : regularRedis;
    if (!redis) return new Map();

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
