const proxyManagementService = require("../services/proxyManagementService");
const logger = require("../utils/logger");
const scraperControlService = require("../services/scraperControlService");


async function addProxy(req, res) {
  try {
    const { ip, port, country, username, password, type, namespace, userAgent, viewport, version } = req.body;

    // Validate required fields
    if (!ip) {
      return res.status(400).json({
        success: false,
        message: "IP address is required"
      });
    }

    // Validate port if provided
    if (port && (isNaN(port) || port < 1 || port > 65535)) {
      return res.status(400).json({
        success: false,
        message: "Port must be a number between 1 and 65535"
      });
    }

    // Validate proxy type
    const validTypes = ["http", "https", "socks4", "socks5"];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Proxy type must be one of: ${validTypes.join(", ")}`
      });
    }

    // Validate required fields
    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required"
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required"
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Protocol is required"
      });
    }

    if (!namespace) {
      return res.status(400).json({
        success: false,
        message: "Namespace is required"
      });
    }

    // Validate namespace values
    const validNamespaces = ["non-watchlist", "watchlist"];
    if (!validNamespaces.includes(namespace)) {
      return res.status(400).json({
        success: false,
        message: `Namespace must be one of: ${validNamespaces.join(", ")}`
      });
    }

    if (!userAgent) {
      return res.status(400).json({
        success: false,
        message: "User Agent is required"
      });
    }

    if (!viewport) {
      return res.status(400).json({
        success: false,
        message: "Viewport is required"
      });
    }

    if (!version) {
      return res.status(400).json({
        success: false,
        message: "Version is required"
      });
    }

    // Validate version values
    const validVersions = ["ipv4", "ipv6"];
    if (!validVersions.includes(version)) {
      return res.status(400).json({
        success: false,
        message: `Version must be one of: ${validVersions.join(", ")}`
      });
    }

    // Validate viewport format - accept width,height format
    const viewportRegex = /^\d+,\d+$/;
    if (!viewportRegex.test(viewport)) {
      return res.status(400).json({
        success: false,
        message: "Viewport must be in format: width,height (e.g., 1366,768)"
      });
    }
    
    // Validate individual dimensions
    const [width, height] = viewport.split(',');
    const widthNum = parseInt(width);
    const heightNum = parseInt(height);
    
    if (isNaN(widthNum) || isNaN(heightNum) || widthNum <= 0 || heightNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Viewport dimensions must be positive numbers"
      });
    }

    const result = await proxyManagementService.addProxy(ip, port, country, username, password, type, namespace, userAgent, viewport, version, req.environment);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(409).json(result);
    }

  } catch (error) {
    logger.error("Error in addProxy controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function updateProxy(req, res) {
  try {
    const { proxyId } = req.params;
    const { namespace, userAgent, viewport, version } = req.body;

    // Validate required fields
    if (!namespace) {
      return res.status(400).json({
        success: false,
        message: "Namespace is required"
      });
    }

    if (!userAgent) {
      return res.status(400).json({
        success: false,
        message: "User Agent is required"
      });
    }

    if (!viewport) {
      return res.status(400).json({
        success: false,
        message: "Viewport is required"
      });
    }

    if (!version) {
      return res.status(400).json({
        success: false,
        message: "Version is required"
      });
    }

    // Validate version values
    const validVersions = ["ipv4", "ipv6"];
    if (!validVersions.includes(version)) {
      return res.status(400).json({
        success: false,
        message: `Version must be one of: ${validVersions.join(", ")}`
      });
    }

    // Validate namespace values
    const validNamespaces = ["non-watchlist", "watchlist"];
    if (!validNamespaces.includes(namespace)) {
      return res.status(400).json({
        success: false,
        message: `Namespace must be one of: ${validNamespaces.join(", ")}`
      });
    }

    // Validate viewport format - accept width,height format
    const viewportRegex = /^\d+,\d+$/;
    if (!viewportRegex.test(viewport)) {
      return res.status(400).json({
        success: false,
        message: "Viewport must be in format: width,height (e.g., 1366,768)"
      });
    }
    
    // Validate individual dimensions
    const [width, height] = viewport.split(',');
    const widthNum = parseInt(width);
    const heightNum = parseInt(height);
    
    if (isNaN(widthNum) || isNaN(heightNum) || widthNum <= 0 || heightNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Viewport dimensions must be positive numbers"
      });
    }

    const result = await proxyManagementService.updateProxy(proxyId, {
      namespace,
      userAgent,
      viewport,
      version
    }, req.environment);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error("Error in updateProxy controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}


async function removeProxy(req, res) {
  try {
    const { proxyId } = req.params;

    if (!proxyId) {
      return res.status(400).json({
        success: false,
        message: "Proxy ID is required"
      });
    }

    const result = await proxyManagementService.removeProxy(proxyId, req.environment);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    logger.error("Error in removeProxy controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function getProxies(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = req.query.filter || "all"; // New filter parameter
    const search = req.query.search || ""; // New search parameter

    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({
        success: false,
        message: "Page must be greater than 0"
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100"
      });
    }

    // Validate filter parameter
    const validFilters = ["all", "working", "failed", "last_month"];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({
        success: false,
        message: `Filter must be one of: ${validFilters.join(", ")}`
      });
    }

    const result = await proxyManagementService.getProxies(page, limit, filter, search, req.environment);
    res.status(200).json(result);

  } catch (error) {
    logger.error("Error in getProxies controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}


async function getProxyStats(req, res) {
  try {
    const result = await proxyManagementService.getProxyStats(req.environment);
    res.status(200).json(result);

  } catch (error) {
    logger.error("Error in getProxyStats controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function getProxyManagementStats(req, res) {
  try {
    const result = await proxyManagementService.getProxyManagementStats(req.environment);
    res.status(200).json(result);

  } catch (error) {
    logger.error("Error in getProxyManagementStats controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}


async function getNextProxy(req, res) {
  try {
    const result = await proxyManagementService.getNextProxy();
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    logger.error("Error in getNextProxy controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}


async function updateProxyStatus(req, res) {
  try {
    const { proxyId } = req.params;
    const { isWorking } = req.body;

    if (!proxyId) {
      return res.status(400).json({
        success: false,
        message: "Proxy ID is required"
      });
    }

    if (typeof isWorking !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isWorking must be a boolean value"
      });
    }

    const result = await proxyManagementService.updateProxyStatus(proxyId, isWorking, req.environment);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    logger.error("Error in updateProxyStatus controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}


async function clearAllProxies(req, res) {
  try {
    const result = await proxyManagementService.clearAllProxies();
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    logger.error("Error in clearAllProxies controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

// New controller: Get available working proxies
async function getAvailableProxies(req, res) {
  try {
    const result = await proxyManagementService.getAvailableProxies();
    res.status(200).json(result);

  } catch (error) {
    logger.error("Error in getAvailableProxies controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

// New controller: Get last month proxies
async function getLastMonthProxies(req, res) {
  try {
    const result = await proxyManagementService.getLastMonthProxies();
    res.status(200).json(result);

  } catch (error) {
    logger.error("Error in getLastMonthProxies controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

// New controller: Auto-switch to next working proxy
async function switchToNextWorkingProxy(req, res) {
  try {
    const { failedProxyId } = req.params;

    if (!failedProxyId) {
      return res.status(400).json({
        success: false,
        message: "Failed proxy ID is required"
      });
    }

    const result = await proxyManagementService.switchToNextWorkingProxy(failedProxyId);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    logger.error("Error in switchToNextWorkingProxy controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

// New controller: Get system health
async function getSystemHealth(req, res) {
  try {
    const result = await proxyManagementService.getSystemHealth();
    res.status(200).json(result);

  } catch (error) {
    logger.error("Error in getSystemHealth controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function getScraperStatus(req, res) {
  try {
    const status = await scraperControlService.getScraperStatus();
    res.status(200).json({
      success: true,
      message: 'Scraper status retrieved successfully',
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting scraper status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scraper status',
      error: error.message
    });
  }
}

/**
 * IMPORTANT: Scraper marks proxy as failed
 * This is called automatically when scraper detects proxy failure
 */
async function markProxyAsFailed(req, res) {
  try {
    const { proxyId } = req.params;
    const { reason } = req.body || {};

    if (!proxyId) {
      return res.status(400).json({
        success: false,
        message: "Proxy ID is required"
      });
    }

    const result = await proxyManagementService.markProxyAsFailed(proxyId, reason);
    res.status(200).json(result);

  } catch (error) {
    logger.error('Error in markProxyAsFailed controller:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}

/**
 * IMPORTANT: Scraper marks proxy as working
 * This is called automatically when scraper successfully uses proxy
 */
async function markProxyAsWorking(req, res) {
  try {
    const { proxyId } = req.params;

    if (!proxyId) {
      return res.status(400).json({
        success: false,
        message: "Proxy ID is required"
      });
    }

    const result = await proxyManagementService.markProxyAsWorking(proxyId);
    res.status(200).json(result);

  } catch (error) {
    logger.error('Error in markProxyAsWorking controller:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}

/**
 * IMPORTANT: Scraper gets next working proxy
 * This is called when scraper needs a proxy to use
 */
async function getNextWorkingProxy(req, res) {
  try {
    const result = await proxyManagementService.getNextWorkingProxy();
    res.status(200).json(result);

  } catch (error) {
    logger.error('Error in getNextWorkingProxy controller:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}


async function lockProxy(req, res) {
  try {
    const { proxyId, identifier, namespace } = req.body;

    if (!proxyId || !identifier) {
      return res.status(400).json({
        success: false,
        message: "Proxy ID and identifier are required"
      });
    }

    const result = await proxyManagementService.lockProxy(proxyId, identifier, namespace);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Error in lockProxy controller:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}

async function unlockProxy(req, res) {
  try {
    const { lockKey } = req.body;

    if (!lockKey) {
      return res.status(400).json({
        success: false,
        message: "Lock key is required"
      });
    }

    const result = await proxyManagementService.unlockProxy(lockKey);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    logger.error('Error in unlockProxy controller:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}

module.exports = {
  addProxy,
  removeProxy,
  getProxies,
  getProxyStats,
  getProxyManagementStats, // ← NEW: Get proxy management stats
  getNextProxy,
  updateProxy,
  updateProxyStatus,
  clearAllProxies,
  getAvailableProxies,
  getLastMonthProxies,
  switchToNextWorkingProxy,
  getSystemHealth,
  markProxyAsFailed,     
  markProxyAsWorking,    
  getNextWorkingProxy,    
  lockProxy,              // ← NEW: Lock proxy functionality
  unlockProxy            
};

