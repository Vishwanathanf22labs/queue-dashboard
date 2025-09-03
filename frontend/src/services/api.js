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
    return api.get(`/queue/watchlist-pending-brands-prod?${params.toString()}`);
  },

  getWatchlistFailedBrands: (page = 1, limit = 100, search = null) => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    if (search && search.trim()) params.append("search", search);
    return api.get(`/queue/watchlist-failed-brands-prod?${params.toString()}`);
  },

  getCurrentlyProcessing: () => api.get("/queue/currently-processing"),

  getNextBrand: () => api.get("/queue/next-brand"),
  getNextWatchlistBrand: () => api.get("/queue/next-watchlist-brand"),

  getStats: () => api.get("/queue/stats"),

  getBrandProcessingQueue: (page = 1, limit = 10) =>
    api.get(`/queue/brand-processing?page=${page}&limit=${limit}`),

  getWatchlistBrandsQueue: (page = 1, limit = 10) =>
    api.get(`/queue/watchlist-brands?page=${page}&limit=${limit}`),

  getScrapedStats: (date = null, days = null) => {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (days) params.append("days", days);
    return api.get(`/queue/scraped-stats?${params.toString()}`);
  },

  addSingleBrand: (data) => api.post("/queue/add-single", data),

  addBulkBrandsFromCSV: (file) => {
    const formData = new FormData();
    formData.append("csv", file);
    return api.post("/queue/add-bulk-csv", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  addAllBrands: (status = null) => {
    const params = status ? `?status=${status}` : "";
    return api.post(`/queue/add-all${params}`);
  },

  searchBrands: (query) =>
    api.get(`/queue/search-brands?query=${encodeURIComponent(query)}`),

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

  getQueueManagementStats: () => api.get("/queue/queue-management/stats"),

  getScraperStatus: () => api.get("/queue/scraper/status"),

  changeBrandScore: (queueType, brandName, newScore) =>
    api.put(`/queue/change-score`, { queueType, brandName, newScore }),
};

export const adminAPI = {
  login: (credentials) => api.post("/admin/login", credentials),
  logout: () => api.post("/admin/logout"),
  checkStatus: () => api.get("/admin/status"),
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
};

export default api;
