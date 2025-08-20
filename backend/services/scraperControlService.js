const redis = require("../config/redis");
const logger = require("../utils/logger");
const { QUEUES } = require("../config/constants");

// Initialize default scraper status if none exists
async function initializeScraperStatus() {
  try {
    const currentStatus = await redis.get('scraper:status');
    
    if (!currentStatus) {
      // Set default status to 'stopped' if no status exists
      await redis.set('scraper:status', 'stopped', 'EX', 86400);
      await redis.set('scraper:stopped_at', new Date().toISOString(), 'EX', 86400);
      logger.info('Initialized scraper status to stopped');
      return 'stopped';
    }
    
    return currentStatus;
  } catch (error) {
    logger.error('Error initializing scraper status:', error);
    return 'stopped'; // Default fallback
  }
}

// START SCRAPER
async function startScraper() {
  try {
    const pendingCount = await redis.llen(QUEUES.PENDING_BRANDS);
    const failedCount = await redis.llen(QUEUES.FAILED_BRANDS);
    const currentStatus = await redis.get('scraper:status');
    
    // If scraper is already running
    if (currentStatus === 'running') {
      return {
        success: false,
        message: 'Scraper is already running',
        current_state: { pending: pendingCount, failed: failedCount, status: currentStatus }
      };
    }
    
    // Set status to running without moving any brands
    await redis.set('scraper:status', 'running', 'EX', 86400);
    await redis.set('scraper:started_at', new Date().toISOString(), 'EX', 86400);
    
    // Remove any paused status if it exists
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

// STOP SCRAPER
async function stopScraper() {
  try {
    // Get the currently processing brand before stopping
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
        // Store the brand info when stopping
        await redis.set('scraper:stopped_brand', JSON.stringify(currentBrandInfo), 'EX', 86400);
      }
    } catch (brandError) {
      logger.error('Error getting current brand info for stop:', brandError);
    }
    
    await redis.set('scraper:status', 'stopped', 'EX', 86400);
    await redis.set('scraper:stopped_at', new Date().toISOString(), 'EX', 86400);
    
    // Remove any paused status if it exists
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

// PAUSE SCRAPER
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
    
    // Get the currently processing brand before pausing
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
        // Store the brand info when pausing
        await redis.set('scraper:paused_brand', JSON.stringify(currentBrandInfo), 'EX', 86400);
      }
    } catch (brandError) {
      logger.error('Error getting current brand info for pause:', brandError);
    }
    
    // Just change status to paused without moving any brands
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

// RESUME SCRAPER
async function resumeScraper() {
  try {
    const currentStatus = await redis.get('scraper:status');
    
    if (currentStatus !== 'paused') {
      return { 
        success: false, 
        message: 'Scraper is not paused. Current status: ' + (currentStatus || 'unknown') 
      };
    }
    
    // Just change status back to running without moving any brands
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

// GET SCRAPER STATUS
async function getScraperStatus() {
  try {
    // Initialize status if none exists
    const status = await initializeScraperStatus();
    
    // Sync status to check if external process is actually running
    const syncedStatus = await syncScraperStatus();
    
    // Ensure we have a valid status
    const finalStatus = syncedStatus || status || 'stopped';
    
    const pendingCount = await redis.llen(QUEUES.PENDING_BRANDS);
    const failedCount = await redis.llen(QUEUES.FAILED_BRANDS);
    
    // Clean up any existing paused_brands queue (legacy cleanup)
    const pausedExists = await redis.exists('paused_brands');
    if (pausedExists) {
      await redis.del('paused_brands');
      logger.info('Cleaned up legacy paused_brands queue');
    }
    
    let statusDetails = {
      status: finalStatus,
      pending_count: pendingCount,
      failed_count: failedCount,
      total_queued: pendingCount + failedCount,
      timestamp: new Date().toISOString()
    };
    
    // Add specific timestamps and brand details
    if (finalStatus === 'paused') {
      const pausedAt = await redis.get('scraper:paused_at');
      statusDetails.paused_at = pausedAt;
      
      // Get the brand that was paused from stored info
      try {
        const pausedBrandData = await redis.get('scraper:paused_brand');
        if (pausedBrandData) {
          const brandInfo = JSON.parse(pausedBrandData);
          statusDetails.paused_brand = {
            id: brandInfo.id,
            name: brandInfo.name,
            page_id: brandInfo.page_id
          };
        }
      } catch (brandError) {
        logger.error('Error getting paused brand details:', brandError);
      }
    } else if (finalStatus === 'stopped') {
      const stoppedAt = await redis.get('scraper:stopped_at');
      statusDetails.stopped_at = stoppedAt;
      
      // Get the brand that was stopped from stored info
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
    } else if (finalStatus === 'running') {
      const startedAt = await redis.get('scraper:started_at');
      statusDetails.started_at = startedAt;
      
      // Get currently processing brand
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
    // Return a default status on error
    return {
      status: 'stopped',
      pending_count: 0,
      failed_count: 0,
      total_queued: 0,
      timestamp: new Date().toISOString()
    };
  }
}

// Check if external scraper process is running and sync status
async function syncScraperStatus() {
  try {
    // Get the current status from Redis
    const currentStatus = await redis.get('scraper:status');
    
    // If no status exists, return 'stopped' (this shouldn't happen due to initialization)
    if (!currentStatus) {
      logger.warn('No scraper status found, returning stopped');
      return 'stopped';
    }
    
    // If status is 'running' but no recent activity, check if it's actually running
    if (currentStatus === 'running') {
      const startedAt = await redis.get('scraper:started_at');
      if (startedAt) {
        const startTime = new Date(startedAt);
        const now = new Date();
        const timeDiff = now - startTime;
        
        // If scraper has been "running" for more than 10 minutes without activity, 
        // it might have crashed - set to stopped
        if (timeDiff > 10 * 60 * 1000) { // 10 minutes
          logger.warn('Scraper appears to have crashed, setting status to stopped');
          await redis.set('scraper:status', 'stopped', 'EX', 86400);
          await redis.set('scraper:stopped_at', new Date().toISOString(), 'EX', 86400);
          return 'stopped';
        }
      }
    }
    
    return currentStatus;
  } catch (error) {
    logger.error('Error syncing scraper status:', error);
    return 'stopped';
  }
}

module.exports = {
  startScraper,
  stopScraper,
  pauseScraper,
  resumeScraper,
  getScraperStatus,
  syncScraperStatus,
  initializeScraperStatus
};