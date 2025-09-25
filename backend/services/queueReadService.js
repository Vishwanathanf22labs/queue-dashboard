const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const Brand = require("../models/Brand");
const WatchList = require("../models/WatchList");
const db = require("../config/database");
const logger = require("../utils/logger");
const { QUEUES, PAGINATION, REDIS_KEYS } = require("../config/constants");

async function enrichBrandsWithDBInfo(brandItems, isSortedSet = false) {
  const results = [];
  const pageIds = [];

  // First pass: collect all page IDs and parse Redis data
  if (isSortedSet) {
    // For sorted sets with WITHSCORES, items come as [member1, score1, member2, score2, ...]
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
    // For lists, items are just the members
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

  // Batch fetch all brand data from database in one query
  let brandMap = new Map();
  if (pageIds.length > 0) {
    try {
      const brands = await Brand.findAll({
        where: { page_id: pageIds },
        attributes: ["name", "actual_name", "status", "category", "page_id"],
        raw: true,
      });
      
      // Create a map for fast lookup
      brands.forEach(brand => {
        brandMap.set(brand.page_id, brand);
      });
    } catch (dbError) {
      logger.error("Error batch fetching brand info:", dbError);
    }
  }

  // Second pass: build results with batched data
  if (isSortedSet) {
    for (let i = 0; i < brandItems.length; i += 2) {
      try {
        const member = brandItems[i];
        const score = brandItems[i + 1];
        
        if (!member) continue;
        
        const brandData = JSON.parse(member);
        const pageId = brandData.page_id;

        // Handle page category from Redis data
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

        // Use batched data
        const brand = brandMap.get(pageId);
        if (brand) {
          brandInfo.brand_name = brand.actual_name || brand.name || "Unknown";
          brandInfo.status = brand.status || "Unknown";
          
          // If no page category from Redis data, use database category as fallback
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
    // For lists, items are just the members
    for (const item of brandItems) {
      try {
        const brandData = JSON.parse(item);
        const pageId = brandData.page_id;

        // Handle page category from Redis data
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

        // Use batched data
        const brand = brandMap.get(pageId);
        if (brand) {
          brandInfo.brand_name = brand.actual_name || brand.name || "Unknown";
          brandInfo.status = brand.status || "Unknown";
          
          // If no page category from Redis data, use database category as fallback
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
  queueType = 'regular' // 'regular' or 'watchlist'
) {
  try {
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

    // Get the appropriate Redis instance
    const redis = getQueueRedis(queueType);
    const queueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;

    // If searching, we need to get ALL brands first to search through them
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      
      // Get ALL brands from the sorted set for searching
      const queueRedis = getQueueRedis(queueType);
      const allBrandItems = await queueRedis.zrange(queueKey, 0, -1, 'WITHSCORES');
      logger.info(`Raw Redis data for ${queueType} pending brands: ${JSON.stringify(allBrandItems)}`);
      const allEnrichedBrands = await enrichBrandsWithDBInfo(allBrandItems, true);
      
      // Filter brands based on search term (flexible search)
      const normalizedSearchTerm = searchTerm.replace(/\s+/g, '');
      
      const matchingBrands = allEnrichedBrands.filter(brand => {
        const brandName = brand.brand_name?.toLowerCase() || '';
        const normalizedBrandName = brandName.replace(/\s+/g, '');
        
        return (
          // Original search (with spaces)
          brandName.includes(searchTerm) ||
          // Space-insensitive search
          normalizedBrandName.includes(normalizedSearchTerm) ||
          // ID searches
          brand.queue_id?.toString().includes(searchTerm) ||
          brand.page_id?.toString().includes(searchTerm)
        );
      });
      
      // Apply pagination to search results
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

    // Normal pagination without search
    const queueRedis = getQueueRedis(queueType);
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

    // Get brands from sorted set
    const brandItems = await queueRedis.zrange(
      queueKey,
      startIndex,
      endIndex,
      'WITHSCORES'
    );
    logger.info(`Raw Redis data for paginated ${queueType} pending brands: ${JSON.stringify(brandItems)}`);

    const enrichedBrands = await enrichBrandsWithDBInfo(brandItems, true);

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
  queueType = 'regular' // 'regular' or 'watchlist'
) {
  try {
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

    // Get the appropriate Redis instance
    const redis = getQueueRedis(queueType);
    const queueKey = REDIS_KEYS[queueType.toUpperCase()].FAILED_BRANDS;

    // If searching, we need to get ALL brands first to search through them
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      
      // Get ALL brands from the queue for searching
      const queueRedis = getQueueRedis(queueType);
      const allBrandItems = await queueRedis.lrange(queueKey, 0, -1);
      const allEnrichedBrands = await enrichBrandsWithDBInfo(allBrandItems);
      
      // Filter brands based on search term (flexible search)
      const normalizedSearchTerm = searchTerm.replace(/\s+/g, '');
      
      const matchingBrands = allEnrichedBrands.filter(brand => {
        const brandName = brand.brand_name?.toLowerCase() || '';
        const normalizedBrandName = brandName.replace(/\s+/g, '');
        
        return (
          // Original search (with spaces)
          brandName.includes(searchTerm) ||
          // Space-insensitive search
          normalizedBrandName.includes(normalizedSearchTerm) ||
          // ID searches
          brand.queue_id?.toString().includes(searchTerm) ||
          brand.page_id?.toString().includes(searchTerm)
        );
      });
      
      // Apply pagination to search results
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

    // Normal pagination without search
    const queueRedis = getQueueRedis(queueType);
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

    const enrichedBrands = await enrichBrandsWithDBInfo(brandItems);

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
  userId = null
) {
  try {
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.max(1, parseInt(limit));

    // Get all watchlist brands from database (without duplicates)
    // First, get unique brand_ids from WatchList table
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

    // Extract brand IDs and get brand details
    const brandIds = uniqueWatchlistBrandIds.map(item => item.brand_id);
    const watchlistBrands = await Brand.findAll({
      where: { id: brandIds },
      attributes: ['id', 'page_id', 'name', 'actual_name', 'status'],
      raw: true
    });

    logger.info(`Found ${watchlistBrands.length} brands with details`);

    // Get all brands from watchlist_pending_brands_prod queue with scores
    const watchlistRedis = getQueueRedis('watchlist');
    const allPendingItems = await watchlistRedis.zrange(REDIS_KEYS.WATCHLIST.PENDING_BRANDS, 0, -1, 'WITHSCORES');
    const pendingPageIds = new Set();
    const pendingBrandsMap = new Map(); // page_id -> brand data

    // Process pending brands
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

    // Get all failed brands from watchlist_failed_brands_prod queue
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

    // Process each watchlist brand and determine status
    let processedBrands = [];
    
    for (const brand of watchlistBrands) {
      const pageId = brand.page_id;
      
      // Determine scraper status based on your logic:
      // 1. In watchlist_pending_brands_prod = waiting
      // 2. Not in watchlist_pending_brands_prod but in watchlist_failed_brands_prod = failed  
      // 3. Not in watchlist_pending_brands_prod and not in watchlist_failed_brands_prod = completed
      
      let scraperStatus;
      
      if (pendingPageIds.has(pageId)) {
        // Brand is in watchlist_pending_brands_prod queue = waiting
        scraperStatus = 'waiting';
      } else if (failedPageIds.has(pageId)) {
        // Brand is NOT in watchlist_pending_brands_prod but IS in watchlist_failed_brands_prod = failed
        scraperStatus = 'failed';
      } else {
        // Brand is NOT in watchlist_pending_brands_prod and NOT in watchlist_failed_brands_prod = completed
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
        added_at: new Date() // Since we don't have watchlist creation time anymore
      };

      processedBrands.push(brandInfo);
    }

    // Apply search filter if provided
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

    // Apply pagination
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
  search = null
) {
  try {
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.max(1, parseInt(limit));

    // Get all brands from watchlist_pending_brands_prod queue
    const watchlistRedis = getQueueRedis('watchlist');
    const allPendingItems = await watchlistRedis.zrange(REDIS_KEYS.WATCHLIST.PENDING_BRANDS, 0, -1, 'WITHSCORES');
    
    // Use the same enrichment function as regular pending brands
    const pendingBrands = await enrichBrandsWithDBInfo(allPendingItems, true);
    
    // Add score and other watchlist-specific fields
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

    // Apply search filter if provided
    let filteredBrands = pendingBrands;
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      filteredBrands = pendingBrands.filter(brand => 
        brand.brand_name?.toLowerCase().includes(searchTerm) ||
        brand.page_id?.toString().includes(searchTerm) ||
        brand.brand_id?.toString().includes(searchTerm)
      );
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

    // Apply pagination
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
  search = null
) {
  try {
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.max(1, parseInt(limit));

    // Get all brands from watchlist_failed_brands_prod queue
    const watchlistRedis = getQueueRedis('watchlist');
    const allFailedItems = await watchlistRedis.lrange(REDIS_KEYS.WATCHLIST.FAILED_BRANDS, 0, -1);
    
    // Use the same enrichment function as regular failed brands
    const failedBrands = await enrichBrandsWithDBInfo(allFailedItems, false);
    
    // Add watchlist-specific fields
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

    // Apply search filter if provided
    let filteredBrands = failedBrands;
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      filteredBrands = failedBrands.filter(brand => 
        brand.brand_name?.toLowerCase().includes(searchTerm) ||
        brand.page_id?.toString().includes(searchTerm) ||
        brand.brand_id?.toString().includes(searchTerm)
      );
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

    // Apply pagination
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

async function getNextBrand(queueType = 'regular') {
  try {
    // Priority Queue Logic: Score 1 = Priority, Score 0 = Regular
    // Return next 4 brands in order of processing
    
    // Get the appropriate Redis instance
    const redis = getQueueRedis(queueType);
    const pendingQueueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;
    const failedQueueKey = REDIS_KEYS[queueType.toUpperCase()].FAILED_BRANDS;
    
    // Get ALL brands from pending queue to find the next ones in correct order
    const queueRedis = getQueueRedis(queueType);
    const allPendingItems = await queueRedis.zrange(pendingQueueKey, 0, -1, 'WITHSCORES');
    
    // Separate priority and regular brands
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
    
    // First: Add priority brands (score = 1) - these are scraped first in FIFO order
    for (let i = 0; i < Math.min(4, priorityBrands.length); i++) {
      const priorityBrand = priorityBrands[i];
      const enrichedBrand = await enrichBrandsWithDBInfo([priorityBrand.member, priorityBrand.score], true);
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
    
    // If we need more brands and have regular brands, add them
    if (nextBrands.length < 4 && regularBrands.length > 0) {
      const remainingSlots = 4 - nextBrands.length;
      for (let i = 0; i < Math.min(remainingSlots, regularBrands.length); i++) {
        const regularBrand = regularBrands[i];
        const enrichedBrand = await enrichBrandsWithDBInfo([regularBrand.member, regularBrand.score], true);
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
    
    // If we still need more brands and no pending brands, check failed queue
    if (nextBrands.length < 4 && priorityBrands.length === 0 && regularBrands.length === 0) {
      const remainingSlots = 4 - nextBrands.length;
      const failedItems = await queueRedis.lrange(failedQueueKey, 0, remainingSlots - 1);
      
      for (let i = 0; i < failedItems.length; i++) {
        const enrichedBrand = await enrichBrandsWithDBInfo([failedItems[i]]);
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

async function getNextWatchlistBrand() {
  try {
    // Use the new getNextBrand function with watchlist queue type
    return await getNextBrand('watchlist');
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
