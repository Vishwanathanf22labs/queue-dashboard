const { getGlobalRedis } = require("../../utils/redisSelector");
const logger = require("../../utils/logger");

function getRedisKeys() {
  return require("../../config/constants").REDIS_KEYS;
}


async function switchToNextWorkingProxy(failedProxyKey) {
  try {
    const updateResult = await updateProxyStatus(failedProxyKey, false);
    if (!updateResult.success) {
      logger.error(`Failed to update status for proxy ${failedProxyKey}`);
      return {
        success: false,
        message: "Failed to update proxy status",
        data: null
      };
    }

    const nextProxyResult = await getNextAvailableProxy();
    if (!nextProxyResult.success) {
      logger.error("No working proxies available after failure");
      return {
        success: false,
        message: "No working proxies available",
        data: null
      };
    }

    logger.info(`Switched from failed proxy ${failedProxyKey} to working proxy ${nextProxyResult.data.id}`);

    return {
      success: true,
      message: "Successfully switched to next working proxy",
      data: {
        previous_proxy_id: failedProxyKey,
        current_proxy: nextProxyResult.data
      }
    };

  } catch (error) {
    logger.error("Error in switchToNextWorkingProxy:", error);
    throw error;
  }
}


async function getNextAvailableProxy() {
  try {
    const proxyKeys = await getGlobalRedis().keys(`${PROXY_IPS_KEY}:*`);

    if (proxyKeys.length === 0) {
      return {
        success: false,
        message: "No proxies available",
        data: null
      };
    }

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
      .filter(proxy => proxy.active === "true");

    if (activeProxies.length === 0) {
      return {
        success: false,
        message: "No active proxies available",
        data: null
      };
    }

    const scoredProxies = activeProxies.map(proxy => ({
      ...proxy,
      score: calculateProxyScore(proxy)
    }));

    scoredProxies.sort((a, b) => b.score - a.score);

    const bestProxy = scoredProxies[0];

    const newSuccessCount = parseInt(bestProxy.successCount || 0) + 1;

    await getGlobalRedis().hset(bestProxy.id, {
      successCount: newSuccessCount.toString()
    });

    return {
      success: true,
      message: "Next available proxy retrieved successfully",
      data: {
        ...bestProxy,
        successCount: newSuccessCount,
        failCount: parseInt(bestProxy.failCount || 0),
        usage_count: parseInt(bestProxy.failCount || 0) + newSuccessCount,
        is_working: true,
        active: true
      }
    };

  } catch (error) {
    logger.error("Error getting next available proxy:", error);
    throw error;
  }
}


function calculateProxyScore(proxy) {
  let score = 100;

  const usage = parseInt(proxy.failCount || 0) + parseInt(proxy.successCount || 0);
  if (usage > 1000) {
    score -= Math.min(30, Math.floor(usage / 100));
  } else if (usage > 500) {
    score -= Math.min(20, Math.floor(usage / 50));
  }

  if (usage < 100) {
    score += 10;
  }

  if (usage > 0) {
    const failureRate = parseInt(proxy.failCount || 0) / usage;
    if (failureRate > 0.3) {
      score -= Math.min(25, Math.floor(failureRate * 50));
    }
  }

  return Math.max(0, score);
}


async function getProxyRotationHistory() {
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

    const rotationHistory = allProxies
      .sort((a, b) => {
        const aUsage = parseInt(a.failCount || 0) + parseInt(a.successCount || 0);
        const bUsage = parseInt(b.failCount || 0) + parseInt(b.successCount || 0);
        return bUsage - aUsage;
      })
      .map(proxy => {
        const failCount = parseInt(proxy.failCount || 0);
        const successCount = parseInt(proxy.successCount || 0);
        return {
          id: proxy.id,
          ip: proxy.ip,
          port: proxy.port,
          username: proxy.username,
          password: proxy.password,
          country: proxy.country || "Unknown",
          usage_count: failCount + successCount,
          is_working: proxy.active === "true",
          failCount: failCount,
          successCount: successCount
        };
      });

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


async function forceRotateToProxy(targetProxyKey) {
  try {
    const targetProxy = await getGlobalRedis().hgetall(targetProxyKey);

    if (Object.keys(targetProxy).length === 0) {
      return {
        success: false,
        message: "Target proxy not found",
        data: null
      };
    }

    if (targetProxy.active !== "true") {
      return {
        success: false,
        message: "Target proxy is not active",
        data: null
      };
    }

    const newSuccessCount = parseInt(targetProxy.successCount || 0) + 1;

    await getGlobalRedis().hset(targetProxyKey, {
      successCount: newSuccessCount.toString()
    });

    const keyParts = targetProxyKey.split(':');
    logger.info(`Forced rotation to proxy ${keyParts[1]}:${keyParts[2]}`);

    return {
      success: true,
      message: "Successfully rotated to target proxy",
      data: {
        id: targetProxyKey,
        ip: keyParts[1],
        port: keyParts[2],
        username: keyParts[3],
        password: keyParts[4],
        country: targetProxy.country || "Unknown",
        successCount: newSuccessCount,
        failCount: parseInt(targetProxy.failCount || 0),
        usage_count: parseInt(targetProxy.failCount || 0) + newSuccessCount,
        is_working: true,
        active: true
      }
    };

  } catch (error) {
    logger.error("Error in force rotation:", error);
    throw error;
  }
}


async function getFailoverRecommendations() {
  try {
    const proxyKeys = await getGlobalRedis().keys(`${PROXY_IPS_KEY}:*`);

    const recommendations = {
      critical: [],
      warning: [],
      healthy: []
    };

    for (const key of proxyKeys) {
      const proxyData = await getGlobalRedis().hgetall(key);
      if (Object.keys(proxyData).length > 0) {
        const keyParts = key.split(':');
        const failCount = parseInt(proxyData.failCount || 0);
        const successCount = parseInt(proxyData.successCount || 0);
        const totalUsage = failCount + successCount;
        const isActive = proxyData.active === "true";
        const healthScore = calculateHealthScore(failCount, successCount, isActive);

        if (healthScore < 30) {
          recommendations.critical.push({
            id: key,
            ip: keyParts[1],
            port: keyParts[2],
            country: proxyData.country || "Unknown",
            reason: "Very low health score",
            health_score: healthScore
          });
        } else if (healthScore < 60) {
          recommendations.warning.push({
            id: key,
            ip: keyParts[1],
            port: keyParts[2],
            country: proxyData.country || "Unknown",
            reason: "Low health score",
            health_score: healthScore
          });
        } else {
          recommendations.healthy.push({
            id: key,
            ip: keyParts[1],
            port: keyParts[2],
            country: proxyData.country || "Unknown",
            health_score: healthScore
          });
        }
      }
    }

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


async function updateProxyStatus(proxyKey, isWorking) {
  try {
    const existingProxy = await getGlobalRedis().hgetall(proxyKey);
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

    await getGlobalRedis().hset(proxyKey, updateFields);

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

module.exports = {
  switchToNextWorkingProxy,
  getNextAvailableProxy,
  getProxyRotationHistory,
  forceRotateToProxy,
  getFailoverRecommendations
};
