const { Op } = require("sequelize");
const { getCacheKey, getCachedData, setCachedData } = require("../utils/cacheUtils");
const { getFileUploadBullQueueData } = require("../utils/redisUtils");


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
    const { getModels } = require("../../models");
    const { Brand, Ad, AdMediaItem, BrandsDailyStatus } = getModels(environment);

    const cacheKey = getCacheKey("fileupload", brandId, targetDate);
    const cached = await getCachedData(cacheKey, environment);
    if (cached) return cached;


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

    const totalMediaItems = relevantMediaItems.length;


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


    let brandData = brand;
    if (!brandData) {
      brandData = await Brand.findByPk(brandId);
    }
    const brandLogoUploaded = brandData && brandData.logo_url_aws;


    const latestBrandStatus = await BrandsDailyStatus.findOne({
      where: { brand_id: brandId },
      order: [['started_at', 'DESC']]
    });


    let completedMediaCount = 0;
    if (latestBrandStatus && latestBrandStatus.started_at) {
      const startedAt = new Date(latestBrandStatus.started_at);
      const startedAtDate = startedAt.toISOString().split('T')[0];

      completedMediaCount = relevantMediaItems.filter(media => {
        const mediaUpdatedAt = new Date(media.updated_at);
        const mediaUpdatedAtDate = mediaUpdatedAt.toISOString().split('T')[0];
        return mediaUpdatedAtDate === startedAtDate;
      }).length;
    }


    const isCompleted = completedMediaCount === totalMediaItems;


    if (!brandProcessingJobData) {
      brandProcessingJobData = await getFileUploadBullQueueData(queueType, environment);
    }

    const brandHasProcessingJob = brandProcessingJobData
      ? brandProcessingJobData.has(brandId)
      : false;


    let result;


    if (isCompleted) {
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
