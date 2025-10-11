const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { QUEUES, PAGINATION } = require("../config/constants");

function getRedisKeys(environment = null) {
  const { getRedisKeys } = require("../config/constants");
  return getRedisKeys(environment);
}

async function enrichBrandsWithDBInfo(brandItems, isSortedSet = false, environment = 'production') {
  const { getModels } = require("../models");
  const { Brand } = getModels(environment);
  
  const results = [];
  const pageIds = [];

  if (isSortedSet) {
    for (let i = 0; i < brandItems.length; i += 2) {
      try {
        const member = brandItems[i];
        if (!member) continue;
        
        const brandData = JSON.parse(member);
        const pageId = brandData.page_id;
        if (pageId) {
          pageIds.push(pageId);
        }
      } catch (parseError) {
        logger.error("Error parsing brand item from Redis:", parseError);
      }
    }
  } else {
    for (const item of brandItems) {
      try {
        const brandData = JSON.parse(item);
        const pageId = brandData.page_id;
        if (pageId) {
          pageIds.push(pageId);
        }
      } catch (parseError) {
        logger.error("Error parsing brand item from Redis:", parseError);
      }
    }
  }

  let brandMap = new Map();
  if (pageIds.length > 0) {
    try {
      const brands = await Brand.findAll({
        where: { page_id: pageIds },
        attributes: ["name", "actual_name", "status", "category", "page_id", "actual_ads_count"],
        raw: true,
      });
      
      brands.forEach(brand => {
        brandMap.set(brand.page_id, brand);
      });
    } catch (dbError) {
      logger.error("Error batch fetching brand info:", dbError);
    }
  }

  if (isSortedSet) {
    for (let i = 0; i < brandItems.length; i += 2) {
      try {
        const member = brandItems[i];
        const score = brandItems[i + 1];
        
        if (!member) continue;
        
        const brandData = JSON.parse(member);
        const pageId = brandData.page_id;

        let pageCategory = brandData.page_category;
        if (!pageCategory && brandData.page_categories) {
          pageCategory = Array.isArray(brandData.page_categories) 
            ? brandData.page_categories.join(', ')
            : brandData.page_categories;
        }

        let brandInfo = {
          queue_id: brandData.id,
          page_id: pageId,
          brand_name: "Unknown",
          status: "Unknown",
          queue_position: results.length + 1,
          page_category: pageCategory || "Unknown",
          error_message: brandData.reason || "Unknown error",
          score: score
        };

        const brand = brandMap.get(pageId);
        if (brand) {
          brandInfo.brand_name = brand.actual_name || brand.name || "Unknown";
          brandInfo.status = brand.status || "Unknown";
          
          if (!pageCategory && brand.category) {
            pageCategory = brand.category;
            brandInfo.page_category = pageCategory;
          }
        }

        results.push(brandInfo);
      } catch (parseError) {
        logger.error("Error parsing brand item from Redis:", parseError);
      }
    }
  } else {
    for (const item of brandItems) {
      try {
        const brandData = JSON.parse(item);
        const pageId = brandData.page_id;

        let pageCategory = brandData.page_category;
        if (!pageCategory && brandData.page_categories) {
          pageCategory = Array.isArray(brandData.page_categories) 
            ? brandData.page_categories.join(', ')
            : brandData.page_categories;
        }

        let brandInfo = {
          queue_id: brandData.id,
          page_id: pageId,
          brand_name: "Unknown",
          status: "Unknown",
          queue_position: results.length + 1,
          page_category: pageCategory || "Unknown",
          error_message: brandData.reason || "Unknown error"
        };

        const brand = brandMap.get(pageId);
        if (brand) {
          brandInfo.brand_name = brand.actual_name || brand.name || "Unknown";
          brandInfo.status = brand.status || "Unknown";
          
          if (!pageCategory && brand.category) {
            pageCategory = brand.category;
            brandInfo.page_category = pageCategory;
          }
        }

        results.push(brandInfo);
      } catch (parseError) {
        logger.error("Error parsing brand item from Redis:", parseError);
      }
    }
  }

  return results;
}

