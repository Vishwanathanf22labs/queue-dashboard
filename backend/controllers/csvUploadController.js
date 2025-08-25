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

    // Debug logging to see the actual result structure
    logger.info('CSV Upload Result Structure:', JSON.stringify(result, null, 2));
    logger.info('Result.results keys:', Object.keys(result.results || {}));
    logger.info('Success count:', result.results?.success_count);
    logger.info('Failed count:', result.results?.failed_count);
    logger.info('Skipped count:', result.results?.skipped_count);

    // Analyze results to count different types of outcomes
    let totalAdded = 0;
    let totalErrors = 0;
    let duplicates = 0;

    // Check the actual result structure and count properly
    if (result && result.results) {
      if (result.results.success_count !== undefined) {
        // Direct count properties - this is what the service actually returns
        totalAdded = result.results.success_count || 0;
        totalErrors = result.results.failed_count || 0;
        duplicates = result.results.skipped_count || 0;
        logger.info(`Using direct counts: added=${totalAdded}, failed=${totalErrors}, skipped=${duplicates}`);
      } else if (result.results.details) {
        // Detailed breakdown
        const details = result.results.details;
        totalAdded = details.success ? details.success.length : 0;
        totalErrors = details.failed ? details.failed.length : 0;
        duplicates = details.skipped ? details.skipped.length : 0;
        logger.info(`Using details counts: added=${totalAdded}, failed=${totalErrors}, skipped=${duplicates}`);
      } else if (Array.isArray(result.results)) {
        // Array format
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
        logger.info(`Using array counts: added=${totalAdded}, failed=${totalErrors}, skipped=${duplicates}`);
      }
    }

    // Fallback: if no counts were found, try to get them from the details
    if (totalAdded === 0 && result && result.results && result.results.details) {
      const details = result.results.details;
      totalAdded = details.success ? details.success.length : 0;
      totalErrors = details.failed ? details.failed.length : 0;
      duplicates = details.skipped ? details.skipped.length : 0;
      logger.info(`Fallback using details: added=${totalAdded}, failed=${totalErrors}, skipped=${duplicates}`);
    }

    logger.info(`Final counts: totalAdded=${totalAdded}, totalErrors=${totalErrors}, duplicates=${duplicates}`);

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
