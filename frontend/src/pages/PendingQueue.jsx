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
import { Clock, Search, Users, Hash, Tag, RefreshCw, ExternalLink } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';

const PendingQueue = () => {
  const { fetchPendingBrands, loading } = useQueueStore();
  const currentSearchRef = useRef('');
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
    isSearching: false
  });

  const { searchTerm, currentPage, itemsPerPage, isRefreshing, brands, pagination, isSearching } = queueState;

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
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-xs sm:text-sm font-medium text-blue-600">
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
        const pageId = row.page_id || 'N/A';
        return (
          <div className="flex items-center">
            <Users className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
            <div className="flex items-center space-x-2 flex-1">
              <div className="text-xs font-medium text-gray-900 max-w-[80px] sm:max-w-none truncate">
                {value || 'Unknown Brand'}
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
      key: 'queue_id',
      label: 'Brand ID',
      render: (value, row) => (
        <div className="flex items-center">
          <Hash className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
          <span className="text-xs font-mono text-gray-900 max-w-[60px] sm:max-w-none truncate">
            {value || row.brand_id || 'N/A'}
          </span>
        </div>
      )
    },
    {
      key: 'page_id',
      label: 'Page ID',
      render: (value) => (
        <div className="flex items-center">
          <Tag className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
          <span className="text-xs font-mono text-gray-900 max-w-[70px] sm:max-w-none truncate">
            {value || 'N/A'}
          </span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: () => <Badge variant="info">Pending</Badge>,
      className: 'hidden sm:table-cell'
    }
  ];

  const loadPendingBrands = useCallback(async (searchTerm = null, pageOverride = null) => {
    try {
      if (searchTerm) {
        updateQueueState({ isSearching: true });
      }

      const pageToLoad = searchTerm ? 1 : (pageOverride || currentPage);
      const response = await fetchPendingBrands(pageToLoad, itemsPerPage, searchTerm);

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
      updateQueueState({ isSearching: false });
      toast.error(`Failed to load pending brands: ${error.message || error}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Single useEffect to handle all loading scenarios
  useEffect(() => {
    if (searchTerm && searchTerm.trim() !== '') {
      // Handle search with debouncing
      const timeoutId = setTimeout(() => {
        if (searchTerm.trim().length >= 3) {
          currentSearchRef.current = searchTerm;
          loadPendingBrands(searchTerm);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      // Load normal data when no search term, pass current page
      currentSearchRef.current = '';
      loadPendingBrands(null, currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, searchTerm]);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    updateQueueState({ isRefreshing: true });
    try {
      await loadPendingBrands();
      toast.success('Pending queue refreshed successfully');
    } catch (error) {
      toast.error(`Failed to refresh pending queue: ${error.message || error}`);
    } finally {
      updateQueueState({ isRefreshing: false });
    }
  };

  const handleSearch = (searchTerm) => {
    updateQueueState({ searchTerm });

    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    if (searchTerm && searchTerm.trim()) {
      newParams.set('search', searchTerm);
      newParams.set('page', '1'); // Reset to page 1 on search
    } else {
      newParams.delete('search');
      newParams.set('page', '1'); // Reset to page 1 when clearing search
    }
    setSearchParams(newParams);

    if (!searchTerm || searchTerm.trim() === '') {
      updateQueueState({ currentPage: 1 });
      // Don't call loadPendingBrands() here - let useEffect handle it
    }
  };

  const clearSearch = () => {
    currentSearchRef.current = '';
    updateQueueState({ searchTerm: '', currentPage: 1 });
    
    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.set('page', '1');
    setSearchParams(newParams);
    
    // Don't call loadPendingBrands() here - let useEffect handle it
  };

  const filteredBrands = brands;
  const totalPages = pagination.total_pages || 1;

  // Show loading state while initial data is loading
  if (loading && brands.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6 xl:space-y-8">
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Pending Queue</h1>
              <p className="text-xs sm:text-sm lg:text-base text-gray-600">
                {originalTotals.total_items || pagination.total_items || 0} brands waiting to be processed
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
            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-blue-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Pending</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-blue-600">
                {originalTotals.total_items || pagination.total_items || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-green-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Current Page</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-green-600">
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
              onChange={(value) => handleSearch(value)}
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
            <Clock className="h-8 w-8 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-gray-300 mx-auto mb-2 sm:mb-3 lg:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No pending brands found</h3>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500">
              {searchTerm ? 'Try adjusting your search terms' : 'All brands have been processed'}
            </p>
          </div>
        ) : (
          <Table
            data={filteredBrands}
            columns={columns}
            emptyMessage="No pending brands found"
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No pending brands found</h3>
              <p className="text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search terms' : 'All brands have been processed'}
              </p>
            </div>
          </Card>
        ) : (
          filteredBrands.map((brand, index) => {
            const position = (currentPage - 1) * itemsPerPage + index + 1;
            const brandName = brand.brand_name || 'Unknown Brand';
            const brandId = brand.queue_id || brand.brand_id || 'N/A';
            const pageId = brand.page_id || 'N/A';

            return (
              <Card key={`${brandId}-${index}`} className="p-4 relative pb-12">
                <div className="space-y-3">
                  {/* Header with Position and Brand Name */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {/* Position Circle */}
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {position}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 text-lg">{brandName}</h3>
                    </div>
                    <Badge variant="info">Pending</Badge>
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

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => {
          updateQueueState({ currentPage: page });
          
          // Update URL parameters
          const newParams = new URLSearchParams(searchParams);
          newParams.set('page', page.toString());
          setSearchParams(newParams);
        }}
        totalItems={pagination.total_items || 0}
        itemsPerPage={itemsPerPage}
        showPageInfo={true}
      />
    </div>
  );
};

export default PendingQueue;