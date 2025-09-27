// Add caching for Redis operations
const redis = require('redis');
const crypto = require('crypto');

// Fallback in-memory cache
const redisCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// Redis client setup
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
});
redisClient.connect().catch(console.error);

// Cache helper functions
function getCacheKey(prefix, ...args) {
  return `${prefix}:${args.join(":")}`;
}

async function getCachedData(key) {
  try {
    // Try Redis first
    const redisData = await redisClient.get(key);
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
    await redisClient.setEx(key, ttl, serialized);
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

async function setPipelineCache(date, page, perPage, data, sortBy = 'normal', sortOrder = 'desc', lastId = null, ttl = 120) {
  const key = getCacheKey("pipeline", date, `p${page}`, `n${perPage}`, `s${sortBy}`, `o${sortOrder}`, lastId || '');
  return await setCachedData(key, data, ttl);
}

async function getPipelineETag(date, page, perPage, sortBy = 'normal', sortOrder = 'desc', lastId = null) {
  const etagKey = getCacheKey("pipeline", date, `p${page}`, `n${perPage}`, `s${sortBy}`, `o${sortOrder}`, lastId || '', "etag");
  return await getCachedData(etagKey);
}

async function setPipelineETag(date, page, perPage, etag, sortBy = 'normal', sortOrder = 'desc', lastId = null, ttl = 120) {
  const etagKey = getCacheKey("pipeline", date, `p${page}`, `n${perPage}`, `s${sortBy}`, `o${sortOrder}`, lastId || '', "etag");
  return await setCachedData(etagKey, etag, ttl);
}

// Cache invalidation function
async function invalidatePipelineCache(date) {
  try {
    // Get all keys matching the pattern
    const pattern = `pipeline:${date}:*`;
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`🗑️ Invalidated ${keys.length} cache entries for date ${date}`);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

module.exports = {
  getCacheKey,
  getCachedData,
  setCachedData,
  generateETag,
  getPipelineCache,
  setPipelineCache,
  getPipelineETag,
  setPipelineETag,
  invalidatePipelineCache,
};
