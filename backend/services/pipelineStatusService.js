const { Brand, BrandsDailyStatus, Ad, AdMediaItem } = require("../models");
const { Op, Sequelize } = require("sequelize");
const Redis = require("ioredis");
const redis = require("../config/redis");

// Connect to Madangles Scraper Redis (for Bull queues)
let madanglesRedis = null;

// Add caching for Redis operations
const redisCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

try {
  madanglesRedis = new Redis({
    host: process.env.MADANGLES_REDIS_HOST,
    port: process.env.MADANGLES_REDIS_PORT,
    password: process.env.MADANGLES_REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
  });

  madanglesRedis.on("error", (err) => {
    console.warn("Madangles Redis connection error:", err.message);
    madanglesRedis = null;
  });

  madanglesRedis.on("connect", () => {
    console.log("Madangles Redis connected successfully");
  });
} catch (error) {
  console.warn("Failed to initialize Madangles Redis:", error.message);
  madanglesRedis = null;
}

// Cache helper functions
function getCacheKey(prefix, ...args) {
  return `${prefix}:${args.join(":")}`;
}

// Redis Bull queue data functions
async function getTypesenseBullQueueData() {
  try {
    if (!madanglesRedis) return new Map();

    // Get Ad Update Bull queue data (for Typesense indexing)
    const queueKeys = await madanglesRedis.keys("bull:ad-update:*");
    const jobData = new Map();

    for (const key of queueKeys) {
      const jobDataRaw = await madanglesRedis.hgetall(key);
      if (jobDataRaw && jobDataRaw.data) {
        const adId = JSON.parse(jobDataRaw.data).adid;
        if (adId) {
          jobData.set(adId, true);
        }
      }
    }

    return jobData;
  } catch (error) {
    console.warn("Error getting Ad Update Bull queue data:", error.message);
    return new Map();
  }
}

async function getTypesenseFailedQueueData() {
  try {
    if (!madanglesRedis) return new Map();

    // Get Ad Update failed queue data
    const failedKeys = await madanglesRedis.keys("bull:ad-update:failed:*");
    const failedData = new Map();

    for (const key of failedKeys) {
      const jobDataRaw = await madanglesRedis.hgetall(key);
      if (jobDataRaw && jobDataRaw.data) {
        const adId = JSON.parse(jobDataRaw.data).adid;
        if (adId) {
          failedData.set(adId, true);
        }
      }
    }

    return failedData;
  } catch (error) {
    console.warn("Error getting Ad Update failed queue data:", error.message);
    return new Map();
  }
}

async function getFileUploadBullQueueData() {
  try {
    if (!redis) return new Map();

    // Get brand processing Bull queue data (for file upload) - uses normal Redis
    const queueKeys = await redis.keys("bull:brand-processing:*");
    const jobData = new Map();

    for (const key of queueKeys) {
      const jobDataRaw = await redis.hgetall(key);
      if (jobDataRaw && jobDataRaw.data) {
        const brandId = JSON.parse(jobDataRaw.data).brandId;
        if (brandId) {
          jobData.set(brandId, true);
        }
      }
    }

    return jobData;
  } catch (error) {
    console.warn(
      "Error getting brand processing Bull queue data:",
      error.message
    );
    return new Map();
  }
}

// REMOVED: Media upload queue doesn't exist - only brand-processing queue is used

function getCachedData(key) {
  const cached = redisCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  redisCache.delete(key);
  return null;
}

function setCachedData(key, data) {
  redisCache.set(key, { data, timestamp: Date.now() });
  // Clean up old cache entries periodically
  if (redisCache.size > 1000) {
    const keysToDelete = [];
    for (const [cacheKey, value] of redisCache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL) {
        keysToDelete.push(cacheKey);
      }
    }
    keysToDelete.forEach((key) => redisCache.delete(key));
  }
}

/**
 * Check Typesense status for a brand based on ads and Redis Bull queues
 * FIXED: Proper status logic implementation based on requirements
 */
