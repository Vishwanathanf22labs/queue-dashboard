const { globalRedis } = require("../../config/redis");
const logger = require("../../utils/logger");
const { REDIS_KEYS } = require("../../config/constants");

const PROXY_IPS_KEY = REDIS_KEYS.GLOBAL.PROXY_IPS;

/**
 * Update proxy working status
 */
async function updateProxyStatus(proxyKey, isWorking) {
  try {
    // Check if proxy exists
    const existingProxy = await globalRedis.hgetall(proxyKey);
    if (Object.keys(existingProxy).length === 0) {
      return {
        success: false,
        message: "Proxy not found",
        data: null
      };
    }

    // Update status fields - only essential fields
    const updateFields = {
      active: isWorking.toString()
    };

    // If proxy failed, log it for monitoring
    if (!isWorking) {
      logger.info(`Proxy ${proxyKey} failed, marking as inactive`);
    } else {
      logger.info(`Proxy ${proxyKey} recovered, marking as active`);
    }

    // Update in Redis hash
    await globalRedis.hset(proxyKey, updateFields);

    return {
      success: true,
      message: `Proxy status updated to ${isWorking ? 'active' : 'inactive'}`,
      data: {
        id: proxyKey,
        ...existingProxy,
        ...updateFields
      }
    };

  } catch (error) {
    logger.error("Error updating proxy status:", error);
    throw error;
  }
}

/**
 * IMPORTANT: Mark proxy as failed when scraper detects failure
 * This is the main function the scraper will call
 */
async function markProxyAsFailed(proxyKey, failureReason = 'Scraping failed') {
  try {
    // Check if proxy exists
    const existingProxy = await globalRedis.hgetall(proxyKey);
    if (Object.keys(existingProxy).length === 0) {
      return {
        success: false,
        message: "Proxy not found",
        data: null
      };
    }

    // Update failure fields - only essential fields
    const currentFailCount = parseInt(existingProxy.failCount || 0);
    const updateFields = {
      failCount: (currentFailCount + 1).toString(),
      active: "false" // Set to inactive when failed
    };

    // Mark proxy as failed
    await globalRedis.hset(proxyKey, updateFields);

    logger.warn(`SCRAPER: Proxy ${proxyKey} marked as failed. Reason: ${failureReason}`);

    return {
      success: true,
      message: `Proxy marked as failed: ${failureReason}`,
      data: {
        id: proxyKey,
        failCount: currentFailCount + 1,
        active: false,
        failure_reason: failureReason
      }
    };

  } catch (error) {
    logger.error("Error marking proxy as failed:", error);
    throw error;
  }
}

/**
 * IMPORTANT: Mark proxy as working when scraper successfully uses it
 * This is the main function the scraper will call
 */
async function markProxyAsWorking(proxyKey) {
  try {
    // Check if proxy exists
    const existingProxy = await globalRedis.hgetall(proxyKey);
    if (Object.keys(existingProxy).length === 0) {
      return {
        success: false,
        message: "Proxy not found",
        data: null
      };
    }

    // Update working fields - only essential fields
    const currentSuccessCount = parseInt(existingProxy.successCount || 0);
    const updateFields = {
      successCount: (currentSuccessCount + 1).toString(),
      active: "true" // Set to active when working
    };

    // Mark proxy as working
    await globalRedis.hset(proxyKey, updateFields);

    logger.info(`SCRAPER: Proxy ${proxyKey} marked as working. Success count: ${currentSuccessCount + 1}`);

    return {
      success: true,
      message: "Proxy marked as working",
      data: {
        id: proxyKey,
        successCount: currentSuccessCount + 1,
        active: true
      }
    };

  } catch (error) {
    logger.error("Error marking proxy as working:", error);
    throw error;
  }
}

/**
 * Get next available working proxy for scraper
 * This is what the scraper will call to get a proxy
 */
