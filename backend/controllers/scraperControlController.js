const scraperControlService = require('../services/scraperControlService');
const logger = require('../utils/logger');

async function startScraper(req, res) {
  try {
    const result = await scraperControlService.startScraper();
    res.status(200).json({
      success: true,
      message: 'Scraper start command sent successfully',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error starting scraper:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start scraper',
      error: error.message
    });
  }
}

async function stopScraper(req, res) {
  try {
    const result = await scraperControlService.stopScraper();
    res.status(200).json({
      success: true,
      message: 'Scraper stop command sent successfully',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error stopping scraper:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop scraper',
      error: error.message
    });
  }
}

async function pauseScraper(req, res) {
  try {
    const result = await scraperControlService.pauseScraper();
    res.status(200).json({
      success: true,
      message: 'Scraper pause command sent successfully',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error pausing scraper:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pause scraper',
      error: error.message
    });
  }
}

async function resumeScraper(req, res) {
  try {
    const result = await scraperControlService.resumeScraper();
    res.status(200).json({
      success: true,
      message: 'Scraper resume command sent successfully',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error resuming scraper:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resume scraper',
      error: error.message
    });
  }
}

async function getScraperStatus(req, res) {
  try {
    const status = await scraperControlService.getScraperStatus();
    res.status(200).json({
      success: true,
      message: 'Scraper status retrieved successfully',
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting scraper status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scraper status',
      error: error.message
    });
  }
}

async function debugScraperStatus(req, res) {
  try {
    const redis = require('../config/redis');
    
    // Get all scraper-related keys
    const scraperStatus = await redis.get('scraper:status');
    const startedAt = await redis.get('scraper:started_at');
    const pausedAt = await redis.get('scraper:paused_at');
    const stoppedAt = await redis.get('scraper:stopped_at');
    
    // Force initialize if no status exists
    if (!scraperStatus) {
      await scraperControlService.initializeScraperStatus();
      logger.info('Forced initialization of scraper status');
    }
    
    const finalStatus = await scraperControlService.getScraperStatus();
    
    res.status(200).json({
      success: true,
      message: 'Scraper debug info retrieved successfully',
      data: {
        current_status: finalStatus,
        redis_keys: {
          'scraper:status': scraperStatus,
          'scraper:started_at': startedAt,
          'scraper:paused_at': pausedAt,
          'scraper:stopped_at': stoppedAt
        },
        action_taken: !scraperStatus ? 'Initialized missing status' : 'Status already exists'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error debugging scraper status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to debug scraper status',
      error: error.message
    });
  }
}

module.exports = {
  startScraper,
  stopScraper,
  pauseScraper,
  resumeScraper,
  getScraperStatus,
  debugScraperStatus
};