const Sequelize = require('sequelize');
const db = require('../config/database');

const BrandsDailyStatus = db.define(
  'brand_daily_statuses',
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    brand_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'brands',
        key: 'id',
      },
    },
    started_at: {
      type: Sequelize.DATE,
    },
    ended_at: {
      type: Sequelize.DATE,
    },
    active_ads: {
      type: Sequelize.INTEGER,
    },
    inactive_ads: {
      type: Sequelize.INTEGER,
    },
    stopped_ads: {
      type: Sequelize.INTEGER,
    },
    duration: {
      type: Sequelize.INTEGER,
    },
    status: {
      type: Sequelize.ENUM('Started', 'Completed', 'Blocked'),
      allowNull: true,
    },
    uuid: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    created_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    comparative_status: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    comparative_value: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    iterations: {
      type: Sequelize.INTEGER,
    },
  },
  {
    timestamps: true,
    freezeTableName: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

module.exports = BrandsDailyStatus;