async function getPendingBrands(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT,
  search = null,
  queueType = 'regular', 
  environment = 'production'
) {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

    const redis = getQueueRedis(queueType, environment);
    const queueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;

    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      
      const queueRedis = getQueueRedis(queueType, environment);
      const allBrandItems = await queueRedis.zrange(queueKey, 0, -1, 'WITHSCORES');
      logger.info(`Raw Redis data for ${queueType} pending brands: ${JSON.stringify(allBrandItems)}`);
      const allEnrichedBrands = await enrichBrandsWithDBInfo(allBrandItems, true, environment);
      
      const normalizedSearchTerm = searchTerm.replace(/\s+/g, '');
      
      const matchingBrands = allEnrichedBrands.filter(brand => {
        const brandName = brand.brand_name?.toLowerCase() || '';
        const normalizedBrandName = brandName.replace(/\s+/g, '');
        
        return (
          brandName.includes(searchTerm) ||
          normalizedBrandName.includes(normalizedSearchTerm) ||
          brand.queue_id?.toString().includes(searchTerm) ||
          brand.page_id?.toString().includes(searchTerm)
        );
      });
      
      const totalCount = matchingBrands.length;
      const startIndex = (validPage - 1) * validLimit;
      const endIndex = startIndex + validLimit;
      const paginatedBrands = matchingBrands.slice(startIndex, endIndex);
      
      return {
        brands: paginatedBrands,
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: totalCount,
          total_pages: Math.ceil(totalCount / validLimit),
        },
        queueType: queueType
      };
    }

    const queueRedis = getQueueRedis(queueType, environment);
    const totalCount = await queueRedis.zcard(queueKey);
    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit - 1;

    if (totalCount === 0) {
      return {
        brands: [],
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: 0,
          total_pages: 0,
        },
        queueType: queueType
      };
    }

    const brandItems = await queueRedis.zrange(
      queueKey,
      startIndex,
      endIndex,
      'WITHSCORES'
    );
    logger.info(`Raw Redis data for paginated ${queueType} pending brands: ${JSON.stringify(brandItems)}`);

    const enrichedBrands = await enrichBrandsWithDBInfo(brandItems, true, environment);

    return {
      brands: enrichedBrands,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: totalCount,
        total_pages: Math.ceil(totalCount / validLimit),
      },
      queueType: queueType
    };
  } catch (error) {
    logger.error(`Error in getPendingBrands (${queueType}):`, error);
    throw error;
  }
}

async function getFailedBrands(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT,
  search = null,
  queueType = 'regular', 
  environment = 'production'
) {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

    const redis = getQueueRedis(queueType, environment);
    const queueKey = REDIS_KEYS[queueType.toUpperCase()].FAILED_BRANDS;

    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      
      const queueRedis = getQueueRedis(queueType, environment);
      const allBrandItems = await queueRedis.lrange(queueKey, 0, -1);
      const allEnrichedBrands = await enrichBrandsWithDBInfo(allBrandItems, false, environment);
      
      const normalizedSearchTerm = searchTerm.replace(/\s+/g, '');
      
      const matchingBrands = allEnrichedBrands.filter(brand => {
        const brandName = brand.brand_name?.toLowerCase() || '';
        const normalizedBrandName = brandName.replace(/\s+/g, '');
        
        return (
          brandName.includes(searchTerm) ||
          normalizedBrandName.includes(normalizedSearchTerm) ||
          brand.queue_id?.toString().includes(searchTerm) ||
          brand.page_id?.toString().includes(searchTerm)
        );
      });
      
      const totalCount = matchingBrands.length;
      const startIndex = (validPage - 1) * validLimit;
      const endIndex = startIndex + validLimit;
      const paginatedBrands = matchingBrands.slice(startIndex, endIndex);
      
      return {
        brands: paginatedBrands,
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: totalCount,
          total_pages: Math.ceil(totalCount / validLimit),
        },
        queueType: queueType
      };
    }

    const queueRedis = getQueueRedis(queueType, environment);
    const totalCount = await queueRedis.llen(queueKey);
    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit - 1;

    if (totalCount === 0) {
      return {
        brands: [],
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: 0,
          total_pages: 0,
        },
        queueType: queueType
      };
    }

    const brandItems = await queueRedis.lrange(
      queueKey,
      startIndex,
      endIndex
    );

    const enrichedBrands = await enrichBrandsWithDBInfo(brandItems, false, environment);

    return {
      brands: enrichedBrands,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: totalCount,
        total_pages: Math.ceil(totalCount / validLimit),
      },
      queueType: queueType
    };
  } catch (error) {
    logger.error(`Error in getFailedBrands (${queueType}):`, error);
    throw error;
  }
}

