import { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import LoadingState from '../components/ui/LoadingState';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import SearchInput from '../components/ui/SearchInput';

import useQueueStore from '../stores/queueStore';
import useAdminStore from '../stores/adminStore';
import { queueAPI } from '../services/api';
import toast from 'react-hot-toast';
import { 
  ArrowRight,
  ArrowLeft,
  Trash2, 
  Users, 
  Hash, 
  Tag, 
  Search,
  RefreshCw,
  Shield,
  Move,
  AlertTriangle
} from 'lucide-react';

const QueueManagement = () => {
  const { isAdmin, isLoading: adminLoading, logout } = useAdminStore();
  const { 
    fetchPendingBrands, 
    fetchFailedBrands,
    pendingBrands: storePendingBrands,
    failedBrands: storeFailedBrands,
    loading: storeLoading,
    error: storeError
  } = useQueueStore();
  
  // State for pending queue
  const [pendingState, setPendingState] = useState({
    brands: [],
    loading: false,
    currentPage: 1,
    searchTerm: '',
    itemsPerPage: 10,
    totalCount: 0,
    error: null,
    isSearching: false
  });

  // State for failed queue
  const [failedState, setFailedState] = useState({
    brands: [],
    loading: false,
    currentPage: 1,
    searchTerm: '',
    itemsPerPage: 10,
    totalCount: 0,
    error: null,
    isSearching: false
  });

  // State for admin actions
  const [adminState, setAdminState] = useState({
    isProcessingAction: false
  });

  // Destructure for easier access
  const { 
    brands: pendingBrands, 
    loading: pendingLoading, 
    currentPage: pendingCurrentPage, 
    searchTerm: pendingSearchTerm, 
    itemsPerPage: pendingItemsPerPage, 
    totalCount: pendingTotalCount, 
    error: pendingError,
    isSearching: pendingIsSearching
  } = pendingState;

  const { 
    brands: failedBrands, 
    loading: failedLoading, 
    currentPage: failedCurrentPage, 
    searchTerm: failedSearchTerm, 
    itemsPerPage: failedItemsPerPage, 
    totalCount: failedTotalCount, 
    error: failedError,
    isSearching: failedIsSearching
  } = failedState;

  const { isProcessingAction } = adminState;

  // Helper functions to update grouped state
  const updatePendingState = (updates) => {
    setPendingState(prev => ({ ...prev, ...updates }));
  };

  const updateFailedState = (updates) => {
    setFailedState(prev => ({ ...prev, ...updates }));
  };

  const updateAdminState = (updates) => {
    setAdminState(prev => ({ ...prev, ...updates }));
  };

  // Load real data from your backend APIs
  const loadPendingBrands = async (searchTerm = null) => {
    updatePendingState({ loading: true, error: null });
    try {
      // If searching, set searching state
      if (searchTerm) {
        updatePendingState({ isSearching: true });
      }
      
      // If searching, always search from page 1 to get all results
      const pageToLoad = searchTerm ? 1 : pendingCurrentPage;
      const response = await queueAPI.getPendingBrands(pageToLoad, pendingItemsPerPage, searchTerm);
      updatePendingState({
        brands: response.data.data?.brands || [],
        totalCount: response.data.data?.pagination?.total_items || 0,
        currentPage: searchTerm ? 1 : pendingCurrentPage, // Reset to page 1 when searching
        isSearching: false
      });
    } catch (error) {
      updatePendingState({ error: error.message || 'Failed to load pending brands', isSearching: false });
      toast.error('Failed to load pending brands');
      console.error('Error loading pending brands:', error);
    } finally {
      updatePendingState({ loading: false });
    }
  };

  const loadFailedBrands = async (searchTerm = null) => {
    updateFailedState({ loading: true, error: null });
    try {
      // If searching, set searching state
      if (searchTerm) {
        updateFailedState({ isSearching: true });
      }
      
      // If searching, always search from page 1 to get all results
      const pageToLoad = searchTerm ? 1 : failedCurrentPage;
      const response = await queueAPI.getFailedBrands(pageToLoad, failedItemsPerPage, searchTerm);
      updateFailedState({
        brands: response.data.data?.brands || [],
        totalCount: response.data.data?.pagination?.total_items || 0,
        currentPage: searchTerm ? 1 : failedCurrentPage, // Reset to page 1 when searching
        isSearching: false
      });
    } catch (error) {
      updateFailedState({ error: error.message || 'Failed to load failed brands', isSearching: false });
      toast.error('Failed to load failed brands');
      console.error('Error loading failed brands:', error);
    } finally {
      updateFailedState({ loading: false });
    }
  };

  // Load data on component mount and when pages change
  useEffect(() => {
    loadPendingBrands();
  }, [pendingCurrentPage]);

  useEffect(() => {
    loadFailedBrands();
  }, [failedCurrentPage]);

  // Handle search with debouncing
  const handlePendingSearch = (searchTerm) => {
    updatePendingState({ searchTerm });
    
    // If search is cleared, reset to page 1 and load all brands
    if (!searchTerm || searchTerm.trim() === '') {
      updatePendingState({ currentPage: 1 });
      loadPendingBrands();
      return;
    }
    
    // Reset to page 1 when searching
    if (searchTerm !== pendingSearchTerm) {
      updatePendingState({ currentPage: 1 });
    }
    // Load brands with search term
    loadPendingBrands(searchTerm);
  };

  const handleFailedSearch = (searchTerm) => {
    updateFailedState({ searchTerm });
    
    // If search is cleared, reset to page 1 and load all brands
    if (!searchTerm || searchTerm.trim() === '') {
      updateFailedState({ currentPage: 1 });
      loadFailedBrands();
      return;
    }
    
    // Reset to page 1 when searching
    if (searchTerm !== failedSearchTerm) {
      updateFailedState({ currentPage: 1 });
    }
    // Load brands with search term
    loadFailedBrands(searchTerm);
  };

  // Clear search functions
  const clearPendingSearch = () => {
    updatePendingState({ searchTerm: '', currentPage: 1 });
    loadPendingBrands();
  };

  const clearFailedSearch = () => {
    updateFailedState({ searchTerm: '', currentPage: 1 });
    loadFailedBrands();
  };

  // Refresh all data
  const handleRefresh = async () => {
    await Promise.all([loadPendingBrands(), loadFailedBrands()]);
    toast.success('Queue data refreshed successfully');
  };

  // Queue Management Actions - available to all users (no admin restriction)
  const handleAdminAction = async (action) => {
    if (isProcessingAction) return;
    
    updateAdminState({ isProcessingAction: true });
    try {
      let response;
      
      switch (action) {
        case 'Clear All Queues':
          response = await queueAPI.clearAllQueues();
          break;
        case 'Clear Pending Queue':
          response = await queueAPI.clearPendingQueue();
          break;
        case 'Clear Failed Queue':
          response = await queueAPI.clearFailedQueue();
          break;
        case 'Move All Pending to Failed':
          response = await queueAPI.moveAllPendingToFailed();
          break;
        case 'Move All Failed to Pending':
          response = await queueAPI.moveAllFailedToPending();
          break;
        default:
          throw new Error('Unknown action');
        }
        
        toast.success(`${action} completed successfully`);
        
        // Refresh data after action
        await handleRefresh();
        
      } catch (error) {
        toast.error(`Failed to ${action.toLowerCase()}: ${error.response?.data?.message || error.message || error}`);
      } finally {
        updateAdminState({ isProcessingAction: false });
      }
    };

  // Handle individual brand actions - available to all users (no admin restriction)
  const handleMoveBrand = async (brand, targetQueue) => {
    if (isProcessingAction) return;
    
    updateAdminState({ isProcessingAction: true });
    try {
      let response;

      const brandIdentifier = brand.queue_id || brand.brand_id || brand.page_id;
      
      if (!brandIdentifier) {
        throw new Error('Brand identifier not found');
      }
      
      if (targetQueue === 'failed') {
        response = await queueAPI.movePendingToFailed(brandIdentifier);
      } else {
        response = await queueAPI.moveFailedToPending(brandIdentifier);
      }
      
      toast.success(`Brand ${brand.brand_name} moved to ${targetQueue} queue successfully`);
      
      // Refresh data after action
      await handleRefresh();
      
    } catch (error) {
      toast.error(`Failed to move brand: ${error.response?.data?.message || error.message || error}`);
    } finally {
      updateAdminState({ isProcessingAction: false });
    }
  };

  const handleRemoveBrand = async (brand, queueType) => {
    if (isProcessingAction) return;
    
    updateAdminState({ isProcessingAction: true });
    try {
      let response;
      
      // Use queue_id as the primary identifier, fallback to brand_id or page_id
      const brandIdentifier = brand.queue_id || brand.brand_id || brand.page_id;
      
      if (!brandIdentifier) {
        throw new Error('Brand identifier not found');
      }
      
      // Use the queueType parameter to determine which endpoint to call
      if (queueType === 'pending') {
        response = await queueAPI.removePendingBrand(brandIdentifier);
      } else if (queueType === 'failed') {
        response = await queueAPI.removeFailedBrand(brandIdentifier);
      } else {
        throw new Error('Invalid queue type');
      }
      
      toast.success(`Brand ${brand.brand_name} removed successfully`);
      
      // Refresh data after action
      await handleRefresh();
      
    } catch (error) {
      toast.error(`Failed to remove brand: ${error.response?.data?.message || error.message || error}`);
    } finally {
      updateAdminState({ isProcessingAction: false });
    }
  };

  // Filter brands based on search term - REMOVED: Now using server-side search
  // const filteredPendingBrands = pendingBrands.filter(brand =>
  //   brand.brand_name?.toLowerCase().includes(pendingSearchTerm.toLowerCase()) ||
  //   brand.queue_id?.toString().includes(pendingSearchTerm) ||
  //   brand.page_id?.toString().includes(pendingSearchTerm)
  // );

  // const filteredFailedBrands = failedBrands.filter(brand =>
  //   brand.brand_name?.toLowerCase().includes(failedSearchTerm.toLowerCase()) ||
  //   brand.queue_id?.toString().includes(failedSearchTerm) ||
  //   brand.page_id?.toString().includes(failedSearchTerm)
  // );

  // Use the brands directly since search is now server-side
  const filteredPendingBrands = pendingBrands;
  const filteredFailedBrands = failedBrands;

  const pendingTotalPages = Math.ceil(pendingTotalCount / pendingItemsPerPage);

  const failedTotalPages = Math.ceil(failedTotalCount / failedItemsPerPage);

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">

      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Queue Management</h1>
              <p className="text-xs sm:text-sm lg:text-base text-gray-600">Queue management controls for pending and failed brand queues</p>
            </div>
          </div>
          

          <div className="flex items-center space-x-3">
            {isAdmin ? (
              <div className="flex items-center space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-100 text-green-800 rounded-lg">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm font-medium">Admin Mode</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-600 rounded-lg">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm font-medium">Admin Access Required</span>
              </div>
            )}
            
            <Button
              onClick={handleRefresh}
              disabled={pendingLoading || failedLoading}
              size="sm"
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${(pendingLoading || failedLoading) ? 'animate-spin' : ''}`} />
              {pendingLoading || failedLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>


      {!adminLoading && !isAdmin && (
        <Card>
          <div className="p-4 sm:p-6 lg:p-8 text-center">
            <div className="flex flex-col items-center space-y-3 sm:space-y-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-pink-100 border border-pink-200 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900">Admin Access Required</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  This page requires administrator privileges. Please log in with<br className="hidden sm:block" />
                  your admin credentials to access queue management features.
                </p>
              </div> 
            </div>
          </div>
        </Card>
      )}

      {/* Admin Content - Only show when logged in */}
      {isAdmin && (
        <>
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              </div>
            </div>
          </div>

          {/* Queue Management Control Buttons */}
          <Card>
            <div className="p-3 sm:p-4 lg:p-6">
              <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Queue Management Controls</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
                <Button
                  variant="danger"
                  onClick={() => handleAdminAction('Clear All Queues')}
                  disabled={isProcessingAction}
                  className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Clear All Queues</span>
                  <span className="sm:hidden">Clear All</span>
                </Button>
                
                <Button
                  variant="warning"
                  onClick={() => handleAdminAction('Clear Pending Queue')}
                  disabled={isProcessingAction}
                  className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Clear Pending Queue</span>
                  <span className="sm:hidden">Clear Pending</span>
                </Button>
                
                <Button
                  variant="warning"
                  onClick={() => handleAdminAction('Clear Failed Queue')}
                  disabled={isProcessingAction}
                  className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Clear Failed Queue</span>
                  <span className="sm:hidden">Clear Failed</span>
                </Button>
                
                <Button
                  variant="info"
                  onClick={() => handleAdminAction('Move All Pending to Failed')}
                  disabled={isProcessingAction}
                  className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
                >
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden lg:inline">All Pending → Failed</span>
                  <span className="hidden sm:inline lg:hidden">Pending → Failed</span>
                  <span className="sm:hidden">P→F</span>
                </Button>
                
                <Button
                  variant="success"
                  onClick={() => handleAdminAction('Move All Failed to Pending')}
                  disabled={isProcessingAction}
                  className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
                >
                  <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden lg:inline">All Failed → Pending</span>
                  <span className="hidden sm:inline lg:hidden">Failed → Pending</span>
                  <span className="sm:hidden">F→P</span>
                </Button>
              </div>
            </div>
          </Card>



          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-3 sm:mb-4 lg:mb-6">
            <Card>
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-blue-600" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Pending</p>
                  <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-blue-600">
                    {pendingTotalCount}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-red-600" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Failed</p>
                  <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-red-600">
                    {failedTotalCount}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-gray-100 rounded-lg">
                  <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600" />
                </div>
                <div className="ml-2 sm:ml-3 lg:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Brands</p>
                  <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-600">
                    {pendingTotalCount + failedTotalCount}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Pending Queue Section */}
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Pending Queue</h2>
            
            {/* Search for Pending */}
            <Card className="mb-4 sm:mb-6">
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:gap-4">
                <div className="flex-1 max-w-md">
                  <SearchInput
                    value={pendingSearchTerm}
                    onChange={(value) => handlePendingSearch(value)}
                    placeholder="Search pending brands by name, ID, or page ID..."
                    leftIcon={<Search className="h-4 w-4 text-gray-400" />}
                    size="md"
                    variant="default"
                    showClearButton={true}
                    onClear={clearPendingSearch}
                    disabled={pendingLoading || pendingIsSearching}
                  />
                </div>
                <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600">
                  <span>Total: {pendingTotalCount}</span>
                  <span>Showing: {filteredPendingBrands.length}</span>
                  {pendingSearchTerm && (
                    <span className="text-blue-600">
                      {pendingIsSearching ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                          Searching: "{pendingSearchTerm}"
                        </span>
                      ) : (
                        `Searching: "${pendingSearchTerm}"`
                      )}
                    </span>
                  )}
                </div>
              </div>
            </Card>

            {/* Pending Table */}
            <Card>
              {pendingError ? (
                <ErrorDisplay title="Error Loading Pending Queue" message={pendingError}>
                  <Button onClick={loadPendingBrands}>Retry</Button>
                </ErrorDisplay>
              ) : pendingLoading && !pendingBrands.length ? (
                <LoadingState size="lg" message="Loading pending brands..." />
              ) : pendingIsSearching ? (
                <div className="text-center py-12 sm:py-16">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Searching...</h3>
                      <p className="text-sm text-gray-500">
                        Searching for "{pendingSearchTerm}" across all pages
                      </p>
                    </div>
                  </div>
                </div>
              ) : filteredPendingBrands.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <Users className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No pending brands found</h3>
                  <p className="text-sm sm:text-base text-gray-500">
                    {pendingSearchTerm ? 'Try adjusting your search terms' : 'All brands have been processed'}
                  </p>
                </div>
              ) : (
                <Table
                  data={filteredPendingBrands}
                  columns={[
                    {
                      key: 'position',
                      label: 'Position',
                      render: (value, row, rowIndex) => {
                        const page = Number(pendingCurrentPage) || 1;
                        const itemsPerPageNum = Number(pendingItemsPerPage) || 10;
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
                      render: (value, row) => (
                        <div className="flex items-center">
                          <Users className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
                          <div className="text-xs font-medium text-gray-900 max-w-[80px] sm:max-w-none truncate">
                            {value || 'Unknown Brand'}
                          </div>
                        </div>
                      )
                    },
                    {
                      key: 'queue_id',
                      label: 'Brand ID',
                      className: 'hidden md:table-cell',
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
                      key: 'actions',
                      label: 'Actions',
                      render: (value, row) => (
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <Button
                            size="sm"
                            variant="warning"
                            onClick={() => handleMoveBrand(row, 'failed')}
                            disabled={isProcessingAction}
                            className="text-xs px-1 sm:px-2 py-1"
                            title="Move to Failed Queue"
                          >
                            <Move className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleRemoveBrand(row, 'pending')}
                            disabled={isProcessingAction}
                            className="text-xs px-1 sm:px-2 py-1"
                            title="Remove Brand"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ),
                    }
                  ]}
                  emptyMessage="No pending brands found"
                />
              )}
            </Card>

            {/* Pending Pagination */}
            <Pagination
              currentPage={pendingCurrentPage}
              totalPages={pendingTotalPages}
                              onPageChange={(page) => updatePendingState({ currentPage: page })}
              totalItems={pendingTotalCount}
              itemsPerPage={pendingItemsPerPage}
              showPageInfo={true}
            />
          </div>

          {/* Failed Queue Section */}
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Failed Queue</h2>
            
            {/* Search for Failed */}
            <Card className="mb-4 sm:mb-6">
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:gap-4">
                <div className="flex-1 max-w-md">
                  <SearchInput
                    value={failedSearchTerm}
                    onChange={(value) => handleFailedSearch(value)}
                    placeholder="Search failed brands by name, ID, or page ID..."
                    leftIcon={<Search className="h-4 w-4 text-gray-400" />}
                    size="md"
                    variant="default"
                    showClearButton={true}
                    onClear={clearFailedSearch}
                    disabled={failedLoading || failedIsSearching}
                  />
                </div>
                <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600">
                  <span>Total: {failedTotalCount}</span>
                  <span>Showing: {filteredFailedBrands.length}</span>
                  {failedSearchTerm && (
                    <span className="text-red-600">
                      {failedIsSearching ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-1"></div>
                          Searching: "{failedSearchTerm}"
                        </span>
                      ) : (
                        `Searching: "${failedSearchTerm}"`
                      )}
                    </span>
                  )}
                </div>
              </div>
            </Card>

            {/* Failed Table */}
            <Card>
              {failedError ? (
                <ErrorDisplay title="Error Loading Failed Queue" message={failedError}>
                  <Button onClick={loadFailedBrands}>Retry</Button>
                </ErrorDisplay>
              ) : failedLoading && !failedBrands.length ? (
                <LoadingState size="lg" message="Loading failed brands..." />
              ) : failedIsSearching ? (
                <div className="text-center py-12 sm:py-16">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Searching...</h3>
                      <p className="text-sm text-gray-500">
                        Searching for "{failedSearchTerm}" across all pages
                      </p>
                    </div>
                  </div>
                </div>
              ) : filteredFailedBrands.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No failed brands found</h3>
                  <p className="text-sm sm:text-base text-gray-500">
                    {failedSearchTerm ? 'Try adjusting your search terms' : 'All brands have been processed'}
                  </p>
                </div>
              ) : (
                <Table
                  data={filteredFailedBrands}
                  columns={[
                    {
                      key: 'position',
                      label: 'Position',
                      render: (value, row, rowIndex) => {
                        const page = Number(failedCurrentPage) || 1;
                        const itemsPerPageNum = Number(failedItemsPerPage) || 10;
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
                      render: (value, row) => (
                        <div className="flex items-center">
                          <AlertTriangle className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
                          <div className="text-xs font-medium text-gray-900 max-w-[80px] sm:max-w-none truncate">
                            {value || 'Unknown Brand'}
                          </div>
                        </div>
                      )
                    },
                    {
                      key: 'queue_id',
                      label: 'Brand ID',
                      className: 'hidden md:table-cell',
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
                      key: 'actions',
                      label: 'Actions',
                      render: (value, row) => (
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <Button
                            size="sm"
                            variant="info"
                            onClick={() => handleMoveBrand(row, 'pending')}
                            disabled={isProcessingAction}
                            className="text-xs px-1 sm:px-2 py-1"
                            title="Move to Pending Queue"
                          >
                            <Move className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleRemoveBrand(row, 'failed')} 
                            disabled={isProcessingAction}
                            className="text-xs px-1 sm:px-2 py-1"
                            title="Remove Brand"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ),
                    }
                  ]}
                  emptyMessage="No failed brands found"
                />
              )}
            </Card>

            {/* Failed Pagination */}
            <Pagination
              currentPage={failedCurrentPage}
              totalPages={failedTotalPages}
                              onPageChange={(page) => updateFailedState({ currentPage: page })}
              totalItems={failedTotalCount}
              itemsPerPage={failedItemsPerPage}
              showPageInfo={true}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default QueueManagement;