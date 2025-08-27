import { useState, useEffect, useCallback } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import AdminAccessRequired from '../components/ui/AdminAccessRequired';
import QueueControls from '../components/queueManagement/QueueControls';
import QueueStats from '../components/queueManagement/QueueStats';
import PendingQueue from '../components/queueManagement/PendingQueue';
import FailedQueue from '../components/queueManagement/FailedQueue';
import useAdminStore from '../stores/adminStore';
import useQueueStore from '../stores/queueStore';
import { queueAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Shield,
  RefreshCw
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
        <QueueControls 
          isProcessingAction={isProcessingAction}
          onAdminAction={handleAdminAction}
        />
      </Card>

      <QueueStats 
        pendingCount={pending.totalCount}
        failedCount={failed.totalCount}
      />

      <PendingQueue
        pending={pending}
        onSearch={handlePendingSearch}
        onClearSearch={clearPendingSearch}
        onPageChange={(page) => updatePendingState({ currentPage: page })}
        onMoveBrand={handleMoveBrand}
        onRemoveBrand={handleRemoveBrand}
        isProcessingAction={isProcessingAction}
      />

      <FailedQueue
        failed={failed}
        onSearch={handleFailedSearch}
        onClearSearch={clearFailedSearch}
        onPageChange={(page) => updateFailedState({ currentPage: page })}
        onMoveBrand={handleMoveBrand}
        onRemoveBrand={handleRemoveBrand}
        isProcessingAction={isProcessingAction}
      />
    </div>
  );
};

export default QueueManagement;