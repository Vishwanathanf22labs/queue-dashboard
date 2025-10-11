import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import SearchInput from '../components/ui/SearchInput';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import RefreshControl from '../components/ui/RefreshControl';
import { useAdminLogin } from '../contexts/AdminLoginContext';
import { Eye, Clock, CheckCircle, XCircle, Search, ExternalLink, ChevronUp, ChevronDown, Shield } from 'lucide-react';
import useQueueStore from '../stores/queueStore';
import useAdminStore from '../stores/adminStore';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { watchlistBrandsColumns } from '../constants/data';
import toast from 'react-hot-toast';
import { queueAPI } from '../services/api';

const WatchlistBrands = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, isLoading: adminLoading } = useAdminStore();
  const { onAdminLogin } = useAdminLogin();

  const {
    watchlistBrands,
    watchlistPendingBrands,
    watchlistFailedBrands,
    loading,
    error,
    fetchWatchlistBrands,
    fetchWatchlistPendingBrands,
    fetchWatchlistFailedBrands,
    moveWatchlistFailedToPending,
    moveWatchlistToPending,
    moveIndividualWatchlistFailedToPending
  } = useQueueStore();

  const searchTerm = searchParams.get('search') || '';
  const currentPage = parseInt(searchParams.get('page')) || 1;
  const itemsPerPage = parseInt(searchParams.get('limit')) || 20;
  const statusSortMode = searchParams.get('statusSort') || 'failed';

  const [state, setState] = useState({
    filteredBrands: [],
    allWatchlistBrands: [],
    activeWatchlistCount: 0,
    loadingActiveCount: false
  });

  const { filteredBrands, allWatchlistBrands, activeWatchlistCount, loadingActiveCount } = state;

  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const refreshFn = useCallback(async () => {
    try {
      await Promise.all([
        fetchWatchlistBrands(1, 10000),
        fetchWatchlistPendingBrands(1, 10000),
        fetchWatchlistFailedBrands(1, 10000),
        fetchActiveWatchlistCount()
      ]);
      toast.success('Watchlist brands refreshed successfully');
    } catch (error) {
      console.error('WatchlistBrands refresh failed:', error);
    }
  }, [fetchWatchlistBrands, fetchWatchlistPendingBrands, fetchWatchlistFailedBrands]);

  const { refreshInterval, isRefreshing, setIntervalValue, manualRefresh } = useAutoRefresh(
    refreshFn,
    []
  );

  const handleStatusSortChange = () => {
    let nextMode;
    switch (statusSortMode) {
      case 'normal':
        nextMode = 'failed';
        break;
      case 'failed':
        nextMode = 'waiting';
        break;
      case 'waiting':
        nextMode = 'completed';
        break;
      case 'completed':
        nextMode = 'normal';
        break;
      default:
        nextMode = 'normal';
    }

    const newParams = new URLSearchParams(searchParams);
    newParams.set('statusSort', nextMode);
    setSearchParams(newParams);
  };

  const fetchActiveWatchlistCount = async () => {
    try {
      const response = await queueAPI.getBrandCounts();
      if (response.data.success) {
        updateState({ activeWatchlistCount: response.data.data.watchlist_active || 0 });
      }
    } catch (error) {
      console.error('Failed to fetch active watchlist count:', error);
      updateState({ activeWatchlistCount: 0 });
    }
  };

  const handleLoadActiveWatchlist = async () => {
    const scrollPosition = window.scrollY;

    try {
      const result = await queueAPI.addAllBrands('watchlist_active', 'watchlist');
      toast.success(result.message || 'Successfully loaded active watchlist brands to watchlist pending queue');

      await Promise.all([
        fetchWatchlistPendingBrands(1, 10000),
        fetchActiveWatchlistCount()
      ]);

      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
    } catch (error) {
      toast.error(error.message || 'Failed to load active watchlist brands to watchlist pending queue');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        updateState({ loadingActiveCount: true });
        await Promise.all([
          fetchWatchlistBrands(1, 10000),
          fetchWatchlistPendingBrands(1, 10000),
          fetchWatchlistFailedBrands(1, 10000),
          fetchActiveWatchlistCount()
        ]);
      } catch (error) {
        console.error('Failed to load watchlist brands data:', error);
      } finally {
        updateState({ loadingActiveCount: false });
      }
    };

    loadData();
  }, [fetchWatchlistBrands, fetchWatchlistPendingBrands, fetchWatchlistFailedBrands]);

  useEffect(() => {
    if (watchlistBrands && watchlistBrands.brands) {
      updateState({ allWatchlistBrands: watchlistBrands.brands });

      updateState({ filteredBrands: watchlistBrands.brands });
    }
  }, [watchlistBrands]);

  const sortBrandsStably = (brands) => {
    if (!watchlistPendingBrands || !watchlistFailedBrands || !watchlistBrands?.brands) {
      return brands;
    }

    return brands.sort((a, b) => {
      const getPriority = (status) => {
        switch (statusSortMode) {
          case 'failed':
            switch (status) {
              case 'failed': return 1;
              case 'waiting': return 2;
              case 'completed': return 3;
              case 'queues_empty': return 4;
              case 'inactive': return 5;
              default: return 6;
            }
          case 'waiting':
            switch (status) {
              case 'waiting': return 1;
              case 'completed': return 2;
              case 'failed': return 3;
              case 'queues_empty': return 4;
              case 'inactive': return 5;
              default: return 6;
            }
          case 'completed':
            switch (status) {
              case 'completed': return 1;
              case 'waiting': return 2;
              case 'failed': return 3;
              case 'queues_empty': return 4;
              case 'inactive': return 5;
              default: return 6;
            }
          case 'normal':
          default:
            switch (status) {
              case 'failed': return 1;
              case 'waiting': return 2;
              case 'completed': return 3;
              case 'queues_empty': return 4;
              case 'inactive': return 5;
              default: return 6;
            }
        }
      };

      const statusA = determineScraperStatus(a);
      const statusB = determineScraperStatus(b);

      const priorityA = getPriority(statusA);
      const priorityB = getPriority(statusB);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      const pageIdA = parseInt(a.page_id) || 0;
      const pageIdB = parseInt(b.page_id) || 0;
      return pageIdA - pageIdB;
    });
  };

  useEffect(() => {
    const allBrands = allWatchlistBrands || [];

    if (searchTerm.trim() === '') {
      const sortedBrands = sortBrandsStably(allBrands);
      updateState({ filteredBrands: sortedBrands });
    } else {
      const normalizedSearchTerm = searchTerm.toLowerCase().replace(/\s+/g, '');

      const filtered = allBrands.filter(brand => {
        const brandName = brand.brand_name?.toLowerCase() || '';
        const normalizedBrandName = brandName.replace(/\s+/g, '');

        return (
          brandName.includes(searchTerm.toLowerCase()) ||
          normalizedBrandName.includes(normalizedSearchTerm) ||
          brand.page_id?.toString().includes(searchTerm) ||
          brand.brand_id?.toString().includes(searchTerm)
        );
      });

      const sortedFiltered = sortBrandsStably(filtered);
      updateState({ filteredBrands: sortedFiltered });
    }
  }, [searchTerm, allWatchlistBrands, statusSortMode]);

  const getScraperStatusInfo = (status) => {
    switch (status) {
      case 'completed':
        return { variant: 'success', icon: CheckCircle, label: 'Completed' };
      case 'waiting':
        return { variant: 'warning', icon: Clock, label: 'Waiting' };
      case 'failed':
        return { variant: 'error', icon: XCircle, label: 'Failed' };
      case 'queues_empty':
        return { variant: 'secondary', icon: Eye, label: 'Queues Empty' };
      case 'inactive':
        return { variant: 'secondary', icon: XCircle, label: 'Inactive' };
      default:
        return { variant: 'secondary', icon: Clock, label: 'Unknown' };
    }
  };

  const determineScraperStatus = (brand) => {
    const isInPending = watchlistPendingBrands?.brands?.some(
      pendingBrand => pendingBrand.page_id === brand.page_id
    );

    const isInFailed = watchlistFailedBrands?.brands?.some(
      failedBrand => failedBrand.page_id === brand.page_id
    );

    if (isInPending) {
      return 'waiting';
    }

    if (isInFailed) {
      return 'failed';
    }

    if (brand.status === 'Inactive') {
      return 'inactive';
    }

    if (brand.scraper_status === 'completed' &&
      (!watchlistPendingBrands?.brands || watchlistPendingBrands.brands.length === 0) &&
      (!watchlistFailedBrands?.brands || watchlistFailedBrands.brands.length === 0)) {
      return 'queues_empty';
    } else {
      return 'completed';
    }
  };

  const totalItems = filteredBrands.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBrands = filteredBrands.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
  };

  const handleSearchChange = (value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value.trim() === '') {
      newParams.delete('search');
    } else {
      newParams.set('search', value);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleMoveIndividualBrand = async (brand) => {
    const scrollPosition = window.scrollY;

    try {
      const brandIdentifier = brand.brand_id || brand.page_id;

      if (!brandIdentifier) {
        toast.error('Brand identifier not found');
        return;
      }

      await moveIndividualWatchlistFailedToPending(brandIdentifier);
      toast.success(`Brand "${brand.brand_name || 'Unknown'}" moved to watchlist pending queue successfully`);

      await Promise.all([
        fetchWatchlistPendingBrands(1, 10000),
        fetchWatchlistFailedBrands(1, 10000)
      ]);

      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
    } catch (error) {
      toast.error(error.message || 'Failed to move brand to watchlist pending queue');
    }
  };

  const tableColumns = watchlistBrandsColumns
    .map(column => {
      if (column.key === 'scraper_status') {
        return {
          ...column,
          sortable: true,
          render: (value, brand) => {
            const scraperStatus = determineScraperStatus(brand);
            const statusInfo = getScraperStatusInfo(scraperStatus);
            const StatusIcon = statusInfo.icon;

            return (
              <Badge variant={statusInfo.variant} className="flex items-center space-x-1">
                <StatusIcon className="h-3 w-3" />
                <span>{statusInfo.label}</span>
              </Badge>
            );
          }
        };
      } else if (column.key === 'actions') {
        return {
          ...column,
          render: (value, brand) => {
            const scraperStatus = determineScraperStatus(brand);

            if (scraperStatus === 'failed') {
              return (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!isAdmin}
                  onClick={() => {
                    if (!isAdmin) {
                      toast.error('Admin access required to move brands');
                      return;
                    }
                    handleMoveIndividualBrand(brand);
                  }}
                  className={`text-xs px-2 py-1 ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isAdmin ? 'Move to Watchlist Pending' : 'Admin Only'}
                </Button>
              );
            } else if (scraperStatus === 'completed') {
              return (
                <div className="text-xs text-gray-400 font-medium text-center">
                  —
                </div>
              );
            } else if (scraperStatus === 'waiting') {
              return (
                <div className="text-xs text-gray-400 font-medium text-center">
                  —
                </div>
              );
            }

            return (
              <div className="text-xs text-gray-400 font-medium text-center">
                —
              </div>
            );
          }
        };
      }
      return column;
    });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (adminLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <ErrorDisplay title="Error Loading Watchlist Brands" message={error}>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Watchlist Brands</h1>
          <p className="text-sm sm:text-base text-gray-600">Monitor all your watchlist brands and their scraping status</p>
        </div>

        <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-3">
          {!isAdmin ? (
            <button
              onClick={onAdminLogin}
              className="flex items-center justify-center space-x-2 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors cursor-pointer"
            >
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Admin Access Required</span>
            </button>
          ) : (
            <div className="flex items-center justify-center space-x-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Admin Mode</span>
            </div>
          )}

          <RefreshControl
            isRefreshing={isRefreshing}
            refreshInterval={refreshInterval}
            onManualRefresh={async () => {
              await manualRefresh();
            }}
            onIntervalChange={setIntervalValue}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
        <Card className="p-3 sm:p-4 md:p-6">
          <div className="text-center">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
              {allWatchlistBrands.filter(b => b.status === 'Active').length}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">Watchlist Active</div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 md:p-6">
          <div className="text-center">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-600">
              {allWatchlistBrands.filter(b => b.status === 'Inactive').length}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">Watchlist Inactive</div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 md:p-6">
          <div className="text-center">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">
              {allWatchlistBrands.length}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">Watchlist Total</div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 md:p-6">
          <div className="text-center">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
              {allWatchlistBrands.filter(b => determineScraperStatus(b) === 'completed').length}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">Completed</div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 md:p-6">
          <div className="text-center">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-600">
              {allWatchlistBrands.filter(b => determineScraperStatus(b) === 'waiting').length}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">Waiting</div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 md:p-6">
          <div className="text-center">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600">
              {allWatchlistBrands.filter(b => determineScraperStatus(b) === 'failed').length}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">Failed</div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Load Active Watchlist Brands</h4>
              <p className="text-sm text-gray-600">
                Add all active watchlist brands ({loadingActiveCount ? 'Loading...' : activeWatchlistCount}) to the watchlist pending queue with priority score 1
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              disabled={!isAdmin || loadingActiveCount || activeWatchlistCount === 0}
              onClick={handleLoadActiveWatchlist}
              className={`w-full sm:w-auto ${!isAdmin || loadingActiveCount || activeWatchlistCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="hidden sm:inline">
                {!isAdmin ? 'Admin Access Required' :
                  loadingActiveCount ? 'Loading...' :
                    activeWatchlistCount === 0 ? 'No Active Brands' :
                      'Load Active Watchlist to Pending'}
              </span>
              <span className="sm:hidden">
                {!isAdmin ? 'Admin Required' :
                  loadingActiveCount ? 'Loading...' :
                    activeWatchlistCount === 0 ? 'No Active' :
                      'Load Active Watchlist'}
              </span>
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Load All Watchlist to Watchlist Pending Queue</h4>
              <p className="text-sm text-gray-600">
                Add all watchlist brands to the watchlist pending queue with priority score 1
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              disabled={!isAdmin}

              onClick={async () => {
                if (!isAdmin) {
                  toast.error('Admin access required to load brands');
                  return;
                }

                const scrollPosition = window.scrollY;

                try {
                  const result = await moveWatchlistToPending();
                  toast.success(result.message || 'Successfully loaded watchlist brands to watchlist pending queue');

                  await fetchWatchlistPendingBrands(1, 10000);

                  requestAnimationFrame(() => {
                    window.scrollTo(0, scrollPosition);
                  });
                } catch (error) {
                  toast.error(error.message || 'Failed to load watchlist brands to watchlist pending queue');
                }
              }}
              className={`w-full sm:w-auto ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="hidden sm:inline">
                {isAdmin ? 'Load All Watchlist to Watchlist Pending' : 'Admin Access Required'}
              </span>
              <span className="sm:hidden">
                {isAdmin ? 'Load All to Watchlist Pending' : 'Admin Required'}
              </span>
            </Button>
          </div>
        </div>
      </Card>

      {filteredBrands && filteredBrands.filter(b => determineScraperStatus(b) === 'failed').length > 0 && (
        <Card>
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Failed Watchlist Brands</h4>
                <p className="text-sm text-gray-600">
                  {filteredBrands.filter(b => determineScraperStatus(b) === 'failed').length} brands are currently failed
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                disabled={!isAdmin}

                onClick={async () => {
                  if (!isAdmin) {
                    toast.error('Admin access required to move brands');
                    return;
                  }

                  const scrollPosition = window.scrollY;

                  try {
                    const result = await moveWatchlistFailedToPending();
                    toast.success(result.message || 'Successfully moved failed watchlist brands to watchlist pending queue');

                    await Promise.all([
                      fetchWatchlistPendingBrands(1, 10000),
                      fetchWatchlistFailedBrands(1, 10000)
                    ]);

                    requestAnimationFrame(() => {
                      window.scrollTo(0, scrollPosition);
                    });
                  } catch (error) {
                    toast.error(error.message || 'Failed to move watchlist failed brands to watchlist pending queue');
                  }
                }}
                className={`w-full sm:w-auto ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="hidden sm:inline">
                  {isAdmin ? 'Move All Watchlist Failed to Watchlist Pending' : 'Admin Access Required'}
                </span>
                <span className="sm:hidden">
                  {isAdmin ? 'Move All Failed to Watchlist Pending' : 'Admin Required'}
                </span>
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <SearchInput
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search watchlist brands by name, page ID, or brand ID..."
          leftIcon={<Search className="h-4 w-4 text-gray-400" />}
          size="md"
          variant="outline"
          showClearButton={true}
          debounceMs={300}
        />
      </Card>

      {currentBrands.length > 0 && (
        <Card className="md:hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Sort Status:</span>
            </div>
            <button
              onClick={handleStatusSortChange}
              className="flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors bg-blue-100 text-blue-700 border border-blue-200 w-full justify-center"
            >
              <div className="flex flex-col">
                <ChevronUp className={`h-3 w-3 ${statusSortMode === 'failed' ? 'text-blue-600' : 'text-gray-400'}`} />
                <ChevronDown className={`h-3 w-3 -mt-1 ${statusSortMode === 'waiting' ? 'text-blue-600' : statusSortMode === 'completed' ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
              <span>
                {statusSortMode === 'failed' ? 'Failed First (Default)' :
                  statusSortMode === 'waiting' ? 'Waiting First' :
                    statusSortMode === 'completed' ? 'Completed First' :
                      'Normal (Failed > Waiting > Completed)'}
              </span>
            </button>
          </div>
        </Card>
      )}

      <Card className="hidden md:block">
        <Table
          data={currentBrands}
          columns={tableColumns}
          emptyMessage={searchTerm ? 'No watchlist brands found matching your search.' : 'No watchlist brands found.'}
          className="min-w-full"
          onSortChange={(columnKey) => {
            if (columnKey === 'scraper_status') {
              handleStatusSortChange();
            }
          }}
        />
      </Card>

      <div className="md:hidden space-y-3">
        {currentBrands.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No watchlist brands found matching your search.' : 'No watchlist brands found.'}
            </div>
          </Card>
        ) : (
          currentBrands.map((brand, index) => (
            <Card key={brand.page_id || brand.brand_id} className="p-4 relative transition-all duration-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 text-lg">{brand.brand_name || 'Unknown'}</h3>
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const scraperStatus = determineScraperStatus(brand);
                      const statusInfo = getScraperStatusInfo(scraperStatus);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <Badge variant={statusInfo.variant} className="flex items-center space-x-1">
                          <StatusIcon className="h-3 w-3" />
                          <span>{statusInfo.label}</span>
                        </Badge>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Page ID:</span>
                    <span className="ml-2 font-medium text-gray-900">{brand.page_id || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Brand ID:</span>
                    <span className="ml-2 font-medium text-gray-900">{brand.brand_id || 'N/A'}</span>
                  </div>
                </div>

                {determineScraperStatus(brand) === 'failed' && (
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="md"
                      disabled={!isAdmin}
                      onClick={() => {
                        if (!isAdmin) {
                          toast.error('Admin access required to move brands');
                          return;
                        }
                        handleMoveIndividualBrand(brand);
                      }}
                      className={`w-full ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isAdmin ? 'Move to Watchlist Pending' : 'Admin Access Required'}
                    </Button>
                  </div>
                )}

                {brand?.page_id && (
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
              </div>
            </Card>
          ))
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
        showPageInfo={true}
        className="py-4"
      />

    </div>
  );
};

export default WatchlistBrands;