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

Ad.hasMany(AdMediaItem, { foreignKey: 'ad_id', as: 'mediaItems' });
AdMediaItem.belongsTo(Ad, { foreignKey: 'ad_id', as: 'ad' });

module.exports = {
  Brand,
  WatchList,
  Ad,
  AdMediaItem,
  BrandsDailyStatus,
};

