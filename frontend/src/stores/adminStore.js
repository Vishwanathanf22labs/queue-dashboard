import { create } from 'zustand';
import { adminAPI } from '../services/api';

const useAdminStore = create((set, get) => ({
  // Admin state
  isAdmin: false,
  isLoading: false,
  error: null,

  // Admin actions
  setAdminStatus: (status) => set({ isAdmin: status }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // Check admin status
  checkAdminStatus: async (skipPages = []) => {
    // Skip admin status check on specified pages
    const currentPath = window.location.pathname;
    if (skipPages.includes(currentPath)) {
      console.log(`Skipping admin status check on ${currentPath}`);
      return false; // Skip API call on these pages
    }

    try {
      set({ isLoading: true, error: null });
      const response = await adminAPI.checkStatus();
      // Handle the response based on your backend structure
      const isAdminStatus = response.data?.isAdmin || response.data?.status === 'authenticated';
      set({ isAdmin: isAdminStatus, isLoading: false });
      return isAdminStatus;
    } catch (error) {
      console.error('Error checking admin status:', error);
      set({ isAdmin: false, isLoading: false, error: error.message });
      return false;
    }
  },

  // Admin login
  login: async (credentials) => {
    try {
      set({ isLoading: true, error: null });
      const response = await adminAPI.login(credentials);
      set({ isAdmin: true, isLoading: false, error: null });
      return response.data;
    } catch (error) {
      console.error('Admin login error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      set({ isAdmin: false, isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  // Admin logout
  logout: async () => {
    try {
      set({ isLoading: true, error: null });
      await adminAPI.logout();
      set({ isAdmin: false, isLoading: false, error: null });
    } catch (error) {
      console.error('Admin logout error:', error);
      // Even if logout fails, we should clear admin status
      set({ isAdmin: false, isLoading: false, error: error.message });
    }
  },

  // Reset admin state
  reset: () => set({ isAdmin: false, isLoading: false, error: null }),
}));

export default useAdminStore;
