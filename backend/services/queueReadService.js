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

    // Get all brands from pending queue with scores
    const allPendingItems = await redis.zrange(QUEUES.PENDING_BRANDS, 0, -1, 'WITHSCORES');
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
        logger.error("Error parsing pending brand item:", error);
      }
    }

    // Get all failed brands
    const allFailedItems = await redis.lrange(QUEUES.FAILED_BRANDS, 0, -1);
    const failedPageIds = new Set();
    
    for (const failedItem of allFailedItems) {
      try {
        const failedData = JSON.parse(failedItem);
        failedPageIds.add(failedData.page_id);
      } catch (error) {
        logger.error("Error parsing failed brand item:", error);
      }
    }

    logger.info(`Pending page_ids: ${Array.from(pendingPageIds).join(', ')}`);
    logger.info(`Failed page_ids: ${Array.from(failedPageIds).join(', ')}`);

    // Process each watchlist brand and determine status
    let processedBrands = [];
    
    for (const brand of watchlistBrands) {
      const pageId = brand.page_id;
      
      // Determine scraper status based on your logic:
      // 1. In pending_brands = waiting
      // 2. Not in pending_brands but in failed_brands = failed  
      // 3. Not in pending_brands and not in failed_brands = completed
      
      let scraperStatus;
      
      if (pendingPageIds.has(pageId)) {
        // Brand is in pending queue = waiting
        scraperStatus = 'waiting';
      } else if (failedPageIds.has(pageId)) {
        // Brand is NOT in pending but IS in failed = failed
        scraperStatus = 'failed';
      } else {
        // Brand is NOT in pending and NOT in failed = completed
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

async function getNextBrand() {
  try {
    // Priority Queue Logic: Score 1 = Priority, Score 0 = Regular
    
    // Get ALL brands from pending queue to find the next one in correct order
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
    
    // First: Check priority brands (score = 1) - these are scraped first in FIFO order
    if (priorityBrands.length > 0) {
      // Get the first priority brand (oldest priority brand gets scraped first)
      const firstPriority = priorityBrands[0];
      const enrichedNext = await enrichBrandsWithDBInfo([firstPriority.member, firstPriority.score], true);
      return {
        ...enrichedNext[0],
        queue_position: 1,
        is_next: true,
        queue_type: "pending",
        priority: "high",
        note: `Next priority brand to be scraped (${priorityBrands.length} priority brands in queue)`
      };
    }
    
    // No priority brands, check regular brands (score = 0)
    if (regularBrands.length > 0) {
      // Get the first regular brand (oldest regular brand gets scraped first)
      const firstRegular = regularBrands[0];
      const enrichedNext = await enrichBrandsWithDBInfo([firstRegular.member, firstRegular.score], true);
      return {
        ...enrichedNext[0],
        queue_position: 1,
        is_next: true,
        queue_type: "pending",
        priority: "normal",
        note: `Next regular brand to be scraped (${regularBrands.length} regular brands in queue)`
      };
    }
    
    // No pending brands at all, check failed queue
    if (priorityBrands.length === 0 && regularBrands.length === 0) {
      const failedItems = await redis.lrange(QUEUES.FAILED_BRANDS, 0, 1);
      
      if (failedItems.length > 0) {
        // Next brand is from failed queue
        const enrichedNext = await enrichBrandsWithDBInfo([failedItems[0]]);
        return {
          ...enrichedNext[0],
          queue_position: 1,
          is_next: true,
          queue_type: "failed",
          priority: "failed",
          note: "Next brand from failed queue (after all pending completes)"
        };
      }
    }

    return null;
  } catch (error) {
    logger.error("Error in getNextBrand:", error);
    throw error;
  }
}

module.exports = {
  enrichBrandsWithDBInfo,
  getPendingBrands,
  getFailedBrands,
  getWatchlistBrands,
  getNextBrand,
};
