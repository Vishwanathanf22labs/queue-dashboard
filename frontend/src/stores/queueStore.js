import { create } from "zustand";
import { queueAPI } from "../services/api";

const useQueueStore = create((set, get) => ({
  overview: null,
  nextBrand: null,
  pendingBrands: null,
  failedBrands: null,
  brandProcessingQueue: null,
  scrapedStats: null,
  loading: false,
  error: null,

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  fetchOverview: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getOverview();
      set({ overview: response.data.data, loading: false });
      return response.data.data;
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

  fetchBrandProcessingQueue: async (page = 1, limit = 10) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getBrandProcessingQueue(page, limit);
      set({ brandProcessingQueue: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error("Brand Processing Queue API error:", error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchScrapedStats: async (date = null, days = null) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getScrapedStats(date, days);
      set({ scrapedStats: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error("Scraped Stats API error:", error);
      set({ error: error.message, loading: false });
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

  clearAllQueues: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.clearAllQueues();
      set({ loading: false });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to clear all queues";
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
      const errorMessage = error.response?.data?.message || error.message || "Failed to clear pending queue";
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
      const errorMessage = error.response?.data?.message || error.message || "Failed to clear failed queue";
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
      const errorMessage = error.response?.data?.message || error.message || "Failed to remove pending brand";
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
      const errorMessage = error.response?.data?.message || error.message || "Failed to remove failed brand";
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
      const errorMessage = error.response?.data?.message || error.message || "Failed to move brand to failed queue";
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
      const errorMessage = error.response?.data?.message || error.message || "Failed to move brand to pending queue";
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
      const errorMessage = error.response?.data?.message || error.message || "Failed to move all pending brands to failed queue";
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
      const errorMessage = error.response?.data?.message || error.message || "Failed to move all failed brands to pending queue";
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  fetchScraperStatus: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getScraperStatus();
      if (response.data?.success) {
        const status = response.data.data?.status || 'unknown';
        set({ loading: false });
        return { status, data: response.data.data };
      } else {
        throw new Error('Invalid response structure from server');
      }
    } catch (error) {
      console.error('Failed to fetch scraper status:', error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  startScraper: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.startScraper();
      if (response.data.success) {
        set({ loading: false });
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to start scraper');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to start scraper';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  stopScraper: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.stopScraper();
      if (response.data.success) {
        set({ loading: false });
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to stop scraper');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to stop scraper';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  pauseScraper: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.pauseScraper();
      if (response.data.success) {
        set({ loading: false });
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to pause scraper');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to pause scraper';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  resumeScraper: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.resumeScraper();
      if (response.data.success) {
        set({ loading: false });
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to resume scraper');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to resume scraper';
      set({ error: errorMessage, loading: false });
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
        throw new Error(response.data.message || 'Failed to fetch brand counts');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch brand counts';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },



  // Utility functions for next brand
  setNextBrand: (nextBrand) => set({ nextBrand }),
  clearNextBrand: () => set({ nextBrand: null }),
}));

export default useQueueStore;