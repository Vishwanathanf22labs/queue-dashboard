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
router.get("/currently-processing", queueController.getCurrentlyProcessing);
router.get("/next-brand", queueController.getNextBrand);
router.get("/stats", queueController.getQueueStats);

router.get("/brand-processing", queueController.getBrandProcessingQueue);
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

// Scraper Control Routes - Admin only
router.post('/scraper/start', adminAuth, scraperControlController.startScraper);
router.post('/scraper/stop', adminAuth, scraperControlController.stopScraper);
router.post('/scraper/pause', adminAuth, scraperControlController.pauseScraper);
router.post('/scraper/resume', adminAuth, scraperControlController.resumeScraper);
router.get('/scraper/status', adminAuth, scraperControlController.getScraperStatus);


module.exports = router;
