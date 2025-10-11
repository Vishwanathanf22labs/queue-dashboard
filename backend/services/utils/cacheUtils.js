const Redis = require("ioredis");
const crypto = require("crypto");

const redisCache = new Map();
const CACHE_TTL = 30000;

const { getRedisConfig } = require("../../config/environmentConfig");

const cacheRedisClients = {
  production: null,
  stage: null,
  default: null,
};

function initializeCacheRedisClient() {
  if (!cacheRedisClients.default) {
    const cacheRedisConfig = getRedisConfig("cache");
    cacheRedisClients.default = new Redis({
      host: cacheRedisConfig.host,
      port: cacheRedisConfig.port,
      password: cacheRedisConfig.password,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      connectTimeout: 10000,
      lazyConnect: false,
      enableOfflineQueue: true,
    });
    console.log(
      `Cache Redis client initialized: ${cacheRedisConfig.host}:${cacheRedisConfig.port}`
    );
  }
  return cacheRedisClients.default;
}

function getCacheRedisClient() {
  return initializeCacheRedisClient();
}

let redisClient = getCacheRedisClient();

function getCacheRedisClientWithEnvironment(environment = null) {
  if (environment) {
    if (!cacheRedisClients[environment]) {
      const cacheRedisConfig = getRedisConfig("cache", environment);
      cacheRedisClients[environment] = new Redis({
        host: cacheRedisConfig.host,
        port: cacheRedisConfig.port,
        password: cacheRedisConfig.password,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        connectTimeout: 10000,
        lazyConnect: false,
        enableOfflineQueue: true,
      });
      console.log(
        `Cache Redis client initialized for ${environment}: ${cacheRedisConfig.host}:${cacheRedisConfig.port}`
      );
    }
    return cacheRedisClients[environment];
  }
  return getCacheRedisClient();
}

function reinitializeCacheRedisClient() {
  try {
    if (redisClient) {
      redisClient.disconnect();
    }

    redisClient = getCacheRedisClient();

    return redisClient;
  } catch (error) {
    console.error("Error reinitializing cache Redis client:", error);
    throw error;
  }
}

function getCacheKey(prefix, ...args) {
  return `${prefix}:${args.join(":")}`;
}

async function getCachedData(key, environment = null) {
  try {
    const client = getCacheRedisClientWithEnvironment(environment);
    const redisData = await client.get(key);
    if (redisData) {
      return JSON.parse(redisData);
    }
    return null;
  } catch (error) {
    console.error("Cache get error:", error);
    const cached = redisCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    redisCache.delete(key);
    return null;
  }
}

async function setCachedData(key, data, ttl = 180, environment = null) {
  try {
    const serialized = JSON.stringify(data);
    const client = getCacheRedisClientWithEnvironment(environment);
    await client.setex(key, ttl, serialized);
    return true;
  } catch (error) {
    console.error("Cache set error:", error);
    redisCache.set(key, { data, timestamp: Date.now() });
    if (redisCache.size > 1000) {
      const keysToDelete = [];
      for (const [cacheKey, value] of redisCache.entries()) {
        if (Date.now() - value.timestamp > CACHE_TTL) {
          keysToDelete.push(cacheKey);
        }
      }
      keysToDelete.forEach((key) => redisCache.delete(key));
    }
    return false;
  }
}

function generateETag(data) {
  const hash = crypto
    .createHash("sha1")
    .update(JSON.stringify(data))
    .digest("hex");
  return `"${hash}"`;
}

async function getPipelineCache(
  date,
  page,
  perPage,
  sortBy = "normal",
  sortOrder = "desc",
  lastId = null
) {
  const key = getCacheKey(
    "pipeline",
    date,
    `p${page}`,
    `n${perPage}`,
    `s${sortBy}`,
    `o${sortOrder}`,
    lastId || ""
  );
  return await getCachedData(key);
}

async function setPipelineCache(
  date,
  page,
  perPage,
  data,
  sortBy = "normal",
  sortOrder = "desc",
  lastId = null,
  ttl = 300
) {
  const key = getCacheKey(
    "pipeline",
    date,
    `p${page}`,
    `n${perPage}`,
    `s${sortBy}`,
    `o${sortOrder}`,
    lastId || ""
  );
  return await setCachedData(key, data, ttl);
}

