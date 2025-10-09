import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
import SeparateScrapedStats from '../components/queue/SeparateScrapedStats';
import BrandProcessingQueue from '../components/queue/BrandProcessingQueue';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import DashboardStats from '../components/dashboard/DashboardStats';
import ProcessingStatus from '../components/dashboard/ProcessingStatus';
import QuickActions from '../components/dashboard/QuickActions';
import useQueueStore from '../stores/queueStore';
import useEnvironmentStore from '../stores/environmentStore';
import { queueAPI } from '../services/api';
import WatchlistProcessingStatus from '../components/dashboard/WatchlistProcessingStatus';
import WatchlistAdsCountTable from '../components/queue/WatchlistAdsCountTable';
import RegularAdUpdateQueue from '../components/queue/RegularAdUpdateQueue';
import WatchlistAdUpdateQueue from '../components/queue/WatchlistAdUpdateQueue';
import RegularBrandProcessing from '../components/dashboard/RegularBrandProcessing';
import WatchlistBrandProcessing from '../components/dashboard/WatchlistBrandProcessing';
import RegularAdUpdateProcessing from '../components/dashboard/RegularAdUpdateProcessing';
import WatchlistAdUpdateProcessing from '../components/dashboard/WatchlistAdUpdateProcessing';

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialLoading, setInitialLoading] = useState(true); // New: Covers full initial load
  
  const {
    overview,
    nextBrand,
    nextWatchlistBrand,
    loading,
    error,
    separateScrapedStats,
    fetchOverview,
    fetchNextBrand,
    fetchNextWatchlistBrand,
    fetchBrandProcessingQueue,
    fetchWatchlistBrandsQueue,
    fetchWatchlistBrands,
    fetchWatchlistPendingBrands,
    fetchWatchlistFailedBrands,
    watchlistBrands,
    watchlistPendingBrands,
    watchlistFailedBrands,
    fetchAllRegularBrandProcessingJobs,
    fetchAllWatchlistBrandProcessingJobs,
    fetchSeparateScrapedStats,
    brandProcessingQueue,
    watchlistBrandsQueue,
    allRegularBrandProcessingJobs,
    allWatchlistBrandProcessingJobs,
    adUpdateQueue,
    watchlistAdUpdateQueue,
    allRegularAdUpdateJobs,
    allWatchlistAdUpdateJobs,
    fetchAdUpdateQueue,
    fetchWatchlistAdUpdateQueue,
    fetchAllRegularAdUpdateJobs,
    fetchAllWatchlistAdUpdateJobs
  } = useQueueStore();

  // Search states for 4 separate tables
  const [searchStates, setSearchStates] = useState({
    regularBrands: {
      searchTerm: searchParams.get('regularBrandsSearch') || '',
      isSearching: false
    },
    watchlistBrands: {
      searchTerm: searchParams.get('watchlistBrandsSearch') || '',
      isSearching: false
    },
    regularAdUpdate: {
      searchTerm: searchParams.get('regularAdSearch') || '',
      isSearching: false
    },
    watchlistAdUpdate: {
      searchTerm: searchParams.get('watchlistAdSearch') || '',
      isSearching: false
    }
  });

  // Refs for debouncing and stale request prevention
  const searchRefs = useRef({
    regularBrands: '',
    watchlistBrands: '',
    regularAdUpdate: '',
    watchlistAdUpdate: ''
  });
  const debounceTimers = useRef({
    regularBrands: null,
    watchlistBrands: null,
    regularAdUpdate: null,
    watchlistAdUpdate: null
  });

  const { currentEnvironment, isLoading: environmentLoading } = useEnvironmentStore();

  const currentlyProcessing = overview?.currently_processing;
  const pendingCount = overview?.queue_counts?.pending || 0;
  const failedCount = overview?.queue_counts?.failed || 0;
  const activeCount = overview?.queue_counts?.active || 0;
  // Get today's stats from separateScrapedStats
  const today = new Date().toISOString().split('T')[0];
  
  // Get today's stats for both regular and watchlist
  const todayRegularStats = separateScrapedStats?.regular?.find(stat => stat.date === today);
  const todayWatchlistStats = separateScrapedStats?.watchlist?.find(stat => stat.date === today);
  
  // Fallback to most recent day if today's data is not available
  const fallbackRegularStats = separateScrapedStats?.regular?.[0];
  const fallbackWatchlistStats = separateScrapedStats?.watchlist?.[0];
  
  const regularStatsToUse = todayRegularStats || fallbackRegularStats;
  const watchlistStatsToUse = todayWatchlistStats || fallbackWatchlistStats;
  
  // Combine regular and watchlist stats for total counts
  const brandsScrapedToday = (regularStatsToUse?.brands_scraped || 0) + (watchlistStatsToUse?.brands_scraped || 0);
  const adsProcessed = (regularStatsToUse?.ads_processed || 0) + (watchlistStatsToUse?.ads_processed || 0);
  const watchlistBrandsScraped = watchlistStatsToUse?.brands_scraped || 0;
  
  const watchlistPendingCount = overview?.watchlist_stats?.pending_count || 0;
  const watchlistFailedCount = overview?.watchlist_stats?.failed_count || 0;
  
  // Calculate completed count using the same logic as Watchlist Status page
  const determineScraperStatus = (brand) => {
    // Check if brand is in watchlist_pending_brands_prod queue
    const isInPending = watchlistPendingBrands?.brands?.some(
      pendingBrand => pendingBrand.page_id === brand.page_id
    );
    
    // Check if brand is in watchlist_failed_brands_prod queue
    const isInFailed = watchlistFailedBrands?.brands?.some(
      failedBrand => failedBrand.page_id === brand.page_id
    );

    // If brand is in pending queue, show as waiting regardless of active/inactive status
    if (isInPending) {
      return 'waiting';
    }
    
    // If brand is in failed queue, show as failed regardless of active/inactive status
    if (isInFailed) {
      return 'failed';
    }

    // If brand is inactive and not in any queue, show as inactive
    if (brand.status === 'Inactive') {
      return 'inactive';
    }

    // For active brands not in queues
    if (brand.scraper_status === 'completed' &&
      (!watchlistPendingBrands?.brands || watchlistPendingBrands.brands.length === 0) &&
      (!watchlistFailedBrands?.brands || watchlistFailedBrands.brands.length === 0)) {
      return 'queues_empty';
    } else {
      return 'completed';
    }
  };


  const watchlistCompletedCount = overview?.watchlist_stats?.completed_count || 0;

  // Total ads counts are now provided by individual queue APIs

  const [state, setState] = useState({
    scraperStatus: 'unknown',
    scraperStatusLoading: false,
    refreshState: {
      interval: 0,
      isRefreshing: false,
      formattedStartTime: 'N/A'
    },
    originalStartTime: null
  });

  const refs = useRef({
    interval: null
  });

  const { interval: refreshInterval, isRefreshing, formattedStartTime } = state.refreshState;
  const { scraperStatus, scraperStatusLoading, scraperStatusData } = state;

  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const updateRefreshState = (updates) => {
    setState(prev => ({
      ...prev,
      refreshState: { ...prev.refreshState, ...updates }
    }));
  };

  const fetchScraperStatus = async () => {
    try {
      updateState({ scraperStatusLoading: true });
      const response = await queueAPI.getScraperStatus();
      const statusData = response.data;
      const status = statusData?.status || 'unknown';
      
      // Store the full status response including startTime and stopTime
      updateState({ 
        scraperStatus: status,
        scraperStatusData: statusData
      });
    } catch (error) {
      console.error('Failed to fetch scraper status:', error);
      updateState({ 
        scraperStatus: 'unknown',
        scraperStatusData: null
      });
    } finally {
      updateState({ scraperStatusLoading: false });
    }
  };

  // Note: Removed the override logic that was forcing status to 'running'
  // Now we show the actual API status from the scraper control service

  useEffect(() => {
    if (currentlyProcessing) {
      // Handle both single brand and array of brands
      const brands = Array.isArray(currentlyProcessing) ? currentlyProcessing : [currentlyProcessing];
      const firstBrand = brands[0];
      const brandId = firstBrand.brand_id;

      if (!state.originalStartTime || state.originalStartTime.brandId !== brandId) {
        const timestamp = firstBrand.started_at || firstBrand.added_at;
        if (timestamp) {
          const startTime = new Date(timestamp);
          updateState({
            originalStartTime: {
              brandId: brandId,
              timestamp: startTime
            }
          });

          updateRefreshState({ formattedStartTime: startTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) });
        } else {
          updateRefreshState({ formattedStartTime: 'N/A' });
          updateState({ originalStartTime: null });
        }
      } else {
        updateRefreshState({
          formattedStartTime: state.originalStartTime.timestamp.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        });
      }
    } else {
      updateState({ originalStartTime: null });
      updateRefreshState({ formattedStartTime: 'N/A' });
    }
  }, [currentlyProcessing, state.originalStartTime]);

  const loadData = async () => {
    try {
      updateRefreshState({ isRefreshing: true });
      
      // Invalidate cache first to ensure fresh data
      try {
        await queueAPI.invalidateQueueCache();
      } catch (cacheError) {
        console.warn('Cache invalidation failed:', cacheError);
        // Continue with data loading even if cache invalidation fails
      }

      // Clear any cached data in the store to ensure fresh data
      useQueueStore.getState().clearAllData();
      
      // Always fetch overview first to get queue counts
      const overviewData = await fetchOverview();
      
      // Get sorting, pagination, AND search state from URL params
      const regularBrandsPage = parseInt(searchParams.get('regularPage')) || 1;
      const regularBrandsSortBy = searchParams.get('regularSortBy') || 'normal';
      const regularBrandsSortOrder = searchParams.get('regularSortOrder') || 'desc';
      const regularBrandsSearch = searchParams.get('regularBrandsSearch') || null;
      
      const watchlistPage = parseInt(searchParams.get('watchlistPage')) || 1;
      const watchlistSortBy = searchParams.get('watchlistSortBy') || 'normal';
      const watchlistSortOrder = searchParams.get('watchlistSortOrder') || 'desc';
      const watchlistBrandsSearch = searchParams.get('watchlistBrandsSearch') || null;
      
      const regularAdUpdatePage = parseInt(searchParams.get('regularAdUpdatePage')) || 1;
      const regularAdUpdateSortBy = searchParams.get('regularAdUpdateSortBy') || 'normal';
      const regularAdUpdateSortOrder = searchParams.get('regularAdUpdateSortOrder') || 'desc';
      const regularAdSearch = searchParams.get('regularAdSearch') || null;
      
      const watchlistAdUpdatePage = parseInt(searchParams.get('watchlistAdUpdatePage')) || 1;
      const watchlistAdUpdateSortBy = searchParams.get('watchlistAdUpdateSortBy') || 'normal';
      const watchlistAdUpdateSortOrder = searchParams.get('watchlistAdUpdateSortOrder') || 'desc';
      const watchlistAdSearch = searchParams.get('watchlistAdSearch') || null;
      
      const promises = [
        fetchBrandProcessingQueue(regularBrandsPage, 10, regularBrandsSortBy, regularBrandsSortOrder, regularBrandsSearch),
        fetchWatchlistBrandsQueue(watchlistPage, 10, watchlistSortBy, watchlistSortOrder, watchlistBrandsSearch),
        fetchAllRegularBrandProcessingJobs(),
        fetchAllWatchlistBrandProcessingJobs(),
        fetchAdUpdateQueue(regularAdUpdatePage, 10, regularAdUpdateSortBy, regularAdUpdateSortOrder, regularAdSearch),
        fetchWatchlistAdUpdateQueue(watchlistAdUpdatePage, 10, watchlistAdUpdateSortBy, watchlistAdUpdateSortOrder, watchlistAdSearch),
        fetchAllRegularAdUpdateJobs(),
        fetchAllWatchlistAdUpdateJobs(),
        fetchSeparateScrapedStats(null, 7),
        fetchScraperStatus()
      ];



      // Only call next-brand if no pending brands but failed brands exist
      if (overviewData.queue_counts.pending === 0 && overviewData.queue_counts.failed > 0) {
        promises.push(fetchNextBrand());
      }

      // Only call next-watchlist-brand if no watchlist pending but watchlist failed exist
      if (overviewData.watchlist_stats.pending_count === 0 && overviewData.watchlist_stats.failed_count > 0) {
        promises.push(fetchNextWatchlistBrand());
      }

      await Promise.all(promises);
      toast.success('Dashboard refreshed successfully');
    } catch (error) {
      toast.error(`Failed to refresh dashboard: ${error.message || error}`);
    } finally {
      updateRefreshState({ isRefreshing: false });
    }
  };

  const handleQueuePageChange = async (newPage, sortBy = 'normal', sortOrder = 'desc') => {
    try {
      // Update URL params
      const newParams = new URLSearchParams(searchParams);
      newParams.set('regularPage', newPage.toString());
      newParams.set('regularSortBy', sortBy);
      newParams.set('regularSortOrder', sortOrder);
      setSearchParams(newParams);
      
      const searchTerm = searchStates.regularBrands.searchTerm;
      await fetchBrandProcessingQueue(newPage, 10, sortBy, sortOrder, searchTerm || null);
    } catch (error) {
      toast.error(`Failed to load page ${newPage}: ${error.message || error}`);
    }
  };

  // Search handlers for 4 tables
  const handleRegularBrandsSearch = (value) => {
    setSearchStates(prev => ({
      ...prev,
      regularBrands: { ...prev.regularBrands, searchTerm: value }
    }));

    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    if (value && value.trim()) {
      newParams.set('regularBrandsSearch', value);
      newParams.set('regularPage', '1');
    } else {
      newParams.delete('regularBrandsSearch');
      newParams.set('regularPage', '1');
    }
    setSearchParams(newParams, { replace: true });

    // Clear existing timer
    if (debounceTimers.current.regularBrands) {
      clearTimeout(debounceTimers.current.regularBrands);
    }

    // Handle empty search immediately
    if (!value || value.trim() === '') {
      searchRefs.current.regularBrands = '';
      setSearchStates(prev => ({
        ...prev,
        regularBrands: { searchTerm: '', isSearching: false }
      }));
      const sortBy = searchParams.get('regularSortBy') || 'normal';
      const sortOrder = searchParams.get('regularSortOrder') || 'desc';
      fetchBrandProcessingQueue(1, 10, sortBy, sortOrder, null);
      return;
    }

    // Debounce search
    if (value.trim().length >= 3) {
      setSearchStates(prev => ({
        ...prev,
        regularBrands: { ...prev.regularBrands, isSearching: true }
      }));w

      debounceTimers.current.regularBrands = setTimeout(async () => {
        searchRefs.current.regularBrands = value;
        const sortBy = searchParams.get('regularSortBy') || 'normal';
        const sortOrder = searchParams.get('regularSortOrder') || 'desc';
        
        try {
          await fetchBrandProcessingQueue(1, 10, sortBy, sortOrder, value);
          
          if (searchRefs.current.regularBrands === value) {
            setSearchStates(prev => ({
              ...prev,
              regularBrands: { ...prev.regularBrands, isSearching: false }
            }));
          }
        } catch (error) {
          if (searchRefs.current.regularBrands === value) {
            setSearchStates(prev => ({
              ...prev,
              regularBrands: { ...prev.regularBrands, isSearching: false }
            }));
          }
        }
      }, 300);
    }
  };

  const handleWatchlistBrandsSearch = (value) => {
    setSearchStates(prev => ({
      ...prev,
      watchlistBrands: { ...prev.watchlistBrands, searchTerm: value }
    }));

    const newParams = new URLSearchParams(searchParams);
    if (value && value.trim()) {
      newParams.set('watchlistBrandsSearch', value);
      newParams.set('watchlistPage', '1');
    } else {
      newParams.delete('watchlistBrandsSearch');
      newParams.set('watchlistPage', '1');
    }
    setSearchParams(newParams, { replace: true });

    if (debounceTimers.current.watchlistBrands) {
      clearTimeout(debounceTimers.current.watchlistBrands);
    }

    if (!value || value.trim() === '') {
      searchRefs.current.watchlistBrands = '';
      setSearchStates(prev => ({
        ...prev,
        watchlistBrands: { searchTerm: '', isSearching: false }
      }));
      const sortBy = searchParams.get('watchlistSortBy') || 'normal';
      const sortOrder = searchParams.get('watchlistSortOrder') || 'desc';
      fetchWatchlistBrandsQueue(1, 10, sortBy, sortOrder, null);
      return;
    }

    if (value.trim().length >= 3) {
      setSearchStates(prev => ({
        ...prev,
        watchlistBrands: { ...prev.watchlistBrands, isSearching: true }
      }));

      debounceTimers.current.watchlistBrands = setTimeout(async () => {
        searchRefs.current.watchlistBrands = value;
        const sortBy = searchParams.get('watchlistSortBy') || 'normal';
        const sortOrder = searchParams.get('watchlistSortOrder') || 'desc';
        
        try {
          await fetchWatchlistBrandsQueue(1, 10, sortBy, sortOrder, value);
          
          if (searchRefs.current.watchlistBrands === value) {
            setSearchStates(prev => ({
              ...prev,
              watchlistBrands: { ...prev.watchlistBrands, isSearching: false }
            }));
          }
        } catch (error) {
          if (searchRefs.current.watchlistBrands === value) {
            setSearchStates(prev => ({
              ...prev,
              watchlistBrands: { ...prev.watchlistBrands, isSearching: false }
            }));
          }
        }
      }, 300);
    }
  };

  const handleRegularAdUpdateSearch = (value) => {
    setSearchStates(prev => ({
      ...prev,
      regularAdUpdate: { ...prev.regularAdUpdate, searchTerm: value }
    }));

    const newParams = new URLSearchParams(searchParams);
    if (value && value.trim()) {
      newParams.set('regularAdSearch', value);
      newParams.set('regularAdUpdatePage', '1');
    } else {
      newParams.delete('regularAdSearch');
      newParams.set('regularAdUpdatePage', '1');
    }
    setSearchParams(newParams, { replace: true });

    if (debounceTimers.current.regularAdUpdate) {
      clearTimeout(debounceTimers.current.regularAdUpdate);
    }

    if (!value || value.trim() === '') {
      searchRefs.current.regularAdUpdate = '';
      setSearchStates(prev => ({
        ...prev,
        regularAdUpdate: { searchTerm: '', isSearching: false }
      }));
      const sortBy = searchParams.get('regularAdUpdateSortBy') || 'normal';
      const sortOrder = searchParams.get('regularAdUpdateSortOrder') || 'desc';
      fetchAdUpdateQueue(1, 10, sortBy, sortOrder, null);
      return;
    }

    if (value.trim().length >= 3) {
      setSearchStates(prev => ({
        ...prev,
        regularAdUpdate: { ...prev.regularAdUpdate, isSearching: true }
      }));

      debounceTimers.current.regularAdUpdate = setTimeout(async () => {
        searchRefs.current.regularAdUpdate = value;
        const sortBy = searchParams.get('regularAdUpdateSortBy') || 'normal';
        const sortOrder = searchParams.get('regularAdUpdateSortOrder') || 'desc';
        
        try {
          await fetchAdUpdateQueue(1, 10, sortBy, sortOrder, value);
          
          if (searchRefs.current.regularAdUpdate === value) {
            setSearchStates(prev => ({
              ...prev,
              regularAdUpdate: { ...prev.regularAdUpdate, isSearching: false }
            }));
          }
        } catch (error) {
          if (searchRefs.current.regularAdUpdate === value) {
            setSearchStates(prev => ({
              ...prev,
              regularAdUpdate: { ...prev.regularAdUpdate, isSearching: false }
            }));
          }
        }
      }, 300);
    }
  };

  const handleWatchlistAdUpdateSearch = (value) => {
    setSearchStates(prev => ({
      ...prev,
      watchlistAdUpdate: { ...prev.watchlistAdUpdate, searchTerm: value }
    }));

    const newParams = new URLSearchParams(searchParams);
    if (value && value.trim()) {
      newParams.set('watchlistAdSearch', value);
      newParams.set('watchlistAdUpdatePage', '1');
    } else {
      newParams.delete('watchlistAdSearch');
      newParams.set('watchlistAdUpdatePage', '1');
    }
    setSearchParams(newParams, { replace: true });

    if (debounceTimers.current.watchlistAdUpdate) {
      clearTimeout(debounceTimers.current.watchlistAdUpdate);
    }

    if (!value || value.trim() === '') {
      searchRefs.current.watchlistAdUpdate = '';
      setSearchStates(prev => ({
        ...prev,
        watchlistAdUpdate: { searchTerm: '', isSearching: false }
      }));
      const sortBy = searchParams.get('watchlistAdUpdateSortBy') || 'normal';
      const sortOrder = searchParams.get('watchlistAdUpdateSortOrder') || 'desc';
      fetchWatchlistAdUpdateQueue(1, 10, sortBy, sortOrder, null);
      return;
    }

    if (value.trim().length >= 3) {
      setSearchStates(prev => ({
        ...prev,
        watchlistAdUpdate: { ...prev.watchlistAdUpdate, isSearching: true }
      }));

      debounceTimers.current.watchlistAdUpdate = setTimeout(async () => {
        searchRefs.current.watchlistAdUpdate = value;
        const sortBy = searchParams.get('watchlistAdUpdateSortBy') || 'normal';
        const sortOrder = searchParams.get('watchlistAdUpdateSortOrder') || 'desc';
        
        try {
          await fetchWatchlistAdUpdateQueue(1, 10, sortBy, sortOrder, value);
          
          if (searchRefs.current.watchlistAdUpdate === value) {
            setSearchStates(prev => ({
              ...prev,
              watchlistAdUpdate: { ...prev.watchlistAdUpdate, isSearching: false }
            }));
          }
        } catch (error) {
          if (searchRefs.current.watchlistAdUpdate === value) {
            setSearchStates(prev => ({
              ...prev,
              watchlistAdUpdate: { ...prev.watchlistAdUpdate, isSearching: false }
            }));
          }
        }
      }, 300);
    }
  };

  // Clear search handlers
  const clearRegularBrandsSearch = () => {
    searchRefs.current.regularBrands = '';
    setSearchStates(prev => ({
      ...prev,
      regularBrands: { searchTerm: '', isSearching: false }
    }));
    
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('regularBrandsSearch');
    newParams.set('regularPage', '1');
    setSearchParams(newParams, { replace: true });
    
    const sortBy = searchParams.get('regularSortBy') || 'normal';
    const sortOrder = searchParams.get('regularSortOrder') || 'desc';
    fetchBrandProcessingQueue(1, 10, sortBy, sortOrder, null);
  };

  const clearWatchlistBrandsSearch = () => {
    searchRefs.current.watchlistBrands = '';
    setSearchStates(prev => ({
      ...prev,
      watchlistBrands: { searchTerm: '', isSearching: false }
    }));
    
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('watchlistBrandsSearch');
    newParams.set('watchlistPage', '1');
    setSearchParams(newParams, { replace: true });
    
    const sortBy = searchParams.get('watchlistSortBy') || 'normal';
    const sortOrder = searchParams.get('watchlistSortOrder') || 'desc';
    fetchWatchlistBrandsQueue(1, 10, sortBy, sortOrder, null);
  };

  const clearRegularAdUpdateSearch = () => {
    searchRefs.current.regularAdUpdate = '';
    setSearchStates(prev => ({
      ...prev,
      regularAdUpdate: { searchTerm: '', isSearching: false }
    }));
    
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('regularAdSearch');
    newParams.set('regularAdUpdatePage', '1');
    setSearchParams(newParams, { replace: true });
    
    const sortBy = searchParams.get('regularAdUpdateSortBy') || 'normal';
    const sortOrder = searchParams.get('regularAdUpdateSortOrder') || 'desc';
    fetchAdUpdateQueue(1, 10, sortBy, sortOrder, null);
  };

  const clearWatchlistAdUpdateSearch = () => {
    searchRefs.current.watchlistAdUpdate = '';
    setSearchStates(prev => ({
      ...prev,
      watchlistAdUpdate: { searchTerm: '', isSearching: false }
    }));
    
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('watchlistAdSearch');
    newParams.set('watchlistAdUpdatePage', '1');
    setSearchParams(newParams, { replace: true });
    
    const sortBy = searchParams.get('watchlistAdUpdateSortBy') || 'normal';
    const sortOrder = searchParams.get('watchlistAdUpdateSortOrder') || 'desc';
    fetchWatchlistAdUpdateQueue(1, 10, sortBy, sortOrder, null);
  };

  const handleWatchlistPageChange = async (newPage, sortBy = 'normal', sortOrder = 'desc') => {
    try {
      // Update URL params
      const newParams = new URLSearchParams(searchParams);
      newParams.set('watchlistPage', newPage.toString());
      newParams.set('watchlistSortBy', sortBy);
      newParams.set('watchlistSortOrder', sortOrder);
      setSearchParams(newParams);
      
      const searchTerm = searchStates.watchlistBrands.searchTerm;
      await fetchWatchlistBrandsQueue(newPage, 10, sortBy, sortOrder, searchTerm || null);
    } catch (error) {
      toast.error(`Failed to load watchlist page ${newPage}: ${error.message || error}`);
    }
  };

  const handleQueueSortChange = async (sortBy, sortOrder) => {
    try {
      // Update URL params
      const newParams = new URLSearchParams(searchParams);
      newParams.set('regularPage', '1'); // Reset to page 1 when sorting
      newParams.set('regularSortBy', sortBy);
      newParams.set('regularSortOrder', sortOrder);
      setSearchParams(newParams);
      
      const searchTerm = searchStates.regularBrands.searchTerm;
      await fetchBrandProcessingQueue(1, 10, sortBy, sortOrder, searchTerm || null);
    } catch (error) {
      toast.error(`Failed to sort queue: ${error.message || error}`);
    }
  };

  const handleWatchlistSortChange = async (sortBy, sortOrder) => {
    try {
      // Update URL params
      const newParams = new URLSearchParams(searchParams);
      newParams.set('watchlistPage', '1'); // Reset to page 1 when sorting
      newParams.set('watchlistSortBy', sortBy);
      newParams.set('watchlistSortOrder', sortOrder);
      setSearchParams(newParams);
      
      const searchTerm = searchStates.watchlistBrands.searchTerm;
      await fetchWatchlistBrandsQueue(1, 10, sortBy, sortOrder, searchTerm || null);
    } catch (error) {
      toast.error(`Failed to sort watchlist queue: ${error.message || error}`);
    }
  };

  // Ad-update queue handlers
  const handleAdUpdatePageChange = async (newPage, sortBy = 'normal', sortOrder = 'desc') => {
    try {
      // Update URL params
      const newParams = new URLSearchParams(searchParams);
      newParams.set('regularAdUpdatePage', newPage.toString());
      newParams.set('regularAdUpdateSortBy', sortBy);
      newParams.set('regularAdUpdateSortOrder', sortOrder);
      setSearchParams(newParams);
      
      const searchTerm = searchStates.regularAdUpdate.searchTerm;
      await fetchAdUpdateQueue(newPage, 10, sortBy, sortOrder, searchTerm || null);
    } catch (error) {
      toast.error(`Failed to load ad-update page ${newPage}: ${error.message || error}`);
    }
  };

  const handleWatchlistAdUpdatePageChange = async (newPage, sortBy = 'normal', sortOrder = 'desc') => {
    try {
      // Update URL params
      const newParams = new URLSearchParams(searchParams);
      newParams.set('watchlistAdUpdatePage', newPage.toString());
      newParams.set('watchlistAdUpdateSortBy', sortBy);
      newParams.set('watchlistAdUpdateSortOrder', sortOrder);
      setSearchParams(newParams);
      
      const searchTerm = searchStates.watchlistAdUpdate.searchTerm;
      await fetchWatchlistAdUpdateQueue(newPage, 10, sortBy, sortOrder, searchTerm || null);
    } catch (error) {
      toast.error(`Failed to load watchlist ad-update page ${newPage}: ${error.message || error}`);
    }
  };

  const handleAdUpdateSortChange = async (sortBy, sortOrder) => {
    try {
      // Update URL params
      const newParams = new URLSearchParams(searchParams);
      newParams.set('regularAdUpdatePage', '1'); // Reset to page 1 when sorting
      newParams.set('regularAdUpdateSortBy', sortBy);
      newParams.set('regularAdUpdateSortOrder', sortOrder);
      setSearchParams(newParams);
      
      const searchTerm = searchStates.regularAdUpdate.searchTerm;
      await fetchAdUpdateQueue(1, 10, sortBy, sortOrder, searchTerm || null);
    } catch (error) {
      toast.error(`Failed to sort ad-update queue: ${error.message || error}`);
    }
  };

  const handleWatchlistAdUpdateSortChange = async (sortBy, sortOrder) => {
    try {
      // Update URL params
      const newParams = new URLSearchParams(searchParams);
      newParams.set('watchlistAdUpdatePage', '1'); // Reset to page 1 when sorting
      newParams.set('watchlistAdUpdateSortBy', sortBy);
      newParams.set('watchlistAdUpdateSortOrder', sortOrder);
      setSearchParams(newParams);
      
      const searchTerm = searchStates.watchlistAdUpdate.searchTerm;
      await fetchWatchlistAdUpdateQueue(1, 10, sortBy, sortOrder, searchTerm || null);
    } catch (error) {
      toast.error(`Failed to sort watchlist ad-update queue: ${error.message || error}`);
    }
  };

  const handleManualRefresh = () => {
    loadData();
  };

  const changeRefreshInterval = (interval) => {
    updateRefreshState({
      interval: interval
    });

    if (refs.current.interval) {
      clearInterval(refs.current.interval);
      refs.current.interval = null;
    }

    if (interval > 0) {
      startAutoRefresh(interval);
    }
  };

  const startAutoRefresh = (interval) => {
    if (refs.current.interval) {
      clearInterval(refs.current.interval);
      refs.current.interval = null;
    }

    if (interval > 0) {
      refs.current.interval = setInterval(() => {
        loadData();
      }, interval * 1000);
    }
  };

  const stopAutoRefresh = () => {
    if (refs.current.interval) {
      clearInterval(refs.current.interval);
      refs.current.interval = null;
    }
  };

  useEffect(() => {
    if (refreshInterval > 0) {
      startAutoRefresh(refreshInterval);
    }

    return () => {
      stopAutoRefresh();
    };
  }, [refreshInterval]);

  // Updated: Manage full initial load with initialLoading
  useEffect(() => {
    let mounted = true;
    
    // Initialize search refs from URL params on mount
    searchRefs.current.regularBrands = searchParams.get('regularBrandsSearch') || '';
    searchRefs.current.watchlistBrands = searchParams.get('watchlistBrandsSearch') || '';
    searchRefs.current.regularAdUpdate = searchParams.get('regularAdSearch') || '';
    searchRefs.current.watchlistAdUpdate = searchParams.get('watchlistAdSearch') || '';
    
    const timer = setTimeout(async () => {
      if (!mounted) return;
      // initialLoading is already true from useState; no need to set again
      try {
        await loadData();
      } finally {
        if (mounted) {
          setInitialLoading(false);
        }
      }
    }, 100);
    
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  // Reload data when environment changes
  useEffect(() => {
    if (!initialLoading && !environmentLoading) {
      // Add a small delay to ensure backend environment switch is complete
      const timeoutId = setTimeout(() => {
        loadData().then(() => {
          // Wait a moment for state to update
          setTimeout(() => {
          }, 100);
        });
      }, 500); // 500ms delay to ensure backend switch is complete

      return () => clearTimeout(timeoutId);
    }
  }, [currentEnvironment, environmentLoading]);

  useEffect(() => {
    return () => {
      updateState({ originalStartTime: null });
      // Cleanup debounce timers on unmount
      Object.values(debounceTimers.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // Updated: Use initialLoading for the full initial gate
  if (initialLoading) {
    return <LoadingSpinner />;
  }

  // Show loading overlay when environment is changing
  if (environmentLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-6">
            <LoadingSpinner size="lg" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Switching Environment</h2>
          <p className="text-lg text-gray-600 mb-4">Please wait while we load the new environment data</p>
          <div className="bg-gray-100 rounded-lg p-4">
            <p className="text-sm text-gray-500">
              This may take a few moments as we reconnect to the new environment's database and services.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay title="Error Loading Dashboard" message={error}>
        <Button
          variant="retry"
          size="md"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </ErrorDisplay>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6 overflow-x-hidden">
      <DashboardHeader
        refreshInterval={refreshInterval}
        isRefreshing={isRefreshing}
        onManualRefresh={handleManualRefresh}
        onIntervalChange={changeRefreshInterval}
        scraperStatus={scraperStatus}
        scraperStatusData={scraperStatusData}
      />

      <DashboardStats
        pendingCount={pendingCount}
        failedCount={failedCount}
        activeCount={activeCount}
        brandsScrapedToday={brandsScrapedToday}
        watchlistPendingCount={watchlistPendingCount}
        watchlistFailedCount={watchlistFailedCount}
        watchlistCompletedCount={watchlistCompletedCount}
        adsProcessed={adsProcessed}
      />

      {/* Always show both cards - only badge colors change based on status */}
      <WatchlistProcessingStatus
        currentlyProcessing={currentlyProcessing}
        watchlistPendingCount={watchlistPendingCount}
        watchlistFailedCount={watchlistFailedCount}
        nextWatchlistBrand={nextWatchlistBrand}
        scraperStatus={scraperStatus}
        scraperStatusLoading={scraperStatusLoading}
      />

      <ProcessingStatus
        currentlyProcessing={currentlyProcessing}
        nextBrand={nextBrand}
        scraperStatus={scraperStatus}
        scraperStatusLoading={scraperStatusLoading}
        formattedStartTime={formattedStartTime}
        pendingCount={pendingCount}
        failedCount={failedCount}
      />

        <RegularBrandProcessing
          allBrandProcessingData={allRegularBrandProcessingJobs}
          loading={loading}
          error={error}
        />

        <WatchlistBrandProcessing
          allBrandProcessingData={allWatchlistBrandProcessingJobs}
          loading={loading}
          error={error}
        />

        <RegularAdUpdateProcessing
          allAdUpdateData={allRegularAdUpdateJobs}
          loading={loading}
          error={error}
        />

        <WatchlistAdUpdateProcessing
          allAdUpdateData={allWatchlistAdUpdateJobs}
          loading={loading}
          error={error}
        />

      <QuickActions
        pendingCount={pendingCount}
        failedCount={failedCount}
        watchlistPendingCount={watchlistPendingCount}
        watchlistFailedCount={watchlistFailedCount}
      />

      <WatchlistAdsCountTable 
        watchlistBrandsQueue={watchlistBrandsQueue}
        loading={loading}
        error={error}
        onPageChange={handleWatchlistPageChange}
        onSortChange={handleWatchlistSortChange}
        onSearch={handleWatchlistBrandsSearch}
        searchTerm={searchStates.watchlistBrands.searchTerm}
        onClearSearch={clearWatchlistBrandsSearch}
        isSearching={searchStates.watchlistBrands.isSearching}
      />

      <BrandProcessingQueue 
        brandProcessingQueue={brandProcessingQueue}
        loading={loading}
        error={error}
        onPageChange={handleQueuePageChange}
        onSortChange={handleQueueSortChange}
        onSearch={handleRegularBrandsSearch}
        searchTerm={searchStates.regularBrands.searchTerm}
        onClearSearch={clearRegularBrandsSearch}
        isSearching={searchStates.regularBrands.isSearching}
      />

      <WatchlistAdUpdateQueue 
        watchlistAdUpdateQueue={watchlistAdUpdateQueue}
        loading={loading}
        error={error}
        onPageChange={handleWatchlistAdUpdatePageChange}
        onSortChange={handleWatchlistAdUpdateSortChange}
        onSearch={handleWatchlistAdUpdateSearch}
        searchTerm={searchStates.watchlistAdUpdate.searchTerm}
        onClearSearch={clearWatchlistAdUpdateSearch}
        isSearching={searchStates.watchlistAdUpdate.isSearching}
      />

      <RegularAdUpdateQueue 
        adUpdateQueue={adUpdateQueue}
        loading={loading}
        error={error}
        onPageChange={handleAdUpdatePageChange}
        onSortChange={handleAdUpdateSortChange}
        onSearch={handleRegularAdUpdateSearch}
        searchTerm={searchStates.regularAdUpdate.searchTerm}
        onClearSearch={clearRegularAdUpdateSearch}
        isSearching={searchStates.regularAdUpdate.isSearching}
      />

      <SeparateScrapedStats />
    </div>
  );
};

export default Dashboard;