const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');

/**
 * Upload CSV file to madangles-scraper endpoint
 * Forwards the CSV file to the existing madangles-scraper service
 */
async function uploadCsvToMadangles(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
        timestamp: new Date().toISOString(),
      });
    }

    // Validate CSV file
    if (!req.file.mimetype.includes('csv') && !req.file.originalname.endsWith('.csv')) {
      return res.status(400).json({
        success: false,
        message: "Only CSV files are allowed",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Uploading CSV to madangles-scraper: ${req.file.originalname}`);

    // Create FormData to forward to madangles-scraper
    const formData = new FormData();
    formData.append("csvFile", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype || "text/csv",
    });

    // Get madangles-scraper URL from environment or use default
    const madanglesUrl = process.env.MADANGLES_SCRAPER_URL;
    const endpoint = `${madanglesUrl}/facebook/brands/`;

    logger.info(`Forwarding CSV to: ${endpoint}`);

    // Forward the CSV file to madangles-scraper
    const response = await axios.post(endpoint, formData, {
      headers: formData.getHeaders(), // Use only formData headers, don't override Content-Type
      timeout: 30000, // 30 second timeout
      maxContentLength: 50 * 1024 * 1024, // 50MB max
    });

    logger.info(`Madangles-scraper response status: ${response.status}`);

    // Return the response from madangles-scraper
    res.status(response.status).json({
      success: true,
      message: "CSV uploaded successfully to madangles-scraper",
      data: {
        madanglesResponse: response.data,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString(),
        madanglesEndpoint: endpoint
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error("Error uploading CSV to madangles-scraper:", error);

    // Handle different types of errors
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: "Madangles-scraper service is not available",
        error: "Connection refused to madangles-scraper",
        timestamp: new Date().toISOString(),
      });
    }

    if (error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        success: false,
        message: "Request to madangles-scraper timed out",
        error: "Timeout waiting for madangles-scraper response",
        timestamp: new Date().toISOString(),
      });
    }

    if (error.response) {
      // Madangles-scraper returned an error response
      return res.status(error.response.status).json({
        success: false,
        message: "Madangles-scraper returned an error",
        error: error.response.data || error.message,
        madanglesStatus: error.response.status,
        timestamp: new Date().toISOString(),
      });
    }

    // Generic error
    return res.status(500).json({
      success: false,
      message: "Failed to upload CSV to madangles-scraper",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  uploadCsvToMadangles,
};
