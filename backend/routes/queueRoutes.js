const express = require("express");
const queueController = require("../controllers/queueController");
const queueManagementRoutes = require("./queueManagementRoutes");
const queueReenqueueController = require("../controllers/queueReenqueueController");

const proxyManagementRoutes = require("./proxyManagementRoutes");
const scraperControlController = require('../controllers/scraperControlController');
const adminAuth = require("../middleware/adminAuth");
const brandManagementController = require("../controllers/brandManagementController");

const router = express.Router();

router.get("/overview", queueController.getQueueOverview);
router.get("/pending", queueController.getPendingBrands);
router.get("/failed", queueController.getFailedBrands);
router.get("/reenqueue-data", queueController.getReenqueueData);
router.get("/watchlist", queueController.getWatchlistBrands);
router.get("/watchlist-pending-brands", queueController.getWatchlistPendingBrands);
router.get("/watchlist-failed-brands", queueController.getWatchlistFailedBrands);
router.get("/currently-processing", queueController.getCurrentlyProcessing);
router.get("/next-brand", queueController.getNextBrand);
router.get("/next-watchlist-brand", queueController.getNextWatchlistBrand);
router.get("/stats", queueController.getQueueStats);

router.get("/brand-processing", queueController.getBrandProcessingQueue);
router.get("/watchlist-brands", queueController.getWatchlistBrandsQueue);
router.get("/all-brand-processing-jobs", queueController.getAllBrandProcessingJobs);

// Ad-update processing routes
router.get("/ad-update-processing", queueController.getAdUpdateQueue);
router.get("/watchlist-ad-update", queueController.getWatchlistAdUpdateQueue);
router.get("/all-ad-update-jobs", queueController.getAllAdUpdateJobs);
router.get("/scraped-stats", queueController.getBrandsScrapedStats);
router.get("/scraped-stats/separate", queueController.getSeparateBrandsScrapedStats);

// Brand search endpoint (READ operation - no auth required)
router.get("/search-brands", queueController.searchBrands);

// Get brand counts by status (READ operation - no auth required)
router.get("/brand-counts", queueController.getBrandCounts);

// Brand status read/update
router.get("/brand/status", brandManagementController.getBrandStatus);
router.put("/brand/status", adminAuth, brandManagementController.updateBrandStatus);

// Bulk brand status operations (admin only)
router.post("/brand/status/bulk/preview", adminAuth, brandManagementController.bulkPreviewBrands);
router.put("/brand/status/bulk/apply", adminAuth, brandManagementController.bulkApplyStatusUpdates);

// ADMIN ONLY: Brand addition routes (POST methods - require admin auth)
router.post(
  "/add-single",
  adminAuth,
  queueController.addSingleBrand
);

router.post(
  "/add-all",
  adminAuth,
  queueController.addAllBrands
);

router.post(
  "/add-bulk-csv",
  adminAuth,
  queueController.upload.single("csv"),
  queueController.addBulkBrandsFromCSV
);

// Change brand score (ADMIN ONLY)
router.put(
  "/change-score",
  adminAuth,
  queueController.changeBrandScore
);

// Queue Management Routes - Imported from separate file (ALL require admin auth)
router.use("/queue-management", queueManagementRoutes);

// Reenqueue Management Routes - Admin only
router.post("/reenqueue/single", adminAuth, queueReenqueueController.requeueSingleBrand);
router.post("/reenqueue/all", adminAuth, queueReenqueueController.requeueAllBrands);
router.delete("/reenqueue/single", adminAuth, queueReenqueueController.deleteSingleBrand);
router.delete("/reenqueue/all", adminAuth, queueReenqueueController.deleteAllBrands);



// Proxy Management Routes - Admin only
router.use("/proxy", proxyManagementRoutes);

// Scraper Control Routes - Admin only
router.get('/scraper/status', scraperControlController.getScraperStatus);
router.post('/scraper/start', adminAuth, scraperControlController.startScraper);
router.post('/scraper/stop', adminAuth, scraperControlController.stopScraper);
// Read-only: brand timing (accessible to all users)
router.get('/scraper/brand-timing', scraperControlController.getBrandTiming);

// Manual cleanup endpoint - Admin only (for testing/debugging)
router.post('/cleanup-completed-brands', adminAuth, async (req, res) => {
  try {
    const queueOverviewService = require('../services/queueOverviewService');
    
    // Get the cleanup interval info
    const cleanupInfo = {
      interval: '5 minutes',
      nextCleanup: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      currentTime: new Date().toISOString()
    };
    
    // Run manual cleanup
    await queueOverviewService.cleanupCompletedBrands();
    
    res.json({
      success: true,
      message: 'Manual cleanup of completed brands completed successfully',
      cleanupInfo: cleanupInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup completed brands',
      error: error.message
    });
  }
});

// Clear all currently scraping brands - Admin only
router.delete('/clear-currently-processing', adminAuth, async (req, res) => {
  try {
    const { getGlobalRedis } = require('../utils/redisSelector');
    const { REDIS_KEYS } = require('../config/constants');
    const logger = require('../utils/logger');
    
    // Get current count before clearing
    const currentlyScrapingBrands = await getGlobalRedis().lrange(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING, 0, -1);
    const countBeforeClear = currentlyScrapingBrands ? currentlyScrapingBrands.length : 0;
    
    // Clear the entire currently scraping Redis key
    await getGlobalRedis().del(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING);
    
    logger.info(`Admin cleared all currently scraping brands: ${countBeforeClear} brands removed`);
    
    res.json({
      success: true,
      message: `All currently scraping brands cleared successfully`,
      data: {
        cleared_count: countBeforeClear,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error clearing currently scraping brands:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear currently scraping brands',
      error: error.message
    });
  }
});

// Cache invalidation endpoint
router.post('/invalidate-cache', queueController.invalidateQueueCache);

module.exports = router;
