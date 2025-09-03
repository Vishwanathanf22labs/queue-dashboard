const { Brand, BrandsDailyStatus, Ad, AdMediaItem } = require("../models");
const { Op, Sequelize } = require("sequelize");
const Redis = require("ioredis");

// Connect to Madangles Scraper Redis (for Bull queues)
let madanglesRedis = null;

// Add caching for Redis operations
const redisCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

try {
  madanglesRedis = new Redis({
    host:
      process.env.MADANGLES_REDIS_HOST,
    port: process.env.MADANGLES_REDIS_PORT,
    password:
      process.env.MADANGLES_REDIS_PASSWORD,
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
        adsWithTypesense: 0,
        totalAds: 0,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    const adsWithTypesense = brandAds.filter((ad) => ad.typesense_id !== null);
    const adsWithoutTypesense = brandAds.filter(
      (ad) => ad.typesense_id === null
    );

    if (adsWithTypesense.length === brandAds.length) {
      const result = {
        status: "COMPLETED",
        message: "All ads indexed in Typesense",
        completed: true,
        adsWithTypesense: adsWithTypesense.length,
        totalAds: brandAds.length,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    // Use provided job data if available
    let adsInQueue = 0;
    let adsFailed = 0;

    if (bullJobData && failedJobData) {
      const adIdsWithoutTypesense = adsWithoutTypesense.map((ad) => ad.id);

      for (const adId of adIdsWithoutTypesense) {
        if (failedJobData.has(adId)) {
          adsFailed++;
        } else if (bullJobData.has(adId)) {
          adsInQueue++;
        }
      }
    }

    let result;
    if (adsFailed > 0) {
      result = {
        status: "FAILED",
        message: "Typesense indexing failed",
        completed: false,
        adsWithTypesense: adsWithTypesense.length,
        totalAds: brandAds.length,
        adsInQueue,
        adsFailed,
      };
    } else if (adsInQueue > 0) {
      result = {
        status: "WAITING",
        message: "Ads waiting in Typesense queue",
        completed: false,
        adsWithTypesense: adsWithTypesense.length,
        totalAds: brandAds.length,
        adsInQueue,
        adsFailed,
      };
    } else {
      result = {
        status: "NOT_PROCESSED",
        message: "Typesense indexing not initiated",
        completed: false,
        adsWithTypesense: adsWithTypesense.length,
        totalAds: brandAds.length,
        adsInQueue,
        adsFailed,
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
    };
  }
}

/**
 * Check file upload status for a brand based on ads_media and Redis Bull queues
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

    let brandData = brand;
    if (!brandData) {
      brandData = await Brand.findByPk(brandId);
    }
    const brandLogoUploaded = brandData && brandData.logo_url_aws;

    const allMediaUploaded = mediaWithAllUrls.length === brandMediaItems.length;
    const fileUploadCompleted = allMediaUploaded && brandLogoUploaded;

    if (fileUploadCompleted) {
      const result = {
        status: "COMPLETED",
        message: "All files and brand logo uploaded to S3",
        completed: true,
        mediaWithAllUrls: mediaWithAllUrls.length,
        totalMedia: brandMediaItems.length,
        brandLogoUploaded: true,
      };
      setCachedData(cacheKey, result);
      return result;
    }

    const brandHasProcessingJob = brandProcessingJobData
      ? brandProcessingJobData.has(brandId)
      : false;
    const hasMissingFiles =
      mediaWithoutAllUrls.length > 0 || !brandLogoUploaded;

    let result;
    if (hasMissingFiles && brandHasProcessingJob) {
      result = {
        status: "WAITING",
        message: "Brand is still being processed, files will be uploaded soon",
        completed: false,
        mediaWithAllUrls: mediaWithAllUrls.length,
        totalMedia: brandMediaItems.length,
        brandLogoUploaded: brandLogoUploaded,
        brandHasProcessingJob: true,
      };
    } else if (hasMissingFiles && !brandHasProcessingJob) {
      result = {
        status: "FAILED",
        message: "Brand processing completed but file upload failed",
        completed: false,
        mediaWithAllUrls: mediaWithAllUrls.length,
        totalMedia: brandMediaItems.length,
        brandLogoUploaded: brandLogoUploaded,
        brandHasProcessingJob: false,
      };
    } else {
      result = {
        status: "NOT_PROCESSED",
        message: "Brand has no ads or media to upload",
        completed: false,
        mediaWithAllUrls: mediaWithAllUrls.length,
        totalMedia: brandMediaItems.length,
        brandLogoUploaded: brandLogoUploaded,
        brandHasProcessingJob: false,
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

    // Get statuses without Redis calls for single brand (too expensive)
    const typesenseStatus = await getTypesenseStatus(brandId, targetDate, ads);
    const fileUploadStatus = await getFileUploadStatus(
      brandId,
      targetDate,
      ads,
      mediaItems,
      brand
    );

    const result = {
      brandId,
      brandName:
        brand.actual_name || brand.name || brand.page_id || `Brand ${brandId}`,
      pageId: brand.page_id,
      date: targetDate,
      scraping: {
        completed: scrapingCompleted,
        status: dailyStatus?.status || "Unknown",
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

    // Skip Redis operations for better performance - they were disabled anyway
    // const bullJobData = new Map();
    // const failedJobData = new Map();
    // const brandProcessingJobData = new Map();

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
      let typesenseStatus = "NOT_PROCESSED";
      let typesenseCompleted = false;
      let typesenseMessage = "No ads found for this date";
      let adsWithTypesense = 0;
      let totalAds = brandAds.length;

      if (brandAds.length > 0) {
        const adsWithTypesenseList = brandAds.filter(
          (ad) => ad.typesense_id !== null
        );
        adsWithTypesense = adsWithTypesenseList.length;

        if (adsWithTypesense === brandAds.length) {
          typesenseStatus = "COMPLETED";
          typesenseCompleted = true;
          typesenseMessage = "All ads indexed in Typesense";
        } else {
          typesenseStatus = "NOT_PROCESSED";
          typesenseMessage = "Typesense indexing not initiated";
        }
      }

      // Calculate file upload status
      let fileUploadStatus = "NOT_PROCESSED";
      let fileUploadCompleted = false;
      let fileUploadMessage = "No media items found for this date";
      let mediaWithAllUrls = 0;
      let totalMedia = brandMediaItems.length;
      const brandLogoUploaded = brand && brand.logo_url_aws;

      if (brandMediaItems.length > 0) {
        const mediaWithAllUrlsList = brandMediaItems.filter(
          (media) =>
            media.file_url_original &&
            media.file_url_resized &&
            media.file_url_preview
        );
        mediaWithAllUrls = mediaWithAllUrlsList.length;

        const allMediaUploaded = mediaWithAllUrls === brandMediaItems.length;
        fileUploadCompleted = allMediaUploaded && brandLogoUploaded;

        if (fileUploadCompleted) {
          fileUploadStatus = "COMPLETED";
          fileUploadMessage = "All files and brand logo uploaded to S3";
        } else {
          fileUploadStatus = "NOT_PROCESSED";
          fileUploadMessage = "Brand has no ads or media to upload";
        }
      }

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
          status: dailyStatus?.status || "Unknown",
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
          completed: typesenseCompleted,
          status: typesenseStatus,
          message: typesenseMessage,
          adsWithTypesense: adsWithTypesense,
          totalAds: totalAds,
          adsInQueue: 0,
          adsFailed: 0,
        },
        fileUpload: {
          completed: fileUploadCompleted,
          status: fileUploadStatus,
          message: fileUploadMessage,
          mediaWithAllUrls: mediaWithAllUrls,
          totalMedia: totalMedia,
          brandLogoUploaded: brandLogoUploaded || false,
          brandHasProcessingJob: false,
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
      return latestStatus?.status === "Started";
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
