import { create } from "zustand";
import { persist } from "zustand/middleware";
import { environmentAPI } from "../services/api";
import useQueueStore from "./queueStore";
import useAdminStore from "./adminStore";

const useEnvironmentStore = create(
  persist(
    (set, get) => ({
      currentEnvironment: 'production',
      isLoading: false,
      error: null,

      setEnvironment: (environment) => {
        set({ 
          currentEnvironment: environment,
          error: null 
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      // Environment change handler
      changeEnvironment: async (environment) => {
        const { currentEnvironment } = get();
        
        if (environment === currentEnvironment) {
          return;
        }

        try {
          set({ isLoading: true, error: null });
          
          // Make API call to switch backend environment
          const result = await environmentAPI.switch(environment);
          
          // Add timestamp to prevent caching
          const timestamp = Date.now();
          localStorage.setItem('environment_switch_timestamp', timestamp.toString());
          
          // Add a small delay to ensure backend environment switch is complete
          await new Promise(resolve => setTimeout(resolve, 300));
          
          set({ 
            currentEnvironment: environment,
            isLoading: false,
            error: null 
          });

          // Clear all cached data from other stores
          // Clear queue store data
          useQueueStore.getState().clearAllData();
          
          // Clear localStorage cache for ad-update queues (fixes stale data issue)
          try {
            const keysToRemove = [
              'regularAdUpdateQueue_state',
              'watchlistAdUpdateQueue_state',
              'dashboard_regularAdUpdate_state',
              'dashboard_watchlistAdUpdate_state'
            ];
            keysToRemove.forEach(key => localStorage.removeItem(key));
            console.log('LocalStorage ad-update cache cleared for environment switch');
          } catch (storageError) {
            console.warn('Failed to clear localStorage ad-update cache:', storageError);
          }
          
          // Don't clear admin store data - admin login should persist across environments
          // useAdminStore.getState().reset();

          // Note: Dashboard component will automatically refresh data via useEffect
          // when currentEnvironment changes, so no need to reload the page
          
        } catch (error) {
          console.error('Environment change error:', error);
          set({ 
            error: error.message || 'Failed to change environment',
            isLoading: false 
          });
          throw error;
        }
      },

      // Get environment-specific configuration
      getEnvironmentConfig: () => {
        const { currentEnvironment } = get();
        
        const configs = {
          production: {
            name: 'Production',
            description: 'Live production environment',
            color: 'bg-red-50 border-red-200 text-red-800',
            apiPrefix: '/api'
          },
          stage: {
            name: 'Stage',
            description: 'Development/staging environment',
            color: 'bg-blue-50 border-blue-200 text-blue-800',
            apiPrefix: '/api'
          }
        };

        return configs[currentEnvironment] || configs.production;
      },

      // Reset to default
      reset: () => set({ 
        currentEnvironment: 'production',
        isLoading: false,
        error: null 
      })
    }),
    {
      name: 'environment-storage',
      partialize: (state) => ({ 
        currentEnvironment: state.currentEnvironment 
      })
    }
  )
);

export default useEnvironmentStore;