async function getWatchlistBrands(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT,
  search = null,
  environment = 'production',
  userId = null
) {
  try {
    const { getModels } = require("../models");
    const { Brand, WatchList } = getModels(environment);
    const { getDatabaseConnection } = require("../config/database");
    const db = getDatabaseConnection(environment);
    
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.max(1, parseInt(limit));

    const uniqueWatchlistBrandIds = await WatchList.findAll({
      attributes: [
        [db.fn('DISTINCT', db.col('brand_id')), 'brand_id'],
        [db.fn('MAX', db.col('created_at')), 'created_at']
      ],
      group: ['brand_id'],
      raw: true
    });

    logger.info(`Found ${uniqueWatchlistBrandIds.length} unique watchlist brand IDs`);

    if (uniqueWatchlistBrandIds.length === 0) {
      return {
        brands: [],
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: 0,
          total_pages: 0,
        },
      };
    }

    const brandIds = uniqueWatchlistBrandIds.map(item => item.brand_id);
    const watchlistBrands = await Brand.findAll({
      where: { id: brandIds },
      attributes: ['id', 'page_id', 'name', 'actual_name', 'status'],
      raw: true
    });

    logger.info(`Found ${watchlistBrands.length} brands with details`);

    const REDIS_KEYS = getRedisKeys(environment);
    const watchlistRedis = getQueueRedis('watchlist', environment);
    const allPendingItems = await watchlistRedis.zrange(REDIS_KEYS.WATCHLIST.PENDING_BRANDS, 0, -1, 'WITHSCORES');
    const pendingPageIds = new Set();
    const pendingBrandsMap = new Map(); 

    for (let i = 0; i < allPendingItems.length; i += 2) {
      const member = allPendingItems[i];
      const score = allPendingItems[i + 1];
      
      try {
        const brandData = JSON.parse(member);
        pendingPageIds.add(brandData.page_id);
        pendingBrandsMap.set(brandData.page_id, {
          queue_id: brandData.id,
          score: score,
          member: member
        });
      } catch (error) {
        logger.error("Error parsing watchlist pending brand item:", error);
      }
    }

    const allFailedItems = await watchlistRedis.lrange(REDIS_KEYS.WATCHLIST.FAILED_BRANDS, 0, -1);
    const failedPageIds = new Set();
    
    for (const failedItem of allFailedItems) {
      try {
        const failedData = JSON.parse(failedItem);
        failedPageIds.add(failedData.page_id);
      } catch (error) {
        logger.error("Error parsing watchlist failed brand item:", error);
      }
    }

    logger.info(`Pending page_ids: ${Array.from(pendingPageIds).join(', ')}`);
    logger.info(`Failed page_ids: ${Array.from(failedPageIds).join(', ')}`);

    let processedBrands = [];
    
    for (const brand of watchlistBrands) {
      const pageId = brand.page_id;
      
      
      let scraperStatus;
      
      if (pendingPageIds.has(pageId)) {
        scraperStatus = 'waiting';
      } else if (failedPageIds.has(pageId)) {
        scraperStatus = 'failed';
      } else {
        scraperStatus = 'completed';
      }

      const brandInfo = {
        queue_id: pendingBrandsMap.get(pageId)?.queue_id || null,
        page_id: pageId,
        brand_id: brand.id,
        brand_name: brand.actual_name || brand.name || "Unknown",
        status: brand.status || "Unknown",
        is_watchlist: true,
        scraper_status: scraperStatus,
        added_at: new Date() 
      };

      processedBrands.push(brandInfo);
    }

    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      processedBrands = processedBrands.filter(brand => 
        brand.brand_name?.toLowerCase().includes(searchTerm) ||
        brand.page_id?.toString().includes(searchTerm) ||
        brand.brand_id?.toString().includes(searchTerm)
      );
    }

    const totalCount = processedBrands.length;
    
    if (totalCount === 0) {
      return {
        brands: [],
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: 0,
          total_pages: 0,
        },
      };
    }

    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedBrands = processedBrands.slice(startIndex, endIndex);

    return {
      brands: paginatedBrands,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: totalCount,
        total_pages: Math.ceil(totalCount / validLimit),
      },
    };
  } catch (error) {
    logger.error("Error in getWatchlistBrands:", error);
    throw error;
  }
}

