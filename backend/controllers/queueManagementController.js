const queueManagementService = require("../services/queueManagementService");
const logger = require("../utils/logger");

async function clearAllQueues(req, res) {
  try {
    logger.info("Clear all queues request received");

    const result = await queueManagementService.clearAllQueues(req.environment);

    res.status(200).json({
      success: true,
      message: "All queues cleared successfully",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in clearAllQueues controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear all queues",
      error: error.message,
    });
  }
}

async function clearPendingQueue(req, res) {
  try {
    const { queueType = "regular" } = req.query;
    logger.info(`Clear ${queueType} pending queue request received`);

    const result = await queueManagementService.clearPendingQueue(
      queueType,
      req.environment
    );

    res.status(200).json({
      success: true,
      message: `${queueType} pending queue cleared successfully`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in clearPendingQueue controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear pending queue",
      error: error.message,
    });
  }
}

async function clearFailedQueue(req, res) {
  try {
    const { queueType = "regular" } = req.query;
    logger.info(`Clear ${queueType} failed queue request received`);

    const result = await queueManagementService.clearFailedQueue(
      queueType,
      req.environment
    );

    res.status(200).json({
      success: true,
      message: `${queueType} failed queue cleared successfully`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in clearFailedQueue controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear failed queue",
      error: error.message,
    });
  }
}

async function movePendingToFailed(req, res) {
  try {
    const { id } = req.params;
    const { queueType = "regular" } = req.query;
    logger.info(
      `Move ${queueType} pending to failed request received for queue ID: ${id}`
    );

    const result = await queueManagementService.movePendingToFailed(
      parseInt(id),
      queueType,
      req.environment
    );

    res.status(200).json({
      success: true,
      message: `Brand moved from ${queueType} pending to failed queue successfully`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in movePendingToFailed controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move brand from pending to failed queue",
      error: error.message,
    });
  }
}

async function moveFailedToPending(req, res) {
  try {
    const { id } = req.params;
    const { queueType = "regular" } = req.query;
    logger.info(
      `Move ${queueType} failed to pending request received for brand ID: ${id}`
    );

    const result = await queueManagementService.moveFailedToPending(
      parseInt(id),
      queueType,
      req.environment
    );

    res.status(200).json({
      success: true,
      message: `Brand moved from ${queueType} failed to pending queue successfully`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in moveFailedToPending controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move brand from failed to pending queue",
      error: error.message,
    });
  }
}

async function removePendingBrand(req, res) {
  try {
    const { id } = req.params;
    const { queueType = "regular" } = req.query;
    logger.info(
      `Remove ${queueType} pending brand request received for brand ID: ${id}`
    );

    const result = await queueManagementService.removePendingBrand(
      parseInt(id),
      queueType,
      req.environment
    );

    res.status(200).json({
      success: true,
      message: `Brand removed from ${queueType} pending queue successfully`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in removePendingBrand controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove brand from pending queue",
      error: error.message,
    });
  }
}

async function removeFailedBrand(req, res) {
  try {
    const { id } = req.params;
    const { queueType = "regular" } = req.query;
    logger.info(
      `Remove ${queueType} failed brand request received for brand ID: ${id}`
    );

    const result = await queueManagementService.removeFailedBrand(
      parseInt(id),
      queueType,
      req.environment
    );

    res.status(200).json({
      success: true,
      message: `Brand removed from ${queueType} failed queue successfully`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in removeFailedBrand controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove brand from failed queue",
      error: error.message,
    });
  }
}

async function moveAllPendingToFailed(req, res) {
  try {
    logger.info("Move all pending to failed request received");

    const result = await queueManagementService.moveAllPendingToFailed(
      req.environment
    );

    res.status(200).json({
      success: true,
      message: "All pending brands moved to failed queue successfully",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in moveAllPendingToFailed controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move all pending brands to failed queue",
      error: error.message,
    });
  }
}

async function moveAllFailedToPending(req, res) {
  try {
    logger.info("Move all failed to pending request received");

    const result = await queueManagementService.moveAllFailedToPending(
      req.environment
    );

    res.status(200).json({
      success: true,
      message: "All failed brands moved to pending queue successfully",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in moveAllFailedToPending controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move all failed brands to pending queue",
      error: error.message,
    });
  }
}

async function moveWatchlistFailedToPending(req, res) {
  try {
    logger.info("Move watchlist failed to pending request received");

    const result = await queueManagementService.moveWatchlistFailedToPending(
      req.environment
    );

    res.status(200).json({
      success: true,
      message: "Watchlist failed brands moved to pending queue successfully",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in moveWatchlistFailedToPending controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move watchlist failed brands to pending queue",
      error: error.message,
    });
  }
}

