const { Op } = require('sequelize');

class ScrapedBrandsService {
  /**
   * Get scraped brands for specific date with pagination
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 10)
   * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to current date)
   * @returns {Object} - Paginated results with brands data
   */
  static async getScrapedBrands(page = 1, limit = 10, date = null, sortBy = 'normal', sortOrder = 'desc', environment = 'production') {
    try {
      // Get models for the specified environment
      const { getModels } = require('../models');
      const { Brand, BrandsDailyStatus, WatchList } = getModels(environment);
      
      // Use provided date if given, otherwise use current date
      let targetDate;
      if (date) {
        targetDate = new Date(date);
      } else {
        targetDate = new Date();
      }
      
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

      // Get watchlist brand IDs for marking and sorting
      const watchlistRecords = await WatchList.findAll({
        attributes: ["brand_id"],
        raw: true
      });
      const watchlistBrandIds = watchlistRecords.map(record => record.brand_id);

      // Get all brand records first (without pagination) to sort properly
      const allDailyStatusRecords = await BrandsDailyStatus.findAll({
        where: {
          started_at: {
            [Op.gte]: startOfDay,
            [Op.lt]: endOfDay
          }
        },
        attributes: ["brand_id", "active_ads", "inactive_ads", "started_at"],
        order: [["brand_id", "DESC"], ["started_at", "DESC"]]
      });

      // Group by brand_id and get the latest record for each brand
      const brandMap = new Map();
      allDailyStatusRecords.forEach(record => {
        const brandId = record.brand_id;
        if (!brandMap.has(brandId) || new Date(record.started_at) > new Date(brandMap.get(brandId).started_at)) {
          brandMap.set(brandId, record);
        }
      });

      // Convert map to array for sorting
      const uniqueBrandRecords = Array.from(brandMap.values());

      // Sort brands based on sorting parameters
      let sortedBrandIds;
      
      if (sortBy === 'normal') {
        // Default sorting: watchlist first, then regular
        sortedBrandIds = uniqueBrandRecords
          .map(record => record.brand_id)
          .sort((a, b) => {
            const aIsWatchlist = watchlistBrandIds.includes(a);
            const bIsWatchlist = watchlistBrandIds.includes(b);
            
            if (aIsWatchlist && !bIsWatchlist) return -1; // a (watchlist) comes first
            if (!aIsWatchlist && bIsWatchlist) return 1;  // b (watchlist) comes first
            return 0; // maintain original order for same type
          });
      } else {
        // Sort by active_ads or inactive_ads
        const recordsWithData = uniqueBrandRecords.map(record => ({
          brand_id: record.brand_id,
          active_ads: record.active_ads || 0,
          inactive_ads: record.inactive_ads || 0,
          isWatchlist: watchlistBrandIds.includes(record.brand_id)
        }));

        recordsWithData.sort((a, b) => {
          let aValue, bValue;
          
          if (sortBy === 'active_ads') {
            aValue = parseInt(a.active_ads) || 0;
            bValue = parseInt(b.active_ads) || 0;
          } else if (sortBy === 'inactive_ads') {
            aValue = parseInt(a.inactive_ads) || 0;
            bValue = parseInt(b.inactive_ads) || 0;
          } else {
            // Fallback to brand_id
            aValue = parseInt(a.brand_id) || 0;
            bValue = parseInt(b.brand_id) || 0;
          }
          
          if (sortOrder === 'asc') {
            return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
          } else {
            return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
          }
        });

        sortedBrandIds = recordsWithData.map(record => record.brand_id);
      }

      // Update total count after sorting
      const totalCount = sortedBrandIds.length;

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Apply pagination to sorted results
      const paginatedBrandIds = sortedBrandIds.slice(offset, offset + limit);

      if (paginatedBrandIds.length === 0) {
        return {
          success: true,
          data: {
            brands: [],
            pagination: {
              currentPage: page,
              totalPages: Math.ceil(totalCount / limit),
              totalItems: totalCount,
              itemsPerPage: limit,
              hasNextPage: page < Math.ceil(totalCount / limit),
              hasPrevPage: page > 1
            },
            queryDate: targetDate.toISOString().split('T')[0]
          }
        };
      }

      // Get paginated data with brand information using Sequelize ORM
      const scrapedBrands = await BrandsDailyStatus.findAll({
        where: {
          brand_id: { [Op.in]: paginatedBrandIds },
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
              'actual_name',
              'page_id'
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
        ]
        // Removed order clause to preserve our custom sorting
      });

      // Create a map for quick lookup of brand data
      const brandDataMap = new Map();
      scrapedBrands.forEach(item => {
        brandDataMap.set(item.brand_id, item);
      });

      // Transform the data in the correct sorted order
      const transformedBrands = paginatedBrandIds.map(brandId => {
        const item = brandDataMap.get(brandId);
        if (!item) return null;
        
        return {
          brand_id: item.brand_id,
          active_ads: item.active_ads,
          inactive_ads: item.inactive_ads,
          stopped_ads: item.stopped_ads,
          comparative_status: item.comparative_status,
          started_at: item.started_at,
          brand_name: item.brand?.actual_name || item.brand?.name || 'Unknown',
          page_id: item.brand?.page_id || null, // Add page_id for external link
          isWatchlist: watchlistBrandIds.includes(item.brand_id) // Add watchlist flag
        };
      }).filter(Boolean); // Remove any null entries

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
  static async searchScrapedBrands(query, date = null, environment = 'production') {
    try {
      // Get models for the specified environment
      const { getModels } = require('../models');
      const { Brand, BrandsDailyStatus, WatchList } = getModels(environment);
      
      // Use provided date if given, otherwise use current date
      let targetDate;
      if (date) {
        targetDate = new Date(date);
      } else {
        targetDate = new Date();
      }
      
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

      // Get watchlist brand IDs for marking
      const watchlistRecords = await WatchList.findAll({
        attributes: ["brand_id"],
        raw: true
      });
      const watchlistBrandIds = watchlistRecords.map(record => record.brand_id);

      // Check if query is numeric for brand_id search
      const isNumericQuery = !isNaN(query) && !isNaN(parseInt(query));
      
      // 🔍 Normalize search query - remove spaces and make lowercase for flexible matching
      const normalizedQuery = query.toLowerCase().replace(/\s+/g, '');
      
      // Build where clause based on query type
      let whereClause = {
        started_at: {
          [Op.gte]: startOfDay,
          [Op.lt]: endOfDay
        }
      };
      
      // Search across all pages using Sequelize ORM with flexible matching
      const searchResults = await BrandsDailyStatus.findAll({
        where: whereClause,
        include: [
          {
            model: Brand,
            as: 'brand',
            attributes: [
              'id',
              'name',
              'actual_name',
              'page_id'
            ],
            required: true,
            where: isNumericQuery ? {
              [Op.or]: [
                { page_id: query }, // Search by page_id as string (handles leading zeros like '0004')
                { id: parseInt(query) } // Also search by brand_id as integer
              ]
            } : {
              [Op.or]: [
                // 🔍 Exact match with spaces
                {
                  actual_name: {
                    [Op.iLike]: `%${query}%`
                  }
                },
                {
                  name: {
                    [Op.iLike]: `%${query}%`
                  }
                },
                // 🔍 Flexible match without spaces (for "redbull" to find "Red Bull")
                {
                  [Op.and]: [
                    BrandsDailyStatus.sequelize.where(
                      BrandsDailyStatus.sequelize.fn('LOWER', 
                        BrandsDailyStatus.sequelize.fn('REPLACE', 
                          BrandsDailyStatus.sequelize.col('brand.actual_name'), ' ', ''
                        )
                      ),
                      'LIKE',
                      `%${normalizedQuery}%`
                    )
                  ]
                },
                {
                  [Op.and]: [
                    BrandsDailyStatus.sequelize.where(
                      BrandsDailyStatus.sequelize.fn('LOWER', 
                        BrandsDailyStatus.sequelize.fn('REPLACE', 
                          BrandsDailyStatus.sequelize.col('brand.name'), ' ', ''
                        )
                      ),
                      'LIKE',
                      `%${normalizedQuery}%`
                    )
                  ]
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

      // Transform the search results with watchlist flag
      const transformedSearchResults = searchResults.map(item => ({
        brand_id: item.brand_id,
        active_ads: item.active_ads,
        inactive_ads: item.inactive_ads,
        stopped_ads: item.stopped_ads,
        comparative_status: item.comparative_status,
        started_at: item.started_at,
        brand_name: item.brand?.actual_name || item.brand?.name || 'Unknown',
        page_id: item.brand?.page_id || null, // Add page_id for external link
        isWatchlist: watchlistBrandIds.includes(item.brand_id) // Add watchlist flag
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
  static async getScrapedBrandsStats(date = null, environment = 'production') {
    try {
      // Get models for the specified environment
      const { getModels } = require('../models');
      const { Brand, BrandsDailyStatus, WatchList } = getModels(environment);
      
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