async function getWatchlistPendingBrands(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT,
  search = null,
  environment = 'production'
) {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.max(1, parseInt(limit));

    const watchlistRedis = getQueueRedis('watchlist', environment);
    const allPendingItems = await watchlistRedis.zrange(REDIS_KEYS.WATCHLIST.PENDING_BRANDS, 0, -1, 'WITHSCORES');
    
    const pendingBrands = await enrichBrandsWithDBInfo(allPendingItems, true, environment);
    
    for (let i = 0; i < allPendingItems.length; i += 2) {
      const member = allPendingItems[i];
      const score = allPendingItems[i + 1];
      
      try {
        const brandData = JSON.parse(member);
        const brandIndex = Math.floor(i / 2);
        if (pendingBrands[brandIndex]) {
          pendingBrands[brandIndex].score = score;
          pendingBrands[brandIndex].added_at = new Date();
          pendingBrands[brandIndex].brand_id = brandData.brand_id;
        }
      } catch (error) {
        logger.error("Error parsing watchlist pending brand item:", error);
      }
    }

    let filteredBrands = pendingBrands;
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      
      const normalizedSearchTerm = searchTerm.replace(/\s+/g, '');
      
      filteredBrands = pendingBrands.filter(brand => {
        const brandName = brand.brand_name?.toLowerCase() || '';
        const normalizedBrandName = brandName.replace(/\s+/g, '');
        
        return (
          brandName.includes(searchTerm) ||
          normalizedBrandName.includes(normalizedSearchTerm) ||
          brand.queue_id?.toString().includes(searchTerm) ||
          brand.page_id?.toString().includes(searchTerm)
        );
      });
    }

    const totalCount = filteredBrands.length;
    
    if (totalCount === 0) {
      return {
        brands: [],
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: 0,
          total_pages: 0,
        },
      };
    }

    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedBrands = filteredBrands.slice(startIndex, endIndex);

    return {
      brands: paginatedBrands,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: totalCount,
        total_pages: Math.ceil(totalCount / validLimit),
      },
    };
  } catch (error) {
    logger.error("Error in getWatchlistPendingBrands:", error);
    throw error;
  }
}

async function getWatchlistFailedBrands(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT,
  search = null,
  environment = 'production'
) {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.max(1, parseInt(limit));

    const watchlistRedis = getQueueRedis('watchlist', environment);
    const allFailedItems = await watchlistRedis.lrange(REDIS_KEYS.WATCHLIST.FAILED_BRANDS, 0, -1);
    
    const failedBrands = await enrichBrandsWithDBInfo(allFailedItems, false, environment);
    
    for (let i = 0; i < allFailedItems.length; i++) {
      try {
        const failedData = JSON.parse(allFailedItems[i]);
        if (failedBrands[i]) {
          failedBrands[i].added_at = new Date();
          failedBrands[i].brand_id = failedData.brand_id;
        }
      } catch (error) {
        logger.error("Error parsing watchlist failed brand item:", error);
      }
    }

    let filteredBrands = failedBrands;
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      
      const normalizedSearchTerm = searchTerm.replace(/\s+/g, '');
      
      filteredBrands = failedBrands.filter(brand => {
        const brandName = brand.brand_name?.toLowerCase() || '';
        const normalizedBrandName = brandName.replace(/\s+/g, '');
        
        return (
          brandName.includes(searchTerm) ||
          normalizedBrandName.includes(normalizedSearchTerm) ||
          brand.queue_id?.toString().includes(searchTerm) ||
          brand.page_id?.toString().includes(searchTerm)
        );
      });
    }

    const totalCount = filteredBrands.length;
    
    if (totalCount === 0) {
      return {
        brands: [],
        pagination: {
          current_page: validPage,
          per_page: validLimit,
          total_items: 0,
          total_pages: 0,
        },
      };
    }

    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedBrands = filteredBrands.slice(startIndex, endIndex);

    return {
      brands: paginatedBrands,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: totalCount,
        total_pages: Math.ceil(totalCount / validLimit),
      },
    };
  } catch (error) {
    logger.error("Error in getWatchlistFailedBrands:", error);
    throw error;
    }
}

