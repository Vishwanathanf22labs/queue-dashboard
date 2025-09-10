const { Op } = require('sequelize');
const { Brand, BrandsDailyStatus } = require('../models');

class ScrapedBrandsService {
  /**
   * Get scraped brands for specific date with pagination
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 10)
   * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to current date)
   * @returns {Object} - Paginated results with brands data
   */
  static async getScrapedBrands(page = 1, limit = 10, date = null) {
    try {
      // Use provided date if given, otherwise use current date
      let targetDate;
      if (date) {
        targetDate = new Date(date);
      } else {
        targetDate = new Date();
      }
      
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Get total count for pagination
      const totalCount = await BrandsDailyStatus.count({
        where: {
          started_at: {
            [Op.gte]: startOfDay,
            [Op.lt]: endOfDay
          }
        }
      });

      // Get paginated data with brand information using Sequelize ORM
      const scrapedBrands = await BrandsDailyStatus.findAll({
        where: {
          started_at: {
            [Op.gte]: startOfDay,
            [Op.lt]: endOfDay
          }
        },
        include: [
          {
            model: Brand,
            as: 'brand',
            attributes: [
              'id',
              'name',
              'actual_name'
            ],
            required: true
          }
        ],
        attributes: [
          'brand_id',
          'active_ads',
          'inactive_ads',
          'stopped_ads',
          'comparative_status',
          'started_at'
        ],
        order: [['started_at', 'DESC']],
        limit: limit,
        offset: offset
      });

      // Transform the data to include brand_name with COALESCE logic
      const transformedBrands = scrapedBrands.map(item => ({
        brand_id: item.brand_id,
        active_ads: item.active_ads,
        inactive_ads: item.inactive_ads,
        stopped_ads: item.stopped_ads,
        comparative_status: item.comparative_status,
        started_at: item.started_at,
        brand_name: item.brand?.actual_name || item.brand?.name || 'Unknown'
      }));

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        success: true,
        data: {
          brands: transformedBrands,
          pagination: {
            currentPage: page,
            totalPages: totalPages,
            totalItems: totalCount,
            itemsPerPage: limit,
            hasNextPage: hasNextPage,
            hasPrevPage: hasPrevPage
          },
          queryDate: targetDate.toISOString().split('T')[0]
        }
      };
    } catch (error) {
      console.error('Error in getScrapedBrands:', error);
      return {
        success: false,
        error: 'Failed to fetch scraped brands',
        details: error.message
      };
    }
  }

  /**
   * Search scraped brands across all pages
   * @param {string} query - Search query
   * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to current date)
   * @returns {Object} - Search results
   */
  static async searchScrapedBrands(query, date = null) {
    try {
      // Use provided date if given, otherwise use current date
      let targetDate;
      if (date) {
        targetDate = new Date(date);
      } else {
        targetDate = new Date();
      }
      
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

      // Check if query is numeric for brand_id search
      const isNumericQuery = !isNaN(query) && !isNaN(parseInt(query));
      
      // Build where clause based on query type
      let whereClause = {
        started_at: {
          [Op.gte]: startOfDay,
          [Op.lt]: endOfDay
        }
      };
      
      // If query is numeric, search by brand_id
      if (isNumericQuery) {
        whereClause.brand_id = parseInt(query);
      }

      // Search across all pages using Sequelize ORM
      const searchResults = await BrandsDailyStatus.findAll({
        where: whereClause,
        include: [
          {
            model: Brand,
            as: 'brand',
            attributes: [
              'id',
              'name',
              'actual_name'
            ],
            required: true,
            where: isNumericQuery ? {} : {
              [Op.or]: [
                {
                  actual_name: {
                    [Op.iLike]: `%${query}%`
                  }
                },
                {
                  name: {
                    [Op.iLike]: `%${query}%`
                  }
                }
              ]
            }
          }
        ],
        attributes: [
          'brand_id',
          'active_ads',
          'inactive_ads',
          'stopped_ads',
          'comparative_status',
          'started_at'
        ],
        order: [['started_at', 'DESC']]
      });

      // Transform the search results
      const transformedSearchResults = searchResults.map(item => ({
        brand_id: item.brand_id,
        active_ads: item.active_ads,
        inactive_ads: item.inactive_ads,
        stopped_ads: item.stopped_ads,
        comparative_status: item.comparative_status,
        started_at: item.started_at,
        brand_name: item.brand?.actual_name || item.brand?.name || 'Unknown'
      }));

      return {
        success: true,
        data: {
          brands: transformedSearchResults,
          totalResults: transformedSearchResults.length,
          query: query,
          queryDate: targetDate.toISOString().split('T')[0]
        }
      };
    } catch (error) {
      console.error('Error in searchScrapedBrands:', error);
      return {
        success: false,
        error: 'Failed to search scraped brands',
        details: error.message
      };
    }
  }

  /**
   * Get scraped brands statistics for specific date
   * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to current date)
   * @returns {Object} - Statistics summary
   */
  static async getScrapedBrandsStats(date = null) {
    try {
      // Use provided date if given, otherwise use current date
      let targetDate;
      if (date) {
        targetDate = new Date(date);
      } else {
        targetDate = new Date();
      }
      
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

      // Get total counts
      const totalBrands = await BrandsDailyStatus.count({
        where: {
          started_at: {
            [Op.gte]: startOfDay,
            [Op.lt]: endOfDay
          }
        }
      });

      // Get aggregated stats
      const stats = await BrandsDailyStatus.findOne({
        where: {
          started_at: {
            [Op.gte]: startOfDay,
            [Op.lt]: endOfDay
          }
        },
        attributes: [
          [BrandsDailyStatus.sequelize.fn('SUM', BrandsDailyStatus.sequelize.col('active_ads')), 'totalActiveAds'],
          [BrandsDailyStatus.sequelize.fn('SUM', BrandsDailyStatus.sequelize.col('inactive_ads')), 'totalInactiveAds'],
          [BrandsDailyStatus.sequelize.fn('SUM', BrandsDailyStatus.sequelize.col('stopped_ads')), 'totalStoppedAds']
        ],
        raw: true
      });

      return {
        success: true,
        data: {
          totalBrands: totalBrands,
          totalActiveAds: parseInt(stats.totalActiveAds) || 0,
          totalInactiveAds: parseInt(stats.totalInactiveAds) || 0,
          totalStoppedAds: parseInt(stats.totalStoppedAds) || 0,
          currentDate: targetDate.toISOString().split('T')[0]
        }
      };
    } catch (error) {
      console.error('Error in getScrapedBrandsStats:', error);
      return {
        success: false,
        error: 'Failed to fetch scraped brands statistics',
        details: error.message
      };
    }
  }
}

module.exports = ScrapedBrandsService;
