const { Brand, BrandsDailyStatus, Ad, AdMediaItem, WatchList } = require("../../models");
const { Op } = require("sequelize");
const { 
  getCacheKey, 
  getCachedData, 
  setCachedData, 
  generateETag,
  getPipelineCache,
  setPipelineCache,
  getPipelineETag,
  setPipelineETag
} = require("../utils/cacheUtils");
const { getTypesenseBullQueueData, getTypesenseFailedQueueData, getFileUploadBullQueueData } = require("../utils/redisUtils");
const pLimit = require('p-limit').default;

/**
 * Get brand IDs for a page - OPTIMIZED with cursor-based pagination
 */
async function getBrandIdsForPage(page, perPage, lastId, date, sortBy, sortOrder) {
  const startDate = new Date(date + "T00:00:00.000Z");
  const endDate = new Date(date + "T23:59:59.999Z");
  
  // Get watchlist brand IDs
  let watchlistBrandIds = await getCachedData('watchlist_brands');
  if (!watchlistBrandIds) {
    const watchlistRecords = await WatchList.findAll({
      attributes: ["brand_id"],
      raw: true
    });
    watchlistBrandIds = watchlistRecords.map(record => record.brand_id);
    await setCachedData('watchlist_brands', watchlistBrandIds, 180);
  }

  // OPTIMIZED: Use cursor-based pagination for better performance
  if (sortBy === "normal") {
    // For normal sorting: watchlist first, then by started_at
    const offset = (page - 1) * perPage;
    
    // Get watchlist brands first
    const watchlistBrands = await BrandsDailyStatus.findAll({
      where: {
        brand_id: { [Op.in]: watchlistBrandIds },
        started_at: { [Op.gte]: startDate, [Op.lt]: endDate }
      },
      attributes: ["brand_id", "active_ads", "started_at"],
      order: [["started_at", "DESC"]],
      raw: true,
    });

    // Group watchlist brands by brand_id and get latest
    const watchlistMap = new Map();
    watchlistBrands.forEach(record => {
      const brandId = record.brand_id;
      if (!watchlistMap.has(brandId) || new Date(record.started_at) > new Date(watchlistMap.get(brandId).started_at)) {
        watchlistMap.set(brandId, record);
      }
    });

    const watchlistRecords = Array.from(watchlistMap.values());
    
    // Get non-watchlist brands
    const nonWatchlistBrands = await BrandsDailyStatus.findAll({
      where: {
        brand_id: { [Op.notIn]: watchlistBrandIds },
        started_at: { [Op.gte]: startDate, [Op.lt]: endDate }
      },
      attributes: ["brand_id", "active_ads", "started_at"],
      order: [["started_at", "DESC"]],
      raw: true,
    });

    // Group non-watchlist brands by brand_id and get latest
    const nonWatchlistMap = new Map();
    nonWatchlistBrands.forEach(record => {
      const brandId = record.brand_id;
      if (!nonWatchlistMap.has(brandId) || new Date(record.started_at) > new Date(nonWatchlistMap.get(brandId).started_at)) {
        nonWatchlistMap.set(brandId, record);
      }
    });

    const nonWatchlistRecords = Array.from(nonWatchlistMap.values());
    
    // Combine: watchlist first, then non-watchlist
    const allRecords = [...watchlistRecords, ...nonWatchlistRecords];
    
    // Apply pagination
    const paginatedRecords = allRecords.slice(offset, offset + perPage);
    

    return paginatedRecords.map(record => record.brand_id);
    
  } else if (sortBy === "active_ads") {
    // For active_ads sorting: use SQL ORDER BY for better performance
    const offset = (page - 1) * perPage;
    
    const orderDirection = sortOrder === "asc" ? "ASC" : "DESC";
    
    // Use raw SQL for efficient sorting and pagination
    const query = `
      SELECT DISTINCT ON (brand_id) 
        brand_id, 
        active_ads, 
        started_at
      FROM brand_daily_statuses 
      WHERE started_at >= $1 AND started_at < $2
      ORDER BY brand_id, started_at DESC
    `;
    
    const allRecords = await BrandsDailyStatus.sequelize.query(query, {
      bind: [startDate, endDate],
      type: BrandsDailyStatus.sequelize.QueryTypes.SELECT
    });

    // Sort by active_ads in JavaScript (since we need to sort the aggregated data)
    const sortedRecords = allRecords.sort((a, b) => {
      const aAds = parseInt(a.active_ads) || 0;
      const bAds = parseInt(b.active_ads) || 0;
      if (aAds !== bAds) {
        return sortOrder === "asc" ? aAds - bAds : bAds - aAds;
      }
      const aT = new Date(a.started_at).getTime();
      const bT = new Date(b.started_at).getTime();
      return bT - aT;
    });

    // Apply pagination
    const paginatedRecords = sortedRecords.slice(offset, offset + perPage);
    

    return paginatedRecords.map(record => record.brand_id);
    
    } else {
    // Default sorting by started_at
    const offset = (page - 1) * perPage;
    
    const records = await BrandsDailyStatus.findAll({
      where: {
        started_at: { [Op.gte]: startDate, [Op.lt]: endDate }
      },
      attributes: ["brand_id", "active_ads", "started_at"],
      order: [["started_at", "DESC"]],
      limit: perPage,
      offset: offset,
      raw: true,
    });

    // Group by brand_id and get latest
    const brandMap = new Map();
    records.forEach(record => {
      const brandId = record.brand_id;
      if (!brandMap.has(brandId) || new Date(record.started_at) > new Date(brandMap.get(brandId).started_at)) {
        brandMap.set(brandId, record);
      }
    });

    const paginatedRecords = Array.from(brandMap.values());
    

    return paginatedRecords.map(record => record.brand_id);
  }
}


