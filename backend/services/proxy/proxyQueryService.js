const { globalRedis } = require("../../config/redis");
const logger = require("../../utils/logger");
const { REDIS_KEYS } = require("../../config/constants");

const PROXY_IPS_KEY = REDIS_KEYS.GLOBAL.PROXY_IPS;

/**
 * Get all proxies with pagination and filters
 */
async function getProxies(page = 1, limit = 10, filter = "all", search = "") {
  try {
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    
    // Get all proxy keys
    const proxyKeys = await globalRedis.keys(`${PROXY_IPS_KEY}:*`);
    
    // Get all proxy data from hashes
    let allProxies = [];
    for (const key of proxyKeys) {
      const proxyData = await globalRedis.hgetall(key);
      if (Object.keys(proxyData).length > 0) {
        // Parse the proxy key to extract IP, port, username, password
        const keyParts = key.split(':');
        const proxy = {
          id: key,
          ip: keyParts[1],
          port: keyParts[2],
          username: keyParts[3],
          password: keyParts[4],
          ...proxyData
        };
        allProxies.push(proxy);
      }
    }
    
    // Apply search filter first
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      
      allProxies = allProxies.filter(proxy => {
        return (
          proxy.ip?.toLowerCase().includes(searchTerm) ||
          proxy.port?.toString().includes(searchTerm) ||
          proxy.username?.toLowerCase().includes(searchTerm) ||
          proxy.password?.toLowerCase().includes(searchTerm) ||
          proxy.country?.toLowerCase().includes(searchTerm)
        );
      });
    }
    
    // Apply filters
    if (filter === "working") {
      logger.info(`Applying working filter`);
      const beforeFilter = allProxies.length;
      
      // Debug: Log some proxy data to see the structure
      if (allProxies.length > 0) {
        logger.info(`Sample proxy data:`, {
          id: allProxies[0].id,
          active: allProxies[0].active,
          activeType: typeof allProxies[0].active,
          failCount: allProxies[0].failCount,
          successCount: allProxies[0].successCount
        });
      }
      
      allProxies = allProxies.filter(proxy => {
        const isActive = proxy.active === "true";
        logger.info(`Proxy ${proxy.id}: active="${proxy.active}" (type: ${typeof proxy.active}), isActive: ${isActive}`);
        return isActive;
      });
      logger.info(`Working filter reduced proxies from ${beforeFilter} to ${allProxies.length}`);
    } else if (filter === "failed") {
      logger.info(`Applying failed filter`);
      const beforeFilter = allProxies.length;
      
      // Debug: Log some proxy data to see the structure
      if (allProxies.length > 0) {
        logger.info(`Sample proxy data:`, {
          id: allProxies[0].id,
          active: allProxies[0].active,
          activeType: typeof allProxies[0].active,
          failCount: allProxies[0].failCount,
          successCount: allProxies[0].successCount
        });
      }
      
      allProxies = allProxies.filter(proxy => {
        const isInactive = proxy.active === "false";
        logger.info(`Proxy ${proxy.id}: active="${proxy.active}" (type: ${typeof proxy.active}), isInactive: ${isInactive}`);
        return isInactive;
      });
      logger.info(`Failed filter reduced proxies from ${beforeFilter} to ${allProxies.length}`);
    }
    
    const totalProxies = allProxies.length;
    const proxies = allProxies.slice(start, end);
    
    const parsedProxies = proxies.map(proxy => {
      const failCount = parseInt(proxy.failCount || 0);
      const successCount = parseInt(proxy.successCount || 0);
      const usageCount = failCount + successCount;
      
      // Use stored creation date if available, otherwise fallback to current date
      const createdDate = proxy.created_at ? new Date(proxy.created_at) : new Date();
      
      return {
        ...proxy,
        failCount: failCount,
        successCount: successCount,
        usage_count: usageCount,
        is_working: proxy.active === "true",
        active: proxy.active === "true",
        // Use country from Redis if available, otherwise default
        country: proxy.country || "Unknown",
        type: proxy.type || "http",
        added_at: proxy.created_at || createdDate.toISOString(),
        added_date: proxy.added_date || createdDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        added_time: proxy.added_time || createdDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          hour12: true 
        }),
        status: proxy.active === "true" ? "active" : "inactive",
        last_used: null,
        last_checked: new Date().toISOString()
      };
    });
    
    return {
      success: true,
      message: "Proxies retrieved successfully",
      data: {
        proxies: parsedProxies,
        pagination: {
          page: page,
          limit: limit,
          total: totalProxies,
          pages: Math.ceil(totalProxies / limit)
        },
        filter: filter,
        search: search
      }
    };

  } catch (error) {
    logger.error("Error getting proxies:", error);
    throw error;
  }
}

/**
 * Get available working proxies only
 */
