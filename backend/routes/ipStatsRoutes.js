const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const {
  getIpStatsList,
  getIpStatsDetail,
  getIpStatsSummary,
  deleteIpStats,
  getIpBrands,
} = require("../controllers/ipStatsController");
const { invalidateIpStatsCache } = require("../services/utils/cacheUtils");
const logger = require("../utils/logger");

router.get("/list", getIpStatsList);
router.get("/summary", getIpStatsSummary);
router.get("/:ip", getIpStatsDetail);
router.get("/:ip/brands", getIpBrands);

router.post("/invalidate-cache", async (req, res) => {
  try {
    logger.info("IP Stats cache invalidation request received");

    const totalDeleted = await invalidateIpStatsCache();

    logger.info(`IP Stats cache cleared - ${totalDeleted} keys deleted`);

    return res.json({
      success: true,
      message: `IP Stats cache cleared successfully - ${totalDeleted} keys deleted`,
      keysDeleted: totalDeleted,
    });
  } catch (error) {
    logger.error("Error clearing IP Stats cache:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear IP Stats cache",
      error: error.message,
    });
  }
});

router.delete("/:ip", adminAuth, deleteIpStats);

module.exports = router;
