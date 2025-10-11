const Redis = require("ioredis");
require("dotenv").config();
const { getRedisConfig } = require("./environmentConfig");

const connections = {
  production: {
    global: null,
    watchlist: null,
    regular: null,
  },
  stage: {
    global: null,
    watchlist: null,
    regular: null,
  },
};

function createRedisConnection(type, environment) {
  const config = getRedisConfig(type, environment);

  const redis = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    connectTimeout: 10000,
    commandTimeout: 5000,
    lazyConnect: false,
    enableOfflineQueue: true,
    family: 4,
    keepAlive: true,
    maxClients: 100,
  });

  redis.on("connect", () => {
    console.log(
      `${type} Redis connected [${environment}]: ${config.host}:${config.port}`
    );
  });

  redis.on("error", (err) => {
    console.error(` ${type} Redis error [${environment}]:`, err.message);
  });

  redis.on("ready", () => {
    console.log(`${type} Redis ready [${environment}]`);
  });

  redis.on("close", () => {
    console.log(`${type} Redis connection closed [${environment}]`);
  });

  redis.on("reconnecting", () => {
    console.log(`${type} Redis reconnecting [${environment}]...`);
  });

  return redis;
}

function getRedisConnection(type, environment = "production") {
  if (!connections[environment]) {
    throw new Error(`Invalid environment: ${environment}`);
  }

  if (
    !connections[environment][type] ||
    connections[environment][type].status !== "ready"
  ) {
    if (connections[environment][type]) {
      try {
        connections[environment][type].disconnect();
        console.log(`Closed stale ${type} Redis connection [${environment}]`);
      } catch (error) {
        console.warn(
          `Error closing stale ${type} Redis connection:`,
          error.message
        );
      }
    }
    connections[environment][type] = createRedisConnection(type, environment);
  }

  return connections[environment][type];
}

console.log("Initializing Redis connections for all environments...");
const environments = ["production", "stage"];
const types = ["global", "watchlist", "regular"];

environments.forEach((env) => {
  types.forEach((type) => {
    getRedisConnection(type, env);
  });
});

const globalRedis = getRedisConnection("global", "production");
const watchlistRedis = getRedisConnection("watchlist", "production");
const regularRedis = getRedisConnection("regular", "production");

