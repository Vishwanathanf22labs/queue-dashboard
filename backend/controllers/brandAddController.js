const queueService = require("../services/queueService");
const logger = require("../utils/logger");

async function addSingleBrand(req, res) {
  try {
    const { id, page_id } = req.body;

    if (!id || !page_id) {
      return res.status(400).json({
        success: false,
        message: "Both id and page_id are required",
        example: {
          id: 5325,
          page_id: "114512100010596",
        },
      });
    }

    const result = await queueService.addSingleBrandToQueue({ id, page_id });

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
    const result = await queueService.addAllBrandsToQueue();

    res.status(201).json({
      success: true,
      message: result.message,
      data: result.results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in addAllBrands:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  addSingleBrand,
  addAllBrands
};
