import { useEffect, useState, useRef } from 'react';
import LoadingState from '../components/ui/LoadingState';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
import ScrapedStats from '../components/queue/ScrapedStats';
import BrandProcessingQueue from '../components/queue/BrandProcessingQueue';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import DashboardStats from '../components/dashboard/DashboardStats';
import ProcessingStatus from '../components/dashboard/ProcessingStatus';
import QuickActions from '../components/dashboard/QuickActions';
import useQueueStore from '../stores/queueStore';
import { queueAPI } from '../services/api';

const Dashboard = () => {
  const {
    overview,
    nextBrand,
    loading,
    error,
    fetchOverview,
    fetchNextBrand,
    fetchBrandProcessingQueue,
    fetchScrapedStats
  } = useQueueStore();

  const currentlyProcessing = overview?.currently_processing;
  const pendingCount = overview?.queue_counts?.pending || 0;
  const failedCount = overview?.queue_counts?.failed || 0;
  const activeCount = overview?.queue_counts?.active || 0;
  const processedAdsToday = overview?.today_stats?.ads_processed || 0;

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
      if (response.data?.success) {
        updateState({ scraperStatus: response.data.data?.status || 'unknown' });
      }
    } catch (error) {
      console.error('Failed to fetch scraper status:', error);
      updateState({ scraperStatus: 'unknown' });
    } finally {
      updateState({ scraperStatusLoading: false });
    }
  };

  useEffect(() => {
    if (currentlyProcessing) {
      const brandId = currentlyProcessing.brand_id;

      if (!state.originalStartTime || state.originalStartTime.brandId !== brandId) {
        const timestamp = currentlyProcessing.started_at || currentlyProcessing.added_at;
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
  }, [currentlyProcessing?.brand_id, state.originalStartTime]);

  const loadData = async () => {
    try {
      updateRefreshState({ isRefreshing: true });
      const promises = [
        fetchOverview(),
        fetchNextBrand(),
        fetchBrandProcessingQueue(1, 10),
        fetchScrapedStats(null, 7),
        fetchScraperStatus()
      ];

      await Promise.all(promises);
      toast.success('Dashboard refreshed successfully');
    } catch (error) {
      toast.error(`Failed to refresh dashboard: ${error.message || error}`);
    } finally {
      updateRefreshState({ isRefreshing: false });
    }
  };

  const handleQueuePageChange = async (newPage) => {
    try {
      await fetchBrandProcessingQueue(newPage, 10);
    } catch (error) {
      toast.error(`Failed to load page ${newPage}: ${error.message || error}`);
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

  if (loading && !overview) {
    return <LoadingState size="lg" message="Loading dashboard..." />;
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
        processedAdsToday={processedAdsToday}
      />

      <ProcessingStatus
        currentlyProcessing={currentlyProcessing}
        nextBrand={nextBrand}
        scraperStatus={scraperStatus}
        scraperStatusLoading={scraperStatusLoading}
        formattedStartTime={formattedStartTime}
      />

      <QuickActions
        pendingCount={pendingCount}
        failedCount={failedCount}
      />

      <BrandProcessingQueue onPageChange={handleQueuePageChange} />

      <ScrapedStats />
    </div>
  );
};

export default Dashboard;