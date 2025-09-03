const express = require("express");
const queueController = require("../controllers/queueController");
const queueManagementRoutes = require("./queueManagementRoutes");

const proxyManagementRoutes = require("./proxyManagementRoutes");
const scraperControlController = require('../controllers/scraperControlController');
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

router.get("/overview", queueController.getQueueOverview);
router.get("/pending", queueController.getPendingBrands);
router.get("/failed", queueController.getFailedBrands);
router.get("/watchlist", queueController.getWatchlistBrands);
router.get("/watchlist-pending-brands-prod", queueController.getWatchlistPendingBrands);
router.get("/watchlist-failed-brands-prod", queueController.getWatchlistFailedBrands);
router.get("/currently-processing", queueController.getCurrentlyProcessing);
router.get("/next-brand", queueController.getNextBrand);
router.get("/next-watchlist-brand", queueController.getNextWatchlistBrand);
router.get("/stats", queueController.getQueueStats);

router.get("/brand-processing", queueController.getBrandProcessingQueue);
router.get("/watchlist-brands", queueController.getWatchlistBrandsQueue);
router.get("/scraped-stats", queueController.getBrandsScrapedStats);

// Brand search endpoint (READ operation - no auth required)
router.get("/search-brands", queueController.searchBrands);

// Get brand counts by status (READ operation - no auth required)
router.get("/brand-counts", queueController.getBrandCounts);

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



// Proxy Management Routes - Admin only
router.use("/proxy", proxyManagementRoutes);

// Scraper Status Route - Public (no auth required)
router.get('/scraper/status', scraperControlController.getScraperStatus);

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


module.exports = router;
