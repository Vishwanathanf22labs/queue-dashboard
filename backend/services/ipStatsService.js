const { getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { Op } = require("sequelize");
const {
  getCacheKey,
  getCachedData,
  setCachedData,
  generateETag,
  getIpStatsListCache,
  setIpStatsListCache,
  getIpStatsListETag,
  setIpStatsListETag,
  getIpBrandsCache,
  setIpBrandsCache,
  getIpBrandsETag,
  setIpBrandsETag,
} = require("./utils/cacheUtils");

async function getAllIpStats(environment = 'production') {
  try {
    const redis = getGlobalRedis(environment);

    const ipStatsKeys = await redis.keys("ip_stats:*");

    const hashKeys = ipStatsKeys.filter((key) => !key.includes(":brands"));

    const ipStats = [];

    for (const key of hashKeys) {
      const ip = key.replace("ip_stats:", "");

      const stats = await redis.hgetall(key);

      if (Object.keys(stats).length > 0) {
        ipStats.push({
          ip,
          totalBrands: parseInt(stats.totalBrands || 0),
          totalAds: parseInt(stats.totalAds || 0),
          completed: parseInt(stats.completed || 0),
          failed: parseInt(stats.failed || 0),
          total: parseInt(stats.total || 0),
        });
      }
    }

    return ipStats;
  } catch (error) {
    logger.error("Error getting all IP stats:", error);
    throw error;
  }
}

async function getIpStatsWithPagination(
  page = 1,
  limit = 10,
  search = "",
  sortBy = "totalAds",
  sortOrder = "desc",
  environment = 'production'
) {
  try {
    const cached = await getIpStatsListCache(
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      environment
    );
    if (cached) {
      const cachedETag = await getIpStatsListETag(
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        environment
      );
      return { ...cached, etag: cachedETag, fromCache: true };
    }

    const redis = getGlobalRedis(environment);
    const ipStatsKeys = await redis.keys("ip_stats:*");

    const hashKeys = ipStatsKeys.filter((key) => !key.includes(":brands"));

    const allIpStats = [];

    for (const key of hashKeys) {
      const ip = key.replace("ip_stats:", "");

      if (search && !ip.includes(search)) {
        continue;
      }

      const stats = await redis.hgetall(key);

      if (Object.keys(stats).length > 0) {
        allIpStats.push({
          ip,
          totalBrands: parseInt(stats.totalBrands || 0),
          totalAds: parseInt(stats.totalAds || 0),
          completed: parseInt(stats.completed || 0),
          failed: parseInt(stats.failed || 0),
          total: parseInt(stats.total || 0),
        });
      }
    }

    allIpStats.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortOrder === "asc") {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });

    const total = allIpStats.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = allIpStats.slice(startIndex, endIndex);

    const result = {
      data: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    const etag = generateETag({
      ips: paginatedData.map((ip) => ip.ip).join(","),
      total,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    await Promise.all([
      setIpStatsListCache(page, limit, result, search, sortBy, sortOrder, 300, environment),
      setIpStatsListETag(page, limit, etag, search, sortBy, sortOrder, 300, environment),
    ]);

    return { ...result, etag, fromCache: false };
  } catch (error) {
    logger.error("Error getting IP stats with pagination:", error);
    throw error;
  }
}

async function getIpStatsByIp(ip, environment = 'production') {
  try {
    const redis = getGlobalRedis(environment);
    const key = `ip_stats:${ip}`;

    const stats = await redis.hgetall(key);

    if (Object.keys(stats).length === 0) {
      return null;
    }

    return {
      ip,
      totalBrands: parseInt(stats.totalBrands || 0),
      totalAds: parseInt(stats.totalAds || 0),
      completed: parseInt(stats.completed || 0),
      failed: parseInt(stats.failed || 0),
      total: parseInt(stats.total || 0),
    };
  } catch (error) {
    logger.error(`Error getting IP stats for ${ip}:`, error);
    throw error;
  }
}

async function getBrandsByIp(ip, page = 1, limit = 10, search = "", environment = 'production') {
  try {
    const cached = await getIpBrandsCache(ip, page, limit, search);
    if (cached) {
      const cachedETag = await getIpBrandsETag(ip, page, limit, search);
      return { ...cached, etag: cachedETag, fromCache: true };
    }

    const redis = getGlobalRedis(environment);
    const brandsKey = `ip_stats:${ip}:brands`;

    const exists = await redis.exists(brandsKey);
    if (!exists) {
      const emptyResult = {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };

      await setIpBrandsCache(ip, page, limit, emptyResult, search, 60);
      return emptyResult;
    }

    const allBrandsCacheKey = getCacheKey("ip_all_brands", ip);
    let brandsWithNames = await getCachedData(allBrandsCacheKey);

    if (!brandsWithNames) {
      const brandsList = await redis.lrange(brandsKey, 0, -1);

      const brandsData = [];
      for (const brandJson of brandsList) {
        try {
          const brandData = JSON.parse(brandJson);
          brandsData.push(brandData);
        } catch (parseError) {
          logger.error(`Error parsing brand JSON: ${brandJson}`, parseError);
          continue;
        }
      }

      const brandIds = brandsData.map((b) => b.brandId);
      const { getModels } = require("../models");
      const { Brand } = getModels(environment);
      const brands = await Brand.findAll({
        where: { id: { [Op.in]: brandIds } },
        attributes: ["id", "actual_name", "name"],
        raw: true,
      });

      const brandNameMap = new Map(
        brands.map((b) => [
          b.id,
          b.actual_name || b.name || `Brand ID: ${b.id}`,
        ])
      );

      brandsWithNames = brandsData.map((brandData) => ({
        brandId: brandData.brandId,
        brandName:
          brandNameMap.get(brandData.brandId) ||
          `Brand ID: ${brandData.brandId}`,
        pageId: brandData.pageId,
        adsCount: parseInt(brandData.adsCount || 0),
        status: brandData.status,
      }));

      await setCachedData(allBrandsCacheKey, brandsWithNames, 300);
    }

    let filteredBrands = brandsWithNames;

    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredBrands = brandsWithNames.filter(
        (brand) =>
          brand.brandName.toLowerCase().includes(searchLower) ||
          brand.pageId.toLowerCase().includes(searchLower) ||
          brand.brandId.toString().includes(search)
      );
    }

    const total = filteredBrands.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = filteredBrands.slice(startIndex, endIndex);

    const result = {
      data: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    const etag = generateETag({
      ip,
      brandIds: paginatedData.map((b) => b.brandId).join(","),
      total,
      page,
      limit,
      search,
    });

    await Promise.all([
      setIpBrandsCache(ip, page, limit, result, search, 300),
      setIpBrandsETag(ip, page, limit, etag, search, 300),
    ]);

    return { ...result, etag, fromCache: false };
  } catch (error) {
    logger.error(`Error getting brands for IP ${ip}:`, error);
    throw error;
  }
}

async function getBrandNameFromDb(brandId, environment = 'production') {
  try {
    const { getModels } = require("../models");
    const { Brand } = getModels(environment);
    const brand = await Brand.findOne({
      where: { id: brandId },
      attributes: ["actual_name", "name"],
    });

    if (!brand) {
      return `Brand ID: ${brandId}`;
    }

    return brand.actual_name || brand.name || `Brand ID: ${brandId}`;
  } catch (error) {
    logger.error(`Error getting brand name for ID ${brandId}:`, error);
    return `Brand ID: ${brandId}`;
  }
}

async function deleteIpStats(ip, environment = 'production') {
  try {
    const redis = getGlobalRedis(environment);
    const statsKey = `ip_stats:${ip}`;
    const brandsKey = `ip_stats:${ip}:brands`;

    const keysToDelete = [statsKey, brandsKey];
    const deletedCount = await redis.del(keysToDelete);

    logger.info(`Deleted IP stats for ${ip}. Keys deleted: ${deletedCount}`);

    return {
      success: true,
      message: `IP stats deleted successfully for ${ip}`,
      deletedKeys: deletedCount,
    };
  } catch (error) {
    logger.error(`Error deleting IP stats for ${ip}:`, error);
    throw error;
  }
}

async function getIpStatsSummary(environment = 'production') {
  try {
    const allStats = await getAllIpStats(environment);

    const summary = {
      totalIps: allStats.length,
      totalBrands: allStats.reduce((sum, stat) => sum + stat.totalBrands, 0),
      totalAds: allStats.reduce((sum, stat) => sum + stat.totalAds, 0),
      totalCompleted: allStats.reduce((sum, stat) => sum + stat.completed, 0),
      totalFailed: allStats.reduce((sum, stat) => sum + stat.failed, 0),
      totalScrapingAttempts: allStats.reduce(
        (sum, stat) => sum + stat.total,
        0
      ),
    };

    return summary;
  } catch (error) {
    logger.error("Error getting IP stats summary:", error);
    throw error;
  }
}

module.exports = {
  getAllIpStats,
  getIpStatsWithPagination,
  getIpStatsByIp,
  getBrandsByIp,
  getBrandNameFromDb,
  deleteIpStats,
  getIpStatsSummary,
};
