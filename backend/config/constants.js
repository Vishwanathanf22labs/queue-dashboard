module.exports = {
  QUEUES: {
    PENDING_BRANDS: process.env.PENDING_BRANDS_QUEUE,
    FAILED_BRANDS: process.env.FAILED_BRANDS_QUEUE,
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
    PROXY_IPS: "proxy:ips",
    PROXY_STATS: "proxy:stats",
  },
  JOB_FETCH_LIMIT: 1000, // Limit for fetching jobs from BullMQ
  MILLISECONDS_PER_DAY: 24 * 60 * 60 * 1000, // Milliseconds in a day
};
