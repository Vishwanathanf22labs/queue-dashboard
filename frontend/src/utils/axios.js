import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

// Add cache-busting interceptor
api.interceptors.request.use((config) => {
  // Add timestamp to prevent caching after environment switch
  const envSwitchTimestamp = localStorage.getItem('environment_switch_timestamp');
  if (envSwitchTimestamp) {
    config.params = {
      ...config.params,
      _t: envSwitchTimestamp
    };
  }
  return config;
});