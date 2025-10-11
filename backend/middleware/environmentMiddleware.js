const logger = require("../utils/logger");
function environmentMiddleware(req, res, next) {
  const environment = req.headers["x-environment"] || "production";

  const validEnvironments = ["production", "stage"];
  if (!validEnvironments.includes(environment)) {
    logger.warn(
      `Invalid environment received: ${environment}, defaulting to production`
    );
    req.environment = "production";
  } else {
    req.environment = environment;
  }

  logger.debug(
    `Request using environment: ${req.environment} (URL: ${req.url}, Method: ${req.method})`
  );

  next();
}

module.exports = environmentMiddleware;
