const redis = require("../config/redis");
const Brand = require("../models/Brand");
const logger = require("../utils/logger");
const { QUEUES, PAGINATION } = require("../config/constants");

async function enrichBrandsWithDBInfo(brandItems) {
  const results = [];

  for (const item of brandItems) {
    try {
      const brandData = JSON.parse(item);
      const pageId = brandData.page_id;

      let brandInfo = {
        queue_id: brandData.id,
        page_id: pageId,
        brand_name: "Unknown",
        status: "Unknown",
        queue_position: brandItems.indexOf(item) + 1,
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

  return results;
}

async function getPendingBrands(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT
) {
  try {
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

    const totalCount = await redis.llen(QUEUES.PENDING_BRANDS);
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
      QUEUES.PENDING_BRANDS,
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
    logger.error("Error in getPendingBrands:", error);
    throw error;
  }
}

async function getFailedBrands(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT
) {
  try {
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

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

async function getNextBrand() {
  try {
    // First Priority: Check pending_brands queue
    const pendingItems = await redis.lrange(QUEUES.PENDING_BRANDS, 0, 2);
    
    if (pendingItems.length >= 2) {
      // Get second item from pending queue
      const enrichedNext = await enrichBrandsWithDBInfo([pendingItems[1]]);
      return {
        ...enrichedNext[0],
        queue_position: 2,
        is_next: true,
        queue_type: "pending"
      };
    }
    
    if (pendingItems.length === 1) {
      // Only one pending brand, check failed queue for next
      const failedItems = await redis.lrange(QUEUES.FAILED_BRANDS, 0, 1);
      
      if (failedItems.length > 0) {
        // Next brand is from failed queue
        const enrichedNext = await enrichBrandsWithDBInfo([failedItems[0]]);
        return {
          ...enrichedNext[0],
          queue_position: 1,
          is_next: true,
          queue_type: "failed",
          note: "Next brand from failed queue (after pending completes)"
        };
      }
      
      // No failed brands, this is the last brand
      return null;
    }
    
    // No pending brands, check failed queue
    if (pendingItems.length === 0) {
      const failedItems = await redis.lrange(QUEUES.FAILED_BRANDS, 0, 2);
      
      if (failedItems.length >= 2) {
        // Get second item from failed queue
        const enrichedNext = await enrichBrandsWithDBInfo([failedItems[1]]);
        return {
          ...enrichedNext[0],
          queue_position: 2,
          is_next: true,
          queue_type: "failed"
        };
      }
      
      if (failedItems.length === 1) {
        // Only one failed brand
        const enrichedNext = await enrichBrandsWithDBInfo([failedItems[0]]);
        return {
          ...enrichedNext[0],
          queue_position: 1,
          is_next: true,
          queue_type: "failed"
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
  getNextBrand,
};
