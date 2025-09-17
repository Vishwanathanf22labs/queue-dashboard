// Export all pipeline services - Updated
const { getBrandScrapingStatus } = require("./brandScrapingService");
const { getAllBrandsScrapingStatus, getAllBrandsScrapingStatusSeparate, searchBrandsPipelineStatus } = require("./allBrandsScrapingService");
const { getScrapingStats } = require("./scrapingStatsService");
const { getTypesenseStatus } = require("./typesenseService");
const { getFileUploadStatus } = require("./fileUploadService");

module.exports = {
  getBrandScrapingStatus,
  getAllBrandsScrapingStatus,
  getAllBrandsScrapingStatusSeparate,
  searchBrandsPipelineStatus,
  getScrapingStats,
  getTypesenseStatus,
  getFileUploadStatus,
};
