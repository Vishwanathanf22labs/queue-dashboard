const redis = require("../../config/redis");
const logger = require("../../utils/logger");
const { REDIS_KEYS } = require("../../config/constants");

const PROXY_QUEUE_KEY = REDIS_KEYS.PROXY_IPS;

/**
 * Auto-switch to next working proxy when current fails
 */
async function switchToNextWorkingProxy(failedProxyId) {
  try {
    // First, mark the failed proxy as not working
    const updateResult = await updateProxyStatus(failedProxyId, false);
    if (!updateResult.success) {
      logger.error(`Failed to update status for proxy ${failedProxyId}`);
      return {
        success: false,
        message: "Failed to update proxy status",
        data: null
      };
    }

    // Get the next available working proxy
    const nextProxyResult = await getNextAvailableProxy();
    if (!nextProxyResult.success) {
      logger.error("No working proxies available after failure");
      return {
        success: false,
        message: "No working proxies available",
        data: null
      };
    }

    logger.info(`Switched from failed proxy ${failedProxyId} to working proxy ${nextProxyResult.data.id}`);
    
    return {
      success: true,
      message: "Successfully switched to next working proxy",
      data: {
        previous_proxy_id: failedProxyId,
        current_proxy: nextProxyResult.data
      }
    };

  } catch (error) {
    logger.error("Error in switchToNextWorkingProxy:", error);
    throw error;
  }
}

/**
 * Get next available working proxy with smart selection
 */
async function getNextAvailableProxy() {
  try {
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    if (proxies.length === 0) {
      return {
        success: false,
        message: "No proxies available",
        data: null
      };
    }

    // Find working proxy with smart selection algorithm
    const workingProxies = proxies
      .map(proxyStr => JSON.parse(proxyStr))
      .filter(proxy => proxy.is_working && proxy.status === "active");

    if (workingProxies.length === 0) {
      return {
        success: false,
        message: "No working proxies available",
        data: null
      };
    }

    // Smart selection: prioritize by health score and usage
    const scoredProxies = workingProxies.map(proxy => ({
      ...proxy,
      score: calculateProxyScore(proxy)
    }));

    // Sort by score (highest first)
    scoredProxies.sort((a, b) => b.score - a.score);
    
    const bestProxy = scoredProxies[0];

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

    return {
      success: true,
      message: "Next available proxy retrieved successfully",
      data: bestProxy
    };

  } catch (error) {
    logger.error("Error getting next available proxy:", error);
    throw error;
    throw error;
  }
}

/**
 * Calculate proxy score for smart selection
 */
function calculateProxyScore(proxy) {
  let score = 100;
  
  // Deduct points for high usage
  const usage = proxy.usage_count || 0;
  if (usage > 1000) {
    score -= Math.min(30, Math.floor(usage / 100));
  } else if (usage > 500) {
    score -= Math.min(20, Math.floor(usage / 50));
  }
  
  // Bonus for low usage (fresh proxies)
  if (usage < 100) {
    score += 10;
  }
  
  // Deduct points for old last_checked
  if (proxy.last_checked) {
    const lastChecked = new Date(proxy.last_checked);
    const hoursSinceCheck = (Date.now() - lastChecked.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCheck > 12) {
      score -= Math.min(20, Math.floor(hoursSinceCheck / 12) * 5);
    }
  }
  
  // Bonus for recent additions (new proxies)
  if (proxy.added_at) {
    const addedDate = new Date(proxy.added_at);
    const hoursSinceAdded = (Date.now() - addedDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceAdded < 24) {
      score += 5; // New proxies get small bonus
    }
  }
  
  return Math.max(0, score);
}

/**
 * Get proxy rotation history
 */
async function getProxyRotationHistory() {
  try {
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    const rotationHistory = proxies
      .map(proxyStr => JSON.parse(proxyStr))
      .filter(proxy => proxy.last_used) // Only proxies that have been used
      .sort((a, b) => new Date(b.last_used) - new Date(a.last_used))
      .map(proxy => ({
        id: proxy.id,
        ip: proxy.ip,
        port: proxy.port,
        country: proxy.country,
        last_used: proxy.last_used,
        usage_count: proxy.usage_count || 0,
        is_working: proxy.is_working
      }));
    
    return {
      success: true,
      message: "Proxy rotation history retrieved successfully",
      data: {
        total_rotations: rotationHistory.length,
        history: rotationHistory
      }
    };

  } catch (error) {
    logger.error("Error getting proxy rotation history:", error);
    throw error;
  }
}

