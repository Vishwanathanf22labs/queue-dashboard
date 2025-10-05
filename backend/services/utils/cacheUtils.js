// Add caching for Redis operations
const Redis = require("ioredis");
const crypto = require('crypto');

// Fallback in-memory cache
const redisCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// Redis client setup - using dedicated cache Redis instance
const { getRedisConfig } = require("../../config/environmentConfig");

// Dynamic Redis client getter to ensure we always get the latest connection
function getCacheRedisClient() {
  const cacheRedisConfig = getRedisConfig('cache');
  return new Redis({
    host: cacheRedisConfig.host,
    port: cacheRedisConfig.port,
    password: cacheRedisConfig.password,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
  });
}

// Fallback static client for backward compatibility
let redisClient = getCacheRedisClient();

// Function to reinitialize cache Redis client for environment switching
function reinitializeCacheRedisClient() {
  try {
    // Close existing client if it exists
    if (redisClient) {
      redisClient.disconnect();
    }
    
    // Create new client with current environment settings
    redisClient = getCacheRedisClient();
    
    return redisClient;
  } catch (error) {
    console.error('Error reinitializing cache Redis client:', error);
    throw error;
  }
}

// Cache helper functions
function getCacheKey(prefix, ...args) {
  return `${prefix}:${args.join(":")}`;
}

async function getCachedData(key) {
  try {
    // Try Redis first with dynamic client
    const client = getCacheRedisClient();
    const redisData = await client.get(key);
    if (redisData) {
      return JSON.parse(redisData);
    }
    return null;
  } catch (error) {
    console.error('Cache get error:', error);
    // Fallback to in-memory cache
    const cached = redisCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    redisCache.delete(key);
    return null;
  }
}

async function setCachedData(key, data, ttl = 180) {
  try {
    const serialized = JSON.stringify(data);
    const client = getCacheRedisClient();
    await client.setex(key, ttl, serialized);
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    // Fallback to in-memory cache
    redisCache.set(key, { data, timestamp: Date.now() });
    // Clean up old cache entries periodically
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

// ETag support
function generateETag(data) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex');
  return `"${hash}"`;
}

// Pipeline-specific cache functions
async function getPipelineCache(date, page, perPage, sortBy = 'normal', sortOrder = 'desc', lastId = null) {
  const key = getCacheKey("pipeline", date, `p${page}`, `n${perPage}`, `s${sortBy}`, `o${sortOrder}`, lastId || '');
  return await getCachedData(key);
}

async function setPipelineCache(date, page, perPage, data, sortBy = 'normal', sortOrder = 'desc', lastId = null, ttl = 300) {
  const key = getCacheKey("pipeline", date, `p${page}`, `n${perPage}`, `s${sortBy}`, `o${sortOrder}`, lastId || '');
  return await setCachedData(key, data, ttl);
}

async function getPipelineETag(date, page, perPage, sortBy = 'normal', sortOrder = 'desc', lastId = null) {
  const etagKey = getCacheKey("pipeline", date, `p${page}`, `n${perPage}`, `s${sortBy}`, `o${sortOrder}`, lastId || '', "etag");
  return await getCachedData(etagKey);
}

async function setPipelineETag(date, page, perPage, etag, sortBy = 'normal', sortOrder = 'desc', lastId = null, ttl = 300) {
  const etagKey = getCacheKey("pipeline", date, `p${page}`, `n${perPage}`, `s${sortBy}`, `o${sortOrder}`, lastId || '', "etag");
  return await setCachedData(etagKey, etag, ttl);
}

// Queue-specific cache functions (pipeline-style)
async function getQueueCache(queueType, page, limit, sortBy = 'normal', sortOrder = 'desc') {
  const key = getCacheKey("queue", queueType, `p${page}`, `l${limit}`, `s${sortBy}`, `o${sortOrder}`);
  return await getCachedData(key);
}

async function setQueueCache(queueType, page, limit, data, sortBy = 'normal', sortOrder = 'desc', ttl = 600) {
  const key = getCacheKey("queue", queueType, `p${page}`, `l${limit}`, `s${sortBy}`, `o${sortOrder}`);
  return await setCachedData(key, data, ttl);
}

async function getQueueETag(queueType, page, limit, sortBy = 'normal', sortOrder = 'desc') {
  const etagKey = getCacheKey("queue", queueType, `p${page}`, `l${limit}`, `s${sortBy}`, `o${sortOrder}`, "etag");
  return await getCachedData(etagKey);
}

async function setQueueETag(queueType, page, limit, etag, sortBy = 'normal', sortOrder = 'desc', ttl = 600) {
  const etagKey = getCacheKey("queue", queueType, `p${page}`, `l${limit}`, `s${sortBy}`, `o${sortOrder}`, "etag");
  return await setCachedData(etagKey, etag, ttl);
}

// Cache invalidation functions
async function invalidatePipelineCache(date) {
  try {
    // Get all keys matching the pattern
    const pattern = `pipeline:${date}:*`;
    const client = getCacheRedisClient();
    const keys = await client.keys(pattern);
    
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

async function invalidateQueueCache(queueType = null) {
  try {
    // Clear Redis cache
    const pattern = queueType ? `queue:${queueType}:*` : `queue:*`;
    const client = getCacheRedisClient();
    const keys = await client.keys(pattern);
    
    if (keys.length > 0) {
      await client.del(keys);
    }
    
    // Clear in-memory fallback cache
    redisCache.clear();
    console.log('In-memory fallback cache cleared');
    
    // Clear service-level in-memory caches (avoid circular dependency)
    try {
      // Use global references to avoid circular dependencies
      if (global.queueProcessingService && global.queueProcessingService.clearInMemoryCaches) {
        global.queueProcessingService.clearInMemoryCaches();
        console.log('QueueProcessingService caches cleared via global reference');
      }
      
      if (global.adUpdateProcessingService && global.adUpdateProcessingService.clearInMemoryCaches) {
        global.adUpdateProcessingService.clearInMemoryCaches();
        console.log('AdUpdateProcessingService caches cleared via global reference');
      }
    } catch (serviceError) {
      console.warn('Error clearing service caches:', serviceError.message);
    }
    
  } catch (error) {
    console.error('Queue cache invalidation error:', error);
  }
}

// Clear in-memory fallback cache
function clearInMemoryFallbackCache() {
  redisCache.clear();
  console.log('In-memory fallback cache cleared');
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
  reinitializeCacheRedisClient,
  getCacheRedisClient,
  clearInMemoryFallbackCache,
};

// Set global reference for cache clearing
global.cacheUtils = cacheUtilsExports;

module.exports = cacheUtilsExports;
