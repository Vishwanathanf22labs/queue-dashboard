import { useState, useEffect, useCallback } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import LoadingState from '../components/ui/LoadingState';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import SearchInput from '../components/ui/SearchInput';
import AdminAccessRequired from '../components/ui/AdminAccessRequired';
import useAdminStore from '../stores/adminStore';
import useQueueStore from '../stores/queueStore';
import { queueAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  ArrowLeft,
  Trash2,
  Users,
  Tag,
  Search,
  RefreshCw,
  Shield,
  Move,
  AlertTriangle
} from 'lucide-react';

const QueueManagement = () => {
  const { isAdmin, isLoading: adminLoading } = useAdminStore();
  const {
    loading: storeLoading,
    error: storeError,
    clearAllQueues,
    clearPendingQueue,
    clearFailedQueue,
    moveAllPendingToFailed,
    moveAllFailedToPending,
    removePendingBrand,
    removeFailedBrand,
    movePendingToFailed,
    moveFailedToPending
  } = useQueueStore();


  const [state, setState] = useState({
    pending: {
      brands: [],
      loading: false,
      currentPage: 1,
      searchTerm: '',
      itemsPerPage: 10,
      totalCount: 0,
      error: null,
      isSearching: false
    },
    failed: {
      brands: [],
      loading: false,
      currentPage: 1,
      searchTerm: '',
      itemsPerPage: 10,
      totalCount: 0,
      error: null,
      isSearching: false
    },
            admin: {
          isProcessingAction: false
        }
  });

  const { pending, failed, admin } = state;
  const { isProcessingAction } = admin;

  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const updatePendingState = (updates) => {
    setState(prev => ({
      ...prev,
      pending: { ...prev.pending, ...updates }
    }));
  };

  const updateFailedState = (updates) => {
    setState(prev => ({
      ...prev,
      failed: { ...prev.failed, ...updates }
    }));
  };

  const updateAdminState = (updates) => {
    updateState({
      admin: { ...admin, ...updates }
    });
  };



  const pendingColumns = [
    {
      key: 'position',
      label: 'Position',
      render: (value, row, rowIndex) => {
        const page = Number(pending.currentPage) || 1;
        const itemsPerPageNum = Number(pending.itemsPerPage) || 10;
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
          <Tag className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
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
  ];

  const failedColumns = [
    {
      key: 'position',
      label: 'Position',
      render: (value, row, rowIndex) => {
        const page = Number(failed.currentPage) || 1;
        const itemsPerPageNum = Number(failed.itemsPerPage) || 10;
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
          <Tag className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
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
  ];

  const loadPendingBrands = useCallback(async (searchTerm = null, page = null) => {
    updatePendingState({ loading: true, error: null });
    try {

      if (searchTerm) {
        updatePendingState({ isSearching: true });
      }

      const pageToLoad = page || pending.currentPage;
      const response = await queueAPI.getPendingBrands(pageToLoad, pending.itemsPerPage, searchTerm);

      const brands = response.data.data?.brands || [];
      const totalCount = response.data.data?.pagination?.total_items || 0;


      updatePendingState({
        brands,
        totalCount,
        currentPage: pageToLoad,
        isSearching: false
      });
    } catch (error) {
      updatePendingState({ error: error.message || 'Failed to load pending brands', isSearching: false });
      toast.error('Failed to load pending brands');
    } finally {
      updatePendingState({ loading: false });
    }
  }, [pending.itemsPerPage]);

  const loadFailedBrands = useCallback(async (searchTerm = null, page = null) => {
    updateFailedState({ loading: true, error: null });
    try {
      if (searchTerm) {
        updateFailedState({ isSearching: true });
      }

      const pageToLoad = page || failed.currentPage;
      const response = await queueAPI.getFailedBrands(pageToLoad, failed.itemsPerPage, searchTerm);

      const brands = response.data.data?.brands || [];
      const totalCount = response.data.data?.pagination?.total_items || 0;



      updateFailedState({
        brands,
        totalCount,
        currentPage: pageToLoad,
        isSearching: false
      });
    } catch (error) {
      updateFailedState({ error: error.message || 'Failed to load failed brands', isSearching: false });
      toast.error('Failed to load failed brands');
    } finally {
      updateFailedState({ loading: false });
    }
  }, [failed.itemsPerPage]);


  useEffect(() => {
    // Load both pending and failed brands on component mount
    loadPendingBrands();
    loadFailedBrands();
  }, [loadPendingBrands, loadFailedBrands]);

  useEffect(() => {
    // Only reload pending brands when page changes (not on initial load)
    if (pending.currentPage > 1) {
      loadPendingBrands(null, pending.currentPage);
    }
  }, [pending.currentPage, loadPendingBrands]);

  useEffect(() => {
    // Only reload failed brands when page changes (not on initial load)
    if (failed.currentPage > 1) {
      loadFailedBrands(null, failed.currentPage);
    }
  }, [failed.currentPage, loadFailedBrands]);

  const handlePendingSearch = (searchTerm) => {
    updatePendingState({ searchTerm });

    if (!searchTerm || searchTerm.trim() === '') {
      updatePendingState({ currentPage: 1 });
      loadPendingBrands();
      return;
    }


    if (searchTerm !== pending.searchTerm) {
      updatePendingState({ currentPage: 1 });
    }

    loadPendingBrands(searchTerm);
  };

  const handleFailedSearch = (searchTerm) => {
    updateFailedState({ searchTerm });


    if (!searchTerm || searchTerm.trim() === '') {
      updateFailedState({ currentPage: 1 });
      loadFailedBrands();
      return;
    }


    if (searchTerm !== failed.searchTerm) {
      updateFailedState({ currentPage: 1 });
    }

    loadFailedBrands(searchTerm);
  };


  const clearPendingSearch = () => {
    updatePendingState({ searchTerm: '', currentPage: 1 });
    loadPendingBrands();
  };

  const clearFailedSearch = () => {
    updateFailedState({ searchTerm: '', currentPage: 1 });
    loadFailedBrands();
  };


  const handleRefresh = async () => {
    await Promise.all([loadPendingBrands(), loadFailedBrands()]);
    toast.success('Queue data refreshed successfully');
  };


  const handleAdminAction = async (action) => {
    if (isProcessingAction) return;

    updateAdminState({ isProcessingAction: true });
    try {
      let response;

      switch (action) {
        case 'Clear All Queues':
          response = await clearAllQueues();
          break;
        case 'Clear Pending Queue':
          response = await clearPendingQueue();
          break;
        case 'Clear Failed Queue':
          response = await clearFailedQueue();
          break;
        case 'Move All Pending to Failed':
          response = await moveAllPendingToFailed();
          break;
        case 'Move All Failed to Pending':
          response = await moveAllFailedToPending();
          break;
        default:
          throw new Error('Unknown action');
      }

      toast.success(`${action} completed successfully`);


      await handleRefresh();

    } catch (error) {
      toast.error(`Failed to ${action.toLowerCase()}: ${error.response?.data?.message || error.message || error}`);
    } finally {
      updateAdminState({ isProcessingAction: false });
    }
  };


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
        response = await movePendingToFailed(brandIdentifier);
      } else {
        response = await moveFailedToPending(brandIdentifier);
      }

      toast.success(`Brand ${brand.brand_name} moved to ${targetQueue} queue successfully`);

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

      const brandIdentifier = brand.queue_id || brand.brand_id || brand.page_id;

      if (!brandIdentifier) {
        throw new Error('Brand identifier not found');
      }

      if (queueType === 'pending') {
        response = await removePendingBrand(brandIdentifier);
      } else if (queueType === 'failed') {
        response = await removeFailedBrand(brandIdentifier);
      } else {
        throw new Error('Invalid queue type');
      }

      toast.success(`Brand ${brand.brand_name} removed successfully`);

      await handleRefresh();

    } catch (error) {
      toast.error(`Failed to remove brand: ${error.response?.data?.message || error.message || error}`);
    } finally {
      updateAdminState({ isProcessingAction: false });
    }
  };

  const filteredPendingBrands = pending.brands;
  const filteredFailedBrands = failed.brands;

  const pendingTotalPages = Math.ceil(pending.totalCount / pending.itemsPerPage);

  const failedTotalPages = Math.ceil(failed.totalCount / failed.itemsPerPage);

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return <AdminAccessRequired />;
  }

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
              disabled={pending.loading || failed.loading}
              size="sm"
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${(pending.loading || failed.loading) ? 'animate-spin' : ''}`} />
              {pending.loading || failed.loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          </div>
        </div>
      </div>

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
              size="sm"
              className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>
                <span className="hidden sm:inline">Clear Failed Queue</span>
                <span className="sm:hidden">Clear Failed</span>
              </span>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-3 sm:mb-4 lg:mb-6">
        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-blue-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Pending</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-blue-600">
                {pending.totalCount}
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
                {failed.totalCount}
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
                {pending.totalCount + failed.totalCount}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Pending Queue</h2>

        <Card className="mb-4 sm:mb-6">
          <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:gap-4">
            <div className="flex-1 max-w-md">
              <SearchInput
                value={pending.searchTerm}
                onChange={(value) => handlePendingSearch(value)}
                placeholder="Search pending brands by name, ID, or page ID..."
                leftIcon={<Search className="h-4 w-4 text-gray-400" />}
                size="md"
                variant="default"
                showClearButton={true}
                onClear={clearPendingSearch}
                disabled={pending.loading || pending.isSearching}
              />
            </div>
            <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600">
              <span>Total: {pending.totalCount}</span>
              <span>Showing: {filteredPendingBrands.length}</span>
              {pending.searchTerm && (
                <span className="text-blue-600">
                  {pending.isSearching ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                      Searching: "{pending.searchTerm}"
                    </span>
                  ) : (
                    `Searching: "${pending.searchTerm}"`
                  )}
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card>
          {pending.error ? (
            <ErrorDisplay title="Error Loading Pending Queue" message={pending.error}>
              <Button onClick={loadPendingBrands}>Retry</Button>
            </ErrorDisplay>
          ) : pending.loading ? (
            <LoadingState size="lg" message="Loading pending brands..." />
          ) : pending.isSearching ? (
            <div className="text-center py-12 sm:py-16">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Searching...</h3>
                  <p className="text-sm text-gray-500">
                    Searching for "{pending.searchTerm}" across all pages
                  </p>
                </div>
              </div>
            </div>
          ) : filteredPendingBrands.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Users className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No pending brands found</h3>
              <p className="text-sm sm:text-base text-gray-500">
                {pending.searchTerm ? 'Try adjusting your search terms' : 'All brands have been processed'}
              </p>
            </div>
          ) : (
            <Table
              data={filteredPendingBrands}
              columns={pendingColumns}
              emptyMessage="No pending brands found"
              className="shadow-md rounded-lg"
            />
          )}
        </Card>

        <Pagination
          currentPage={pending.currentPage}
          totalPages={pendingTotalPages}
          onPageChange={(page) => updatePendingState({ currentPage: page })}
          totalItems={pending.totalCount}
          itemsPerPage={pending.itemsPerPage}
          showPageInfo={true}
        />
      </div>

      <div className="space-y-4 sm:space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Failed Queue</h2>

        <Card className="mb-4 sm:mb-6">
          <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:gap-4">
            <div className="flex-1 max-w-md">
              <SearchInput
                value={failed.searchTerm}
                onChange={(value) => handleFailedSearch(value)}
                placeholder="Search failed brands by name, ID, or page ID..."
                leftIcon={<Search className="h-4 w-4 text-gray-400" />}
                size="md"
                variant="default"
                showClearButton={true}
                onClear={clearFailedSearch}
                disabled={failed.loading || failed.isSearching}
              />
            </div>
            <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600">
              <span>Total: {failed.totalCount}</span>
              <span>Showing: {filteredFailedBrands.length}</span>
              {failed.searchTerm && (
                <span className="text-red-600">
                  {failed.isSearching ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-1"></div>
                      Searching: "{failed.searchTerm}"
                    </span>
                  ) : (
                    `Searching: "${failed.searchTerm}"`
                  )}
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card>
          {failed.error ? (
            <ErrorDisplay title="Error Loading Failed Queue" message={failed.error}>
              <Button onClick={loadFailedBrands}>Retry</Button>
            </ErrorDisplay>
          ) : failed.loading ? (
            <LoadingState size="lg" message="Loading failed brands..." />
          ) : failed.isSearching ? (
            <div className="text-center py-12 sm:py-16">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Searching...</h3>
                  <p className="text-sm text-gray-500">
                    Searching for "{failed.searchTerm}" across all pages
                  </p>
                </div>
              </div>
            </div>
          ) : filteredFailedBrands.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No failed brands found</h3>
              <p className="text-sm sm:text-base text-gray-500">
                {failed.searchTerm ? 'Try adjusting your search terms' : 'All brands have been processed'}
              </p>
            </div>
          ) : (
            <Table
              data={filteredFailedBrands}
              columns={failedColumns}
              emptyMessage="No failed brands found"
              className="shadow-md rounded-lg"
            />
          )}
        </Card>

        <Pagination
          currentPage={failed.currentPage}
          totalPages={failedTotalPages}
          onPageChange={(page) => updateFailedState({ currentPage: page })}
          totalItems={failed.totalCount}
          itemsPerPage={failed.itemsPerPage}
          showPageInfo={true}
        />
      </div>

      
    </div>
  );
};

export default QueueManagement;