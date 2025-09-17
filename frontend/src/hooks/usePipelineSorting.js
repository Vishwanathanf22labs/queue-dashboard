import { useState, useEffect, useCallback } from 'react';

const usePipelineSorting = (defaultSortBy, defaultSortOrder) => {
  const storageKey = 'pipeline-sorting';
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortOrder, setSortOrder] = useState(defaultSortOrder);

  useEffect(() => {
    try {
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        const { sortBy: savedSortBy, sortOrder: savedSortOrder } = JSON.parse(savedState);
        setSortBy(savedSortBy || defaultSortBy);
        setSortOrder(savedSortOrder || defaultSortOrder);
      }
    } catch (error) {
      console.error(`Error loading sorting state from localStorage for ${storageKey}:`, error);
      setSortBy(defaultSortBy);
      setSortOrder(defaultSortOrder);
    }
  }, [defaultSortBy, defaultSortOrder]);

  const updateSorting = useCallback((newSortBy, newSortOrder) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ sortBy: newSortBy, sortOrder: newSortOrder }));
    } catch (error) {
      console.error(`Error saving sorting state to localStorage for ${storageKey}:`, error);
    }
  }, []);

  return { sortBy, sortOrder, updateSorting };
};

export default usePipelineSorting;
