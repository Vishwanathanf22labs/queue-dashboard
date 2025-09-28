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

/**
 * Get current environment information
 */
const getCurrentEnvironmentInfo = async (req, res) => {
  try {
    const currentEnv = getCurrentEnvironment();
    const config = getCurrentConfig();
    const availableEnvs = getAvailableEnvironments();

    res.json({
      success: true,
      data: {
        currentEnvironment: currentEnv,
        availableEnvironments: availableEnvs,
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

/**
 * Switch to a different environment
 */
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

    const currentEnv = getCurrentEnvironment();
    if (environment === currentEnv) {
      return res.json({
        success: true,
        message: `Already using ${environment} environment`,
        data: { currentEnvironment: environment }
      });
    }

    // Switch environment
    setCurrentEnvironment(environment);
    
    // Reinitialize database connection with new environment settings
    try {
      await reinitializeDatabase();
      logger.info(`Database reconnected for environment: ${environment}`);
      
      // Reinitialize models with new database connection
      await reinitializeModels();
      logger.info(`Models reinitialized for environment: ${environment}`);
    } catch (dbError) {
      logger.error(`Failed to reconnect database for environment ${environment}:`, dbError);
      // Continue with the switch even if database reconnection fails
    }
    
    // Reinitialize Redis connections with new environment settings
    try {
      await reinitializeRedis();
      logger.info(`Redis connections reinitialized for environment: ${environment}`);
    } catch (redisError) {
      logger.error(`Failed to reconnect Redis for environment ${environment}:`, redisError);
      // Continue with the switch even if Redis reconnection fails
    }
    
    // Clear all service caches to ensure fresh data from new environment
    try {
      const { clearAllCaches: clearQueueProcessingCaches } = require("../services/queueProcessingService");
      const { clearAllCaches: clearQueueOverviewCaches } = require("../services/queueOverviewService");
      const { reinitializeCacheRedisClient } = require("../services/utils/cacheUtils");
      
      clearQueueProcessingCaches();
      clearQueueOverviewCaches();
      reinitializeCacheRedisClient();
      
      logger.info(`All service caches cleared for environment: ${environment}`);
    } catch (cacheError) {
      logger.error(`Failed to clear service caches for environment ${environment}:`, cacheError);
      // Continue with the switch even if cache clearing fails
    }
    
    // Wait a moment for everything to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newConfig = getCurrentConfig();

    logger.info(`Environment switched from ${currentEnv} to ${environment}`);

    // Test database connection with new environment
    let dbTestResult = null;
    try {
      const { Brand } = require("../models");
      const activeBrandsCount = await Brand.count({ where: { status: "Active" } });
      const totalBrandsCount = await Brand.count();
      dbTestResult = { 
        activeBrandsCount, 
        totalBrandsCount,
        success: true 
      };
      logger.info(`Database test successful - Active brands: ${activeBrandsCount}, Total brands: ${totalBrandsCount}`);
    } catch (testError) {
      logger.error("Database test failed:", testError);
      dbTestResult = { error: testError.message, success: false };
    }

    res.json({
      success: true,
      message: `Successfully switched to ${environment} environment`,
      data: {
        previousEnvironment: currentEnv,
        currentEnvironment: environment,
        dbTest: dbTestResult,
        config: {
          database: {
            host: newConfig.DB_HOST,
            port: newConfig.DB_PORT,
            name: newConfig.DB_NAME
          },
          redis: {
            global: {
              host: newConfig.REDIS_HOST,
              port: newConfig.REDIS_PORT
            },
            watchlist: {
              host: newConfig.WATCHLIST_REDIS_QUEUE_HOST,
              port: newConfig.WATCHLIST_REDIS_QUEUE_PORT
            },
            regular: {
              host: newConfig.REGULAR_REDIS_QUEUE_HOST,
              port: newConfig.REGULAR_REDIS_QUEUE_PORT
            },
            cache: {
              host: newConfig.CACHE_REDIS_HOST,
              port: newConfig.CACHE_REDIS_PORT
            }
          },
          queues: {
            pending: newConfig.PENDING_BRANDS_QUEUE,
            failed: newConfig.FAILED_BRANDS_QUEUE,
            processing: newConfig.CURRENTLY_PROCESSING
          },
          scraper: {
            url: newConfig.MADANGLES_SCRAPER_URL
          }
        }
      }
    });
  } catch (error) {
    logger.error("Error switching environment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to switch environment",
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
