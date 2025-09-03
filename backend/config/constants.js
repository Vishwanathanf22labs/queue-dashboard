module.exports = {
  QUEUES: {
    PENDING_BRANDS: process.env.PENDING_BRANDS_QUEUE,
    FAILED_BRANDS: process.env.FAILED_BRANDS_QUEUE,
    WATCHLIST_PENDING: process.env.WATCHLIST_PENDING_BRANDS_PROD,
    WATCHLIST_FAILED: process.env.WATCHLIST_FAILED_BRANDS_PROD,
    CURRENTLY_PROCESSING: process.env.CURRENTLY_PROCESSING
  },

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },

  BATCH_SIZE: 100,

  REDIS_KEYS: {
    BULL_PROCESSING_ID: "bull:brand-processing:id",
    BRAND_PROCESSING_PATTERN: "bull:brand-processing:[0-9]*",
    STATS_PREFIX: "stats:",
    PROXY_IPS: "ips", // Changed from "proxy:ips" to "ips" for hash storage
    PROXY_STATS: "proxy:stats",
    WATCHLIST_PENDING: process.env.WATCHLIST_PENDING_BRANDS_PROD,
    WATCHLIST_FAILED: process.env.WATCHLIST_FAILED_BRANDS_PROD,
    CURRENTLY_PROCESSING: process.env.CURRENTLY_PROCESSING,
  },
  JOB_FETCH_LIMIT: 1000, // Limit for fetching jobs from BullMQ
  MILLISECONDS_PER_DAY: 24 * 60 * 60 * 1000, // Milliseconds in a day
};
