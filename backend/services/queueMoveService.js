const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

function getRedisKeys(environment = 'production') {
  return require("../config/constants").getRedisKeys(environment);
}

async function movePendingToFailed(queueId, queueType = "regular", environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info(
      `Moving brand with queue ID ${queueId} from ${queueType} pending to failed queue`
    );

    const redis = getQueueRedis(queueType, environment);
    const pendingQueueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;
    const failedQueueKey = REDIS_KEYS[queueType.toUpperCase()].FAILED_BRANDS;

    const pendingBrands = await redis.zrange(
      pendingQueueKey,
      0,
      -1,
      "WITHSCORES"
    );

    let brandToMove = null;
    let brandMember = null;

    for (let i = 0; i < pendingBrands.length; i += 2) {
      try {
        const member = pendingBrands[i];
        const score = pendingBrands[i + 1];

        if (!member) continue;

        const brandData = JSON.parse(member);
        if (brandData.id === queueId) {
          brandToMove = brandData;
          brandMember = member;
          break;
        }
      } catch (parseError) {
        logger.error(`Error parsing brand data:`, parseError);
      }
    }

    if (!brandMember) {
      throw new Error(
        `Brand with queue ID ${queueId} not found in ${queueType} pending queue`
      );
    }

    await redis.zrem(pendingQueueKey, brandMember);

    const failedBrandData = {
      id: brandToMove.id || brandToMove.brand_id || brandToMove.queue_id,
      page_id: brandToMove.page_id,
    };

    await redis.lpush(failedQueueKey, JSON.stringify(failedBrandData));

    logger.info(
      `Successfully moved brand ${
        brandToMove?.brand_name || queueId
      } from ${queueType} pending to failed queue`
    );

    return {
      moved_brand: failedBrandData,
      queue_id: queueId,
      queue_type: queueType,
      message: `Brand moved from ${queueType} pending to failed queue successfully`,
    };
  } catch (error) {
    logger.error(`Error moving brand from pending to failed queue:`, error);
    throw error;
  }
}

async function moveFailedToPending(brandId, queueType = "regular", environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info(
      `Moving brand with ID ${brandId} from ${queueType} failed to pending queue`
    );

    const redis = getQueueRedis(queueType, environment);
    const pendingQueueKey = REDIS_KEYS[queueType.toUpperCase()].PENDING_BRANDS;
    const failedQueueKey = REDIS_KEYS[queueType.toUpperCase()].FAILED_BRANDS;
    const failedBrands = await redis.lrange(failedQueueKey, 0, -1);

    let brandToMove = null;
    let brandIndex = -1;

    for (let i = 0; i < failedBrands.length; i++) {
      try {
        const brandData = JSON.parse(failedBrands[i]);
        if (
          brandData.id === brandId ||
          brandData.brand_id === brandId ||
          brandData.queue_id === brandId
        ) {
          brandToMove = brandData;
          brandIndex = i;
          break;
        }
      } catch (parseError) {
        logger.error(
          `Error parsing failed brand data at index ${i}:`,
          parseError
        );
      }
    }

    if (brandIndex === -1) {
      throw new Error(
        `Brand with ID ${brandId} not found in ${queueType} failed queue`
      );
    }

    await redis.lrem(failedQueueKey, 1, failedBrands[brandIndex]);

    const pendingBrandData = {
      id: brandToMove.id || brandToMove.brand_id || brandToMove.queue_id,
      page_id: brandToMove.page_id,
    };

    const defaultScore = 3;
    await redis.zadd(
      pendingQueueKey,
      defaultScore,
      JSON.stringify(pendingBrandData)
    );

    logger.info(
      `Successfully moved brand ${
        brandToMove?.brand_name || brandId
      } from ${queueType} failed to pending queue`
    );

    return {
      moved_brand: pendingBrandData,
      brand_id: brandId,
      queue_type: queueType,
      message: `Brand moved from ${queueType} failed to pending queue successfully`,
    };
  } catch (error) {
    logger.error(`Error moving brand from failed to pending queue:`, error);
    throw error;
  }
}

