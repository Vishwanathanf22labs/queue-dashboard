import { create } from "zustand";
import { adminAPI } from "../services/api";

const getInitialState = () => {
  try {
    const stored = localStorage.getItem("adminState");
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        isAdmin: parsed.isAdmin || false,
        isLoading: false,
        error: null,
      };
    }
  } catch (error) {
    console.error("Error loading admin state from localStorage:", error);
  }
  return {
    isAdmin: false,
    isLoading: false,
    error: null,
  };
};

const saveToLocalStorage = (state) => {
  try {
    localStorage.setItem(
      "adminState",
      JSON.stringify({
        isAdmin: state.isAdmin,
      })
    );
  } catch (error) {
    console.error("Error saving admin state to localStorage:", error);
  }
};

const useAdminStore = create((set, get) => ({
  ...getInitialState(),

  setAdminStatus: (status) => {
    const newState = { isAdmin: status };
    set(newState);
    saveToLocalStorage(newState);
  },
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
      const newState = { isAdmin: isAdminStatus, isLoading: false };
      set(newState);
      saveToLocalStorage(newState);
      return isAdminStatus;
    } catch (error) {
      console.error("Error checking admin status:", error);
      const newState = {
        isAdmin: false,
        isLoading: false,
        error: error.message,
      };
      set(newState);
      saveToLocalStorage(newState);
      return false;
    }
  },

  login: async (credentials) => {
    try {
      set({ isLoading: true, error: null });
      const response = await adminAPI.login(credentials);
      const newState = { isAdmin: true, isLoading: false, error: null };
      set(newState);
      saveToLocalStorage(newState);
      return response.data;
    } catch (error) {
      console.error("Admin login error:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Login failed";
      const newState = {
        isAdmin: false,
        isLoading: false,
        error: errorMessage,
      };
      set(newState);
      saveToLocalStorage(newState);
      throw new Error(errorMessage);
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true, error: null });
      await adminAPI.logout();
      const newState = { isAdmin: false, isLoading: false, error: null };
      set(newState);
      saveToLocalStorage(newState);
    } catch (error) {
      console.error("Admin logout error:", error);
      const newState = {
        isAdmin: false,
        isLoading: false,
        error: error.message,
      };
      set(newState);
      saveToLocalStorage(newState);
    }
  },

  reset: () => {
    const newState = { isAdmin: false, isLoading: false, error: null };
    set(newState);
    saveToLocalStorage(newState);
  },
}));

export default useAdminStore;
