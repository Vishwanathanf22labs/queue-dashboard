function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data }),
  };
  console.log(JSON.stringify(logEntry));
}

function info(message, data = null) {
  log("INFO", message, data);
}

function error(message, error = null) {
  log(
    "ERROR",
    message,
    error
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
      : null
  );
}

function warn(message, data = null) {
  log("WARN", message, data);
}

function debug(message, data = null) {
  log("DEBUG", message, data);
}

module.exports = {
  log,
  info,
  error,
  warn,
  debug,
};
