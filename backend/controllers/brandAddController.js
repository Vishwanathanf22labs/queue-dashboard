const queueService = require("../services/queueService");
const logger = require("../utils/logger");

async function addSingleBrand(req, res) {
  try {
    const { id, page_id, score } = req.body;

    if (!id || !page_id) {
      return res.status(400).json({
        success: false,
        message: "Both id and page_id are required",
        example: {
          id: 5325,
          page_id: "114512100010596",
          score: 1
        },
      });
    }

    // Validate score (optional, defaults to 0)
    const validScore = score !== undefined && score !== null ? parseFloat(score) : 0;
    
    if (isNaN(validScore)) {
      return res.status(400).json({
        success: false,
        message: "Score must be a valid number"
      });
    }

    const result = await queueService.addSingleBrandToQueue({ id, page_id, score: validScore });

    res.status(201).json({
      success: true,
      message: result.message,
      data: result.brand,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in addSingleBrand:", error);
    res.status(400).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

async function addAllBrands(req, res) {
  try {
    const { status } = req.query; // Get status filter from query params
    
    // Validate status filter if provided
    if (status && !['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter. Must be 'Active' or 'Inactive'"
      });
    }

    const result = await queueService.addAllBrandsToQueue(status);
    
    res.json({
      success: true,
      message: result.message,
      data: result.results
    });
  } catch (error) {
    logger.error("Error in addAllBrands:", error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add all brands'
    });
  }
}

async function getBrandCounts(req, res) {
  try {
    const result = await queueService.getBrandCountsByStatus();
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error("Error in getBrandCounts:", error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get brand counts'
    });
  }
}

module.exports = {
  addSingleBrand,
  addAllBrands,
  getBrandCounts
};
