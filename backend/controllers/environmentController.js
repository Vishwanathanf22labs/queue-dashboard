const logger = require("../utils/logger");
const { 
  getCurrentEnvironment, 
  setCurrentEnvironment, 
  getAvailableEnvironments,
  getCurrentConfig 
} = require("../config/environmentConfig");
const { reinitializeDatabase } = require("../config/database");
const { reinitializeModels } = require("../models");
const { reinitializeRedis } = require("../config/redis");


const getCurrentEnvironmentInfo = async (req, res) => {
  try {

    const currentEnv = req.environment || 'production';
    const config = require("../config/environmentConfig").getConfig(currentEnv);
    const availableEnvs = getAvailableEnvironments();

    res.json({
      success: true,
      data: {
        currentEnvironment: currentEnv,
        availableEnvironments: availableEnvs,
        multiEnvironmentEnabled: true,
        config: {
          database: {
            host: config.DB_HOST,
            port: config.DB_PORT,
            name: config.DB_NAME
          },
          redis: {
            global: {
              host: config.REDIS_HOST,
              port: config.REDIS_PORT
            },
            watchlist: {
              host: config.WATCHLIST_REDIS_QUEUE_HOST,
              port: config.WATCHLIST_REDIS_QUEUE_PORT
            },
            regular: {
              host: config.REGULAR_REDIS_QUEUE_HOST,
              port: config.REGULAR_REDIS_QUEUE_PORT
            },
            cache: {
              host: config.CACHE_REDIS_HOST,
              port: config.CACHE_REDIS_PORT
            }
          },
          queues: {
            pending: config.PENDING_BRANDS_QUEUE,
            failed: config.FAILED_BRANDS_QUEUE,
            processing: config.CURRENTLY_PROCESSING
          },
          scraper: {
            url: config.MADANGLES_SCRAPER_URL
          }
        }
      }
    });
  } catch (error) {
    logger.error("Error getting environment info:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get environment information",
      error: error.message
    });
  }
};


const switchEnvironment = async (req, res) => {
  try {
    const { environment } = req.body;

    if (!environment) {
      return res.status(400).json({
        success: false,
        message: "Environment parameter is required"
      });
    }

    const availableEnvs = getAvailableEnvironments();
    if (!availableEnvs.includes(environment)) {
      return res.status(400).json({
        success: false,
        message: `Invalid environment. Must be one of: ${availableEnvs.join(', ')}`
      });
    }

   
    const config = require("../config/environmentConfig").getConfig(environment);

    logger.info(`Environment switch requested to ${environment} (client-side only)`);

    res.json({
      success: true,
      message: `Environment selection confirmed: ${environment}. This is now a per-user setting.`,
      data: {
        currentEnvironment: environment,
        config: {
          database: {
            host: config.DB_HOST,
            port: config.DB_PORT,
            name: config.DB_NAME
          },
          redis: {
            global: {
              host: config.REDIS_HOST,
              port: config.REDIS_PORT
            },
            watchlist: {
              host: config.WATCHLIST_REDIS_QUEUE_HOST,
              port: config.WATCHLIST_REDIS_QUEUE_PORT
            },
            regular: {
              host: config.REGULAR_REDIS_QUEUE_HOST,
              port: config.REGULAR_REDIS_QUEUE_PORT
            },
            cache: {
              host: config.CACHE_REDIS_HOST,
              port: config.CACHE_REDIS_PORT
            }
          },
          queues: {
            pending: config.PENDING_BRANDS_QUEUE,
            failed: config.FAILED_BRANDS_QUEUE,
            processing: config.CURRENTLY_PROCESSING
          },
          scraper: {
            url: config.MADANGLES_SCRAPER_URL
          }
        }
      }
    });
  } catch (error) {
    logger.error("Error in switchEnvironment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process environment switch",
      error: error.message
    });
  }
};

/**
 * Get available environments
 */
const getEnvironments = async (req, res) => {
  try {
    const environments = getAvailableEnvironments();
    
    res.json({
      success: true,
      data: {
        environments,
        currentEnvironment: getCurrentEnvironment()
      }
    });
  } catch (error) {
    logger.error("Error getting environments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get available environments",
      error: error.message
    });
  }
};

/**
 * Test Redis keys being used
 */
const testRedisKeys = async (req, res) => {
  try {
    const { REDIS_KEYS } = require("../config/constants");
    const { getQueueConfig } = require("../config/environmentConfig");
    
    const currentEnv = getCurrentEnvironment();
    const queueConfig = getQueueConfig();
    
    res.json({
      success: true,
      data: {
        currentEnvironment: currentEnv,
        queueConfig: queueConfig,
        redisKeys: {
          regular: {
            pending: REDIS_KEYS.REGULAR.PENDING_BRANDS,
            failed: REDIS_KEYS.REGULAR.FAILED_BRANDS
          },
          global: {
            currentlyProcessing: REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING
          }
        }
      }
    });
  } catch (error) {
    logger.error("Error in testRedisKeys:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get Redis keys",
      error: error.message,
    });
  }
};

module.exports = {
  getCurrentEnvironmentInfo,
  switchEnvironment,
  getEnvironments,
  testRedisKeys
};
