const redis = require("../config/redis");
const Brand = require("../models/Brand");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

async function getQueueOverview() {
  try {
    const pendingCount = await redis.zcard(QUEUES.PENDING_BRANDS);

    // Use same Redis approach as pending count for consistency
    const failedCount = await redis.llen(QUEUES.FAILED_BRANDS);

    let activeBrandsCount = 0;
    try {
      const activeBrands = await Brand.count({
        where: { status: "Active" },
      });
      activeBrandsCount = activeBrands;
    } catch (dbError) {
      logger.error("Error counting active brands from database:", dbError);
      activeBrandsCount = 0;
    }

    // Get today's stats from Redis
    let todayStats = null;
    try {
      const today = new Date().toISOString().split("T")[0];
      const statsKey = `stats:${today}`;
      const allStats = await redis.hgetall(statsKey);
      
      if (allStats && Object.keys(allStats).length > 0) {
        todayStats = {
          brands_scraped: parseInt(allStats.brands_scrapped || 0),
          brands_processed: parseInt(allStats.brands_processed || 0),
          brands_scrapped_failed: parseInt(allStats.brands_scrapped_failed || 0),
          ads_processed: parseInt(allStats.ads_processed || 0),
          total_brands: parseInt(allStats.brands_scrapped || 0) + parseInt(allStats.brands_scrapped_failed || 0),
          success_rate: allStats.brands_scrapped && allStats.brands_scrapped_failed 
            ? Math.round((parseInt(allStats.brands_scrapped) / (parseInt(allStats.brands_scrapped) + parseInt(allStats.brands_scrapped_failed))) * 100)
            : 0
        };
      }
    } catch (statsError) {
      logger.error("Error getting today's stats:", statsError);
      todayStats = null;
    }

    const currentlyProcessing = await getCurrentlyProcessing();

    return {
      queue_counts: {
        pending: pendingCount,
        failed: failedCount,
        total: pendingCount + failedCount,
        active: activeBrandsCount,
      },
      currently_processing: currentlyProcessing,
      today_stats: todayStats,
      last_updated: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error in getQueueOverview:", error);
    throw error;
  }
}

async function getCurrentlyProcessing() {
  try {
    // Get the currently processing brand from Redis key
    const currentlyProcessingBrand = await redis.lindex('currently_processing_brand', 0);
    
    if (!currentlyProcessingBrand) {
      return null;
    }

    try {
      const processingData = JSON.parse(currentlyProcessingBrand);
      
      // Get brand details from database
      const brand = await Brand.findOne({
        where: { id: parseInt(processingData.brandId) },
        attributes: ["actual_name", "page_id", "status"],
        raw: true,
      });

      if (!brand) {
        logger.warn(`Brand with ID ${processingData.brandId} not found in database`);
        return null;
      }

      // Parse proxy information if available
      let proxyInfo = null;
      if (processingData.proxy) {
        try {
          proxyInfo = JSON.parse(processingData.proxy);
        } catch (proxyParseError) {
          logger.warn(`Failed to parse proxy data: ${proxyParseError.message}`);
        }
      }

      const result = {
        brand_id: parseInt(processingData.brandId),
        job_id: `processing-${processingData.brandId}`,
        brand_name: brand.actual_name || "Unknown",
        page_id: processingData.pageId || brand.page_id || "Unknown",
        status: processingData.status || brand.status || "Unknown",
        started_at: processingData.startAt || new Date().toISOString(),
        processing_duration: processingData.duration || 0,
        queue_position: 1,
        is_processing: true,
        processing_status: processingData.status || "processing",
        note: "Currently processing brand",
        // Additional fields from Redis
        total_ads: processingData.totalAds || 0,
        proxy: proxyInfo,
        raw_proxy: processingData.proxy
      };

      return result;
    } catch (parseError) {
      logger.error("Error parsing currently processing brand data:", parseError);
      return null;
    }
  } catch (error) {
    logger.error("Error in getCurrentlyProcessing:", error);
    return null;
  }
}

async function getQueueStatistics() {
  try {
    const pendingCount = await redis.zcard(QUEUES.PENDING_BRANDS);

    const failedCount = await redis.llen(QUEUES.FAILED_BRANDS);

    const activeBrandsCount = await Brand.count({
      where: { status: "Active" },
    });

    const totalBrandsCount = await Brand.count();

    return {
      queue_stats: {
        pending_count: pendingCount,
        failed_count: failedCount,
        total_queued: pendingCount + failedCount,
      },
      brand_stats: {
        total_brands: totalBrandsCount,
        active_brands: activeBrandsCount,
      },
    };
  } catch (error) {
    logger.error("Error in getQueueStatistics:", error);
    throw error;
  }
}

module.exports = {
  getQueueOverview,
  getCurrentlyProcessing,
  getQueueStatistics,
};
