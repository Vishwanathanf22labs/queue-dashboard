  const redis = require("../config/redis");
const Brand = require("../models/Brand");
const WatchList = require("../models/WatchList");
const db = require("../config/database");
const logger = require("../utils/logger");
const { QUEUES, PAGINATION } = require("../config/constants");

async function enrichBrandsWithDBInfo(brandItems, isSortedSet = false) {
  const results = [];

  if (isSortedSet) {
    // For sorted sets with WITHSCORES, items come as [member1, score1, member2, score2, ...]
    for (let i = 0; i < brandItems.length; i += 2) {
      try {
        const member = brandItems[i];
        const score = brandItems[i + 1];
        
        if (!member) continue;
        
        const brandData = JSON.parse(member);
        const pageId = brandData.page_id;

        let brandInfo = {
          queue_id: brandData.id,
          page_id: pageId,
          brand_name: "Unknown",
          status: "Unknown",
          queue_position: results.length + 1
        };

        try {
          const brand = await Brand.findOne({
            where: { page_id: pageId },
            attributes: ["actual_name", "status"],
            raw: true,
          });

          if (brand) {
            brandInfo.brand_name = brand.actual_name || "Unknown";
            brandInfo.status = brand.status || "Unknown";
            logger.info(`Found brand for page_id ${pageId}: ${brand.actual_name}`);
          } else {
            logger.warn(`No brand found in database for page_id ${pageId}`);
          }
        } catch (dbError) {
          logger.error(
            `Error fetching brand info for page_id ${pageId}:`,
            dbError
          );
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

        let brandInfo = {
          queue_id: brandData.id,
          page_id: pageId,
          brand_name: "Unknown",
          status: "Unknown",
          queue_position: results.length + 1
        };

        try {
          const brand = await Brand.findOne({
            where: { page_id: pageId },
            attributes: ["actual_name", "status"],
            raw: true,
          });

          if (brand) {
            brandInfo.brand_name = brand.actual_name || "Unknown";
            brandInfo.status = brand.status || "Unknown";
            logger.info(`Found brand for page_id ${pageId}: ${brand.actual_name}`);
          } else {
            logger.warn(`No brand found in database for page_id ${pageId}`);
          }
        } catch (dbError) {
          logger.error(
            `Error fetching brand info for page_id ${pageId}:`,
            dbError
          );
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
  search = null
) {
  try {
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

    // If searching, we need to get ALL brands first to search through them
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      
          // Get ALL brands from the sorted set for searching
    const allBrandItems = await redis.zrange(QUEUES.PENDING_BRANDS, 0, -1, 'WITHSCORES');
    logger.info(`Raw Redis data for pending brands: ${JSON.stringify(allBrandItems)}`);
    const allEnrichedBrands = await enrichBrandsWithDBInfo(allBrandItems, true);
      
      // Filter brands based on search term
      const matchingBrands = allEnrichedBrands.filter(brand => 
        brand.brand_name?.toLowerCase().includes(searchTerm) ||
        brand.queue_id?.toString().includes(searchTerm) ||
        brand.page_id?.toString().includes(searchTerm)
      );
      
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
      };
    }

    // Normal pagination without search
    const totalCount = await redis.zcard(QUEUES.PENDING_BRANDS);
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
      };
    }

    // Get brands from sorted set
    const brandItems = await redis.zrange(
      QUEUES.PENDING_BRANDS,
      startIndex,
      endIndex,
      'WITHSCORES'
    );
    logger.info(`Raw Redis data for paginated pending brands: ${JSON.stringify(brandItems)}`);

    const enrichedBrands = await enrichBrandsWithDBInfo(brandItems, true);

    return {
      brands: enrichedBrands,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: totalCount,
        total_pages: Math.ceil(totalCount / validLimit),
      },
    };
  } catch (error) {
    logger.error("Error in getPendingBrands:", error);
    throw error;
  }
}

