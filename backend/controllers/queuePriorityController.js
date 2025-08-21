const queuePriorityService = require("../services/queuePriorityService");
const logger = require("../utils/logger");

async function changeBrandPriority(req, res) {
  try {
    const { queueType, brandName, newPosition } = req.body;

    // Validate required fields
    if (!queueType || !brandName || newPosition === undefined) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: queueType, brandName, newPosition",
      });
    }

    // Validate queueType
    if (!["pending", "failed"].includes(queueType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid queueType. Must be 'pending' or 'failed'",
      });
    }

    // Validate brandName
    if (!brandName || brandName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "brandName must be at least 2 characters long",
      });
    }

    // Validate newPosition
    if (!Number.isInteger(newPosition) || newPosition < 1) {
      return res.status(400).json({
        success: false,
        message: "newPosition must be a positive integer",
      });
    }

    logger.info(
      `Priority change request: ${queueType} queue, brand "${brandName}" to position ${newPosition}`
    );

    const result = await queuePriorityService.changeBrandPriority(
      queueType,
      brandName,
      newPosition
    );

    res.json({
      success: true,
      message: "Brand priority changed successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error in changeBrandPriority controller:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to change brand priority",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

module.exports = {
  changeBrandPriority,
};
