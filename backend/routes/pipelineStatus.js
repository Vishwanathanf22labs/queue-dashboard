const express = require("express");
const router = express.Router();
const {
  getBrandScrapingStatus,
  getAllBrandsScrapingStatus,
  getOverallPipelineStats,
  searchBrandsPipelineStatus,
} = require("../services/pipeline");

router.get("/brand/:brandId", async (req, res) => {
  try {
    const { brandId } = req.params;
    const { date } = req.query;
    
    if (!brandId || isNaN(brandId)) {
      return res.status(400).json({ error: "Valid brand ID is required" });
    }
    
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
    }
    
    const status = await getBrandScrapingStatus(parseInt(brandId), date, req.environment);
    res.json(status);
  } catch (error) {
    console.error("Error getting brand scraping status:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/all", async (req, res) => {
  try {
    console.log(`[PIPELINE DEBUG] Environment: ${req.environment}`);
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || parseInt(req.query.limit) || 10;
    const { date, sortBy, sortOrder, lastId } = req.query;
    
    if (page < 1) {
      return res.status(400).json({ error: "Page must be greater than 0" });
    }
    
    if (perPage < 1 || perPage > 100) {
      return res.status(400).json({ error: "PerPage must be between 1 and 100" });
    }
    
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
    }
    
    const validSortBy = ['normal', 'active_ads'];
    const validSortOrder = ['asc', 'desc'];
    
    if (sortBy && !validSortBy.includes(sortBy)) {
      return res.status(400).json({ error: "Invalid sortBy parameter" });
    }
    
    if (sortOrder && !validSortOrder.includes(sortOrder)) {
      return res.status(400).json({ error: "Invalid sortOrder parameter" });
    }
    
    const clientETag = req.headers['if-none-match'];
    
    const result = await getAllBrandsScrapingStatus(page, perPage, date, sortBy, sortOrder, lastId, req.environment);
    
    if (result.statusCode === 304) {
      return res.status(304).set('ETag', result.etag).end();
    }
    
    if (result.etag) {
      res.set('ETag', result.etag);
      
      if (clientETag === result.etag) {
        return res.status(304).end();
      }
    }
    
    res.json({ data: result });
  } catch (error) {
    console.error("Error getting all brands scraping status:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/all/separate", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { date } = req.query;
    
    if (page < 1) {
      return res.status(400).json({ error: "Page must be greater than 0" });
    }
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: "Limit must be between 1 and 100" });
    }
    
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
    }
    
    const result = await getAllBrandsScrapingStatus(page, limit, date, 'normal', 'desc', null, req.environment);
    res.json(result);
  } catch (error) {
    console.error("Error getting all brands scraping status (separate):", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/overall-stats", async (req, res) => {
  try {
    console.log(`[PIPELINE OVERALL STATS DEBUG] Environment: ${req.environment}`);
    const { date } = req.query;
    
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
    }
    
    const clientETag = req.headers['if-none-match'];
    
    const result = await getOverallPipelineStats(date, req.environment);
    
    if (result.etag) {
      res.set('ETag', result.etag);
      
      if (clientETag === result.etag) {
        return res.status(304).end();
      }
    }
    
    res.json({ data: result });
  } catch (error) {
    console.error("Error getting overall pipeline stats:", error);
    res.status(500).json({ error: error.message });
  }
});

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
    
    const result = await searchBrandsPipelineStatus(query.trim(), date, req.environment);
    
    if (result.success) {
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