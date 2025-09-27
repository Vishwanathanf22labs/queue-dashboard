const express = require("express");
const router = express.Router();
const {
  getBrandScrapingStatus,
  getAllBrandsScrapingStatus,
  getAllBrandsScrapingStatusSeparate,
  searchBrandsPipelineStatus,
} = require("../services/pipeline");

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

// Get scraping status for all brands - OPTIMIZED VERSION
router.get("/all", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || parseInt(req.query.limit) || 10;
    const { date, sortBy, sortOrder, lastId } = req.query;
    
    
    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({ error: "Page must be greater than 0" });
    }
    
    if (perPage < 1 || perPage > 100) {
      return res.status(400).json({ error: "PerPage must be between 1 and 100" });
    }
    
    // Validate date format if provided
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
    }
    
    // Validate sorting parameters
    const validSortBy = ['normal', 'active_ads'];
    const validSortOrder = ['asc', 'desc'];
    
    if (sortBy && !validSortBy.includes(sortBy)) {
      return res.status(400).json({ error: "Invalid sortBy parameter" });
    }
    
    if (sortOrder && !validSortOrder.includes(sortOrder)) {
      return res.status(400).json({ error: "Invalid sortOrder parameter" });
    }
    
    // Check for ETag support
    const clientETag = req.headers['if-none-match'];
    
    const result = await getAllBrandsScrapingStatus(page, perPage, date, sortBy, sortOrder, lastId);
    
    // Handle ETag response
    if (result.statusCode === 304) {
      return res.status(304).set('ETag', result.etag).end();
    }
    
    // Set ETag header if available
    if (result.etag) {
      res.set('ETag', result.etag);
      
      // Check if client has same ETag
      if (clientETag === result.etag) {
        return res.status(304).end();
      }
    }
    
    // Wrap result in data object to match frontend expectations
    res.json({ data: result });
  } catch (error) {
    console.error("Error getting all brands scraping status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get scraping status for all brands (watchlist and regular separately)
router.get("/all/separate", async (req, res) => {
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
    
    const result = await getAllBrandsScrapingStatusSeparate(page, limit, date);
    res.json(result);
  } catch (error) {
    console.error("Error getting all brands scraping status (separate):", error);
    res.status(500).json({ error: error.message });
  }
});

// Search pipeline status across all brands - OPTIMIZED VERSION
router.get("/search", async (req, res) => {
  try {
    const query = req.query.query;
    const { date } = req.query;
    
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: 'Query parameter is required' });
    }
    
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Date must be in YYYY-MM-DD format' });
    }
    
    const result = await searchBrandsPipelineStatus(query.trim(), date);
    
    if (result.success) {
      // Return the result directly as it already has the correct structure
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in searchBrandsPipelineStatus controller:', error);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
});

module.exports = router;