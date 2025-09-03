const { DataTypes } = require("sequelize");
const db = require("../config/database");

const Brand = db.define(
  "brands",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    actual_name: {
      type: DataTypes.STRING,
    },
    page_id: {
      type: DataTypes.STRING,
      unique: true,
      index: true,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
    },
    ig_handle: {
      type: DataTypes.STRING,
    },
    ig_followers: {
      type: DataTypes.INTEGER,
    },
    fb_page: {
      type: DataTypes.STRING,
    },
    total_live_ads: {
      type: DataTypes.INTEGER,
    },
    fb_likes: {
      type: DataTypes.INTEGER,
    },
    logo_url: {
      type: DataTypes.TEXT,
    },
    logo_url_aws: {
      type: DataTypes.TEXT,
    },
    category: {
      type: DataTypes.STRING,
    },
    priority: {
      type: DataTypes.INTEGER,
    },
    website: {
      type: DataTypes.STRING,
      index: true,
      unique: true,
      allowNull: true,
    },
    last_synced_at: {
      type: DataTypes.DATE,
    },
    status: {
      type: DataTypes.ENUM("Active", "Inactive", "Incomplete"),
    },
    created_at: {
      type: DataTypes.DATE,
    },
    updated_at: {
      type: DataTypes.DATE,
    },
    total_ads: {
      type: DataTypes.INTEGER,
    },
    uid: {
      type: DataTypes.UUID,
    },
  },
  { timestamps: false }
);

module.exports = Brand;
