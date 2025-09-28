const Sequelize = require("sequelize");
const { getDatabaseConnection } = require("../config/database");

const AdMediaItem = getDatabaseConnection().define(
  "ads_media_items",
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ad_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "ads",
        key: "id",
      },
    },
    file_urls: {
      type: Sequelize.JSON,
      allowNull: true,
    },
    file_url_original: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    file_url_resized: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    file_url_preview: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    image_url: {
      type: Sequelize.TEXT,
    },
    image_url_aws: {
      type: Sequelize.TEXT,
    },
    video_url: {
      type: Sequelize.TEXT,
    },
    video_url_aws: {
      type: Sequelize.TEXT,
    },
    cta_text: {
      type: Sequelize.STRING,
    },
    cta_url: {
      type: Sequelize.TEXT,
    },
    cta_type: {
      type: Sequelize.STRING,
    },
    caption: {
      type: Sequelize.STRING,
    },
    title: {
      type: Sequelize.STRING,
    },
    body: {
      type: Sequelize.TEXT,
    },
    link_description: {
      type: Sequelize.TEXT,
    },
    uuid: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    created_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
  },
  {
    modelName: "ads_media_items",
    timestamps: true,
    underscored: true,
    hooks: {
      beforeUpdate: async (instance) => {
        instance.updated_at = new Date();
      },
      beforeBulkUpdate: async (options) => {
        options.fields.push("updated_at");
        options.attributes.updated_at = new Date();
      },
    },
  }
);

module.exports = AdMediaItem;

