const { getBrandScrapingStatus } = require("./brandScrapingService");
const {
  getAllBrandsScrapingStatus,
  getOverallPipelineStats,
  searchBrandsPipelineStatus,
} = require("./allBrandsScrapingService");
const { getScrapingStats } = require("./scrapingStatsService");
const { getTypesenseStatus } = require("./typesenseService");
const { getFileUploadStatus } = require("./fileUploadService");

module.exports = {
  getBrandScrapingStatus,
  getAllBrandsScrapingStatus,
  getOverallPipelineStats,
  searchBrandsPipelineStatus,
  getScrapingStats,
  getTypesenseStatus,
  getFileUploadStatus,
};
