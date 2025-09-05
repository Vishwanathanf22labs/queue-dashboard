import { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import SearchInput from '../components/ui/SearchInput';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import LoadingState from '../components/ui/LoadingState';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import { Eye, Clock, CheckCircle, XCircle, Search, ExternalLink } from 'lucide-react';
import useQueueStore from '../stores/queueStore';
import useAdminStore from '../stores/adminStore';
import { watchlistBrandsColumns } from '../constants/data';
import toast from 'react-hot-toast';

const WatchlistBrands = () => {
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
  const { isAdmin } = useAdminStore();

  const [state, setState] = useState({
    filteredBrands: [],
    searchTerm: '',
    currentPage: 1,
    itemsPerPage: 20
  });

  const { filteredBrands, searchTerm, currentPage, itemsPerPage } = state;

  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchWatchlistBrands(1, 10000);
        await Promise.all([
          fetchWatchlistPendingBrands(1, 10000),
          fetchWatchlistFailedBrands(1, 10000)
        ]);
      } catch (error) {
        console.error('Failed to load watchlist brands data:', error);
      }
    };

    loadData();
  }, [fetchWatchlistBrands, fetchWatchlistPendingBrands, fetchWatchlistFailedBrands]);

  useEffect(() => {
    if (watchlistBrands && watchlistBrands.brands) {
      updateState({ filteredBrands: watchlistBrands.brands });
    }
  }, [watchlistBrands]);



  useEffect(() => {
    if (searchTerm.trim() === '') {
      const sortedBrands = (watchlistBrands?.brands || []).sort((a, b) => {
        const getPriority = (status) => {
          switch (status) {
            case 'completed': return 1;
            case 'waiting': return 2;
            case 'failed': return 3;
            case 'queues_empty': return 4;
            default: return 5;
          }
        };

        const statusA = determineScraperStatus(a);
        const statusB = determineScraperStatus(b);

        return getPriority(statusA) - getPriority(statusB);
      });
      updateState({ filteredBrands: sortedBrands });
    } else {
      const filtered = (watchlistBrands?.brands || []).filter(brand =>
        brand.brand_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        brand.page_id?.toString().includes(searchTerm) ||
        brand.brand_id?.toString().includes(searchTerm)
      );

      // Sort filtered results by the same priority
      const sortedFiltered = filtered.sort((a, b) => {
        const getPriority = (status) => {
          switch (status) {
            case 'completed': return 1;
            case 'waiting': return 2;
            case 'failed': return 3;
            case 'queues_empty': return 4;
            default: return 5;
          }
        };

        const statusA = determineScraperStatus(a);
        const statusB = determineScraperStatus(b);

        return getPriority(statusA) - getPriority(statusB);
      });

      updateState({ filteredBrands: sortedFiltered });
    }
    updateState({ currentPage: 1 }); 
  }, [searchTerm, watchlistBrands]);

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
      default:
        return { variant: 'secondary', icon: Clock, label: 'Unknown' };
    }
  };

  const determineScraperStatus = (brand) => {
    // Check if brand is in watchlist_pending_brands_prod queue
    const isInPending = watchlistPendingBrands?.brands?.some(
      pendingBrand => pendingBrand.page_id === brand.page_id
    );
    
    // Check if brand is in watchlist_failed_brands_prod queue
    const isInFailed = watchlistFailedBrands?.brands?.some(
      failedBrand => failedBrand.page_id === brand.page_id
    );

    if (isInPending) {
      return 'waiting';
    } else if (isInFailed) {
      return 'failed';
    } else if (brand.scraper_status === 'completed' &&
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
    updateState({ currentPage: page });
  };

  // Handle individual brand movement from failed to pending
  const handleMoveIndividualBrand = async (brand) => {
    try {
      // Get the brand identifier (brand_id, page_id, or queue_id)
      const brandIdentifier = brand.brand_id || brand.page_id;

      if (!brandIdentifier) {
        toast.error('Brand identifier not found');
        return;
      }

      // Move the individual brand from failed to pending
      await moveIndividualWatchlistFailedToPending(brandIdentifier);
      toast.success(`Brand "${brand.brand_name || 'Unknown'}" moved to watchlist pending queue successfully`);

      // Refresh the data to show updated statuses
      await Promise.all([
        fetchWatchlistBrands(1, 10000),
        fetchWatchlistPendingBrands(1, 10000),
        fetchWatchlistFailedBrands(1, 10000)
      ]);
    } catch (error) {
      toast.error(error.message || 'Failed to move brand to watchlist pending queue');
    }
  };

  // Table columns definition with custom render functions
  const tableColumns = watchlistBrandsColumns
    .map(column => {
      if (column.key === 'scraper_status') {
        return {
          ...column,
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
              // Show action button for failed brands
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
              // Show dash for completed brands (no action needed)
              return (
                <div className="text-xs text-gray-400 font-medium text-center">
                  —
                </div>
              );
            } else if (scraperStatus === 'waiting') {
              // Show dash for waiting brands (no action needed)
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
    return <LoadingState size="lg" message="Loading watchlist brands..." />;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Watchlist Brands</h1>
          <p className="text-gray-600">Monitor your priority brands and their scraping status</p>
        </div>
        {/* Brand Count and Refresh Button - Desktop Only */}
        <div className="hidden md:flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Eye className="h-5 w-5 text-yellow-500" />
            <span className="text-lg font-semibold text-gray-700">
              {totalItems} brand{totalItems !== 1 ? 's' : ''}
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              // Refresh data
              fetchWatchlistBrands(1, 10000);
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Brand Count and Refresh Button - Mobile Only */}
      <div className="md:hidden flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Eye className="h-5 w-5 text-yellow-500" />
          <span className="text-lg font-semibold text-gray-700">
            {totalItems} brand{totalItems !== 1 ? 's' : ''}
          </span>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            // Refresh data
            fetchWatchlistBrands(1, 10000);
          }}
        >
          Refresh
        </Button>
      </div>

                         {/* Summary Stats Cards - Above Search */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card>
           <div className="text-center">
             <div className="text-2xl font-bold text-green-600">
               {filteredBrands ? filteredBrands.filter(b => determineScraperStatus(b) === 'completed').length : 0}
             </div>
             <div className="text-sm text-gray-600">Completed</div>
           </div>
         </Card>
         <Card>
           <div className="text-center">
             <div className="text-2xl font-bold text-yellow-600">
               {filteredBrands ? filteredBrands.filter(b => determineScraperStatus(b) === 'waiting').length : 0}
             </div>
             <div className="text-sm text-gray-600">Waiting</div>
           </div>
         </Card>
         <Card>
           <div className="text-center">
             <div className="text-2xl font-bold text-red-600">
               {filteredBrands ? filteredBrands.filter(b => determineScraperStatus(b) === 'failed').length : 0}
             </div>
             <div className="text-sm text-gray-600">Failed</div>
           </div>
         </Card>
       </div>

       {/* Load Watchlist to Pending Button */}
       <Card>
         <div className="p-4 sm:p-6">
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
             <div>
               <h4 className="text-lg font-semibold text-gray-900">Load Watchlist to Watchlist Pending Queue</h4>
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
                 try {
                   const result = await moveWatchlistToPending();
                   toast.success(result.message || 'Successfully loaded watchlist brands to watchlist pending queue');
                   // Refresh the data to show updated statuses
                   await fetchWatchlistBrands(1, 10000);
                   await Promise.all([
                     fetchWatchlistPendingBrands(1, 10000),
                     fetchWatchlistFailedBrands(1, 10000)
                   ]);
                 } catch (error) {
                   toast.error(error.message || 'Failed to load watchlist brands to watchlist pending queue');
                 }
               }}
               className={`w-full sm:w-auto ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
               <span className="hidden sm:inline">
                 {isAdmin ? 'Load Watchlist to Watchlist Pending' : 'Admin Access Required'}
               </span>
               <span className="sm:hidden">
                 {isAdmin ? 'Load to Watchlist Pending' : 'Admin Required'}
               </span>
             </Button>
           </div>
         </div>
       </Card>

      {/* Move Watchlist Failed to Pending Button */}
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
                  try {
                    const result = await moveWatchlistFailedToPending();
                    toast.success(result.message || 'Successfully moved failed watchlist brands to watchlist pending queue');
                    // Refresh the data to show updated statuses
                    await Promise.all([
                      fetchWatchlistBrands(1, 10000),
                      fetchWatchlistPendingBrands(1, 10000),
                      fetchWatchlistFailedBrands(1, 10000)
                    ]);
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

      {/* Search Bar */}
      <Card>
        <SearchInput
          value={searchTerm}
          onChange={(value) => updateState({ searchTerm: value })}
          placeholder="Search by brand name, page ID, or brand ID..."
          leftIcon={<Search className="h-4 w-4 text-gray-400" />}
          size="md"
          variant="outline"
          showClearButton={true}
          debounceMs={300}
        />
      </Card>

             {/* Brands Table - Desktop */}
       <Card className="hidden md:block">
         <Table
           data={currentBrands}
           columns={tableColumns}
           emptyMessage={searchTerm ? 'No brands found matching your search.' : 'No watchlist brands found.'}
           className="min-w-full"
         />
       </Card>

             {/* Mobile Cards View */}
       <div className="md:hidden space-y-3">
         {currentBrands.length === 0 ? (
           <Card>
             <div className="text-center py-8 text-gray-500">
               {searchTerm ? 'No brands found matching your search.' : 'No watchlist brands found.'}
             </div>
           </Card>
         ) : (
           currentBrands.map((brand, index) => (
            <Card key={`${brand.brand_id}-${index}`} className="p-4 relative">
              <div className="space-y-3">
                {/* Brand Name */}
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

                {/* Details Grid */}
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

                {/* Action Button - Only for Failed Brands */}
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

                {/* External Link Icon - Bottom Right */}
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

             {/* Pagination */}
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