import { create } from "zustand";
import { persist } from "zustand/middleware";
import { environmentAPI } from "../services/api";
import useQueueStore from "./queueStore";
import useAdminStore from "./adminStore";

const useEnvironmentStore = create(
  persist(
    (set, get) => ({
      currentEnvironment: "production",
      isLoading: false,
      error: null,

      setEnvironment: (environment) => {
        set({
          currentEnvironment: environment,
          error: null,
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      changeEnvironment: async (environment) => {
        const { currentEnvironment } = get();

        if (environment === currentEnvironment) {
          return;
        }

        try {
          set({ isLoading: true, error: null });

          const timestamp = Date.now();
          localStorage.setItem(
            "environment_switch_timestamp",
            timestamp.toString()
          );

          const existingStorage = localStorage.getItem("environment-storage");
          let storageData = {
            state: { currentEnvironment: environment },
            version: 0,
          };

          if (existingStorage) {
            try {
              const parsed = JSON.parse(existingStorage);
              storageData = {
                ...parsed,
                state: { ...parsed.state, currentEnvironment: environment },
              };
            } catch (e) {
              console.warn("Failed to parse existing environment storage:", e);
            }
          }

          localStorage.setItem(
            "environment-storage",
            JSON.stringify(storageData)
          );
          console.log(
            `Environment manually saved to localStorage: ${environment}`
          );

          set({
            currentEnvironment: environment,
            isLoading: false,
            error: null,
          });

          useQueueStore.getState().clearAllData();

          try {
            const keysToRemove = [
              "regularAdUpdateQueue_state",
              "watchlistAdUpdateQueue_state",
              "dashboard_regularAdUpdate_state",
              "dashboard_watchlistAdUpdate_state",
            ];
            keysToRemove.forEach((key) => localStorage.removeItem(key));
            console.log(
              "LocalStorage ad-update cache cleared for environment switch"
            );
          } catch (storageError) {
            console.warn(
              "Failed to clear localStorage ad-update cache:",
              storageError
            );
          }

          console.log(`Reloading page with environment: ${environment}`);
          setTimeout(() => {
            window.location.reload();
          }, 200);
        } catch (error) {
          console.error("Environment change error:", error);
          set({
            error: error.message || "Failed to change environment",
            isLoading: false,
          });
          throw error;
        }
      },

      getEnvironmentConfig: () => {
        const { currentEnvironment } = get();

        const configs = {
          production: {
            name: "Production",
            description: "Live production environment",
            color: "bg-red-50 border-red-200 text-red-800",
            apiPrefix: "/api",
          },
          stage: {
            name: "Stage",
            description: "Development/staging environment",
            color: "bg-blue-50 border-blue-200 text-blue-800",
            apiPrefix: "/api",
          },
        };

        return configs[currentEnvironment] || configs.production;
      },

      reset: () =>
        set({
          currentEnvironment: "production",
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: "environment-storage",
      partialize: (state) => ({
        currentEnvironment: state.currentEnvironment,
      }),
    }
  )
);

export default useEnvironmentStore;
