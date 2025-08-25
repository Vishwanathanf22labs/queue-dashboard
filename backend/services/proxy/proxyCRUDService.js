const redis = require("../../config/redis");
const logger = require("../../utils/logger");
const { REDIS_KEYS } = require("../../config/constants");

const PROXY_QUEUE_KEY = REDIS_KEYS.PROXY_IPS;
const PROXY_STATS_KEY = REDIS_KEYS.PROXY_STATS;

/**
 * Add a new proxy to the system
 */
async function addProxy(ip, port = null, country = null, username = null, password = null, type = "http") {
  try {
    // Validate IP format
    if (!isValidIP(ip)) {
      throw new Error("Invalid IP address format");
    }

    // Check if proxy already exists
    const existingProxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    const proxyExists = existingProxies.some(proxyStr => {
      const proxy = JSON.parse(proxyStr);
      return proxy.ip === ip && proxy.port === port;
    });

    if (proxyExists) {
      return {
        success: false,
        message: "Proxy already exists",
        data: null
      };
    }

    // Create proxy object
    const proxyData = {
      id: generateProxyId(),
      ip: ip,
      port: port,
      country: country || "Unknown",
      username: username,
      password: password,
      type: type,
      added_at: new Date().toISOString(),
      added_date: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      added_time: new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
      }),
      status: "active",
      last_used: null,
      usage_count: 0,
      is_working: true,
      last_checked: new Date().toISOString()
    };

    // Add to Redis list
    await redis.lpush(PROXY_QUEUE_KEY, JSON.stringify(proxyData));
    
    // Update stats
    await updateProxyStats("add");

    logger.info(`Proxy added successfully: ${ip}:${port} (${country || 'Unknown'})`);

    return {
      success: true,
      message: "Proxy added successfully",
      data: proxyData
    };

  } catch (error) {
    logger.error("Error adding proxy:", error);
    throw error;
  }
}

/**
 * Remove a proxy by ID
 */
async function removeProxy(proxyId) {
  try {
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    let removedProxy = null;
    let removedIndex = -1;

    // Find and remove the proxy
    for (let i = 0; i < proxies.length; i++) {
      const proxy = JSON.parse(proxies[i]);
      if (proxy.id === proxyId) {
        removedProxy = proxy;
        removedIndex = i;
        break;
      }
    }

    if (removedIndex === -1) {
      return {
        success: false,
        message: "Proxy not found",
        data: null
      };
    }

    // Remove from Redis list
    await redis.lset(PROXY_QUEUE_KEY, removedIndex, "TO_BE_REMOVED");
    await redis.lrem(PROXY_QUEUE_KEY, 1, "TO_BE_REMOVED");
    
    // Update stats
    await updateProxyStats("remove");

    logger.info(`Proxy removed successfully: ${removedProxy.ip}:${removedProxy.port}`);

    return {
      success: true,
      message: "Proxy removed successfully",
      data: removedProxy
    };

  } catch (error) {
    logger.error("Error removing proxy:", error);
    throw error;
  }
}

/**
 * Update proxy basic information
 */
async function updateProxy(proxyId, updates) {
  try {
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    for (let i = 0; i < proxies.length; i++) {
      const proxy = JSON.parse(proxies[i]);
      if (proxy.id === proxyId) {
        // Only allow updating certain fields
        const allowedUpdates = ['country', 'type', 'username', 'password'];
        const updatedProxy = { ...proxy };
        
        allowedUpdates.forEach(field => {
          if (updates[field] !== undefined) {
            updatedProxy[field] = updates[field];
          }
        });
        
        updatedProxy.last_updated = new Date().toISOString();
        
        await redis.lset(PROXY_QUEUE_KEY, i, JSON.stringify(updatedProxy));
        
        return {
          success: true,
          message: "Proxy updated successfully",
          data: updatedProxy
        };
      }
    }

    return {
      success: false,
      message: "Proxy not found",
      data: null
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
    const totalProxies = await redis.llen(PROXY_QUEUE_KEY);
    
    if (totalProxies === 0) {
      return {
        success: false,
        message: "No proxies to clear",
        data: null
      };
    }

    await redis.del(PROXY_QUEUE_KEY);
    
    // Reset stats
    await redis.del(PROXY_STATS_KEY);

    logger.info(`All ${totalProxies} proxies cleared successfully`);

    return {
      success: true,
      message: `All ${totalProxies} proxies cleared successfully`,
      data: { cleared_count: totalProxies }
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
    const stats = await redis.hgetall(PROXY_STATS_KEY);
    
    if (action === "add") {
      const added = parseInt(stats.added || 0) + 1;
      await redis.hset(PROXY_STATS_KEY, "added", added);
    } else if (action === "remove") {
      const removed = parseInt(stats.removed || 0) + 1;
      await redis.hset(PROXY_STATS_KEY, "removed", removed);
    }
    
    await redis.hset(PROXY_STATS_KEY, "last_updated", new Date().toISOString());
  } catch (error) {
    logger.error("Error updating proxy stats:", error);
  }
}

/**
 * Generate a unique proxy ID
 */
function generateProxyId() {
  return `proxy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