/**
 * Get total count of brands for a date - OPTIMIZED
 */
async function getTotalBrandsCount(date) {
  const startDate = new Date(date + "T00:00:00.000Z");
  const endDate = new Date(date + "T23:59:59.999Z");
  
  // Use efficient SQL query to count distinct brands
  const result = await BrandsDailyStatus.sequelize.query(`
    SELECT COUNT(DISTINCT brand_id) as total_brands
    FROM brand_daily_statuses 
    WHERE started_at >= $1 AND started_at < $2
  `, {
    bind: [startDate, endDate],
    type: BrandsDailyStatus.sequelize.QueryTypes.SELECT
  });
  
  return parseInt(result[0]?.total_brands || 0);
}

/**
 * Batch fetch all required data for multiple brands
 */
async function batchFetchBrandData(brandIds, date) {
  const startDate = new Date(date + "T00:00:00.000Z");
  const endDate = new Date(date + "T23:59:59.999Z");

  // Batch fetch all data in parallel
  const [brands, dailyStatuses, adsStats, mediaStats, queueData] = await Promise.all([
    // Get brands
      Brand.findAll({
        where: {
        id: { [Op.in]: brandIds }, 
        status: { [Op.ne]: "Inactive" } 
        },
      attributes: ["id", "name", "actual_name", "page_id", "logo_url_aws"],
      raw: true
      }),
    
    // Get daily statuses
      BrandsDailyStatus.findAll({
        where: {
        brand_id: { [Op.in]: brandIds },
        created_at: { [Op.between]: [startDate, endDate] },
      },
      attributes: ["brand_id", "status", "created_at", "started_at", "ended_at", "active_ads", "inactive_ads", "stopped_ads", "duration", "iterations"],
      raw: true
    }),
    
    // Batch ads stats query
    Ad.sequelize.query(`
      SELECT 
        brand_id,
        COUNT(*) as total_ads,
        COUNT(CASE WHEN typesense_id IS NOT NULL THEN 1 END) as ads_with_typesense
      FROM ads 
      WHERE brand_id IN (:brandIds)
        AND typesense_updated_at BETWEEN :startDate AND :endDate
      GROUP BY brand_id
    `, {
      replacements: { brandIds, startDate, endDate },
      type: Ad.sequelize.QueryTypes.SELECT
    }),
    
    // Batch media stats query
    AdMediaItem.sequelize.query(`
      SELECT 
        a.brand_id,
        COUNT(ami.id) as total_media,
        COUNT(CASE WHEN DATE(ami.updated_at) = DATE(:date) THEN 1 END) as completed_media
      FROM ads a
      JOIN ads_media_items ami ON a.id = ami.ad_id
      WHERE a.brand_id IN (:brandIds)
        AND DATE(a.typesense_updated_at) = :date
        AND DATE(ami.updated_at) = :date
      GROUP BY a.brand_id
    `, {
      replacements: { brandIds, date },
      type: AdMediaItem.sequelize.QueryTypes.SELECT
    }),
    
    // Get queue data
    Promise.all([
      getTypesenseBullQueueData('regular'),
      getTypesenseFailedQueueData('regular'),
      getFileUploadBullQueueData('regular')
    ]).then(([bull, failed, upload]) => ({ bull, failed, upload }))
  ]);

  return { brands, dailyStatuses, adsStats, mediaStats, queueData };
}