async function moveAllPendingToFailed(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info("Moving ALL regular pending brands to failed queue");

    const regularRedis = getQueueRedis("regular", environment);

    const regularPendingBrands = await regularRedis.zrange(
      REDIS_KEYS.REGULAR.PENDING_BRANDS,
      0,
      -1,
      "WITHSCORES"
    );

    const totalPendingCount = regularPendingBrands.length / 2;

    if (totalPendingCount === 0) {
      return {
        moved_count: 0,
        message: "No regular pending brands to move",
      };
    }

    const movedBrands = [];
    const regularPipeline = regularRedis.pipeline();

    for (let i = 0; i < regularPendingBrands.length; i += 2) {
      try {
        const member = regularPendingBrands[i];
        const score = regularPendingBrands[i + 1];

        if (!member) continue;

        const brandData = JSON.parse(member);

        const failedBrandData = {
          id: brandData.id || brandData.brand_id || brandData.queue_id,
          page_id: brandData.page_id,
        };

        regularPipeline.lpush(
          REDIS_KEYS.REGULAR.FAILED_BRANDS,
          JSON.stringify(failedBrandData)
        );
        movedBrands.push({ ...failedBrandData, queueType: "regular" });
      } catch (parseError) {
        logger.error(`Error parsing regular pending brand data:`, parseError);
      }
    }

    regularPipeline.del(REDIS_KEYS.REGULAR.PENDING_BRANDS);

    await regularPipeline.exec();

    logger.info(
      `Successfully moved ${movedBrands.length} regular brands from pending to failed queue`
    );

    return {
      moved_count: movedBrands.length,
      moved_brands: movedBrands,
      message: `Moved ${movedBrands.length} regular brands from pending to failed queue successfully`,
    };
  } catch (error) {
    logger.error("Error moving all pending brands to failed queue:", error);
    throw error;
  }
}

async function moveAllFailedToPending(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info("Moving ALL regular failed brands to pending queue");

    const regularRedis = getQueueRedis("regular", environment);

    const regularFailedBrands = await regularRedis.lrange(REDIS_KEYS.REGULAR.FAILED_BRANDS, 0, -1);

    const totalFailedCount = regularFailedBrands.length;

    if (totalFailedCount === 0) {
      return {
        moved_count: 0,
        message: "No regular failed brands to move",
      };
    }

    const movedBrands = [];
    const regularPipeline = regularRedis.pipeline();

    for (const failedBrand of regularFailedBrands) {
      try {
        const brandData = JSON.parse(failedBrand);

        const pendingBrandData = {
          id: brandData.id || brandData.brand_id || brandData.queue_id,
          page_id: brandData.page_id,
        };

        const defaultScore = 3;
        regularPipeline.zadd(
          REDIS_KEYS.REGULAR.PENDING_BRANDS,
          defaultScore,
          JSON.stringify(pendingBrandData)
        );
        movedBrands.push({ ...pendingBrandData, queueType: "regular" });
      } catch (parseError) {
        logger.error(`Error parsing regular failed brand data:`, parseError);
      }
    }

    regularPipeline.del(REDIS_KEYS.REGULAR.FAILED_BRANDS);

    await regularPipeline.exec();

    logger.info(
      `Successfully moved ${movedBrands.length} regular brands from failed to pending queue`
    );

    return {
      moved_count: movedBrands.length,
      moved_brands: movedBrands,
      message: `Moved ${movedBrands.length} regular brands from failed to pending queue successfully`,
    };
  } catch (error) {
    logger.error("Error moving all failed brands to pending queue:", error);
    throw error;
  }
}