async function getTypesenseStatus(
  brandId,
  targetDate,
  ads = null,
  bullJobData = null,
  failedJobData = null
) {
  try {
    const cacheKey = getCacheKey("typesense", brandId, targetDate);
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    // Use provided ads if available, otherwise fetch
    let brandAds = ads;
    if (!brandAds) {
      const startDate = new Date(targetDate + "T00:00:00.000Z");
      const endDate = new Date(targetDate + "T23:59:59.999Z");

      brandAds = await Ad.findAll({
        where: {
          brand_id: brandId,
          typesense_updated_at: {
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
        adsWithTypesense: 0,
        totalAds: 0,
        adsInQueue: 0,
        adsFailed: 0,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    const adsWithTypesense = brandAds.filter((ad) => ad.typesense_id !== null);
    const adsWithoutTypesense = brandAds.filter(
      (ad) => ad.typesense_id === null
    );

    // FIXED: If all ads have typesense_id, mark as completed
    if (adsWithTypesense.length === brandAds.length) {
      const result = {
        status: "COMPLETED",
        message: "All ads indexed in Typesense",
        completed: true,
        adsWithTypesense: adsWithTypesense.length,
        totalAds: brandAds.length,
        adsInQueue: 0,
        adsFailed: 0,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    // FIXED: Check Redis queues for ads without typesense_id
    let adsInQueue = 0;
    let adsFailed = 0;

    if (bullJobData || failedJobData) {
      const adIdsWithoutTypesense = adsWithoutTypesense.map((ad) => ad.id);

      for (const adId of adIdsWithoutTypesense) {
        if (failedJobData && failedJobData.has(adId)) {
          adsFailed++;
        } else if (bullJobData && bullJobData.has(adId)) {
          adsInQueue++;
        }
      }
    }

    // FIXED: Implement proper status logic based on requirements
    let result;

    // If some ads have typesense_id and others are in queue - PROCESSING
    if (adsWithTypesense.length > 0 && adsInQueue > 0) {
      result = {
        status: "PROCESSING",
        message: "Typesense indexing in progress",
        completed: false,
        adsWithTypesense: adsWithTypesense.length,
        totalAds: brandAds.length,
        adsInQueue,
        adsFailed,
      };
    }
    // If some ads have typesense_id but others are not in queue - FAILED (partially)
    else if (
      adsWithTypesense.length > 0 &&
      adsInQueue === 0 &&
      adsWithoutTypesense.length > 0
    ) {
      result = {
        status: "FAILED",
        message: "Some Typesense indexing failed",
        completed: false,
        adsWithTypesense: adsWithTypesense.length,
        totalAds: brandAds.length,
        adsInQueue: 0,
        adsFailed: adsWithoutTypesense.length,
      };
    }
    // If no ads have typesense_id but all are in queue - WAITING
    else if (adsWithTypesense.length === 0 && adsInQueue > 0) {
      result = {
        status: "WAITING",
        message: "Ads waiting in Typesense queue",
        completed: false,
        adsWithTypesense: adsWithTypesense.length,
        totalAds: brandAds.length,
        adsInQueue,
        adsFailed,
      };
    }
    // If no ads have typesense_id and none in queue - FAILED or NOT_PROCESSED
    else if (adsWithTypesense.length === 0 && adsInQueue === 0) {
      result = {
        status: "FAILED",
        message: "Typesense indexing failed or not started",
        completed: false,
        adsWithTypesense: adsWithTypesense.length,
        totalAds: brandAds.length,
        adsInQueue: 0,
        adsFailed: adsWithoutTypesense.length,
      };
    }
    // Default case
    else {
      result = {
        status: "NOT_PROCESSED",
        message: "Typesense indexing not initiated",
        completed: false,
        adsWithTypesense: adsWithTypesense.length,
        totalAds: brandAds.length,
        adsInQueue,
        adsFailed: adsWithoutTypesense.length - adsInQueue,
      };
    }

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
  brandProcessingJobData = null
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

    const allMediaUploaded = mediaWithAllUrls.length === brandMediaItems.length;
    const fileUploadCompleted = allMediaUploaded && brandLogoUploaded;

    // FIXED: If all files are uploaded, mark as completed
    if (fileUploadCompleted) {
      const result = {
        status: "COMPLETED",
        message: "All files and brand logo uploaded to S3",
        completed: true,
        mediaWithAllUrls: mediaWithAllUrls.length,
        totalMedia: brandMediaItems.length,
        brandLogoUploaded: true,
        mediaInQueue: 0,
        mediaFailed: 0,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    // FIXED: Check Redis queues for missing files
    let mediaInQueue = 0;
    let mediaFailed = 0;
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

/**
 * Get scraping status for a specific brand
 */
async function getBrandScrapingStatus(brandId, date = null) {
  try {
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

/**
 * Get scraping status for all brands with pagination - OPTIMIZED VERSION
 */
async function getAllBrandsScrapingStatus(page = 1, limit = 10, date = null) {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const cacheKey = getCacheKey("allbrands", page, limit, targetDate);
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    const offset = (page - 1) * limit;
    const startDate = new Date(targetDate + "T00:00:00.000Z");
    const endDate = new Date(targetDate + "T23:59:59.999Z");

    // Get total count for pagination
    const totalBrands = await BrandsDailyStatus.count({
      distinct: true,
      col: "brand_id",
      where: {
        created_at: {
          [Op.between]: [startDate, endDate],
        },
      },
    });

    // Get paginated brand IDs
    const dailyStatusRecords = await BrandsDailyStatus.findAll({
      where: {
        created_at: {
          [Op.between]: [startDate, endDate],
        },
      },
      attributes: ["brand_id"],
      group: ["brand_id"],
      order: [["brand_id", "DESC"]],
      limit: limit,
      offset: offset,
    });

    const paginatedBrandIds = dailyStatusRecords.map(
      (record) => record.brand_id
    );

    if (paginatedBrandIds.length === 0) {
      const result = {
        brands: [],
        date: targetDate,
        pagination: {
          page: page,
          limit: limit,
          total: totalBrands,
          pages: Math.ceil(totalBrands / limit),
          hasNext: false,
          hasPrev: page > 1,
        },
      };
      setCachedData(cacheKey, result);
      return result;
    }

    // Batch fetch all required data
    const [brands, dailyStatuses, ads, mediaItems] = await Promise.all([
      Brand.findAll({
        where: {
          id: { [Op.in]: paginatedBrandIds },
          status: { [Op.ne]: "Inactive" },
        },
        order: [["created_at", "DESC"]],
      }),
      BrandsDailyStatus.findAll({
        where: {
          brand_id: { [Op.in]: paginatedBrandIds },
          created_at: {
            [Op.between]: [startDate, endDate],
          },
        },
        order: [
          ["brand_id", "ASC"],
          ["created_at", "DESC"],
        ],
      }),
      Ad.findAll({
        where: {
          brand_id: { [Op.in]: paginatedBrandIds },
          created_at: {
            [Op.between]: [startDate, endDate],
          },
        },
      }),
      // Only fetch media items after getting ads to avoid unnecessary queries
      Ad.findAll({
        where: {
          brand_id: { [Op.in]: paginatedBrandIds },
          created_at: {
            [Op.between]: [startDate, endDate],
          },
        },
        attributes: ["id"],
      }).then((adResults) => {
        const adIds = adResults.map((ad) => ad.id);
        return adIds.length > 0
          ? AdMediaItem.findAll({
              where: {
                ad_id: { [Op.in]: adIds },
              },
            })
          : [];
      }),
    ]);

    // FIXED: Get all Redis Bull queue data for accurate status checking
    const bullJobData = await getTypesenseBullQueueData();
    const failedJobData = await getTypesenseFailedQueueData();
    const brandProcessingJobData = await getFileUploadBullQueueData();
    // Media upload queue doesn't exist - only brand-processing queue is used

    // Process results efficiently
    const brandMap = new Map(brands.map((brand) => [brand.id, brand]));
    const dailyStatusMap = new Map();

    // Group daily statuses by brand_id, keeping only the latest
    dailyStatuses.forEach((ds) => {
      const brandId = ds.brand_id;
      if (!dailyStatusMap.has(brandId)) {
        dailyStatusMap.set(brandId, ds);
      }
    });

    // Group ads by brand_id
    const adsMap = new Map();
    ads.forEach((ad) => {
      const brandId = ad.brand_id;
      if (!adsMap.has(brandId)) {
        adsMap.set(brandId, []);
      }
      adsMap.get(brandId).push(ad);
    });

    // Group media by ad_id for faster lookup
    const mediaMap = new Map();
    mediaItems.forEach((media) => {
      const adId = media.ad_id;
      if (!mediaMap.has(adId)) {
        mediaMap.set(adId, []);
      }
      mediaMap.get(adId).push(media);
    });

    // Build results efficiently
    const statuses = [];
    for (const brandId of paginatedBrandIds) {
      const brand = brandMap.get(brandId);
      if (!brand) continue;

      const dailyStatus = dailyStatusMap.get(brandId);
      const brandAds = adsMap.get(brandId) || [];

      // Get media items for this brand's ads
      const brandMediaItems = [];
      brandAds.forEach((ad) => {
        const adMedia = mediaMap.get(ad.id) || [];
        brandMediaItems.push(...adMedia);
      });

      const scrapingCompleted = dailyStatus?.status === "Started";

      // DB Stored Status Logic
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

      // Calculate Typesense status
      const typesenseStatus = await getTypesenseStatus(
        brandId,
        targetDate,
        brandAds,
        bullJobData,
        failedJobData
      );

      // FIXED: Calculate file upload status with proper Redis queue checking
      const fileUploadStatus = await getFileUploadStatus(
        brandId,
        targetDate,
        brandAds,
        brandMediaItems,
        brand,
        brandProcessingJobData
      );

      statuses.push({
        brandId: brandId,
        brandName:
          brand.actual_name ||
          brand.name ||
          brand.page_id ||
          `Brand ${brandId}`,
        pageId: brand.page_id,
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
      });
    }

    const result = {
      brands: statuses,
      date: targetDate,
      pagination: {
        page: page,
        limit: limit,
        total: totalBrands,
        pages: Math.ceil(totalBrands / limit),
        hasNext: page * limit < totalBrands,
        hasPrev: page > 1,
      },
    };

    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Error getting all brands scraping status:", error);
    throw error;
  }
}

// Keep existing getScrapingStats function but add caching
async function getScrapingStats(date = null) {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const cacheKey = getCacheKey("stats", targetDate);
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    const totalBrands = await Brand.count({
      where: { status: { [Op.ne]: "Inactive" } },
    });

    const startDate = new Date(targetDate + "T00:00:00.000Z");
    const endDate = new Date(targetDate + "T23:59:59.999Z");

    const brandsWithStatus = await Brand.findAll({
      where: { status: { [Op.ne]: "Inactive" } },
      include: [
        {
          model: BrandsDailyStatus,
          as: "dailyStatuses",
          required: true,
          where: {
            created_at: {
              [Op.between]: [startDate, endDate],
            },
          },
          order: [["created_at", "DESC"]],
          limit: 1,
        },
      ],
    });

    const completedScraping = brandsWithStatus.filter((brand) => {
      const latestStatus = brand.dailyStatuses?.[0];
      return latestStatus?.status === "Completed";
    }).length;

    const statusCounts = {
      Started: 0,
      Completed: 0,
      Blocked: 0,
      Unknown: 0,
    };

    const dbStoredCounts = {
      "Stored (has new ads)": 0,
      "Stored (no new ads today)": 0,
      "Stored (processing done)": 0,
      "In progress (some ads stored)": 0,
      "In progress (no ads yet)": 0,
      "In progress (not finished)": 0,
      "Failed/blocked": 0,
      "Not started": 0,
    };

    const typesenseCounts = {
      COMPLETED: 0,
      WAITING: 0,
      FAILED: 0,
      NOT_PROCESSED: 0,
      ERROR: 0,
    };

    const fileUploadCounts = {
      COMPLETED: 0,
      PROCESSING: 0,
      WAITING: 0,
      FAILED: 0,
      NOT_PROCESSED: 0,
      ERROR: 0,
    };

    let completedDbStored = 0;
    let completedTypesense = 0;
    let completedFileUpload = 0;

    brandsWithStatus.forEach((brand) => {
      const latestStatus = brand.dailyStatuses?.[0];
      const status = latestStatus?.status || "Unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Simplified logic for stats (avoid heavy computations)
      let dbStoredStatus = "Not started";
      let dbStoredCompleted = false;

      if (latestStatus) {
        const activeAds = latestStatus.active_ads;
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
          } else if (activeAds === 0) {
            dbStoredStatus = "In progress (no ads yet)";
          } else if (activeAds === null) {
            dbStoredStatus = "In progress (not finished)";
          }
        } else if (status === "Blocked") {
          dbStoredStatus = "Failed/blocked";
        }
      }

      dbStoredCounts[dbStoredStatus] =
        (dbStoredCounts[dbStoredStatus] || 0) + 1;
      if (dbStoredCompleted) {
        completedDbStored++;
      }

      // Simplified status for performance
      typesenseCounts["NOT_PROCESSED"] =
        (typesenseCounts["NOT_PROCESSED"] || 0) + 1;
      fileUploadCounts["NOT_PROCESSED"] =
        (fileUploadCounts["NOT_PROCESSED"] || 0) + 1;
    });

    const brandsWithoutStatus = totalBrands - brandsWithStatus.length;
    dbStoredCounts["Not started"] += brandsWithoutStatus;
    typesenseCounts["NOT_PROCESSED"] += brandsWithoutStatus;
    fileUploadCounts["NOT_PROCESSED"] += brandsWithoutStatus;

    const result = {
      date: targetDate,
      totalBrands,
      brandsWithStatus: brandsWithStatus.length,
      completedScraping,
      statusCounts,
      completionRate:
        totalBrands > 0
          ? ((completedScraping / totalBrands) * 100).toFixed(2)
          : 0,
      dbStored: {
        completed: completedDbStored,
        completionRate:
          totalBrands > 0
            ? ((completedDbStored / totalBrands) * 100).toFixed(2)
            : 0,
        statusCounts: dbStoredCounts,
      },
      typesense: {
        completed: completedTypesense,
        completionRate:
          totalBrands > 0
            ? ((completedTypesense / totalBrands) * 100).toFixed(2)
            : 0,
        statusCounts: typesenseCounts,
      },
      fileUpload: {
        completed: completedFileUpload,
        completionRate:
          totalBrands > 0
            ? ((completedFileUpload / totalBrands) * 100).toFixed(2)
            : 0,
        statusCounts: fileUploadCounts,
      },
    };

    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Error getting scraping stats:", error);
    throw error;
  }
}

module.exports = {
  getBrandScrapingStatus,
  getAllBrandsScrapingStatus,
  getScrapingStats,
};