async function getPipelineETag(
  date,
  page,
  perPage,
  sortBy = "normal",
  sortOrder = "desc",
  lastId = null
) {
  const etagKey = getCacheKey(
    "pipeline",
    date,
    `p${page}`,
    `n${perPage}`,
    `s${sortBy}`,
    `o${sortOrder}`,
    lastId || "",
    "etag"
  );
  return await getCachedData(etagKey);
}

async function setPipelineETag(
  date,
  page,
  perPage,
  etag,
  sortBy = "normal",
  sortOrder = "desc",
  lastId = null,
  ttl = 300
) {
  const etagKey = getCacheKey(
    "pipeline",
    date,
    `p${page}`,
    `n${perPage}`,
    `s${sortBy}`,
    `o${sortOrder}`,
    lastId || "",
    "etag"
  );
  return await setCachedData(etagKey, etag, ttl);
}

async function getQueueCache(
  queueType,
  page,
  limit,
  sortBy = "normal",
  sortOrder = "desc"
) {
  const key = getCacheKey(
    "queue",
    queueType,
    `p${page}`,
    `l${limit}`,
    `s${sortBy}`,
    `o${sortOrder}`
  );
  return await getCachedData(key);
}

async function setQueueCache(
  queueType,
  page,
  limit,
  data,
  sortBy = "normal",
  sortOrder = "desc",
  ttl = 600
) {
  const key = getCacheKey(
    "queue",
    queueType,
    `p${page}`,
    `l${limit}`,
    `s${sortBy}`,
    `o${sortOrder}`
  );
  return await setCachedData(key, data, ttl);
}

async function getQueueETag(
  queueType,
  page,
  limit,
  sortBy = "normal",
  sortOrder = "desc"
) {
  const etagKey = getCacheKey(
    "queue",
    queueType,
    `p${page}`,
    `l${limit}`,
    `s${sortBy}`,
    `o${sortOrder}`,
    "etag"
  );
  return await getCachedData(etagKey);
}

async function setQueueETag(
  queueType,
  page,
  limit,
  etag,
  sortBy = "normal",
  sortOrder = "desc",
  ttl = 600
) {
  const etagKey = getCacheKey(
    "queue",
    queueType,
    `p${page}`,
    `l${limit}`,
    `s${sortBy}`,
    `o${sortOrder}`,
    "etag"
  );
  return await setCachedData(etagKey, etag, ttl);
}

async function getIpStatsListCache(
  page,
  limit,
  search = "",
  sortBy = "totalAds",
  sortOrder = "desc",
  environment = null
) {
  const key = getCacheKey(
    "ip_stats_list",
    `p${page}`,
    `l${limit}`,
    `s${search}`,
    `sb${sortBy}`,
    `so${sortOrder}`
  );
  return await getCachedData(key, environment);
}

async function setIpStatsListCache(
  page,
  limit,
  data,
  search = "",
  sortBy = "totalAds",
  sortOrder = "desc",
  ttl = 300,
  environment = null
) {
  const key = getCacheKey(
    "ip_stats_list",
    `p${page}`,
    `l${limit}`,
    `s${search}`,
    `sb${sortBy}`,
    `so${sortOrder}`
  );
  return await setCachedData(key, data, ttl, environment);
}

async function getIpStatsListETag(
  page,
  limit,
  search = "",
  sortBy = "totalAds",
  sortOrder = "desc",
  environment = null
) {
  const etagKey = getCacheKey(
    "ip_stats_list",
    `p${page}`,
    `l${limit}`,
    `s${search}`,
    `sb${sortBy}`,
    `so${sortOrder}`,
    "etag"
  );
  return await getCachedData(etagKey, environment);
}

async function setIpStatsListETag(
  page,
  limit,
  etag,
  search = "",
  sortBy = "totalAds",
  sortOrder = "desc",
  ttl = 300,
  environment = null
) {
  const etagKey = getCacheKey(
    "ip_stats_list",
    `p${page}`,
    `l${limit}`,
    `s${search}`,
    `sb${sortBy}`,
    `so${sortOrder}`,
    "etag"
  );
  return await setCachedData(etagKey, etag, ttl, environment);
}