/**
 * Fetch queue versions for brands using Redis pipeline
 */
async function fetchQueueVersionsForBrands(redis, brandIds) {
  if (!redis) return { bull: new Map(), failed: new Map(), upload: new Map() };
  
  try {
    const pipeline = redis.pipeline();
    
    // Add HMGET commands for each brand
    brandIds.forEach(brandId => {
      pipeline.hmget(`bull:ad-update:${brandId}`, 'status');
      pipeline.hmget(`failed:ad-update:${brandId}`, 'status');
      pipeline.hmget(`bull:brand-processing:${brandId}`, 'status');
    });
    
    const results = await pipeline.exec();
    
    const bull = new Map();
    const failed = new Map();
    const upload = new Map();
    
    brandIds.forEach((brandId, index) => {
      const bullResult = results[index * 3];
      const failedResult = results[index * 3 + 1];
      const uploadResult = results[index * 3 + 2];
      
      if (bullResult && bullResult[1]) bull.set(brandId, true);
      if (failedResult && failedResult[1]) failed.set(brandId, true);
      if (uploadResult && uploadResult[1]) upload.set(brandId, true);
    });
    
    return { bull, failed, upload };
  } catch (error) {
    console.error('Error fetching queue versions:', error);
    return { bull: new Map(), failed: new Map(), upload: new Map() };
  }
}

/**
 * Main optimized function - Get scraping status for all brands with batched queries
 */
async function getAllBrandsScrapingStatus(page = 1, perPage = 10, date = null, sortBy = 'normal', sortOrder = 'desc', lastId = null) {
  const startTime = Date.now();
  
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    
    // Check cache first
    const cached = await getPipelineCache(targetDate, page, perPage, sortBy, sortOrder, lastId);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    // Check ETag
    const clientETag = await getPipelineETag(targetDate, page, perPage, sortBy, sortOrder, lastId);
    if (clientETag) {
      // Return 304 if client has same ETag
      return { statusCode: 304, etag: clientETag };
    }

    // Get brand IDs for this page
    const brandIds = await getBrandIdsForPage(page, perPage, lastId, targetDate, sortBy, sortOrder);
    
    if (brandIds.length === 0) {
      const totalBrands = await getTotalBrandsCount(targetDate);
      const result = {
        brands: [],
        date: targetDate,
        pagination: {
          page,
          perPage,
          total: totalBrands,
          pages: Math.ceil(totalBrands / perPage),
          hasNext: false,
          hasPrev: page > 1,
        },
      };
      await setPipelineCache(targetDate, page, perPage, result, sortBy, sortOrder, lastId, 300);
      return result;
    }

    // Batch fetch all data
    const { brands, dailyStatuses, adsStats, mediaStats, queueData } = await batchFetchBrandData(brandIds, targetDate);
    
    // Get watchlist brand IDs
    let watchlistBrandIds = await getCachedData('watchlist_brands');
    if (!watchlistBrandIds) {
      const watchlistRecords = await WatchList.findAll({
        attributes: ["brand_id"], 
        raw: true
      });
      watchlistBrandIds = watchlistRecords.map(record => record.brand_id);
      await setCachedData('watchlist_brands', watchlistBrandIds, 180);
    }

    // Create lookup maps
    const brandMap = new Map(brands.map(brand => [brand.id, brand]));
    const dailyStatusMap = new Map(dailyStatuses.map(ds => [ds.brand_id, ds]));
    const adsStatsMap = new Map(adsStats.map(stat => [stat.brand_id, stat]));
    const mediaStatsMap = new Map(mediaStats.map(stat => [stat.brand_id, stat]));

    // Process brands with bounded concurrency
    const limit = pLimit(8);
    const statuses = (await Promise.all(
      brandIds.map(brandId => 
        limit(() => processBrandStatus(
        brandId,
        targetDate,
          brandMap, 
          dailyStatusMap, 
          adsStatsMap, 
          mediaStatsMap, 
          queueData,
          watchlistBrandIds
        ))
      )
    )).filter(status => status !== null); // Filter out null values

    const totalBrands = await getTotalBrandsCount(targetDate);
    const result = {
      brands: statuses,
      date: targetDate,
      pagination: {
        page,
        perPage,
        total: totalBrands,
        pages: Math.ceil(totalBrands / perPage),
        hasNext: page * perPage < totalBrands,
        hasPrev: page > 1,
      },
    };

    // Generate ETag
    const etag = generateETag({
      brandIds: brandIds.join(','),
      maxUpdatedAt: Math.max(...dailyStatuses.map(ds => new Date(ds.created_at).getTime())),
      queueVersion: Date.now()
    });

    // Cache result and ETag
    await Promise.all([
      setPipelineCache(targetDate, page, perPage, result, sortBy, sortOrder, lastId, 300),
      setPipelineETag(targetDate, page, perPage, etag, sortBy, sortOrder, lastId, 300)
    ]);

    return { ...result, etag, fromCache: false };
  } catch (error) {
    console.error("Error getting all brands scraping status:", error);
    throw error;
  }
}

