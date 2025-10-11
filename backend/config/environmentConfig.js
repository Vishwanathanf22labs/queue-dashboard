require("dotenv").config();

const ENVIRONMENT_CONFIGS = {
  production: {
    DB_HOST: process.env.DB_HOST,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_PORT: process.env.DB_PORT,

    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,

    CACHE_REDIS_HOST: process.env.CACHE_REDIS_HOST,
    CACHE_REDIS_PORT: process.env.CACHE_REDIS_PORT,
    CACHE_REDIS_PASSWORD: process.env.CACHE_REDIS_PASSWORD,

    WATCHLIST_REDIS_QUEUE_HOST: process.env.WATCHLIST_REDIS_QUEUE_HOST,
    WATCHLIST_REDIS_QUEUE_PORT: process.env.WATCHLIST_REDIS_QUEUE_PORT,
    WATCHLIST_REDIS_QUEUE_PASSWORD: process.env.WATCHLIST_REDIS_QUEUE_PASSWORD,

    REGULAR_REDIS_QUEUE_HOST: process.env.REGULAR_REDIS_QUEUE_HOST,
    REGULAR_REDIS_QUEUE_PORT: process.env.REGULAR_REDIS_QUEUE_PORT,
    REGULAR_REDIS_QUEUE_PASSWORD: process.env.REGULAR_REDIS_QUEUE_PASSWORD,

    PENDING_BRANDS_QUEUE: process.env.PENDING_BRANDS_QUEUE,
    FAILED_BRANDS_QUEUE: process.env.FAILED_BRANDS_QUEUE,
    CURRENTLY_PROCESSING: process.env.CURRENTLY_PROCESSING,
    REENQUEUE_KEY: process.env.REENQUEUE_KEY,

    MADANGLES_SCRAPER_URL: process.env.MADANGLES_SCRAPER_URL,

    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  },

  stage: {
    DB_HOST: process.env.DB_HOST_STAGE,
    DB_USER: process.env.DB_USER_STAGE,
    DB_PASSWORD: process.env.DB_PASSWORD_STAGE,
    DB_NAME: process.env.DB_NAME_STAGE,
    DB_PORT: process.env.DB_PORT_STAGE,

    REDIS_HOST: process.env.REDIS_HOST_STAGE,
    REDIS_PORT: process.env.REDIS_PORT_STAGE,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD_STAGE,

    CACHE_REDIS_HOST: process.env.CACHE_REDIS_HOST_STAGE,
    CACHE_REDIS_PORT: process.env.CACHE_REDIS_PORT_STAGE,
    CACHE_REDIS_PASSWORD: process.env.CACHE_REDIS_PASSWORD_STAGE,

    WATCHLIST_REDIS_QUEUE_HOST: process.env.WATCHLIST_REDIS_QUEUE_HOST_STAGE,
    WATCHLIST_REDIS_QUEUE_PORT: process.env.WATCHLIST_REDIS_QUEUE_PORT_STAGE,
    WATCHLIST_REDIS_QUEUE_PASSWORD:
      process.env.WATCHLIST_REDIS_QUEUE_PASSWORD_STAGE,

    REGULAR_REDIS_QUEUE_HOST: process.env.REGULAR_REDIS_QUEUE_HOST_STAGE,
    REGULAR_REDIS_QUEUE_PORT: process.env.REGULAR_REDIS_QUEUE_PORT_STAGE,
    REGULAR_REDIS_QUEUE_PASSWORD:
      process.env.REGULAR_REDIS_QUEUE_PASSWORD_STAGE,

    PENDING_BRANDS_QUEUE: process.env.PENDING_BRANDS_QUEUE_STAGE,
    FAILED_BRANDS_QUEUE: process.env.FAILED_BRANDS_QUEUE_STAGE,
    CURRENTLY_PROCESSING: process.env.CURRENTLY_PROCESSING_STAGE,
    REENQUEUE_KEY: process.env.REENQUEUE_KEY_STAGE,

    MADANGLES_SCRAPER_URL: process.env.MADANGLES_SCRAPER_URL_STAGE,

    ADMIN_USERNAME: process.env.ADMIN_USERNAME_STAGE,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD_STAGE,
  },
};

let currentEnvironment = "production";

function getCurrentEnvironment() {
  return currentEnvironment;
}

function setCurrentEnvironment(environment) {
  if (!ENVIRONMENT_CONFIGS[environment]) {
    throw new Error(
      `Invalid environment: ${environment}. Must be 'production' or 'stage'`
    );
  }
  currentEnvironment = environment;
}

function getCurrentConfig() {
  return ENVIRONMENT_CONFIGS[currentEnvironment];
}

function getConfig(environment) {
  if (!ENVIRONMENT_CONFIGS[environment]) {
    throw new Error(
      `Invalid environment: ${environment}. Must be 'production' or 'stage'`
    );
  }
  return ENVIRONMENT_CONFIGS[environment];
}

function getAvailableEnvironments() {
  return Object.keys(ENVIRONMENT_CONFIGS);
}

function getDatabaseConfig(environment = null) {
  const env = environment || currentEnvironment;
  const config = getConfig(env);
  return {
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    port: config.DB_PORT,
  };
}

function getRedisConfig(type, environment = null) {
  const env = environment || currentEnvironment;
  const config = getConfig(env);

  switch (type) {
    case "global":
      return {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        password: config.REDIS_PASSWORD,
      };
    case "watchlist":
      return {
        host: config.WATCHLIST_REDIS_QUEUE_HOST,
        port: config.WATCHLIST_REDIS_QUEUE_PORT,
        password: config.WATCHLIST_REDIS_QUEUE_PASSWORD,
      };
    case "regular":
      return {
        host: config.REGULAR_REDIS_QUEUE_HOST,
        port: config.REGULAR_REDIS_QUEUE_PORT,
        password: config.REGULAR_REDIS_QUEUE_PASSWORD,
      };
    case "cache":
      return {
        host: config.CACHE_REDIS_HOST,
        port: config.CACHE_REDIS_PORT,
        password: config.CACHE_REDIS_PASSWORD,
      };
    default:
      throw new Error(
        `Invalid Redis type: ${type}. Must be 'global', 'watchlist', 'regular', or 'cache'`
      );
  }
}

function getQueueConfig(environment = null) {
  const env = environment || currentEnvironment;
  const config = getConfig(env);
  return {
    PENDING_BRANDS: config.PENDING_BRANDS_QUEUE,
    FAILED_BRANDS: config.FAILED_BRANDS_QUEUE,
    CURRENTLY_PROCESSING: config.CURRENTLY_PROCESSING,
    REENQUEUE_KEY: config.REENQUEUE_KEY,
  };
}

function getAdminConfig(environment = null) {
  const env = environment || currentEnvironment;
  const config = getConfig(env);
  return {
    username: config.ADMIN_USERNAME,
    password: config.ADMIN_PASSWORD,
  };
}

function getScraperUrl(environment = null) {
  const env = environment || currentEnvironment;
  const config = getConfig(env);
  return config.MADANGLES_SCRAPER_URL;
}

module.exports = {
  getCurrentEnvironment,
  setCurrentEnvironment,
  getCurrentConfig,
  getConfig,
  getAvailableEnvironments,
  getDatabaseConfig,
  getRedisConfig,
  getQueueConfig,
  getAdminConfig,
  getScraperUrl,
  ENVIRONMENT_CONFIGS,
};
