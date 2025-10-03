// Dynamic Redis instance getters to ensure we always get the latest connections
function getGlobalRedisInstance() {
  return require("../config/redis").globalRedis;
}

function getWatchlistRedisInstance() {
  return require("../config/redis").watchlistRedis;
}

function getRegularRedisInstance() {
  return require("../config/redis").regularRedis;
}

/**
 * Redis Instance Selector Utility
 * Helps services choose the correct Redis instance based on the operation type
 */

/**
 * Get the appropriate Redis instance based on the operation type
 * @param {string} type - 'global', 'watchlist', or 'regular'
 * @returns {Redis} The appropriate Redis instance
 */
function getRedisInstance(type) {
  switch (type) {
    case 'global':
      return getGlobalRedisInstance();
    case 'watchlist':
      return getWatchlistRedisInstance();
    case 'regular':
      return getRegularRedisInstance();
    default:
      throw new Error(`Invalid Redis type: ${type}. Must be 'global', 'watchlist', or 'regular'`);
  }
}

/**
 * Get all Redis instances
 * @returns {Object} Object containing all Redis instances
 */
function getAllRedisInstances() {
  return {
    global: getGlobalRedisInstance(),
    watchlist: getWatchlistRedisInstance(),
    regular: getRegularRedisInstance()
  };
}

/**
 * Execute operation on multiple Redis instances
 * @param {Array} types - Array of Redis types ['global', 'watchlist', 'regular']
 * @param {Function} operation - Function to execute on each Redis instance
 * @returns {Promise<Array>} Array of results from each Redis instance
 */
async function executeOnMultipleRedis(types, operation) {
  const promises = types.map(type => {
    const redis = getRedisInstance(type);
    return operation(redis, type);
  });
  
  return Promise.all(promises);
}

/**
 * Get Redis instance for queue operations
 * @param {string} queueType - 'regular' or 'watchlist'
 * @returns {Redis} The appropriate Redis instance
 */
function getQueueRedis(queueType) {
  if (queueType === 'watchlist') {
    return getWatchlistRedisInstance();
  } else if (queueType === 'regular') {
    return getRegularRedisInstance();
  } else {
    throw new Error(`Invalid queue type: ${queueType}. Must be 'regular' or 'watchlist'`);
  }
}

/**
 * Get Redis instance for global operations (currently processing, proxy, scraper status)
 * @returns {Redis} Global Redis instance
 */
function getGlobalRedis() {
  return getGlobalRedisInstance();
}

module.exports = {
  getRedisInstance,
  getAllRedisInstances,
  executeOnMultipleRedis,
  getQueueRedis,
  getGlobalRedis,
  getGlobalRedisInstance,
  getWatchlistRedisInstance,
  getRegularRedisInstance
};
