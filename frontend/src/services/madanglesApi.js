import { api } from '../utils/axios';

/**
 * API service for madangles-scraper integration
 * Handles CSV upload to madangles-scraper through the queue-dashboard backend
 */

/**
 * Upload CSV file to madangles-scraper
 * @param {File} file - CSV file to upload
 * @returns {Promise} Response from madangles-scraper
 */
export const uploadCsvToMadangles = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/madangles/upload-csv', formData, {
      // Don't set Content-Type manually - let the browser set it with boundary
      timeout: 60000, // 60 second timeout for large files
    });

    return response.data;
  } catch (error) {
    console.error('Error uploading CSV to madangles:', error);
    
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      throw new Error(error.response.data?.message || 'Failed to upload CSV to madangles-scraper');
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('No response from server. Please check your connection.');
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
};

/**
 * Check scraping completion status by checking if page_ids exist in database
 * @param {Array} pageIds - Array of page_ids to check
 * @returns {Promise} Scraping status information
 */
export const checkScrapingStatus = async (pageIds) => {
  try {
    const response = await api.post('/madangles/check-scraping-status', { pageIds });
    return response.data;
  } catch (error) {
    console.error('Error checking scraping status:', error);
    
    if (error.response) {
      throw new Error(error.response.data?.message || 'Failed to check scraping status');
    } else if (error.request) {
      throw new Error('No response from server. Please check your connection.');
    } else {
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
};

/**
 * Add scraped brands to queue (regular or watchlist)
 * @param {Array} pageIds - Array of page_ids to add to queue
 * @param {string} queueType - 'regular' or 'watchlist'
 * @returns {Promise} Queue addition result
 */
export const addScrapedBrandsToQueue = async (pageIds, queueType = 'regular') => {
  try {
    const response = await api.post('/madangles/add-to-queue', { 
      pageIds, 
      queueType 
    });
    return response.data;
  } catch (error) {
    console.error('Error adding brands to queue:', error);
    
    if (error.response) {
      throw new Error(error.response.data?.message || 'Failed to add brands to queue');
    } else if (error.request) {
      throw new Error('No response from server. Please check your connection.');
    } else {
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
};

/**
 * Get madangles-scraper service status
 * @returns {Promise} Service status information
 */
export const getMadanglesStatus = async () => {
  try {
    const response = await api.get('/api/madangles/status');
    return response.data;
  } catch (error) {
    console.error('Error getting madangles status:', error);
    throw new Error('Failed to get madangles-scraper status');
  }
};

export default {
  uploadCsvToMadangles,
  checkScrapingStatus,
  addScrapedBrandsToQueue,
  getMadanglesStatus,
};
