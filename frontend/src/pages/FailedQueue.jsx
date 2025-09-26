import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import toast from 'react-hot-toast';
import useQueueStore from '../stores/queueStore';
import { AlertCircle, Search, Users, Hash, Tag, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';

const FailedQueue = () => {
  const { fetchFailedBrands, loading } = useQueueStore();
  const currentSearchRef = useRef('');
  const isInitialMountRef = useRef(true);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Separate state for original totals (for static display)
  const [originalTotals, setOriginalTotals] = useState({
    total_items: 0,
    total_pages: 0
  });
  
  const [queueState, setQueueState] = useState({
    searchTerm: searchParams.get('search') || '',
    currentPage: parseInt(searchParams.get('page')) || 1,
    itemsPerPage: parseInt(searchParams.get('limit')) || 10,
    isRefreshing: false,
    brands: [],
    pagination: {},
    isSearching: false,
    error: null
  });

  const { searchTerm, currentPage, itemsPerPage, isRefreshing, brands, pagination, isSearching, error } = queueState;

  const updateQueueState = (updates) => {
    setQueueState(prev => ({ ...prev, ...updates }));
  };

  const columns = [
    {
      key: 'position',
      label: 'Position',
      render: (value, row, rowIndex) => {
        const page = Number(currentPage) || 1;
        const itemsPerPageNum = Number(itemsPerPage) || 10;
        const rowIndexNum = Number(rowIndex) || 0;
        const position = (page - 1) * itemsPerPageNum + rowIndexNum + 1;

        return (
          <div className="flex items-center">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-xs sm:text-sm font-medium text-red-600">
                {position}
              </span>
            </div>
          </div>
        );
      },
      className: 'hidden sm:table-cell'
    },
    {
      key: 'brand_name',
      label: 'Brand Name',
      render: (value, row) => {
        const brandName = value || row.brand_name || row.name || row.brandName || 'Unknown Brand';
        const pageId = row.page_id || row.pageId || 'N/A';
        return (
          <div className="flex items-center">
            <Users className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
            <div className="flex items-center space-x-2 flex-1">
              <div className="text-xs font-medium text-gray-900 max-w-[80px] sm:max-w-none truncate">
                {brandName}
              </div>
              {pageId && pageId !== 'N/A' && (
                <button
                  onClick={() => {
                    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${pageId}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="View in Facebook Ad Library"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'brand_id',
      label: 'Brand ID',
      render: (value, row) => {
        const brandId = value || row.brand_id || row.id || row.queue_id || row.brandId || 'N/A';
        return (
          <div className="flex items-center">
            <Hash className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
            <span className="text-xs font-mono text-gray-900 max-w-[60px] sm:max-w-none truncate">
              {brandId}
            </span>
          </div>
        );
      }
    },
    {
      key: 'page_id',
      label: 'Page ID',
      render: (value, row) => {
        const pageId = value || row.page_id || row.pageId || row.page_id || 'N/A';
        return (
          <div className="flex items-center">
            <Tag className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
            <span className="text-xs font-mono text-gray-900 max-w-[70px] sm:max-w-none truncate">
              {pageId}
            </span>
          </div>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: () => <Badge variant="error">Failed</Badge>,
      className: 'hidden sm:table-cell'
    },
    {
      key: 'error_message',
      label: 'Error Message',
      render: (value, row) => {
        const errorMsg = value || row.error_message || row.error || row.message || 'Unknown error';
        // Extract the important part of the error message - get the last meaningful part
        let importantPart = errorMsg;
        
        // If it contains ':', get the part after the last colon
        if (errorMsg.includes(':')) {
          const parts = errorMsg.split(':');
          importantPart = parts[parts.length - 1].trim();
        }
        
        // Further shorten common error patterns
        if (importantPart.toLowerCase().includes('no matching script tag found')) {
          importantPart = 'No script tag';
        } else if (importantPart.toLowerCase().includes('session closed')) {
          importantPart = 'Session closed';
        } else if (importantPart.toLowerCase().includes('target closed')) {
          importantPart = 'Target closed';
        } else if (importantPart.toLowerCase().includes('protocol error')) {
          importantPart = 'Protocol error';
        } else if (importantPart.toLowerCase().includes('timeout')) {
          importantPart = 'Timeout';
        } else if (importantPart.toLowerCase().includes('network')) {
          importantPart = 'Network error';
        } else if (importantPart.toLowerCase().includes('connection')) {
          importantPart = 'Connection error';
        } else if (importantPart.toLowerCase().includes('failed to extract')) {
          importantPart = 'Extraction failed';
        }
        
        return (
          <div className="text-xs text-red-600 max-w-[100px] sm:max-w-[150px] truncate font-medium" title={errorMsg}>
            {importantPart}
          </div>
        );
      },
      className: 'hidden lg:table-cell'
    }
  ];

  const loadFailedBrands = useCallback(async (searchTerm = null, pageOverride = null) => {
    try {
      // Set loading states appropriately
      if (searchTerm) {
        updateQueueState({ isSearching: true, error: null });
      } else {
        updateQueueState({ error: null });
      }

      const pageToLoad = searchTerm ? 1 : (pageOverride || currentPage);
      const response = await fetchFailedBrands(pageToLoad, itemsPerPage, searchTerm);

      // Only update results if they match the current search term
      const currentSearch = currentSearchRef.current;
      const searchToCheck = searchTerm || '';
      
      // If search terms don't match, ignore this response (it's stale)
      if (searchToCheck !== currentSearch) {
        updateQueueState({ isSearching: false });
        return; 
      }

      let brands = [];
      let pagination = {};

      if (response.brands && response.pagination) {
        brands = response.brands;
        pagination = response.pagination;
      } else if (response.data) {
        brands = response.data.brands || response.data || [];
        pagination = response.data.pagination || {};
      } else {
        brands = response || [];
        pagination = {};
      }

      updateQueueState({
        brands,
        pagination,
        currentPage: pageToLoad,
        isSearching: false
      });

      // Store original totals only when not searching (for static display)
      if (!searchTerm) {
        setOriginalTotals({
          total_items: pagination.total_items || 0,
          total_pages: pagination.total_pages || 0
        });
      }
    } catch (error) {
      updateQueueState({
        isSearching: false,
        error: error.message || 'Failed to load failed brands'
      });
      toast.error(`Failed to load failed brands: ${error.message || error}`);
    }
  }, [fetchFailedBrands, itemsPerPage]);

  // Initial load effect - runs only once on mount
  useEffect(() => {
    // Load initial data based on URL parameters
    const initialSearch = searchParams.get('search') || '';
    const initialPage = parseInt(searchParams.get('page')) || 1;

    if (initialSearch && initialSearch.trim().length >= 3) {
      currentSearchRef.current = initialSearch;
      loadFailedBrands(initialSearch, initialPage);
    } else {
      currentSearchRef.current = '';
      loadFailedBrands(null, initialPage);
    }

    // Mark initial mount as complete
    setTimeout(() => {
      isInitialMountRef.current = false;
    }, 100);
  }, []); // Empty dependency array - only run once

  // Handle page changes (when not searching)
  useEffect(() => {
    // Skip initial mount and when searching
    if (isInitialMountRef.current || (searchTerm && searchTerm.trim().length >= 3)) {
      return;
    }

    loadFailedBrands(null, currentPage);
  }, [currentPage, loadFailedBrands]);

  // Handle search with debouncing
  useEffect(() => {
    // Skip initial mount to prevent duplicate calls
    if (isInitialMountRef.current) {
      return;
    }

    if (searchTerm && searchTerm.trim() !== '') {
      const timeoutId = setTimeout(() => {
        if (searchTerm.trim().length >= 3) {
          currentSearchRef.current = searchTerm;
          loadFailedBrands(searchTerm);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    } else if (searchTerm === '') {
      // Handle clearing search - load normal data
      currentSearchRef.current = '';
      loadFailedBrands(null, 1);
    }
  }, [searchTerm, loadFailedBrands]);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    updateQueueState({ isRefreshing: true });
    try {
      if (searchTerm && searchTerm.trim().length >= 3) {
        await loadFailedBrands(searchTerm);
      } else {
        await loadFailedBrands();
      }
      toast.success('Failed queue refreshed successfully');
    } catch (error) {
      toast.error(`Failed to refresh failed queue: ${error.message || error}`);
    } finally {
      updateQueueState({ isRefreshing: false });
    }
  };

  const handleSearch = (searchValue) => {
    // Update search term in state immediately (for input display)
    updateQueueState({ searchTerm: searchValue });

    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    if (searchValue && searchValue.trim()) {
      newParams.set('search', searchValue);
      newParams.set('page', '1'); // Reset to page 1 on search
    } else {
      newParams.delete('search');
      newParams.set('page', '1'); // Reset to page 1 when clearing search
    }
    setSearchParams(newParams, { replace: true });

    if (!searchValue || searchValue.trim() === '') {
      updateQueueState({ currentPage: 1 });
      // The useEffect will handle loading the data
    }
  };

  const clearSearch = () => {
    currentSearchRef.current = '';
    updateQueueState({ searchTerm: '', currentPage: 1 });

    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });

    // The useEffect will handle loading the data
  };

  const handlePageChange = (page) => {
    updateQueueState({ currentPage: page });

    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams, { replace: true });
  };

  const filteredBrands = brands;

  const totalPages = pagination.total_pages || 1;

  // Show loading state while initial data is loading
  if (loading && brands.length === 0 && !isSearching) {
    return <LoadingSpinner />;
  }

  // Show error state if there's an error
  if (error && !isSearching && brands.length === 0) {
    return <ErrorDisplay message={error} onRetry={() => loadFailedBrands()} />;
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6 xl:space-y-8">

      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">

            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Failed Queue</h1>
              <p className="text-xs sm:text-sm lg:text-base text-gray-600">
                {originalTotals.total_items || pagination.total_items || 0} brands that failed processing
              </p>
            </div>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            size="sm"
            className="flex items-center gap-2 w-full sm:w-auto justify-center text-xs sm:text-sm"
          >
            <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-3 sm:mb-4 lg:mb-6">
        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
              <XCircle className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-red-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Failed</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-red-600">
                {originalTotals.total_items || pagination.total_items || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-orange-100 rounded-lg">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-orange-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Current Page</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-orange-600">
                {currentPage} / {Math.ceil((originalTotals.total_items || pagination.total_items || 0) / itemsPerPage) || 1}
              </p>
            </div>
          </div>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
              <Hash className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-purple-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Showing</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-purple-600">
                {filteredBrands.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mb-3 sm:mb-4 lg:mb-6">
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:gap-4">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search brands by name, ID, or page ID..."
              leftIcon={<Search className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />}
              size="md"
              variant="default"
              showClearButton={true}
              onClear={clearSearch}
            />
          </div>
          <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600">
            <span>Total: {originalTotals.total_items || pagination.total_items || 0}</span>
            <span>Showing: {filteredBrands.length}</span>
          </div>
        </div>
      </Card>

      {/* Desktop Table View */}
      <Card className="hidden md:block">
        {isSearching ? (
          <div className="text-center py-12 sm:py-16">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Searching...</h3>
                <p className="text-sm text-gray-500">
                  Searching for "{searchTerm}" across all pages
                </p>
              </div>
            </div>
          </div>
        ) : filteredBrands.length === 0 ? (
          <div className="text-center py-6 sm:py-8 lg:py-12">
            <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-gray-300 mx-auto mb-2 sm:mb-3 lg:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No failed brands found</h3>
            <p className="text-sm text-gray-500">
              {searchTerm ? 'Try adjusting your search terms' : 'All brands processed successfully'}
            </p>
          </div>
        ) : (
          <Table
            data={filteredBrands}
            columns={columns}
            emptyMessage="No failed brands found"
            className="shadow-md rounded-lg"
          />
        )}
      </Card>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {isSearching ? (
          <Card>
            <div className="text-center py-8">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Searching...</h3>
                  <p className="text-sm text-gray-500">
                    Searching for "{searchTerm}" across all pages
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ) : filteredBrands.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No failed brands found</h3>
              <p className="text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search terms' : 'All brands processed successfully'}
              </p>
            </div>
          </Card>
        ) : (
          filteredBrands.map((brand, index) => {
            const position = (currentPage - 1) * itemsPerPage + index + 1;
            const brandName = brand.brand_name || brand.name || brand.brandName || 'Unknown Brand';
            const brandId = brand.brand_id || brand.id || brand.queue_id || brand.brandId || 'N/A';
            const pageId = brand.page_id || brand.pageId || 'N/A';
            const errorMessage = brand.error_message || brand.error || brand.message || 'Unknown error';

            return (
              <Card key={`${brandId}-${index}`} className="p-4 relative pb-12">
                <div className="space-y-3">
                  {/* Header with Position and Brand Name */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {/* Position Circle */}
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-red-600">
                          {position}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 text-lg">{brandName}</h3>
                    </div>
                    <Badge variant="error">Failed</Badge>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Brand ID:</span>
                      <span className="ml-2 font-medium text-gray-900 font-mono">{brandId}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Page ID:</span>
                      <span className="ml-2 font-medium text-gray-900 font-mono">{pageId}</span>
                    </div>
                  </div>

                   {/* Error Message */}
                   <div className="pt-2">
                     <span className="text-gray-500 text-sm">Error:</span>
                     <p className="text-sm text-red-600 mt-1 break-words font-medium" title={errorMessage}>
                       {(() => {
                         // Extract the important part of the error message - get the last meaningful part
                         let importantPart = errorMessage;
                         
                         // If it contains ':', get the part after the last colon
                         if (errorMessage.includes(':')) {
                           const parts = errorMessage.split(':');
                           importantPart = parts[parts.length - 1].trim();
                         }
                         
                         // Further shorten common error patterns
                         if (importantPart.toLowerCase().includes('no matching script tag found')) {
                           importantPart = 'No script tag';
                         } else if (importantPart.toLowerCase().includes('session closed')) {
                           importantPart = 'Session closed';
                         } else if (importantPart.toLowerCase().includes('target closed')) {
                           importantPart = 'Target closed';
                         } else if (importantPart.toLowerCase().includes('protocol error')) {
                           importantPart = 'Protocol error';
                         } else if (importantPart.toLowerCase().includes('timeout')) {
                           importantPart = 'Timeout';
                         } else if (importantPart.toLowerCase().includes('network')) {
                           importantPart = 'Network error';
                         } else if (importantPart.toLowerCase().includes('connection')) {
                           importantPart = 'Connection error';
                         } else if (importantPart.toLowerCase().includes('failed to extract')) {
                           importantPart = 'Extraction failed';
                         }
                         
                         return importantPart;
                       })()}
                     </p>
                   </div>

                  {/* External Link Icon - Bottom Right */}
                  {pageId && pageId !== 'N/A' && (
                    <button
                      onClick={() => {
                        const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${pageId}`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="absolute bottom-3 right-3 p-1.5 text-gray-400 hover:text-blue-600 transition-colors bg-white rounded-full shadow-sm border border-gray-200"
                      title="View in Facebook Ad Library"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={pagination.total_items || 0}
          itemsPerPage={itemsPerPage}
          showPageInfo={true}
        />
      )}
    </div>
  );
};

export default FailedQueue;