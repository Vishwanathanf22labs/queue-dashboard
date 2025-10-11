const ScrapedBrandsService = require("../services/scrapedBrandsService");

class ScrapedBrandsController {
  static async getScrapedBrands(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const date = req.query.date || req.query.testDate || null;
      const sortBy = req.query.sortBy || "normal";
      const sortOrder = req.query.sortOrder || "desc";

      if (page < 1) {
        return res.status(400).json({
          success: false,
          error: "Page number must be greater than 0",
        });
      }

      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: "Limit must be between 1 and 100",
        });
      }

      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: "Date must be in YYYY-MM-DD format",
        });
      }

      const result = await ScrapedBrandsService.getScrapedBrands(
        page,
        limit,
        date,
        sortBy,
        sortOrder,
        req.environment
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error("Error in getScrapedBrands controller:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        details: error.message,
      });
    }
  }

  static async searchScrapedBrands(req, res) {
    try {
      const query = req.query.query;
      const date = req.query.date || req.query.testDate || null;

      if (!query || !query.trim()) {
        return res.status(400).json({
          success: false,
          error: "Query parameter is required",
        });
      }

      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: "Date must be in YYYY-MM-DD format",
        });
      }

      const result = await ScrapedBrandsService.searchScrapedBrands(
        query.trim(),
        date,
        req.environment
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error("Error in searchScrapedBrands controller:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        details: error.message,
      });
    }
  }

  static async getScrapedBrandsStats(req, res) {
    try {
      const date = req.query.date || req.query.testDate || null;

      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: "Date must be in YYYY-MM-DD format",
        });
      }

      const result = await ScrapedBrandsService.getScrapedBrandsStats(
        date,
        req.environment
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error("Error in getScrapedBrandsStats controller:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        details: error.message,
      });
    }
  }
}

module.exports = ScrapedBrandsController;
