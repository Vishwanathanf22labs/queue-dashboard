import { create } from "zustand";
import { adminAPI } from "../services/api";

const useAdminStore = create((set, get) => ({
  isAdmin: false,
  isLoading: false,
  error: null,

  setAdminStatus: (status) => set({ isAdmin: status }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  checkAdminStatus: async (skipPages = []) => {
    const currentPath = window.location.pathname;
    if (skipPages.includes(currentPath)) {
      return false;
    }

    try {
      set({ isLoading: true, error: null });
      const response = await adminAPI.checkStatus();
      const isAdminStatus =
        response.data?.isAdmin || response.data?.status === "authenticated";
      set({ isAdmin: isAdminStatus, isLoading: false });
      return isAdminStatus;
    } catch (error) {
      console.error("Error checking admin status:", error);
      set({ isAdmin: false, isLoading: false, error: error.message });
      return false;
    }
  },

  login: async (credentials) => {
    try {
      set({ isLoading: true, error: null });
      const response = await adminAPI.login(credentials);
      set({ isAdmin: true, isLoading: false, error: null });
      return response.data;
    } catch (error) {
      console.error("Admin login error:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Login failed";
      set({ isAdmin: false, isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true, error: null });
      await adminAPI.logout();
      set({ isAdmin: false, isLoading: false, error: null });
    } catch (error) {
      console.error("Admin logout error:", error);
      set({ isAdmin: false, isLoading: false, error: error.message });
    }
  },

  reset: () => set({ isAdmin: false, isLoading: false, error: null }),
}));

export default useAdminStore;
