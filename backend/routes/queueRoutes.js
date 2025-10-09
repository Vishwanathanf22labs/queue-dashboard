const express = require("express");
const queueController = require("../controllers/queueController");
const queueManagementRoutes = require("./queueManagementRoutes");
const queueReenqueueController = require("../controllers/queueReenqueueController");

const proxyManagementRoutes = require("./proxyManagementRoutes");
const scraperControlController = require('../controllers/scraperControlController');
const adminAuth = require("../middleware/adminAuth");
const brandManagementController = require("../controllers/brandManagementController");
const { getCacheRedisClient } = require('../services/utils/cacheUtils');

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
    const { getRedisKeys } = require('../config/constants');
    const logger = require('../utils/logger');
    
    // Use environment from request (set by middleware)
    const environment = req.environment || 'production';
    
    // Get environment-specific Redis keys
    const REDIS_KEYS = getRedisKeys(environment);
    
    // Get current count before clearing
    const currentlyScrapingBrands = await getGlobalRedis(environment).lrange(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING, 0, -1);
    const countBeforeClear = currentlyScrapingBrands ? currentlyScrapingBrands.length : 0;
    
    // Clear the entire currently scraping Redis key
    await getGlobalRedis(environment).del(REDIS_KEYS.GLOBAL.CURRENTLY_PROCESSING);
    
    logger.info(`Admin cleared all currently scraping brands [${environment}]: ${countBeforeClear} brands removed`);
    
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

// Clear Cache Redis (current environment) - Admin only
router.post('/clear-cache-only', adminAuth, async (req, res) => {
  try {
    // Use environment from request (set by middleware)
    const environment = req.environment || 'production';
    
    // Get environment-specific cache Redis client
    const { getCacheRedisClientWithEnvironment } = require('../services/utils/cacheUtils');
    const client = getCacheRedisClientWithEnvironment(environment);
    
    // Get all cache keys (only the ones we want to clear)
    const cacheKeyPatterns = [
      'pipeline:*',
      'queue:*', 
      'watchlist_brands',
      'overall_stats:*'
    ];
    
    let totalDeleted = 0;
    
    // Delete keys by pattern
    for (const pattern of cacheKeyPatterns) {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
        totalDeleted += keys.length;
        console.log(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
    }
    
    // ALSO clear in-memory caches (duplicate the logic to avoid circular dependency)
    try {
      // Clear service-level in-memory caches
      if (global.queueProcessingService && global.queueProcessingService.clearInMemoryCaches) {
        global.queueProcessingService.clearInMemoryCaches();
        console.log('QueueProcessingService in-memory caches cleared');
      }
      
      if (global.adUpdateProcessingService && global.adUpdateProcessingService.clearInMemoryCaches) {
        global.adUpdateProcessingService.clearInMemoryCaches();
        console.log('AdUpdateProcessingService in-memory caches cleared');
      }
      
      // Clear in-memory fallback cache
      if (global.cacheUtils && global.cacheUtils.clearInMemoryFallbackCache) {
        global.cacheUtils.clearInMemoryFallbackCache();
        console.log('In-memory fallback cache cleared');
      }
    } catch (memoryError) {
      console.warn('Error clearing in-memory caches:', memoryError.message);
    }
    
    return res.json({ 
      success: true, 
      message: `Cache Redis and in-memory caches cleared for ${environment} environment - ${totalDeleted} cache keys deleted`,
      deletedCount: totalDeleted,
      environment: environment
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to clear Cache Redis', error: error.message });
  }
});

// Cache invalidation endpoint
router.post('/invalidate-cache', queueController.invalidateQueueCache);

module.exports = router;
