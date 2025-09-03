const redis = require("../config/redis");
const logger = require("../utils/logger");
const { REDIS_KEYS, MILLISECONDS_PER_DAY } = require("../config/constants");

// Fix the getBrandsScrapedStats function to read from the correct Redis keys
async function getBrandsScrapedStats(date = null) {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const statsKey = `${REDIS_KEYS.STATS_PREFIX}${targetDate}`;

    logger.info(`Looking for stats key: ${statsKey}`);

    const allStats = await redis.hgetall(statsKey);

    logger.info(`Stats data for ${statsKey}:`, allStats);

    // Return all the stats fields from your Redis
    const brandsStats = {
      date: targetDate,
      brands_scraped: parseInt(allStats.brands_scrapped || 0),
      brands_processed: parseInt(allStats.brands_processed || 0),
      brands_scrapped_failed: parseInt(allStats.brands_scrapped_failed || 0),
      ads_processed: parseInt(allStats.ads_processed || 0),

    };

    return brandsStats;
  } catch (error) {
    logger.error("Error in getBrandsScrapedStats:", error);
    throw error;
  }
}

async function getBrandsScrapedStatsForDays(days = 7) {
  try {
    const stats = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today.getTime() - i * MILLISECONDS_PER_DAY);
      const dateString = date.toISOString().split("T")[0];
      const dayStats = await getBrandsScrapedStats(dateString);
      stats.push(dayStats);
    }

    return {
      period: `Last ${days} days`,
      stats: stats.reverse(), // Most recent first
    };
  } catch (error) {
    logger.error("Error in getBrandsScrapedStatsForDays:", error);
    throw error;
  }
}

module.exports = {
  getBrandsScrapedStats,
  getBrandsScrapedStatsForDays,
};
