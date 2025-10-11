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
  updateProxy,
  updateProxyStatus,
  clearAllProxies,
  getAvailableProxies,
  getLastMonthProxies,
  switchToNextWorkingProxy,
  getSystemHealth,
  markProxyAsFailed,
  markProxyAsWorking,
  getNextWorkingProxy,
  lockProxy,
  unlockProxy
} = require("../controllers/proxyManagementController");

router.get("/list", getProxies);
router.get("/stats", getProxyStats);
router.get("/management-stats", getProxyManagementStats);
router.get("/health", getSystemHealth);
router.get("/available", getAvailableProxies);
router.get("/last-month", getLastMonthProxies);
router.get("/next", getNextProxy);

router.post("/add", adminAuth, addProxy);
router.put("/update/:proxyId", adminAuth, updateProxy);
router.delete("/remove/:proxyId", adminAuth, removeProxy);
router.put("/status/:proxyId", adminAuth, updateProxyStatus);
router.post("/switch/:failedProxyId", adminAuth, switchToNextWorkingProxy);
router.delete("/clear", adminAuth, clearAllProxies);
router.post("/lock", adminAuth, lockProxy);
router.post("/unlock", adminAuth, unlockProxy);

router.post("/scraper/failed/:proxyId", markProxyAsFailed);
router.post("/scraper/working/:proxyId", markProxyAsWorking);
router.get("/scraper/next-working", getNextWorkingProxy);

module.exports = router;

