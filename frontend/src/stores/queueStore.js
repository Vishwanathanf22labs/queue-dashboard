import { create } from 'zustand';
import { queueAPI } from '../services/api';

const useQueueStore = create((set, get) => ({

  overview: null,
  pendingBrands: null,
  failedBrands: null,
  currentlyProcessing: null,
  nextBrand: null,
  stats: null,
  brandProcessingQueue: null,
  scrapedStats: null,
  loading: false,
  error: null,


  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  setOverview: (overview) => set({ overview }),
  setCurrentlyProcessing: (currentlyProcessing) => set({ currentlyProcessing }),
  setNextBrand: (nextBrand) => set({ nextBrand }),
  setPendingBrands: (pendingBrands) => set({ pendingBrands }),
  setFailedBrands: (failedBrands) => set({ failedBrands }),
  setBrandProcessingQueue: (brandProcessingQueue) => set({ brandProcessingQueue }),
  setScrapedStats: (scrapedStats) => set({ scrapedStats }),


  fetchOverview: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getOverview();
      set({ overview: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error('Overview API error:', error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchPendingBrands: async (page = 1, limit = 100) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getPendingBrands(page, limit);
      set({ pendingBrands: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error('Pending brands API error:', error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchFailedBrands: async (page = 1, limit = 100) => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getFailedBrands(page, limit);
      set({ failedBrands: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error('Failed brands API error:', error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchCurrentlyProcessing: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getCurrentlyProcessing();
      set({ currentlyProcessing: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error('Currently processing API error:', error);
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
      console.error('Next brand API error:', error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchStats: async () => {
    try {
      set({ loading: true, error: null });
      const response = await queueAPI.getStats();
      set({ stats: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      console.error('Stats API error:', error);
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
      console.error('Brand Processing Queue API error:', error);
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
      console.error('Scraped Stats API error:', error);
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
      const errorMessage = error.response?.data?.message || error.message || 'Failed to add brand';
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
      console.error('CSV upload API error:', error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Brand search functionality
  searchBrands: async (query, limit = 8) => {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }
      
      const response = await queueAPI.searchBrands(query.trim(), limit);
      return response.data.data;
    } catch (error) {
      console.error('Brand search error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to search brands';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  }
}));

export default useQueueStore;
