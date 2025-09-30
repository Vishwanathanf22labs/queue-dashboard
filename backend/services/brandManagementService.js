const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { QUEUES, BATCH_SIZE } = require("../config/constants");
const { Op } = require("sequelize");

// Function to get dynamic Redis keys
function getRedisKeys() {
  return require("../config/constants").REDIS_KEYS;
}

async function getExistingPageIds(queueType = 'regular') {
  const redis = getQueueRedis(queueType);
  const REDIS_KEYS = getRedisKeys();
  const queueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;
  const existingItems = await redis.zrange(queueKey, 0, -1, 'WITHSCORES');
  const existingPageIds = new Set();

  // existingItems is [member1, score1, member2, score2, ...]
  for (let i = 0; i < existingItems.length; i += 2) {
    try {
      const member = existingItems[i];
      if (!member) continue;
      
      const parsed = JSON.parse(member);
      existingPageIds.add(parsed.page_id);
    } catch (parseError) {
      logger.warn(`Failed to parse Redis item: ${parseError.message}`);
    }
  }

  return existingPageIds;
}

async function addSingleBrandToQueue(brandData, queueType = 'regular') {
  try {
    // Require Brand model dynamically to get the latest version
    const { Brand } = require("../models");
    const REDIS_KEYS = getRedisKeys();
    
    const { id, page_id, score } = brandData;

    if (!id || !page_id) {
      throw new Error("Both id and page_id are required");
    }

    const brandExists = await Brand.count({
      where: { page_id: page_id },
    });

    if (brandExists === 0) {
      throw new Error(`Brand with page_id ${page_id} not found in database`);
    }

    const existingPageIds = await getExistingPageIds(queueType);
    const alreadyExists = existingPageIds.has(page_id);

    if (alreadyExists) {
      throw new Error(
        `Brand with page_id ${page_id} already exists in ${queueType} pending queue`
      );
    }

    const queueItem = JSON.stringify({
      id,
      page_id
    });
    
    const redis = getQueueRedis(queueType);
    const queueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;
    
    // Use pipeline for consistency, even for single item
    const pipeline = redis.pipeline();
    // Add to sorted set with user-provided score (or default to 0)
    const queueScore = score !== undefined && score !== null ? score : 0;
    logger.info(`Adding brand to ${queueType} pending queue: ${JSON.stringify({ id, page_id, score: queueScore, queueItem })}`);
    pipeline.zadd(queueKey, queueScore, queueItem);
    await pipeline.exec();

    logger.info(`Added single brand to ${queueType} queue: ${page_id}`);

    return {
      success: true,
      message: `Brand added to ${queueType} pending queue successfully`,
      brand: { id, page_id },
      queue_type: queueType,
    };
  } catch (error) {
    logger.error(`Error in addSingleBrandToQueue (${queueType}):`, error);
    throw error;
  }
}

async function addBulkBrandsFromCSVToQueue(brandsData, queueType = 'regular') {
  try {
    // Require Brand model dynamically to get the latest version
    const { Brand } = require("../models");
    const REDIS_KEYS = getRedisKeys();
    
    if (!Array.isArray(brandsData) || brandsData.length === 0) {
      throw new Error("brandsData must be a non-empty array");
    }

    const results = {
      success: [],
      failed: [],
      skipped: [],
    };

    const existingPageIds = await getExistingPageIds(queueType);

    const pageIds = brandsData.map((b) => b.page_id);
    const existingBrands = await Brand.findAll({
      where: { page_id: { [Op.in]: pageIds } },
      attributes: ["page_id"],
      raw: true,
    });

    const existingPageIdsInDB = new Set(existingBrands.map((b) => b.page_id));

    const redis = getQueueRedis(queueType);
    const queueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;
    const pipeline = redis.pipeline();
    let addedCount = 0;

    for (const brandData of brandsData) {
      try {
        const { id, page_id, score } = brandData;

        if (!id || !page_id) {
          results.failed.push({
            brand: brandData,
            reason: "Both id and page_id are required",
          });
          continue;
        }

        if (existingPageIds.has(page_id)) {
          results.skipped.push({
            brand: brandData,
            reason: `Already exists in ${queueType} pending queue`,
          });
          continue;
        }

        if (!existingPageIdsInDB.has(page_id)) {
          results.failed.push({
            brand: brandData,
            reason: `Brand with page_id ${page_id} not found in database`,
          });
          continue;
        }

        const queueItem = JSON.stringify({
          id,
          page_id
        });
        // Add to sorted set with user-provided score (or default to 0)
        const queueScore = score !== undefined && score !== null ? parseFloat(score) : 0;
        pipeline.zadd(queueKey, queueScore, queueItem);

        existingPageIds.add(page_id);
        results.success.push({ id, page_id });
        addedCount++;
      } catch (error) {
        results.failed.push({
          brand: brandData,
          reason: error.message,
        });
      }
    }

    // Execute all Redis operations in batch
    if (addedCount > 0) {
      await pipeline.exec();
    }

    logger.info(
      `Bulk add completed (${queueType}): ${results.success.length} success, ${results.failed.length} failed, ${results.skipped.length} skipped`
    );

    return {
      success: true,
      message: `Bulk operation completed for ${queueType} queue`,
      results: {
        total_processed: brandsData.length,
        success_count: results.success.length,
        failed_count: results.failed.length,
        skipped_count: results.skipped.length,
        details: results,
      },
      queue_type: queueType,
    };
  } catch (error) {
    logger.error(`Error in addBulkBrandsToQueue (${queueType}):`, error);
    throw error;
  }
}

