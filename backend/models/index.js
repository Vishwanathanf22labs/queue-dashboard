const { getDatabaseConnection } = require("../config/database");
const { DataTypes } = require("sequelize");

const modelsCache = {
  production: null,
  stage: null,
};

function getModels(environment = "production") {
  if (modelsCache[environment]) {
    return modelsCache[environment];
  }

  const sequelize = getDatabaseConnection(environment);

  const Brand = sequelize.define(
    "brands",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT },
      actual_name: { type: DataTypes.STRING },
      page_id: {
        type: DataTypes.STRING,
        unique: true,
        index: true,
        allowNull: false,
      },
      url: { type: DataTypes.STRING },
      ig_handle: { type: DataTypes.STRING },
      ig_followers: { type: DataTypes.INTEGER },
      fb_page: { type: DataTypes.STRING },
      total_live_ads: { type: DataTypes.INTEGER },
      fb_likes: { type: DataTypes.INTEGER },
      logo_url: { type: DataTypes.TEXT },
      logo_url_aws: { type: DataTypes.TEXT },
      category: { type: DataTypes.STRING },
      priority: { type: DataTypes.STRING },
      website: {
        type: DataTypes.STRING,
        index: true,
        unique: true,
        allowNull: true,
      },
      last_synced_at: { type: DataTypes.DATE },
      status: { type: DataTypes.ENUM("Active", "Inactive", "Incomplete") },
      created_at: { type: DataTypes.DATE },
      updated_at: { type: DataTypes.DATE },
      total_ads: { type: DataTypes.INTEGER },
      uid: { type: DataTypes.STRING },
      actual_ads_count: { type: DataTypes.INTEGER },
    },
    { timestamps: false }
  );

  const WatchList = sequelize.define(
    "watch_list",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      brand_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "brands", key: "id" },
      },
      created_at: { type: DataTypes.DATE },
      updated_at: { type: DataTypes.DATE },
    },
    { timestamps: false }
  );

  const Ad = sequelize.define(
    "ads",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      brand_id: {
        type: DataTypes.INTEGER,
        references: { model: "brands", key: "id" },
      },
      ad_archive_id: { type: DataTypes.STRING, unique: true, allowNull: false },
      ad_creative_body: { type: DataTypes.TEXT },
      ad_creative_link_title: { type: DataTypes.TEXT },
      ad_creative_link_caption: { type: DataTypes.TEXT },
      ad_creative_link_description: { type: DataTypes.TEXT },
      ad_delivery_start_time: { type: DataTypes.DATE },
      ad_delivery_stop_time: { type: DataTypes.DATE },
      ad_snapshot_url: { type: DataTypes.TEXT },
      page_name: { type: DataTypes.STRING },
      page_id: { type: DataTypes.STRING },
      created_at: { type: DataTypes.DATE },
      updated_at: { type: DataTypes.DATE },
    },
    { timestamps: false }
  );

  const AdMediaItem = sequelize.define(
    "ad_media_items",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      ad_id: {
        type: DataTypes.INTEGER,
        references: { model: "ads", key: "id" },
      },
      media_type: { type: DataTypes.STRING },
      media_url: { type: DataTypes.TEXT },
      video_preview_image_url: { type: DataTypes.TEXT },
      created_at: { type: DataTypes.DATE },
      updated_at: { type: DataTypes.DATE },
    },
    { timestamps: false }
  );

  const BrandsDailyStatus = sequelize.define(
    "brand_daily_statuses",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      brand_id: {
        type: DataTypes.INTEGER,
        references: { model: "brands", key: "id" },
      },
      date: { type: DataTypes.DATEONLY },
      status: { type: DataTypes.STRING },
      active_ads: { type: DataTypes.INTEGER },
      inactive_ads: { type: DataTypes.INTEGER },
      stopped_ads: { type: DataTypes.INTEGER },
      comparative_status: { type: DataTypes.STRING },
      started_at: { type: DataTypes.DATE },
      created_at: { type: DataTypes.DATE },
      updated_at: { type: DataTypes.DATE },
    },
    {
      timestamps: false,
      freezeTableName: true,
    }
  );

  Brand.hasMany(Ad, { foreignKey: "brand_id", as: "ads" });
  Ad.belongsTo(Brand, { foreignKey: "brand_id", as: "brand" });

  Brand.hasMany(BrandsDailyStatus, {
    foreignKey: "brand_id",
    as: "dailyStatuses",
  });
  BrandsDailyStatus.belongsTo(Brand, { foreignKey: "brand_id", as: "brand" });

  Brand.hasMany(WatchList, { foreignKey: "brand_id", as: "watchLists" });
  WatchList.belongsTo(Brand, { foreignKey: "brand_id", as: "brand" });

  Ad.hasMany(AdMediaItem, { foreignKey: "ad_id", as: "mediaItems" });
  AdMediaItem.belongsTo(Ad, { foreignKey: "ad_id", as: "ad" });

  const models = {
    Brand,
    WatchList,
    Ad,
    AdMediaItem,
    BrandsDailyStatus,
    sequelize,
  };

  modelsCache[environment] = models;
  return models;
}

const productionModels = getModels("production");
const stageModels = getModels("stage");

const { Brand, WatchList, Ad, AdMediaItem, BrandsDailyStatus } =
  productionModels;

async function reinitializeModels() {
  console.log(
    "reinitializeModels called - No action needed (multi-environment support enabled)"
  );
  return productionModels;
}

module.exports = {
  Brand,
  WatchList,
  Ad,
  AdMediaItem,
  BrandsDailyStatus,
  getModels,
  reinitializeModels,
};
