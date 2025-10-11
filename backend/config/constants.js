const { getQueueConfig } = require("./environmentConfig");

function getQueues(environment = null) {
  return getQueueConfig(environment);
}

function getRedisKeys(environment = null) {
  const queueConfig = getQueueConfig(environment);
  return {
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

    REGULAR: {
      PENDING_BRANDS: queueConfig.PENDING_BRANDS,
      FAILED_BRANDS: queueConfig.FAILED_BRANDS,
      BULL_PROCESSING_ID: "bull:brand-processing:id",
      BRAND_PROCESSING_PATTERN: "bull:brand-processing:[0-9]*",
      TYPESENSE_PATTERN: "bull:ad-update:[0-9]*",
      TYPESENSE_FAILED_PATTERN: "bull:ad-update:failed:[0-9]*",
      STATS_PREFIX: "stats:",
    },

    WATCHLIST: {
      PENDING_BRANDS: queueConfig.PENDING_BRANDS,
      FAILED_BRANDS: queueConfig.FAILED_BRANDS,
      BULL_PROCESSING_ID: "bull:brand-processing:id",
      BRAND_PROCESSING_PATTERN: "bull:brand-processing:[0-9]*",
      TYPESENSE_PATTERN: "bull:ad-update:[0-9]*",
      TYPESENSE_FAILED_PATTERN: "bull:ad-update:failed:[0-9]*",
      STATS_PREFIX: "stats:",
    },
  };
}

module.exports = {
  get QUEUES() {
    return getQueues();
  },

  getQueues,

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },

  BATCH_SIZE: 100,

  get REDIS_KEYS() {
    return getRedisKeys();
  },

  getRedisKeys,

  JOB_FETCH_LIMIT: 1000,
  MILLISECONDS_PER_DAY: 24 * 60 * 60 * 1000,
};