async function moveWatchlistFailedToPending(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info("Moving watchlist failed brands to pending queue");

    const watchlistRedis = getQueueRedis("watchlist", environment);

    const failedBrands = await watchlistRedis.lrange(
      REDIS_KEYS.WATCHLIST.FAILED_BRANDS,
      0,
      -1
    );

    if (failedBrands.length === 0) {
      return {
        moved_count: 0,
        message: "No failed brands to move",
      };
    }

    const { Brand, WatchList } = require("../models");

    const watchlistItems = await WatchList.findAll({
      attributes: ["brand_id"],
      raw: true,
    });

    if (watchlistItems.length === 0) {
      return {
        moved_count: 0,
        message: "No watchlist brands found in database",
      };
    }

    const watchlistBrandIds = watchlistItems.map((item) => item.brand_id);
    const watchlistBrands = await Brand.findAll({
      where: {
        id: watchlistBrandIds,
      },
      attributes: ["id", "page_id", "actual_name"],
      raw: true,
    });

    const watchlistPageIds = new Set(
      watchlistBrands.map((brand) => brand.page_id)
    );

    const watchlistFailedBrands = [];
    const pipeline = watchlistRedis.pipeline();
    let movedCount = 0;

    for (const failedBrand of failedBrands) {
      try {
        const brandData = JSON.parse(failedBrand);
        const pageId = brandData.page_id;

        if (watchlistPageIds.has(pageId)) {
          const pendingBrandData = {
            id: brandData.id || brandData.brand_id || brandData.queue_id,
            page_id: pageId,
          };

          const defaultScore = 3;
          pipeline.zadd(
            REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
            defaultScore,
            JSON.stringify(pendingBrandData)
          );
          watchlistFailedBrands.push(pendingBrandData);
          movedCount++;
        }
      } catch (parseError) {
        logger.error(`Error parsing failed brand data:`, parseError);
      }
    }

    if (movedCount === 0) {
      return {
        moved_count: 0,
        message: "No watchlist brands found in failed queue",
      };
    }

    for (const failedBrand of failedBrands) {
      try {
        const brandData = JSON.parse(failedBrand);
        const pageId = brandData.page_id;

        if (watchlistPageIds.has(pageId)) {
          pipeline.lrem(REDIS_KEYS.WATCHLIST.FAILED_BRANDS, 0, failedBrand);
        }
      } catch (parseError) {
        logger.error(
          `Error parsing failed brand data for removal:`,
          parseError
        );
      }
    }

    await pipeline.exec();

    logger.info(
      `Successfully moved ${movedCount} watchlist failed brands to pending queue`
    );

    return {
      moved_count: movedCount,
      moved_brands: watchlistFailedBrands,
      message: `Moved ${movedCount} watchlist failed brands to pending queue successfully`,
    };
  } catch (error) {
    logger.error(
      "Error moving watchlist failed brands to pending queue:",
      error
    );
    throw error;
  }
}

async function moveWatchlistToPending(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info(
      "Moving all watchlist brands from database to pending queue with score 1"
    );

    const { getModels } = require("../models");
    const { Brand, WatchList } = getModels(environment);

    const watchlistItems = await WatchList.findAll({
      attributes: ["brand_id"],
      raw: true,
    });

    if (watchlistItems.length === 0) {
      return {
        moved_count: 0,
        message: "No watchlist brands found in database",
      };
    }

    const watchlistBrandIds = watchlistItems.map((item) => item.brand_id);
    const watchlistBrands = await Brand.findAll({
      where: {
        id: watchlistBrandIds,
      },
      attributes: ["id", "page_id", "actual_name"],
      raw: true,
    });

    if (watchlistBrands.length === 0) {
      return {
        moved_count: 0,
        message: "No watchlist brands found with valid details",
      };
    }

    const watchlistRedis = getQueueRedis("watchlist", environment);

    const existingPendingItems = await watchlistRedis.zrange(
      REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
      0,
      -1
    );
    const existingPageIds = new Set();

    for (const pendingItem of existingPendingItems) {
      try {
        const pendingData = JSON.parse(pendingItem);
        existingPageIds.add(pendingData.page_id);
      } catch (parseError) {
        logger.error(`Error parsing existing pending brand data:`, parseError);
      }
    }

    const brandsToAdd = watchlistBrands.filter(
      (brand) => !existingPageIds.has(brand.page_id)
    );

    if (brandsToAdd.length === 0) {
      return {
        moved_count: 0,
        message: "All watchlist brands are already in watchlist pending queue",
      };
    }

    const pipeline = watchlistRedis.pipeline();
    const addedBrands = [];

    for (const brand of brandsToAdd) {
      const pendingBrandData = {
        id: brand.id,
        page_id: brand.page_id,
      };

      pipeline.zadd(
        REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
        1,
        JSON.stringify(pendingBrandData)
      );
      addedBrands.push(pendingBrandData);
    }

    await pipeline.exec();

    logger.info(
      `Successfully added ${addedBrands.length} watchlist brands to watchlist pending queue with score 1`
    );

    return {
      moved_count: addedBrands.length,
      moved_brands: addedBrands,
      message: `Successfully added ${addedBrands.length} watchlist brands to watchlist pending queue with priority score 1`,
    };
  } catch (error) {
    logger.error("Error moving watchlist brands to pending queue:", error);
    throw error;
  }
}

