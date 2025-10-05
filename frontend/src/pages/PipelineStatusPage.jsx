import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CheckCircle,
  XCircle,
  Clock,
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
import RefreshControl from '../components/ui/RefreshControl';
import usePipelineSorting from '../hooks/usePipelineSorting';
import useAutoRefresh from '../hooks/useAutoRefresh';

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

  // Separate state for overall stats
  const [overallStats, setOverallStats] = useState(null);
  const [overallStatsLoading, setOverallStatsLoading] = useState(false);

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

  // Clear search function with request cancellation and URL cleanup
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setShowSearchResults(false);
    setSearchResults([]);
    setIsSearching(false);
    setDebouncedSearchTerm('');
    
    // Remove search parameter from URL
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('search');
    setSearchParams(newSearchParams, { replace: true });
    
    // Cancel any pending search requests
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
  }, [searchParams, setSearchParams]);

  // 🚀 Simple search handler with stale result prevention and URL persistence
  const handleSearch = useCallback((query) => {
    setSearchTerm(query);
    
    // Update current search reference immediately
    currentSearchRef.current = query;
    
    // Update URL parameters to persist search
    const newSearchParams = new URLSearchParams(searchParams);
    if (query && query.trim().length >= 3) {
      newSearchParams.set('search', query);
    } else {
      newSearchParams.delete('search');
    }
    setSearchParams(newSearchParams, { replace: true });
    
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
  }, [searchBrands, searchParams, setSearchParams]);

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
  const displayBrands = showSearchResults ? (Array.isArray(searchResults) ? searchResults : []) : (Array.isArray(data.brands) ? data.brands : []);

  // Separate function to fetch overall stats
  const fetchOverallStats = useCallback(async () => {
    try {
      setOverallStatsLoading(true);
      const response = await pipelineAPI.getOverallStats(selectedDate);
      
      if (response.data && response.data.data && response.data.data.overallStats) {
        setOverallStats(response.data.data.overallStats);
      } else {
        console.warn('Unexpected overall stats response structure:', response.data);
        setOverallStats(null);
      }
    } catch (error) {
      console.error('Error fetching overall stats:', error);
      setOverallStats(null);
    } finally {
      setOverallStatsLoading(false);
    }
  }, [selectedDate]);

  // Memoize API call to prevent unnecessary calls
  const fetchPipelineStatus = useCallback(async (page = currentPage, sortByParam = null, sortOrderParam = null) => {
    try {
      setError(null);
      const currentSortBy = sortByParam || sortBy;
      const currentSortOrder = sortOrderParam || sortOrder;
      const response = await pipelineAPI.getAllBrandsStatus(page, 10, selectedDate, currentSortBy, currentSortOrder);

      if (response.data && response.data.data && Array.isArray(response.data.data.brands)) {
        setData(response.data.data);
      } else {
        console.warn('Unexpected API response structure:', response.data);
        setData({
          brands: [],
          pagination: {
            page: 1,
            perPage: 10,
            total: 0,
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
  }, [selectedDate, sortBy, sortOrder]); // Removed currentPage from deps to prevent infinite loops

  // Read search parameter from URL on component mount and restore search
  useEffect(() => {
    const urlSearchTerm = searchParams.get('search');
    if (urlSearchTerm && urlSearchTerm.trim().length >= 3) {
      setSearchTerm(urlSearchTerm);
      currentSearchRef.current = urlSearchTerm;
      searchBrands(urlSearchTerm);
    }
  }, []); // Only run on mount

  // Fetch overall stats only when date changes (not on pagination/sorting)
  useEffect(() => {
    if (!showSearchResults) {
      fetchOverallStats();
    }
  }, [selectedDate, showSearchResults, fetchOverallStats]);

  // Fetch pipeline data when pagination/sorting changes
  useEffect(() => {
    if (!showSearchResults) {
      fetchPipelineStatus(currentPage);
    }
  }, [showSearchResults, currentPage, sortBy, sortOrder, fetchPipelineStatus]);

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

  // Auto-refresh hook
  const refreshFn = useCallback(async () => {
    try {
      await fetchPipelineStatus(currentPage);
      toast.success('Pipeline status refreshed successfully');
    } catch (error) {
      console.error('PipelineStatus refresh failed:', error);
    }
  }, [fetchPipelineStatus, currentPage]);

  const { refreshInterval, isRefreshing, setIntervalValue, manualRefresh } = useAutoRefresh(
    refreshFn,
    [currentPage, selectedDate, sortBy, sortOrder]
  );

  // Memoize handlers to prevent unnecessary re-renders
  const handleRefresh = useCallback(async () => {
    await manualRefresh();
  }, [manualRefresh]);

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

  const handlePageChange = useCallback((newPage) => {
    setPageLoading(true);  // ✅ Keep this for the loading indicator
    setCurrentPage(newPage);

    // Update URL parameters to persist page number
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('page', newPage.toString());
    if (selectedDate) {
      newSearchParams.set('date', selectedDate);
    }
    setSearchParams(newSearchParams);

    // The useEffect will automatically trigger fetchPipelineStatus when currentPage changes
  }, [searchParams, setSearchParams, selectedDate]);

  const handleSortChange = useCallback((field, order) => {
    // Don't do anything if the sort parameters haven't actually changed
    if (field === sortBy && order === sortOrder) {
      return;
    }
    
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
  }, [updateSorting, searchParams, setSearchParams, selectedDate, sortBy, sortOrder]);

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
    
    // If it's a YYYY-MM-DD string, parse it directly without timezone conversion
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    // If it's an ISO timestamp, extract just the date part to avoid timezone issues
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(dateString)) {
      const datePart = dateString.split('T')[0]; // Extract YYYY-MM-DD part
      const [year, month, day] = datePart.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    // For other date formats, use the original logic
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

    // Return only the text count without progress bar
    return (
      <div className="mt-1">
        <span className="text-xs text-gray-500">
          {displayCompleted}/{displayTotal} ({percentage}%)
        </span>
      </div>
    );
  }, []);

  // Memoize brand card component to prevent unnecessary re-renders
  const BrandCard = React.memo(({ brand }) => (
    <Card key={brand.brandId} className="hover:shadow-lg transition-shadow duration-200 relative overflow-hidden">
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
        <div className="flex-1 min-w-0 overflow-hidden" style={{ paddingTop: brand.isWatchlist ? '32px' : '0' }}>
          <h3 className="text-lg font-semibold text-gray-900 break-words overflow-hidden"
            title={brand.brandName || 'Unknown Brand'}>
            {brand.brandName || 'Unknown Brand'}
          </h3>
          <p className="text-sm text-gray-500 truncate">ID: {brand.brandId}</p>
          {brand.pageId && (
            <p className="text-xs text-gray-400 truncate break-all">Page: {brand.pageId}</p>
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
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {getStatusIcon(brand.scraping?.status, brand.scraping?.completed)}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Scraping</p>
              <p className="text-xs text-gray-500 break-words">
                {getStatusText(brand.scraping?.status, brand.scraping?.completed)}
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            {brand.scraping?.timestamp && (
              <p className="text-xs text-gray-400 whitespace-nowrap">
                {formatDate(brand.scraping.timestamp)}
              </p>
            )}
          </div>
        </div>

        {/* DB Stored Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {getStatusIcon(brand.dbStored?.status, brand.dbStored?.completed)}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">DB Stored</p>
              <p className="text-xs text-gray-500 break-words">
                {brand.dbStored?.status || 'Not started'}
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            {brand.dbStored?.activeAds > 0 && (
              <p className="text-xs text-gray-400 whitespace-nowrap">
                {brand.dbStored.activeAds} ads
              </p>
            )}
          </div>
        </div>

        {/* Typesense Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {getStatusIcon(brand.typesense?.status, brand.typesense?.completed)}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Typesense</p>
              <p className="text-xs text-gray-500 break-words">
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
          <div className="text-right flex-shrink-0 ml-2">
            {brand.typesense?.totalAds > 0 && (
              <p className="text-xs text-gray-400 whitespace-nowrap">
                {brand.typesense.adsWithTypesense}/{brand.typesense.totalAds} ads
              </p>
            )}
          </div>
        </div>

        {/* File Upload Status with enhanced display */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {getStatusIcon(brand.fileUpload?.status, brand.fileUpload?.completed)}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">File Upload</p>
              <p className={`text-xs ${getStatusColor(brand.fileUpload?.status, brand.fileUpload?.completed)} break-words`}>
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
          <div className="text-right flex-shrink-0 ml-2">
            {brand.fileUpload?.totalMedia > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {brand.fileUpload?.status === 'COMPLETED'
                    ? `${brand.fileUpload.totalMedia}/${brand.fileUpload.totalMedia} files`
                    : `${brand.fileUpload.mediaWithAllUrls}/${brand.fileUpload.totalMedia} files`
                  }
                </p>
                {/* Show queue and failed counts */}
                {(brand.fileUpload?.mediaInQueue > 0 || brand.fileUpload?.mediaFailed > 0) && (
                  <div className="flex flex-col gap-1">
                    {brand.fileUpload.mediaInQueue > 0 && (
                      <span className="text-xs text-yellow-600 whitespace-nowrap">
                        {brand.fileUpload.mediaInQueue} queued
                      </span>
                    )}
                    {brand.fileUpload.mediaFailed > 0 && (
                      <span className="text-xs text-red-600 whitespace-nowrap">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Typesense Queue Info */}
              {(brand.typesense?.adsInQueue > 0 || brand.typesense?.adsFailed > 0) && (
                <div className="space-y-1">
                  <span className="font-medium text-gray-600">Typesense:</span>
                  {brand.typesense?.adsInQueue > 0 && (
                    <div className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-center break-words">
                      {brand.typesense.adsInQueue} in queue
                    </div>
                  )}
                  {brand.typesense?.adsFailed > 0 && (
                    <div className="px-2 py-1 bg-red-100 text-red-800 rounded text-center break-words">
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
                    <div className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-center break-words">
                      {brand.fileUpload.mediaInQueue} queued
                    </div>
                  )}
                  {brand.fileUpload?.mediaFailed > 0 && (
                    <div className="px-2 py-1 bg-red-100 text-red-800 rounded text-center break-words">
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

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center py-6 gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold text-gray-900 break-words">Pipeline Status Dashboard</h1>
              <p className="mt-2 text-sm text-gray-600 break-words">
                Monitor the complete processing status for all brands
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto min-w-0">
              {/* FIXED: Date Picker with separate input value */}
              <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0 sm:hidden" />
                <div className="relative w-full sm:w-auto min-w-0">
                  <input
                    type="date"
                    value={dateInputValue}
                    onChange={handleDateInputChange}
                    className="px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto min-w-0"
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

              <RefreshControl
                isRefreshing={isRefreshing}
                refreshInterval={refreshInterval}
                onManualRefresh={handleRefresh}
                onIntervalChange={setIntervalValue}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-hidden">
        {/* Error Display */}
        {error && <ErrorDisplay error={error} className="mb-6" />}

        {/* Overall Stats Cards - Only show when not in search mode */}
        {!showSearchResults && overallStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {/* Scraping Stats */}
            <Card className="p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-600">Scraping</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total Brands:</span>
                  <span className="text-gray-700 font-semibold">{overallStats.scraping.totalBrands}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Completed:</span>
                  <span className="text-green-600 font-semibold">{overallStats.scraping.completed}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Failed:</span>
                  <span className="text-red-600 font-semibold">{overallStats.scraping.failed}</span>
                </div>
              </div>
            </Card>

            {/* DB Stored Stats */}
            <Card className="p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-600">DB Stored</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total Brands:</span>
                  <span className="text-gray-700 font-semibold">{overallStats.dbStored.totalBrands}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total Ads:</span>
                  <span className="text-blue-600 font-semibold">{overallStats.dbStored.totalDbStoredAds}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Completed:</span>
                  <span className="text-green-600 font-semibold">{overallStats.dbStored.completed}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Failed:</span>
                  <span className="text-red-600 font-semibold">{overallStats.dbStored.failed}</span>
                </div>
              </div>
            </Card>

            {/* Typesense Stats */}
            <Card className="p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Search className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-gray-600">Typesense</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total Brands:</span>
                  <span className="text-gray-700 font-semibold">{overallStats.typesense.totalBrands}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Ads Processed:</span>
                  <span className="text-gray-700 font-semibold">{overallStats.typesense.totalAdsProcessed}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Ads Indexed:</span>
                  <span className="text-gray-700 font-semibold">{overallStats.typesense.totalAdsWithTypesense}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Completed:</span>
                  <span className="text-green-600 font-semibold">{overallStats.typesense.completed}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Failed:</span>
                  <span className="text-red-600 font-semibold">{overallStats.typesense.failed}</span>
                </div>
              </div>
            </Card>

            {/* File Upload Stats */}
            <Card className="p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-orange-600" />
                </div>
                <p className="text-sm font-medium text-gray-600">File Upload</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total Brands:</span>
                  <span className="text-gray-700 font-semibold">{overallStats.fileUpload.totalBrands}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total Files:</span>
                  <span className="text-gray-700 font-semibold">{overallStats.fileUpload.totalMediaItems}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Completed Brands:</span>
                  <span className="text-green-600 font-semibold">{overallStats.fileUpload.completedBrands}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Failed Brands:</span>
                  <span className="text-red-600 font-semibold">{overallStats.fileUpload.failedBrands}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Completed Files:</span>
                  <span className="text-green-600 font-semibold">{overallStats.fileUpload.completedMedia}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Failed Files:</span>
                  <span className="text-red-600 font-semibold">{overallStats.fileUpload.failedMedia}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Loading indicator for overall stats */}
        {!showSearchResults && overallStatsLoading && (
          <Card className="mb-6 p-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Loading overall stats...</span>
            </div>
          </Card>
        )}

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
        {isSearching ? (
          <div className="text-center py-12">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          </div>
        ) : displayBrands.length === 0 ? (
          <Card className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No brands found</h3>
            <p className="text-gray-500">
              {showSearchResults ? 'Try adjusting your search terms' : 'No brands available for the selected date'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {displayBrands.map((brand) => (
              <BrandCard key={brand.brandId} brand={brand} />
            ))}
          </div>
        )}

        {/* Pagination - Only show when not in search mode and not searching */}
        {!showSearchResults && !isSearching && data.pagination.pages > 1 && (
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
                currentPage={data.pagination.page || 1}
                totalPages={data.pagination.pages || 1}
                onPageChange={handlePageChange}
                totalItems={data.pagination.total || 0}
                itemsPerPage={data.pagination.perPage || data.pagination.limit || 10}
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
          {data.date && (
            <p className="mt-1">Showing data for: {formatDate(data.date)}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PipelineStatusPage;