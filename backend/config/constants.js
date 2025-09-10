module.exports = {
  // Queue names (same for both regular and watchlist, but in different Redis instances)
  QUEUES: {
    PENDING_BRANDS: process.env.PENDING_BRANDS_QUEUE,
    FAILED_BRANDS: process.env.FAILED_BRANDS_QUEUE,
    CURRENTLY_PROCESSING: process.env.CURRENTLY_PROCESSING
  },

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },

  BATCH_SIZE: 100,

  // Redis Keys organized by Redis instance
  REDIS_KEYS: {
    // Global Redis Keys (Common)
    GLOBAL: {
      CURRENTLY_PROCESSING: process.env.CURRENTLY_PROCESSING,
      PROXY_IPS: "ips",
      PROXY_STATS: "proxy:stats",
      SCRAPER_STATUS: "scraper:status",
      SCRAPER_START_TIME: "scraper:start_time",
      SCRAPER_STOP_TIME: "scraper:stop_time",
      STATS_PREFIX: "stats:",
    },

    // Regular Redis Keys
    REGULAR: {
      PENDING_BRANDS: process.env.PENDING_BRANDS_QUEUE,
      FAILED_BRANDS: process.env.FAILED_BRANDS_QUEUE,
      BULL_PROCESSING_ID: "bull:brand-processing:id",
      BRAND_PROCESSING_PATTERN: "bull:brand-processing:[0-9]*",
      TYPESENSE_PATTERN: "bull:ad-update:[0-9]*",
      TYPESENSE_FAILED_PATTERN: "bull:ad-update:failed:[0-9]*",
      STATS_PREFIX: "stats:",
    },

    // Watchlist Redis Keys
    WATCHLIST: {
      PENDING_BRANDS: process.env.PENDING_BRANDS_QUEUE,
      FAILED_BRANDS: process.env.FAILED_BRANDS_QUEUE,
      BULL_PROCESSING_ID: "bull:brand-processing:id",
      BRAND_PROCESSING_PATTERN: "bull:brand-processing:[0-9]*",
      TYPESENSE_PATTERN: "bull:ad-update:[0-9]*",
      TYPESENSE_FAILED_PATTERN: "bull:ad-update:failed:[0-9]*",
      STATS_PREFIX: "stats:",
    }
  },

  JOB_FETCH_LIMIT: 1000, // Limit for fetching jobs from BullMQ
  MILLISECONDS_PER_DAY: 24 * 60 * 60 * 1000, // Milliseconds in a day
};
