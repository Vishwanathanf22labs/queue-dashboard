const queueService = require("../services/queueService");
const queueReenqueueService = require("../services/queueReenqueueService");
const cacheUtils = require("../services/utils/cacheUtils");
const adUpdateProcessingService = require("../services/adUpdateProcessingService");
const logger = require("../utils/logger");

async function getQueueOverview(req, res) {
  try {
    const queueData = await queueService.getQueueOverview(req.environment);
    res.status(200).json(queueData);
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
    const {
      page = 1,
      limit = 10,
      search = null,
      queueType = "regular",
    } = req.query;
    const pendingBrands = await queueService.getPendingBrands(
      parseInt(page),
      parseInt(limit),
      search,
      queueType,
      req.environment
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
    const {
      page = 1,
      limit = 10,
      search = null,
      queueType = "regular",
    } = req.query;
    const failedBrands = await queueService.getFailedBrands(
      parseInt(page),
      parseInt(limit),
      search,
      queueType,
      req.environment
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
    const currentlyProcessing = await queueService.getCurrentlyProcessing(
      req.environment
    );
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
    const { queueType = "regular" } = req.query;
    const nextBrands = await queueService.getNextBrand(
      queueType,
      req.environment
    );
    res.status(200).json({
      success: true,
      data: nextBrands,
      count: nextBrands ? nextBrands.length : 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getNextBrand:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch next brands to be processed",
      error: error.message,
    });
  }
}

async function getNextWatchlistBrand(req, res) {
  try {
    const nextWatchlistBrands = await queueService.getNextWatchlistBrand();
    res.status(200).json({
      success: true,
      data: nextWatchlistBrands,
      count: nextWatchlistBrands ? nextWatchlistBrands.length : 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getNextWatchlistBrand:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch next watchlist brands to be processed",
      error: error.message,
    });
  }
}

async function getQueueStats(req, res) {
  try {
    const stats = await queueService.getQueueStatistics(req.environment);
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
    const {
      page = 1,
      limit = 10,
      queueType = "regular",
      sortBy = "normal",
      sortOrder = "desc",
      search = null,
    } = req.query;
    const ifNoneMatch = req.headers["if-none-match"];

    const processingData = await queueService.getBrandProcessingQueue(
      parseInt(page),
      parseInt(limit),
      queueType,
      sortBy,
      sortOrder,
      ifNoneMatch,
      search,
      req.environment
    );

    if (processingData.status === 304) {
      res.set("ETag", processingData.etag);
      return res.status(304).end();
    }

    if (processingData.etag) {
      res.set("ETag", processingData.etag);
    }

    res.status(200).json(processingData);
  } catch (error) {
    logger.error("Error in getBrandProcessingQueue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch brand processing queue",
      error: error.message,
    });
  }
}

async function getWatchlistBrandsQueue(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "normal",
      sortOrder = "desc",
      search = null,
    } = req.query;
    const ifNoneMatch = req.headers["if-none-match"];

    const watchlistData = await queueService.getWatchlistBrandsQueue(
      parseInt(page),
      parseInt(limit),
      sortBy,
      sortOrder,
      ifNoneMatch,
      search,
      req.environment
    );

    if (watchlistData.status === 304) {
      res.set("ETag", watchlistData.etag);
      return res.status(304).end();
    }

    if (watchlistData.etag) {
      res.set("ETag", watchlistData.etag);
    }

    res.status(200).json(watchlistData);
  } catch (error) {
    logger.error("Error in getWatchlistBrandsQueue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch watchlist brands queue",
      error: error.message,
    });
  }
}

async function getBrandsScrapedStats(req, res) {
  try {
    const { date, days } = req.query;

    let stats;
    if (days) {
      stats = await queueService.getBrandsScrapedStatsForDays(
        parseInt(days),
        req.environment
      );
    } else {
      stats = await queueService.getBrandsScrapedStats(date, req.environment);
    }

    res.status(200).json(stats);
  } catch (error) {
    logger.error("Error in getBrandsScrapedStats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch brands scraped statistics",
      error: error.message,
    });
  }
}