async function getFailedBrands(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT,
  search = null
) {
  try {
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

    // If searching, we need to get ALL brands first to search through them
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      
      // Get ALL brands from the queue for searching
      const allBrandItems = await redis.lrange(QUEUES.FAILED_BRANDS, 0, -1);
      const allEnrichedBrands = await enrichBrandsWithDBInfo(allBrandItems);
      
      // Filter brands based on search term
      const matchingBrands = allEnrichedBrands.filter(brand => 
        brand.brand_name?.toLowerCase().includes(searchTerm) ||
        brand.queue_id?.toString().includes(searchTerm) ||
        brand.page_id?.toString().includes(searchTerm)
      );
      
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
      };
    }

    // Normal pagination without search
    const totalCount = await redis.llen(QUEUES.FAILED_BRANDS);
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
      };
    }

    const brandItems = await redis.lrange(
      QUEUES.FAILED_BRANDS,
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
    };
  } catch (error) {
    logger.error("Error in getFailedBrands:", error);
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
      attributes: ['id', 'page_id', 'actual_name', 'status'],
      raw: true
    });

    logger.info(`Found ${watchlistBrands.length} brands with details`);

    // Get all brands from watchlist_pending_brands_prod queue with scores
    const allPendingItems = await redis.zrange(QUEUES.WATCHLIST_PENDING, 0, -1, 'WITHSCORES');
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
    const allFailedItems = await redis.lrange(QUEUES.WATCHLIST_FAILED, 0, -1);
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

      logger.info(`Brand ${pageId} (${brand.actual_name}) status: ${scraperStatus}`);

      const brandInfo = {
        queue_id: pendingBrandsMap.get(pageId)?.queue_id || null,
        page_id: pageId,
        brand_id: brand.id,
        brand_name: brand.actual_name || "Unknown",
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
    const allPendingItems = await redis.zrange(QUEUES.WATCHLIST_PENDING, 0, -1, 'WITHSCORES');
    
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
    const allFailedItems = await redis.lrange(QUEUES.WATCHLIST_FAILED, 0, -1);
    
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

async function getNextBrand() {
  try {
    // Priority Queue Logic: Score 1 = Priority, Score 0 = Regular
    // Return next 4 brands in order of processing
    
    // Get ALL brands from pending queue to find the next ones in correct order
    const allPendingItems = await redis.zrange(QUEUES.PENDING_BRANDS, 0, -1, 'WITHSCORES');
    
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
        note: `Priority brand #${position} to be scraped (${priorityBrands.length} priority brands in queue)`
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
          note: `Regular brand #${position} to be scraped (${regularBrands.length} regular brands in queue)`
        });
        position++;
      }
    }
    
    // If we still need more brands and no pending brands, check failed queue
    if (nextBrands.length < 4 && priorityBrands.length === 0 && regularBrands.length === 0) {
      const remainingSlots = 4 - nextBrands.length;
      const failedItems = await redis.lrange(QUEUES.FAILED_BRANDS, 0, remainingSlots - 1);
      
      for (let i = 0; i < failedItems.length; i++) {
        const enrichedBrand = await enrichBrandsWithDBInfo([failedItems[i]]);
        nextBrands.push({
          ...enrichedBrand[0],
          queue_position: position,
          is_next: position === 1,
          queue_type: "failed",
          priority: "failed",
          note: `Failed brand #${position} to be scraped (after all pending completes)`
        });
        position++;
      }
    }

    return nextBrands.length > 0 ? nextBrands : null;
  } catch (error) {
    logger.error("Error in getNextBrand:", error);
    throw error;
  }
}

async function getNextWatchlistBrand() {
  try {
    // Return next 4 watchlist brands in order of processing
    
    // Get ALL brands from watchlist pending queue to find the next ones in correct order
    const allWatchlistPendingItems = await redis.zrange(QUEUES.WATCHLIST_PENDING, 0, -1, 'WITHSCORES');
    
    const nextWatchlistBrands = [];
    let position = 1;
    
    // Add watchlist pending brands (these are already in priority order)
    for (let i = 0; i < Math.min(4, allWatchlistPendingItems.length / 2); i++) {
      const member = allWatchlistPendingItems[i * 2];
      const score = allWatchlistPendingItems[i * 2 + 1];
      
      const enrichedBrand = await enrichBrandsWithDBInfo([member, score], true);
      nextWatchlistBrands.push({
        ...enrichedBrand[0],
        queue_position: position,
        is_next: position === 1,
        queue_type: "watchlist_pending",
        priority: "watchlist",
        note: `Watchlist brand #${position} to be scraped (${allWatchlistPendingItems.length / 2} watchlist brands in queue)`
      });
      position++;
    }
    
    // If we need more brands and no watchlist pending brands, check watchlist failed queue
    if (nextWatchlistBrands.length < 4 && allWatchlistPendingItems.length === 0) {
      const remainingSlots = 4 - nextWatchlistBrands.length;
      const watchlistFailedItems = await redis.lrange(QUEUES.WATCHLIST_FAILED, 0, remainingSlots - 1);
      
      for (let i = 0; i < watchlistFailedItems.length; i++) {
        const enrichedBrand = await enrichBrandsWithDBInfo([watchlistFailedItems[i]]);
        nextWatchlistBrands.push({
          ...enrichedBrand[0],
          queue_position: position,
          is_next: position === 1,
          queue_type: "watchlist_failed",
          priority: "watchlist_failed",
          note: `Watchlist failed brand #${position} to be scraped (after all watchlist pending completes)`
        });
        position++;
      }
    }

    return nextWatchlistBrands.length > 0 ? nextWatchlistBrands : null;
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