async function addAllBrandsToQueue(statusFilter = null, queueType = 'regular') {
  try {
    // Require Brand model dynamically to get the latest version
    const { Brand } = require("../models");
    
    // Build where clause
    const whereClause = {
      page_id: {
        [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }],
      },
    };

    let allBrands;
    let filterMessage = '';

    // Handle different filter types
    if (statusFilter === 'watchlist_active') {
      // Optimized query using EXISTS subquery for better performance
      allBrands = await Brand.findAll({
        where: {
          ...whereClause,
          status: 'Active',
          id: {
            [Op.in]: Brand.sequelize.literal(`(SELECT DISTINCT brand_id FROM watch_lists)`)
          }
        },
        attributes: ["id", "page_id"],
        raw: true,
      });
      filterMessage = 'watchlist active';
    } else if (statusFilter === 'watchlist_inactive') {
      // Optimized query using EXISTS subquery for better performance
      allBrands = await Brand.findAll({
        where: {
          ...whereClause,
          status: 'Inactive',
          id: {
            [Op.in]: Brand.sequelize.literal(`(SELECT DISTINCT brand_id FROM watch_lists)`)
          }
        },
        attributes: ["id", "page_id"],
        raw: true,
      });
      filterMessage = 'watchlist inactive';
    } else if (statusFilter === 'watchlist_all') {
      // All watchlist brands (both active and inactive)
      allBrands = await Brand.findAll({
        where: {
          ...whereClause,
          id: {
            [Op.in]: Brand.sequelize.literal(`(SELECT DISTINCT brand_id FROM watch_lists)`)
          }
        },
        attributes: ["id", "page_id"],
        raw: true,
      });
      filterMessage = 'all watchlist brands';
    } else if (statusFilter === 'regular_active') {
      // Regular active brands (not in watchlist)
      allBrands = await Brand.findAll({
        where: {
          ...whereClause,
          status: 'Active',
          id: {
            [Op.notIn]: Brand.sequelize.literal(`(SELECT DISTINCT brand_id FROM watch_lists)`)
          }
        },
        attributes: ["id", "page_id"],
        raw: true,
      });
      filterMessage = 'regular active brands';
    } else if (statusFilter === 'regular_inactive') {
      // Regular inactive brands (not in watchlist)
      allBrands = await Brand.findAll({
        where: {
          ...whereClause,
          status: 'Inactive',
          id: {
            [Op.notIn]: Brand.sequelize.literal(`(SELECT DISTINCT brand_id FROM watch_lists)`)
          }
        },
        attributes: ["id", "page_id"],
        raw: true,
      });
      filterMessage = 'regular inactive brands';
    } else if (statusFilter === 'regular_all') {
      // All regular brands (both active and inactive, not in watchlist)
      allBrands = await Brand.findAll({
        where: {
          ...whereClause,
          id: {
            [Op.notIn]: Brand.sequelize.literal(`(SELECT DISTINCT brand_id FROM watch_lists)`)
          }
        },
        attributes: ["id", "page_id"],
        raw: true,
      });
      filterMessage = 'all regular brands';
    } else {
      // Original logic for 'Active', 'Inactive', or null
      if (statusFilter && ['Active', 'Inactive'].includes(statusFilter)) {
        whereClause.status = statusFilter;
        filterMessage = statusFilter.toLowerCase();
      } else {
        filterMessage = '';
      }

      allBrands = await Brand.findAll({
        where: whereClause,
        attributes: ["id", "page_id"],
        raw: true,
      });
    }

    if (allBrands.length === 0) {
      return {
        success: true,
        message: `No ${filterMessage ? filterMessage : 'all'} brands found in database`,
        results: {
          total_brands: 0,
          added_count: 0,
          skipped_count: 0,
        },
        queue_type: queueType,
      };
    }

    const existingPageIds = await getExistingPageIds(queueType);
    const REDIS_KEYS = getRedisKeys();

    let addedCount = 0;
    let skippedCount = 0;

    const batchSize = BATCH_SIZE;
    const totalBrands = allBrands.length;
    const redis = getQueueRedis(queueType);
    const queueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;

    for (let i = 0; i < totalBrands; i += batchSize) {
      const batch = allBrands.slice(i, i + batchSize);
      const pipeline = redis.pipeline();

      for (const brand of batch) {
        if (!existingPageIds.has(brand.page_id)) {
          const queueItem = JSON.stringify({
            id: brand.id,
            page_id: brand.page_id
          });
          // Add to sorted set with priority score based on filter type
          let priorityScore = 0; // Default score for regular operations
          if (statusFilter === 'watchlist_active' || statusFilter === 'watchlist_inactive' || queueType === 'watchlist') {
            priorityScore = 1; // Higher priority for all watchlist operations
          }
          pipeline.zadd(queueKey, priorityScore, queueItem);
          existingPageIds.add(brand.page_id);
          addedCount++;
        } else {
          skippedCount++;
        }
      }

      await pipeline.exec();
    }

    logger.info(
      `Added ${filterMessage ? filterMessage : 'all'} brands to ${queueType} queue: ${addedCount} added, ${skippedCount} skipped`
    );

    return {
      success: true,
      message: `${filterMessage ? filterMessage.charAt(0).toUpperCase() + filterMessage.slice(1) : 'All'} brands operation completed for ${queueType} queue`,
      results: {
        total_brands: totalBrands,
        added_count: addedCount,
        skipped_count: skippedCount,
      },
      queue_type: queueType,
    };
  } catch (error) {
    logger.error(`Error in addAllBrandsToQueue (${queueType}):`, error);
    throw error;
  }
}

