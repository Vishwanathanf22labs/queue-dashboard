const ipStatsService = require("../services/ipStatsService");
const logger = require("../utils/logger");

async function getIpStatsList(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "totalAds";
    const sortOrder = req.query.sortOrder || "desc";

    const validSortFields = [
      "totalBrands",
      "totalAds",
      "completed",
      "failed",
      "total",
      "ip",
    ];
    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sortBy parameter. Must be one of: ${validSortFields.join(
          ", "
        )}`,
      });
    }

    if (!["asc", "desc"].includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sortOrder parameter. Must be 'asc' or 'desc'",
      });
    }

    const clientETag = req.headers["if-none-match"];

    const result = await ipStatsService.getIpStatsWithPagination(
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      req.environment
    );

    if (result.etag) {
      res.set("ETag", result.etag);
      if (clientETag === result.etag) {
        return res.status(304).end();
      }
    }

    return res.json({
      success: true,
      message: "IP stats retrieved successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error in getIpStatsList:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function getIpStatsDetail(req, res) {
  try {
    const { ip } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const ipStats = await ipStatsService.getIpStatsByIp(ip, req.environment);

    if (!ipStats) {
      return res.status(404).json({
        success: false,
        message: `IP stats not found for ${ip}`,
      });
    }

    const brandsResult = await ipStatsService.getBrandsByIp(
      ip,
      page,
      limit,
      req.environment
    );

    return res.json({
      success: true,
      message: "IP stats detail retrieved successfully",
      data: {
        ipStats,
        brands: brandsResult,
      },
    });
  } catch (error) {
    logger.error("Error in getIpStatsDetail:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function getIpStatsSummary(req, res) {
  try {
    const summary = await ipStatsService.getIpStatsSummary(req.environment);

    return res.json({
      success: true,
      message: "IP stats summary retrieved successfully",
      data: summary,
    });
  } catch (error) {
    logger.error("Error in getIpStatsSummary:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function deleteIpStats(req, res) {
  try {
    const { ip } = req.params;

    if (!ip) {
      return res.status(400).json({
        success: false,
        message: "IP address is required",
      });
    }

    const result = await ipStatsService.deleteIpStats(ip, req.environment);

    return res.json({
      success: true,
      message: result.message,
      data: {
        deletedKeys: result.deletedKeys,
      },
    });
  } catch (error) {
    logger.error("Error in deleteIpStats:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function getIpBrands(req, res) {
  try {
    const { ip } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    const clientETag = req.headers["if-none-match"];

    const result = await ipStatsService.getBrandsByIp(
      ip,
      page,
      limit,
      search,
      req.environment
    );

    if (result.etag) {
      res.set("ETag", result.etag);
      if (clientETag === result.etag) {
        return res.status(304).end();
      }
    }

    return res.json({
      success: true,
      message: "IP brands retrieved successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error in getIpBrands:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

module.exports = {
  getIpStatsList,
  getIpStatsDetail,
  getIpStatsSummary,
  deleteIpStats,
  getIpBrands,
};
