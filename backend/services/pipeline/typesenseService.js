const { Ad } = require("../../models");
const { Op } = require("sequelize");
const { getCacheKey, getCachedData, setCachedData } = require("../utils/cacheUtils");
const { getTypesenseBullQueueData, getTypesenseFailedQueueData } = require("../utils/redisUtils");

/**
 * Check Typesense status for a brand based on ads and Redis Bull queues
 * FIXED: Proper status logic implementation based on requirements
 */
async function getTypesenseStatus(
  brandId,
  targetDate,
  ads = null,
  bullJobData = null,
  failedJobData = null,
  queueType = 'regular'
) {
  try {
    const cacheKey = getCacheKey("typesense", brandId, targetDate);
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    // FIXED: Count ads by typesense_updated_at on target date
    const startDate = new Date(targetDate + "T00:00:00.000Z");
    const endDate = new Date(targetDate + "T23:59:59.999Z");

    // Count total ads processed on target date (typesense_updated_at)
    const totalAdsProcessedToday = await Ad.count({
      where: {
        brand_id: brandId,
        typesense_updated_at: {
          [Op.between]: [startDate, endDate],
        },
      },
    });

    if (totalAdsProcessedToday === 0) {
      const result = {
        status: "NOT_PROCESSED",
        message: "No ads processed on this date",
        completed: false,
        adsWithTypesense: 0,
        totalAds: 0,
        adsInQueue: 0,
        adsFailed: 0,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    // Count ads with typesense_id among those processed today
    const adsWithTypesenseCount = await Ad.count({
      where: {
        brand_id: brandId,
        typesense_updated_at: {
          [Op.between]: [startDate, endDate],
        },
        typesense_id: {
          [Op.ne]: null,
        },
      },
    });

    const adsWithoutTypesenseCount = totalAdsProcessedToday - adsWithTypesenseCount;

    // FIXED: Use counts from typesense_updated_at
    const totalAds = totalAdsProcessedToday; // Total ads processed on target date
    const adsProcessedTodayCount = totalAdsProcessedToday; // All counted ads were processed today

    // FIXED: If all ads processed today have typesense_id, mark as completed
    if (adsWithTypesenseCount === totalAds) {
      const result = {
        status: "COMPLETED",
        message: "All ads indexed in Typesense",
        completed: true,
        adsWithTypesense: adsWithTypesenseCount,
        totalAds: totalAds,
        adsInQueue: 0,
        adsFailed: 0,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    // FIXED: Check Redis queues for ads without typesense_id
    let adsInQueue = 0;
    let adsFailed = 0;

    // Get Redis data if not provided
    if (!bullJobData && !failedJobData) {
      bullJobData = await getTypesenseBullQueueData(queueType);
      failedJobData = await getTypesenseFailedQueueData(queueType);
    }

    if (bullJobData || failedJobData) {
      // Get ads that were processed today but don't have typesense_id
      const adsProcessedTodayWithoutTypesense = await Ad.findAll({
        where: {
          brand_id: brandId,
          typesense_updated_at: {
            [Op.between]: [startDate, endDate],
          },
          typesense_id: null,
        },
        attributes: ['id'],
      });

      const adIdsWithoutTypesense = adsProcessedTodayWithoutTypesense.map((ad) => ad.id);

      for (const adId of adIdsWithoutTypesense) {
        if (failedJobData && failedJobData.has(adId)) {
          adsFailed++;
        } else if (bullJobData && bullJobData.has(adId)) {
          adsInQueue++;
        } else {
          adsFailed++; // Not in queue and not failed = actually failed
        }
      }
    } else {
      // If no Redis data, assume all without typesense_id are failed
      adsFailed = adsWithoutTypesenseCount;
    }

    // FIXED: If some ads processed today don't have typesense_id
    if (adsWithTypesenseCount > 0 && adsWithTypesenseCount < totalAds) {
      let status, message;
      
      if (adsInQueue > 0) {
        status = "PROCESSING";
        message = "Typesense indexing in progress";
      } else {
        status = "FAILED";
        message = "Some ads failed Typesense indexing";
      }

      const result = {
        status: status,
        message: message,
        completed: false,
        adsWithTypesense: adsWithTypesenseCount,
        totalAds: totalAds,
        adsInQueue: adsInQueue,
        adsFailed: adsFailed,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    // FIXED: If no ads processed today have typesense_id
    if (adsWithTypesenseCount === 0) {
      let status, message;
      
      if (adsInQueue > 0) {
        status = "WAITING";
        message = "Ads waiting in Typesense queue";
      } else {
        status = "FAILED";
        message = "No ads indexed in Typesense";
      }

      const result = {
        status: status,
        message: message,
        completed: false,
        adsWithTypesense: 0,
        totalAds: totalAds,
        adsInQueue: adsInQueue,
        adsFailed: adsFailed,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    // This should never be reached due to the conditions above
    const result = {
      status: "NOT_PROCESSED",
      message: "Typesense indexing status unknown",
      completed: false,
      adsWithTypesense: adsWithTypesenseCount,
      totalAds: totalAds,
      adsInQueue: 0,
      adsFailed: adsWithoutTypesenseCount,
    };

    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Error checking Typesense status:", error);
    return {
      status: "ERROR",
      message: "Error checking Typesense status",
      completed: false,
      adsWithTypesense: 0,
      totalAds: 0,
      adsInQueue: 0,
      adsFailed: 0,
    };
  }
}

module.exports = {
  getTypesenseStatus,
};
