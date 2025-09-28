const { getGlobalRedis } = require("../../utils/redisSelector");
const logger = require("../../utils/logger");

// Function to get dynamic Redis keys
function getRedisKeys() {
  return require("../../config/constants").REDIS_KEYS;
}

/**
 * Add a new proxy to the system using Redis hash storage
 */
async function addProxy(ip, port = null, country = null, username = null, password = null, type = "http", namespace = null, userAgent = null, viewport = null) {
  try {
    const REDIS_KEYS = getRedisKeys();
    const PROXY_IPS_KEY = REDIS_KEYS.GLOBAL.PROXY_IPS;
    
    // Validate IP format
    if (!isValidIP(ip)) {
      throw new Error("Invalid IP address format");
    }

    // Create the proxy key in the format: ips:ip:port:username:password
    const proxyKey = `${PROXY_IPS_KEY}:${ip}:${port}:${username}:${password}`;
    
    // Check if proxy already exists
    const existingProxy = await getGlobalRedis().hgetall(proxyKey);
    if (Object.keys(existingProxy).length > 0) {
      return {
        success: false,
        message: "Proxy already exists",
        data: null
      };
    }

    // Create proxy hash fields - only essential fields as shown in the image
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

    // Add to Redis hash
    await getGlobalRedis().hset(proxyKey, proxyData);
    
    // Update stats
    await updateProxyStats("add");

    logger.info(`Proxy added successfully: ${ip}:${port} (${country || 'Unknown'})`);

    return {
      success: true,
      message: "Proxy added successfully",
      data: {
        id: proxyKey, // Use the Redis key as the ID
        ip: ip,
        port: port,
        country: country || "Unknown",
        username: username,
        password: password,
        type: type,
        namespace: namespace || "",
        userAgent: userAgent || "",
        viewport: viewport || "",
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
        usage_count: 0, // Calculate from failCount + successCount
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

/**
 * Remove a proxy by key
 */
async function removeProxy(proxyKey) {
  try {
    const REDIS_KEYS = getRedisKeys();
    
    // Check if proxy exists
    const existingProxy = await getGlobalRedis().hgetall(proxyKey);
    if (Object.keys(existingProxy).length === 0) {
      return {
        success: false,
        message: "Proxy not found",
        data: null
      };
    }

    // Remove from Redis hash
    await getGlobalRedis().del(proxyKey);
    
    // Update stats
    await updateProxyStats("remove");

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

/**
 * Update proxy basic information
 */
async function updateProxy(proxyKey, updates) {
  try {
    // Check if proxy exists
    const existingProxy = await getGlobalRedis().hgetall(proxyKey);
    if (Object.keys(existingProxy).length === 0) {
      return {
        success: false,
        message: "Proxy not found",
        data: null
      };
    }

    // Only allow updating certain fields
    const allowedUpdates = ['country', 'type', 'username', 'password', 'namespace', 'userAgent', 'viewport'];
    const updatedFields = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updatedFields[field] = updates[field].toString();
      }
    });
    
    // Update in Redis hash
    await getGlobalRedis().hset(proxyKey, updatedFields);
    
    // Get updated proxy data
    const updatedProxy = await getGlobalRedis().hgetall(proxyKey);
    
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

/**
 * Clear all proxies
 */
async function clearAllProxies() {
  try {
    // Get all proxy keys
    const proxyKeys = await getGlobalRedis().keys(`${PROXY_IPS_KEY}:*`);
    
    if (proxyKeys.length === 0) {
      return {
        success: false,
        message: "No proxies to clear",
        data: null
      };
    }

    // Delete all proxy keys
    await getGlobalRedis().del(proxyKeys);
    
    // Reset stats
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

/**
 * Update proxy statistics
 */
async function updateProxyStats(action) {
  try {
    const stats = await getGlobalRedis().hgetall(PROXY_STATS_KEY);
    
    if (action === "add") {
      const added = parseInt(stats.added || 0) + 1;
      await getGlobalRedis().hset(PROXY_STATS_KEY, "added", added.toString());
    } else if (action === "remove") {
      const removed = parseInt(stats.removed || 0) + 1;
      await getGlobalRedis().hset(PROXY_STATS_KEY, "removed", removed.toString());
    }
    
    await getGlobalRedis().hset(PROXY_STATS_KEY, "last_updated", new Date().toISOString());
  } catch (error) {
    logger.error("Error updating proxy stats:", error);
  }
}

/**
 * Validate IP address format
 */
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