async function searchBrands(query, limit = 8) {
  try {
    // Require models dynamically to get the latest version
    const { Brand, WatchList } = require("../models");
    
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchQuery = query.trim();
    
    // Normalize search query: remove extra spaces, convert to lowercase for flexible matching
    const normalizedQuery = searchQuery.replace(/\s+/g, ' ').trim();
    
    // Create comprehensive search variations
    const searchVariations = [
      // Original variations
      searchQuery,
      normalizedQuery,
      searchQuery.toLowerCase(),
      normalizedQuery.toLowerCase(),
      
      // Space variations
      searchQuery.replace(/\s+/g, ''), // Remove all spaces
      searchQuery.replace(/\s+/g, '').toLowerCase(),
    ];
    
    // Intelligent compound word detection - works for any brand name
    if (searchQuery.length > 4 && !searchQuery.includes(' ')) {
      // First, try to find existing brands that start with the search query
      // This helps us understand common word patterns in your actual brand names
      const existingBrands = await Brand.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.iLike]: `${searchQuery}%` } },
            { actual_name: { [Op.iLike]: `${searchQuery}%` } }
          ]
        },
        attributes: ["name", "actual_name"],
        limit: 20,
        raw: true,
      });
      
      // Extract common prefixes and suffixes from existing brands
      const commonPrefixes = new Set();
      const commonSuffixes = new Set();
      
      existingBrands.forEach(brand => {
        const name = (brand.actual_name || brand.name || '').toLowerCase();
        if (name.length > searchQuery.length) {
          const remaining = name.slice(searchQuery.length);
          if (remaining.length > 2) {
            // Check if the remaining part is a common word pattern
            if (remaining.match(/^[a-z]+$/)) {
              commonSuffixes.add(remaining);
            }
          }
        }
      });
      
      // Also check for brands that contain the search query as a suffix
      const suffixBrands = await Brand.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.iLike]: `%${searchQuery}` } },
            { actual_name: { [Op.iLike]: `%${searchQuery}` } }
          ]
        },
        attributes: ["name", "actual_name"],
        limit: 20,
        raw: true,
      });
      
      suffixBrands.forEach(brand => {
        const name = (brand.actual_name || brand.name || '').toLowerCase();
        if (name.length > searchQuery.length) {
          const remaining = name.slice(0, name.length - searchQuery.length);
          if (remaining.length > 2) {
            if (remaining.match(/^[a-z]+$/)) {
              commonPrefixes.add(remaining);
            }
          }
        }
      });
      
      // Generate variations based on discovered patterns
      [...commonPrefixes, ...commonSuffixes].forEach(word => {
        // Check if the search query starts with this discovered word
        if (searchQuery.toLowerCase().startsWith(word.toLowerCase())) {
          const remaining = searchQuery.slice(word.length);
          if (remaining.length > 2) {
            const spacedVersion = word + ' ' + remaining;
            searchVariations.push(
              spacedVersion,
              spacedVersion.toLowerCase(),
              spacedVersion.toUpperCase(),
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() + ' ' + remaining
            );
          }
        }
        
        // Check if the search query ends with this discovered word
        if (searchQuery.toLowerCase().endsWith(word.toLowerCase())) {
          const remaining = searchQuery.slice(0, searchQuery.length - word.length);
          if (remaining.length > 2) {
            const spacedVersion = remaining + ' ' + word;
            searchVariations.push(
              spacedVersion,
              spacedVersion.toLowerCase(),
              spacedVersion.toUpperCase(),
              remaining + ' ' + word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            );
          }
        }
      });
      
      // Fallback: Intelligent space insertion at common positions
      if (searchQuery.length > 6) {
        // Try spaces at positions 3, 4, 5, etc. (avoiding very short words)
        for (let i = 3; i < Math.min(searchQuery.length - 2, 8); i++) {
          const spacedVersion = searchQuery.slice(0, i) + ' ' + searchQuery.slice(i);
          searchVariations.push(
            spacedVersion,
            spacedVersion.toLowerCase(),
            spacedVersion.toUpperCase()
          );
        }
      }
    }
    
    // Add space variations for single words (like "commesi" -> "comme si")
    if (searchQuery.length > 3) {
      // camelCase to space
      searchVariations.push(searchQuery.replace(/([a-z])([A-Z])/g, '$1 $2'));
      searchVariations.push(searchQuery.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
      
      // Try adding spaces between characters for compound words
      if (searchQuery.length > 4) {
        searchVariations.push(searchQuery.replace(/([a-z])([a-z])([A-Z])/g, '$1$2 $3'));
        searchVariations.push(searchQuery.replace(/([a-z])([a-z])([A-Z])/g, '$1$2 $3').toLowerCase());
      }
    }
    
    // Remove duplicates and empty strings
    const uniqueVariations = [...new Set(searchVariations)].filter(v => v && v.trim().length > 0);
    

    // First, check if there are any brands in the database
    await Brand.count();
    

    // Try the complex search first
    let brands;
    try {
      // Create search conditions for all variations
      const searchConditions = [];
      
      // Check if query is numeric (for page_id or brand_id search)
      const isNumericQuery = /^\d+$/.test(searchQuery);
      
      if (isNumericQuery) {
        // If query is numeric, search by page_id and brand_id
        searchConditions.push(
          { page_id: searchQuery }, // Keep as string for page_id
          { id: parseInt(searchQuery) }
        );
        
        // Also search by the numeric query in name and actual_name columns
        searchConditions.push(
          {
            name: {
              [Op.iLike]: `%${searchQuery}%`
            },
          },
          {
            actual_name: {
              [Op.iLike]: `%${searchQuery}%`
            },
          }
        );
      }
      
      uniqueVariations.forEach(variation => {
        searchConditions.push(
          {
            name: {
              [Op.or]: [
                { [Op.iLike]: variation },
                { [Op.iLike]: `${variation}%` },
                { [Op.iLike]: `%${variation}%` },
              ],
            },
          },
          {
            actual_name: {
              [Op.or]: [
                { [Op.iLike]: variation },
                { [Op.iLike]: `${variation}%` },
                { [Op.iLike]: `%${variation}%` },
              ],
            },
          }
        );
      });
      
      brands = await Brand.findAll({
        where: {
          [Op.or]: searchConditions,
        },
        attributes: ["id", "name", "actual_name", "page_id"],
        limit: limit,
        order: [
          // Prioritize exact matches (case-insensitive)
          [
            Brand.sequelize.literal(
              `CASE WHEN LOWER(name) = LOWER('${searchQuery}') OR LOWER(actual_name) = LOWER('${searchQuery}') THEN 0 ELSE 1 END`
            ),
            "ASC",
          ],
          // Prioritize starts-with matches (case-insensitive)
          [
            Brand.sequelize.literal(
              `CASE WHEN LOWER(name) LIKE LOWER('${searchQuery}%') OR LOWER(actual_name) LIKE LOWER('${searchQuery}%') THEN 0 ELSE 1 END`
            ),
            "ASC",
          ],
          // Prioritize contains matches (case-insensitive)
          [
            Brand.sequelize.literal(
              `CASE WHEN LOWER(name) LIKE LOWER('%${searchQuery}%') OR LOWER(actual_name) LIKE LOWER('%${searchQuery}%') THEN 0 ELSE 1 END`
            ),
            "ASC",
          ],
          // Prioritize space-normalized matches
          [
            Brand.sequelize.literal(
              `CASE WHEN LOWER(REPLACE(name, ' ', '')) = LOWER('${searchQuery.replace(/\s+/g, '')}') OR LOWER(REPLACE(actual_name, ' ', '')) = LOWER('${searchQuery.replace(/\s+/g, '')}') THEN 0 ELSE 1 END`
            ),
            "ASC",
          ],
          [Brand.sequelize.literal("LENGTH(name)"), "ASC"],
          ["name", "ASC"],
        ],
        raw: true,
      });
     } catch (searchError) {
      // Fallback to simple search with variations
      const simpleSearchConditions = [];
      
      // For numeric queries, add numeric search conditions to fallback too
      if (isNumericQuery) {
        simpleSearchConditions.push(
          { page_id: searchQuery }, // Keep as string for page_id
          { id: parseInt(searchQuery) },
          { name: { [Op.iLike]: `%${searchQuery}%` } },
          { actual_name: { [Op.iLike]: `%${searchQuery}%` } }
        );
      }
      
      uniqueVariations.forEach(variation => {
        simpleSearchConditions.push(
          { name: { [Op.iLike]: `%${variation}%` } },
          { actual_name: { [Op.iLike]: `%${variation}%` } }
        );
      });
      
      brands = await Brand.findAll({
        where: {
          [Op.or]: simpleSearchConditions,
        },
        attributes: ["id", "name", "actual_name", "page_id"],
        limit: limit,
        order: [["name", "ASC"]],
        raw: true,
      });
    }


        // Limit the number of results to avoid overwhelming the user
        const limitedBrands = brands.slice(0, limit);
        
        return limitedBrands.map((brand) => ({
          brand_id: brand.id,
          brand_name: brand.actual_name || brand.name, // Use actual_name if available, fallback to name
          page_id: brand.page_id,
        }));
  } catch (error) {
    logger.error("Error in searchBrands:", error);
    throw error;
  }
}

