const { globalRedis } = require("../config/redis");
const logger = require("../utils/logger");
const { PAGINATION } = require("../config/constants");

// Function to get dynamic models (ensures fresh database connection)
function getModels() {
  return require("../models");
}

// Function to get dynamic Redis keys
function getRedisKeys(environment = null) {
  const { getRedisKeys } = require("../config/constants");
  return getRedisKeys(environment);
}

/**
 * Get reenqueue data from global Redis
 * Format: {"id":"7245","page_id":"1234567890","coverage":"45/50","namespace":"watchlist"}
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {string|null} search - Search term
 * @param {string|null} namespace - Filter by namespace ('watchlist' or 'non-watchlist')
 * @returns {Object} - Reenqueue items with pagination
 */
async function getReenqueueData(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT,
  search = null,
  namespace = null,
  environment = 'production'
) {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const reenqueueKey = REDIS_KEYS.GLOBAL.REENQUEUE_KEY;
    
    if (!reenqueueKey) {
      logger.warn("REENQUEUE_KEY is not configured in environment");
      return {
        items: [],
        pagination: {
          current_page: page,
          per_page: limit,
          total_items: 0,
          total_pages: 0,
        },
      };
    }

    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.max(1, parseInt(limit));

    // Get environment-specific Redis connection
    const { getGlobalRedis } = require("../utils/redisSelector");
    const redis = getGlobalRedis(environment);
    
    // Check if Redis connection is alive and reconnect if needed
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      logger.warn(`Global Redis connection status: ${redis.status}, attempting to reconnect...`);
      try {
        // If connection is closed, try to reconnect
        if (redis.status === 'close' || redis.status === 'end') {
          await redis.connect();
          logger.info(`Global Redis [${environment}] reconnected successfully`);
        } else {
          // For other statuses, wait a bit and check again
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (redis.status !== 'ready') {
            throw new Error(`Redis connection is not ready (status: ${redis.status})`);
          }
        }
      } catch (reconnectError) {
        logger.error("Failed to reconnect to Global Redis:", reconnectError);
        throw new Error("Redis connection is not available");
      }
    }

    // Get all items from the reenqueue list
    const allItems = await redis.lrange(reenqueueKey, 0, -1);
    
    // Parse all items and collect page IDs
    const parsedItems = [];
    const pageIds = [];
    
    // First pass: collect all IDs and parse items
    const itemIds = [];
    for (const item of allItems) {
      try {
        const parsed = JSON.parse(item);
        const itemNamespace = parsed.namespace;
        
        // Filter by namespace if specified
        if (namespace) {
          if (itemNamespace !== namespace) {
            continue; // Skip items that don't match the namespace filter
          }
        }
        
        if (parsed.id) {
          itemIds.push(parsed.id);
        }
        
        parsedItems.push({
          id: parsed.id || null,
          page_id: parsed.page_id || parsed.pageId || null, // Handle both field names
          coverage: parsed.coverage || null, // Format: "45/50"
          namespace: itemNamespace || "unknown",
          brand_name: "Unknown", // Will be filled from database
        });
      } catch (error) {
        logger.error("Error parsing reenqueue item:", error, "Item:", item);
      }
    }

    // If we have IDs but no page_ids, fetch page_ids from database
    if (itemIds.length > 0 && parsedItems.some(item => !item.page_id)) {
      try {
        const { getModels } = require("../models");
        const { Brand } = getModels(environment); // Use environment-specific model
        const brands = await Brand.findAll({
          where: { id: itemIds },
          attributes: ["id", "page_id"],
          raw: true,
        });
        
        // Create a map for fast lookup
        const brandMap = new Map();
        brands.forEach(brand => {
          brandMap.set(brand.id, brand.page_id);
        });
        
        // Update parsedItems with page_ids from database
        parsedItems.forEach(item => {
          if (!item.page_id && item.id) {
            const pageId = brandMap.get(item.id);
            if (pageId) {
              item.page_id = pageId;
            }
          }
        });
      } catch (dbError) {
        logger.error("Error fetching page_ids for reenqueue items:", dbError);
      }
    }

    // Collect page IDs for brand name lookup
    parsedItems.forEach(item => {
      if (item.page_id) {
        pageIds.push(item.page_id);
      }
    });

    // Batch fetch brand names from database
    if (pageIds.length > 0) {
      try {
        const { getModels } = require("../models");
        const { Brand } = getModels(environment); // Use environment-specific model
        const brands = await Brand.findAll({
          where: { page_id: pageIds },
          attributes: ["name", "actual_name", "page_id"],
          raw: true,
        });
        
        // Create a map for fast lookup
        const brandMap = new Map();
        brands.forEach(brand => {
          brandMap.set(brand.page_id, brand);
        });
        
        // Enrich parsed items with brand names
        parsedItems.forEach(item => {
          const brand = brandMap.get(item.page_id);
          if (brand) {
            item.brand_name = brand.actual_name || brand.name || "Unknown";
          }
        });
      } catch (dbError) {
        logger.error("Error fetching brand names for reenqueue:", dbError);
      }
    }

    // Apply search filter if provided
    let filteredItems = parsedItems;
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      filteredItems = parsedItems.filter(item => {
        return (
          item.id?.toString().includes(searchTerm) ||
          item.page_id?.toString().includes(searchTerm) ||
          item.brand_name?.toLowerCase().includes(searchTerm)
        );
      });
    }

    // Apply pagination
    const totalCount = filteredItems.length;
    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedItems = filteredItems.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: totalCount,
        total_pages: Math.ceil(totalCount / validLimit),
      },
    };
  } catch (error) {
    logger.error("Error fetching reenqueue data:", error);
    
    // If it's a Redis connection error, return empty data instead of throwing
    if (error.message === "Connection is closed." || error.message.includes("Connection is closed")) {
      logger.warn("Redis connection is closed, returning empty reenqueue data");
      return {
        items: [],
        pagination: {
          current_page: page,
          per_page: limit,
          total_items: 0,
          total_pages: 0,
        },
      };
    }
    
    throw error;
  }
}

module.exports = {
  getReenqueueData,
};
