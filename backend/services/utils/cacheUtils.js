// Add caching for Redis operations
const redisCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// Cache helper functions
function getCacheKey(prefix, ...args) {
  return `${prefix}:${args.join(":")}`;
}

function getCachedData(key) {
  const cached = redisCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  redisCache.delete(key);
  return null;
}

function setCachedData(key, data) {
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
}

module.exports = {
  getCacheKey,
  getCachedData,
  setCachedData,
};