/**
 * Process individual brand status with batched data
 */
async function processBrandStatus(brandId, targetDate, brandMap, dailyStatusMap, adsStatsMap, mediaStatsMap, queueData, watchlistBrandIds) {
      const brand = brandMap.get(brandId);
  if (!brand) return null;

      const dailyStatus = dailyStatusMap.get(brandId);
  const adsStat = adsStatsMap.get(brandId);
  const mediaStat = mediaStatsMap.get(brandId);

      const scrapingCompleted = dailyStatus?.status === "Started";

      // DB Stored Status Logic
      let dbStoredStatus = "Not started";
      let dbStoredCompleted = false;
      if (dailyStatus) {
        const status = dailyStatus.status;
        const activeAds = dailyStatus.active_ads;
        if (status === "Completed") {
            dbStoredCompleted = true;
      dbStoredStatus = activeAds > 0 ? "Stored (has new ads)" : 
                      activeAds === 0 ? "Stored (no new ads today)" : "Stored (processing done)";
        } else if (status === "Started") {
      dbStoredStatus = activeAds > 0 ? "In progress (some ads stored)" :
                      activeAds === 0 ? "In progress (no ads yet)" : "In progress (not finished)";
        } else if (status === "Blocked") {
          dbStoredStatus = "Failed/blocked";
    }
  }

  // Calculate Typesense status from batched data
  const totalAds = parseInt(adsStat?.total_ads || 0);
  const adsWithTypesense = parseInt(adsStat?.ads_with_typesense || 0);
  const adsWithoutTypesense = totalAds - adsWithTypesense;
  
  let typesenseStatus = {
    completed: adsWithTypesense === totalAds && totalAds > 0,
    status: totalAds === 0 ? "NOT_PROCESSED" : 
            adsWithTypesense === totalAds ? "COMPLETED" :
            adsWithoutTypesense > 0 ? "PROCESSING" : "NOT_PROCESSED",
    message: totalAds === 0 ? "No ads processed" :
             adsWithTypesense === totalAds ? "All ads indexed" :
             "Typesense indexing in progress",
    adsWithTypesense,
    totalAds,
    adsInQueue: 0,
    adsFailed: adsWithoutTypesense
  };

  // Calculate file upload status from batched data
  const totalMedia = parseInt(mediaStat?.total_media || 0);
  const completedMedia = parseInt(mediaStat?.completed_media || 0);
  
  let fileUploadStatus = {
    completed: completedMedia === totalMedia && totalMedia > 0,
    status: totalMedia === 0 ? "NOT_PROCESSED" :
            completedMedia === totalMedia ? "COMPLETED" :
            "PROCESSING",
    message: totalMedia === 0 ? "No media items found" :
             completedMedia === totalMedia ? "File upload completed" :
             "File upload in progress",
    mediaWithAllUrls: completedMedia,
    totalMedia,
    mediaInQueue: 0,
    mediaFailed: totalMedia - completedMedia,
    brandLogoUploaded: brand.logo_url_aws ? true : false
  };

  return {
        brandId: brandId,
    brandName: brand.actual_name || brand.name || brand.page_id || `Brand ${brandId}`,
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
    typesense: typesenseStatus,
    fileUpload: fileUploadStatus,
  };
}

