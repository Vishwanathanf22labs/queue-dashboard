const redis = require("../config/redis");
const Brand = require("../models/Brand");
const logger = require("../utils/logger");
const { QUEUES, BATCH_SIZE } = require("../config/constants");
const { Op } = require("sequelize");

async function getExistingPageIds() {
  const existingItems = await redis.zrange(QUEUES.PENDING_BRANDS, 0, -1, 'WITHSCORES');
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

async function addSingleBrandToQueue(brandData) {
  try {
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

    const existingPageIds = await getExistingPageIds();
    const alreadyExists = existingPageIds.has(page_id);

    if (alreadyExists) {
      throw new Error(
        `Brand with page_id ${page_id} already exists in pending queue`
      );
    }

    const queueItem = JSON.stringify({
      id,
      page_id
    });
    // Use pipeline for consistency, even for single item
    const pipeline = redis.pipeline();
    // Add to sorted set with user-provided score (or default to 0)
    const queueScore = score !== undefined && score !== null ? score : 0;
    logger.info(`Adding brand to pending queue: ${JSON.stringify({ id, page_id, score: queueScore, queueItem })}`);
    pipeline.zadd(QUEUES.PENDING_BRANDS, queueScore, queueItem);
    await pipeline.exec();

    logger.info(`Added single brand to queue: ${page_id}`);

    return {
      success: true,
      message: "Brand added to pending queue successfully",
      brand: { id, page_id },
    };
  } catch (error) {
    logger.error("Error in addSingleBrandToQueue:", error);
    throw error;
  }
}

async function addBulkBrandsFromCSVToQueue(brandsData) {
  try {
    if (!Array.isArray(brandsData) || brandsData.length === 0) {
      throw new Error("brandsData must be a non-empty array");
    }

    const results = {
      success: [],
      failed: [],
      skipped: [],
    };

    const existingPageIds = await getExistingPageIds();

    const pageIds = brandsData.map((b) => b.page_id);
    const existingBrands = await Brand.findAll({
      where: { page_id: { [Op.in]: pageIds } },
      attributes: ["page_id"],
      raw: true,
    });

    const existingPageIdsInDB = new Set(existingBrands.map((b) => b.page_id));

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
            reason: "Already exists in pending queue",
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
        pipeline.zadd(QUEUES.PENDING_BRANDS, queueScore, queueItem);

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
      `Bulk add completed: ${results.success.length} success, ${results.failed.length} failed, ${results.skipped.length} skipped`
    );

    return {
      success: true,
      message: "Bulk operation completed",
      results: {
        total_processed: brandsData.length,
        success_count: results.success.length,
        failed_count: results.failed.length,
        skipped_count: results.skipped.length,
        details: results,
      },
    };
  } catch (error) {
    logger.error("Error in addBulkBrandsToQueue:", error);
    throw error;
  }
}

async function addAllBrandsToQueue(statusFilter = null) {
  try {
    // Build where clause
    const whereClause = {
      page_id: {
        [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }],
      },
    };

    // Add status filter if provided
    if (statusFilter && ['Active', 'Inactive'].includes(statusFilter)) {
      whereClause.status = statusFilter;
    }

    const allBrands = await Brand.findAll({
      where: whereClause,
      attributes: ["id", "page_id"],
      raw: true,
    });

    if (allBrands.length === 0) {
      return {
        success: true,
        message: `No ${statusFilter ? statusFilter.toLowerCase() : ''} brands found in database`,
        results: {
          total_brands: 0,
          added_count: 0,
          skipped_count: 0,
        },
      };
    }

    const existingPageIds = await getExistingPageIds();

    let addedCount = 0;
    let skippedCount = 0;

    const batchSize = BATCH_SIZE;
    const totalBrands = allBrands.length;

    for (let i = 0; i < totalBrands; i += batchSize) {
      const batch = allBrands.slice(i, i + batchSize);
      const pipeline = redis.pipeline();

      for (const brand of batch) {
        if (!existingPageIds.has(brand.page_id)) {
          const queueItem = JSON.stringify({
            id: brand.id,
            page_id: brand.page_id
          });
          // Add to sorted set with default score 0 (normal priority)
          const defaultScore = 0;
          pipeline.zadd(QUEUES.PENDING_BRANDS, defaultScore, queueItem);
          existingPageIds.add(brand.page_id);
          addedCount++;
        } else {
          skippedCount++;
        }
      }

      await pipeline.exec();
    }

    logger.info(
      `Added ${statusFilter ? statusFilter.toLowerCase() : 'all'} brands to queue: ${addedCount} added, ${skippedCount} skipped`
    );

    return {
      success: true,
      message: `${statusFilter ? statusFilter : 'All'} brands operation completed`,
      results: {
        total_brands: totalBrands,
        added_count: addedCount,
        skipped_count: skippedCount,
      },
    };
  } catch (error) {
    logger.error("Error in addAllBrandsToQueue:", error);
    throw error;
  }
}

async function searchBrands(query, limit = 8) {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchQuery = query.trim();

    // First, check if there are any brands in the database
    await Brand.count();

    // Try the complex search first
    let brands;
    try {
      brands = await Brand.findAll({
        where: {
          name: {
            [Op.or]: [
              { [Op.iLike]: searchQuery },
              { [Op.like]: searchQuery },
              { [Op.iLike]: `${searchQuery}%` },
              { [Op.like]: `${searchQuery}%` },
              { [Op.iLike]: `%${searchQuery}%` },
              { [Op.like]: `%${searchQuery}%` },
            ],
          },
        },
        attributes: ["id", "name", "page_id"],
        limit: limit,
        order: [
          [
            Brand.sequelize.literal(
              `CASE WHEN LOWER(name) = LOWER('${searchQuery}') THEN 0 ELSE 1 END`
            ),
            "ASC",
          ],
          [
            Brand.sequelize.literal(
              `CASE WHEN LOWER(name) LIKE LOWER('${searchQuery}%') THEN 0 ELSE 1 END`
            ),
            "ASC",
          ],
          [
            Brand.sequelize.literal(
              `CASE WHEN LOWER(name) LIKE LOWER('%${searchQuery}%') THEN 0 ELSE 1 END`
            ),
            "ASC",
          ],
          [Brand.sequelize.literal("LENGTH(name)"), "ASC"],
          ["name", "ASC"],
        ],
        raw: true,
      });
    } catch (searchError) {
      logger.info(
        "Complex search failed, trying simple search:",
        searchError.message
      );
      // Fallback to simple search
      brands = await Brand.findAll({
        where: {
          name: {
            [Op.like]: `%${searchQuery}%`,
          },
        },
        attributes: ["id", "name", "page_id"],
        limit: limit,
        order: [["name", "ASC"]],
        raw: true,
      });
    }

    logger.info(
      `Brand search completed for query "${searchQuery}": ${brands.length} results`
    );

    return brands.map((brand) => ({
      brand_id: brand.id,
      brand_name: brand.name,
      page_id: brand.page_id,
    }));
  } catch (error) {
    logger.error("Error in searchBrands:", error);
    throw error;
  }
}

async function getBrandCountsByStatus() {
  try {
    const [totalCount, activeCount, inactiveCount] = await Promise.all([
      Brand.count({
        where: {
          page_id: {
            [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }],
          },
        },
      }),
      Brand.count({
        where: {
          page_id: {
            [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }],
          },
          status: 'Active',
        },
      }),
      Brand.count({
        where: {
          page_id: {
            [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }],
          },
          status: 'Inactive',
        },
      }),
    ]);

    return {
      success: true,
      data: {
        total: totalCount,
        active: activeCount,
        inactive: inactiveCount,
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