async function moveIndividualWatchlistFailedToPending(brandIdentifier, environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info(
      `Moving individual watchlist failed brand ${brandIdentifier} to watchlist pending queue [Environment: ${environment}]`
    );

    const watchlistRedis = getQueueRedis("watchlist", environment);

    const failedBrandsKey = REDIS_KEYS.WATCHLIST.FAILED_BRANDS;
    logger.info(`Using Redis key for watchlist failed brands: ${failedBrandsKey}`);
    
    const failedBrands = await watchlistRedis.lrange(
      failedBrandsKey,
      0,
      -1
    );

    if (failedBrands.length === 0) {
      logger.warn(`No failed brands found in watchlist failed queue for environment: ${environment}`);
      throw new Error("No failed brands found in watchlist failed queue");
    }
    
    logger.info(`Found ${failedBrands.length} failed brands in watchlist failed queue for environment: ${environment}`);
    logger.info(`Looking for brand identifier: ${brandIdentifier} (type: ${typeof brandIdentifier})`);
    
    if (failedBrands.length > 0) {
      logger.info(`First few failed brands: ${failedBrands.slice(0, 3).map(b => JSON.parse(b)).map(b => ({id: b.id, brand_id: b.brand_id, page_id: b.page_id}))}`);
    }

    let brandToMove = null;
    let brandIndex = -1;

    for (let i = 0; i < failedBrands.length; i++) {
      try {
        const brandData = JSON.parse(failedBrands[i]);
        
        const brandIdStr = brandIdentifier.toString();
        const brandIdNum = parseInt(brandIdentifier);
        
        if (
          brandData.id == brandIdentifier || 
          brandData.brand_id == brandIdentifier ||
          brandData.page_id == brandIdentifier ||
          brandData.id == brandIdNum ||
          brandData.brand_id == brandIdNum ||
          brandData.page_id == brandIdStr
        ) {
          brandToMove = brandData;
          brandIndex = i;
          break;
        }
      } catch (parseError) {
        logger.error(
          `Error parsing failed brand data at index ${i}:`,
          parseError
        );
      }
    }

    if (brandIndex === -1) {
      throw new Error(
        `Brand with identifier ${brandIdentifier} not found in watchlist failed queue`
      );
    }

    await watchlistRedis.lrem(
      REDIS_KEYS.WATCHLIST.FAILED_BRANDS,
      1,
      failedBrands[brandIndex]
    );

    const pendingBrandData = {
      id: brandToMove.id || brandToMove.brand_id || brandToMove.queue_id,
      page_id: brandToMove.page_id,
    };

    const defaultScore = 3;
    await watchlistRedis.zadd(
      REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
      defaultScore,
      JSON.stringify(pendingBrandData)
    );

    logger.info(
      `Successfully moved brand ${brandToMove.page_id} from watchlist failed to watchlist pending queue`
    );

    return {
      moved_brand: pendingBrandData,
      brand_identifier: brandIdentifier,
      message:
        "Brand moved from watchlist failed to watchlist pending queue successfully",
    };
  } catch (error) {
    logger.error(
      "Error moving individual watchlist failed brand to pending queue:",
      error
    );
    throw error;
  }
}

