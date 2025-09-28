const Sequelize = require('sequelize');
const { getDatabaseConnection } = require('../config/database');

const WatchList = getDatabaseConnection().define(
  'watch_lists',
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    brand_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at',
    },
    updatedAt: {
      type: Sequelize.DATE,
      field: 'updated_at',
      allowNull: true,
    },
  },
  { 
    tableName: 'watch_lists', 
    timestamps: false 
  },
);

module.exports = WatchList;
