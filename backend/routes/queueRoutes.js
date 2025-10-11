const express = require("express");
const queueController = require("../controllers/queueController");
const queueManagementRoutes = require("./queueManagementRoutes");
const queueReenqueueController = require("../controllers/queueReenqueueController");

const proxyManagementRoutes = require("./proxyManagementRoutes");
const scraperControlController = require("../controllers/scraperControlController");
const adminAuth = require("../middleware/adminAuth");
const brandManagementController = require("../controllers/brandManagementController");
const { getCacheRedisClient } = require("../services/utils/cacheUtils");

const router = express.Router();

router.get("/overview", queueController.getQueueOverview);
router.get("/pending", queueController.getPendingBrands);
router.get("/failed", queueController.getFailedBrands);
router.get("/reenqueue-data", queueController.getReenqueueData);
router.get("/watchlist", queueController.getWatchlistBrands);
router.get(
  "/watchlist-pending-brands",
  queueController.getWatchlistPendingBrands
);
router.get(
  "/watchlist-failed-brands",
  queueController.getWatchlistFailedBrands
);
router.get("/currently-processing", queueController.getCurrentlyProcessing);
router.get("/next-brand", queueController.getNextBrand);
router.get("/next-watchlist-brand", queueController.getNextWatchlistBrand);
router.get("/stats", queueController.getQueueStats);

router.get("/brand-processing", queueController.getBrandProcessingQueue);
router.get("/watchlist-brands", queueController.getWatchlistBrandsQueue);
router.get(
  "/all-brand-processing-jobs",
  queueController.getAllBrandProcessingJobs
);

router.get("/ad-update-processing", queueController.getAdUpdateQueue);
router.get("/watchlist-ad-update", queueController.getWatchlistAdUpdateQueue);
router.get("/all-ad-update-jobs", queueController.getAllAdUpdateJobs);
router.get("/scraped-stats", queueController.getBrandsScrapedStats);
router.get(
  "/scraped-stats/separate",
  queueController.getSeparateBrandsScrapedStats
);

router.get("/search-brands", queueController.searchBrands);

router.get("/brand-counts", queueController.getBrandCounts);

router.get("/brand/status", brandManagementController.getBrandStatus);
router.put(
  "/brand/status",
  adminAuth,
  brandManagementController.updateBrandStatus
);

router.post(
  "/brand/status/bulk/preview",
  adminAuth,
  brandManagementController.bulkPreviewBrands
);
router.put(
  "/brand/status/bulk/apply",
  adminAuth,
  brandManagementController.bulkApplyStatusUpdates
);

router.post("/add-single", adminAuth, queueController.addSingleBrand);

router.post("/add-all", adminAuth, queueController.addAllBrands);

router.post(
  "/add-bulk-csv",
  adminAuth,
  queueController.upload.single("csv"),
  queueController.addBulkBrandsFromCSV
);

router.put("/change-score", adminAuth, queueController.changeBrandScore);

router.use("/queue-management", queueManagementRoutes);

router.post(
  "/reenqueue/single",
  adminAuth,
  queueReenqueueController.requeueSingleBrand
);
router.post(
  "/reenqueue/all",
  adminAuth,
  queueReenqueueController.requeueAllBrands
);
router.delete(
  "/reenqueue/single",
  adminAuth,
  queueReenqueueController.deleteSingleBrand
);
router.delete(
  "/reenqueue/all",
  adminAuth,
  queueReenqueueController.deleteAllBrands
);

router.use("/proxy", proxyManagementRoutes);

router.get("/scraper/status", scraperControlController.getScraperStatus);
router.post("/scraper/start", adminAuth, scraperControlController.startScraper);
router.post("/scraper/stop", adminAuth, scraperControlController.stopScraper);
router.get("/scraper/brand-timing", scraperControlController.getBrandTiming);

router.post("/cleanup-completed-brands", adminAuth, async (req, res) => {
  try {
    const queueOverviewService = require("../services/queueOverviewService");

    const cleanupInfo = {
      interval: "5 minutes",
      nextCleanup: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      currentTime: new Date().toISOString(),
    };

    await queueOverviewService.cleanupCompletedBrands();

    res.json({
      success: true,
      message: "Manual cleanup of completed brands completed successfully",
      cleanupInfo: cleanupInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cleanup completed brands",
      error: error.message,
    });
  }
});

router.delete("/clear-currently-processing", adminAuth, async (req, res) => {
  try {
    const { getGlobalRedis } = require("../utils/redisSelector");
    const { getRedisKeys } = require("../config/constants");
    const logger = require("../utils/logger");

    const environment = req.environment || "production";

    const REDIS_KEYS = getRedisKeys(environment);

    const currentlyScrapingBrands = await getGlobalRedis(environment).lrange(
      REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING,
      0,
      -1
    );
    const countBeforeClear = currentlyScrapingBrands
      ? currentlyScrapingBrands.length
      : 0;

    await getGlobalRedis(environment).del(
      REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING
    );

    logger.info(
      `Admin cleared all currently scraping brands [${environment}]: ${countBeforeClear} brands removed`
    );

    res.json({
      success: true,
      message: `All currently scraping brands cleared successfully`,
      data: {
        cleared_count: countBeforeClear,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error clearing currently scraping brands:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear currently scraping brands",
      error: error.message,
    });
  }
});

router.post("/clear-cache-only", adminAuth, async (req, res) => {
  try {
    const environment = req.environment || "production";

    const {
      getCacheRedisClientWithEnvironment,
    } = require("../services/utils/cacheUtils");
    const client = getCacheRedisClientWithEnvironment(environment);

    const cacheKeyPatterns = [
      "pipeline:*",
      "queue:*",
      "watchlist_brands",
      "overall_stats:*",
    ];

    let totalDeleted = 0;

    for (const pattern of cacheKeyPatterns) {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
        totalDeleted += keys.length;
        console.log(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
    }

    try {
      if (
        global.queueProcessingService &&
        global.queueProcessingService.clearInMemoryCaches
      ) {
        global.queueProcessingService.clearInMemoryCaches();
        console.log("QueueProcessingService in-memory caches cleared");
      }

      if (
        global.adUpdateProcessingService &&
        global.adUpdateProcessingService.clearInMemoryCaches
      ) {
        global.adUpdateProcessingService.clearInMemoryCaches();
        console.log("AdUpdateProcessingService in-memory caches cleared");
      }

      if (global.cacheUtils && global.cacheUtils.clearInMemoryFallbackCache) {
        global.cacheUtils.clearInMemoryFallbackCache();
        console.log("In-memory fallback cache cleared");
      }
    } catch (memoryError) {
      console.warn("Error clearing in-memory caches:", memoryError.message);
    }

    return res.json({
      success: true,
      message: `Cache Redis and in-memory caches cleared for ${environment} environment - ${totalDeleted} cache keys deleted`,
      deletedCount: totalDeleted,
      environment: environment,
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to clear Cache Redis",
        error: error.message,
      });
  }
});

router.post("/invalidate-cache", queueController.invalidateQueueCache);

module.exports = router;
