const Sequelize = require("sequelize");
const { getDatabaseConnection } = require("../config/database");

const Ad = getDatabaseConnection().define(
  "ads",
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    library_id: {
      type: Sequelize.STRING,
      allowNull: false,
      index: true,
    },
    brand_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "brands",
        key: "id",
      },
    },
    started_at: {
      type: Sequelize.DATE,
    },
    ended_at: {
      type: Sequelize.DATE,
    },
    stopped_at: {
      type: Sequelize.DATE,
    },
    status: {
      type: Sequelize.ENUM("Active", "Inactive", "Stopped"),
    },
    quote: {
      type: Sequelize.TEXT,
    },
    last_synced_at: {
      type: Sequelize.DATE,
    },
    display_format: {
      type: Sequelize.STRING,
    },
    uid: {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    },
    platforms: {
      type: Sequelize.JSON,
    },
    ad_life: {
      type: Sequelize.STRING,
    },
    created_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    typesense_updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    typesense_id: {
      type: Sequelize.STRING,
    },
  },
  {
    tableName: "ads",
    timestamps: false,
  }
);

module.exports = Ad;
