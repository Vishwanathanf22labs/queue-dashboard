import { api } from '../utils/axios';

export const uploadCsvToMadangles = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/madangles/upload-csv', formData, {
      timeout: 60000,
    });

    return response.data;
  } catch (error) {
    console.error('Error uploading CSV to madangles:', error);

    if (error.response) {
      throw new Error(error.response.data?.message || 'Failed to upload CSV to madangles-scraper');
    } else if (error.request) {
      throw new Error('No response from server. Please check your connection.');
    } else {
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
};


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
