const Redis = require("ioredis");
require("dotenv").config();

// Global Redis (Common) - currently_processing_brand, proxy, ips, scraper status
const globalRedis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
});

// Watchlist Redis - watchlist pending_queue, watchlist failed_queue, watchlist brand processing, watchlist typesense, watchlist stats
const watchlistRedis = new Redis({
  host: process.env.WATCHLIST_REDIS_QUEUE_HOST,
  port: process.env.WATCHLIST_REDIS_QUEUE_PORT,
  password: process.env.WATCHLIST_REDIS_QUEUE_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
});

// Regular Redis - pending_queue, failed_queue, regular brand processing, regular typesense, regular stats
const regularRedis = new Redis({
  host: process.env.REGULAR_REDIS_QUEUE_HOST,
  port: process.env.REGULAR_REDIS_QUEUE_PORT,
  password: process.env.REGULAR_REDIS_QUEUE_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
});


globalRedis.on("connect", () => {
  console.log("Global Redis connected successfully");
});

globalRedis.on("error", (err) => {
  console.error("Global Redis connection error:", err);
});

globalRedis.on("ready", () => {
  console.log("Global Redis is ready for operations");
});

globalRedis.on("close", () => {
  console.log("Global Redis connection closed");
});

globalRedis.on("reconnecting", () => {
  console.log("Global Redis reconnecting...");
});


watchlistRedis.on("connect", () => {
  console.log("Watchlist Redis connected successfully");
});

watchlistRedis.on("error", (err) => {
  console.error("Watchlist Redis connection error:", err);
});

watchlistRedis.on("ready", () => {
  console.log("Watchlist Redis is ready for operations");
});

watchlistRedis.on("close", () => {
  console.log("Watchlist Redis connection closed");
});

watchlistRedis.on("reconnecting", () => {
  console.log("Watchlist Redis reconnecting...");
});


regularRedis.on("connect", () => {
  console.log("Regular Redis connected successfully");
});

regularRedis.on("error", (err) => {
  console.error("Regular Redis connection error:", err);
});

regularRedis.on("ready", () => {
  console.log("Regular Redis is ready for operations");
});

regularRedis.on("close", () => {
  console.log("Regular Redis connection closed");
});

regularRedis.on("reconnecting", () => {
  console.log("Regular Redis reconnecting...");
});

module.exports = {
  globalRedis,
  watchlistRedis,
  regularRedis,
  redis: globalRedis
};