async function getAvailableProxies() {
  try {
    // Get all proxy keys
    const proxyKeys = await globalRedis.keys(`${PROXY_IPS_KEY}:*`);
    
    // Get all proxy data from hashes
    const allProxies = [];
    for (const key of proxyKeys) {
      const proxyData = await globalRedis.hgetall(key);
      if (Object.keys(proxyData).length > 0) {
        const keyParts = key.split(':');
        const proxy = {
          id: key,
          ip: keyParts[1],
          port: keyParts[2],
          username: keyParts[3],
          password: keyParts[4],
          ...proxyData
        };
        allProxies.push(proxy);
      }
    }
    
    const activeProxies = allProxies
      .filter(proxy => proxy.active === "true")
      .sort((a, b) => {
        const aUsage = parseInt(a.failCount || 0) + parseInt(a.successCount || 0);
        const bUsage = parseInt(b.failCount || 0) + parseInt(b.successCount || 0);
        return aUsage - bUsage;
      });
    
    return {
      success: true,
      message: "Available proxies retrieved successfully",
      data: {
        count: activeProxies.length,
        proxies: activeProxies.map(proxy => {
          const failCount = parseInt(proxy.failCount || 0);
          const successCount = parseInt(proxy.successCount || 0);
          return {
            id: proxy.id,
            ip: proxy.ip,
            port: proxy.port,
            country: "Unknown",
            type: proxy.type || "http",
            usage_count: failCount + successCount,
            last_used: null,
            failCount: failCount,
            successCount: successCount
          };
        })
      }
    };

  } catch (error) {
    logger.error("Error getting available proxies:", error);
    throw error;
  }
}

/**
 * Get last month proxies only
 */
async function getLastMonthProxies() {
  try {
    // Get all proxy keys
    const proxyKeys = await globalRedis.keys(`${PROXY_IPS_KEY}:*`);
    
    // Get all proxy data from hashes
    const allProxies = [];
    for (const key of proxyKeys) {
      const proxyData = await globalRedis.hgetall(key);
      if (Object.keys(proxyData).length > 0) {
        const keyParts = key.split(':');
        const proxy = {
          id: key,
          ip: keyParts[1],
          port: keyParts[2],
          username: keyParts[3],
          password: keyParts[4],
          ...proxyData
        };
        allProxies.push(proxy);
      }
    }
    
    const lastMonthProxies = allProxies
      .sort((a, b) => {
        // Sort by usage count (most used first)
        const aUsage = parseInt(a.failCount || 0) + parseInt(a.successCount || 0);
        const bUsage = parseInt(b.failCount || 0) + parseInt(b.successCount || 0);
        return bUsage - aUsage;
      });
    
    return {
      success: true,
      message: "Last month proxies retrieved successfully",
      data: {
        count: lastMonthProxies.length,
        proxies: lastMonthProxies.map(proxy => {
          const failCount = parseInt(proxy.failCount || 0);
          const successCount = parseInt(proxy.successCount || 0);
          
          // Use stored creation date if available, otherwise fallback to current date
          const createdDate = proxy.created_at ? new Date(proxy.created_at) : new Date();
          
          return {
            id: proxy.id,
            ip: proxy.ip,
            port: proxy.port,
            country: proxy.country || "Unknown",
            type: proxy.type || "http",
            added_at: proxy.created_at || createdDate.toISOString(),
            added_date: proxy.added_date || createdDate.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }),
            added_time: proxy.added_time || createdDate.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit',
              hour12: true 
            }),
            is_working: proxy.active === "true",
            usage_count: failCount + successCount,
            failCount: failCount,
            successCount: successCount
          };
        })
      }
    };

  } catch (error) {
    logger.error("Error getting last month proxies:", error);
    throw error;
  }
}

/**
 * Get next available proxy for use
 */
async function getNextProxy() {
  try {
    // Get all proxy keys
    const proxyKeys = await globalRedis.keys(`${PROXY_IPS_KEY}:*`);
    
    if (proxyKeys.length === 0) {
      return {
        success: false,
        message: "No proxies available",
        data: null
      };
    }

    // Get all proxy data from hashes
    const allProxies = [];
    for (const key of proxyKeys) {
      const proxyData = await globalRedis.hgetall(key);
      if (Object.keys(proxyData).length > 0) {
        const keyParts = key.split(':');
        const proxy = {
          id: key,
          ip: keyParts[1],
          port: keyParts[2],
          username: keyParts[3],
          password: keyParts[4],
          ...proxyData
        };
        allProxies.push(proxy);
      }
    }

    // Find active proxy with least usage
    let bestProxy = null;
    let minUsage = Infinity;

    for (const proxy of allProxies) {
      if (proxy.active === "true") {
        const usage = parseInt(proxy.failCount || 0) + parseInt(proxy.successCount || 0);
        if (usage < minUsage) {
          minUsage = usage;
          bestProxy = proxy;
        }
      }
    }

    if (!bestProxy) {
      return {
        success: false,
        message: "No active proxies available",
        data: null
      };
    }

    // Update success count
    const newSuccessCount = parseInt(bestProxy.successCount || 0) + 1;

    // Update in Redis hash
    await globalRedis.hset(bestProxy.id, {
      successCount: newSuccessCount.toString()
    });

    // Format response
    const failCount = parseInt(bestProxy.failCount || 0);
    const usageCount = failCount + newSuccessCount;
    
    // Use stored creation date if available, otherwise fallback to current date
    const createdDate = bestProxy.created_at ? new Date(bestProxy.created_at) : new Date();

    return {
      success: true,
      message: "Proxy retrieved successfully",
      data: {
        ...bestProxy,
        successCount: newSuccessCount,
        usage_count: usageCount,
        failCount: failCount,
        is_working: true,
        active: true,
        // Add default values for UI compatibility
        country: bestProxy.country || "Unknown",
        type: bestProxy.type || "http",
        added_at: bestProxy.created_at || createdDate.toISOString(),
        added_date: bestProxy.added_date || createdDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        added_time: bestProxy.added_time || createdDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          hour12: true 
        }),
        status: "active",
        last_used: new Date().toISOString(),
        last_checked: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error("Error getting next proxy:", error);
    throw error;
  }
}

