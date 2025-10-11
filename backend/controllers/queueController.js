const queueReadController = require("./queueReadController");

const brandAddController = require("./brandAddController");

const csvUploadController = require("./csvUploadController");

module.exports = {
  ...queueReadController,

  ...brandAddController,

  ...csvUploadController,
};
