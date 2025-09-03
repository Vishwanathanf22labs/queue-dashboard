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

module.exports = {
  getScraperStatus
};