/**
 * Get proxy statistics
 */
async function getProxyStats() {
  try {
    // Get all proxy keys
    const proxyKeys = await globalRedis.keys(`${PROXY_IPS_KEY}:*`);
    const totalProxies = proxyKeys.length;
    
    // Get all proxy data from hashes
    const allProxies = [];
    for (const key of proxyKeys) {
      const proxyData = await globalRedis.hgetall(key);
      if (Object.keys(proxyData).length > 0) {
        allProxies.push({
          id: key,
          ...proxyData
        });
      }
    }
    
    let activeCount = 0;
    let totalUsage = 0;
    
    allProxies.forEach(proxy => {
      if (proxy.active === "true") activeCount++;
      totalUsage += parseInt(proxy.failCount || 0) + parseInt(proxy.successCount || 0);
    });

    logger.info(`Proxy stats calculated: total=${totalProxies}, active=${activeCount}, usage=${totalUsage}`);

    return {
      success: true,
      message: "Proxy stats retrieved successfully",
      data: {
        total_proxies: totalProxies,
        active_proxies: activeCount,  // ✅ FIXED: Now shows actual active count
        working_proxies: activeCount,
        total_usage: totalUsage,
        average_usage: totalProxies > 0 ? Math.round(totalUsage / totalProxies) : 0
      }
    };

  } catch (error) {
    logger.error("Error getting proxy stats:", error);
    throw error;
  }
}

/**
 * Search proxies by various criteria
 */
async function searchProxies(query, criteria = "all") {
  try {
    // Get all proxy keys
    const proxyKeys = await globalRedis.keys(`${PROXY_IPS_KEY}:*`);
    
    // Get all proxy data from hashes
    const allProxies = [];
    for (const key of proxyKeys) {
      const proxyData = await globalRedis.hgetall(key);
      if (Object.keys(proxyData).length > 0) {
        const keyParts = key.split(':');
        const proxy = {
          id: key,
          ip: keyParts[1],
          port: keyParts[2],
          username: keyParts[3],
          password: keyParts[4],
          ...proxyData
        };
        allProxies.push(proxy);
      }
    }
    
    const searchResults = allProxies.filter(proxy => {
      const searchTerm = query.toLowerCase();
      
      switch (criteria) {
        case "ip":
          return proxy.ip.toLowerCase().includes(searchTerm);
        case "port":
          return proxy.port.toString().includes(searchTerm);
        case "username":
          return proxy.username.toLowerCase().includes(searchTerm);
        case "all":
        default:
          return (
            proxy.ip.toLowerCase().includes(searchTerm) ||
            proxy.port.toString().includes(searchTerm) ||
            proxy.username.toLowerCase().includes(searchTerm) ||
            proxy.password.toLowerCase().includes(searchTerm)
          );
      }
    });
    
    return {
      success: true,
      message: "Search completed successfully",
      data: {
        query: query,
        criteria: criteria,
        count: searchResults.length,
        proxies: searchResults.map(proxy => {
          const failCount = parseInt(proxy.failCount || 0);
          const successCount = parseInt(proxy.successCount || 0);
          return {
            ...proxy,
            failCount: failCount,
            successCount: successCount,
            usage_count: failCount + successCount,
            is_working: proxy.active === "true",
            active: proxy.active === "true"
          };
        })
      }
    };

  } catch (error) {
    logger.error("Error searching proxies:", error);
    throw error;
  }
}

/**
 * Get proxy management statistics (added/removed counts)
 */
async function getProxyManagementStats() {
  try {
    const stats = await globalRedis.hgetall(REDIS_KEYS.GLOBAL.PROXY_STATS);
    
    return {
      success: true,
      message: "Proxy management stats retrieved successfully",
      data: {
        total_added: parseInt(stats.added || 0),
        total_removed: parseInt(stats.removed || 0),
        last_updated: stats.last_updated || null,
        net_change: parseInt(stats.added || 0) - parseInt(stats.removed || 0)
      }
    };
  } catch (error) {
    logger.error("Error getting proxy management stats:", error);
    throw error;
  }
}

module.exports = {
  getProxies,
  getAvailableProxies,
  getLastMonthProxies,
  getNextProxy,
  getProxyStats,
  getProxyManagementStats, // ✅ NEW: Added this function
  searchProxies
};
