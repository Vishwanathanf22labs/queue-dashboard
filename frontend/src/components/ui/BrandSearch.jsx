import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, Check } from 'lucide-react';
import useQueueStore from '../../stores/queueStore';
import Button from './Button';

const BrandSearch = forwardRef(({ onBrandSelect, selectedBrand = null, disabled = false, onSearchAttempt = null }, ref) => {
  const { searchBrands } = useQueueStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchState, setSearchState] = useState({
    query: searchParams.get('search') || '',
    results: [],
    isSearching: false,
    showDropdown: false,
    selectedIndex: -1,
    error: null,
  });

  const searchTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const { query, results, isSearching, showDropdown, selectedIndex, error } = searchState;

  useImperativeHandle(ref, () => ({
    clearSearch: () => {
      clearSearch();
    }
  }));

  const updateSearchState = (updates) => {
    setSearchState(prev => ({ ...prev, ...updates }));
  };

  const clearSearch = () => {
    updateSearchState({
      query: '',
      results: [],
      showDropdown: false,
      selectedIndex: -1,
      error: null
    });

    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    setSearchParams(newParams);
  };

  const performSearch = async (searchQuery) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      updateSearchState({
        results: [],
        showDropdown: false,
        error: null
      });
      return;
    }

    try {
      updateSearchState({
        isSearching: true,
        error: null,
        showDropdown: true
      });

      const searchResults = await searchBrands(searchQuery, 8);

      updateSearchState({
        results: searchResults || [],
        isSearching: false
      });
    } catch (error) {
      updateSearchState({
        error: error.message || 'Search failed',
        isSearching: false,
        results: []
      });
    }
  };

  const handleInputChange = (e) => {
    const newQuery = e.target.value;
    updateSearchState({
      query: newQuery,
      error: null
    });

    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    if (newQuery && newQuery.trim()) {
      newParams.set('search', newQuery);
    } else {
      newParams.delete('search');
    }
    setSearchParams(newParams);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (newQuery.trim().length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(newQuery);
      }, 300);
    } else {
      updateSearchState({
        results: [],
        showDropdown: false
      });
    }
  };

  const handleBrandSelect = (brand) => {
    onBrandSelect(brand);
    updateSearchState({
      query: brand.brand_name,
      results: [],
      showDropdown: false,
      selectedIndex: -1,
      error: null
    });
  };

  const handleInputFocus = () => {
    if (query.trim().length >= 3 && results.length > 0) {
      updateSearchState({ showDropdown: true });
    }
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        updateSearchState({
          selectedIndex: Math.min(selectedIndex + 1, results.length - 1)
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        updateSearchState({
          selectedIndex: Math.max(selectedIndex - 1, -1)
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleBrandSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        updateSearchState({ showDropdown: false, selectedIndex: -1 });
        break;
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        inputRef.current && !inputRef.current.contains(event.target)) {
        updateSearchState({ showDropdown: false, selectedIndex: -1 });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle selectedBrand changes WITHOUT clearing search
  useEffect(() => {
    if (selectedBrand && selectedBrand.brand_name) {
      setSearchState(prev => ({
        ...prev,
        query: selectedBrand.brand_name,
        results: [],
        showDropdown: false,
        selectedIndex: -1,
        error: null
      }));
    }
  }, [selectedBrand]);

  // Handle URL parameter changes - improved to prevent duplicate searches
  useEffect(() => {
    const urlSearchTerm = searchParams.get('search') || '';

    if (urlSearchTerm && urlSearchTerm.trim().length >= 3) {
      // Only trigger search if query is different OR if we have no results (page refresh case)
      const shouldSearch = urlSearchTerm !== query || (urlSearchTerm === query && results.length === 0);

      if (shouldSearch) {
        updateSearchState({
          query: urlSearchTerm,
          error: null
        });

        // Clear any existing timeout to prevent duplicate calls
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }

        // Trigger search for URL parameter
        searchTimeoutRef.current = setTimeout(() => {
          performSearch(urlSearchTerm);
        }, 300);
      }
    } else if (!urlSearchTerm && query) {
      // Only clear if URL is empty AND query exists
      updateSearchState({
        query: '',
        results: [],
        showDropdown: false,
        selectedIndex: -1,
        error: null
      });
    }
  }, [searchParams]);

  return (
    <div className="relative w-full min-w-0" ref={dropdownRef}>
      <div className="relative w-full">
        <div className="relative flex items-center">
          <div
            className="absolute left-0 pl-3 flex items-center justify-center cursor-pointer z-10 h-full"
            onClick={() => disabled && onSearchAttempt && onSearchAttempt()}
          >
            <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query || ''}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            onClick={() => disabled && onSearchAttempt && onSearchAttempt()}
            disabled={disabled}
            className={`w-full pl-10 ${query && query.length > 0 ? 'pr-10' : 'pr-4'} py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base placeholder-gray-400 transition-all duration-200 ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''
              }`}
            placeholder={disabled ? "Remove current brand to search again" : "Type brand name, page ID, or brand ID to search..."}
            autoComplete="off"
          />

          {query && query.length > 0 && (
            <div className="absolute right-0 pr-3 flex items-center justify-center h-full">
              <Button
                onClick={() => {
                  if (disabled && onSearchAttempt) {
                    onSearchAttempt();
                  } else {
                    clearSearch();
                  }
                }}
                disabled={disabled}
                size="sm"
                variant="ghost"
                className="p-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 rounded transition-colors flex items-center justify-center"
                title="Clear search"
                type="button"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 hover:text-gray-800 flex-shrink-0" />
              </Button>
            </div>
          )}

          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>

        {query && query.length < 3 && (
          <div className="mt-1.5 sm:mt-1 text-xs sm:text-sm text-gray-400 flex items-start sm:items-center min-w-0">
            <Search className="h-3 w-3 mr-1.5 sm:mr-1 flex-shrink-0 mt-0.5 sm:mt-0" />
            <span className="break-words leading-relaxed">Type at least 3 characters to search</span>
          </div>
        )}
      </div>

      {showDropdown && query && query.length >= 3 && !isSearching && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-0">
          {results && results.length > 0 ? (
            <div className="max-h-48 sm:max-h-64 overflow-y-auto">
              {results.map((brand, index) => (
                <Button
                  key={`${brand.brand_id}-${brand.page_id}`}
                  onClick={() => handleBrandSelect(brand)}
                  size="sm"
                  variant="ghost"
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${index === selectedIndex ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    } ${index === 0 ? 'rounded-t-lg' : ''} ${index === results.length - 1 ? 'rounded-b-lg' : ''
                    }`}
                >
                  <div className="flex items-center justify-between min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 break-words text-sm sm:text-base">
                        {brand.brand_name}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500 mt-0.5 break-words">
                        ID: {brand.brand_id} | Page: {brand.page_id}
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          ) : (
            <div className="px-3 sm:px-4 py-3 sm:py-4 text-center">
              <div className="text-sm text-gray-500">
                No brands available
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Try searching by brand name, page ID, or brand ID
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

BrandSearch.displayName = 'BrandSearch';

export default BrandSearch;