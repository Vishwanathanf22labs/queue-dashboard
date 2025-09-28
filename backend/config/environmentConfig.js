/**
 * Environment Configuration Service
 * Manages environment-specific settings for production and stage environments
 */

// Environment-specific configurations
const ENVIRONMENT_CONFIGS = {
  production: {
    // Database configuration
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || 'Vishwa1720@1720',
    DB_NAME: process.env.DB_NAME || 'facebook_ads_local',
    DB_PORT: process.env.DB_PORT || 5432,

    // Global Redis configuration
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: process.env.REDIS_PORT || 6379,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',

    // Cache Redis configuration
    CACHE_REDIS_HOST: process.env.CACHE_REDIS_HOST || 'localhost',
    CACHE_REDIS_PORT: process.env.CACHE_REDIS_PORT || 6379,
    CACHE_REDIS_PASSWORD: process.env.CACHE_REDIS_PASSWORD || '',

    // Watchlist Redis configuration
    WATCHLIST_REDIS_QUEUE_HOST: process.env.WATCHLIST_REDIS_QUEUE_HOST || 'localhost',
    WATCHLIST_REDIS_QUEUE_PORT: process.env.WATCHLIST_REDIS_QUEUE_PORT || 6379,
    WATCHLIST_REDIS_QUEUE_PASSWORD: process.env.WATCHLIST_REDIS_QUEUE_PASSWORD || '',

    // Regular Redis configuration
    REGULAR_REDIS_QUEUE_HOST: process.env.REGULAR_REDIS_QUEUE_HOST || 'localhost',
    REGULAR_REDIS_QUEUE_PORT: process.env.REGULAR_REDIS_QUEUE_PORT || 6379,
    REGULAR_REDIS_QUEUE_PASSWORD: process.env.REGULAR_REDIS_QUEUE_PASSWORD || '',

    // Queue names
    PENDING_BRANDS_QUEUE: process.env.PENDING_BRANDS_QUEUE || 'pending_brands_prod',
    FAILED_BRANDS_QUEUE: process.env.FAILED_BRANDS_QUEUE || 'failed_brands_prod',
    CURRENTLY_PROCESSING: process.env.CURRENTLY_PROCESSING || 'currently_processing_brand',

    // Scraper URL
    MADANGLES_SCRAPER_URL: process.env.MADANGLES_SCRAPER_URL || 'http://localhost:9898',

    // Admin credentials
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '1234'
  },

  stage: {
    // Database configuration
    DB_HOST: process.env.DB_HOST_STAGE || 'dev.madangles.ai',
    DB_USER: process.env.DB_USER_STAGE || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD_STAGE || '45c75e78a6cc5cd202f2',
    DB_NAME: process.env.DB_NAME_STAGE || 'facebook_ads',
    DB_PORT: process.env.DB_PORT_STAGE || 5442,

    // Global Redis configuration
    REDIS_HOST: process.env.REDIS_HOST_STAGE || 'dev.madangles.ai',
    REDIS_PORT: process.env.REDIS_PORT_STAGE || 7777,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD_STAGE || '1006f5bc749f76fbaff2',

    // Cache Redis configuration
    CACHE_REDIS_HOST: process.env.CACHE_REDIS_HOST_STAGE || 'dev.madangles.ai',
    CACHE_REDIS_PORT: process.env.CACHE_REDIS_PORT_STAGE || 8888,
    CACHE_REDIS_PASSWORD: process.env.CACHE_REDIS_PASSWORD_STAGE || '0f79cf1ab246a44efb1b',

    // Watchlist Redis configuration
    WATCHLIST_REDIS_QUEUE_HOST: process.env.WATCHLIST_REDIS_QUEUE_HOST_STAGE || 'dev.madangles.ai',
    WATCHLIST_REDIS_QUEUE_PORT: process.env.WATCHLIST_REDIS_QUEUE_PORT_STAGE || 5555,
    WATCHLIST_REDIS_QUEUE_PASSWORD: process.env.WATCHLIST_REDIS_QUEUE_PASSWORD_STAGE || '9c62b54bc36936007de5',

    // Regular Redis configuration
    REGULAR_REDIS_QUEUE_HOST: process.env.REGULAR_REDIS_QUEUE_HOST_STAGE || 'dev.madangles.ai',
    REGULAR_REDIS_QUEUE_PORT: process.env.REGULAR_REDIS_QUEUE_PORT_STAGE || 6666,
    REGULAR_REDIS_QUEUE_PASSWORD: process.env.REGULAR_REDIS_QUEUE_PASSWORD_STAGE || '77115c7faa04387a2ecf',

    // Queue names
    PENDING_BRANDS_QUEUE: process.env.PENDING_BRANDS_QUEUE_STAGE || 'pending_brands_stage',
    FAILED_BRANDS_QUEUE: process.env.FAILED_BRANDS_QUEUE_STAGE || 'failed_brands_stage',
    CURRENTLY_PROCESSING: process.env.CURRENTLY_PROCESSING_STAGE || 'currently_processing_brand_stage',

    // Scraper URL
    MADANGLES_SCRAPER_URL: process.env.MADANGLES_SCRAPER_URL_STAGE || 'http://localhost:8084',

    // Admin credentials
    ADMIN_USERNAME: process.env.ADMIN_USERNAME_STAGE || 'admin',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD_STAGE || '1234'
  }
};

// Default environment (can be changed via API)
let currentEnvironment = 'production';

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
    throw new Error(`Invalid environment: ${environment}. Must be 'production' or 'stage'`);
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
    throw new Error(`Invalid environment: ${environment}. Must be 'production' or 'stage'`);
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
    port: config.DB_PORT
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
    case 'global':
      return {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        password: config.REDIS_PASSWORD
      };
    case 'watchlist':
      return {
        host: config.WATCHLIST_REDIS_QUEUE_HOST,
        port: config.WATCHLIST_REDIS_QUEUE_PORT,
        password: config.WATCHLIST_REDIS_QUEUE_PASSWORD
      };
    case 'regular':
      return {
        host: config.REGULAR_REDIS_QUEUE_HOST,
        port: config.REGULAR_REDIS_QUEUE_PORT,
        password: config.REGULAR_REDIS_QUEUE_PASSWORD
      };
    case 'cache':
      return {
        host: config.CACHE_REDIS_HOST,
        port: config.CACHE_REDIS_PORT,
        password: config.CACHE_REDIS_PASSWORD
      };
    default:
      throw new Error(`Invalid Redis type: ${type}. Must be 'global', 'watchlist', 'regular', or 'cache'`);
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
    CURRENTLY_PROCESSING: config.CURRENTLY_PROCESSING
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
    password: config.ADMIN_PASSWORD
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
  ENVIRONMENT_CONFIGS
};
