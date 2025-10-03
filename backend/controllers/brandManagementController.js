const brandService = require("../services/brandManagementService");
const logger = require("../utils/logger");

async function getBrandStatus(req, res) {
  try {
    const { brand_id, page_id } = req.query;

    if ((!brand_id && !page_id) || (brand_id && page_id)) {
      return res.status(400).json({
        success: false,
        message: "Provide exactly one of: brand_id or page_id",
      });
    }

    const result = await brandService.getBrandByIdentifier({ brand_id, page_id });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in getBrandStatus:", error);
    const status = error.message && /not found/i.test(error.message) ? 404 : 400;
    return res.status(status).json({ success: false, message: error.message });
  }
}

async function updateBrandStatus(req, res) {
  try {
    const { brand_id, page_id, status } = req.body;

    if ((!brand_id && !page_id) || (brand_id && page_id)) {
      return res.status(400).json({
        success: false,
        message: "Provide exactly one of: brand_id or page_id",
      });
    }

    const result = await brandService.updateBrandStatus({ brand_id, page_id }, status);

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in updateBrandStatus:", error);
    let statusCode = 400;
    if (error.message && /not found/i.test(error.message)) statusCode = 404;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
}

async function bulkPreviewBrands(req, res) {
  try {
    const { ids, page_ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ids array is required and must not be empty",
      });
    }

    const result = await brandService.bulkPreviewBrands(ids, page_ids || []);

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in bulkPreviewBrands:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function bulkApplyStatusUpdates(req, res) {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "updates array is required and must not be empty",
      });
    }

    const result = await brandService.bulkApplyStatusUpdates(updates);

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in bulkApplyStatusUpdates:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { getBrandStatus, updateBrandStatus, bulkPreviewBrands, bulkApplyStatusUpdates };



