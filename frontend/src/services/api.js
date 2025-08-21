import { api } from "../utils/axios";

export const queueAPI = {
 
  getOverview: () => api.get('/queue/overview'),
 
  getPendingBrands: (page = 1, limit = 100, search = null) => {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('limit', limit);
    if (search && search.trim()) params.append('search', search);
    return api.get(`/queue/pending?${params.toString()}`);
  },

  getFailedBrands: (page = 1, limit = 100, search = null) => {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('limit', limit);
    if (search && search.trim()) params.append('search', search);
    return api.get(`/queue/failed?${params.toString()}`);
  },
  
  
  getCurrentlyProcessing: () => api.get('/queue/currently-processing'),

  getNextBrand: () => api.get('/queue/next-brand'),
  
 
  getStats: () => api.get('/queue/stats'),
  
  
  getBrandProcessingQueue: (page = 1, limit = 10) => api.get(`/queue/brand-processing?page=${page}&limit=${limit}`),
  

  getScrapedStats: (date = null, days = null) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (days) params.append('days', days);
    return api.get(`/queue/scraped-stats?${params.toString()}`);
  },
  

  addSingleBrand: (data) => api.post('/queue/add-single', data),
  

  addBulkBrandsFromCSV: (file) => {
    const formData = new FormData();
    formData.append('csv', file);
    return api.post('/queue/add-bulk-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  addAllBrands: () => api.post('/queue/add-all'),

  // Brand search functionality
  searchBrands: (query, limit = 8) => api.get(`/queue/search-brands?query=${encodeURIComponent(query)}&limit=${limit}`),

  // Admin Queue Management APIs
  clearAllQueues: () => api.delete('/queue/queue-management/clear-all'),
  clearPendingQueue: () => api.delete('/queue/queue-management/pending/clear'),
  clearFailedQueue: () => api.delete('/queue/queue-management/failed/clear'),
  
  removePendingBrand: (brandId) => api.delete(`/queue/queue-management/pending/${brandId}`),
  removeFailedBrand: (brandId) => api.delete(`/queue/queue-management/failed/${brandId}`),
  
  movePendingToFailed: (brandId) => api.put(`/queue/queue-management/pending/${brandId}/move-to-failed`),
  moveFailedToPending: (brandId) => api.put(`/queue/queue-management/failed/${brandId}/move-to-pending`),
  
  moveAllPendingToFailed: () => api.put('/queue/queue-management/pending/move-all-to-failed'),
  moveAllFailedToPending: () => api.put('/queue/queue-management/failed/move-all-to-pending'),
  
  getQueueManagementStats: () => api.get('/queue/queue-management/stats'),

  // Scraper Control APIs
  startScraper: () => api.post('/queue/scraper/start'),
  stopScraper: () => api.post('/queue/scraper/stop'),
  pauseScraper: () => api.post('/queue/scraper/pause'),
  resumeScraper: () => api.post('/queue/scraper/resume'),
  getScraperStatus: () => api.get('/queue/scraper/status'),


  // Priority Queue Management
  changeBrandPriority: (queueType, brandName, newPosition) => 
    api.post('/queue/priority/change', { queueType, brandName, newPosition })
};

export const adminAPI = {
  // Admin authentication endpoints
  login: (credentials) => api.post('/admin/login', credentials),
  logout: () => api.post('/admin/logout'),
  checkStatus: () => api.get('/admin/status'),
};

export default api;