async function moveWatchlistToPending(req, res) {
  try {
    logger.info("Move watchlist to pending request received");

    const result = await queueManagementService.moveWatchlistToPending(
      req.environment
    );

    res.status(200).json({
      success: true,
      message: "Watchlist brands moved to pending queue successfully",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in moveWatchlistToPending controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move watchlist brands to pending queue",
      error: error.message,
    });
  }
}

async function getQueueManagementStats(req, res) {
  try {
    logger.info("Get queue management stats request received");

    const result = await queueManagementService.getQueueStats();

    res.status(200).json({
      success: true,
      message: "Queue statistics retrieved successfully",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getQueueManagementStats controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get queue statistics",
      error: error.message,
    });
  }
}

async function moveIndividualWatchlistFailedToPending(req, res) {
  try {
    const { id } = req.params;
    logger.info(
      `Move individual watchlist failed to pending request received for brand ID: ${id}`
    );

    const result =
      await queueManagementService.moveIndividualWatchlistFailedToPending(
        parseInt(id),
        req.environment
      );

    res.status(200).json({
      success: true,
      message:
        "Individual watchlist failed brand moved to pending queue successfully",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      "Error in moveIndividualWatchlistFailedToPending controller:",
      error
    );
    res.status(500).json({
      success: false,
      message:
        "Failed to move individual watchlist failed brand to pending queue",
      error: error.message,
    });
  }
}

async function clearWatchlistPendingQueue(req, res) {
  try {
    logger.info("Clear watchlist pending queue request received");

    const result = await queueManagementService.clearWatchlistPendingQueue(
      req.environment
    );

    res.status(200).json({
      success: true,
      message: "Watchlist pending queue cleared successfully",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in clearWatchlistPendingQueue controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear watchlist pending queue",
      error: error.message,
    });
  }
}

async function clearWatchlistFailedQueue(req, res) {
  try {
    logger.info("Clear watchlist failed queue request received");

    const result = await queueManagementService.clearWatchlistFailedQueue(
      req.environment
    );

    res.status(200).json({
      success: true,
      message: "Watchlist failed queue cleared successfully",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in clearWatchlistFailedQueue controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear watchlist failed queue",
      error: error.message,
    });
  }
}

async function moveAllWatchlistPendingToFailed(req, res) {
  try {
    logger.info("Move all watchlist pending to failed request received");

    const result = await queueManagementService.moveAllWatchlistPendingToFailed(
      req.environment
    );

    res.status(200).json({
      success: true,
      message:
        "All watchlist pending brands moved to failed queue successfully",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in moveAllWatchlistPendingToFailed controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move all watchlist pending brands to failed queue",
      error: error.message,
    });
  }
}

async function moveAllWatchlistFailedToPending(req, res) {
  try {
    logger.info("Move all watchlist failed to pending request received");

    const result = await queueManagementService.moveAllWatchlistFailedToPending(
      req.environment
    );

    res.status(200).json({
      success: true,
      message: result.message,
      moved_count: result.moved_count,
      moved_brands: result.moved_brands,
      parse_errors: result.parse_errors,
      invalid_brands: result.invalid_brands,
      skipped_brands: result.skipped_brands,
      total_found: result.total_found,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in moveAllWatchlistFailedToPending controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move all watchlist failed brands to pending queue",
      error: error.message,
    });
  }
}

async function cleanupWatchlistFailedQueue(req, res) {
  try {
    logger.info("Cleanup watchlist failed queue request received");

    const result = await queueManagementService.cleanupWatchlistFailedQueue(
      req.environment
    );

    res.status(200).json({
      success: true,
      message: result.message,
      cleaned_count: result.cleaned_count,
      valid_count: result.valid_count,
      corrupted_brands: result.corrupted_brands,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in cleanupWatchlistFailedQueue controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cleanup watchlist failed queue",
      error: error.message,
    });
  }
}

module.exports = {
  clearAllQueues,
  clearPendingQueue,
  clearFailedQueue,
  movePendingToFailed,
  moveFailedToPending,
  removePendingBrand,
  removeFailedBrand,
  moveAllPendingToFailed,
  moveAllFailedToPending,
  moveWatchlistFailedToPending,
  moveWatchlistToPending,
  getQueueManagementStats,
  moveIndividualWatchlistFailedToPending,
  clearWatchlistPendingQueue,
  clearWatchlistFailedQueue,
  moveAllWatchlistPendingToFailed,
  moveAllWatchlistFailedToPending,
  cleanupWatchlistFailedQueue,
};
