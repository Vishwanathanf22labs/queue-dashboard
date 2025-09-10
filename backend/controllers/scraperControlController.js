const scraperControlService = require('../services/scraperControlService');

async function getScraperStatus(req, res) {
  try {
    const status = await scraperControlService.getScraperStatus();
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({
      status: 'not_running'
    });
  }
}

async function startScraper(req, res) {
  try {
    const result = await scraperControlService.startScraper();
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      status: 'unknown'
    });
  }
}

async function stopScraper(req, res) {
  try {
    const result = await scraperControlService.stopScraper();
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      status: 'unknown'
    });
  }
}

module.exports = {
  getScraperStatus,
  startScraper,
  stopScraper
};
