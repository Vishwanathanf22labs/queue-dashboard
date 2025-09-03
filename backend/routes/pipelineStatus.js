const express = require("express");
const router = express.Router();
const {
  getBrandScrapingStatus,
  getAllBrandsScrapingStatus,
} = require("../services/pipelineStatusService");

// Get scraping status for a specific brand
router.get("/brand/:brandId", async (req, res) => {
  try {
    const { brandId } = req.params;
    const { date } = req.query;
    
    // Validate brandId
    if (!brandId || isNaN(brandId)) {
      return res.status(400).json({ error: "Valid brand ID is required" });
    }
    
    // Validate date format if provided
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
    }
    
    const status = await getBrandScrapingStatus(parseInt(brandId), date);
    res.json(status);
  } catch (error) {
    console.error("Error getting brand scraping status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get scraping status for all brands
router.get("/all", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { date } = req.query;
    
    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({ error: "Page must be greater than 0" });
    }
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: "Limit must be between 1 and 100" });
    }
    
    // Validate date format if provided
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
    }
    
    const result = await getAllBrandsScrapingStatus(page, limit, date);
    res.json(result);
  } catch (error) {
    console.error("Error getting all brands scraping status:", error);
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;