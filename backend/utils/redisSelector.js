function getGlobalRedisInstance(environment = "production") {
  const { getRedisConnection } = require("../config/redis");
  return getRedisConnection("global", environment);
}

function getWatchlistRedisInstance(environment = "production") {
  const { getRedisConnection } = require("../config/redis");
  return getRedisConnection("watchlist", environment);
}

function getRegularRedisInstance(environment = "production") {
  const { getRedisConnection } = require("../config/redis");
  return getRedisConnection("regular", environment);
}

function getRedisInstance(type, environment = "production") {
  switch (type) {
    case "global":
      return getGlobalRedisInstance(environment);
    case "watchlist":
      return getWatchlistRedisInstance(environment);
    case "regular":
      return getRegularRedisInstance(environment);
    default:
      throw new Error(
        `Invalid Redis type: ${type}. Must be 'global', 'watchlist', or 'regular'`
      );
  }
}

function getAllRedisInstances(environment = "production") {
  return {
    global: getGlobalRedisInstance(environment),
    watchlist: getWatchlistRedisInstance(environment),
    regular: getRegularRedisInstance(environment),
  };
}

async function executeOnMultipleRedis(
  types,
  operation,
  environment = "production"
) {
  const promises = types.map((type) => {
    const redis = getRedisInstance(type, environment);
    return operation(redis, type);
  });

  return Promise.all(promises);
}

function getQueueRedis(queueType, environment = "production") {
  if (queueType === "watchlist") {
    return getWatchlistRedisInstance(environment);
  } else if (queueType === "regular") {
    return getRegularRedisInstance(environment);
  } else {
    throw new Error(
      `Invalid queue type: ${queueType}. Must be 'regular' or 'watchlist'`
    );
  }
}

function getGlobalRedis(environment = "production") {
  return getGlobalRedisInstance(environment);
}

module.exports = {
  getRedisInstance,
  getAllRedisInstances,
  executeOnMultipleRedis,
  getQueueRedis,
  getGlobalRedis,
  getGlobalRedisInstance,
  getWatchlistRedisInstance,
  getRegularRedisInstance,
};
