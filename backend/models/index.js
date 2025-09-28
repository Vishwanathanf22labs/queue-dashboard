const { getDatabaseConnection } = require('../config/database');
const Brand = require('./Brand');
const WatchList = require('./WatchList');
const Ad = require('./Ad');
const AdMediaItem = require('./AdMediaItem');
const BrandsDailyStatus = require('./BrandsDailyStatus');

// Define associations
Brand.hasMany(Ad, { foreignKey: 'brand_id', as: 'ads' });
Ad.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });

Brand.hasMany(BrandsDailyStatus, { foreignKey: 'brand_id', as: 'dailyStatuses' });
BrandsDailyStatus.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });

Brand.hasMany(WatchList, { foreignKey: 'brand_id', as: 'watchLists' });
WatchList.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });

Ad.hasMany(AdMediaItem, { foreignKey: 'ad_id', as: 'mediaItems' });
AdMediaItem.belongsTo(Ad, { foreignKey: 'ad_id', as: 'ad' });

// Function to reinitialize models when environment changes
async function reinitializeModels() {
  try {
    // Wait a moment for the database connection to be ready
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Clear require cache for all model files and this index file
    const modelFiles = [
      require.resolve('./Brand'),
      require.resolve('./WatchList'),
      require.resolve('./Ad'),
      require.resolve('./AdMediaItem'),
      require.resolve('./BrandsDailyStatus'),
      __filename
    ];
    
    modelFiles.forEach(file => {
      delete require.cache[file];
    });
    
    // Also clear any cached database connection
    delete require.cache[require.resolve('../config/database')];
    
    // Wait a bit more for the cache to clear
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Re-require the database connection first
    const { getDatabaseConnection } = require('../config/database');
    
    // Re-require the models
    const BrandNew = require('./Brand');
    const WatchListNew = require('./WatchList');
    const AdNew = require('./Ad');
    const AdMediaItemNew = require('./AdMediaItem');
    const BrandsDailyStatusNew = require('./BrandsDailyStatus');
    
    // Note: Associations are already defined in the individual model files
    // No need to redefine them here as they will be automatically established
    // when the models are re-required with the new database connection
    
    console.log("Models reinitialized for environment switch");
    
    return {
      Brand: BrandNew,
      WatchList: WatchListNew,
      Ad: AdNew,
      AdMediaItem: AdMediaItemNew,
      BrandsDailyStatus: BrandsDailyStatusNew,
    };
  } catch (error) {
    console.error("Error reinitializing models:", error);
    throw error;
  }
}

module.exports = {
  Brand,
  WatchList,
  Ad,
  AdMediaItem,
  BrandsDailyStatus,
  reinitializeModels,
};

