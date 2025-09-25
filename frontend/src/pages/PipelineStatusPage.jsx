import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Calendar,
  AlertCircle,
  Eye,
  Activity,
  ExternalLink
} from 'lucide-react';
import api from '../services/api';
import { pipelineAPI } from '../services/api';
import Card from '../components/ui/Card';
import Pagination from '../components/ui/Pagination';
import SearchInput from '../components/ui/SearchInput';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import SortButton from '../components/ui/SortButton';
import usePipelineSorting from '../hooks/usePipelineSorting';

const PipelineStatusPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // State management
  const [data, setData] = useState({
    brands: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      pages: 1,
      hasNext: false,
      hasPrev: false
    }
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get('page')) || 1
  );
  const [searchTerm, setSearchTerm] = useState('');

  // FIXED: Separate state for input value and actual selected date
  const [dateInputValue, setDateInputValue] = useState(
    searchParams.get('date') || new Date().toISOString().split('T')[0]
  );
  const [selectedDate, setSelectedDate] = useState(
    searchParams.get('date') || new Date().toISOString().split('T')[0]
  );

  // Search state management
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Sorting state management
  const { sortBy, sortOrder, updateSorting } = usePipelineSorting('normal', 'desc');

  // Debounced search term to avoid excessive API calls
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // 🚀 Search with request ID to prevent stale results (ULTIMATE FIX)
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
      
      const response = await pipelineAPI.searchBrandsStatus(query, selectedDate, {
        signal: searchAbortRef.current.signal
      });

      // 🔥 CRITICAL: Only update UI if this response matches current search term
      if (!searchAbortRef.current.signal.aborted && currentSearchRef.current === query) {
        if (response.data && response.data.success) {
          setSearchResults(response.data.data.brands || []);
          setShowSearchResults(true);
        } else {
          setSearchResults([]);
          setShowSearchResults(false);
        }
      }
    } catch (error) {
      // Ignore cancelled requests
      if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
        console.error('Error searching brands:', error);
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
  }, [selectedDate]);

  // Clear search function with request cancellation
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setShowSearchResults(false);
    setSearchResults([]);
    setIsSearching(false);
    setDebouncedSearchTerm('');
    
    // Cancel any pending search requests
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
  }, []);

  // 🚀 Simple search handler with stale result prevention
  const handleSearch = useCallback((query) => {
    setSearchTerm(query);
    
    // Update current search reference immediately
    currentSearchRef.current = query;
    
    // Clear results immediately if empty or too short
    if (!query.trim() || query.trim().length < 3) {
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
      if (currentSearchRef.current === query) {
        searchBrands(query);
      }
    }, 300);
  }, [searchBrands]);

  // Refs for cleanup
  const debounceTimerRef = useRef(null);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Get display brands (search results or paginated data)
  const displayBrands = showSearchResults ? searchResults : (data.brands || []);

  // Memoize API call to prevent unnecessary calls
  const fetchPipelineStatus = useCallback(async (page = currentPage, sortByParam = null, sortOrderParam = null) => {
    try {
      setError(null);
      const currentSortBy = sortByParam || sortBy;
      const currentSortOrder = sortOrderParam || sortOrder;
      const response = await pipelineAPI.getAllBrandsStatus(page, 10, selectedDate, currentSortBy, currentSortOrder);

      if (response.data && response.data.brands) {
        setData(response.data);
      } else {
        setData({
          brands: response.data || [],
          pagination: {
            page: 1,
            limit: 10,
            total: response.data?.length || 0,
            pages: 1,
            hasNext: false,
            hasPrev: false
          }
        });
      }
    } catch (error) {
      console.error('Error fetching pipeline status:', error);
      setError('Failed to fetch pipeline status. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setPageLoading(false);
    }
  }, [currentPage, selectedDate, sortBy, sortOrder]);

  // Fetch data on component mount and when dependencies change
  useEffect(() => {
    // Only fetch paginated data if not in search mode
    if (!showSearchResults) {
      fetchPipelineStatus(currentPage);
    }
  }, [showSearchResults, currentPage, selectedDate, sortBy, sortOrder, fetchPipelineStatus]); // Keep fetchPipelineStatus but with stable dependencies

  // FIXED: Debounced date change effect to prevent immediate API calls while typing
  useEffect(() => {
    // Validate date format (YYYY-MM-DD) before making API call
    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateInputValue);

    if (!isValidDate) return;

    // Only update if the date actually changed
    if (dateInputValue === selectedDate) return;

    const timer = setTimeout(() => {
      setLoading(true); 
      setSelectedDate(dateInputValue);
      setCurrentPage(1);
      setSearchParams({ date: dateInputValue });
    }, 700); 

    return () => clearTimeout(timer);
  }, [dateInputValue, selectedDate, setSearchParams]);

  // Memoize handlers to prevent unnecessary re-renders
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPipelineStatus(currentPage);
  }, [fetchPipelineStatus, currentPage]);

  // const handlePageChange = useCallback(async (newPage) => {
  //   setPageLoading(true);
  //   setCurrentPage(newPage);
    
  //   // Update URL parameters to persist page number
  //   const newSearchParams = new URLSearchParams(searchParams);
  //   newSearchParams.set('page', newPage.toString());
  //   if (selectedDate) {
  //     newSearchParams.set('date', selectedDate);
  //   }
  //   setSearchParams(newSearchParams);
    
  //   try {
  //     await fetchPipelineStatus(newPage);
  //   } catch (error) {
  //     console.error('Error changing page:', error);
  //   } finally {
  //     setPageLoading(false);
  //   }
  // }, [fetchPipelineStatus, searchParams, setSearchParams, selectedDate]);

  const handlePageChange = useCallback(async (newPage) => {
    setPageLoading(true);  // ✅ Keep this for the loading indicator
    setCurrentPage(newPage);

    // Update URL parameters to persist page number
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('page', newPage.toString());
    if (selectedDate) {
      newSearchParams.set('date', selectedDate);
    }
    setSearchParams(newSearchParams);

    try {
      await fetchPipelineStatus(newPage);
    } catch (error) {
      console.error('Error changing page:', error);
    } finally {
      setPageLoading(false);  // ✅ Keep this to reset loading
    }
  }, [fetchPipelineStatus, searchParams, setSearchParams, selectedDate]);

  const handleSortChange = useCallback((field, order) => {
    setPageLoading(true);
    updateSorting(field, order);
    setCurrentPage(1); // Reset to page 1 when sorting changes
    
    // Update URL parameters to reset page to 1
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('page', '1');
    if (selectedDate) {
      newSearchParams.set('date', selectedDate);
    }
    setSearchParams(newSearchParams);
    
    // The useEffect will automatically trigger fetchPipelineStatus when sortBy/sortOrder changes
  }, [updateSorting, searchParams, setSearchParams, selectedDate]);

  // FIXED: New date input change handler that only updates the input value
  const handleDateInputChange = useCallback((e) => {
    setDateInputValue(e.target.value);
  }, []);

  // UPDATED: getStatusIcon function remains the same
  const getStatusIcon = useCallback((status, completed) => {
    const completedStatuses = [
      'Started', 'Completed',
      'Stored (has new ads)', 'Stored (no new ads today)', 'Stored (processing done)',
      'COMPLETED'
    ];

    if (completed) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }

    if (completedStatuses.includes(status)) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }

    switch (status) {
      case 'Blocked':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'Unknown':
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
      case 'In progress (some ads stored)':
      case 'In progress (no ads yet)':
      case 'In progress (not finished)':
      case 'WAITING':
      case 'PROCESSING':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'Failed/blocked':
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'Not started':
      case 'NOT_PROCESSED':
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
      default:
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  }, []);

  const getStatusColor = useCallback((status, completed) => {
    const completedStatuses = [
      'Started', 'Completed',
      'Stored (has new ads)', 'Stored (no new ads today)', 'Stored (processing done)',
      'COMPLETED'
    ];

    if (completed) {
      return 'text-green-600';
    }

    if (completedStatuses.includes(status)) {
      return 'text-green-600';
    }

    switch (status) {
      case 'Blocked':
      case 'Failed/blocked':
      case 'FAILED':
        return 'text-red-600';
      case 'Unknown':
      case 'Not started':
      case 'NOT_PROCESSED':
        return 'text-gray-500';
      case 'In progress (some ads stored)':
      case 'In progress (no ads yet)':
      case 'In progress (not finished)':
      case 'WAITING':
      case 'PROCESSING':
        return 'text-yellow-600';
      default:
        return 'text-gray-500';
    }
  }, []);

  const getStatusText = useCallback((status, completed) => {
    if (completed) return 'Completed';

    switch (status) {
      case 'Started':
        return 'Started';
      case 'Completed':
        return 'Completed';
      case 'Blocked':
        return 'Blocked';
      case 'Unknown':
        return 'Unknown';
      case 'Stored (has new ads)':
        return 'Stored (has new ads)';
      case 'Stored (no new ads today)':
        return 'Stored (no new ads today)';
      case 'Stored (processing done)':
        return 'Stored (processing done)';
      case 'In progress (some ads stored)':
        return 'In progress (some ads stored)';
      case 'In progress (no ads yet)':
        return 'In progress (no ads yet)';
      case 'In progress (not finished)':
        return 'In progress (not finished)';
      case 'Failed/blocked':
        return 'Failed/blocked';
      case 'Not started':
        return 'Not started';
      case 'WAITING':
        return 'Waiting';
      case 'PROCESSING':
        return 'Processing';
      case 'FAILED':
        return 'Failed';
      case 'NOT_PROCESSED':
        return 'Not Started';
      case 'COMPLETED':
        return 'Completed';
      default:
        return 'Unknown';
    }
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  const getProgressIndicator = useCallback((completed, total, status) => {
    if (total === 0) return null;

    // For COMPLETED status, show 100% progress regardless of URL completion
    let displayCompleted = completed;
    let displayTotal = total;
    let percentage = Math.round((completed / total) * 100);

    if (status === 'COMPLETED') {
      displayCompleted = total; // Show all files as completed
      displayTotal = total;
      percentage = 100;
    }

    let colorClass = 'bg-gray-200';

    if (status === 'COMPLETED') {
      colorClass = 'bg-green-500';
    } else if (status === 'PROCESSING' || status === 'WAITING') {
      colorClass = 'bg-yellow-500';
    } else if (status === 'FAILED') {
      colorClass = 'bg-red-500';
    }

    return (
      <div className="flex items-center gap-2 mt-1">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${colorClass} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 min-w-0">
          {displayCompleted}/{displayTotal} ({percentage}%)
        </span>
      </div>
    );
  }, []);

  // Memoize brand card component to prevent unnecessary re-renders
  const BrandCard = React.memo(({ brand }) => (
    <Card key={brand.brandId} className="hover:shadow-lg transition-shadow duration-200 relative">
      {/* Watchlist Badge - Top Left Corner */}
      {brand.isWatchlist && (
        <div className="absolute top-3 left-3 z-10">
          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
            Watchlist
          </span>
        </div>
      )}

      {/* Brand Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0" style={{ paddingTop: brand.isWatchlist ? '32px' : '0' }}>
          <h3 className="text-lg font-semibold text-gray-900 break-words overflow-hidden"
            title={brand.brandName || 'Unknown Brand'}>
            {brand.brandName || 'Unknown Brand'}
          </h3>
          <p className="text-sm text-gray-500 truncate">ID: {brand.brandId}</p>
          {brand.pageId && (
            <p className="text-xs text-gray-400 truncate">Page: {brand.pageId}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {brand.scraping?.completed && brand.dbStored?.completed &&
            brand.typesense?.completed && brand.fileUpload?.completed && (
              <div className="w-2 h-2 bg-green-500 rounded-full" title="All stages complete" />
            )}
        </div>
      </div>

      {/* Pipeline Stages */}
      <div className="space-y-3">
        {/* Scraping Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon(brand.scraping?.status, brand.scraping?.completed)}
            <div>
              <p className="text-sm font-medium text-gray-900">Scraping</p>
              <p className="text-xs text-gray-500">
                {getStatusText(brand.scraping?.status, brand.scraping?.completed)}
              </p>
            </div>
          </div>
          <div className="text-right">
            {brand.scraping?.timestamp && (
              <p className="text-xs text-gray-400">
                {formatDate(brand.scraping.timestamp)}
              </p>
            )}
          </div>
        </div>

        {/* DB Stored Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon(brand.dbStored?.status, brand.dbStored?.completed)}
            <div>
              <p className="text-sm font-medium text-gray-900">DB Stored</p>
              <p className="text-xs text-gray-500">
                {brand.dbStored?.status || 'Not started'}
              </p>
            </div>
          </div>
          <div className="text-right">
            {brand.dbStored?.activeAds > 0 && (
              <p className="text-xs text-gray-400">
                {brand.dbStored.activeAds} ads
              </p>
            )}
          </div>
        </div>

        {/* Typesense Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon(brand.typesense?.status, brand.typesense?.completed)}
            <div>
              <p className="text-sm font-medium text-gray-900">Typesense</p>
              <p className="text-xs text-gray-500">
                {getStatusText(brand.typesense?.status, brand.typesense?.completed)}
              </p>
              {/* Progress indicator for Typesense */}
              {getProgressIndicator(
                brand.typesense?.adsWithTypesense || 0,
                brand.typesense?.totalAds || 0,
                brand.typesense?.status
              )}
            </div>
          </div>
          <div className="text-right">
            {brand.typesense?.totalAds > 0 && (
              <p className="text-xs text-gray-400">
                {brand.typesense.adsWithTypesense}/{brand.typesense.totalAds} ads
              </p>
            )}
          </div>
        </div>

        {/* File Upload Status with enhanced display */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon(brand.fileUpload?.status, brand.fileUpload?.completed)}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">File Upload</p>
              <p className={`text-xs ${getStatusColor(brand.fileUpload?.status, brand.fileUpload?.completed)}`}>
                {getStatusText(brand.fileUpload?.status, brand.fileUpload?.completed)}
              </p>
              {/* Enhanced progress indicator for file upload */}
              {getProgressIndicator(
                brand.fileUpload?.mediaWithAllUrls || 0,
                brand.fileUpload?.totalMedia || 0,
                brand.fileUpload?.status
              )}
            </div>
          </div>
          <div className="text-right">
            {brand.fileUpload?.totalMedia > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-400">
                  {brand.fileUpload?.status === 'COMPLETED'
                    ? `${brand.fileUpload.totalMedia}/${brand.fileUpload.totalMedia} files`
                    : `${brand.fileUpload.mediaWithAllUrls}/${brand.fileUpload.totalMedia} files`
                  }
                </p>
                {/* Show queue and failed counts */}
                {(brand.fileUpload?.mediaInQueue > 0 || brand.fileUpload?.mediaFailed > 0) && (
                  <div className="flex flex-col gap-1">
                    {brand.fileUpload.mediaInQueue > 0 && (
                      <span className="text-xs text-yellow-600">
                        {brand.fileUpload.mediaInQueue} queued
                      </span>
                    )}
                    {brand.fileUpload.mediaFailed > 0 && (
                      <span className="text-xs text-red-600">
                        {brand.fileUpload.mediaFailed} failed
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced additional info section */}
      {(brand.typesense?.adsInQueue > 0 || brand.typesense?.adsFailed > 0 ||
        brand.fileUpload?.mediaInQueue > 0 || brand.fileUpload?.mediaFailed > 0) && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-600">Queue Status</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Typesense Queue Info */}
              {(brand.typesense?.adsInQueue > 0 || brand.typesense?.adsFailed > 0) && (
                <div className="space-y-1">
                  <span className="font-medium text-gray-600">Typesense:</span>
                  {brand.typesense?.adsInQueue > 0 && (
                    <div className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-center">
                      {brand.typesense.adsInQueue} in queue
                    </div>
                  )}
                  {brand.typesense?.adsFailed > 0 && (
                    <div className="px-2 py-1 bg-red-100 text-red-800 rounded text-center">
                      {brand.typesense.adsFailed} failed
                    </div>
                  )}
                </div>
              )}

              {/* File Upload Queue Info */}
              {(brand.fileUpload?.mediaInQueue > 0 || brand.fileUpload?.mediaFailed > 0) && (
                <div className="space-y-1">
                  <span className="font-medium text-gray-600">Files:</span>
                  {brand.fileUpload?.mediaInQueue > 0 && (
                    <div className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-center">
                      {brand.fileUpload.mediaInQueue} queued
                    </div>
                  )}
                  {brand.fileUpload?.mediaFailed > 0 && (
                    <div className="px-2 py-1 bg-red-100 text-red-800 rounded text-center">
                      {brand.fileUpload.mediaFailed} failed
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      {/* External Link Icon - Bottom Right */}
      {brand.pageId && (
        <button
          onClick={() => {
            const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${brand.pageId}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
          className="absolute bottom-4 right-4 p-2 text-gray-400 hover:text-blue-600 transition-colors bg-white rounded-full shadow-sm border border-gray-200"
          title="View in Facebook Ad Library"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      )}
    </Card>
  ));

  if (loading && !refreshing) {
    return <LoadingSpinner />;
  }

  // if (pageLoading) {
  //   return <LoadingSpinner />;
  // }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center py-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pipeline Status Dashboard</h1>
              <p className="mt-2 text-sm text-gray-600">
                Monitor the complete processing status for all brands
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* FIXED: Date Picker with separate input value */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={dateInputValue}
                  onChange={handleDateInputChange}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Refresh Button */}
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="primary"
                size="sm"
                className="flex items-center gap-2"
              >
                {refreshing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && <ErrorDisplay error={error} className="mb-6" />}

        {/* Sorting Controls - Only show when not in search mode */}
        {!showSearchResults && (
          <Card className="mb-4">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-700 self-center">Sort by:</span>
              <SortButton
                label="Normal"
                sortBy="normal"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSortChange={handleSortChange}
              />
              <SortButton
                label="Ads Count"
                sortBy="active_ads"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSortChange={handleSortChange}
              />
            </div>
          </Card>
        )}

        {/* Search and Filters */}
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={searchTerm}
                onChange={handleSearch}
                onClear={clearSearch}
                placeholder="Search brands by name, ID, or page ID..."
                leftIcon={<Search className="h-4 w-4" />}
                loading={isSearching}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Eye className="h-4 w-4" />
              <span>
                {showSearchResults
                  ? `Showing ${searchResults.length} search result${searchResults.length !== 1 ? 's' : ''}`
                  : `Showing ${displayBrands.length} of ${data.pagination.total} brands`
                }
              </span>
            </div>
          </div>
        </Card>

        {/* Brand Cards Grid */}
        {displayBrands.length === 0 ? (
          <Card className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No brands found</h3>
            <p className="text-gray-500">
              {showSearchResults ? 'Try adjusting your search terms' : 'No brands available for the selected date'}
            </p>
          </Card>
        ) : (
          <div className="relative">
            {/* Full-viewport overlay loading that looks like full-page loading */}
            {pageLoading && (
              <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
                <LoadingSpinner />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
              {displayBrands.map((brand) => (
                <BrandCard key={brand.brandId} brand={brand} />
              ))}
            </div>
          </div>
        )}

        {/* Pagination - Only show when not in search mode */}
        {!showSearchResults && data.pagination.pages > 1 && (
          <Card>
            <div className="relative">
              {pageLoading && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                  <div className="flex items-center space-x-2 text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm">Loading page...</span>
                  </div>
                </div>
              )}
              <Pagination
                currentPage={data.pagination.page}
                totalPages={data.pagination.pages}
                onPageChange={handlePageChange}
                totalItems={data.pagination.total}
                itemsPerPage={data.pagination.limit}
                showPageInfo={true}
              />
            </div>
          </Card>
        )}

        {/* Search Results Info */}
        {showSearchResults && (
          <Card className="text-center py-4">
            <div className="text-sm text-gray-600">
              Showing {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchTerm}"
              <button
                onClick={clearSearch}
                className="ml-2 text-blue-600 hover:text-blue-800 underline"
              >
                Clear search
              </button>
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Last updated: {new Date().toLocaleString()}</p>
          {selectedDate && (
            <p className="mt-1">Showing data for: {formatDate(selectedDate)}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PipelineStatusPage;