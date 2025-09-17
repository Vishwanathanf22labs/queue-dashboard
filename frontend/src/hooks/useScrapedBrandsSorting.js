import { useState, useEffect } from 'react';

const useScrapedBrandsSorting = (defaultSortBy = 'normal', defaultSortOrder = 'desc') => {
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortOrder, setSortOrder] = useState(defaultSortOrder);

  // Load from localStorage on component mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('scraped-brands-sorting');
      if (savedState) {
        const { sortBy: savedSortBy, sortOrder: savedSortOrder } = JSON.parse(savedState);
        setSortBy(savedSortBy || defaultSortBy);
        setSortOrder(savedSortOrder || defaultSortOrder);
      }
    } catch (error) {
      console.warn('Failed to load scraped brands sorting state from localStorage', error);
    }
  }, [defaultSortBy, defaultSortOrder]);

  // Save to localStorage whenever sorting changes
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
