const queueService = require("../services/queueService");
const logger = require("../utils/logger");
const multer = require("multer");

// Configure multer for CSV file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"), false);
    }
  },
});

async function addBulkBrandsFromCSV(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
        timestamp: new Date().toISOString(),
      });
    }

    // Parse CSV content
    const csvContent = req.file.buffer.toString("utf-8");
    const lines = csvContent.split("\n").filter((line) => line.trim());

    // Skip header if it exists
    const dataLines = lines[0].includes("brand_id") ? lines.slice(1) : lines;

    const brands = [];
    const errors = [];

    dataLines.forEach((line, index) => {
      const [brand_id, page_id] = line.split(",").map((item) => item.trim());

      if (brand_id && page_id) {
        brands.push({
          id: parseInt(brand_id),
          page_id: page_id,
        });
      } else {
        errors.push(`Line ${index + 2}: Invalid format`);
      }
    });

    if (brands.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid brands found in CSV",
        timestamp: new Date().toISOString(),
      });
    }

    // Add brands to queue
    const result = await queueService.addBulkBrandsToQueue(brands);

    // Analyze results to count different types of outcomes
    let totalAdded = 0;
    let totalErrors = 0;
    let duplicates = 0;

    if (result && result.results && result.results.details) {
      // New result format with detailed breakdown
      const details = result.results.details;
      totalAdded = details.success ? details.success.length : 0;
      totalErrors = details.failed ? details.failed.length : 0;
      duplicates = details.skipped ? details.skipped.length : 0;
    } else if (result && result.results && Array.isArray(result.results)) {
      // Fallback for array format
      result.results.forEach((item) => {
        if (item.success) {
          totalAdded++;
        } else if (
          item.message &&
          item.message.toLowerCase().includes("already in queue")
        ) {
          duplicates++;
        } else {
          totalErrors++;
        }
      });
    } else if (
      result &&
      result.results &&
      result.results.success_count !== undefined
    ) {
      // Fallback for older result format
      totalAdded = result.results.success_count || 0;
      totalErrors = result.results.failed_count || 0;
      duplicates = result.results.skipped_count || 0;
    }

    // Build appropriate message based on results
    let message = "";
    if (totalAdded > 0) {
      message = `${totalAdded} brands added to pending queue`;
      if (duplicates > 0) {
        message += `, ${duplicates} already in queue`;
      }
      if (totalErrors > 0) {
        message += `, ${totalErrors} failed`;
      }
    } else if (duplicates > 0) {
      message = `All brands already in queue (${duplicates} found)`;
    } else if (totalErrors > 0) {
      message = `No brands added: ${totalErrors} failed`;
    } else {
      message = "No brands added to queue";
    }

    res.status(201).json({
      success: true,
      message: message,
      data: {
        summary: {
          totalAdded: totalAdded,
          totalErrors: totalErrors,
          csvErrors: errors.length,
          duplicates: duplicates,
          fileName: req.file.originalname,
          uploadedAt: new Date().toISOString(),
        },
        results: result.results || result,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in addBulkBrandsFromCSV:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  addBulkBrandsFromCSV,
  upload,
};
