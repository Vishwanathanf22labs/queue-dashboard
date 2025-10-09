const ScrapedBrandsService = require('../services/scrapedBrandsService');

class ScrapedBrandsController {
  /**
   * Get paginated scraped brands for current date
   * GET /api/scraped-brands?page=1&limit=10
   */
  static async getScrapedBrands(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const date = req.query.date || req.query.testDate || null; // Accept date from query parameter
      const sortBy = req.query.sortBy || 'normal'; // Add sorting parameter
      const sortOrder = req.query.sortOrder || 'desc'; // Add sort order parameter

      // Validate pagination parameters
      if (page < 1) {
        return res.status(400).json({
          success: false,
          error: 'Page number must be greater than 0'
        });
      }

      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: 'Limit must be between 1 and 100'
        });
      }

      // Validate date format if provided
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: 'Date must be in YYYY-MM-DD format'
        });
      }

      const result = await ScrapedBrandsService.getScrapedBrands(page, limit, date, sortBy, sortOrder, req.environment);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Error in getScrapedBrands controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Search scraped brands across all pages
   * GET /api/scraped-brands/search?query=searchterm&date=2025-08-11
   */
  static async searchScrapedBrands(req, res) {
    try {
      const query = req.query.query;
      const date = req.query.date || req.query.testDate || null;

      // Validate required query parameter
      if (!query || !query.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter is required'
        });
      }

      // Validate date format if provided
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: 'Date must be in YYYY-MM-DD format'
        });
      }

      const result = await ScrapedBrandsService.searchScrapedBrands(query.trim(), date, req.environment);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Error in searchScrapedBrands controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get scraped brands statistics for current date
   * GET /api/scraped-brands/stats
   */
  static async getScrapedBrandsStats(req, res) {
    try {
      const date = req.query.date || req.query.testDate || null; // Accept date from query parameter
      
      // Validate date format if provided
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: 'Date must be in YYYY-MM-DD format'
        });
      }

      const result = await ScrapedBrandsService.getScrapedBrandsStats(date, req.environment);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Error in getScrapedBrandsStats controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }
}

module.exports = ScrapedBrandsController;
