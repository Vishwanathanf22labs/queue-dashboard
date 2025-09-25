const { Brand, BrandsDailyStatus, Ad, AdMediaItem, WatchList } = require("../../models");
const { Op } = require("sequelize");
const { getCacheKey, getCachedData, setCachedData } = require("../utils/cacheUtils");
const { getTypesenseBullQueueData, getTypesenseFailedQueueData, getFileUploadBullQueueData } = require("../utils/redisUtils");
const { getTypesenseStatus } = require("./typesenseService");
const { getFileUploadStatus } = require("./fileUploadService");

/**
 * Get scraping status for all brands with pagination - OPTIMIZED VERSION
 */
async function getAllBrandsScrapingStatus(page = 1, limit = 10, date = null, sortBy = 'normal', sortOrder = 'desc', queueType = 'regular') {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const cacheKey = getCacheKey("allbrands", page, limit, targetDate, sortBy, sortOrder);
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    const offset = (page - 1) * limit;
    const startDate = new Date(targetDate + "T00:00:00.000Z");
    const endDate = new Date(targetDate + "T23:59:59.999Z");

    // Get watchlist brand IDs for marking
    const watchlistRecords = await WatchList.findAll({
      attributes: ["brand_id"],
      raw: true
    });
    const watchlistBrandIds = watchlistRecords.map(record => record.brand_id);

    // Get total count for pagination (will be updated after sorting)
    let totalBrands = 0;

    // Get all brand IDs with their active_ads for proper sorting
    const allDailyStatusRecords = await BrandsDailyStatus.findAll({
      where: {
        created_at: {
          [Op.between]: [startDate, endDate],
        },
      },
      attributes: ["brand_id", "active_ads"],
      order: [["brand_id", "DESC"]], // Initial order, will be re-sorted
    });

    // Sort brands based on sorting criteria
    let sortedBrandIds;
    if (sortBy === 'normal') {
      // Normal sorting: watchlist first, then regular
      sortedBrandIds = allDailyStatusRecords
        .map(record => record.brand_id)
        .sort((a, b) => {
          const aIsWatchlist = watchlistBrandIds.includes(a);
          const bIsWatchlist = watchlistBrandIds.includes(b);
          
          if (aIsWatchlist && !bIsWatchlist) return -1; // a (watchlist) comes first
          if (!aIsWatchlist && bIsWatchlist) return 1;  // b (watchlist) comes first
          return 0; // maintain original order for same type
        });
    } else {
      // Sort by active_ads
      const recordsWithAds = allDailyStatusRecords.map(record => ({
        brand_id: record.brand_id,
        active_ads: parseInt(record.active_ads) || 0
      }));
      
      recordsWithAds.sort((a, b) => {
        if (sortOrder === 'asc') {
          return a.active_ads > b.active_ads ? 1 : a.active_ads < b.active_ads ? -1 : 0;
        } else {
          return a.active_ads < b.active_ads ? 1 : a.active_ads > b.active_ads ? -1 : 0;
        }
      });
      
      sortedBrandIds = recordsWithAds.map(record => record.brand_id);
      
      // Debug: Log first 10 sorted results
      console.log(`Sorting by active_ads ${sortOrder}:`);
      recordsWithAds.slice(0, 10).forEach((record, index) => {
        console.log(`${index + 1}. Brand ID ${record.brand_id}: ${record.active_ads} ads`);
      });
    }

    // Update total count after sorting
    totalBrands = sortedBrandIds.length;

    // Apply pagination to sorted results
    const paginatedBrandIds = sortedBrandIds.slice(offset, offset + limit);

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

    // FIXED: Get Redis Bull queue data for the specific queue type
    const bullJobData = await getTypesenseBullQueueData(queueType);
    const failedJobData = await getTypesenseFailedQueueData(queueType);
    const brandProcessingJobData = await getFileUploadBullQueueData(queueType);
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
        failedJobData,
        queueType
      );

      // FIXED: Calculate file upload status with proper Redis queue checking
      const fileUploadStatus = await getFileUploadStatus(
        brandId,
        targetDate,
        brandAds,
        brandMediaItems,
        brand,
        brandProcessingJobData,
        queueType
      );

      statuses.push({
        brandId: brandId,
        brandName:
          brand.actual_name ||
          brand.name ||
          brand.page_id ||
          `Brand ${brandId}`,
        pageId: brand.page_id,
        isWatchlist: watchlistBrandIds.includes(brandId), // Add watchlist flag
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

/**
 * Get scraping status for both watchlist and regular brands separately
 */
async function getAllBrandsScrapingStatusSeparate(page = 1, limit = 10, date = null) {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const cacheKey = getCacheKey("allbrands_separate", page, limit, targetDate);
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    // Get both watchlist and regular brands data
    const [watchlistData, regularData] = await Promise.all([
      getAllBrandsScrapingStatus(page, limit, date, 'watchlist'),
      getAllBrandsScrapingStatus(page, limit, date, 'regular')
    ]);

    const result = {
      watchlist: {
        brands: watchlistData.brands,
        date: targetDate,
        pagination: watchlistData.pagination,
        queueType: 'watchlist'
      },
      regular: {
        brands: regularData.brands,
        date: targetDate,
        pagination: regularData.pagination,
        queueType: 'regular'
      },
      date: targetDate
    };

    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Error getting all brands scraping status (separate):", error);
    throw error;
  }
}

/**
 * Search pipeline status across all brands
 * @param {string} query - Search query
 * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to current date)
 * @returns {Object} - Search results
 */
async function searchBrandsPipelineStatus(query, date = null) {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const startDate = new Date(targetDate + "T00:00:00.000Z");
    const endDate = new Date(targetDate + "T23:59:59.999Z");

    // Get watchlist brand IDs for marking
    const watchlistRecords = await WatchList.findAll({
      attributes: ["brand_id"],
      raw: true
    });
    const watchlistBrandIds = watchlistRecords.map(record => record.brand_id);

    // Check if query is numeric for brand_id search
    const isNumericQuery = !isNaN(query) && !isNaN(parseInt(query));
    
    // 🔍 Normalize search query - remove spaces and make lowercase for flexible matching
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, '');
    
    // Build where clause based on query type
    let whereClause = {
      created_at: {
        [Op.between]: [startDate, endDate],
      }
    };
    
    // If query is numeric, search by brand_id
    if (isNumericQuery) {
      whereClause.brand_id = parseInt(query);
    }

    // Search across all brands using Sequelize ORM with flexible matching
    const searchResults = await BrandsDailyStatus.findAll({
      where: whereClause,
      include: [
        {
          model: Brand,
          as: 'brand',
          attributes: [
            'id',
            'name',
            'actual_name',
            'page_id'
          ],
          required: true,
          where: isNumericQuery ? {} : {
            [Op.or]: [
              // 🔍 Exact match with spaces
              {
                actual_name: {
                  [Op.iLike]: `%${query}%`
                }
              },
              {
                name: {
                  [Op.iLike]: `%${query}%`
                }
              },
              // 🔍 Flexible match without spaces (for "redbull" to find "Red Bull")
              {
                [Op.and]: [
                  BrandsDailyStatus.sequelize.where(
                    BrandsDailyStatus.sequelize.fn('LOWER', 
                      BrandsDailyStatus.sequelize.fn('REPLACE', 
                        BrandsDailyStatus.sequelize.col('brand.actual_name'), ' ', ''
                      )
                    ),
                    'LIKE',
                    `%${normalizedQuery}%`
                  )
                ]
              },
              {
                [Op.and]: [
                  BrandsDailyStatus.sequelize.where(
                    BrandsDailyStatus.sequelize.fn('LOWER', 
                      BrandsDailyStatus.sequelize.fn('REPLACE', 
                        BrandsDailyStatus.sequelize.col('brand.name'), ' ', ''
                      )
                    ),
                    'LIKE',
                    `%${normalizedQuery}%`
                  )
                ]
              },
              // Page ID search (exact)
              {
                page_id: {
                  [Op.iLike]: `%${query}%`
                }
              }
            ]
          }
        }
      ],
      attributes: [
        'brand_id',
        'status',
        'created_at',
        'started_at',
        'ended_at',
        'active_ads',
        'inactive_ads',
        'stopped_ads',
        'duration',
        'iterations'
      ],
      order: [['created_at', 'DESC']]
    });

    if (searchResults.length === 0) {
      return {
        success: true,
        data: {
          brands: [],
          totalResults: 0,
          query: query,
          queryDate: targetDate
        }
      };
    }

    // Get brand IDs from search results
    const brandIds = searchResults.map(result => result.brand_id);
    
    // Get additional data for these brands
    const [brands, ads, mediaItems] = await Promise.all([
      Brand.findAll({
        where: {
          id: { [Op.in]: brandIds },
          status: { [Op.ne]: "Inactive" },
        },
        order: [["created_at", "DESC"]],
      }),
      Ad.findAll({
        where: {
          brand_id: { [Op.in]: brandIds },
          created_at: {
            [Op.between]: [startDate, endDate],
          },
        },
      }),
      Ad.findAll({
        where: {
          brand_id: { [Op.in]: brandIds },
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

    // Get Redis Bull queue data
    const bullJobData = await getTypesenseBullQueueData('regular');
    const failedJobData = await getTypesenseFailedQueueData('regular');
    const brandProcessingJobData = await getFileUploadBullQueueData('regular');

    // Process results efficiently
    const brandMap = new Map(brands.map((brand) => [brand.id, brand]));
    const dailyStatusMap = new Map();

    // Group daily statuses by brand_id, keeping only the latest
    searchResults.forEach((ds) => {
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

    // Build search results efficiently
    const statuses = [];
    for (const brandId of brandIds) {
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
        failedJobData,
        'regular'
      );

      // Calculate file upload status
      const fileUploadStatus = await getFileUploadStatus(
        brandId,
        targetDate,
        brandAds,
        brandMediaItems,
        brand,
        brandProcessingJobData,
        'regular'
      );

      statuses.push({
        brandId: brandId,
        brandName:
          brand.actual_name ||
          brand.name ||
          brand.page_id ||
          `Brand ${brandId}`,
        pageId: brand.page_id,
        isWatchlist: watchlistBrandIds.includes(brandId),
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

    return {
      success: true,
      data: {
        brands: statuses,
        totalResults: statuses.length,
        query: query,
        queryDate: targetDate
      }
    };
  } catch (error) {
    console.error('Error in searchBrandsPipelineStatus:', error);
    return {
      success: false,
      error: 'Failed to search pipeline status',
      details: error.message
    };
  }
}

module.exports = {
  getAllBrandsScrapingStatus,
  getAllBrandsScrapingStatusSeparate,
  searchBrandsPipelineStatus,
};
