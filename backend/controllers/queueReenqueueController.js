const queueReenqueueManagementService = require("../services/queueReenqueueManagementService");
const logger = require("../utils/logger");

/**
 * Requeue a single brand
 */
async function requeueSingleBrand(req, res) {
  try {
    const { itemId, namespace } = req.body;

    if (!itemId || !namespace) {
      return res.status(400).json({
        success: false,
        message: "itemId and namespace are required",
      });
    }

    if (namespace !== 'watchlist' && namespace !== 'non-watchlist') {
      return res.status(400).json({
        success: false,
        message: "namespace must be 'watchlist' or 'non-watchlist'",
      });
    }

    const result = await queueReenqueueManagementService.requeueSingleBrand(itemId, namespace);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in requeueSingleBrand:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to requeue brand",
      error: error.message,
    });
  }
}

/**
 * Requeue all brands
 */
async function requeueAllBrands(req, res) {
  try {
    const { namespace } = req.body;

    if (!namespace) {
      return res.status(400).json({
        success: false,
        message: "namespace is required",
      });
    }

    if (namespace !== 'watchlist' && namespace !== 'non-watchlist') {
      return res.status(400).json({
        success: false,
        message: "namespace must be 'watchlist' or 'non-watchlist'",
      });
    }

    const result = await queueReenqueueManagementService.requeueAllBrands(namespace);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in requeueAllBrands:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to requeue all brands",
      error: error.message,
    });
  }
}

/**
 * Delete a single brand
 */
async function deleteSingleBrand(req, res) {
  try {
    const { itemId, namespace } = req.body;

    if (!itemId || !namespace) {
      return res.status(400).json({
        success: false,
        message: "itemId and namespace are required",
      });
    }

    if (namespace !== 'watchlist' && namespace !== 'non-watchlist') {
      return res.status(400).json({
        success: false,
        message: "namespace must be 'watchlist' or 'non-watchlist'",
      });
    }

    const result = await queueReenqueueManagementService.deleteSingleBrand(itemId, namespace);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in deleteSingleBrand:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete brand",
      error: error.message,
    });
  }
}

/**
 * Delete all brands
 */
async function deleteAllBrands(req, res) {
  try {
    const { namespace } = req.body;

    if (!namespace) {
      return res.status(400).json({
        success: false,
        message: "namespace is required",
      });
    }

    if (namespace !== 'watchlist' && namespace !== 'non-watchlist') {
      return res.status(400).json({
        success: false,
        message: "namespace must be 'watchlist' or 'non-watchlist'",
      });
    }

    const result = await queueReenqueueManagementService.deleteAllBrands(namespace);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in deleteAllBrands:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete all brands",
      error: error.message,
    });
  }
}

module.exports = {
  requeueSingleBrand,
  requeueAllBrands,
  deleteSingleBrand,
  deleteAllBrands,
};
