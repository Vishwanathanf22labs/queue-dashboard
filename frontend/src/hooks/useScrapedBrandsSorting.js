import { useState } from 'react';

const getInitialSortState = (defaultSortBy, defaultSortOrder) => {
  try {
    const savedState = localStorage.getItem('scraped-brands-sorting');
    if (savedState) {
      const { sortBy: savedSortBy, sortOrder: savedSortOrder } = JSON.parse(savedState);
      return {
        sortBy: savedSortBy || defaultSortBy,
        sortOrder: savedSortOrder || defaultSortOrder
      };
    }
  } catch (error) {
    console.warn('Failed to load scraped brands sorting state from localStorage', error);
  }
  return { sortBy: defaultSortBy, sortOrder: defaultSortOrder };
};

const useScrapedBrandsSorting = (defaultSortBy = 'normal', defaultSortOrder = 'desc') => {
  const initialState = getInitialSortState(defaultSortBy, defaultSortOrder);
  const [sortBy, setSortBy] = useState(initialState.sortBy);
  const [sortOrder, setSortOrder] = useState(initialState.sortOrder);

  const updateSorting = (newSortBy, newSortOrder) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);

    try {
      localStorage.setItem('scraped-brands-sorting', JSON.stringify({
        sortBy: newSortBy,
        sortOrder: newSortOrder
      }));
    } catch (error) {
      console.warn('Failed to save scraped brands sorting state to localStorage', error);
    }
  };

  return {
    sortBy,
    sortOrder,
    updateSorting
  };
};

export default useScrapedBrandsSorting;
