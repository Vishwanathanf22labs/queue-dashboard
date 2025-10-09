// Models will be required dynamically
const { Op } = require("sequelize");
const { getCacheKey, getCachedData, setCachedData } = require("../utils/cacheUtils");

/**
 * Get scraping statistics
 */
async function getScrapingStats(date = null, environment = 'production') {
  try {
    // Require models dynamically to get the latest version
    const { getModels } = require("../../models");
    const { Brand, BrandsDailyStatus } = getModels(environment);
    
    const targetDate = date || new Date().toISOString().split("T")[0];
    const cacheKey = getCacheKey("stats", targetDate);
    const cached = await getCachedData(cacheKey, environment);
    if (cached) return cached;

    const totalBrands = await Brand.count({
      where: { status: { [Op.ne]: "Inactive" } },
    });

    const startDate = new Date(targetDate + "T00:00:00.000Z");
    const endDate = new Date(targetDate + "T23:59:59.999Z");

    const brandsWithStatus = await Brand.findAll({
      where: { status: { [Op.ne]: "Inactive" } },
      include: [
        {
          model: BrandsDailyStatus,
          as: "dailyStatuses",
          required: true,
          where: {
            created_at: {
              [Op.between]: [startDate, endDate],
            },
          },
          order: [["created_at", "DESC"]],
          limit: 1,
        },
      ],
    });

    const completedScraping = brandsWithStatus.filter((brand) => {
      const latestStatus = brand.dailyStatuses?.[0];
      return latestStatus?.status === "Completed";
    }).length;

    const statusCounts = {
      Started: 0,
      Completed: 0,
      Blocked: 0,
      Unknown: 0,
    };

    const dbStoredCounts = {
      "Stored (has new ads)": 0,
      "Stored (no new ads today)": 0,
      "Stored (processing done)": 0,
      "In progress (some ads stored)": 0,
      "In progress (no ads yet)": 0,
      "In progress (not finished)": 0,
      "Failed/blocked": 0,
      "Not started": 0,
    };

    const typesenseCounts = {
      COMPLETED: 0,
      WAITING: 0,
      FAILED: 0,
      NOT_PROCESSED: 0,
      ERROR: 0,
    };

    const fileUploadCounts = {
      COMPLETED: 0,
      PROCESSING: 0,
      WAITING: 0,
      FAILED: 0,
      NOT_PROCESSED: 0,
      ERROR: 0,
    };

    let completedDbStored = 0;
    let completedTypesense = 0;
    let completedFileUpload = 0;

    brandsWithStatus.forEach((brand) => {
      const latestStatus = brand.dailyStatuses?.[0];
      const status = latestStatus?.status || "Unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Simplified logic for stats (avoid heavy computations)
      let dbStoredStatus = "Not started";
      let dbStoredCompleted = false;

      if (latestStatus) {
        const activeAds = latestStatus.active_ads;
        if (status === "Completed") {
          if (activeAds > 0) {
            dbStoredStatus = "Stored (has new ads)";
            dbStoredCompleted = true;
          } else if (activeAds === 0) {
            dbStoredStatus = "Stored (no new ads today)";
            dbStoredCompleted = true;
          } else if (activeAds === null) {
            dbStoredStatus = "Stored (processing done)";
            dbStoredCompleted = true;
          }
        } else if (status === "Started") {
          if (activeAds > 0) {
            dbStoredStatus = "In progress (some ads stored)";
          } else if (activeAds === 0) {
            dbStoredStatus = "In progress (no ads yet)";
          } else if (activeAds === null) {
            dbStoredStatus = "In progress (not finished)";
          }
        } else if (status === "Blocked") {
          dbStoredStatus = "Failed/blocked";
        }
      }

      dbStoredCounts[dbStoredStatus] =
        (dbStoredCounts[dbStoredStatus] || 0) + 1;
      if (dbStoredCompleted) {
        completedDbStored++;
      }

      // Simplified status for performance
      typesenseCounts["NOT_PROCESSED"] =
        (typesenseCounts["NOT_PROCESSED"] || 0) + 1;
      fileUploadCounts["NOT_PROCESSED"] =
        (fileUploadCounts["NOT_PROCESSED"] || 0) + 1;
    });

    const brandsWithoutStatus = totalBrands - brandsWithStatus.length;
    dbStoredCounts["Not started"] += brandsWithoutStatus;
    typesenseCounts["NOT_PROCESSED"] += brandsWithoutStatus;
    fileUploadCounts["NOT_PROCESSED"] += brandsWithoutStatus;

    const result = {
      date: targetDate,
      totalBrands,
      brandsWithStatus: brandsWithStatus.length,
      completedScraping,
      statusCounts,
      completionRate:
        totalBrands > 0
          ? ((completedScraping / totalBrands) * 100).toFixed(2)
          : 0,
      dbStored: {
        completed: completedDbStored,
        completionRate:
          totalBrands > 0
            ? ((completedDbStored / totalBrands) * 100).toFixed(2)
            : 0,
        statusCounts: dbStoredCounts,
      },
      typesense: {
        completed: completedTypesense,
        completionRate:
          totalBrands > 0
            ? ((completedTypesense / totalBrands) * 100).toFixed(2)
            : 0,
        statusCounts: typesenseCounts,
      },
      fileUpload: {
        completed: completedFileUpload,
        completionRate:
          totalBrands > 0
            ? ((completedFileUpload / totalBrands) * 100).toFixed(2)
            : 0,
        statusCounts: fileUploadCounts,
      },
    };

    await setCachedData(cacheKey, result, 300, environment);
    return result;
  } catch (error) {
    console.error("Error getting scraping stats:", error);
    throw error;
  }
}

module.exports = {
  getScrapingStats,
};
