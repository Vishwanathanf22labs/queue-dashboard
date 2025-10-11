const { getGlobalRedis } = require("../utils/redisSelector");
const {
  validateConfigUpdates,
  getAllowedConfigKeys,
} = require("../services/utils/configValidation");
const logger = require("../utils/logger");

async function getConfigSettings(req, res) {
  try {
    logger.info("Getting config settings from Redis");

    const redis = getGlobalRedis(req.environment);

    const configData = await redis.hgetall("metadata");

    const allowedKeys = getAllowedConfigKeys();

    res.json({
      success: true,
      data: {
        config: configData,
        allowedKeys: allowedKeys,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error getting config settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get config settings",
      error: error.message,
    });
  }
}

async function updateConfigSettings(req, res) {
  try {
    const { updates } = req.body;

    if (!updates || typeof updates !== "object") {
      return res.status(400).json({
        success: false,
        message: "Updates object is required",
      });
    }

    logger.info("Updating config settings in Redis", {
      keys: Object.keys(updates),
    });

    const validation = validateConfigUpdates(updates);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const redis = getGlobalRedis(req.environment);

    const updateResults = {};
    for (const [key, value] of Object.entries(updates)) {
      await redis.hset("metadata", key, value);
      updateResults[key] = value;
    }

    logger.info("Successfully updated config settings", {
      updatedKeys: Object.keys(updateResults),
    });

    res.json({
      success: true,
      message: "Config settings updated successfully",
      data: {
        updated: updateResults,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error updating config settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update config settings",
      error: error.message,
    });
  }
}

module.exports = {
  getConfigSettings,
  updateConfigSettings,
};
