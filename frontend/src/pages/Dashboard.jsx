import { useEffect, useState, useRef } from 'react';
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
import { queueAPI } from '../services/api';
import WatchlistProcessingStatus from '../components/dashboard/WatchlistProcessingStatus';
import WatchlistAdsCountTable from '../components/queue/WatchlistAdsCountTable';

const Dashboard = () => {
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
    fetchSeparateScrapedStats,
    brandProcessingQueue,
    watchlistBrandsQueue
  } = useQueueStore();

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
  const watchlistCompletedCount = overview?.watchlist_stats?.completed_count || 0;
  const watchlistBrands = overview?.watchlist_stats?.brands || [];

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
  const { scraperStatus, scraperStatusLoading } = state;

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
      const status = response.data?.status || 'unknown';
      updateState({ scraperStatus: status });
    } catch (error) {
      console.error('Failed to fetch scraper status:', error);
      updateState({ scraperStatus: 'unknown' });
    } finally {
      updateState({ scraperStatusLoading: false });
    }
  };

  // Override scraper status if there's a currently processing brand
  useEffect(() => {
    if (currentlyProcessing && !scraperStatusLoading) {
      // If there's a brand processing, force status to 'running'
      if (scraperStatus !== 'running') {
        updateState({ scraperStatus: 'running' });
      }
    }
  }, [currentlyProcessing, scraperStatus, scraperStatusLoading]);

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
      
      // Always fetch overview first to get queue counts
      const overviewData = await fetchOverview();
      
      const promises = [
        fetchBrandProcessingQueue(1, 10),
        fetchWatchlistBrandsQueue(1, 10),
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
      await fetchBrandProcessingQueue(newPage, 10, sortBy, sortOrder);
    } catch (error) {
      toast.error(`Failed to load page ${newPage}: ${error.message || error}`);
    }
  };

  const handleWatchlistPageChange = async (newPage, sortBy = 'normal', sortOrder = 'desc') => {
    try {
      await fetchWatchlistBrandsQueue(newPage, 10, sortBy, sortOrder);
    } catch (error) {
      toast.error(`Failed to load watchlist page ${newPage}: ${error.message || error}`);
    }
  };

  const handleQueueSortChange = async (sortBy, sortOrder) => {
    try {
      await fetchBrandProcessingQueue(1, 10, sortBy, sortOrder);
    } catch (error) {
      toast.error(`Failed to sort queue: ${error.message || error}`);
    }
  };

  const handleWatchlistSortChange = async (sortBy, sortOrder) => {
    try {
      await fetchWatchlistBrandsQueue(1, 10, sortBy, sortOrder);
    } catch (error) {
      toast.error(`Failed to sort watchlist queue: ${error.message || error}`);
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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    return () => {
      updateState({ originalStartTime: null });
    };
  }, []);

  // Show loading spinner while initial data is loading
  if (loading && !overview) {
    return <LoadingSpinner />;
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

      <WatchlistProcessingStatus
        currentlyProcessing={currentlyProcessing}
        watchlistPendingCount={watchlistPendingCount}
        nextWatchlistBrand={nextWatchlistBrand}
      />

      <ProcessingStatus
        currentlyProcessing={currentlyProcessing}
        nextBrand={nextBrand}
        scraperStatus={scraperStatus}
        scraperStatusLoading={scraperStatusLoading}
        formattedStartTime={formattedStartTime}
        pendingCount={pendingCount}
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
      />

      <BrandProcessingQueue 
        onPageChange={handleQueuePageChange}
        onSortChange={handleQueueSortChange}
      />

      <SeparateScrapedStats />
    </div>
  );
};

export default Dashboard;