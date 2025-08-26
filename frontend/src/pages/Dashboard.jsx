import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import LoadingState from '../components/ui/LoadingState';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import toast from 'react-hot-toast';
import ScrapedStats from '../components/queue/ScrapedStats';
import BrandProcessingQueue from '../components/queue/BrandProcessingQueue';
import CustomDropdown from '../components/ui/CustomDropdown';
import useQueueStore from '../stores/queueStore';
import { queueAPI } from '../services/api';
import {
  ArrowRight,
  Clock,
  AlertTriangle,
  Play,
  Eye,
  RefreshCw,
  Pause,
  Square,
  Globe
} from 'lucide-react';

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
  const today = new Date().toLocaleDateString();

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


  const getScraperStatusInfo = (status) => {
    switch (status) {
      case 'running':
        return { variant: 'success', icon: Play, label: 'Running' };
      case 'paused':
        return { variant: 'warning', icon: Pause, label: 'Paused' };
      case 'stopped':
        return { variant: 'error', icon: Square, label: 'Stopped' };
      default:
        return { variant: 'secondary', icon: Clock, label: 'Unknown' };
    }
  };

  const refreshIntervals = [
    { value: 0, label: 'Off' },
    { value: 5, label: '5s' },
    { value: 10, label: '10s' },
    { value: 15, label: '15s' },
    { value: 20, label: '20s' },
    { value: 30, label: '30s' },
    { value: 1800, label: '30min' }
  ];


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

      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="pr-4 sm:pr-8 lg:pr-16 xl:pr-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900">Madangles Queues</h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-600">Monitor your brand processing queue</p>
          </div>


          <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-3">



            <div className="relative flex items-center border border-gray-300 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow w-full sm:w-auto">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex items-center px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 border-r border-gray-300 rounded-l-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
                title="Click to refresh now"
              >
                <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden xs:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                <span className="xs:hidden">Refresh</span>
              </button>

              <CustomDropdown
                options={refreshIntervals}
                value={refreshInterval}
                onChange={changeRefreshInterval}
                placeholder="Off"
                className="[&>div>button]:border-0 [&>div>button]:rounded-none [&>div>button]:rounded-r-lg [&>div>button]:bg-transparent [&>div>button]:py-1.5 w-16 sm:w-20"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-yellow-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Pending Queue</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </div>
        </Card>


        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-red-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Failed Queue</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-red-600">{failedCount}</p>
            </div>
          </div>
        </Card>


        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
              <Play className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-green-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Active Brands</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-green-600">{activeCount}</p>
            </div>
          </div>
        </Card>


        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
              <Eye className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-blue-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Processed Ads</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-blue-600">{processedAdsToday}</p>
            </div>
          </div>
        </Card>
      </div>




      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

        <Card>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Currently Processing</h3>
          {currentlyProcessing ? (
            <div className="space-y-3">
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Play className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                      {currentlyProcessing.brand_name || 'Unknown Brand'}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      ID: {currentlyProcessing.brand_id} | Page: {currentlyProcessing.page_id}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Status: {currentlyProcessing.status || 'Unknown'}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Started at {formattedStartTime}
                    </p>
                    {currentlyProcessing.processing_duration > 0 && (
                      <p className="text-xs sm:text-sm text-gray-500">
                        Duration: {Math.round(currentlyProcessing.processing_duration / 1000)}s
                      </p>
                    )}
                    {currentlyProcessing.total_ads > 0 && (
                      <p className="text-xs sm:text-sm text-gray-500">
                        Total Ads: {currentlyProcessing.total_ads}
                      </p>
                    )}
                    {currentlyProcessing.proxy && (
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm text-gray-500">
                          IP: {currentlyProcessing.proxy.proxy?.host}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">
                          Port: {currentlyProcessing.proxy.proxy?.port}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">

                  <Badge 
                    variant={currentlyProcessing.status === 'complete' ? 'success' : 'info'} 
                    className="self-start sm:self-auto"
                  >
                    {currentlyProcessing.status === 'complete' ? 'Completed' : 'Active'}
                  </Badge>

                  {!scraperStatusLoading && (
                    (() => {
                      const statusInfo = getScraperStatusInfo(scraperStatus);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <Badge variant={statusInfo.variant} className="flex items-center space-x-1">
                          <StatusIcon className="h-3 w-3" />
                          <span>{statusInfo.label}</span>
                        </Badge>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <Play className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
              <p className="text-gray-500 text-sm sm:text-base">No brand currently processing</p>

              {!scraperStatusLoading && (
                <div className="mt-3">
                  {(() => {
                    const statusInfo = getScraperStatusInfo(scraperStatus);
                    const StatusIcon = statusInfo.icon;
                    return (
                      <Badge variant={statusInfo.variant} className="inline-flex items-center space-x-1">
                        <StatusIcon className="h-3 w-3" />
                        <span>{statusInfo.label}</span>
                      </Badge>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </Card>


        <Card>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Next in Line</h3>
          {nextBrand ? (
            <div className="space-y-3">
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                      {nextBrand.brand_name || 'Unknown Brand'}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      ID: {nextBrand.queue_id || 'N/A'} | Page: {nextBrand.page_id || 'N/A'}
                    </p>
                  </div>
                </div>
                <Badge variant="info" className="self-start sm:self-auto">Waiting</Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <Clock className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
              <p className="text-gray-500 text-sm sm:text-base">No brands in queue</p>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Link
            to="/pending-queue"
            className="flex items-center p-3 sm:p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 mr-2 sm:mr-3 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-blue-900 text-sm sm:text-base">View Pending Queue</p>
              <p className="text-xs sm:text-sm text-blue-600">{pendingCount} brands waiting</p>
            </div>
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 ml-auto flex-shrink-0" />
          </Link>

          <Link
            to="/failed-queue"
            className="flex items-center p-3 sm:p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 mr-2 sm:mr-3 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-red-900 text-sm sm:text-base">View Failed Queue</p>
              <p className="text-xs sm:text-sm text-red-600">{failedCount} brands failed</p>
            </div>
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 ml-auto flex-shrink-0" />
          </Link>

          <Link
            to="/proxies"
            className="flex items-center p-3 sm:p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 mr-2 sm:mr-3 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-green-900 text-sm sm:text-base">Manage Proxies</p>
              <p className="text-xs sm:text-sm text-green-600">Configure & monitor</p>
            </div>
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 ml-auto flex-shrink-0" />
          </Link>
        </div>
      </Card>

      <BrandProcessingQueue onPageChange={handleQueuePageChange} />

      <ScrapedStats />
    </div>
  );
};

export default Dashboard;