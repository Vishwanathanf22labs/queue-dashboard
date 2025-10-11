const scraperControlService = require("../services/scraperControlService");

async function getScraperStatus(req, res) {
  try {
    const status = await scraperControlService.getScraperStatus(
      req.environment
    );
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({
      status: "not_running",
    });
  }
}

async function startScraper(req, res) {
  try {
    const result = await scraperControlService.startScraper(req.environment);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      status: "unknown",
    });
  }
}

async function stopScraper(req, res) {
  try {
    const result = await scraperControlService.stopScraper(req.environment);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      status: "unknown",
    });
  }
}

async function getBrandTiming(req, res) {
  try {
    const data = await scraperControlService.getBrandTiming(req.environment);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch brand timing" });
  }
}

module.exports = {
  getScraperStatus,
  startScraper,
  stopScraper,
  getBrandTiming,
};