async function getBrandCountsByStatus() {
  try {
    // Require Brand model dynamically to get the latest version
    const { Brand } = require("../models");
    
    // Single optimized query using conditional aggregation for maximum performance
    const result = await Brand.sequelize.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'Inactive' THEN 1 END) as inactive,
        COUNT(CASE WHEN status = 'Active' AND id IN (SELECT DISTINCT brand_id FROM watch_lists) THEN 1 END) as watchlist_active,
        COUNT(CASE WHEN status = 'Inactive' AND id IN (SELECT DISTINCT brand_id FROM watch_lists) THEN 1 END) as watchlist_inactive,
        COUNT(CASE WHEN status = 'Active' AND id NOT IN (SELECT DISTINCT brand_id FROM watch_lists) THEN 1 END) as regular_active,
        COUNT(CASE WHEN status = 'Inactive' AND id NOT IN (SELECT DISTINCT brand_id FROM watch_lists) THEN 1 END) as regular_inactive,
        COUNT(CASE WHEN id IN (SELECT DISTINCT brand_id FROM watch_lists) THEN 1 END) as watchlist_all,
        COUNT(CASE WHEN id NOT IN (SELECT DISTINCT brand_id FROM watch_lists) THEN 1 END) as regular_all
      FROM brands 
      WHERE page_id IS NOT NULL AND page_id != ''
    `, {
      type: Brand.sequelize.QueryTypes.SELECT,
      raw: true
    });

    const counts = result[0];

    return {
      success: true,
      data: {
        total: parseInt(counts.total),
        active: parseInt(counts.active),
        inactive: parseInt(counts.inactive),
        watchlist_active: parseInt(counts.watchlist_active),
        watchlist_inactive: parseInt(counts.watchlist_inactive),
        regular_active: parseInt(counts.regular_active),
        regular_inactive: parseInt(counts.regular_inactive),
        watchlist_all: parseInt(counts.watchlist_all),
        regular_all: parseInt(counts.regular_all),
      },
    };
  } catch (error) {
    logger.error("Error in getBrandCountsByStatus:", error);
    throw error;
  }
}

module.exports = {
  addSingleBrandToQueue,
  addAllBrandsToQueue,
  addBulkBrandsToQueue: addBulkBrandsFromCSVToQueue,
  searchBrands,
  getBrandCountsByStatus
};
