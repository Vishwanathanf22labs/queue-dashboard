const queueManagementService = require("../services/queueManagementService");
const logger = require("../utils/logger");

async function clearAllQueues(req, res) {
  try {
    logger.info("Clear all queues request received");

    const result = await queueManagementService.clearAllQueues();

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
    logger.info("Clear pending queue request received");

    const result = await queueManagementService.clearPendingQueue();

    res.status(200).json({
      success: true,
      message: "Pending queue cleared successfully",
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
    logger.info("Clear failed queue request received");

    const result = await queueManagementService.clearFailedQueue();

    res.status(200).json({
      success: true,
      message: "Failed queue cleared successfully",
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
    logger.info(`Move pending to failed request received for queue ID: ${id}`);

    const result = await queueManagementService.movePendingToFailed(
      parseInt(id)
    );

    res.status(200).json({
      success: true,
      message: "Brand moved from pending to failed queue successfully",
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
    logger.info(`Move failed to pending request received for brand ID: ${id}`);

    const result = await queueManagementService.moveFailedToPending(
      parseInt(id)
    );

    res.status(200).json({
      success: true,
      message: "Brand moved from failed to pending queue successfully",
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
    logger.info(`Remove pending brand request received for brand ID: ${id}`);

    const result = await queueManagementService.removePendingBrand(
      parseInt(id)
    );

    res.status(200).json({
      success: true,
      message: "Brand removed from pending queue successfully",
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
    logger.info(`Remove failed brand request received for brand ID: ${id}`);

    const result = await queueManagementService.removeFailedBrand(parseInt(id));

    res.status(200).json({
      success: true,
      message: "Brand removed from failed queue successfully",
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

    const result = await queueManagementService.moveAllPendingToFailed();

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

    const result = await queueManagementService.moveAllFailedToPending();

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

    const result = await queueManagementService.moveWatchlistFailedToPending();

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

    const result = await queueManagementService.moveWatchlistToPending();

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
    logger.info(`Move individual watchlist failed to pending request received for brand ID: ${id}`);

    const result = await queueManagementService.moveIndividualWatchlistFailedToPending(
      parseInt(id)
    );

    res.status(200).json({
      success: true,
      message: "Individual watchlist failed brand moved to pending queue successfully",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in moveIndividualWatchlistFailedToPending controller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move individual watchlist failed brand to pending queue",
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
};