/**
 * Force rotate to a specific proxy
 */
async function forceRotateToProxy(targetProxyId) {
  try {
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    // Find target proxy
    const targetProxy = proxies
      .map(proxyStr => JSON.parse(proxyStr))
      .find(proxy => proxy.id === targetProxyId);
    
    if (!targetProxy) {
      return {
        success: false,
        message: "Target proxy not found",
        data: null
      };
    }
    
    if (!targetProxy.is_working || targetProxy.status !== "active") {
      return {
        success: false,
        message: "Target proxy is not working or inactive",
        data: null
      };
    }
    
    // Update usage and last used
    targetProxy.usage_count = (targetProxy.usage_count || 0) + 1;
    targetProxy.last_used = new Date().toISOString();
    
    // Update in Redis
    const proxyIndex = proxies.findIndex(proxyStr => {
      const proxy = JSON.parse(proxyStr);
      return proxy.id === targetProxyId;
    });
    
    if (proxyIndex !== -1) {
      await redis.lset(PROXY_QUEUE_KEY, proxyIndex, JSON.stringify(targetProxy));
    }
    
    logger.info(`Forced rotation to proxy ${targetProxy.ip}:${targetProxy.port}`);
    
    return {
      success: true,
      message: "Successfully rotated to target proxy",
      data: targetProxy
    };

  } catch (error) {
    logger.error("Error in force rotation:", error);
    throw error;
  }
}

/**
 * Get proxy failover recommendations
 */
async function getFailoverRecommendations() {
  try {
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    const recommendations = {
      critical: [], // Proxies that need immediate attention
      warning: [],  // Proxies that might fail soon
      healthy: []   // Proxies in good condition
    };
    
    proxies.forEach(proxyStr => {
      const proxy = JSON.parse(proxyStr);
      const healthScore = calculateHealthScore(proxy);
      
      if (healthScore < 30) {
        recommendations.critical.push({
          id: proxy.id,
          ip: proxy.ip,
          port: proxy.port,
          reason: "Very low health score",
          health_score: healthScore
        });
      } else if (healthScore < 60) {
        recommendations.warning.push({
          id: proxy.id,
          ip: proxy.ip,
          port: proxy.port,
          reason: "Low health score",
          health_score: healthScore
        });
      } else {
        recommendations.healthy.push({
          id: proxy.id,
          ip: proxy.ip,
          port: proxy.port,
          health_score: healthScore
        });
      }
    });
    
    return {
      success: true,
      message: "Failover recommendations retrieved successfully",
      data: {
        critical_count: recommendations.critical.length,
        warning_count: recommendations.warning.length,
        healthy_count: recommendations.healthy.length,
        recommendations: recommendations
      }
    };

  } catch (error) {
    logger.error("Error getting failover recommendations:", error);
    throw error;
  }
}

/**
 * Calculate health score for a proxy (0-100)
 */
function calculateHealthScore(proxy) {
  let score = 100;
  
  // Deduct points for failed status
  if (!proxy.is_working) {
    score -= 50;
  }
  
  // Deduct points for high usage
  if (proxy.usage_count > 1000) {
    score -= Math.min(20, Math.floor(proxy.usage_count / 100));
  }
  
  // Deduct points for old last_checked
  if (proxy.last_checked) {
    const lastChecked = new Date(proxy.last_checked);
    const hoursSinceCheck = (Date.now() - lastChecked.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCheck > 24) {
      score -= Math.min(30, Math.floor(hoursSinceCheck / 24) * 5);
    }
  }
  
  return Math.max(0, score);
}

/**
 * Update proxy status (helper function)
 */
async function updateProxyStatus(proxyId, isWorking) {
  try {
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    for (let i = 0; i < proxies.length; i++) {
      const proxy = JSON.parse(proxies[i]);
      if (proxy.id === proxyId) {
        proxy.is_working = isWorking;
        proxy.last_checked = new Date().toISOString();
        
        await redis.lset(PROXY_QUEUE_KEY, i, JSON.stringify(proxy));
        
        return {
          success: true,
          message: `Proxy status updated to ${isWorking ? 'working' : 'not working'}`,
          data: proxy
        };
      }
    }

    return {
      success: false,
      message: "Proxy not found",
      data: null
    };

  } catch (error) {
    logger.error("Error updating proxy status:", error);
    throw error;
  }
}

module.exports = {
  switchToNextWorkingProxy,
  getNextAvailableProxy,
  getProxyRotationHistory,
  forceRotateToProxy,
  getFailoverRecommendations
};
