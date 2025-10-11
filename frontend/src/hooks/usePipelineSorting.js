import { useState, useEffect, useCallback } from 'react';

const usePipelineSorting = (defaultSortBy, defaultSortOrder) => {
  const storageKey = 'pipeline-sorting';

  const getInitialSortState = () => {
    try {
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        const { sortBy: savedSortBy, sortOrder: savedSortOrder } = JSON.parse(savedState);
        return {
          sortBy: savedSortBy || defaultSortBy,
          sortOrder: savedSortOrder || defaultSortOrder
        };
      }
    } catch (error) {
      console.error(`Error loading sorting state from localStorage for ${storageKey}:`, error);
    }
    return { sortBy: defaultSortBy, sortOrder: defaultSortOrder };
  };

  const initialState = getInitialSortState();
  const [sortBy, setSortBy] = useState(initialState.sortBy);
  const [sortOrder, setSortOrder] = useState(initialState.sortOrder);

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
