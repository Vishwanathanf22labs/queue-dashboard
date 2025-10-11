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

async function getBrandIdsForPage(page, perPage, lastId, date, sortBy, sortOrder, environment = 'production') {
  const { getModels } = require("../../models");
  const { Brand, BrandsDailyStatus, Ad, AdMediaItem, WatchList } = getModels(environment);

  const startDate = new Date(date + "T00:00:00.000Z");
  const endDate = new Date(date + "T23:59:59.999Z");

  let watchlistBrandIds = await getCachedData('watchlist_brands', environment);
  if (!watchlistBrandIds) {
    const watchlistRecords = await WatchList.findAll({
      attributes: ["brand_id"],
      raw: true
    });
    watchlistBrandIds = watchlistRecords.map(record => record.brand_id);
    await setCachedData('watchlist_brands', watchlistBrandIds, 180, environment);
  }

  if (sortBy === "normal") {
    const offset = (page - 1) * perPage;

    const watchlistBrands = await BrandsDailyStatus.findAll({
      where: {
        brand_id: { [Op.in]: watchlistBrandIds },
        started_at: { [Op.gte]: startDate, [Op.lt]: endDate }
      },
      attributes: ["brand_id", "active_ads", "started_at"],
      order: [["started_at", "DESC"]],
      raw: true,
    });

    const watchlistMap = new Map();
    watchlistBrands.forEach(record => {
      const brandId = record.brand_id;
      if (!watchlistMap.has(brandId) || new Date(record.started_at) > new Date(watchlistMap.get(brandId).started_at)) {
        watchlistMap.set(brandId, record);
      }
    });

    const watchlistRecords = Array.from(watchlistMap.values());

    const nonWatchlistBrands = await BrandsDailyStatus.findAll({
      where: {
        brand_id: { [Op.notIn]: watchlistBrandIds },
        started_at: { [Op.gte]: startDate, [Op.lt]: endDate }
      },
      attributes: ["brand_id", "active_ads", "started_at"],
      order: [["started_at", "DESC"]],
      raw: true,
    });

    const nonWatchlistMap = new Map();
    nonWatchlistBrands.forEach(record => {
      const brandId = record.brand_id;
      if (!nonWatchlistMap.has(brandId) || new Date(record.started_at) > new Date(nonWatchlistMap.get(brandId).started_at)) {
        nonWatchlistMap.set(brandId, record);
      }
    });

    const nonWatchlistRecords = Array.from(nonWatchlistMap.values());

    const allRecords = [...watchlistRecords, ...nonWatchlistRecords];

    const paginatedRecords = allRecords.slice(offset, offset + perPage);

    return paginatedRecords.map(record => record.brand_id);

  } else if (sortBy === "active_ads") {
    const offset = (page - 1) * perPage;

    const orderDirection = sortOrder === "asc" ? "ASC" : "DESC";

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

    const paginatedRecords = sortedRecords.slice(offset, offset + perPage);

    return paginatedRecords.map(record => record.brand_id);

  } else {
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


async function getTotalBrandsCount(date, environment = 'production') {
  const { getModels } = require("../../models");
  const { Brand, BrandsDailyStatus, Ad, AdMediaItem, WatchList } = getModels(environment);

  const startDate = new Date(date + "T00:00:00.000Z");
  const endDate = new Date(date + "T23:59:59.999Z");

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

async function batchFetchBrandData(brandIds, date, environment = 'production') {
  const { getModels } = require("../../models");
  const { Brand, BrandsDailyStatus, Ad, AdMediaItem, WatchList } = getModels(environment);

  const startDate = new Date(date + "T00:00:00.000Z");
  const endDate = new Date(date + "T23:59:59.999Z");

  const [brands, dailyStatuses, adsStats, mediaStats, queueData] = await Promise.all([
    Brand.findAll({
      where: {
        id: { [Op.in]: brandIds },
        status: { [Op.ne]: "Inactive" }
      },
      attributes: ["id", "name", "actual_name", "page_id", "logo_url_aws"],
      raw: true
    }),

    BrandsDailyStatus.findAll({
      where: {
        brand_id: { [Op.in]: brandIds },
        created_at: { [Op.between]: [startDate, endDate] },
      },
      attributes: ["brand_id", "status", "created_at", "started_at", "ended_at", "active_ads", "inactive_ads", "stopped_ads", "duration", "iterations"],
      raw: true
    }),

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

    Promise.all([
      getTypesenseBullQueueData('regular', environment),
      getTypesenseFailedQueueData('regular', environment),
      getFileUploadBullQueueData('regular', environment)
    ]).then(([bull, failed, upload]) => ({ bull, failed, upload }))
  ]);

  return { brands, dailyStatuses, adsStats, mediaStats, queueData };
}

async function fetchQueueVersionsForBrands(redis, brandIds) {
  if (!redis) return { bull: new Map(), failed: new Map(), upload: new Map() };

  try {
    const pipeline = redis.pipeline();

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

async function getAllBrandsScrapingStatus(page = 1, perPage = 10, date = null, sortBy = 'normal', sortOrder = 'desc', lastId = null, environment = 'production') {
  console.log(`[PIPELINE SERVICE DEBUG] getAllBrandsScrapingStatus called with environment: ${environment}`);
  const { getModels } = require("../../models");
  const { Brand, BrandsDailyStatus, Ad, AdMediaItem, WatchList } = getModels(environment);
  console.log(`[PIPELINE SERVICE DEBUG] Using models for environment: ${environment}`);

  const startTime = Date.now();

  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const startDate = new Date(targetDate + "T00:00:00.000Z");
    const endDate = new Date(targetDate + "T23:59:59.999Z");

    const cached = await getPipelineCache(targetDate, page, perPage, sortBy, sortOrder, lastId);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    const clientETag = await getPipelineETag(targetDate, page, perPage, sortBy, sortOrder, lastId);
    if (clientETag) {
      return { statusCode: 304, etag: clientETag };
    }

    const brandIds = await getBrandIdsForPage(page, perPage, lastId, targetDate, sortBy, sortOrder, environment);

    if (brandIds.length === 0) {
      const totalBrands = await getTotalBrandsCount(targetDate, environment);
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

    const { brands, dailyStatuses, adsStats, mediaStats, queueData } = await batchFetchBrandData(brandIds, targetDate, environment);

    let watchlistBrandIds = await getCachedData('watchlist_brands', environment);
    if (!watchlistBrandIds) {
      const watchlistRecords = await WatchList.findAll({
        attributes: ["brand_id"],
        raw: true
      });
      watchlistBrandIds = watchlistRecords.map(record => record.brand_id);
      await setCachedData('watchlist_brands', watchlistBrandIds, 180, environment);
    }

    const brandMap = new Map(brands.map(brand => [brand.id, brand]));
    const dailyStatusMap = new Map(dailyStatuses.map(ds => [ds.brand_id, ds]));
    const adsStatsMap = new Map(adsStats.map(stat => [stat.brand_id, stat]));
    const mediaStatsMap = new Map(mediaStats.map(stat => [stat.brand_id, stat]));

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
    )).filter(status => status !== null);

    const totalBrands = await getTotalBrandsCount(targetDate, environment);

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

    const etag = generateETag({
      brandIds: brandIds.join(','),
      maxUpdatedAt: Math.max(...dailyStatuses.map(ds => new Date(ds.created_at).getTime())),
      queueVersion: Date.now()
    });

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

async function processBrandStatus(brandId, targetDate, brandMap, dailyStatusMap, adsStatsMap, mediaStatsMap, queueData, watchlistBrandIds) {
  const { Brand, BrandsDailyStatus, Ad, AdMediaItem, WatchList } = require("../../models");

  const brand = brandMap.get(brandId);
  if (!brand) return null;

  const dailyStatus = dailyStatusMap.get(brandId);
  const adsStat = adsStatsMap.get(brandId);
  const mediaStat = mediaStatsMap.get(brandId);

  const scrapingCompleted = dailyStatus?.status === "Started";

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

async function getOverallPipelineStats(date = null, environment = 'production') {
  console.log(`[PIPELINE SERVICE DEBUG] getOverallPipelineStats called with environment: ${environment}`);
  const { getModels } = require("../../models");
  const { Brand, BrandsDailyStatus, Ad, AdMediaItem, WatchList } = getModels(environment);
  console.log(`[PIPELINE SERVICE DEBUG] Using models for environment: ${environment}`);

  const startTime = Date.now();

  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const startDate = new Date(targetDate + "T00:00:00.000Z");
    const endDate = new Date(targetDate + "T23:59:59.999Z");

    const cacheKey = getCacheKey("overall_stats", targetDate);
    const cached = await getCachedData(cacheKey, environment);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    const totalBrands = await getTotalBrandsCount(targetDate, environment);

    const overallStatsQuery = await BrandsDailyStatus.sequelize.query(`
      WITH latest_brand_status AS (
        SELECT DISTINCT ON (brand_id) 
          brand_id, status, active_ads, started_at, created_at
        FROM brand_daily_statuses 
        WHERE started_at >= $1 AND started_at < $2
        ORDER BY brand_id, started_at DESC
      ),
      typesense_stats AS (
        SELECT 
          COUNT(*) as total_ads,
          COUNT(CASE WHEN typesense_id IS NOT NULL THEN 1 END) as ads_with_typesense,
          COUNT(DISTINCT brand_id) as brands_with_ads,
          COUNT(DISTINCT CASE WHEN typesense_id IS NOT NULL THEN brand_id END) as brands_completed
        FROM ads 
        WHERE typesense_updated_at >= $1 AND typesense_updated_at < $2
      ),
      file_stats AS (
        SELECT 
          COUNT(DISTINCT ami.id) as total_media,
          COUNT(DISTINCT CASE WHEN ami.updated_at >= bds.started_at THEN ami.id END) as completed_media,
          COUNT(DISTINCT a.brand_id) as brands_with_media,
          COUNT(DISTINCT CASE WHEN ami.updated_at >= bds.started_at THEN a.brand_id END) as brands_completed
        FROM ads a
        JOIN ads_media_items ami ON a.id = ami.ad_id
        JOIN brand_daily_statuses bds ON a.brand_id = bds.brand_id
        WHERE DATE(a.typesense_updated_at) = $3
          AND DATE(bds.started_at) = $3
      ),
      brand_stats AS (
        SELECT 
          COUNT(brand_id) as total_brands,
          COUNT(CASE WHEN status IN ('Started', 'Completed') THEN 1 END) as scraping_completed,
          COUNT(CASE WHEN status = 'Blocked' THEN 1 END) as scraping_failed,
          COALESCE(SUM(active_ads), 0) as total_stored_ads,
          COUNT(CASE WHEN status = 'Completed' THEN 1 END) as db_completed,
          COUNT(CASE WHEN status != 'Completed' THEN 1 END) as db_failed
        FROM latest_brand_status
      )
      SELECT 
        bs.total_brands,
        bs.scraping_completed,
        bs.scraping_failed,
        bs.total_stored_ads,
        bs.db_completed,
        bs.db_failed,
        
        ts.total_ads,
        ts.ads_with_typesense,
        ts.brands_with_ads as typesense_total_brands,
        ts.brands_completed as typesense_completed,
        (ts.brands_with_ads - ts.brands_completed) as typesense_failed,
        
        COALESCE(fs.total_media, 0) as total_media,
        COALESCE(fs.completed_media, 0) as completed_media,
        COALESCE(fs.brands_with_media, 0) as file_total_brands,
        COALESCE(fs.brands_completed, 0) as file_completed,
        COALESCE((fs.brands_with_media - fs.brands_completed), 0) as file_failed
      FROM brand_stats bs
      CROSS JOIN typesense_stats ts
      CROSS JOIN file_stats fs
    `, {
      bind: [startDate, endDate, targetDate],
      type: BrandsDailyStatus.sequelize.QueryTypes.SELECT
    });

    const stats = overallStatsQuery[0];

    const overallStats = {
      scraping: {
        totalBrands: parseInt(stats.total_brands),
        completed: parseInt(stats.scraping_completed),
        failed: parseInt(stats.scraping_failed)
      },
      dbStored: {
        totalBrands: parseInt(stats.total_brands),
        totalDbStoredAds: parseInt(stats.total_stored_ads),
        completed: parseInt(stats.db_completed),
        failed: parseInt(stats.db_failed)
      },
      typesense: {
        totalAdsProcessed: parseInt(stats.total_ads),
        totalAdsWithTypesense: parseInt(stats.ads_with_typesense),
        totalBrands: parseInt(stats.typesense_total_brands),
        completed: parseInt(stats.typesense_completed),
        failed: parseInt(stats.typesense_failed)
      },
      fileUpload: {
        totalBrands: parseInt(stats.file_total_brands),
        totalMediaItems: parseInt(stats.total_media),
        completedBrands: parseInt(stats.file_completed),
        failedBrands: parseInt(stats.file_failed),
        completedMedia: parseInt(stats.completed_media),
        failedMedia: parseInt(stats.total_media - stats.completed_media)
      }
    };

    const result = {
      date: targetDate,
      overallStats,
      totalBrands
    };

    const etag = generateETag({
      date: targetDate,
      stats: JSON.stringify(overallStats),
      timestamp: Date.now()
    });

    await Promise.all([
      setCachedData(cacheKey, result, 300, environment),
      setPipelineETag(targetDate, 'overall_stats', '1', etag, 'normal', 'desc', null, 300)
    ]);

    return { ...result, etag, fromCache: false };
  } catch (error) {
    console.error("Error getting overall pipeline stats:", error);
    throw error;
  }
}

async function searchBrandsPipelineStatus(query, date = null, environment = 'production') {
  const { getModels } = require("../../models");
  const { Brand, BrandsDailyStatus, Ad, AdMediaItem, WatchList } = getModels(environment);

  const startTime = Date.now();

  try {
    const targetDate = date || new Date().toISOString().split("T")[0];

    const startDate = new Date(targetDate + "T00:00:00.000Z");
    const endDate = new Date(targetDate + "T23:59:59.999Z");

    let watchlistBrandIds = await getCachedData('watchlist_brands', environment);
    if (!watchlistBrandIds) {
      const watchlistRecords = await WatchList.findAll({
        attributes: ["brand_id"], raw: true
      });
      watchlistBrandIds = watchlistRecords.map(record => record.brand_id);
      await setCachedData('watchlist_brands', watchlistBrandIds, 180, environment);
    }

    const isNumericQuery = !isNaN(query) && !isNaN(parseInt(query));
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, '');

    const numericValue = parseInt(query);
    const isWithinIntRange = isNumericQuery && numericValue >= -2147483648 && numericValue <= 2147483647;

    const searchQuery = (isNumericQuery && isWithinIntRange) ? `
      SELECT DISTINCT bds.*, b.name, b.actual_name, b.page_id, b.logo_url_aws
      FROM brand_daily_statuses bds
      JOIN brands b ON bds.brand_id = b.id  
      WHERE (b.id = $1 OR b.page_id = $4) AND bds.created_at BETWEEN $2 AND $3
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

    const bindings = (isNumericQuery && isWithinIntRange) ?
      [numericValue, startDate, endDate, query] :
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

    const brandIds = searchResults.map(result => result.brand_id);
    const { brands, dailyStatuses, adsStats, mediaStats, queueData } = await batchFetchBrandData(brandIds, targetDate, environment);

    const brandMap = new Map(brands.map(brand => [brand.id, brand]));
    const dailyStatusMap = new Map(dailyStatuses.map(ds => [ds.brand_id, ds]));
    const adsStatsMap = new Map(adsStats.map(stat => [stat.brand_id, stat]));
    const mediaStatsMap = new Map(mediaStats.map(stat => [stat.brand_id, stat]));

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
    )).filter(status => status !== null);

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
  getOverallPipelineStats,
  searchBrandsPipelineStatus,
  getBrandIdsForPage,
  getTotalBrandsCount,
  batchFetchBrandData,
  fetchQueueVersionsForBrands,
  processBrandStatus
};