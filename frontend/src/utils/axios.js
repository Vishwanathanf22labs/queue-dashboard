import axios from "axios";
import useEnvironmentStore from "../stores/environmentStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const environment = useEnvironmentStore.getState().currentEnvironment;
  config.headers["X-Environment"] = environment;

  const envSwitchTimestamp = localStorage.getItem(
    "environment_switch_timestamp"
  );
  if (envSwitchTimestamp) {
    config.params = {
      ...config.params,
      _t: envSwitchTimestamp,
    };
  }
  return config;
});