async function getNextBrand(queueType = 'regular', environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    const redis = getQueueRedis(queueType, environment);
    const pendingQueueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;
    const failedQueueKey = REDIS_KEYS[queueType.toUpperCase()].FAILED_BRANDS;
    
    const queueRedis = getQueueRedis(queueType, environment);
    const allPendingItems = await queueRedis.zrange(pendingQueueKey, 0, -1, 'WITHSCORES');
    
    const priorityBrands = [];
    const regularBrands = [];
    
    for (let i = 0; i < allPendingItems.length; i += 2) {
      const member = allPendingItems[i];
      const score = allPendingItems[i + 1];
      
      if (score === '1') {
        priorityBrands.push({ member, score, index: i });
      } else if (score === '0') {
        regularBrands.push({ member, score, index: i });
      }
    }
    
    const nextBrands = [];
    let position = 1;
    
    for (let i = 0; i < Math.min(4, priorityBrands.length); i++) {
      const priorityBrand = priorityBrands[i];
      const enrichedBrand = await enrichBrandsWithDBInfo([priorityBrand.member, priorityBrand.score], true, environment);
      nextBrands.push({
        ...enrichedBrand[0],
        queue_position: position,
        is_next: position === 1,
        queue_type: "pending",
        priority: "high",
        queueType: queueType,
        note: `Priority brand #${position} to be scraped (${priorityBrands.length} priority brands in ${queueType} queue)`
      });
      position++;
    }
    
    if (nextBrands.length < 4 && regularBrands.length > 0) {
      const remainingSlots = 4 - nextBrands.length;
      for (let i = 0; i < Math.min(remainingSlots, regularBrands.length); i++) {
        const regularBrand = regularBrands[i];
        const enrichedBrand = await enrichBrandsWithDBInfo([regularBrand.member, regularBrand.score], true, environment);
        nextBrands.push({
          ...enrichedBrand[0],
          queue_position: position,
          is_next: position === 1,
          queue_type: "pending",
          priority: "normal",
          queueType: queueType,
          note: `Regular brand #${position} to be scraped (${regularBrands.length} regular brands in ${queueType} queue)`
        });
        position++;
      }
    }
    
    if (nextBrands.length < 4 && priorityBrands.length === 0 && regularBrands.length === 0) {
      const remainingSlots = 4 - nextBrands.length;
      const failedItems = await queueRedis.lrange(failedQueueKey, 0, remainingSlots - 1);
      
      for (let i = 0; i < failedItems.length; i++) {
        const enrichedBrand = await enrichBrandsWithDBInfo([failedItems[i]], false, environment);
        nextBrands.push({
          ...enrichedBrand[0],
          queue_position: position,
          is_next: position === 1,
          queue_type: "failed",
          priority: "failed",
          queueType: queueType,
          note: `Failed brand #${position} to be scraped (after all ${queueType} pending completes)`
        });
        position++;
      }
    }

    return nextBrands.length > 0 ? nextBrands : null;
  } catch (error) {
    logger.error(`Error in getNextBrand (${queueType}):`, error);
    throw error;
  }
}

async function getNextWatchlistBrand(environment = 'production') {
  try {
    return await getNextBrand('watchlist', environment);
  } catch (error) {
    logger.error("Error in getNextWatchlistBrand:", error);
    throw error;
  }
}

module.exports = {
  enrichBrandsWithDBInfo,
  getPendingBrands,
  getFailedBrands,
  getWatchlistBrands,
  getWatchlistPendingBrands,
  getWatchlistFailedBrands,
  getNextBrand,
  getNextWatchlistBrand,
};
