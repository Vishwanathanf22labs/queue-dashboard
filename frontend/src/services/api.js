import { api } from "../utils/axios";

export const queueAPI = {
  getOverview: () => api.get("/queue/overview"),

  getPendingBrands: (page = 1, limit = 100, search = null) => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    if (search && search.trim()) params.append("search", search);
    return api.get(`/queue/pending?${params.toString()}`);
  },

  getFailedBrands: (page = 1, limit = 100, search = null) => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    if (search && search.trim()) params.append("search", search);
    return api.get(`/queue/failed?${params.toString()}`);
  },

  getWatchlistBrands: (page = 1, limit = 100, search = null) => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    if (search && search.trim()) params.append("search", search);
    return api.get(`/queue/watchlist?${params.toString()}`);
  },

  getWatchlistPendingBrands: (page = 1, limit = 100, search = null) => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    if (search && search.trim()) params.append("search", search);
    return api.get(`/queue/watchlist-pending-brands?${params.toString()}`);
  },

  getWatchlistFailedBrands: (page = 1, limit = 100, search = null) => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    if (search && search.trim()) params.append("search", search);
    return api.get(`/queue/watchlist-failed-brands?${params.toString()}`);
  },

  getCurrentlyProcessing: () => api.get("/queue/currently-processing"),

  getNextBrand: () => api.get("/queue/next-brand"),
  getNextWatchlistBrand: () => api.get("/queue/next-watchlist-brand"),

  getStats: () => api.get("/queue/stats"),

  getBrandProcessingQueue: (page = 1, limit = 10, sortBy = 'normal', sortOrder = 'desc') => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    params.append("sortBy", sortBy);
    params.append("sortOrder", sortOrder);
    return api.get(`/queue/brand-processing?${params.toString()}`);
  },

  getWatchlistBrandsQueue: (page = 1, limit = 10, sortBy = 'normal', sortOrder = 'desc') => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    params.append("sortBy", sortBy);
    params.append("sortOrder", sortOrder);
    return api.get(`/queue/watchlist-brands?${params.toString()}`);
  },

  getScrapedStats: (date = null, days = null) => {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (days) params.append("days", days);
    return api.get(`/queue/scraped-stats?${params.toString()}`);
  },

  getSeparateScrapedStats: (date = null, days = null) => {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (days) params.append("days", days);
    return api.get(`/queue/scraped-stats/separate?${params.toString()}`);
  },

  addSingleBrand: (data) => api.post("/queue/add-single", data),

  addBulkBrandsFromCSV: (file, queueType = 'regular') => {
    const formData = new FormData();
    formData.append("csv", file);
    const params = new URLSearchParams();
    params.append("queueType", queueType);
    return api.post(`/queue/add-bulk-csv?${params.toString()}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  addAllBrands: (status = null, queueType = 'regular') => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("queueType", queueType);
    return api.post(`/queue/add-all?${params.toString()}`);
  },

  searchBrands: (query, limit = 8) => {
    const params = new URLSearchParams();
    params.append("query", query);
    params.append("limit", limit);
    return api.get(`/queue/search-brands?${params.toString()}`);
  },

  getBrandCounts: () => api.get("/queue/brand-counts"),

  clearAllQueues: () => api.delete("/queue/queue-management/clear-all"),
  clearPendingQueue: () => api.delete("/queue/queue-management/pending/clear"),
  clearFailedQueue: () => api.delete("/queue/queue-management/failed/clear"),

  removePendingBrand: (brandId) =>
    api.delete(`/queue/queue-management/pending/${brandId}`),
  removeFailedBrand: (brandId) =>
    api.delete(`/queue/queue-management/failed/${brandId}`),

  movePendingToFailed: (brandId) =>
    api.put(`/queue/queue-management/pending/${brandId}/move-to-failed`),
  moveFailedToPending: (brandId) =>
    api.put(`/queue/queue-management/failed/${brandId}/move-to-pending`),

  moveAllPendingToFailed: () =>
    api.put("/queue/queue-management/pending/move-all-to-failed"),
  moveAllFailedToPending: () =>
    api.put("/queue/queue-management/failed/move-all-to-pending"),
  moveWatchlistFailedToPending: () =>
    api.put("/queue/queue-management/watchlist/move-failed-to-pending"),
  moveWatchlistToPending: () =>
    api.put("/queue/queue-management/watchlist/move-to-pending"),
  moveIndividualWatchlistFailedToPending: (brandId) =>
    api.put(
      `/queue/queue-management/watchlist/failed/${brandId}/move-to-pending`
    ),

  // Watchlist specific clear operations
  clearWatchlistPendingQueue: () =>
    api.delete("/queue/queue-management/watchlist/pending/clear"),
  clearWatchlistFailedQueue: () =>
    api.delete("/queue/queue-management/watchlist/failed/clear"),

  // Watchlist specific bulk move operations
  moveAllWatchlistPendingToFailed: () =>
    api.put("/queue/queue-management/watchlist/pending/move-all-to-failed"),
  moveAllWatchlistFailedToPending: () =>
    api.put("/queue/queue-management/watchlist/failed/move-all-to-pending"),

  getQueueManagementStats: () => api.get("/queue/queue-management/stats"),

  getScraperStatus: () => api.get("/queue/scraper/status"),
  startScraper: () => api.post("/queue/scraper/start"),
  stopScraper: () => api.post("/queue/scraper/stop"),

  changeBrandScore: (queueType, brandName, newScore) =>
    api.put(`/queue/change-score`, { queueType, brandName, newScore }),
};

export const adminAPI = {
  login: (credentials) => api.post("/admin/login", credentials),
  logout: () => api.post("/admin/logout"),
  checkStatus: () => api.get("/admin/status"),
};

export const environmentAPI = {
  getCurrent: () => api.get("/environment/current"),
  getAvailable: () => api.get("/environment"),
  switch: (environment) => api.post("/environment/switch", { environment }),
};

export const scrapedBrandsAPI = {
  getScrapedBrands: (page = 1, limit = 10, date = null, sortBy = 'normal', sortOrder = 'desc') => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    if (date) params.append("date", date);
    params.append("sortBy", sortBy);
    params.append("sortOrder", sortOrder);
    return api.get(`/scraped-brands?${params.toString()}`);
  },

  getScrapedBrandsStats: (date = null) => {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    return api.get(`/scraped-brands/stats?${params.toString()}`);
  },

  searchScrapedBrands: (query, date = null, options = {}) => {
    const params = new URLSearchParams();
    params.append("query", query);
    if (date) params.append("date", date);
    return api.get(`/scraped-brands/search?${params.toString()}`, {
      signal: options.signal, // Support for AbortController
      ...options
    });
  }
};

export const pipelineAPI = {
  getAllBrandsStatus: (page = 1, limit = 10, date = null, sortBy = 'normal', sortOrder = 'desc') => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    if (date) params.append("date", date);
    params.append("sortBy", sortBy);
    params.append("sortOrder", sortOrder);
    return api.get(`/pipeline-status/all?${params.toString()}`);
  },
  
  searchBrandsStatus: (query, date = null) => {
    const params = new URLSearchParams();
    params.append("query", query);
    if (date) params.append("date", date);
    return api.get(`/pipeline-status/search?${params.toString()}`);
  }
};

export const proxyAPI = {
  addProxy: (proxyData) => api.post("/queue/proxy/add", proxyData),
  removeProxy: (proxyId) => api.delete(`/queue/proxy/remove/${proxyId}`),
  updateProxy: (proxyId, updates) =>
    api.put(`/queue/proxy/update/${proxyId}`, updates),
  clearAllProxies: () => api.delete("/queue/proxy/clear-all"),

  getProxies: (page = 1, limit = 10, filter = "all", search = "") => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    params.append("filter", filter);
    if (search && search.trim()) params.append("search", search);
    return api.get(`/queue/proxy/list?${params.toString()}`);
  },
  getAvailableProxies: () => api.get("/queue/proxy/available"),
  getLastMonthProxies: () => api.get("/queue/proxy/last-month"),
  getNextProxy: () => api.get("/queue/proxy/next"),

  getProxyStats: () => api.get("/queue/proxy/stats"),
  getProxyManagementStats: () => api.get("/queue/proxy/management-stats"),
  getSystemHealth: () => api.get("/queue/proxy/health"),
  updateProxyStatus: (proxyId, isWorking) =>
    api.put(`/queue/proxy/status/${proxyId}`, { isWorking }),

  switchToNextWorkingProxy: (failedProxyId) =>
    api.post(`/queue/proxy/switch/${failedProxyId}`),
  getProxyRotationHistory: () => api.get("/queue/proxy/rotation-history"),
  forceRotateToProxy: (proxyId) => api.post(`/queue/proxy/rotate/${proxyId}`),
  getFailoverRecommendations: () =>
    api.get("/queue/proxy/failover-recommendations"),

  getPerformanceMetrics: () => api.get("/queue/proxy/performance"),
  bulkUpdateStatus: (updates) =>
    api.put("/queue/proxy/bulk-status", { updates }),
  searchProxies: (query, criteria = "all") =>
    api.get(
      `/queue/proxy/search?query=${encodeURIComponent(
        query
      )}&criteria=${criteria}`
    ),
  unlockProxy: (lockKey) => api.post("/queue/proxy/unlock", { lockKey }),
};

export default api;