async function moveAllWatchlistPendingToFailed(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info("Moving ALL watchlist pending brands to failed queue");

    const watchlistRedis = getQueueRedis("watchlist", environment);

    const watchlistPendingBrands = await watchlistRedis.zrange(
      REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
      0,
      -1,
      "WITHSCORES"
    );

    const totalPendingCount = watchlistPendingBrands.length / 2;

    if (totalPendingCount === 0) {
      return {
        moved_count: 0,
        message: "No watchlist pending brands to move",
      };
    }

    const movedBrands = [];
    const pipeline = watchlistRedis.pipeline();

    for (let i = 0; i < watchlistPendingBrands.length; i += 2) {
      try {
        const member = watchlistPendingBrands[i];
        const score = watchlistPendingBrands[i + 1];

        if (!member) continue;

        const brandData = JSON.parse(member);

        const failedBrandData = {
          id: brandData.id || brandData.brand_id || brandData.queue_id,
          page_id: brandData.page_id,
        };

        pipeline.lpush(
          REDIS_KEYS.WATCHLIST.FAILED_BRANDS,
          JSON.stringify(failedBrandData)
        );
        movedBrands.push({ ...failedBrandData, queueType: "watchlist" });
      } catch (parseError) {
        logger.error(`Error parsing watchlist pending brand data:`, parseError);
      }
    }

    pipeline.del(REDIS_KEYS.WATCHLIST.PENDING_BRANDS);

    await pipeline.exec();

    logger.info(
      `Successfully moved ${movedBrands.length} watchlist brands from pending to failed queue`
    );

    return {
      moved_count: movedBrands.length,
      moved_brands: movedBrands,
      message: `Moved ${movedBrands.length} watchlist brands from pending to failed queue successfully`,
    };
  } catch (error) {
    logger.error("Error moving all watchlist pending brands to failed queue:", error);
    throw error;
  }
}

async function moveAllWatchlistFailedToPending(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    
    logger.info(`Moving ALL watchlist failed brands to pending queue [Environment: ${environment}]`);

    const watchlistRedis = getQueueRedis("watchlist", environment);

    const failedBrandsKey = REDIS_KEYS.WATCHLIST.FAILED_BRANDS;
    logger.info(`Using Redis key for watchlist failed brands: ${failedBrandsKey}`);
    
    const watchlistFailedBrands = await watchlistRedis.lrange(
      failedBrandsKey,
      0,
      -1
    );

    if (watchlistFailedBrands.length === 0) {
      return {
        moved_count: 0,
        message: "No watchlist failed brands to move",
      };
    }

    logger.info(`Found ${watchlistFailedBrands.length} failed brands to move from watchlist failed queue`);
    
    if (watchlistFailedBrands.length > 0) {
      logger.info(`Sample failed brands (first 3):`);
      for (let i = 0; i < Math.min(3, watchlistFailedBrands.length); i++) {
        logger.info(`Brand ${i}: ${watchlistFailedBrands[i].substring(0, 100)}...`);
      }
    }

    const movedBrands = [];
    const pipeline = watchlistRedis.pipeline();
    let parseErrors = 0;
    let invalidBrands = 0;
    let skippedBrands = [];

    for (let i = 0; i < watchlistFailedBrands.length; i++) {
      const failedBrand = watchlistFailedBrands[i];
      try {
        if (!failedBrand || failedBrand.trim() === '') {
          logger.warn(`Empty or null brand data at index ${i}, skipping`);
          invalidBrands++;
          skippedBrands.push({ index: i, reason: 'Empty or null data', data: failedBrand });
          continue;
        }

        const brandData = JSON.parse(failedBrand);

        const brandId = brandData.id || brandData.brand_id || brandData.queue_id || brandData.page_id;
        if (!brandId) {
          logger.warn(`Invalid brand data at index ${i}: missing all id fields`, brandData);
          invalidBrands++;
          skippedBrands.push({ index: i, reason: 'Missing ID fields', data: brandData });
          continue;
        }

        const pendingBrandData = {
          id: brandId,
          page_id: brandData.page_id || brandData.id || brandData.brand_id,
          brand_name: brandData.brand_name,
          brand_id: brandData.brand_id,
          queue_id: brandData.queue_id,
          ...brandData
        };

        const defaultScore = 3;
        pipeline.zadd(
          REDIS_KEYS.WATCHLIST.PENDING_BRANDS,
          defaultScore,
          JSON.stringify(pendingBrandData)
        );
        movedBrands.push({ ...pendingBrandData, queueType: "watchlist" });
      } catch (parseError) {
        logger.error(`Error parsing watchlist failed brand data at index ${i}:`, parseError);
        logger.error(`Raw brand data (first 200 chars): ${failedBrand.substring(0, 200)}`);
        logger.error(`Raw brand data length: ${failedBrand.length}`);
        parseErrors++;
        skippedBrands.push({ index: i, reason: 'Parse error', error: parseError.message, data: failedBrand.substring(0, 100) });
      }
    }

    logger.info(`Processing results: ${movedBrands.length} moved, ${parseErrors} parse errors, ${invalidBrands} invalid brands`);

    pipeline.del(REDIS_KEYS.WATCHLIST.FAILED_BRANDS);

    const pipelineResults = await pipeline.exec();
    
    if (pipelineResults) {
      const failedOperations = pipelineResults.filter(result => result[0] !== null);
      if (failedOperations.length > 0) {
        logger.error(`Pipeline execution had ${failedOperations.length} failed operations:`, failedOperations);
      }
    }

    logger.info(
      `Successfully moved ${movedBrands.length} watchlist brands from failed to pending queue (${parseErrors} parse errors, ${invalidBrands} invalid brands)`
    );

    if (skippedBrands.length > 0) {
      logger.warn(`Skipped ${skippedBrands.length} brands due to errors:`);
      skippedBrands.forEach((brand, index) => {
        logger.warn(`  ${index + 1}. Index ${brand.index}: ${brand.reason}${brand.error ? ` (${brand.error})` : ''}`);
      });
    }

    return {
      moved_count: movedBrands.length,
      moved_brands: movedBrands,
      parse_errors: parseErrors,
      invalid_brands: invalidBrands,
      skipped_brands: skippedBrands,
      total_found: watchlistFailedBrands.length,
      message: `Moved ${movedBrands.length} of ${watchlistFailedBrands.length} watchlist brands from failed to pending queue successfully${parseErrors > 0 || invalidBrands > 0 ? ` (${parseErrors} parse errors, ${invalidBrands} invalid brands)` : ''}`,
    };
  } catch (error) {
    logger.error("Error moving all watchlist failed brands to pending queue:", error);
    throw error;
  }
}

