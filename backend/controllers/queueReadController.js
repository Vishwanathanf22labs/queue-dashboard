const queueService = require("../services/queueService");
const logger = require("../utils/logger");

async function getQueueOverview(req, res) {
  try {
    const queueData = await queueService.getQueueOverview();
    res.status(200).json({
      success: true,
      data: queueData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getQueueOverview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch queue overview",
      error: error.message,
    });
  }
}

async function getPendingBrands(req, res) {
  try {
    const { page = 1, limit = 10, search = null } = req.query;
    const pendingBrands = await queueService.getPendingBrands(
      parseInt(page),
      parseInt(limit),
      search
    );

    res.status(200).json({
      success: true,
      data: pendingBrands,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getPendingBrands:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending brands",
      error: error.message,
    });
  }
}

async function getFailedBrands(req, res) {
  try {
    const { page = 1, limit = 10, search = null } = req.query;
    const failedBrands = await queueService.getFailedBrands(
      parseInt(page),
      parseInt(limit),
      search
    );

    res.status(200).json({
      success: true,
      data: failedBrands,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getFailedBrands:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch failed brands",
      error: error.message,
    });
  }
}

async function getCurrentlyProcessing(req, res) {
  try {
    const currentlyProcessing = await queueService.getCurrentlyProcessing();
    res.status(200).json({
      success: true,
      data: currentlyProcessing,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getCurrentlyProcessing:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch currently processing brand",
      error: error.message,
    });
  }
}

async function getNextBrand(req, res) {
  try {
    const nextBrand = await queueService.getNextBrand();
    res.status(200).json({
      success: true,
      data: nextBrand,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getNextBrand:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch next brand to be processed",
      error: error.message,
    });
  }
}

async function getQueueStats(req, res) {
  try {
    const stats = await queueService.getQueueStatistics();
    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getQueueStats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch queue statistics",
      error: error.message,
    });
  }
}

async function getBrandProcessingQueue(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const processingData = await queueService.getBrandProcessingQueue(
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      data: processingData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getBrandProcessingQueue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch brand processing queue",
      error: error.message,
    });
  }
}

async function getBrandsScrapedStats(req, res) {
  try {
    const { date, days } = req.query;

    let stats;
    if (days) {
      stats = await queueService.getBrandsScrapedStatsForDays(parseInt(days));
    } else {
      stats = await queueService.getBrandsScrapedStats(date);
    }

    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getBrandsScrapedStats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch brands scraped statistics",
      error: error.message,
    });
  }
}

async function searchBrands(req, res) {
  try {
    const { query, limit = 8 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
        timestamp: new Date().toISOString(),
      });
    }

    const searchResults = await queueService.searchBrands(
      query.trim(),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      data: searchResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in searchBrands:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search brands",
      error: error.message,
    });
  }
}

async function changeBrandScore(req, res) {
  try {
    const { queueType, brandName, newScore } = req.body;

    if (!queueType || !brandName || newScore === undefined || newScore === null) {
      return res.status(400).json({
        success: false,
        message: "Queue type, brand name, and new score are required",
        timestamp: new Date().toISOString(),
      });
    }

    if (queueType !== 'pending' && queueType !== 'failed') {
      return res.status(400).json({
        success: false,
        message: "Queue type must be 'pending' or 'failed'",
        timestamp: new Date().toISOString(),
      });
    }

    if (isNaN(parseFloat(newScore))) {
      return res.status(400).json({
        success: false,
        message: "New score must be a valid number",
        timestamp: new Date().toISOString(),
      });
    }

    const result = await queueService.changeBrandScore(queueType, brandName, parseFloat(newScore));

    res.status(200).json({
      success: true,
      data: result,
      message: `Successfully updated brand "${brandName}" score to ${newScore} in ${queueType} queue`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in changeBrandScore:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change brand score",
      error: error.message,
    });
  }
}

module.exports = {
  getQueueOverview,
  getPendingBrands,
  getFailedBrands,
  getCurrentlyProcessing,
  getNextBrand,
  getQueueStats,
  getBrandProcessingQueue,
  getBrandsScrapedStats,
  searchBrands,
  changeBrandScore,
};
