// Models will be required dynamically
const { Op } = require("sequelize");
const { getCacheKey, getCachedData, setCachedData } = require("../utils/cacheUtils");
const { getTypesenseBullQueueData, getTypesenseFailedQueueData, getFileUploadBullQueueData } = require("../utils/redisUtils");
const { getTypesenseStatus } = require("./typesenseService");
const { getFileUploadStatus } = require("./fileUploadService");

/**
 * Get scraping status for a specific brand
 */
async function getBrandScrapingStatus(brandId, date = null) {
  try {
    // Require models dynamically to get the latest version
    const { Brand, BrandsDailyStatus, Ad, AdMediaItem } = require("../../models");
    
    const targetDate = date || new Date().toISOString().split("T")[0];
    const cacheKey = getCacheKey("brand", brandId, targetDate);
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    const brand = await Brand.findByPk(brandId);
    if (!brand) {
      throw new Error("Brand not found");
    }

    const startDate = new Date(targetDate + "T00:00:00.000Z");
    const endDate = new Date(targetDate + "T23:59:59.999Z");

    const dailyStatus = await BrandsDailyStatus.findOne({
      where: {
        brand_id: brandId,
        created_at: {
          [Op.between]: [startDate, endDate],
        },
      },
      order: [["created_at", "DESC"]],
    });

    const scrapingCompleted = dailyStatus?.status === "Started";

    let dbStoredStatus = "Not started";
    let dbStoredCompleted = false;

    if (dailyStatus) {
      const status = dailyStatus.status;
      const activeAds = dailyStatus.active_ads;

      if (status === "Completed") {
        if (activeAds > 0) {
          dbStoredStatus = "Stored (has new ads)";
          dbStoredCompleted = true;
        } else if (activeAds === 0) {
          dbStoredStatus = "Stored (no new ads today)";
          dbStoredCompleted = true;
        } else if (activeAds === null) {
          dbStoredStatus = "Stored (processing done)";
          dbStoredCompleted = true;
        }
      } else if (status === "Started") {
        if (activeAds > 0) {
          dbStoredStatus = "In progress (some ads stored)";
          dbStoredCompleted = false;
        } else if (activeAds === 0) {
          dbStoredStatus = "In progress (no ads yet)";
          dbStoredCompleted = false;
        } else if (activeAds === null) {
          dbStoredStatus = "In progress (not finished)";
          dbStoredCompleted = false;
        }
      } else if (status === "Blocked") {
        dbStoredStatus = "Failed/blocked";
        dbStoredCompleted = false;
      }
    }

    // Get ads for this brand on the specific date
    const ads = await Ad.findAll({
      where: {
        brand_id: brandId,
        created_at: {
          [Op.between]: [startDate, endDate],
        },
      },
    });

    const adIds = ads.map((ad) => ad.id);
    const mediaItems =
      adIds.length > 0
        ? await AdMediaItem.findAll({
            where: {
              ad_id: { [Op.in]: adIds },
            },
          })
        : [];

    // FIXED: Get all required Redis queue data
    const bullJobData = await getTypesenseBullQueueData();
    const failedJobData = await getTypesenseFailedQueueData();
    const brandProcessingJobData = await getFileUploadBullQueueData();
    // Media upload queue doesn't exist - only brand-processing queue is used

    // Get statuses with Redis queue checking for accurate status
    const typesenseStatus = await getTypesenseStatus(
      brandId,
      targetDate,
      ads,
      bullJobData,
      failedJobData
    );
    const fileUploadStatus = await getFileUploadStatus(
      brandId,
      targetDate,
      ads,
      mediaItems,
      brand,
      brandProcessingJobData
    );

    const result = {
      brandId,
      brandName:
        brand.actual_name || brand.name || brand.page_id || `Brand ${brandId}`,
      pageId: brand.page_id,
      date: targetDate,
      scraping: {
        completed: scrapingCompleted,
        status: dailyStatus?.status === "Started" ? "Completed" : (dailyStatus?.status || "Unknown"),
        timestamp: dailyStatus?.created_at || null,
        startedAt: dailyStatus?.started_at || null,
        endedAt: dailyStatus?.ended_at || null,
        activeAds: dailyStatus?.active_ads || 0,
        inactiveAds: dailyStatus?.inactive_ads || 0,
        stoppedAds: dailyStatus?.stopped_ads || 0,
        duration: dailyStatus?.duration || 0,
        iterations: dailyStatus?.iterations || 0,
      },
      dbStored: {
        completed: dbStoredCompleted,
        status: dbStoredStatus,
        activeAds: dailyStatus?.active_ads || 0,
        timestamp: dailyStatus?.created_at || null,
      },
      typesense: {
        completed: typesenseStatus.completed,
        status: typesenseStatus.status,
        message: typesenseStatus.message,
        adsWithTypesense: typesenseStatus.adsWithTypesense,
        totalAds: typesenseStatus.totalAds,
        adsInQueue: typesenseStatus.adsInQueue || 0,
        adsFailed: typesenseStatus.adsFailed || 0,
      },
      fileUpload: {
        completed: fileUploadStatus.completed,
        status: fileUploadStatus.status,
        message: fileUploadStatus.message,
        mediaWithAllUrls: fileUploadStatus.mediaWithAllUrls,
        totalMedia: fileUploadStatus.totalMedia,
        mediaInQueue: fileUploadStatus.mediaInQueue || 0,
        mediaFailed: fileUploadStatus.mediaFailed || 0,
        brandLogoUploaded: fileUploadStatus.brandLogoUploaded || false,
      },
    };

    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Error getting brand scraping status:", error);
    throw error;
  }
}

module.exports = {
  getBrandScrapingStatus,
};
