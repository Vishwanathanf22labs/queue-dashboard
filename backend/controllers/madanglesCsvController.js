const axios = require("axios");
const FormData = require("form-data");
const logger = require("../utils/logger");
const Brand = require("../models/Brand");
const { Op } = require("sequelize");

async function uploadCsvToMadangles(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
        timestamp: new Date().toISOString(),
      });
    }

    if (
      !req.file.mimetype.includes("csv") &&
      !req.file.originalname.endsWith(".csv")
    ) {
      return res.status(400).json({
        success: false,
        message: "Only CSV files are allowed",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Uploading CSV to madangles-scraper: ${req.file.originalname}`);

    const formData = new FormData();
    formData.append("csvFile", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype || "text/csv",
    });

    const { getScraperUrl } = require("../config/environmentConfig");
    const madanglesUrl = getScraperUrl();
    const endpoint = `${madanglesUrl}/facebook/brands/`;

    logger.info(`Forwarding CSV to: ${endpoint}`);

    const response = await axios.post(endpoint, formData, {
      headers: formData.getHeaders(),
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024,
    });

    logger.info(`Madangles-scraper response status: ${response.status}`);

    res.status(response.status).json({
      success: true,
      message: "CSV uploaded successfully to madangles-scraper",
      data: {
        madanglesResponse: response.data,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString(),
        madanglesEndpoint: endpoint,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error uploading CSV to madangles-scraper:", error);

    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        message: "Madangles-scraper service is not available",
        error: "Connection refused to madangles-scraper",
        timestamp: new Date().toISOString(),
      });
    }

    if (error.code === "ETIMEDOUT") {
      return res.status(504).json({
        success: false,
        message: "Request to madangles-scraper timed out",
        error: "Timeout waiting for madangles-scraper response",
        timestamp: new Date().toISOString(),
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: "Madangles-scraper returned an error",
        error: error.response.data || error.message,
        madanglesStatus: error.response.status,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to upload CSV to madangles-scraper",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

async function checkScrapingStatus(req, res) {
  try {
    const { pageIds } = req.body;

    if (!pageIds || !Array.isArray(pageIds) || pageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "pageIds array is required",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Checking scraping status for ${pageIds.length} page_ids`);

    const existingBrands = await Brand.findAll({
      where: { page_id: { [Op.in]: pageIds } },
      attributes: ["id", "name", "page_id", "logo_url", "created_at"],
      raw: true,
    });

    const foundPageIds = existingBrands.map((brand) => brand.page_id);
    const missingPageIds = pageIds.filter(
      (pageId) => !foundPageIds.includes(pageId)
    );

    const completionStatus = {
      completed: existingBrands.length === pageIds.length,
      totalExpected: pageIds.length,
      totalFound: existingBrands.length,
      scrapedBrands: existingBrands,
      missingPageIds: missingPageIds,
      progress:
        pageIds.length > 0 ? (existingBrands.length / pageIds.length) * 100 : 0,
    };

    logger.info(
      `Scraping status: ${existingBrands.length}/${pageIds.length} brands found`
    );

    res.json({
      success: true,
      data: completionStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error checking scraping status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check scraping status",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

async function addScrapedBrandsToQueue(req, res) {
  try {
    const { pageIds, queueType = "regular" } = req.body;

    if (!pageIds || !Array.isArray(pageIds) || pageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "pageIds array is required",
        timestamp: new Date().toISOString(),
      });
    }

    if (!["regular", "watchlist"].includes(queueType)) {
      return res.status(400).json({
        success: false,
        message: "queueType must be 'regular' or 'watchlist'",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Adding ${pageIds.length} brands to ${queueType} queue`);

    const brands = await Brand.findAll({
      where: { page_id: { [Op.in]: pageIds } },
      attributes: ["id", "page_id"],
      raw: true,
    });

    if (brands.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No brands found in database for the provided page_ids",
        timestamp: new Date().toISOString(),
      });
    }

    const queueService = require("../services/queueService");

    const brandsData = brands.map((brand) => ({
      id: brand.id,
      page_id: brand.page_id,
      score: 3,
    }));

    const result = await queueService.addBulkBrandsToQueue(
      brandsData,
      queueType
    );

    logger.info(
      `Successfully added ${result.results.success_count} brands to ${queueType} queue`
    );

    res.json({
      success: true,
      message: `Successfully added ${result.results.success_count} brands to ${queueType} pending queue`,
      data: {
        queueType: queueType,
        totalProcessed: brandsData.length,
        successCount: result.results.success_count,
        failedCount: result.results.failed_count,
        skippedCount: result.results.skipped_count,
        details: result.results.details,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error adding scraped brands to queue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add brands to queue",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  uploadCsvToMadangles,
  checkScrapingStatus,
  addScrapedBrandsToQueue,
};
