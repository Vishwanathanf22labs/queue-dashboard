import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { scrapedBrandsAPI } from '../services/api';
import Card from '../components/ui/Card';
import SearchInput from '../components/ui/SearchInput';
import Pagination from '../components/ui/Pagination';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import Badge from '../components/ui/Badge';
import SortButton from '../components/ui/SortButton';
import useScrapedBrandsSorting from '../hooks/useScrapedBrandsSorting';
import { Calendar, Search, TrendingUp, TrendingDown, Minus, BarChart3, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

const ScrapedBrands = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { sortBy, sortOrder, updateSorting } = useScrapedBrandsSorting('normal', 'desc');

  // Get date from URL params or default to today
  const getInitialDate = () => {
    const urlDate = searchParams.get('date');
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
      return urlDate;
    }
    return new Date().toISOString().split('T')[0];
  };

  const [dataState, setDataState] = useState({
    brands: [],
    stats: null,
    currentPage: parseInt(searchParams.get('page')) || 1,
    totalPages: 1,
    totalItems: 0,
    selectedDate: getInitialDate()
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [dateInputValue, setDateInputValue] = useState(getInitialDate());
  const [pageLoading, setPageLoading] = useState(false);

  const updateDataState = useCallback((updates) => {
    setDataState(prev => ({ ...prev, ...updates }));
  }, []);

  const loadScrapedBrands = useCallback(async (page = 1, date = null, sortByParam = null, sortOrderParam = null) => {
    try {
      // Only set main loading if no data exists, otherwise use pageLoading
      if (!dataState.brands.length) {
        setIsLoading(true);
      } else {
        setPageLoading(true);
      }

      const currentSortBy = sortByParam || sortBy;
      const currentSortOrder = sortOrderParam || sortOrder;
      const response = await scrapedBrandsAPI.getScrapedBrands(page, 10, date, currentSortBy, currentSortOrder);

      if (response.data.success) {
        const brands = response.data.data.brands || [];
        const pagination = response.data.data.pagination || {};

        updateDataState({
          brands,
          currentPage: pagination.currentPage || 1,
          totalPages: pagination.totalPages || 1,
          totalItems: pagination.totalItems || 0
        });
      } else {
        toast.error(response.data.error || 'Failed to load scraped brands');
      }
    } catch (error) {
      console.error('Error loading scraped brands:', error);
      toast.error('Failed to load scraped brands');
    } finally {
      setIsLoading(false);
      setPageLoading(false);  // Reset page loading
    }
  }, [updateDataState, sortBy, sortOrder, dataState.brands.length]);

  const loadStats = useCallback(async (date = null) => {
    try {
      const response = await scrapedBrandsAPI.getScrapedBrandsStats(date);

      if (response.data.success) {
        updateDataState({ stats: response.data.data });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [updateDataState]);

  // 🚀 Fixed search with request ID to prevent stale results
  const searchAbortRef = useRef(null);
  const currentSearchRef = useRef('');

  const searchBrands = useCallback(async (query) => {
    // Cancel previous search request if still pending
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    if (!query.trim()) {
      setShowSearchResults(false);
      setSearchResults([]);
      setIsSearching(false);
      currentSearchRef.current = '';
      return;
    }

    try {
      setIsSearching(true);

      // Store current search query
      currentSearchRef.current = query;

      // Create new AbortController for this request
      searchAbortRef.current = new AbortController();

      const response = await scrapedBrandsAPI.searchScrapedBrands(query, dataState.selectedDate, {
        signal: searchAbortRef.current.signal
      });

      // 🔥 CRITICAL: Only update UI if this response matches current search term
      if (!searchAbortRef.current.signal.aborted && currentSearchRef.current === query) {
        if (response.data.success) {
          setSearchResults(response.data.data.brands || []);
          setShowSearchResults(true);
        } else {
          toast.error(response.data.error || 'Search failed');
          setSearchResults([]);
          setShowSearchResults(false);
        }
      }
    } catch (error) {
      // Ignore cancelled requests
      if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
        console.error('Error searching brands:', error);
        toast.error('Search failed');
        // Only clear if this was the current search
        if (currentSearchRef.current === query) {
          setSearchResults([]);
          setShowSearchResults(false);
        }
      }
    } finally {
      // Only reset loading if this was the current search
      if (currentSearchRef.current === query) {
        setIsSearching(false);
      }
    }
  }, [dataState.selectedDate]);

  const handleDateInputChange = useCallback((e) => {
    setDateInputValue(e.target.value);
  }, []);

  // Add this useEffect for debounced date changes
  useEffect(() => {
    // Validate date format (YYYY-MM-DD) before making API call
    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateInputValue);

    if (!isValidDate) return;

    // Only update if the date actually changed
    if (dateInputValue === dataState.selectedDate) return;

    const timer = setTimeout(() => {
      setPageLoading(true);

      // Update URL params to persist the selected date and reset page to 1
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('date', dateInputValue);
      newSearchParams.set('page', '1');
      setSearchParams(newSearchParams);

      updateDataState({ selectedDate: dateInputValue, currentPage: 1 });
    }, 700); // 700ms debounce

    return () => clearTimeout(timer);
  }, [dateInputValue, dataState.selectedDate, setSearchParams, searchParams, updateDataState]);

  // 🚀 Fixed search handler with debouncing and minimum chars
  const debounceTimerRef = useRef(null);

  const handleSearch = useCallback((query) => {
    setSearchTerm(query);

    // Auto-add leading zeros for numeric searches (1-2 digits)
    let processedQuery = query;
    if (query && /^\d{1,2}$/.test(query.trim())) {
      // If it's 1-2 digits, add leading zeros to make it 3 digits
      processedQuery = query.trim().padStart(3, '0');
    }

    // Update current search reference immediately
    currentSearchRef.current = processedQuery;

    // Update URL parameters to persist search
    const newSearchParams = new URLSearchParams(searchParams);
    if (processedQuery && processedQuery.trim().length >= 3) {
      newSearchParams.set('search', processedQuery);
    } else {
      newSearchParams.delete('search');
    }
    setSearchParams(newSearchParams, { replace: true });

    // Clear results immediately if empty or too short
    if (!processedQuery.trim() || processedQuery.trim().length < 3) {
      setShowSearchResults(false);
      setSearchResults([]);
      setIsSearching(false);
      currentSearchRef.current = '';

      // Cancel any pending search
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      return;
    }

    // Debounce the actual search
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      // Double-check current search term before making API call
      if (currentSearchRef.current === processedQuery) {
        searchBrands(processedQuery);
      }
    }, 300);
  }, [searchBrands, searchParams, setSearchParams]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setShowSearchResults(false);
    setSearchResults([]);
    setIsSearching(false);
    currentSearchRef.current = '';

    // Cancel any pending search
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    // Remove search parameter from URL
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('search');
    setSearchParams(newSearchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
    };
  }, []);

  // Read search parameter from URL on component mount and restore search
  useEffect(() => {
    const urlSearchTerm = searchParams.get('search');
    if (urlSearchTerm && urlSearchTerm.trim().length >= 3) {
      setSearchTerm(urlSearchTerm);
      currentSearchRef.current = urlSearchTerm;
      searchBrands(urlSearchTerm);
    }
  }, []); // Only run on mount

  const handlePageChange = (page) => {
    setPageLoading(true);  // Add loading for pagination
    updateDataState({ currentPage: page });

    // Update URL parameters to persist page number
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('page', page.toString());
    if (dataState.selectedDate) {
      newSearchParams.set('date', dataState.selectedDate);
    }
    setSearchParams(newSearchParams);
  };

  const handleSortChange = (field, order) => {
    updateSorting(field, order);
    // Reset to page 1 when sorting changes
    updateDataState({ currentPage: 1 });

    // Update URL parameters to reset page to 1
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('page', '1');
    if (dataState.selectedDate) {
      newSearchParams.set('date', dataState.selectedDate);
    }
    setSearchParams(newSearchParams);

    // Don't call loadScrapedBrands here - let useEffect handle it
  };

  const getComparativeStatusIcon = (status) => {
    switch (status) {
      case 'increased':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'decreased':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'no change':
        return <Minus className="h-4 w-4 text-gray-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getComparativeStatusColor = (status) => {
    switch (status) {
      case 'increased':
        return 'bg-green-100 text-green-800';
      case 'decreased':
        return 'bg-red-100 text-red-800';
      case 'no change':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Sync URL params with component state
  useEffect(() => {
    const urlDate = searchParams.get('date');
    if (urlDate && urlDate !== dataState.selectedDate) {
      updateDataState({ selectedDate: urlDate, currentPage: 1 });
    }
  }, [searchParams, dataState.selectedDate, updateDataState]);

  // Load scraped brands data when page/date/sorting changes
  useEffect(() => {
    loadScrapedBrands(dataState.currentPage, dataState.selectedDate, sortBy, sortOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataState.currentPage, dataState.selectedDate, sortBy, sortOrder]);

  // Load stats only when date changes
  useEffect(() => {
    loadStats(dataState.selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataState.selectedDate]);

  if (isLoading && !dataState.brands.length) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  const displayBrands = showSearchResults ? searchResults : dataState.brands;

  // FIXED: Properly centered loading for page loading
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Scraped Brands
          </h1>
          <p className="text-gray-600">
            View scraped brands data for the selected date
          </p>
        </div>

        {/* Stats Cards */}
        {dataState.stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Brands</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dataState.stats.totalBrands || 0}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Ads</p>
                  <p className="text-2xl font-bold text-green-600">
                    {dataState.stats.totalActiveAds || 0}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center">
                <TrendingDown className="h-8 w-8 text-red-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Inactive Ads</p>
                  <p className="text-2xl font-bold text-red-600">
                    {dataState.stats.totalInactiveAds || 0}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center">
                <Minus className="h-8 w-8 text-gray-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Stopped Ads</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {dataState.stats.totalStoppedAds || 0}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Date Picker */}
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-500 sm:hidden" />
            <div className="relative w-full sm:w-auto min-w-0">
              <input
                type="date"
                value={dateInputValue}
                onChange={handleDateInputChange}
                className="px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto min-w-0"
                style={{
                  WebkitAppearance: 'none',
                  MozAppearance: 'textfield'
                }}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none sm:hidden">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchTerm}
              onChange={handleSearch}
              onClear={clearSearch}
              placeholder="Search brands..."
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Sorting Buttons */}
        {!showSearchResults && (
          <div className="mb-6 flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 self-center">Sort by:</span>
            <SortButton
              label="Normal"
              sortBy="normal"
              currentSortBy={sortBy}
              currentSortOrder={sortOrder}
              onSortChange={handleSortChange}
            />
            <SortButton
              label="Active Ads"
              sortBy="active_ads"
              currentSortBy={sortBy}
              currentSortOrder={sortOrder}
              onSortChange={handleSortChange}
            />
            <SortButton
              label="Inactive Ads"
              sortBy="inactive_ads"
              currentSortBy={sortBy}
              currentSortOrder={sortOrder}
              onSortChange={handleSortChange}
            />
          </div>
        )}

        {/* Results */}
        {isSearching ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : showSearchResults && searchResults.length === 0 && searchTerm ? (
          <Card className="p-8 text-center">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No brands found</h3>
            <p className="text-gray-600">Try adjusting your search terms</p>
          </Card>
        ) : displayBrands.length === 0 ? (
          <Card className="p-8 text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No brands found</h3>
            <p className="text-gray-600">No scraped brands data for the selected date</p>
          </Card>
        ) : (
          <>
            {/* Brands Grid */}
            <div className="relative">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                {displayBrands.map((brand) => (
                  <Card key={`${brand.brand_id}-${brand.started_at}`} className="p-4 hover:shadow-md transition-shadow relative">
                    {/* Watchlist Badge - Top Left Corner */}
                    {brand.isWatchlist && (
                      <div className="absolute top-3 left-3 z-10">
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                          Watchlist
                        </span>
                      </div>
                    )}

                    <div className="space-y-3" style={{ paddingTop: brand.isWatchlist ? '32px' : '0' }}>
                      {/* Brand Name */}
                      <div>
                        <h3 className="font-semibold text-gray-900 truncate" title={brand.brand_name}>
                          {brand.brand_name}
                        </h3>
                        <p className="text-sm text-gray-500">ID: {brand.brand_id}</p>
                      </div>

                      {/* Ads Counts */}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-center p-2 bg-green-50 rounded">
                          <p className="text-green-600 font-medium">
                            {brand.active_ads || 0}
                          </p>
                          <p className="text-green-600 text-xs">Active</p>
                        </div>
                        <div className="text-center p-2 bg-red-50 rounded">
                          <p className="text-red-600 font-medium">
                            {brand.inactive_ads || 0}
                          </p>
                          <p className="text-red-600 text-xs">Inactive</p>
                        </div>
                      </div>

                      {/* Stopped Ads */}
                      {brand.stopped_ads && (
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <p className="text-gray-600 font-medium">
                            {brand.stopped_ads}
                          </p>
                          <p className="text-gray-600 text-xs">Stopped</p>
                        </div>
                      )}

                      {/* Comparative Status */}
                      {brand.comparative_status && (
                        <div className="flex items-center justify-center">
                          <Badge
                            className={`${getComparativeStatusColor(brand.comparative_status)} flex items-center space-x-1`}
                          >
                            {getComparativeStatusIcon(brand.comparative_status)}
                            <span className="capitalize">{brand.comparative_status}</span>
                          </Badge>
                        </div>
                      )}

                      {/* Started At */}
                      <div className="text-xs text-gray-500 text-center">
                        {formatDate(brand.started_at)}
                      </div>
                    </div>

                    {/* External Link Icon - Bottom Right */}
                    {brand.page_id && (
                      <button
                        onClick={() => {
                          const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${brand.page_id}`;
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                        className="absolute bottom-4 right-4 p-2 text-gray-400 hover:text-blue-600 transition-colors bg-white rounded-full shadow-sm border border-gray-200"
                        title="View in Facebook Ad Library"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            {/* Pagination */}
            {!showSearchResults && dataState.totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination
                  currentPage={dataState.currentPage}
                  totalPages={dataState.totalPages}
                  onPageChange={handlePageChange}
                  showInfo={true}
                  totalItems={dataState.totalItems}
                  itemsPerPage={10}
                />
              </div>
            )}

            {/* Search Results Info */}
            {showSearchResults && (
              <div className="text-center text-sm text-gray-600 mb-4">
                Showing {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchTerm}"
                <button
                  onClick={clearSearch}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Clear search
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ScrapedBrands;