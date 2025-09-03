// Queue Core Services
const queueReadService = require("./queueReadService");
const queueOverviewService = require("./queueOverviewService");

// Queue Processing Services
const queueProcessingService = require("./queueProcessingService");

// Brand Management Services
const brandManagementService = require("./brandManagementService");

// Queue Stats Services
const queueStatsService = require("./queueStatsService");

// Queue Management Services
const queueManagementService = require("./queueManagementService");

module.exports = {
  // Queue Core
  ...queueReadService,
  ...queueOverviewService,

  // Queue Processing
  ...queueProcessingService,

  // Brand Management
  ...brandManagementService,

  // Queue Stats
  ...queueStatsService,

  // Queue Management
  ...queueManagementService,
};