async function reinitializeRedis() {
  try {
    console.log("Reinitializing Redis connections...");

    for (const env of ["production", "stage"]) {
      for (const type of ["global", "watchlist", "regular"]) {
        if (connections[env] && connections[env][type]) {
          try {
            await connections[env][type].quit();
            console.log(`Closed ${type} Redis connection [${env}]`);
          } catch (closeError) {
            console.log(
              `Error closing ${type} Redis connection [${env}] (expected):`,
              closeError.message
            );
          }
          connections[env][type] = null;
        }
      }
    }

    if (globalRedis && globalRedis.status !== "end") {
      try {
        await globalRedis.quit();
        console.log("Previous global Redis connection closed");
      } catch (closeError) {
        console.log(
          "Error closing previous global Redis connection (expected):",
          closeError.message
        );
      }
    }

    if (watchlistRedis && watchlistRedis.status !== "end") {
      try {
        await watchlistRedis.quit();
        console.log("Previous watchlist Redis connection closed");
      } catch (closeError) {
        console.log(
          "Error closing previous watchlist Redis connection (expected):",
          closeError.message
        );
      }
    }

    if (regularRedis && regularRedis.status !== "end") {
      try {
        await regularRedis.quit();
        console.log("Previous regular Redis connection closed");
      } catch (closeError) {
        console.log(
          "Error closing previous regular Redis connection (expected):",
          closeError.message
        );
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const globalRedisConfig = getRedisConfig("global");
    const watchlistRedisConfig = getRedisConfig("watchlist");
    const regularRedisConfig = getRedisConfig("regular");

    console.log(
      "Creating new Redis connections with environment-specific settings:"
    );
    console.log(
      "  Global Redis:",
      `${globalRedisConfig.host}:${globalRedisConfig.port}`
    );
    console.log(
      "  Watchlist Redis:",
      `${watchlistRedisConfig.host}:${watchlistRedisConfig.port}`
    );
    console.log(
      "  Regular Redis:",
      `${regularRedisConfig.host}:${regularRedisConfig.port}`
    );

    const newGlobalRedis = getRedisConnection("global", "production");
    const newWatchlistRedis = getRedisConnection("watchlist", "production");
    const newRegularRedis = getRedisConnection("regular", "production");

    newGlobalRedis.on("connect", () => {});
    newGlobalRedis.on("error", (err) => {
      console.error("New Global Redis connection error:", err);
    });

    newWatchlistRedis.on("connect", () => {});
    newWatchlistRedis.on("error", (err) => {
      console.error("New Watchlist Redis connection error:", err);
    });

    newRegularRedis.on("connect", () => {});
    newRegularRedis.on("error", (err) => {
      console.error("New Regular Redis connection error:", err);
    });

    module.exports.globalRedis = newGlobalRedis;
    module.exports.watchlistRedis = newWatchlistRedis;
    module.exports.regularRedis = newRegularRedis;
    module.exports.redis = newGlobalRedis;

    return {
      globalRedis: newGlobalRedis,
      watchlistRedis: newWatchlistRedis,
      regularRedis: newRegularRedis,
    };
  } catch (error) {
    console.error("Redis reinitialization error:", error);
    throw error;
  }
}

let connectionCount = 0;
const MAX_CONNECTIONS = 50;

function monitorConnections() {
  connectionCount = 0;
  for (const env of ["production", "stage"]) {
    for (const type of ["global", "watchlist", "regular"]) {
      if (connections[env] && connections[env][type]) {
        connectionCount++;
      }
    }
  }

  if (connectionCount > MAX_CONNECTIONS) {
    console.warn(
      `High Redis connection count: ${connectionCount}/${MAX_CONNECTIONS}`
    );
  }

  console.log(`Redis connections: ${connectionCount} active`);
}

setInterval(monitorConnections, 30000);

process.on("unhandledRejection", (reason, promise) => {
  if (
    reason &&
    reason.message &&
    reason.message.includes("max number of clients reached")
  ) {
    console.error("Redis max clients reached - connection pool exhausted");
    console.error("This indicates a connection leak - check redisUtils.js");
    console.error("Error details:", reason.message);

    monitorConnections();

    console.log("Attempting to clean up stale connections...");
    for (const env of ["production", "stage"]) {
      for (const type of ["global", "watchlist", "regular"]) {
        if (connections[env] && connections[env][type]) {
          const redis = connections[env][type];
          if (redis.status === "end" || redis.status === "close") {
            connections[env][type] = null;
            console.log(`Cleaned up stale ${type} connection [${env}]`);
          }
        }
      }
    }
  }
});

process.on("SIGINT", async () => {
  console.log("Shutting down Redis connections...");
  for (const env of ["production", "stage"]) {
    for (const type of ["global", "watchlist", "regular"]) {
      if (connections[env] && connections[env][type]) {
        try {
          await connections[env][type].quit();
          console.log(`Closed ${type} Redis connection [${env}]`);
        } catch (error) {
          console.error(
            `Error closing ${type} Redis connection [${env}]:`,
            error.message
          );
        }
      }
    }
  }
  process.exit(0);
});

module.exports = {
  get globalRedis() {
    return getRedisConnection("global", "production");
  },
  get watchlistRedis() {
    return getRedisConnection("watchlist", "production");
  },
  get regularRedis() {
    return getRedisConnection("regular", "production");
  },
  get redis() {
    return getRedisConnection("global", "production");
  },
  getRedisConnection,
  reinitializeRedis,
  monitorConnections,
};
