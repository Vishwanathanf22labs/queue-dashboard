const Redis = require("ioredis");
const { getQueueRedis } = require("../../utils/redisSelector");

// Connect to separate Redis instances for watchlist and regular Bull queues
let watchlistRedis = null;
let regularRedis = null;

try {
  // Watchlist Redis connection
  watchlistRedis = new Redis({
    host: process.env.WATCHLIST_REDIS_QUEUE_HOST,
    port: process.env.WATCHLIST_REDIS_QUEUE_PORT,
    password: process.env.WATCHLIST_REDIS_QUEUE_PASSWORD,
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
    host: process.env.REGULAR_REDIS_QUEUE_HOST,
    port: process.env.REGULAR_REDIS_QUEUE_PORT,
    password: process.env.REGULAR_REDIS_QUEUE_PASSWORD,
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
    const queueKeys = await redis.keys("bull:ad-update:*");
    const jobData = new Map();

    for (const key of queueKeys) {
      const jobDataRaw = await redis.hgetall(key);
      if (jobDataRaw && jobDataRaw.data) {
        const adId = JSON.parse(jobDataRaw.data).adid;
        if (adId) {
          jobData.set(adId, true);
        }
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
    const failedKeys = await redis.keys("bull:ad-update:failed:*");
    const failedData = new Map();

    for (const key of failedKeys) {
      const jobDataRaw = await redis.hgetall(key);
      if (jobDataRaw && jobDataRaw.data) {
        const adId = JSON.parse(jobDataRaw.data).adid;
        if (adId) {
          failedData.set(adId, true);
        }
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
    const queueKeys = await redis.keys("bull:brand-processing:*");
    const jobData = new Map();

    for (const key of queueKeys) {
      const jobDataRaw = await redis.hgetall(key);
      if (jobDataRaw && jobDataRaw.data) {
        const brandId = JSON.parse(jobDataRaw.data).brandId;
        if (brandId) {
          jobData.set(brandId, true);
        }
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
