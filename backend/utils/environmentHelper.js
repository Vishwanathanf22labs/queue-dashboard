const { getDatabaseConnection } = require("../config/database");
const { getRedisConnection } = require("../config/redis");
const { getModels } = require("../models");

function getEnvironmentResources(req) {
  const environment = req.environment || "production";

  return {
    environment,
    db: getDatabaseConnection(environment),
    models: getModels(environment),
    redis: {
      global: getRedisConnection("global", environment),
      watchlist: getRedisConnection("watchlist", environment),
      regular: getRedisConnection("regular", environment),
    },
  };
}

function getEnvironmentModels(req) {
  const environment = req.environment || "production";
  return getModels(environment);
}

function getEnvironmentDatabase(req) {
  const environment = req.environment || "production";
  return getDatabaseConnection(environment);
}

function getEnvironmentRedis(req, type = "global") {
  const environment = req.environment || "production";
  return getRedisConnection(type, environment);
}

module.exports = {
  getEnvironmentResources,
  getEnvironmentModels,
  getEnvironmentDatabase,
  getEnvironmentRedis,
};
