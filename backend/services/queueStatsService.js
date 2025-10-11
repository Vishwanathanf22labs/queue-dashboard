const { getGlobalRedis, getWatchlistRedisInstance, getRegularRedisInstance } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { REDIS_KEYS, MILLISECONDS_PER_DAY } = require("../config/constants");


async function getBrandsScrapedStats(date = null, environment = 'production') {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const statsKey = `${REDIS_KEYS.GLOBAL.STATS_PREFIX}${targetDate}`;

    logger.info(`Looking for stats key: ${statsKey} [${environment}]`);

    const allStats = await getGlobalRedis(environment).hgetall(statsKey);

    logger.info(`Stats data for ${statsKey} [${environment}]:`, allStats);

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


async function getBrandsScrapedStatsForDays(days = 7, environment = 'production') {
  try {
    const today = new Date();
    const dateStrings = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(today.getTime() - i * MILLISECONDS_PER_DAY);
      dateStrings.push(date.toISOString().split("T")[0]);
    }

    const pipeline = getGlobalRedis(environment).pipeline();
    dateStrings.forEach((dateString) => {
      const statsKey = `${REDIS_KEYS.GLOBAL.STATS_PREFIX}${dateString}`;
      pipeline.hgetall(statsKey);
    });

    const results = await pipeline.exec();

    const stats = results.map((result, index) => {
      const allStats = result[1] || {};
      const dateString = dateStrings[index];

      return {
        date: dateString,
        brands_scraped: parseInt(allStats.brands_scrapped || 0),
        brands_processed: parseInt(allStats.brands_processed || 0),
        brands_scrapped_failed: parseInt(allStats.brands_scrapped_failed || 0),
        ads_processed: parseInt(allStats.ads_processed || 0),
      };
    });

    return {
      period: `Last ${days} days`,
      stats: stats.reverse(),
    };
  } catch (error) {
    logger.error("Error in getBrandsScrapedStatsForDays:", error);
    throw error;
  }
}

async function getSeparateBrandsScrapedStats(date = null, environment = 'production') {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];

    const [watchlistStats, regularStats] = await Promise.all([
      getStatsFromRedis(getWatchlistRedisInstance(environment), targetDate, 'watchlist'),
      getStatsFromRedis(getRegularRedisInstance(environment), targetDate, 'regular')
    ]);

    return {
      date: targetDate,
      watchlist: watchlistStats,
      regular: regularStats
    };
  } catch (error) {
    logger.error("Error in getSeparateBrandsScrapedStats:", error);
    throw error;
  }
}


async function getSeparateBrandsScrapedStatsForDays(days = 7, environment = 'production') {
  try {
    const today = new Date();
    const dateStrings = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(today.getTime() - i * MILLISECONDS_PER_DAY);
      dateStrings.push(date.toISOString().split("T")[0]);
    }

    const [watchlistStats, regularStats] = await Promise.all([
      getStatsForDaysFromRedis(getWatchlistRedisInstance(environment), dateStrings, 'watchlist'),
      getStatsForDaysFromRedis(getRegularRedisInstance(environment), dateStrings, 'regular')
    ]);

    return {
      watchlist: watchlistStats,
      regular: regularStats
    };
  } catch (error) {
    logger.error("Error in getSeparateBrandsScrapedStatsForDays:", error);
    throw error;
  }
}

async function getStatsFromRedis(redis, targetDate, type) {
  try {
    const statsKey = `${REDIS_KEYS[type.toUpperCase()].STATS_PREFIX}${targetDate}`;
    const allStats = await redis.hgetall(statsKey);

    return {
      date: targetDate,
      brands_scraped: parseInt(allStats.brands_scrapped || 0),
      brands_processed: parseInt(allStats.brands_processed || 0),
      brands_scrapped_failed: parseInt(allStats.brands_scrapped_failed || 0),
      ads_processed: parseInt(allStats.ads_processed || 0),
    };
  } catch (error) {
    logger.error(`Error getting stats from ${type} Redis:`, error);
    return {
      date: targetDate,
      brands_scraped: 0,
      brands_processed: 0,
      brands_scrapped_failed: 0,
      ads_processed: 0,
    };
  }
}

async function getStatsForDaysFromRedis(redis, dateStrings, type) {
  try {
    const pipeline = redis.pipeline();
    dateStrings.forEach((dateString) => {
      const statsKey = `${REDIS_KEYS[type.toUpperCase()].STATS_PREFIX}${dateString}`;
      pipeline.hgetall(statsKey);
    });

    const results = await pipeline.exec();
    const stats = [];

    results.forEach((result, index) => {
      const [error, data] = result;
      if (error) {
        logger.error(`Error getting stats for ${dateStrings[index]}:`, error);
        stats.push({
          date: dateStrings[index],
          brands_scraped: 0,
          brands_processed: 0,
          brands_scrapped_failed: 0,
          ads_processed: 0,
        });
      } else {
        stats.push({
          date: dateStrings[index],
          brands_scraped: parseInt(data.brands_scrapped || 0),
          brands_processed: parseInt(data.brands_processed || 0),
          brands_scrapped_failed: parseInt(data.brands_scrapped_failed || 0),
          ads_processed: parseInt(data.ads_processed || 0),
        });
      }
    });

    return stats;
  } catch (error) {
    logger.error(`Error getting stats for days from ${type} Redis:`, error);
    return dateStrings.map(date => ({
      date,
      brands_scraped: 0,
      brands_processed: 0,
      brands_scrapped_failed: 0,
      ads_processed: 0,
    }));
  }
}

module.exports = {
  getBrandsScrapedStats,
  getBrandsScrapedStatsForDays,
  getSeparateBrandsScrapedStats,
  getSeparateBrandsScrapedStatsForDays,
};
