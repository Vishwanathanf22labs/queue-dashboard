import { useState, useEffect, useRef, useCallback } from 'react';


const useAutoRefresh = (refreshFn, deps = []) => {
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef(null);
  const refreshFnRef = useRef(refreshFn);

  useEffect(() => {
    refreshFnRef.current = refreshFn;
  }, deps);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

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
