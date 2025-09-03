const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const {
  addProxy,
  removeProxy,
  getProxies,
  getProxyStats,
  getProxyManagementStats,
  getNextProxy,
  updateProxyStatus,
  clearAllProxies,
  getAvailableProxies,
  getLastMonthProxies,
  switchToNextWorkingProxy,
  getSystemHealth,
  markProxyAsFailed,
  markProxyAsWorking,
  getNextWorkingProxy
} = require("../controllers/proxyManagementController");

// Public routes (no authentication required)
router.get("/list", getProxies);
router.get("/stats", getProxyStats);
router.get("/management-stats", getProxyManagementStats);
router.get("/health", getSystemHealth);
router.get("/available", getAvailableProxies);
router.get("/last-month", getLastMonthProxies);
router.get("/next", getNextProxy);

// Admin routes (require authentication)
router.post("/add", adminAuth, addProxy);
router.delete("/remove/:proxyId", adminAuth, removeProxy);
router.put("/status/:proxyId", adminAuth, updateProxyStatus);
router.post("/switch/:failedProxyId", adminAuth, switchToNextWorkingProxy);
router.delete("/clear", adminAuth, clearAllProxies);

// NEW: Scraper routes (no auth needed - scraper calls these)
router.post("/scraper/failed/:proxyId", markProxyAsFailed);        // ← Scraper marks proxy as failed
router.post("/scraper/working/:proxyId", markProxyAsWorking);      // ← Scraper marks proxy as working
router.get("/scraper/next-working", getNextWorkingProxy);          // ← Scraper gets next working proxy

module.exports = router;

