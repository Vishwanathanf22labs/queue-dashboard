const redis = require("../config/redis");
const Brand = require("../models/Brand");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

async function getQueueOverview() {
  try {
    const pendingCount = await redis.llen(QUEUES.PENDING_BRANDS);

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
    // Get scraper status - use the correct Redis key that exists
    const scraperStatus = await redis.get('scraper:status');
    
    // If scraper is not running, return null (no brand currently processing)
    if (scraperStatus !== 'running') {
      return null;
    }
    
    // First Priority: Check pending_brands queue
    const pendingLength = await redis.llen(QUEUES.PENDING_BRANDS);
    
    if (pendingLength > 0) {
      // Get first item from pending queue
      const firstItem = await redis.lindex(QUEUES.PENDING_BRANDS, 0);
      
      if (!firstItem) {
        return null;
      }

      const brandData = JSON.parse(firstItem);
      const { id: brandId } = brandData;

      const brand = await Brand.findOne({
        where: { id: parseInt(brandId) },
        attributes: ["actual_name", "page_id", "status"],
        raw: true,
      });

      if (!brand) {
        return null;
      }

      // Check if this brand already has a started_at timestamp
      let startedAt = brandData.started_at;
      
      // Only set started_at if it doesn't exist (first time this brand becomes next in queue)
      if (!startedAt) {
        const currentTime = new Date().toISOString();
        startedAt = currentTime;
        
        // Update the timestamp in Redis only once when brand first becomes next in queue
        await redis.lset(
          QUEUES.PENDING_BRANDS,
          0,
          JSON.stringify({ ...brandData, started_at: currentTime })
        );
      }

      const result = {
        brand_id: parseInt(brandId),
        job_id: `pending-${brandId}`,
        brand_name: brand.actual_name || "Unknown",
        page_id: brand.page_id || "Unknown",
        status: brand.status || "Unknown",
        started_at: startedAt, // Use existing timestamp or newly created one
        processing_duration: 0,
        queue_position: 1,
        is_processing: true, // Always true when scraper is running
        processing_status: "pending_queue",
        note: "Next brand to be processed from pending queue"
      };

      return result;
    }

    // Second Priority: Check failed_brands queue if pending is empty
    const failedLength = await redis.llen(QUEUES.FAILED_BRANDS);
    
    if (failedLength > 0) {
      // Get first item from failed queue
      const firstFailedItem = await redis.lindex(QUEUES.FAILED_BRANDS, 0);
      
      if (firstFailedItem) {
        const brandData = JSON.parse(firstFailedItem);
        const { id: brandId } = brandData;

        const brand = await Brand.findOne({
          where: { id: parseInt(brandId) },
          attributes: ["actual_name", "page_id", "status"],
          raw: true,
        });

        if (brand) {
          // Check if this brand already has a started_at timestamp
          let startedAt = brandData.started_at;
          
          // Only set started_at if it doesn't exist (first time this brand becomes next in queue)
          if (!startedAt) {
            const currentTime = new Date().toISOString();
            startedAt = currentTime;
            
            // Update the timestamp in Redis only once when brand first becomes next in queue
            await redis.lset(
              QUEUES.FAILED_BRANDS,
              0,
              JSON.stringify({ ...brandData, started_at: currentTime })
            );
          }
          
          return {
            brand_id: parseInt(brandId),
            job_id: `failed-retry-${brandId}`,
            brand_name: brand.actual_name || "Unknown",
            page_id: brand.page_id || "Unknown",
            status: brand.status || "Unknown",
            started_at: startedAt, // Use existing timestamp or newly created one
            processing_duration: 0,
            queue_position: 1,
            is_processing: true, // Always true when scraper is running
            processing_status: "failed_retry",
            note: "Next brand to be retried from failed queue"
          };
        }
      }
    }

    // No brands in either queue
    return null;
  } catch (error) {
    logger.error("Error in getCurrentlyProcessing:", error);
    return null;
  }
}

async function getQueueStatistics() {
  try {
    const pendingCount = await redis.llen(QUEUES.PENDING_BRANDS);

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