async function cleanupWatchlistFailedQueue(environment = 'production') {
  try {
    const REDIS_KEYS = getRedisKeys(environment);
    const watchlistRedis = getQueueRedis("watchlist", environment);
    
    logger.info(`Cleaning up watchlist failed queue [Environment: ${environment}]`);

    const failedBrandsKey = REDIS_KEYS.WATCHLIST.FAILED_BRANDS;
    const watchlistFailedBrands = await watchlistRedis.lrange(failedBrandsKey, 0, -1);

    if (watchlistFailedBrands.length === 0) {
      return { cleaned_count: 0, message: "No brands to clean up" };
    }

    const validBrands = [];
    const corruptedBrands = [];
    let parseErrors = 0;

    for (let i = 0; i < watchlistFailedBrands.length; i++) {
      const failedBrand = watchlistFailedBrands[i];
      try {
        if (!failedBrand || failedBrand.trim() === '') {
          corruptedBrands.push({ index: i, reason: 'Empty data', data: failedBrand });
          continue;
        }

        const brandData = JSON.parse(failedBrand);
        
        const brandId = brandData.id || brandData.brand_id || brandData.queue_id || brandData.page_id;
        if (!brandId) {
          corruptedBrands.push({ index: i, reason: 'Missing ID fields', data: brandData });
          continue;
        }

        validBrands.push(failedBrand);
      } catch (parseError) {
        parseErrors++;
        corruptedBrands.push({ index: i, reason: 'Parse error', error: parseError.message, data: failedBrand.substring(0, 100) });
      }
    }

    await watchlistRedis.del(failedBrandsKey);
    if (validBrands.length > 0) {
      await watchlistRedis.lpush(failedBrandsKey, ...validBrands);
    }

    logger.info(`Cleanup completed: ${validBrands.length} valid brands retained, ${corruptedBrands.length} corrupted brands removed`);

    return {
      cleaned_count: corruptedBrands.length,
      valid_count: validBrands.length,
      corrupted_brands: corruptedBrands,
      message: `Cleaned up watchlist failed queue: ${validBrands.length} valid brands retained, ${corruptedBrands.length} corrupted brands removed`
    };
  } catch (error) {
    logger.error("Error cleaning up watchlist failed queue:", error);
    throw error;
  }
}

module.exports = {
  movePendingToFailed,
  moveFailedToPending,
  moveAllPendingToFailed,
  moveAllFailedToPending,
  moveWatchlistFailedToPending,
  moveWatchlistToPending,
  moveIndividualWatchlistFailedToPending,
  moveAllWatchlistPendingToFailed,
  moveAllWatchlistFailedToPending,
  cleanupWatchlistFailedQueue,
};
