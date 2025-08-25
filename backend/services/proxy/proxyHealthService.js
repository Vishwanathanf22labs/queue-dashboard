const redis = require("../../config/redis");
const logger = require("../../utils/logger");
const { REDIS_KEYS } = require("../../config/constants");

const PROXY_QUEUE_KEY = REDIS_KEYS.PROXY_IPS;

/**
 * Update proxy working status
 */
async function updateProxyStatus(proxyId, isWorking) {
  try {
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    for (let i = 0; i < proxies.length; i++) {
      const proxy = JSON.parse(proxies[i]);
      if (proxy.id === proxyId) {
        proxy.is_working = isWorking;
        proxy.last_checked = new Date().toISOString();
        
        // If proxy failed, log it for monitoring
        if (!isWorking) {
          logger.info(`Proxy ${proxy.ip}:${proxy.port} failed, marking as not working`);
        } else {
          logger.info(`Proxy ${proxy.ip}:${proxy.port} recovered, marking as working`);
        }
        
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

/**
 * IMPORTANT: Mark proxy as failed when scraper detects failure
 * This is the main function the scraper will call
 */
async function markProxyAsFailed(proxyId, failureReason = 'Scraping failed') {
  try {
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    for (let i = 0; i < proxies.length; i++) {
      const proxy = JSON.parse(proxies[i]);
      if (proxy.id === proxyId) {
        // Mark proxy as failed
        proxy.is_working = false;
        proxy.last_checked = new Date().toISOString();
        proxy.failure_reason = failureReason;
        proxy.failed_at = new Date().toISOString();
        proxy.failure_count = (proxy.failure_count || 0) + 1;
        
        logger.warn(`SCRAPER: Proxy ${proxy.ip}:${proxy.port} marked as failed. Reason: ${failureReason}`);
        
        await redis.lset(PROXY_QUEUE_KEY, i, JSON.stringify(proxy));
        
        return {
          success: true,
          message: `Proxy marked as failed: ${failureReason}`,
          data: {
            id: proxy.id,
            ip: proxy.ip,
            port: proxy.port,
            is_working: false,
            failure_reason: failureReason,
            failed_at: proxy.failed_at,
            failure_count: proxy.failure_count
          }
        };
      }
    }

    return {
      success: false,
      message: "Proxy not found",
      data: null
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
async function markProxyAsWorking(proxyId) {
  try {
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    for (let i = 0; i < proxies.length; i++) {
      const proxy = JSON.parse(proxies[i]);
      if (proxy.id === proxyId) {
        // Mark proxy as working
        proxy.is_working = true;
        proxy.last_checked = new Date().toISOString();
        proxy.last_used = new Date().toISOString();
        proxy.usage_count = (proxy.usage_count || 0) + 1;
        
        // Clear failure info if it was previously failed
        if (proxy.failure_reason) {
          delete proxy.failure_reason;
          delete proxy.failed_at;
        }
        
        logger.info(`SCRAPER: Proxy ${proxy.ip}:${proxy.port} marked as working. Usage count: ${proxy.usage_count}`);
        
        await redis.lset(PROXY_QUEUE_KEY, i, JSON.stringify(proxy));
        
        return {
          success: true,
          message: "Proxy marked as working",
          data: {
            id: proxy.id,
            ip: proxy.ip,
            port: proxy.port,
            is_working: true,
            usage_count: proxy.usage_count,
            last_used: proxy.last_used
          }
        };
      }
    }

    return {
      success: false,
      message: "Proxy not found",
      data: null
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
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    // Find working proxies and sort by usage count (least used first)
    const workingProxies = proxies
      .map(proxyStr => JSON.parse(proxyStr))
      .filter(proxy => proxy.is_working && proxy.status === "active")
      .sort((a, b) => (a.usage_count || 0) - (b.usage_count || 0));
    
    if (workingProxies.length === 0) {
      return {
        success: false,
        message: "No working proxies available",
        data: null
      };
    }
    
    // Return the least used working proxy
    const selectedProxy = workingProxies[0];
    
    return {
      success: true,
      message: "Working proxy found",
      data: selectedProxy
    };
    
  } catch (error) {
    logger.error("Error getting next working proxy:", error);
    throw error;
  }
}

/**
 * Check proxy health status
 */
async function checkProxyHealth(proxyId) {
  try {
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    for (const proxyStr of proxies) {
      const proxy = JSON.parse(proxyStr);
      if (proxy.id === proxyId) {
        const healthStatus = {
          id: proxy.id,
          ip: proxy.ip,
          port: proxy.port,
          is_working: proxy.is_working,
          status: proxy.status,
          last_checked: proxy.last_checked,
          last_used: proxy.last_used,
          usage_count: proxy.usage_count || 0,
          health_score: calculateHealthScore(proxy)
        };
        
        return {
          success: true,
          message: "Proxy health check completed",
          data: healthStatus
        };
      }
    }

    return {
      success: false,
      message: "Proxy not found",
      data: null
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
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    if (proxies.length === 0) {
      return {
        success: true,
        message: "No proxies in system",
        data: {
          total_proxies: 0,
          working_proxies: 0,
          failed_proxies: 0,
          health_score: 0,
          status: "no_proxies"
        }
      };
    }
    
    let workingCount = 0;
    let failedCount = 0;
    let totalHealthScore = 0;
    
    const healthDetails = proxies.map(proxyStr => {
      const proxy = JSON.parse(proxyStr);
      const healthScore = calculateHealthScore(proxy);
      
      if (proxy.is_working) {
        workingCount++;
      } else {
        failedCount++;
      }
      
      totalHealthScore += healthScore;
      
      return {
        id: proxy.id,
        ip: proxy.ip,
        port: proxy.port,
        is_working: proxy.is_working,
        health_score: healthScore,
        last_checked: proxy.last_checked
      };
    });
    
    const averageHealthScore = Math.round(totalHealthScore / proxies.length);
    const overallStatus = getOverallStatus(workingCount, failedCount, averageHealthScore);
    
    return {
      success: true,
      message: "System health check completed",
      data: {
        total_proxies: proxies.length,
        working_proxies: workingCount,
        failed_proxies: failedCount,
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
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    for (const update of updates) {
      const { proxyId, isWorking, reason } = update;
      
      for (let i = 0; i < proxies.length; i++) {
        const proxy = JSON.parse(proxies[i]);
        if (proxy.id === proxyId) {
          proxy.is_working = isWorking;
          proxy.last_checked = new Date().toISOString();
          proxy.status_reason = reason || null;
          
          await redis.lset(PROXY_QUEUE_KEY, i, JSON.stringify(proxy));
          
          results.push({
            proxyId,
            success: true,
            message: `Status updated to ${isWorking ? 'working' : 'not working'}`,
            ip: proxy.ip,
            port: proxy.port
          });
          break;
        }
      }
      
      // If proxy not found, add to results
      if (!results.find(r => r.proxyId === proxyId)) {
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
function calculateHealthScore(proxy) {
  let score = 100;
  
  // Deduct points for failed status
  if (!proxy.is_working) {
    score -= 50;
  }
  
  // Deduct points for high usage (over 1000 requests)
  if (proxy.usage_count > 1000) {
    score -= Math.min(20, Math.floor(proxy.usage_count / 100));
  }
  
  // Deduct points for old last_checked (over 24 hours)
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
 * Determine overall system status
 */
function getOverallStatus(workingCount, failedCount, healthScore) {
  if (workingCount === 0 && failedCount === 0) {
    return "no_proxies";
  } else if (failedCount === 0) {
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
    const proxies = await redis.lrange(PROXY_QUEUE_KEY, 0, -1);
    
    const metrics = {
      total_proxies: proxies.length,
      performance_by_country: {},
      performance_by_type: {},
      usage_distribution: {
        low: 0,      // 0-100 requests
        medium: 0,   // 101-500 requests
        high: 0,     // 501-1000 requests
        very_high: 0 // 1000+ requests
      }
    };
    
    proxies.forEach(proxyStr => {
      const proxy = JSON.parse(proxyStr);
      const usage = proxy.usage_count || 0;
      
      // Count by country
      const country = proxy.country || "Unknown";
      if (!metrics.performance_by_country[country]) {
        metrics.performance_by_country[country] = { total: 0, working: 0, failed: 0 };
      }
      metrics.performance_by_country[country].total++;
      if (proxy.is_working) {
        metrics.performance_by_country[country].working++;
      } else {
        metrics.performance_by_country[country].failed++;
      }
      
      // Count by type
      const type = proxy.type || "http";
      if (!metrics.performance_by_type[type]) {
        metrics.performance_by_type[type] = { total: 0, working: 0, failed: 0 };
      }
      metrics.performance_by_type[type].total++;
      if (proxy.is_working) {
        metrics.performance_by_type[type].working++;
      } else {
        metrics.performance_by_type[type].failed++;
      }
      
      // Usage distribution
      if (usage <= 100) metrics.usage_distribution.low++;
      else if (usage <= 500) metrics.usage_distribution.medium++;
      else if (usage <= 1000) metrics.usage_distribution.high++;
      else metrics.usage_distribution.very_high++;
    });
    
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

module.exports = {
  updateProxyStatus,
  markProxyAsFailed,      // ← NEW: Scraper calls this when proxy fails
  markProxyAsWorking,     // ← NEW: Scraper calls this when proxy works
  getNextWorkingProxy,    // ← NEW: Scraper calls this to get proxy
  checkProxyHealth,
  getSystemHealth,
  bulkUpdateStatus,
  getPerformanceMetrics
};
