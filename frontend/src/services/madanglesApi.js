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
  getMadanglesStatus,
};
