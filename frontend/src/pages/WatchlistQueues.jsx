import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { Clock, Search, Users, Hash, Tag, RefreshCw, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
import CustomDropdown from '../components/ui/CustomDropdown';

const WatchlistQueues = () => {
  const { fetchWatchlistPendingBrands, fetchWatchlistFailedBrands } = useQueueStore();
  const currentSearchRef = useRef('');
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Separate state for original totals (for static display)
  const [originalTotals, setOriginalTotals] = useState({
    total_items: 0,
    total_pages: 0
  });
  
  // Get active tab from URL only, default to 'pending'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'pending'); // 'pending' or 'failed'
  const [queueState, setQueueState] = useState({
    searchTerm: searchParams.get('search') || '',
    currentPage: parseInt(searchParams.get('page')) || 1,
    itemsPerPage: parseInt(searchParams.get('limit')) || 10,
    brands: [],
    pagination: {},
    isSearching: false
  });

  const { searchTerm, currentPage, itemsPerPage, brands, pagination, isSearching } = queueState;

  const updateQueueState = (updates) => {
    setQueueState(prev => ({ ...prev, ...updates }));
  };

  // Sync activeTab with URL changes
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams, activeTab]);

  const pendingColumns = [
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
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-xs sm:text-sm font-medium text-purple-600">
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
         const pageId = row.page_id || 'N/A';
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
      render: () => <Badge variant="info">Watchlist Pending</Badge>,
      className: 'hidden sm:table-cell'
    }
  ];

  const failedColumns = [
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
        const errorMessage = value || row.error_message || 'Unknown error';
        
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
        
        return (
          <div className="text-xs text-red-600 max-w-[100px] sm:max-w-[150px] truncate font-medium" title={errorMessage}>
            {importantPart}
          </div>
        );
      },
      className: 'hidden lg:table-cell'
    }
  ];

  const loadBrands = useCallback(async (searchTerm = null, pageOverride = null) => {
    try {
      if (searchTerm) {
        updateQueueState({ isSearching: true });
      }

      const pageToLoad = searchTerm ? 1 : (pageOverride || currentPage);
      
      // Only update results if they match the current search term
      const currentSearch = currentSearchRef.current;
      const searchToCheck = searchTerm || '';
      
      let response;
      if (activeTab === 'pending') {
        response = await fetchWatchlistPendingBrands(pageToLoad, itemsPerPage, searchTerm);
      } else {
        response = await fetchWatchlistFailedBrands(pageToLoad, itemsPerPage, searchTerm);
      }

      // If search terms don't match, ignore this response (it's stale)
      if (searchToCheck !== currentSearch) {
        updateQueueState({ isSearching: false });
        return; 
      }
      
      if (response && response.brands) {
         updateQueueState({
           brands: response.brands,
           pagination: response.pagination || {},
           currentPage: pageToLoad,
           isSearching: false
         });
       } else {
        updateQueueState({
          brands: [],
          pagination: {},
          currentPage: pageToLoad,
          isSearching: false
        });
      }

      // Store original totals only when not searching (for static display)
      if (!searchTerm) {
        const paginationData = response?.pagination || {};
        setOriginalTotals({
          total_items: paginationData.total_items || 0,
          total_pages: paginationData.total_pages || 0
        });
      }
    } catch (error) {
      console.error(`Error loading watchlist ${activeTab} brands:`, error);
      toast.error(`Failed to load watchlist ${activeTab} brands`);
      updateQueueState({
        isSearching: false
      });
    }
  }, [activeTab, itemsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

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
    newParams.set('tab', activeTab); // Preserve active tab
    setSearchParams(newParams);

    if (!searchTerm || searchTerm.trim() === '') {
      updateQueueState({ currentPage: 1 });
      // Don't call loadBrands() here - let useEffect handle it
    }
  };

  const clearSearch = () => {
    currentSearchRef.current = '';
    updateQueueState({ searchTerm: '', currentPage: 1 });
    
    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.set('page', '1');
    newParams.set('tab', activeTab); // Preserve active tab
    setSearchParams(newParams);
    
    // Don't call loadBrands() here - let useEffect handle it
  };

  const handlePageChange = (newPage) => {
    updateQueueState({ currentPage: newPage });
    
    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    newParams.set('tab', activeTab); // Preserve active tab
    setSearchParams(newParams);
  };

  const handleRefresh = async () => {
    updateQueueState({ currentPage: 1, searchTerm: '' });
    
    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.set('page', '1');
    newParams.set('tab', activeTab); // Preserve active tab
    setSearchParams(newParams);
    
    await loadBrands();
  };

  const handleItemsPerPageChange = async (newItemsPerPage) => {
    updateQueueState({ 
      itemsPerPage: newItemsPerPage, 
      currentPage: 1 
    });
    
    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.set('limit', newItemsPerPage.toString());
    newParams.set('page', '1');
    newParams.set('tab', activeTab); // Preserve active tab
    setSearchParams(newParams);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    updateQueueState({ currentPage: 1, searchTerm: '' });
    
    // Update URL parameters with new tab
    const newParams = new URLSearchParams();
    newParams.set('tab', tab);
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  // Single useEffect to handle all loading scenarios
  useEffect(() => {
    if (searchTerm && searchTerm.trim() !== '') {
      // Handle search with debouncing
      const timeoutId = setTimeout(() => {
        if (searchTerm.trim().length >= 3) {
          currentSearchRef.current = searchTerm;
          loadBrands(searchTerm);
        }
      }, 300); // Reduced from 500ms to 300ms for smoother experience

      return () => clearTimeout(timeoutId);
    } else {
      // Load normal data when no search term, pass current page
      currentSearchRef.current = '';
      loadBrands(null, currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, activeTab, searchTerm]);


  const currentColumns = activeTab === 'pending' ? pendingColumns : failedColumns;
  const tabIcon = activeTab === 'pending' ? Clock : XCircle;
  const tabColor = activeTab === 'pending' ? 'purple' : 'orange';
  const tabTitle = activeTab === 'pending' ? 'Watchlist Pending Queue' : 'Watchlist Failed Queue';
  const tabDescription = activeTab === 'pending' 
    ? 'Manage brands waiting in the watchlist pending queue' 
    : 'Manage brands that failed in the watchlist processing';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Watchlist Queues</h1>
          <p className="text-sm text-gray-600">Manage watchlist pending and failed brands</p>
        </div>
      </div>

      {/* Tabs */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            <button
              onClick={() => handleTabChange('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Pending Queue
            </button>
            <button
              onClick={() => handleTabChange('failed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'failed'
                  ? 'bg-orange-100 text-orange-700 border border-orange-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <XCircle className="h-4 w-4" />
              Failed Queue
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Items per page:</span>
            <CustomDropdown
              options={[
                { value: 10, label: '10' },
                { value: 25, label: '25' },
                { value: 50, label: '50' },
                { value: 100, label: '100' }
              ]}
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              placeholder="Select items per page"
              className="w-20"
            />
          </div>
        </div>
      </Card>

      {/* Active Tab Header */}
      <div className="flex items-center gap-3">
        <div className={`p-2 bg-${tabColor}-100 rounded-lg`}>
          {React.createElement(tabIcon, { className: `h-6 w-6 text-${tabColor}-600` })}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{tabTitle}</h2>
          <p className="text-sm text-gray-600">{tabDescription}</p>
        </div>
      </div>

      {/* Tab-specific Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`rounded-lg p-3 text-center ${activeTab === 'pending' ? 'bg-purple-100' : 'bg-red-100'}`}>
          <div className="flex items-center justify-center gap-2 mb-1">
            {activeTab === 'pending' ? (
              <Clock className="h-4 w-4 text-purple-700" />
            ) : (
              <XCircle className="h-4 w-4 text-red-700" />
            )}
            <span className="text-sm font-medium text-gray-700">
              Total {activeTab === 'pending' ? 'Pending' : 'Failed'} Brands
            </span>
          </div>
          <div className={`text-lg font-semibold ${activeTab === 'pending' ? 'text-purple-700' : 'text-red-700'}`}>
            {originalTotals.total_items || pagination?.total_items || 0}
          </div>
        </div>
        
        <div className="bg-gray-100 rounded-lg p-3 text-center">
          <div className="text-sm font-medium text-gray-700 mb-1">Current Page</div>
          <div className="text-lg font-semibold text-gray-900">{currentPage}</div>
        </div>
        
        <div className="bg-gray-100 rounded-lg p-3 text-center">
          <div className="text-sm font-medium text-gray-700 mb-1">Total Pages</div>
          <div className="text-lg font-semibold text-gray-900">{pagination?.total_pages || 0}</div>
        </div>
        
        <div className="bg-gray-100 rounded-lg p-3 text-center">
          <div className="text-sm font-medium text-gray-700 mb-1">Showing</div>
          <div className="text-lg font-semibold text-gray-900">
            {brands?.length || 0} of {pagination?.total_items || 0}
          </div>
        </div>
      </div>


      {/* Search */}
      <Card>
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:gap-4">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search by brand name, brand ID, or page ID..."
              leftIcon={<Search className="h-4 w-4 text-gray-400" />}
              size="md"
              variant="default"
              showClearButton={true}
              onClear={clearSearch}
              showStats={true}
              stats={{
                total: originalTotals.total_items || pagination?.total_items || 0,
                showing: brands?.length || 0
              }}
            />
          </div>
        </div>
      </Card>

             {/* Table - Desktop Only */}
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
         ) : brands && brands.length > 0 ? (
           <Table
             data={brands}
             columns={currentColumns}
             className="w-full"
           />
         ) : (
           <div className="text-center py-8">
             {activeTab === 'pending' ? (
               <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
             ) : (
               <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
             )}
             <h3 className="text-lg font-medium text-gray-900 mb-2">
               No Watchlist {activeTab === 'pending' ? 'Pending' : 'Failed'} Brands
             </h3>
             <p className="text-gray-600">
               {searchTerm ? 'Try adjusting your search terms' : `The watchlist ${activeTab === 'pending' ? 'pending' : 'failed'} queue is currently empty.`}
             </p>
           </div>
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
         ) : brands && brands.length > 0 ? (
           brands.map((brand, index) => {
             const position = (currentPage - 1) * itemsPerPage + index + 1;
             const brandName = brand.brand_name || brand.name || brand.brandName || 'Unknown Brand';
             const brandId = brand.brand_id || brand.id || brand.queue_id || brand.brandId || 'N/A';
             const pageId = brand.page_id || brand.pageId || 'N/A';
             const isPending = activeTab === 'pending';

             return (
               <Card key={`${brandId}-${index}`} className="p-4 relative pb-12">
                 <div className="space-y-3">
                   {/* Header with Position and Brand Name */}
                   <div className="flex items-center justify-between">
                     <div className="flex items-center space-x-3">
                       {/* Position Circle */}
                       <div className={`w-8 h-8 ${isPending ? 'bg-purple-100' : 'bg-red-100'} rounded-full flex items-center justify-center`}>
                         <span className={`text-sm font-medium ${isPending ? 'text-purple-600' : 'text-red-600'}`}>
                           {position}
                         </span>
                       </div>
                       <h3 className="font-semibold text-gray-900 text-lg">{brandName}</h3>
                     </div>
                     <div className="flex items-center space-x-2">
                       <Badge variant={isPending ? "info" : "error"}>
                         {isPending ? 'Watchlist Pending' : 'Failed'}
                       </Badge>
                     </div>
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

                   {/* Error Message - Only show for failed brands */}
                   {!isPending && (
                     <div className="pt-2">
                       <span className="text-gray-500 text-sm">Error:</span>
                       <p className="text-sm text-red-600 mt-1 break-words font-medium" title={brand.error_message || 'Unknown error'}>
                         {(() => {
                           const errorMessage = brand.error_message || 'Unknown error';
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
                   )}

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
         ) : (
           <Card>
             <div className="text-center py-8">
               {activeTab === 'pending' ? (
                 <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
               ) : (
                 <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
               )}
               <h3 className="text-lg font-medium text-gray-900 mb-2">
                 No Watchlist {activeTab === 'pending' ? 'Pending' : 'Failed'} Brands
               </h3>
               <p className="text-gray-600">
                 {searchTerm ? 'Try adjusting your search terms' : `The watchlist ${activeTab === 'pending' ? 'pending' : 'failed'} queue is currently empty.`}
               </p>
             </div>
           </Card>
         )}
       </div>

               {/* Pagination - Always visible when there are brands */}
        {brands && brands.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil((originalTotals.total_items || pagination?.total_items || brands.length) / itemsPerPage)}
            onPageChange={handlePageChange}
            totalItems={pagination?.total_items || brands.length}
            itemsPerPage={itemsPerPage}
            showPageInfo={true}
          />
        )}
    </div>
  );
};

export default WatchlistQueues;
