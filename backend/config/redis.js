const Redis = require("ioredis");
require("dotenv").config();
const { getRedisConfig } = require("./environmentConfig");

// Get Redis configurations based on current environment
const globalRedisConfig = getRedisConfig('global');
const watchlistRedisConfig = getRedisConfig('watchlist');
const regularRedisConfig = getRedisConfig('regular');

// Global Redis (Common) - currently_processing_brand, proxy, ips, scraper status
const globalRedis = new Redis({
  host: globalRedisConfig.host,
  port: globalRedisConfig.port,
  password: globalRedisConfig.password,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
});

// Watchlist Redis - watchlist pending_queue, watchlist failed_queue, watchlist brand processing, watchlist typesense, watchlist stats
const watchlistRedis = new Redis({
  host: watchlistRedisConfig.host,
  port: watchlistRedisConfig.port,
  password: watchlistRedisConfig.password,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
});

// Regular Redis - pending_queue, failed_queue, regular brand processing, regular typesense, regular stats
const regularRedis = new Redis({
  host: regularRedisConfig.host,
  port: regularRedisConfig.port,
  password: regularRedisConfig.password,
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

// Function to reinitialize Redis connections with current environment settings
async function reinitializeRedis() {
  try {
    
    // Close existing connections
    if (globalRedis) {
      try {
        await globalRedis.quit();
        console.log("Previous global Redis connection closed");
      } catch (closeError) {
        console.log("Error closing previous global Redis connection (expected):", closeError.message);
      }
    }
    
    if (watchlistRedis) {
      try {
        await watchlistRedis.quit();
        console.log("Previous watchlist Redis connection closed");
      } catch (closeError) {
        console.log("Error closing previous watchlist Redis connection (expected):", closeError.message);
      }
    }
    
    if (regularRedis) {
      try {
        await regularRedis.quit();
        console.log("Previous regular Redis connection closed");
      } catch (closeError) {
        console.log("Error closing previous regular Redis connection (expected):", closeError.message);
      }
    }
    
    // Wait a moment for connections to fully close
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get fresh Redis configurations based on current environment
    const globalRedisConfig = getRedisConfig('global');
    const watchlistRedisConfig = getRedisConfig('watchlist');
    const regularRedisConfig = getRedisConfig('regular');
    
    console.log("Creating new Redis connections with environment-specific settings:");
    console.log("  Global Redis:", `${globalRedisConfig.host}:${globalRedisConfig.port}`);
    console.log("  Watchlist Redis:", `${watchlistRedisConfig.host}:${watchlistRedisConfig.port}`);
    console.log("  Regular Redis:", `${regularRedisConfig.host}:${regularRedisConfig.port}`);
    
    // Create new Redis instances (these will be exported)
    const newGlobalRedis = new Redis({
      host: globalRedisConfig.host,
      port: globalRedisConfig.port,
      password: globalRedisConfig.password,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
    });
    
    const newWatchlistRedis = new Redis({
      host: watchlistRedisConfig.host,
      port: watchlistRedisConfig.port,
      password: watchlistRedisConfig.password,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
    });
    
    const newRegularRedis = new Redis({
      host: regularRedisConfig.host,
      port: regularRedisConfig.port,
      password: regularRedisConfig.password,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
    });
    
    // Add event listeners
    newGlobalRedis.on("connect", () => {
    });
    newGlobalRedis.on("error", (err) => {
      console.error("New Global Redis connection error:", err);
    });
    
    newWatchlistRedis.on("connect", () => {
    });
    newWatchlistRedis.on("error", (err) => {
      console.error("New Watchlist Redis connection error:", err);
    });
    
    newRegularRedis.on("connect", () => {
    });
    newRegularRedis.on("error", (err) => {
      console.error("New Regular Redis connection error:", err);
    });
    
    // Update module exports
    module.exports.globalRedis = newGlobalRedis;
    module.exports.watchlistRedis = newWatchlistRedis;
    module.exports.regularRedis = newRegularRedis;
    module.exports.redis = newGlobalRedis;
    
    
    return {
      globalRedis: newGlobalRedis,
      watchlistRedis: newWatchlistRedis,
      regularRedis: newRegularRedis
    };
  } catch (error) {
    console.error(" Redis reinitialization error:", error);
    throw error;
  }
}

module.exports = {
  globalRedis,
  watchlistRedis,
  regularRedis,
  redis: globalRedis,
  reinitializeRedis
};