async function getNextWorkingProxy() {
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
    
    // Find active proxies and sort by usage count (least used first)
    const activeProxies = allProxies
      .filter(proxy => proxy.active === "true")
      .sort((a, b) => {
        const aUsage = parseInt(a.failCount || 0) + parseInt(a.successCount || 0);
        const bUsage = parseInt(b.failCount || 0) + parseInt(b.successCount || 0);
        return aUsage - bUsage;
      });
    
    if (activeProxies.length === 0) {
      return {
        success: false,
        message: "No active proxies available",
        data: null
      };
    }
    
    // Return the least used active proxy
    const selectedProxy = activeProxies[0];
    
    return {
      success: true,
      message: "Active proxy found",
      data: {
        ...selectedProxy,
        failCount: parseInt(selectedProxy.failCount || 0),
        successCount: parseInt(selectedProxy.successCount || 0),
        usage_count: parseInt(selectedProxy.failCount || 0) + parseInt(selectedProxy.successCount || 0),
        is_working: selectedProxy.active === "true",
        active: selectedProxy.active === "true"
      }
    };
    
  } catch (error) {
    logger.error("Error getting next working proxy:", error);
    throw error;
  }
}

/**
 * Check proxy health status
 */
async function checkProxyHealth(proxyKey) {
  try {
    // Check if proxy exists
    const existingProxy = await globalRedis.hgetall(proxyKey);
    if (Object.keys(existingProxy).length === 0) {
      return {
        success: false,
        message: "Proxy not found",
        data: null
      };
    }

    const failCount = parseInt(existingProxy.failCount || 0);
    const successCount = parseInt(existingProxy.successCount || 0);
    const usageCount = failCount + successCount;
    const isActive = existingProxy.active === "true";

    const healthStatus = {
      id: proxyKey,
      failCount: failCount,
      successCount: successCount,
      usage_count: usageCount,
      active: isActive,
      health_score: calculateHealthScore(failCount, successCount, isActive)
    };
    
    return {
      success: true,
      message: "Proxy health check completed",
      data: healthStatus
    };

  } catch (error) {
    logger.error("Error checking proxy health:", error);
    throw error;
  }
}

/**
 * Get overall proxy system health
 */
async function getSystemHealth() {
  try {
    // Get all proxy keys
    const proxyKeys = await globalRedis.keys(`${PROXY_IPS_KEY}:*`);
    
    if (proxyKeys.length === 0) {
      return {
        success: true,
        message: "No proxies in system",
        data: {
          total_proxies: 0,
          active_proxies: 0,
          inactive_proxies: 0,
          health_score: 0,
          status: "no_proxies"
        }
      };
    }
    
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
    let inactiveCount = 0;
    let totalHealthScore = 0;
    
    const healthDetails = allProxies.map(proxy => {
      const failCount = parseInt(proxy.failCount || 0);
      const successCount = parseInt(proxy.successCount || 0);
      const isActive = proxy.active === "true";
      const healthScore = calculateHealthScore(failCount, successCount, isActive);
      
      if (isActive) {
        activeCount++;
      } else {
        inactiveCount++;
      }
      
      totalHealthScore += healthScore;
      
      return {
        id: proxy.id,
        failCount: failCount,
        successCount: successCount,
        usage_count: failCount + successCount,
        active: isActive,
        health_score: healthScore
      };
    });
    
    const averageHealthScore = Math.round(totalHealthScore / allProxies.length);
    const overallStatus = getOverallStatus(activeCount, inactiveCount, averageHealthScore);
    
    return {
      success: true,
      message: "System health check completed",
      data: {
        total_proxies: allProxies.length,
        active_proxies: activeCount,
        inactive_proxies: inactiveCount,
        health_score: averageHealthScore,
        status: overallStatus,
        details: healthDetails
      }
    };

  } catch (error) {
    logger.error("Error getting system health:", error);
    throw error;
  }
}

/**
 * Bulk update proxy statuses
 */
async function bulkUpdateStatus(updates) {
  try {
    const results = [];
    
    for (const update of updates) {
      const { proxyId, isWorking, reason } = update;
      
      // Check if proxy exists
      const existingProxy = await globalRedis.hgetall(proxyId);
      if (Object.keys(existingProxy).length > 0) {
        const updateFields = {
          active: isWorking.toString()
        };
        
        await globalRedis.hset(proxyId, updateFields);
        
        results.push({
          proxyId,
          success: true,
          message: `Status updated to ${isWorking ? 'active' : 'inactive'}`,
          active: isWorking
        });
      } else {
        // If proxy not found, add to results
        results.push({
          proxyId,
          success: false,
          message: "Proxy not found"
        });
      }
    }
    
    return {
      success: true,
      message: "Bulk status update completed",
      data: {
        total_updates: updates.length,
        successful_updates: results.filter(r => r.success).length,
        failed_updates: results.filter(r => !r.success).length,
        results: results
      }
    };

  } catch (error) {
    logger.error("Error in bulk status update:", error);
    throw error;
  }
}