async function getSeparateBrandsScrapedStats(req, res) {
  try {
    const { date, days } = req.query;

    let stats;
    if (days) {
      stats = await queueService.getSeparateBrandsScrapedStatsForDays(
        parseInt(days),
        req.environment
      );
    } else {
      stats = await queueService.getSeparateBrandsScrapedStats(
        date,
        req.environment
      );
    }

    res.status(200).json(stats);
  } catch (error) {
    logger.error("Error in getSeparateBrandsScrapedStats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch separate brands scraped statistics",
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

async function getWatchlistBrands(req, res) {
  try {
    const { page = 1, limit = 100, search = null } = req.query;
    const watchlistBrands = await queueService.getWatchlistBrands(
      parseInt(page),
      parseInt(limit),
      search,
      req.environment
    );

    res.status(200).json({
      success: true,
      data: watchlistBrands,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getWatchlistBrands:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch watchlist brands",
      error: error.message,
    });
  }
}

async function getWatchlistPendingBrands(req, res) {
  try {
    const { page = 1, limit = 100, search = null } = req.query;
    const watchlistPendingBrands = await queueService.getWatchlistPendingBrands(
      parseInt(page),
      parseInt(limit),
      search,
      req.environment
    );

    res.status(200).json({
      success: true,
      data: watchlistPendingBrands,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getWatchlistPendingBrands:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch watchlist pending brands",
      error: error.message,
    });
  }
}

async function getWatchlistFailedBrands(req, res) {
  try {
    const { page = 1, limit = 100, search = null } = req.query;
    const watchlistFailedBrands = await queueService.getWatchlistFailedBrands(
      parseInt(page),
      parseInt(limit),
      search,
      req.environment
    );

    res.status(200).json({
      success: true,
      data: watchlistFailedBrands,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getWatchlistFailedBrands:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch watchlist failed brands",
      error: error.message,
    });
  }
}

async function changeBrandScore(req, res) {
  try {
    const { queueType, brandName, newScore } = req.body;

    if (
      !queueType ||
      !brandName ||
      newScore === undefined ||
      newScore === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Queue type, brand identifier, and new score are required",
        timestamp: new Date().toISOString(),
      });
    }

    if (
      queueType !== "pending" &&
      queueType !== "failed" &&
      queueType !== "watchlist_pending" &&
      queueType !== "watchlist_failed"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Queue type must be 'pending', 'failed', 'watchlist_pending', or 'watchlist_failed'",
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

    const result = await queueService.changeBrandScore(
      queueType,
      brandName,
      parseFloat(newScore),
      req.environment
    );

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

async function getReenqueueData(req, res) {
  try {
    const { page = 1, limit = 10, search = null, namespace = null } = req.query;
    const reenqueueData = await queueReenqueueService.getReenqueueData(
      parseInt(page),
      parseInt(limit),
      search,
      namespace,
      req.environment
    );

    res.status(200).json({
      success: true,
      data: reenqueueData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in getReenqueueData:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reenqueue data",
      error: error.message,
    });
  }
}

async function getAllBrandProcessingJobs(req, res) {
  try {
    const { queueType = "regular" } = req.query;
    const ifNoneMatch = req.headers["if-none-match"];

    const processingData = await queueService.getAllBrandProcessingJobs(
      queueType,
      ifNoneMatch,
      req.environment
    );

    if (processingData.status === 304) {
      res.set("ETag", processingData.etag);
      return res.status(304).end();
    }

    if (processingData.etag) {
      res.set("ETag", processingData.etag);
    }

    res.status(200).json(processingData);
  } catch (error) {
    logger.error("Error in getAllBrandProcessingJobs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all brand processing jobs",
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
  getNextWatchlistBrand,
  getQueueStats,
  getBrandProcessingQueue,
  getWatchlistBrandsQueue,
  getAllBrandProcessingJobs,
  getBrandsScrapedStats,
  getSeparateBrandsScrapedStats,
  searchBrands,
  getWatchlistBrands,
  getWatchlistPendingBrands,
  getWatchlistFailedBrands,
  changeBrandScore,
  getReenqueueData,
  invalidateQueueCache,
  getAdUpdateQueue,
  getWatchlistAdUpdateQueue,
  getAllAdUpdateJobs,
};

async function getAdUpdateQueue(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      queueType = "regular",
      sortBy = "normal",
      sortOrder = "desc",
      search = null,
    } = req.query;
    const ifNoneMatch = req.headers["if-none-match"];

    const processingData = await adUpdateProcessingService.getAdUpdateQueue(
      parseInt(page),
      parseInt(limit),
      queueType,
      sortBy,
      sortOrder,
      ifNoneMatch,
      search,
      req.environment
    );

    if (processingData.status === 304) {
      res.set("ETag", processingData.etag);
      return res.status(304).end();
    }

    if (processingData.etag) {
      res.set("ETag", processingData.etag);
    }

    res.status(200).json(processingData);
  } catch (error) {
    logger.error("Error in getAdUpdateQueue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ad-update processing queue",
      error: error.message,
    });
  }
}

async function getWatchlistAdUpdateQueue(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "normal",
      sortOrder = "desc",
      search = null,
    } = req.query;
    const ifNoneMatch = req.headers["if-none-match"];

    const watchlistData =
      await adUpdateProcessingService.getWatchlistAdUpdateQueue(
        parseInt(page),
        parseInt(limit),
        sortBy,
        sortOrder,
        ifNoneMatch,
        search
      );

    if (watchlistData.status === 304) {
      res.set("ETag", watchlistData.etag);
      return res.status(304).end();
    }

    if (watchlistData.etag) {
      res.set("ETag", watchlistData.etag);
    }

    res.status(200).json(watchlistData);
  } catch (error) {
    logger.error("Error in getWatchlistAdUpdateQueue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch watchlist ad-update queue",
      error: error.message,
    });
  }
}

async function getAllAdUpdateJobs(req, res) {
  try {
    const { queueType = "regular" } = req.query;
    const ifNoneMatch = req.headers["if-none-match"];

    const allJobsData = await adUpdateProcessingService.getAllAdUpdateJobs(
      queueType,
      ifNoneMatch,
      req.environment
    );

    if (allJobsData.status === 304) {
      res.set("ETag", allJobsData.etag);
      return res.status(304).end();
    }

    if (allJobsData.etag) {
      res.set("ETag", allJobsData.etag);
    }

    res.status(200).json(allJobsData);
  } catch (error) {
    logger.error("Error in getAllAdUpdateJobs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all ad-update jobs",
      error: error.message,
    });
  }
}

async function invalidateQueueCache(req, res) {
  try {
    logger.info("Cache invalidation request received");

    res.status(200).json({
      success: true,
      message: "Queue cache invalidation started",
      timestamp: new Date().toISOString(),
    });

    cacheUtils.invalidateQueueCache().catch((error) => {
      logger.error("Background cache invalidation error:", error);
    });
  } catch (error) {
    logger.error("Error in invalidateQueueCache:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start cache invalidation",
      error: error.message,
    });
  }
}
