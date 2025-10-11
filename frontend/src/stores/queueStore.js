import { create } from "zustand";
import { queueAPI } from "../services/api";

const useQueueStore = create((set, get) => ({
  overview: null,
  nextBrand: null,
  nextWatchlistBrand: null,
  pendingBrands: null,
  failedBrands: null,
  reenqueueData: null,
  watchlistBrands: null,
  watchlistPendingBrands: null,
  watchlistFailedBrands: null,
  brandProcessingQueue: null,
  watchlistBrandsQueue: null,
  allRegularBrandProcessingJobs: null,
  allWatchlistBrandProcessingJobs: null,
  adUpdateQueue: null,
  watchlistAdUpdateQueue: null,
  allRegularAdUpdateJobs: null,
  allWatchlistAdUpdateJobs: null,
  scrapedStats: null,
  scrapedStatsLoading: false,
  separateScrapedStats: null,
  separateScrapedStatsLoading: false,
  loading: false,
  error: null,

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  clearAllData: () =>
    set({
      overview: null,
      nextBrand: null,
      nextWatchlistBrand: null,
      pendingBrands: null,
      failedBrands: null,
      reenqueueData: null,
      watchlistBrands: null,
      watchlistPendingBrands: null,
      watchlistFailedBrands: null,
      brandProcessingQueue: null,
      watchlistBrandsQueue: null,
      allRegularBrandProcessingJobs: null,
      allWatchlistBrandProcessingJobs: null,
      adUpdateQueue: null,
      watchlistAdUpdateQueue: null,
      allRegularAdUpdateJobs: null,
      allWatchlistAdUpdateJobs: null,
      scrapedStats: null,
      separateScrapedStats: null,
      loading: false,
      error: null,
    }),

  fetchOverview: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getOverview();
      set({ overview: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error("Overview API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchPendingBrands: async (page = 1, limit = 100, search = null) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getPendingBrands(page, limit, search);
      set({ pendingBrands: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error("Pending brands API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchFailedBrands: async (page = 1, limit = 100, search = null) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getFailedBrands(page, limit, search);
      set({ failedBrands: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error("Failed brands API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchReenqueueData: async (
    page = 1,
    limit = 100,
    search = null,
    namespace = null
  ) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getReenqueueData(
        page,
        limit,
        search,
        namespace
      );
      set({ reenqueueData: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error("Reenqueue data API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  requeueSingleBrand: async (itemId, namespace) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.requeueSingleBrand(itemId, namespace);
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to requeue brand";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  requeueAllBrands: async (namespace) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.requeueAllBrands(namespace);
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to requeue all brands";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteReenqueueBrand: async (itemId, namespace) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.deleteReenqueueBrand(itemId, namespace);
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to delete brand from reenqueue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteAllReenqueueBrands: async (namespace) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.deleteAllReenqueueBrands(namespace);
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to delete all brands from reenqueue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  fetchWatchlistBrands: async (page = 1, limit = 100, search = null) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getWatchlistBrands(page, limit, search);
      set({ watchlistBrands: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error("Watchlist brands API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchNextBrand: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getNextBrand();
      set({ nextBrand: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error("Next brand API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchNextWatchlistBrand: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getNextWatchlistBrand();
      set({ nextWatchlistBrand: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error("Next watchlist brand API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchBrandProcessingQueue: async (
    page = 1,
    limit = 10,
    sortBy = "normal",
    sortOrder = "desc",
    search = null
  ) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getBrandProcessingQueue(
        page,
        limit,
        sortBy,
        sortOrder,
        search
      );
      set({ brandProcessingQueue: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error("Brand Processing Queue API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchWatchlistBrandsQueue: async (
    page = 1,
    limit = 10,
    sortBy = "normal",
    sortOrder = "desc",
    search = null
  ) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getWatchlistBrandsQueue(
        page,
        limit,
        sortBy,
        sortOrder,
        search
      );
      set({ watchlistBrandsQueue: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error("Watchlist Brands Queue API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchAllRegularBrandProcessingJobs: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getAllBrandProcessingJobs("regular");
      set({ allRegularBrandProcessingJobs: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error("All Regular Brand Processing Jobs API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchAllWatchlistBrandProcessingJobs: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getAllBrandProcessingJobs("watchlist");
      set({ allWatchlistBrandProcessingJobs: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error("All Watchlist Brand Processing Jobs API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchAdUpdateQueue: async (
    page = 1,
    limit = 10,
    sortBy = "normal",
    sortOrder = "desc",
    search = null
  ) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getAdUpdateQueue(
        page,
        limit,
        sortBy,
        sortOrder,
        search
      );
      set({ adUpdateQueue: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error("Ad Update Queue API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchWatchlistAdUpdateQueue: async (
    page = 1,
    limit = 10,
    sortBy = "normal",
    sortOrder = "desc",
    search = null
  ) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getWatchlistAdUpdateQueue(
        page,
        limit,
        sortBy,
        sortOrder,
        search
      );
      set({ watchlistAdUpdateQueue: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error("Watchlist Ad Update Queue API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchAllRegularAdUpdateJobs: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getAllAdUpdateJobs("regular");
      set({ allRegularAdUpdateJobs: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error("All Regular Ad Update Jobs API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchAllWatchlistAdUpdateJobs: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getAllAdUpdateJobs("watchlist");
      set({ allWatchlistAdUpdateJobs: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error("All Watchlist Ad Update Jobs API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchScrapedStats: async (date = null, days = null) => {
    try {
      set({ scrapedStatsLoading: true, error: null });
      const response = await queueAPI.getScrapedStats(date, days);
      set({ scrapedStats: response.data, scrapedStatsLoading: false });
      return response.data;
    } catch (error) {
      console.error("Scraped Stats API error:", error);
      set({ error: error.message, scrapedStatsLoading: false });
      throw error;
    }
  },

  fetchSeparateScrapedStats: async (date = null, days = null) => {
    try {
      set({ separateScrapedStatsLoading: true, error: null });
      const response = await queueAPI.getSeparateScrapedStats(date, days);
      set({
        separateScrapedStats: response.data,
        separateScrapedStatsLoading: false,
      });
      return response.data;
    } catch (error) {
      console.error("Separate Scraped Stats API error:", error);
      set({ error: error.message, separateScrapedStatsLoading: false });
      throw error;
    }
  },

  addSingleBrand: async (brandData) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.addSingleBrand(brandData);
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || error.message || "Failed to add brand";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  addAllBrands: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.addAllBrands();
      set({ loading: false });
      return response.data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  addBulkBrandsFromCSV: async (file) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.addBulkBrandsFromCSV(file);
      set({ loading: false });
      return response.data;
    } catch (error) {
      console.error("CSV upload API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  searchBrands: async (query, limit = 8) => {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const response = await queueAPI.searchBrands(query.trim(), limit);
      return response.data.data;
    } catch (error) {
      console.error(
        "Brand search error:",
        error.response?.data || error.message
      );
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to search brands";
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  fetchBrandStatus: async (identifier) => {
    try {
      const response = await queueAPI.getBrandStatus(identifier);
      return response.data.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch brand status";
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },
  setBrandStatus: async (identifier, status) => {
    try {
      const response = await queueAPI.updateBrandStatus({
        ...identifier,
        status,
      });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to update brand status";
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  bulkPreviewBrands: async (ids, pageIds = []) => {
    try {
      const response = await queueAPI.bulkPreviewBrands({
        ids,
        page_ids: pageIds,
      });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to preview brands";
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  bulkApplyStatusUpdates: async (updates) => {
    try {
      const response = await queueAPI.bulkApplyStatusUpdates({ updates });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to apply bulk updates";
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  clearAllQueues: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.clearAllQueues();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to clear all queues";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearCurrentlyScraping: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.clearCurrentlyScraping();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to clear currently scraping brands";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearCacheOnly: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.clearCacheOnly();

      set({
        overview: null,
        nextBrand: null,
        nextWatchlistBrand: null,
        pendingBrands: null,
        failedBrands: null,
        reenqueueData: null,
        watchlistBrands: null,
        watchlistPendingBrands: null,
        watchlistFailedBrands: null,
        brandProcessingQueue: null,
        watchlistBrandsQueue: null,
        allRegularBrandProcessingJobs: null,
        allWatchlistBrandProcessingJobs: null,
        adUpdateQueue: null,
        watchlistAdUpdateQueue: null,
        allRegularAdUpdateJobs: null,
        allWatchlistAdUpdateJobs: null,
        scrapedStats: null,
        separateScrapedStats: null,
        loading: false,
        error: null,
      });

      const cacheKeys = [
        "pipeline-sorting",
        "queueManagement_pendingSearch",
        "queueManagement_failedSearch",
        "queueManagement_confirmDialog",
        "watchlistQueues_confirmDialog",
        "watchlistQueues_requeueConfirmDialog",
        "failedQueue_confirmDialog",
        "failedQueue_requeueConfirmDialog",
        "dashboard_*",
        "scrapedBrands_*",
        "proxies_*",
      ];

      Object.keys(localStorage).forEach((key) => {
        if (
          cacheKeys.some((pattern) => key.includes(pattern.replace("*", "")))
        ) {
          localStorage.removeItem(key);
        }
      });

      const sessionCacheKeys = [
        "queueManagementPageRefreshed",
        "queueManagementPageVisited",
        "watchlistQueuesPageRefreshed",
        "watchlistQueuesPageVisited",
        "failedQueuePageRefreshed",
        "failedQueuePageVisited",
      ];

      sessionCacheKeys.forEach((key) => {
        sessionStorage.removeItem(key);
      });

      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to clear cache";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearPendingQueue: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.clearPendingQueue();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to clear pending queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearFailedQueue: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.clearFailedQueue();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to clear failed queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  removePendingBrand: async (brandId) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.removePendingBrand(brandId);
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to remove pending brand";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  removeFailedBrand: async (brandId) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.removeFailedBrand(brandId);
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to remove failed brand";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  movePendingToFailed: async (brandId) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.movePendingToFailed(brandId);
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to move brand to failed queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  moveFailedToPending: async (brandId) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.moveFailedToPending(brandId);
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to move brand to pending queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  moveAllPendingToFailed: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.moveAllPendingToFailed();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to move all pending brands to failed queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  moveAllFailedToPending: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.moveAllFailedToPending();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to move all failed brands to pending queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  moveWatchlistFailedToPending: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.moveWatchlistFailedToPending();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to move watchlist failed brands to pending queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  fetchWatchlistPendingBrands: async (page = 1, limit = 100, search = null) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getWatchlistPendingBrands(
        page,
        limit,
        search
      );
      set({ watchlistPendingBrands: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error("Watchlist pending brands API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchWatchlistFailedBrands: async (page = 1, limit = 100, search = null) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getWatchlistFailedBrands(
        page,
        limit,
        search
      );
      set({ watchlistFailedBrands: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error("Watchlist failed brands API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  moveIndividualWatchlistFailedToPending: async (brandIdentifier) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.moveIndividualWatchlistFailedToPending(
        brandIdentifier
      );
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to move individual watchlist failed brand to pending queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  moveWatchlistToPending: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.moveWatchlistToPending();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to move watchlist brands to pending queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearWatchlistPendingQueue: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.clearWatchlistPendingQueue();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to clear watchlist pending queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearWatchlistFailedQueue: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.clearWatchlistFailedQueue();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to clear watchlist failed queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  moveAllWatchlistPendingToFailed: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.moveAllWatchlistPendingToFailed();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to move all watchlist pending brands to failed queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  moveAllWatchlistFailedToPending: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.moveAllWatchlistFailedToPending();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to move all watchlist failed brands to pending queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  fetchScraperStatus: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getScraperStatus();
      const status = response.data?.status || "unknown";
      set({ loading: false });
      return { status, data: response.data };
    } catch (error) {
      console.error("Failed to fetch scraper status:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchBrandCounts: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getBrandCounts();
      if (response.data.success) {
        set({ loading: false });
        return response.data.data;
      } else {
        throw new Error(
          response.data.message || "Failed to fetch brand counts"
        );
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch brand counts";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  setNextBrand: (nextBrand) => set({ nextBrand }),
  clearNextBrand: () => set({ nextBrand: null }),
}));

export default useQueueStore;