/**
 * Calculate health score for a proxy (0-100)
 */
function calculateHealthScore(failCount, successCount, isActive) {
  let score = 100;
  
  // Deduct points for inactive status
  if (!isActive) {
    score -= 50;
  }
  
  // Deduct points for high failure rate
  const totalUsage = failCount + successCount;
  if (totalUsage > 0) {
    const failureRate = failCount / totalUsage;
    if (failureRate > 0.5) {
      score -= Math.min(30, Math.floor(failureRate * 60));
    }
  }
  
  // Deduct points for high total usage (over 1000 requests)
  if (totalUsage > 1000) {
    score -= Math.min(20, Math.floor(totalUsage / 100));
  }
  
  return Math.max(0, score);
}

/**
 * Determine overall system status
 */
function getOverallStatus(activeCount, inactiveCount, healthScore) {
  if (activeCount === 0 && inactiveCount === 0) {
    return "no_proxies";
  } else if (inactiveCount === 0) {
    return "excellent";
  } else if (healthScore >= 80) {
    return "good";
  } else if (healthScore >= 60) {
    return "fair";
  } else if (healthScore >= 40) {
    return "poor";
  } else {
    return "critical";
  }
}

/**
 * Get proxy performance metrics
 */
async function getPerformanceMetrics() {
  try {
    // Get all proxy keys
    const proxyKeys = await globalRedis.keys(`${PROXY_IPS_KEY}:*`);
    
    const metrics = {
      total_proxies: proxyKeys.length,
      performance_by_usage: {
        low: 0,      // 0-100 requests
        medium: 0,   // 101-500 requests
        high: 0,     // 501-1000 requests
        very_high: 0 // 1000+ requests
      },
      active_vs_inactive: {
        active: 0,
        inactive: 0
      }
    };
    
    // Get all proxy data from hashes
    for (const key of proxyKeys) {
      const proxyData = await globalRedis.hgetall(key);
      if (Object.keys(proxyData).length > 0) {
        const failCount = parseInt(proxyData.failCount || 0);
        const successCount = parseInt(proxyData.successCount || 0);
        const totalUsage = failCount + successCount;
        const isActive = proxyData.active === "true";
        
        // Count active vs inactive
        if (isActive) {
          metrics.active_vs_inactive.active++;
        } else {
          metrics.active_vs_inactive.inactive++;
        }
        
        // Usage distribution
        if (totalUsage <= 100) metrics.performance_by_usage.low++;
        else if (totalUsage <= 500) metrics.performance_by_usage.medium++;
        else if (totalUsage <= 1000) metrics.performance_by_usage.high++;
        else metrics.performance_by_usage.very_high++;
      }
    }
    
    return {
      success: true,
      message: "Performance metrics retrieved successfully",
      data: metrics
    };

  } catch (error) {
    logger.error("Error getting performance metrics:", error);
    throw error;
  }
}

async function unlockProxy(lockKey) {
  try {
    // Check if lock exists
    const lockData = await globalRedis.get(lockKey);
    if (!lockData) {
      return {
        success: false,
        message: "Proxy lock not found",
        data: null
      };
    }

    // Delete the lock key
    await globalRedis.del(lockKey);
    
    logger.info(`Proxy unlocked successfully: ${lockKey} (was locked by: ${lockData})`);

    return {
      success: true,
      message: "Proxy unlocked successfully",
      data: {
        lock_key: lockKey,
        previous_worker: lockData
      }
    };

  } catch (error) {
    logger.error("Error unlocking proxy:", error);
    throw error;
  }
}

module.exports = {
  updateProxyStatus,
  markProxyAsFailed,      // ← NEW: Scraper calls this when proxy fails
  markProxyAsWorking,     // ← NEW: Scraper calls this when proxy works
  getNextWorkingProxy,    // ← NEW: Scraper calls this to get proxy
  checkProxyHealth,
  getSystemHealth,
  bulkUpdateStatus,
  getPerformanceMetrics,
  unlockProxy            // ← NEW: Unlock proxy functionality
};
