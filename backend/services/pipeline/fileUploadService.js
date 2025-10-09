// Models will be required dynamically
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
  queueType = 'regular',
  environment = 'production'
) {
  try {
    // Require models dynamically to get the latest version
    const { getModels } = require("../../models");
    const { Brand, Ad, AdMediaItem, BrandsDailyStatus } = getModels(environment);
    
    const cacheKey = getCacheKey("fileupload", brandId, targetDate);
    const cached = await getCachedData(cacheKey, environment);
    if (cached) return cached;

    // NEW LOGIC: Use your exact query to get the total media items
    const userDefinedQuery = `
      SELECT ami.*
      FROM public.ads a
      JOIN public.ads_media_items ami ON a.id = ami.ad_id
      WHERE a.brand_id = :brandId
        AND DATE(a.typesense_updated_at) = :targetDate
        AND DATE(ami.updated_at) = :targetDate
      ORDER BY ami.id DESC
      LIMIT 200
    `;
    
    const relevantMediaItems = await AdMediaItem.sequelize.query(userDefinedQuery, {
      replacements: { brandId, targetDate },
      type: AdMediaItem.sequelize.QueryTypes.SELECT
    });
    
    const totalMediaItems = relevantMediaItems.length; // This should be 60 for brand 7061

    if (totalMediaItems === 0) {
      const result = {
        status: "NOT_PROCESSED",
        message: "No media items found for this date",
        completed: false,
        mediaWithAllUrls: 0,
        totalMedia: 0,
      };
      await setCachedData(cacheKey, result, 300, environment);
      return result;
    }

    // Get brand data
    let brandData = brand;
    if (!brandData) {
      brandData = await Brand.findByPk(brandId);
    }
    const brandLogoUploaded = brandData && brandData.logo_url_aws;

    // Get latest brand status to determine started_at
    const latestBrandStatus = await BrandsDailyStatus.findOne({
      where: { brand_id: brandId },
      order: [['started_at', 'DESC']]
    });

    // NEW COMPLETION LOGIC: Check if updated_at is on the same date as started_at
    let completedMediaCount = 0;
    if (latestBrandStatus && latestBrandStatus.started_at) {
      const startedAt = new Date(latestBrandStatus.started_at);
      const startedAtDate = startedAt.toISOString().split('T')[0]; // Get date part only
      
      completedMediaCount = relevantMediaItems.filter(media => {
        const mediaUpdatedAt = new Date(media.updated_at);
        const mediaUpdatedAtDate = mediaUpdatedAt.toISOString().split('T')[0]; // Get date part only
        return mediaUpdatedAtDate === startedAtDate; // Same date = completed
      }).length;
    }

    const isCompleted = completedMediaCount === totalMediaItems;

    // Get brand processing job data if not provided
    if (!brandProcessingJobData) {
      brandProcessingJobData = await getFileUploadBullQueueData(queueType, environment);
    }
    
    const brandHasProcessingJob = brandProcessingJobData
      ? brandProcessingJobData.has(brandId)
      : false;

    let result;

    if (isCompleted) {
      // All media items have updated_at >= started_at - COMPLETED
      result = {
        status: "COMPLETED",
        message: "File upload completed",
        completed: true,
        mediaWithAllUrls: completedMediaCount,
        totalMedia: totalMediaItems,
        brandLogoUploaded: brandLogoUploaded || false,
        mediaInQueue: 0,
        mediaFailed: 0,
      };
    } else if (brandHasProcessingJob) {
      // Brand is processing but not all files completed - PROCESSING
      result = {
        status: "PROCESSING",
        message: "File upload in progress",
        completed: false,
        mediaWithAllUrls: completedMediaCount,
        totalMedia: totalMediaItems,
        brandLogoUploaded: brandLogoUploaded || false,
        mediaInQueue: 0,
        mediaFailed: totalMediaItems - completedMediaCount,
      };
    } else {
      // Brand not processing and not all files completed - FAILED
      result = {
        status: "FAILED",
        message: "File upload not completed",
        completed: false,
        mediaWithAllUrls: completedMediaCount,
        totalMedia: totalMediaItems,
        brandLogoUploaded: brandLogoUploaded || false,
        mediaInQueue: 0,
        mediaFailed: totalMediaItems - completedMediaCount,
      };
    }

    await setCachedData(cacheKey, result, 300, environment);
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
