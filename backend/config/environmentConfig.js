/**
 * Environment Configuration Service
 * Manages environment-specific settings for production and stage environments
 */

// ✅ CRITICAL: Load dotenv FIRST before anything else
require("dotenv").config();

// Environment-specific configurations
const ENVIRONMENT_CONFIGS = {
  production: {
    // Database configuration
    DB_HOST: process.env.DB_HOST,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_PORT: process.env.DB_PORT,

    // Global Redis configuration
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,

    // Cache Redis configuration
    CACHE_REDIS_HOST: process.env.CACHE_REDIS_HOST,
    CACHE_REDIS_PORT: process.env.CACHE_REDIS_PORT,
    CACHE_REDIS_PASSWORD: process.env.CACHE_REDIS_PASSWORD,

    // Watchlist Redis configuration
    WATCHLIST_REDIS_QUEUE_HOST: process.env.WATCHLIST_REDIS_QUEUE_HOST,
    WATCHLIST_REDIS_QUEUE_PORT: process.env.WATCHLIST_REDIS_QUEUE_PORT,
    WATCHLIST_REDIS_QUEUE_PASSWORD: process.env.WATCHLIST_REDIS_QUEUE_PASSWORD,

    // Regular Redis configuration
    REGULAR_REDIS_QUEUE_HOST: process.env.REGULAR_REDIS_QUEUE_HOST,
    REGULAR_REDIS_QUEUE_PORT: process.env.REGULAR_REDIS_QUEUE_PORT,
    REGULAR_REDIS_QUEUE_PASSWORD: process.env.REGULAR_REDIS_QUEUE_PASSWORD,

    // Queue names
    PENDING_BRANDS_QUEUE: process.env.PENDING_BRANDS_QUEUE,
    FAILED_BRANDS_QUEUE: process.env.FAILED_BRANDS_QUEUE,
    CURRENTLY_PROCESSING: process.env.CURRENTLY_PROCESSING,

    // Scraper URL
    MADANGLES_SCRAPER_URL: process.env.MADANGLES_SCRAPER_URL,

    // Admin credentials
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  },

  stage: {
    // Database configuration
    DB_HOST: process.env.DB_HOST_STAGE,
    DB_USER: process.env.DB_USER_STAGE,
    DB_PASSWORD: process.env.DB_PASSWORD_STAGE,
    DB_NAME: process.env.DB_NAME_STAGE,
    DB_PORT: process.env.DB_PORT_STAGE,

    // Global Redis configuration
    REDIS_HOST: process.env.REDIS_HOST_STAGE,
    REDIS_PORT: process.env.REDIS_PORT_STAGE,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD_STAGE,

    // Cache Redis configuration
    CACHE_REDIS_HOST: process.env.CACHE_REDIS_HOST_STAGE,
    CACHE_REDIS_PORT: process.env.CACHE_REDIS_PORT_STAGE,
    CACHE_REDIS_PASSWORD: process.env.CACHE_REDIS_PASSWORD_STAGE,

    // Watchlist Redis configuration
    WATCHLIST_REDIS_QUEUE_HOST: process.env.WATCHLIST_REDIS_QUEUE_HOST_STAGE,
    WATCHLIST_REDIS_QUEUE_PORT: process.env.WATCHLIST_REDIS_QUEUE_PORT_STAGE,
    WATCHLIST_REDIS_QUEUE_PASSWORD:
      process.env.WATCHLIST_REDIS_QUEUE_PASSWORD_STAGE,

    // Regular Redis configuration
    REGULAR_REDIS_QUEUE_HOST: process.env.REGULAR_REDIS_QUEUE_HOST_STAGE,
    REGULAR_REDIS_QUEUE_PORT: process.env.REGULAR_REDIS_QUEUE_PORT_STAGE,
    REGULAR_REDIS_QUEUE_PASSWORD:
      process.env.REGULAR_REDIS_QUEUE_PASSWORD_STAGE,

    // Queue names
    PENDING_BRANDS_QUEUE: process.env.PENDING_BRANDS_QUEUE_STAGE,
    FAILED_BRANDS_QUEUE: process.env.FAILED_BRANDS_QUEUE_STAGE,
    CURRENTLY_PROCESSING: process.env.CURRENTLY_PROCESSING_STAGE,

    // Scraper URL
    MADANGLES_SCRAPER_URL: process.env.MADANGLES_SCRAPER_URL_STAGE,

    // Admin credentials
    ADMIN_USERNAME: process.env.ADMIN_USERNAME_STAGE,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD_STAGE,
  },
};

// Default environment (can be changed via API)
let currentEnvironment = "production";

/**
 * Get the current environment
 * @returns {string} Current environment name
 */
function getCurrentEnvironment() {
  return currentEnvironment;
}

/**
 * Set the current environment
 * @param {string} environment - Environment name ('production' or 'stage')
 */
function setCurrentEnvironment(environment) {
  if (!ENVIRONMENT_CONFIGS[environment]) {
    throw new Error(
      `Invalid environment: ${environment}. Must be 'production' or 'stage'`
    );
  }
  currentEnvironment = environment;
}

/**
 * Get configuration for the current environment
 * @returns {Object} Current environment configuration
 */
function getCurrentConfig() {
  return ENVIRONMENT_CONFIGS[currentEnvironment];
}

/**
 * Get configuration for a specific environment
 * @param {string} environment - Environment name
 * @returns {Object} Environment configuration
 */
function getConfig(environment) {
  if (!ENVIRONMENT_CONFIGS[environment]) {
    throw new Error(
      `Invalid environment: ${environment}. Must be 'production' or 'stage'`
    );
  }
  return ENVIRONMENT_CONFIGS[environment];
}

/**
 * Get all available environments
 * @returns {Array} Array of available environment names
 */
function getAvailableEnvironments() {
  return Object.keys(ENVIRONMENT_CONFIGS);
}

/**
 * Get environment-specific database configuration
 * @param {string} environment - Environment name (optional, uses current if not provided)
 * @returns {Object} Database configuration
 */
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

/**
 * Get environment-specific Redis configuration
 * @param {string} type - Redis type ('global', 'watchlist', 'regular', 'cache')
 * @param {string} environment - Environment name (optional, uses current if not provided)
 * @returns {Object} Redis configuration
 */
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

/**
 * Get environment-specific queue configuration
 * @param {string} environment - Environment name (optional, uses current if not provided)
 * @returns {Object} Queue configuration
 */
function getQueueConfig(environment = null) {
  const env = environment || currentEnvironment;
  const config = getConfig(env);
  return {
    PENDING_BRANDS: config.PENDING_BRANDS_QUEUE,
    FAILED_BRANDS: config.FAILED_BRANDS_QUEUE,
    CURRENTLY_PROCESSING: config.CURRENTLY_PROCESSING,
  };
}

/**
 * Get environment-specific admin credentials
 * @param {string} environment - Environment name (optional, uses current if not provided)
 * @returns {Object} Admin credentials
 */
function getAdminConfig(environment = null) {
  const env = environment || currentEnvironment;
  const config = getConfig(env);
  return {
    username: config.ADMIN_USERNAME,
    password: config.ADMIN_PASSWORD,
  };
}

/**
 * Get environment-specific scraper URL
 * @param {string} environment - Environment name (optional, uses current if not provided)
 * @returns {string} Scraper URL
 */
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
