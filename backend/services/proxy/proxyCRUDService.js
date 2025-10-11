const { getGlobalRedis } = require("../../utils/redisSelector");
const logger = require("../../utils/logger");
const ipStatsService = require("../ipStatsService");

function getRedisKeys(environment = 'production') {
  return require("../../config/constants").getRedisKeys(environment);
}


async function initializeProxyStats(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const PROXY_STATS_KEY = REDIS_KEYS.GLOBAL.PROXY_STATS;

    const stats = await getGlobalRedis(environment).hgetall(PROXY_STATS_KEY);

    if (Object.keys(stats).length === 0) {
      await getGlobalRedis(environment).hset(PROXY_STATS_KEY, {
        added: "0",
        removed: "0",
        last_updated: new Date().toISOString()
      });
      logger.info(`Proxy stats initialized with default values for ${environment}`);
    }
  } catch (error) {
    logger.error("Error initializing proxy stats:", error);
  }
}


async function addProxy(ip, port = null, country = null, username = null, password = null, type = "http", namespace = null, userAgent = null, viewport = null, version = "ipv4", environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const PROXY_IPS_KEY = REDIS_KEYS.GLOBAL.PROXY_IPS;

    if (!isValidIP(ip)) {
      throw new Error("Invalid IP address format");
    }

    const proxyKey = `${PROXY_IPS_KEY}:${ip}:${port}:${username}:${password}`;

    const existingProxy = await getGlobalRedis(environment).hgetall(proxyKey);
    if (Object.keys(existingProxy).length > 0) {
      return {
        success: false,
        message: "Proxy already exists",
        data: null
      };
    }

    const now = new Date();
    const proxyData = {
      proxy_url: `${ip}:${port}:${username}:${password}`,
      failCount: "0",
      successCount: "0",
      active: "true",
      disabledAt: "",
      country: country || "Unknown",
      type: type || "http",
      namespace: namespace || "",
      userAgent: userAgent || "",
      viewport: viewport || "",
      version: version || "ipv4",
      created_at: now.toISOString(),
      added_date: now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      added_time: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    };

    await getGlobalRedis(environment).hset(proxyKey, proxyData);

    await updateProxyStats("add", environment);

    logger.info(`Proxy added successfully: ${ip}:${port} (${country || 'Unknown'})`);

    return {
      success: true,
      message: "Proxy added successfully",
      data: {
        id: proxyKey,
        ip: ip,
        port: port,
        country: country || "Unknown",
        username: username,
        password: password,
        type: type,
        namespace: namespace || "",
        userAgent: userAgent || "",
        viewport: viewport || "",
        version: version || "ipv4",
        added_at: now.toISOString(),
        added_date: now.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        added_time: now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }),
        status: "active",
        last_used: null,
        usage_count: 0,
        is_working: true,
        last_checked: new Date().toISOString(),
        failCount: 0,
        successCount: 0,
        active: true,
        disabledAt: null
      }
    };

  } catch (error) {
    logger.error("Error adding proxy:", error);
    throw error;
  }
}

async function removeProxy(proxyKey, environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);

    const existingProxy = await getGlobalRedis(environment).hgetall(proxyKey);
    if (Object.keys(existingProxy).length === 0) {
      return {
        success: false,
        message: "Proxy not found",
        data: null
      };
    }

    const keyParts = proxyKey.split(':');
    const ip = keyParts[1];

    await getGlobalRedis(environment).del(proxyKey);

    await updateProxyStats("remove", environment);

    try {
      await ipStatsService.deleteIpStats(ip, environment);
      logger.info(`IP stats cleaned up for IP: ${ip}`);
    } catch (ipStatsError) {
      logger.warn(`Failed to cleanup IP stats for ${ip}:`, ipStatsError.message);
    }

    logger.info(`Proxy removed successfully: ${proxyKey}`);

    return {
      success: true,
      message: "Proxy removed successfully",
      data: {
        id: proxyKey,
        ...existingProxy
      }
    };

  } catch (error) {
    logger.error("Error removing proxy:", error);
    throw error;
  }
}

async function updateProxy(proxyKey, updates, environment = 'production') {
  try {
    const existingProxy = await getGlobalRedis(environment).hgetall(proxyKey);
    if (Object.keys(existingProxy).length === 0) {
      return {
        success: false,
        message: "Proxy not found",
        data: null
      };
    }

    const allowedUpdates = ['country', 'type', 'username', 'password', 'namespace', 'userAgent', 'viewport', 'version'];
    const updatedFields = {};

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updatedFields[field] = updates[field].toString();
      }
    });

    await getGlobalRedis(environment).hset(proxyKey, updatedFields);

    const updatedProxy = await getGlobalRedis(environment).hgetall(proxyKey);

    return {
      success: true,
      message: "Proxy updated successfully",
      data: {
        id: proxyKey,
        ...updatedProxy
      }
    };

  } catch (error) {
    logger.error("Error updating proxy:", error);
    throw error;
  }
}


async function clearAllProxies() {
  try {
    const proxyKeys = await getGlobalRedis().keys(`${PROXY_IPS_KEY}:*`);

    if (proxyKeys.length === 0) {
      return {
        success: false,
        message: "No proxies to clear",
        data: null
      };
    }

    await getGlobalRedis().del(proxyKeys);

    await getGlobalRedis().del(PROXY_STATS_KEY);

    logger.info(`All ${proxyKeys.length} proxies cleared successfully`);

    return {
      success: true,
      message: `All ${proxyKeys.length} proxies cleared successfully`,
      data: { cleared_count: proxyKeys.length }
    };

  } catch (error) {
    logger.error("Error clearing all proxies:", error);
    throw error;
  }
}


async function updateProxyStats(action, environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const PROXY_STATS_KEY = REDIS_KEYS.GLOBAL.PROXY_STATS;

    const stats = await getGlobalRedis(environment).hgetall(PROXY_STATS_KEY);

    if (Object.keys(stats).length === 0) {
      await getGlobalRedis(environment).hset(PROXY_STATS_KEY, {
        added: "0",
        removed: "0",
        last_updated: new Date().toISOString()
      });
    }

    if (action === "add") {
      const added = parseInt(stats.added || 0) + 1;
      await getGlobalRedis(environment).hset(PROXY_STATS_KEY, "added", added.toString());
    } else if (action === "remove") {
      const removed = parseInt(stats.removed || 0) + 1;
      await getGlobalRedis(environment).hset(PROXY_STATS_KEY, "removed", removed.toString());
    }

    await getGlobalRedis(environment).hset(PROXY_STATS_KEY, "last_updated", new Date().toISOString());

    logger.info(`Proxy stats updated: ${action} action performed`);
  } catch (error) {
    logger.error("Error updating proxy stats:", error);
  }
}


function isValidIP(ip) {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

module.exports = {
  addProxy,
  removeProxy,
  updateProxy,
  clearAllProxies,
  updateProxyStats
};
