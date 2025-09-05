import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import LoadingState from '../components/ui/LoadingState';
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
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'failed'
  const [queueState, setQueueState] = useState({
    searchTerm: '',
    currentPage: 1,
    itemsPerPage: 10,
    isRefreshing: false,
    brands: [],
    pagination: {},
    isSearching: false
  });

  const { searchTerm, currentPage, itemsPerPage, isRefreshing, brands, pagination, isSearching } = queueState;

  const updateQueueState = (updates) => {
    setQueueState(prev => ({ ...prev, ...updates }));
  };

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
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-xs sm:text-sm font-medium text-orange-600">
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
      render: () => <Badge variant="error">Watchlist Failed</Badge>,
      className: 'hidden sm:table-cell'
    }
  ];

  const loadBrands = async (searchTerm = null) => {
    try {
      if (searchTerm) {
        updateQueueState({ isSearching: true });
      } else {
        updateQueueState({ isRefreshing: true });
      }

      let response;
      if (activeTab === 'pending') {
        response = await fetchWatchlistPendingBrands(currentPage, itemsPerPage, searchTerm);
      } else {
        response = await fetchWatchlistFailedBrands(currentPage, itemsPerPage, searchTerm);
      }
      
      if (response && response.brands) {
         updateQueueState({
           brands: response.brands,
           pagination: response.pagination || {},
           isSearching: false,
           isRefreshing: false
         });
       } else {
        updateQueueState({
          brands: [],
          pagination: {},
          isSearching: false,
          isRefreshing: false
        });
      }
    } catch (error) {
      console.error(`Error loading watchlist ${activeTab} brands:`, error);
      toast.error(`Failed to load watchlist ${activeTab} brands`);
      updateQueueState({
        isSearching: false,
        isRefreshing: false
      });
    }
  };

  const handleSearch = (searchTerm) => {
    updateQueueState({ searchTerm, currentPage: 1 });
    
    if (!searchTerm || searchTerm.trim() === '') {
      loadBrands();
    } else {
      loadBrands(searchTerm);
    }
  };

  const clearSearch = () => {
    updateQueueState({ searchTerm: '', currentPage: 1 });
    loadBrands();
  };

  const handlePageChange = async (newPage) => {
    updateQueueState({ currentPage: newPage });
    await loadBrands(searchTerm);
  };

  const handleRefresh = async () => {
    updateQueueState({ currentPage: 1, searchTerm: '' });
    await loadBrands();
  };

  const handleItemsPerPageChange = async (newItemsPerPage) => {
    updateQueueState({ 
      itemsPerPage: newItemsPerPage, 
      currentPage: 1 
    });
    await loadBrands(searchTerm);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    updateQueueState({ currentPage: 1, searchTerm: '' });
  };

  useEffect(() => {
    if (!searchTerm) {
      loadBrands();
    }
  }, [currentPage, itemsPerPage, activeTab]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm && searchTerm.trim() !== '') {
        loadBrands(searchTerm);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  if (isSearching) {
    return (
      <div className="space-y-4">
        <LoadingState size="lg" message={`Searching watchlist ${activeTab} brands...`} />
      </div>
    );
  }

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

             {/* Stats Card */}
       <Card>
         {/* Desktop Layout */}
         <div className="hidden md:flex items-center justify-between">
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               {activeTab === 'pending' ? (
                 <Clock className="h-5 w-5 text-purple-600" />
               ) : (
                 <AlertCircle className="h-5 w-5 text-orange-600" />
               )}
               <span className="text-sm font-medium text-gray-600">
                 Total {activeTab === 'pending' ? 'Pending' : 'Failed'} Brands:
               </span>
               <span className={`text-lg font-bold text-${tabColor}-600`}>
                 {pagination?.total_items || brands?.length || 0}
               </span>
             </div>
             <div className="flex items-center gap-2">
               <span className="text-sm font-medium text-gray-600">Current Page:</span>
               <span className="text-lg font-bold text-gray-900">{currentPage}</span>
             </div>
             <div className="flex items-center gap-2">
               <span className="text-sm font-medium text-gray-600">Total Pages:</span>
               <span className="text-lg font-bold text-gray-900">
                 {pagination?.total_pages || Math.ceil((pagination?.total_items || brands.length) / itemsPerPage)}
               </span>
             </div>
             <div className="flex items-center gap-2">
               <span className="text-sm font-medium text-gray-600">Showing:</span>
               <span className="text-sm font-medium text-gray-900">
                 {brands?.length || 0} of {pagination?.total_items || 0}
               </span>
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
         </div>

         {/* Mobile Layout */}
         <div className="md:hidden space-y-4">
           {/* Main Stats Row */}
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
               {activeTab === 'pending' ? (
                 <Clock className="h-5 w-5 text-purple-600" />
               ) : (
                 <AlertCircle className="h-5 w-5 text-orange-600" />
               )}
               <span className="text-sm font-medium text-gray-600">
                 Total {activeTab === 'pending' ? 'Pending' : 'Failed'} Brands:
               </span>
             </div>
             <span className={`text-lg font-bold text-${tabColor}-600`}>
               {pagination?.total_items || brands?.length || 0}
             </span>
           </div>

           {/* Page Info Row */}
           <div className="flex items-center justify-between">
             <span className="text-sm font-medium text-gray-600">Current Page:</span>
             <span className="text-lg font-bold text-gray-900">{currentPage}</span>
           </div>

           {/* Total Pages Row */}
           <div className="flex items-center justify-between">
             <span className="text-sm font-medium text-gray-600">Total Pages:</span>
             <span className="text-lg font-bold text-gray-900">
               {pagination?.total_pages || Math.ceil((pagination?.total_items || brands.length) / itemsPerPage)}
             </span>
           </div>

           {/* Showing Row */}
           <div className="flex items-center justify-between">
             <span className="text-sm font-medium text-gray-600">Showing:</span>
             <span className="text-sm font-medium text-gray-900">
               {brands?.length || 0} of {pagination?.total_items || 0}
             </span>
           </div>

           {/* Items per page Row */}
           <div className="flex items-center justify-between">
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
              disabled={isSearching}
              showStats={true}
              stats={{
                total: pagination?.total_items || 0,
                showing: brands?.length || 0
              }}
            />
          </div>
          {searchTerm && (
            <div className="flex items-center text-xs sm:text-sm text-blue-600">
              {isSearching ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                  Searching: "{searchTerm}"
                </span>
              ) : (
                `Searching: "${searchTerm}"`
              )}
            </div>
          )}
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
                       <div className={`w-8 h-8 ${isPending ? 'bg-purple-100' : 'bg-orange-100'} rounded-full flex items-center justify-center`}>
                         <span className={`text-sm font-medium ${isPending ? 'text-purple-600' : 'text-orange-600'}`}>
                           {position}
                         </span>
                       </div>
                       <h3 className="font-semibold text-gray-900 text-lg">{brandName}</h3>
                     </div>
                     <div className="flex items-center space-x-2">
                       <Badge variant={isPending ? "info" : "error"}>
                         {isPending ? 'Watchlist Pending' : 'Watchlist Failed'}
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
            totalPages={pagination?.total_pages || Math.ceil((pagination?.total_items || brands.length) / itemsPerPage)}
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
