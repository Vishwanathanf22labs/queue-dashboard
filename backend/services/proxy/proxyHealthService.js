const { getGlobalRedis } = require("../../utils/redisSelector");
const logger = require("../../utils/logger");

function getRedisKeys() {
  return require("../../config/constants").REDIS_KEYS;
}


async function updateProxyStatus(proxyKey, isWorking, environment = 'production') {
  try {
    const existingProxy = await getGlobalRedis(environment).hgetall(proxyKey);
    if (Object.keys(existingProxy).length === 0) {
      return {
        success: false,
        message: "Proxy not found",
        data: null
      };
    }

    const updateFields = {
      active: isWorking.toString()
    };

    if (!isWorking) {
      const now = new Date();
      updateFields.failure_reason = 'manual deactive';
      updateFields.disabledAt = now.getTime().toString();
      updateFields.disabled_date = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      updateFields.disabled_time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      logger.info(`Proxy ${proxyKey} manually deactivated by user at ${now.toISOString()}`);
    } else {
      updateFields.failure_reason = '';
      updateFields.disabledAt = '';
      updateFields.disabled_date = '';
      updateFields.disabled_time = '';
      logger.info(`Proxy ${proxyKey} manually activated by user`);
    }

    await getGlobalRedis(environment).hset(proxyKey, updateFields);

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


async function markProxyAsFailed(proxyKey, failureReason = 'Scraping failed') {
  try {
    const existingProxy = await getGlobalRedis().hgetall(proxyKey);
    if (Object.keys(existingProxy).length === 0) {
      return {
        success: false,
        message: "Proxy not found",
        data: null
      };
    }

    const currentFailCount = parseInt(existingProxy.failCount || 0);
    const now = new Date();
    const updateFields = {
      failCount: (currentFailCount + 1).toString(),
      active: "false",
      failure_reason: failureReason,
      disabledAt: now.getTime().toString(),
      disabled_date: now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      disabled_time: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    };

    await getGlobalRedis().hset(proxyKey, updateFields);

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


async function markProxyAsWorking(proxyKey) {
  try {
    const existingProxy = await getGlobalRedis().hgetall(proxyKey);
    if (Object.keys(existingProxy).length === 0) {
      return {
        success: false,
        message: "Proxy not found",
        data: null
      };
    }

    const currentSuccessCount = parseInt(existingProxy.successCount || 0);
    const updateFields = {
      successCount: (currentSuccessCount + 1).toString(),
      active: "true",
      failure_reason: '',
      disabledAt: '',
      disabled_date: '',
      disabled_time: ''
    };

    await getGlobalRedis().hset(proxyKey, updateFields);

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


async function getNextWorkingProxy() {
  try {
    const proxyKeys = await getGlobalRedis().keys(`${PROXY_IPS_KEY}:*`);

    const allProxies = [];
    for (const key of proxyKeys) {
      const proxyData = await getGlobalRedis().hgetall(key);
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

    if (activeProxies.length === 0) {
      return {
        success: false,
        message: "No active proxies available",
        data: null
      };
    }

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


async function checkProxyHealth(proxyKey) {
  try {
    const existingProxy = await getGlobalRedis().hgetall(proxyKey);
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


async function getSystemHealth() {
  try {
    const proxyKeys = await getGlobalRedis().keys(`${PROXY_IPS_KEY}:*`);

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

    const allProxies = [];
    for (const key of proxyKeys) {
      const proxyData = await getGlobalRedis().hgetall(key);
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


async function bulkUpdateStatus(updates) {
  try {
    const results = [];

    for (const update of updates) {
      const { proxyId, isWorking, reason } = update;

      const existingProxy = await getGlobalRedis().hgetall(proxyId);
      if (Object.keys(existingProxy).length > 0) {
        const updateFields = {
          active: isWorking.toString()
        };

        await getGlobalRedis().hset(proxyId, updateFields);

        results.push({
          proxyId,
          success: true,
          message: `Status updated to ${isWorking ? 'active' : 'inactive'}`,
          active: isWorking
        });
      } else {
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


function calculateHealthScore(failCount, successCount, isActive) {
  let score = 100;

  if (!isActive) {
    score -= 50;
  }

  const totalUsage = failCount + successCount;
  if (totalUsage > 0) {
    const failureRate = failCount / totalUsage;
    if (failureRate > 0.5) {
      score -= Math.min(30, Math.floor(failureRate * 60));
    }
  }

  if (totalUsage > 1000) {
    score -= Math.min(20, Math.floor(totalUsage / 100));
  }

  return Math.max(0, score);
}


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


async function getPerformanceMetrics() {
  try {
    const proxyKeys = await getGlobalRedis().keys(`${PROXY_IPS_KEY}:*`);

    const metrics = {
      total_proxies: proxyKeys.length,
      performance_by_usage: {
        low: 0,
        medium: 0,
        high: 0,
        very_high: 0
      },
      active_vs_inactive: {
        active: 0,
        inactive: 0
      }
    };

    for (const key of proxyKeys) {
      const proxyData = await getGlobalRedis().hgetall(key);
      if (Object.keys(proxyData).length > 0) {
        const failCount = parseInt(proxyData.failCount || 0);
        const successCount = parseInt(proxyData.successCount || 0);
        const totalUsage = failCount + successCount;
        const isActive = proxyData.active === "true";

        if (isActive) {
          metrics.active_vs_inactive.active++;
        } else {
          metrics.active_vs_inactive.inactive++;
        }

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

async function lockProxy(proxyId, identifier, namespace) {
  try {
    const parts = proxyId.split(':');
    if (parts.length < 5) {
      return {
        success: false,
        message: "Invalid proxy ID format - expected format: ips:IP:PORT:USERNAME:PASSWORD",
        data: null
      };
    }

    const ip = parts[1];
    const port = parts[2];
    const username = parts[3];
    const password = parts[4];

    const lockKey = `proxy:lock:${ip}:${port}:${username}:${password}`;

    const lockValue = identifier;

    const existingLock = await getGlobalRedis().get(lockKey);
    if (existingLock) {
      return {
        success: false,
        message: "Proxy is already locked",
        data: {
          lock_key: lockKey,
          current_worker: existingLock
        }
      };
    }

    await getGlobalRedis().setex(lockKey, 3600, lockValue);

    logger.info(`Proxy locked successfully: ${lockKey} (locked by: ${lockValue})`);

    return {
      success: true,
      message: "Proxy locked successfully",
      data: {
        lock_key: lockKey,
        lock_value: lockValue,
        proxy_id: proxyId
      }
    };

  } catch (error) {
    logger.error("Error locking proxy:", error);
    throw error;
  }
}

async function unlockProxy(lockKey) {
  try {
    const lockData = await getGlobalRedis().get(lockKey);
    if (!lockData) {
      return {
        success: false,
        message: "Proxy lock not found",
        data: null
      };
    }

    await getGlobalRedis().del(lockKey);

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
  markProxyAsFailed,
  markProxyAsWorking,
  getNextWorkingProxy,
  checkProxyHealth,
  getSystemHealth,
  bulkUpdateStatus,
  getPerformanceMetrics,
  lockProxy,
  unlockProxy
};
