import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for managing auto-refresh functionality
 * 
 * @param {Function} refreshFn - Function to call for refreshing data
 * @param {Array} deps - Dependencies that should trigger refresh function updates
 * @returns {Object} { refreshInterval, isRefreshing, setIntervalValue, manualRefresh }
 */
const useAutoRefresh = (refreshFn, deps = []) => {
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef(null);
  const refreshFnRef = useRef(refreshFn);

  // Update the refresh function reference when deps change
  useEffect(() => {
    refreshFnRef.current = refreshFn;
  }, deps);

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Start/stop auto refresh when interval changes
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Start new interval if value > 0
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (refreshFnRef.current) {
          refreshFnRef.current();
        }
      }, refreshInterval * 1000);
    }
  }, [refreshInterval]);

  const setIntervalValue = useCallback((value) => {
    setRefreshInterval(value);
  }, []);

  const manualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      if (refreshFnRef.current) {
        await refreshFnRef.current();
      }
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  return {
    refreshInterval,
    isRefreshing,
    setIntervalValue,
    manualRefresh
  };
};

export default useAutoRefresh;
