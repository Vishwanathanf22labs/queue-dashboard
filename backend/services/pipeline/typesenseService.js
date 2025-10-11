const { Ad } = require("../../models");
const { Op } = require("sequelize");
const { getCacheKey, getCachedData, setCachedData } = require("../utils/cacheUtils");
const { getTypesenseBullQueueData, getTypesenseFailedQueueData } = require("../utils/redisUtils");


async function getTypesenseStatus(
  brandId,
  targetDate,
  ads = null,
  bullJobData = null,
  failedJobData = null,
  queueType = 'regular',
  environment = 'production'
) {
  try {
    const cacheKey = getCacheKey("typesense", brandId, targetDate);
    const cached = await getCachedData(cacheKey, environment);
    if (cached) return cached;

    const startDate = new Date(targetDate + "T00:00:00.000Z");
    const endDate = new Date(targetDate + "T23:59:59.999Z");

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
      await setCachedData(cacheKey, result, 300, environment);
      return result;
    }

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

    const totalAds = totalAdsProcessedToday; 
    const adsProcessedTodayCount = totalAdsProcessedToday; 

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
      await setCachedData(cacheKey, result, 300, environment);
      return result;
    }

    let adsInQueue = 0;
    let adsFailed = 0;

    if (!bullJobData && !failedJobData) {
      bullJobData = await getTypesenseBullQueueData(queueType, environment);
      failedJobData = await getTypesenseFailedQueueData(queueType, environment);
    }

    if (bullJobData || failedJobData) {
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
          adsFailed++; 
        }
      }
    } else {
      adsFailed = adsWithoutTypesenseCount;
    }

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
      await setCachedData(cacheKey, result, 300, environment);
      return result;
    }

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
      await setCachedData(cacheKey, result, 300, environment);
      return result;
    }

    const result = {
      status: "NOT_PROCESSED",
      message: "Typesense indexing status unknown",
      completed: false,
      adsWithTypesense: adsWithTypesenseCount,
      totalAds: totalAds,
      adsInQueue: 0,
      adsFailed: adsWithoutTypesenseCount,
    };

    await setCachedData(cacheKey, result, 300, environment);
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
