const redis = require("../../config/redis");
const logger = require("../../utils/logger");
const { REDIS_KEYS } = require("../../config/constants");

const PROXY_QUEUE_KEY = REDIS_KEYS.PROXY_IPS;

/**
 * Get all proxies with pagination and filters
 */
async function getProxies(page = 1, limit = 10, filter = "all", search = "") {
  try {
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    
    let allProxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    // Apply search filter first
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      
      allProxies = allProxies.filter(proxyStr => {
        const proxy = JSON.parse(proxyStr);
        return (
          proxy.ip?.toLowerCase().includes(searchTerm) ||
          proxy.port?.toString().includes(searchTerm) ||
          proxy.country?.toLowerCase().includes(searchTerm) ||
          proxy.username?.toLowerCase().includes(searchTerm) ||
          proxy.type?.toLowerCase().includes(searchTerm)
        );
      });
    }
    
    // Apply filters
    if (filter === "working") {
      allProxies = allProxies.filter(proxyStr => {
        const proxy = JSON.parse(proxyStr);
        return proxy.is_working && proxy.status === "active";
      });
    } else if (filter === "failed") {
      allProxies = allProxies.filter(proxyStr => {
        const proxy = JSON.parse(proxyStr);
        return !proxy.is_working;
      });
    } else if (filter === "last_month") {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      allProxies = allProxies.filter(proxyStr => {
        const proxy = JSON.parse(proxyStr);
        const addedDate = new Date(proxy.added_at);
        return addedDate >= oneMonthAgo;
      });
    }
    
    const totalProxies = allProxies.length;
    const proxies = allProxies.slice(start, end);
    
    const parsedProxies = proxies.map(proxyStr => {
      const proxy = JSON.parse(proxyStr);
      
      // Format timestamps for better display
      const addedTimestamp = formatTimestamp(proxy.added_at);
      const lastUsedTimestamp = formatTimestamp(proxy.last_used);
      const lastCheckedTimestamp = formatTimestamp(proxy.last_checked);
      
      return {
        ...proxy,
        added_date: addedTimestamp.date,
        added_time: addedTimestamp.time,
        last_used_date: lastUsedTimestamp.date,
        last_used_time: lastUsedTimestamp.time,
        last_checked_date: lastCheckedTimestamp.date,
        last_checked_time: lastCheckedTimestamp.time
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
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    const workingProxies = proxies
      .map(proxyStr => JSON.parse(proxyStr))
      .filter(proxy => proxy.is_working && proxy.status === "active")
      .sort((a, b) => (a.usage_count || 0) - (b.usage_count || 0)); // Sort by usage count
    
    return {
      success: true,
      message: "Available proxies retrieved successfully",
      data: {
        count: workingProxies.length,
        proxies: workingProxies.map(proxy => ({
          id: proxy.id,
          ip: proxy.ip,
          port: proxy.port,
          country: proxy.country,
          type: proxy.type,
          usage_count: proxy.usage_count || 0,
          last_used: proxy.last_used
        }))
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
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const lastMonthProxies = proxies
      .map(proxyStr => JSON.parse(proxyStr))
      .filter(proxy => {
        const addedDate = new Date(proxy.added_at);
        return addedDate >= oneMonthAgo;
      })
      .sort((a, b) => new Date(b.added_at) - new Date(a.added_at)); // Sort by newest first
    
    return {
      success: true,
      message: "Last month proxies retrieved successfully",
      data: {
        count: lastMonthProxies.length,
        proxies: lastMonthProxies.map(proxy => ({
          id: proxy.id,
          ip: proxy.ip,
          port: proxy.port,
          country: proxy.country,
          type: proxy.type,
          added_at: proxy.added_at,
          added_date: formatTimestamp(proxy.added_at).date,
          added_time: formatTimestamp(proxy.added_at).time,
          is_working: proxy.is_working,
          usage_count: proxy.usage_count || 0
        }))
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
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    if (proxies.length === 0) {
      return {
        success: false,
        message: "No proxies available",
        data: null
      };
    }

    // Find working proxy with least usage
    let bestProxy = null;
    let minUsage = Infinity;

    for (const proxyStr of proxies) {
      const proxy = JSON.parse(proxyStr);
      if (proxy.is_working && proxy.status === "active") {
        if (proxy.usage_count < minUsage) {
          minUsage = proxy.usage_count;
          bestProxy = proxy;
        }
      }
    }

    if (!bestProxy) {
      return {
        success: false,
        message: "No working proxies available",
        data: null
      };
    }

    // Update usage count and last used
    bestProxy.usage_count = (bestProxy.usage_count || 0) + 1;
    bestProxy.last_used = new Date().toISOString();

    // Update in Redis
    const proxyIndex = proxies.findIndex(proxyStr => {
      const proxy = JSON.parse(proxyStr);
      return proxy.id === bestProxy.id;
    });

    if (proxyIndex !== -1) {
      await redis.lset(PROXY_QUEUE_KEY, proxyIndex, JSON.stringify(bestProxy));
    }

    // Format timestamps for response
    const addedTimestamp = formatTimestamp(bestProxy.added_at);
    const lastUsedTimestamp = formatTimestamp(bestProxy.last_used);

    return {
      success: true,
      message: "Proxy retrieved successfully",
      data: {
        ...bestProxy,
        added_date: addedTimestamp.date,
        added_time: addedTimestamp.time,
        last_used_date: lastUsedTimestamp.date,
        last_used_time: lastUsedTimestamp.time
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
    const totalProxies = await redis.llen(PROXY_QUEUE_KEY);
    const activeProxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    let workingCount = 0;
    let totalUsage = 0;
    
    activeProxies.forEach(proxyStr => {
      const proxy = JSON.parse(proxyStr);
      if (proxy.is_working) workingCount++;
      totalUsage += proxy.usage_count || 0;
    });

    return {
      success: true,
      message: "Proxy stats retrieved successfully",
      data: {
        total_proxies: totalProxies,
        active_proxies: totalProxies,
        working_proxies: workingCount,
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
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    const searchResults = proxies
      .map(proxyStr => JSON.parse(proxyStr))
      .filter(proxy => {
        const searchTerm = query.toLowerCase();
        
        switch (criteria) {
          case "ip":
            return proxy.ip.toLowerCase().includes(searchTerm);
          case "country":
            return proxy.country.toLowerCase().includes(searchTerm);
          case "type":
            return proxy.type.toLowerCase().includes(searchTerm);
          case "all":
          default:
            return (
              proxy.ip.toLowerCase().includes(searchTerm) ||
              proxy.country.toLowerCase().includes(searchTerm) ||
              proxy.type.toLowerCase().includes(searchTerm)
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
        proxies: searchResults
      }
    };

  } catch (error) {
    logger.error("Error searching proxies:", error);
    throw error;
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return { date: 'Never', time: 'Never' };
  
  const date = new Date(timestamp);
  return {
    date: date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    time: date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    }),
    full: timestamp
  };
}

module.exports = {
  getProxies,
  getAvailableProxies,
  getLastMonthProxies,
  getNextProxy,
  getProxyStats,
  searchProxies
};
