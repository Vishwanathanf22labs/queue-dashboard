import axios from "axios";
import useEnvironmentStore from "../stores/environmentStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

// Add environment header and cache-busting interceptor
api.interceptors.request.use((config) => {
  // Add environment header to every request
  const environment = useEnvironmentStore.getState().currentEnvironment;
  config.headers['X-Environment'] = environment;
  
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