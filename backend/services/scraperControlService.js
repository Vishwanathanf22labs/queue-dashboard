const redis = require("../config/redis");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");


async function startScraper() {
  try {
    const pendingCount = await redis.zcard(QUEUES.PENDING_BRANDS);
    const failedCount = await redis.llen(QUEUES.FAILED_BRANDS);
    const currentStatus = await redis.get('scraper:status');
    
 
    if (currentStatus === 'running') {
      return {
        success: false,
        message: 'Scraper is already running',
        current_state: { pending: pendingCount, failed: failedCount, status: currentStatus }
      };
    }
    

    await redis.set('scraper:status', 'running', 'EX', 86400);
    await redis.set('scraper:started_at', new Date().toISOString(), 'EX', 86400);
    
 
    await redis.del('scraper:paused_at');
    
    logger.info('Scraper started successfully');
    
    return {
      success: true,
      message: 'Scraper started successfully',
      action: 'started',
      current_state: {
        pending: pendingCount,
        failed: failedCount,
        status: 'running'
      }
    };
    
  } catch (error) {
    logger.error('Error starting scraper:', error);
    throw error;
  }
}


async function stopScraper() {
  try {
    let currentBrandInfo = null;
    try {
      const { getCurrentlyProcessing } = require('./queueOverviewService');
      const currentlyProcessing = await getCurrentlyProcessing();
      if (currentlyProcessing) {
        currentBrandInfo = {
          id: currentlyProcessing.brand_id || 'unknown',
          name: currentlyProcessing.brand_name || 'Unknown Brand',
          page_id: currentlyProcessing.page_id || 'unknown'
        };
  
        await redis.set('scraper:stopped_brand', JSON.stringify(currentBrandInfo), 'EX', 86400);
      }
    } catch (brandError) {
      logger.error('Error getting current brand info for stop:', brandError);
    }
    
    await redis.set('scraper:status', 'stopped', 'EX', 86400);
    await redis.set('scraper:stopped_at', new Date().toISOString(), 'EX', 86400);
    

    await redis.del('scraper:paused_at');
    await redis.del('scraper:paused_brand');
    
    logger.info('Scraper stopped');
    
    return {
      success: true,
      message: 'Scraper stopped successfully.',
      action: 'stopped',
      timestamp: new Date().toISOString(),
      stopped_brand: currentBrandInfo
    };
  } catch (error) {
    logger.error('Error stopping scraper:', error);
    throw error;
  }
}


async function pauseScraper() {
  try {
    const currentStatus = await redis.get('scraper:status');
    
    if (currentStatus === 'paused') {
      return { 
        success: false, 
        message: 'Scraper is already paused' 
      };
    }
    
    if (currentStatus === 'stopped') {
      return { 
        success: false, 
        message: 'Cannot pause stopped scraper. Start the scraper first.' 
      };
    }

    let currentBrandInfo = null;
    try {
      const { getCurrentlyProcessing } = require('./queueOverviewService');
      const currentlyProcessing = await getCurrentlyProcessing();
      if (currentlyProcessing) {
        currentBrandInfo = {
          id: currentlyProcessing.brand_id || 'unknown',
          name: currentlyProcessing.brand_name || 'Unknown Brand',
          page_id: currentlyProcessing.page_id || 'unknown'
        };
  
        await redis.set('scraper:paused_brand', JSON.stringify(currentBrandInfo), 'EX', 86400);
      }
    } catch (brandError) {
      logger.error('Error getting current brand info for pause:', brandError);
    }
    

    await redis.set('scraper:status', 'paused', 'EX', 86400);
    await redis.set('scraper:paused_at', new Date().toISOString(), 'EX', 86400);
    
    logger.info('Scraper paused successfully');
    
    return {
      success: true,
      message: 'Scraper paused successfully. Brands remain in their current queues.',
      action: 'paused',
      timestamp: new Date().toISOString(),
      paused_brand: currentBrandInfo
    };
  } catch (error) {
    logger.error('Error pausing scraper:', error);
    throw error;
  }
}


async function resumeScraper() {
  try {
    const currentStatus = await redis.get('scraper:status');
    
    if (currentStatus !== 'paused') {
      return { 
        success: false, 
        message: 'Scraper is not paused. Current status: ' + (currentStatus || 'unknown') 
      };
    }
    

    await redis.set('scraper:status', 'running', 'EX', 86400);
    await redis.set('scraper:started_at', new Date().toISOString(), 'EX', 86400);
    await redis.del('scraper:paused_at');
    
    logger.info('Scraper resumed successfully');
    
    return {
      success: true,
      message: 'Scraper resumed successfully. Brands remain in their current queues.',
      action: 'resumed',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error resuming scraper:', error);
    throw error;
  }
}


async function getScraperStatus() {
  try {
    const currentStatus = await redis.get('scraper:status');
    
    const pendingCount = await redis.zcard(QUEUES.PENDING_BRANDS);
    const failedCount = await redis.llen(QUEUES.FAILED_BRANDS);
    
    const statusDetails = {
      status: currentStatus || 'stopped',
      pending_count: pendingCount,
      failed_count: failedCount,
      total_queued: pendingCount + failedCount,
      timestamp: new Date().toISOString()
    };
    
   
    if (currentStatus === 'paused') {
      const pausedAt = await redis.get('scraper:paused_at');
      statusDetails.paused_at = pausedAt;
      
     
      try {
        const pausedBrandData = await redis.get('scraper:paused_brand');
        if (pausedBrandData) {
          const brandInfo = JSON.parse(pausedBrandData);
          statusDetails.last_processed_brand = {
            id: brandInfo.id,
            name: brandInfo.name,
            page_id: brandInfo.page_id
          };
        }
      } catch (brandError) {
        logger.error('Error getting paused brand details:', brandError);
      }
    } else if (currentStatus === 'stopped') {
      const stoppedAt = await redis.get('scraper:stopped_at');
      statusDetails.stopped_at = stoppedAt;

      try {
        const stoppedBrandData = await redis.get('scraper:stopped_brand');
        if (stoppedBrandData) {
          const brandInfo = JSON.parse(stoppedBrandData);
          statusDetails.last_processed_brand = {
            id: brandInfo.id,
            name: brandInfo.name,
            page_id: brandInfo.page_id
          };
        }
      } catch (brandError) {
        logger.error('Error getting stopped brand details:', brandError);
      }
    } else if (currentStatus === 'running') {
      const startedAt = await redis.get('scraper:started_at');
      statusDetails.started_at = startedAt;

      try {
        const { getCurrentlyProcessing } = require('./queueOverviewService');
        const currentlyProcessing = await getCurrentlyProcessing();
        if (currentlyProcessing) {
          statusDetails.current_brand = {
            name: currentlyProcessing.brand_name,
            page_id: currentlyProcessing.page_id,
            started_at: currentlyProcessing.started_at
          };
        }
      } catch (brandError) {
        logger.error('Error getting current brand details:', brandError);
      }
    }
    
    return statusDetails;
  } catch (error) {
    logger.error('Error getting scraper status:', error);
   
    return {
      status: 'stopped',
      pending_count: 0,
      failed_count: 0,
      total_queued: 0,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  startScraper,
  stopScraper,
  pauseScraper,
  resumeScraper,
  getScraperStatus
};