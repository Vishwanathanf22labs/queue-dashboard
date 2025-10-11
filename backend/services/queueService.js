const queueReadService = require("./queueReadService");
const queueOverviewService = require("./queueOverviewService");

const queueProcessingService = require("./queueProcessingService");

const brandManagementService = require("./brandManagementService");

const queueStatsService = require("./queueStatsService");

const queueManagementService = require("./queueManagementService");

module.exports = {
  ...queueReadService,
  ...queueOverviewService,

  ...queueProcessingService,

  ...brandManagementService,

  ...queueStatsService,

  ...queueManagementService,
};
