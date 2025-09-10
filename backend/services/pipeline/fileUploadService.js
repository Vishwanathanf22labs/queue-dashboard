const { Brand, Ad, AdMediaItem, BrandsDailyStatus } = require("../../models");
const { Op } = require("sequelize");
const { getCacheKey, getCachedData, setCachedData } = require("../utils/cacheUtils");
const { getFileUploadBullQueueData } = require("../utils/redisUtils");

/**
 * Check file upload status for a brand based on ads_media and Redis Bull queues
 * FIXED: Proper status logic implementation
 */
async function getFileUploadStatus(
  brandId,
  targetDate,
  ads = null,
  mediaItems = null,
  brand = null,
  brandProcessingJobData = null,
  queueType = 'regular'
) {
  try {
    const cacheKey = getCacheKey("fileupload", brandId, targetDate);
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    let brandAds = ads;
    if (!brandAds) {
      const startDate = new Date(targetDate + "T00:00:00.000Z");
      const endDate = new Date(targetDate + "T23:59:59.999Z");

      brandAds = await Ad.findAll({
        where: {
          brand_id: brandId,
          created_at: {
            [Op.between]: [startDate, endDate],
          },
        },
      });
    } else {
      brandAds = ads.filter((ad) => ad.brand_id === brandId);
    }

    if (brandAds.length === 0) {
      const result = {
        status: "NOT_PROCESSED",
        message: "No ads found for this date",
        completed: false,
        mediaWithAllUrls: 0,
        totalMedia: 0,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    const adIds = brandAds.map((ad) => ad.id);

    let brandMediaItems = mediaItems;
    if (!brandMediaItems) {
      brandMediaItems = await AdMediaItem.findAll({
        where: {
          ad_id: { [Op.in]: adIds },
        },
      });
    } else {
      brandMediaItems = mediaItems.filter((media) =>
        adIds.includes(media.ad_id)
      );
    }

    if (brandMediaItems.length === 0) {
      const result = {
        status: "NOT_PROCESSED",
        message: "No media items found for this date",
        completed: false,
        mediaWithAllUrls: 0,
        totalMedia: 0,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    // Get brand data
    let brandData = brand;
    if (!brandData) {
      brandData = await Brand.findByPk(brandId);
    }
    const brandLogoUploaded = brandData && brandData.logo_url_aws;

    // Check media upload status
    const mediaWithAllUrls = brandMediaItems.filter(
      (media) =>
        media.file_url_original &&
        media.file_url_resized &&
        media.file_url_preview
    );
    const mediaWithoutAllUrls = brandMediaItems.filter(
      (media) =>
        !media.file_url_original ||
        !media.file_url_resized ||
        !media.file_url_preview
    );

    // NEW: Check for COMPLETED status using time-based logic
    const latestBrandStatus = await BrandsDailyStatus.findOne({
      where: { brand_id: brandId },
      order: [['started_at', 'DESC']]
    });

    let fileUploadCompleted = false;
    if (latestBrandStatus && latestBrandStatus.started_at) {
      const startedAt = new Date(latestBrandStatus.started_at);
      const startedAtDate = startedAt.toISOString().split('T')[0]; // Get date part only
      
      // Check if all media items have updated_at >= started_at (same date or later)
      const allMediaCompleted = brandMediaItems.every(media => {
        const mediaUpdatedAt = new Date(media.updated_at);
        const mediaUpdatedAtDate = mediaUpdatedAt.toISOString().split('T')[0]; // Get date part only
        
        // COMPLETED if: started_at == updated_at (same date) OR updated_at > started_at
        return mediaUpdatedAtDate >= startedAtDate;
      });
      
      fileUploadCompleted = allMediaCompleted;
    }

    // If completed by time-based logic, mark as completed
    if (fileUploadCompleted) {
      const result = {
        status: "COMPLETED",
        message: "File upload completed (time-based check)",
        completed: true,
        mediaWithAllUrls: mediaWithAllUrls.length,
        totalMedia: brandMediaItems.length,
        brandLogoUploaded: brandLogoUploaded || false,
        mediaInQueue: 0,
        mediaFailed: 0,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    // FIXED: Check Redis queues for missing files
    let mediaInQueue = 0;
    let mediaFailed = 0;
    
    // Get brand processing job data if not provided
    if (!brandProcessingJobData) {
      brandProcessingJobData = await getFileUploadBullQueueData(queueType);
    }
    
    const brandHasProcessingJob = brandProcessingJobData
      ? brandProcessingJobData.has(brandId)
      : false;

    // Only check brand-level processing job (no individual media queue)
    // mediaInQueue is set to 0 since there's no individual media queue

    // FIXED: Implement proper status logic based on requirements
    let result;

    // If some files are uploaded and brand is processing - PROCESSING
    if (
      mediaWithAllUrls.length > 0 &&
      brandHasProcessingJob
    ) {
      result = {
        status: "PROCESSING",
        message: "File upload in progress",
        completed: false,
        mediaWithAllUrls: mediaWithAllUrls.length,
        totalMedia: brandMediaItems.length,
        brandLogoUploaded: brandLogoUploaded || false,
        mediaInQueue: 0, // No individual media queue
        mediaFailed: mediaWithoutAllUrls.length,
      };
    }
    // If no files are uploaded but brand is processing - WAITING
    else if (
      mediaWithAllUrls.length === 0 &&
      brandHasProcessingJob
    ) {
      result = {
        status: "WAITING",
        message: "Files waiting to be uploaded",
        completed: false,
        mediaWithAllUrls: mediaWithAllUrls.length,
        totalMedia: brandMediaItems.length,
        brandLogoUploaded: brandLogoUploaded || false,
        mediaInQueue: 0, // No individual media queue
        mediaFailed: 0,
      };
    }
    // If some files are uploaded but brand is not processing - FAILED (partially)
    else if (
      mediaWithAllUrls.length > 0 &&
      !brandHasProcessingJob
    ) {
      result = {
        status: "FAILED",
        message: "Some file uploads failed",
        completed: false,
        mediaWithAllUrls: mediaWithAllUrls.length,
        totalMedia: brandMediaItems.length,
        brandLogoUploaded: brandLogoUploaded || false,
        mediaInQueue: 0,
        mediaFailed: mediaWithoutAllUrls.length,
      };
    }
    // If no files are uploaded and none in queue - FAILED or NOT_PROCESSED
    else if (
      mediaWithAllUrls.length === 0 &&
      mediaInQueue === 0 &&
      !brandHasProcessingJob
    ) {
      result = {
        status: "FAILED",
        message: "File upload failed or not started",
        completed: false,
        mediaWithAllUrls: mediaWithAllUrls.length,
        totalMedia: brandMediaItems.length,
        brandLogoUploaded: brandLogoUploaded || false,
        mediaInQueue: 0,
        mediaFailed: mediaWithoutAllUrls.length,
      };
    }
    // Default case
    else {
      result = {
        status: "NOT_PROCESSED",
        message: "File upload not initiated",
        completed: false,
        mediaWithAllUrls: mediaWithAllUrls.length,
        totalMedia: brandMediaItems.length,
        brandLogoUploaded: brandLogoUploaded || false,
        mediaInQueue: 0, // No individual media queue
        mediaFailed: mediaWithoutAllUrls.length,
      };
    }

    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Error checking file upload status:", error);
    return {
      status: "ERROR",
      message: "Error checking file upload status",
      completed: false,
      mediaWithAllUrls: 0,
      totalMedia: 0,
      mediaInQueue: 0,
      mediaFailed: 0,
    };
  }
}

module.exports = {
  getFileUploadStatus,
};