/**
 * Search brands pipeline status - optimized version
 */
async function searchBrandsPipelineStatus(query, date = null) {
  const startTime = Date.now();
  
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];

    const startDate = new Date(targetDate + "T00:00:00.000Z");
    const endDate = new Date(targetDate + "T23:59:59.999Z");

    // Get watchlist IDs from cache
    let watchlistBrandIds = await getCachedData('watchlist_brands');
    if (!watchlistBrandIds) {
      const watchlistRecords = await WatchList.findAll({
        attributes: ["brand_id"], raw: true
      });
      watchlistBrandIds = watchlistRecords.map(record => record.brand_id);
      await setCachedData('watchlist_brands', watchlistBrandIds, 180);
    }

    const isNumericQuery = !isNaN(query) && !isNaN(parseInt(query));
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, '');
    
    // OPTIMIZED: Use raw SQL for complex search
    const searchQuery = isNumericQuery ? `
      SELECT DISTINCT bds.*, b.name, b.actual_name, b.page_id, b.logo_url_aws
      FROM brand_daily_statuses bds
      JOIN brands b ON bds.brand_id = b.id  
      WHERE bds.brand_id = $1 AND bds.created_at BETWEEN $2 AND $3
      AND b.status != 'Inactive'
      ORDER BY bds.created_at DESC
    ` : `
      SELECT DISTINCT bds.*, b.name, b.actual_name, b.page_id, b.logo_url_aws
      FROM brand_daily_statuses bds
      JOIN brands b ON bds.brand_id = b.id
      WHERE bds.created_at BETWEEN $2 AND $3 AND b.status != 'Inactive'
      AND (LOWER(b.actual_name) LIKE $1 OR LOWER(b.name) LIKE $1 
           OR LOWER(REPLACE(b.actual_name, ' ', '')) LIKE $4
           OR LOWER(REPLACE(b.name, ' ', '')) LIKE $4 OR LOWER(b.page_id) LIKE $1)
      ORDER BY bds.created_at DESC
    `;

    const bindings = isNumericQuery ? 
      [parseInt(query), startDate, endDate] :
      [`%${query.toLowerCase()}%`, startDate, endDate, `%${normalizedQuery}%`];

    const searchResults = await BrandsDailyStatus.sequelize.query(searchQuery, {
      bind: bindings,
      type: BrandsDailyStatus.sequelize.QueryTypes.SELECT
    });

    if (searchResults.length === 0) {
      const result = {
        success: true,
        data: { brands: [], totalResults: 0, query, queryDate: targetDate }
      };
      return result;
    }

    // Process search results with batched queries
    const brandIds = searchResults.map(result => result.brand_id);
    const { brands, dailyStatuses, adsStats, mediaStats, queueData } = await batchFetchBrandData(brandIds, targetDate);

    // Create lookup maps
    const brandMap = new Map(brands.map(brand => [brand.id, brand]));
    const dailyStatusMap = new Map(dailyStatuses.map(ds => [ds.brand_id, ds]));
    const adsStatsMap = new Map(adsStats.map(stat => [stat.brand_id, stat]));
    const mediaStatsMap = new Map(mediaStats.map(stat => [stat.brand_id, stat]));

    // Process results with bounded concurrency
    const limit = pLimit(8);
    const statuses = (await Promise.all(
      brandIds.map(brandId => 
        limit(() => processBrandStatus(
          brandId, 
          targetDate, 
          brandMap, 
          dailyStatusMap, 
          adsStatsMap, 
          mediaStatsMap, 
          queueData,
          watchlistBrandIds
        ))
      )
    )).filter(status => status !== null); // Filter out null values

    const result = {
      success: true,
      data: {
        brands: statuses,
        totalResults: statuses.length,
        query: query,
        queryDate: targetDate
      }
    };

    return result;
    
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
  searchBrandsPipelineStatus,
  getBrandIdsForPage,
  getTotalBrandsCount,
  batchFetchBrandData,
  fetchQueueVersionsForBrands,
  processBrandStatus
};