async function getIpBrandsCache(ip, page, limit, search = "") {
  const key = getCacheKey(
    "ip_brands",
    ip,
    `p${page}`,
    `l${limit}`,
    `s${search}`
  );
  return await getCachedData(key);
}

async function setIpBrandsCache(ip, page, limit, data, search = "", ttl = 300) {
  const key = getCacheKey(
    "ip_brands",
    ip,
    `p${page}`,
    `l${limit}`,
    `s${search}`
  );
  return await setCachedData(key, data, ttl);
}

async function getIpBrandsETag(ip, page, limit, search = "") {
  const etagKey = getCacheKey(
    "ip_brands",
    ip,
    `p${page}`,
    `l${limit}`,
    `s${search}`,
    "etag"
  );
  return await getCachedData(etagKey);
}

async function setIpBrandsETag(ip, page, limit, etag, search = "", ttl = 300) {
  const etagKey = getCacheKey(
    "ip_brands",
    ip,
    `p${page}`,
    `l${limit}`,
    `s${search}`,
    "etag"
  );
  return await setCachedData(etagKey, etag, ttl);
}

async function invalidatePipelineCache(date) {
  try {
    const pattern = `pipeline:${date}:*`;
    const client = getCacheRedisClient();
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    console.error("Cache invalidation error:", error);
  }
}

async function invalidateQueueCache(queueType = null) {
  try {
    redisCache.clear();
    console.log("In-memory fallback cache cleared");

    try {
      if (
        global.queueProcessingService &&
        global.queueProcessingService.clearInMemoryCaches
      ) {
        global.queueProcessingService.clearInMemoryCaches();
        console.log(
          "QueueProcessingService caches cleared via global reference"
        );
      }

      if (
        global.adUpdateProcessingService &&
        global.adUpdateProcessingService.clearInMemoryCaches
      ) {
        global.adUpdateProcessingService.clearInMemoryCaches();
        console.log(
          "AdUpdateProcessingService caches cleared via global reference"
        );
      }
    } catch (serviceError) {
      console.warn("Error clearing service caches:", serviceError.message);
    }

    const pattern = queueType ? `queue:${queueType}:*` : `queue:*`;
    const client = getCacheRedisClient();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Redis operation timed out after 10 seconds")),
        10000
      );
    });

    const redisOperation = (async () => {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        console.log(
          `Deleting ${keys.length} cache keys with pattern: ${pattern}`
        );
        await client.del(keys);
        console.log("Redis cache keys deleted successfully");
      } else {
        console.log("No cache keys found to delete");
      }
    })();

    await Promise.race([redisOperation, timeoutPromise]);
  } catch (error) {
    console.error("Queue cache invalidation error:", error.message);
  }
}

async function invalidateIpStatsCache() {
  try {
    const patterns = ["ip_stats_list:*", "ip_brands:*", "ip_all_brands:*"];
    const client = getCacheRedisClient();

    let totalDeleted = 0;
    for (const pattern of patterns) {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        const deleted = await client.del(keys);
        totalDeleted += deleted;
      }
    }

    console.log(`IP Stats cache invalidated - ${totalDeleted} keys deleted`);
    return totalDeleted;
  } catch (error) {
    console.error("IP Stats cache invalidation error:", error);
    throw error;
  }
}

function clearInMemoryFallbackCache() {
  redisCache.clear();
  console.log("In-memory fallback cache cleared");
}

const cacheUtilsExports = {
  getCacheKey,
  getCachedData,
  setCachedData,
  generateETag,
  getPipelineCache,
  setPipelineCache,
  getPipelineETag,
  setPipelineETag,
  invalidatePipelineCache,
  getQueueCache,
  setQueueCache,
  getQueueETag,
  setQueueETag,
  invalidateQueueCache,
  getIpStatsListCache,
  setIpStatsListCache,
  getIpStatsListETag,
  setIpStatsListETag,
  getIpBrandsCache,
  setIpBrandsCache,
  getIpBrandsETag,
  setIpBrandsETag,
  invalidateIpStatsCache,
  reinitializeCacheRedisClient,
  getCacheRedisClient,
  getCacheRedisClientWithEnvironment,
  clearInMemoryFallbackCache,
};

global.cacheUtils = cacheUtilsExports;

module.exports = cacheUtilsExports;
