const { getQueueConfig } = require("./environmentConfig");

// Function to get dynamic queue config
function getQueues(environment = null) {
  return getQueueConfig(environment);
}

// Function to get dynamic Redis keys
function getRedisKeys(environment = null) {
  const queueConfig = getQueueConfig(environment);
  return {
    // Global Redis Keys (Common)
    GLOBAL: {
      CURRENTLY_PROCESSING: queueConfig.CURRENTLY_PROCESSING,
      REENQUEUE_KEY: queueConfig.REENQUEUE_KEY,
      PROXY_IPS: "ips",
      PROXY_STATS: "proxy:stats",
      SCRAPER_STATUS: "scraper:status",
      SCRAPER_START_TIME: "scraper:start_time",
      SCRAPER_STOP_TIME: "scraper:stop_time",
      STATS_PREFIX: "stats:",
    },

    // Regular Redis Keys
    REGULAR: {
      PENDING_BRANDS: queueConfig.PENDING_BRANDS,
      FAILED_BRANDS: queueConfig.FAILED_BRANDS,
      BULL_PROCESSING_ID: "bull:brand-processing:id",
      BRAND_PROCESSING_PATTERN: "bull:brand-processing:[0-9]*",
      TYPESENSE_PATTERN: "bull:ad-update:[0-9]*",
      TYPESENSE_FAILED_PATTERN: "bull:ad-update:failed:[0-9]*",
      STATS_PREFIX: "stats:",
    },

    // Watchlist Redis Keys
    WATCHLIST: {
      PENDING_BRANDS: queueConfig.PENDING_BRANDS,
      FAILED_BRANDS: queueConfig.FAILED_BRANDS,
      BULL_PROCESSING_ID: "bull:brand-processing:id",
      BRAND_PROCESSING_PATTERN: "bull:brand-processing:[0-9]*",
      TYPESENSE_PATTERN: "bull:ad-update:[0-9]*",
      TYPESENSE_FAILED_PATTERN: "bull:ad-update:failed:[0-9]*",
      STATS_PREFIX: "stats:",
    }
  };
}

module.exports = {
  // Queue names (dynamic based on current environment)
  get QUEUES() {
    return getQueues();
  },

  // Get queue config for specific environment
  getQueues,

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },

  BATCH_SIZE: 100,

  // Redis Keys organized by Redis instance (dynamic based on current environment)
  get REDIS_KEYS() {
    return getRedisKeys();
  },

  // Get Redis keys for specific environment
  getRedisKeys,

  JOB_FETCH_LIMIT: 1000, // Limit for fetching jobs from BullMQ
  MILLISECONDS_PER_DAY: 24 * 60 * 60 * 1000, // Milliseconds in a day
};
