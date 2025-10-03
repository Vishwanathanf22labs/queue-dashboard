import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingSearchRef = useRef('');
  const failedSearchRef = useRef('');
  const isInitialMountRef = useRef(true);
  
  // Helper function to get initial confirmation dialog state from localStorage
  // Only restore on page refresh (when the component mounts fresh)
  const getInitialConfirmDialogState = () => {
    try {
      // Check if this is a page refresh by looking for a specific flag
      const isPageRefresh = sessionStorage.getItem('queueManagementPageRefreshed') === 'true';
      const wasPageVisited = sessionStorage.getItem('queueManagementPageVisited') === 'true';
      
      // Only restore if it's a page refresh AND the page was previously visited
      // If page was not visited, it's a fresh navigation, not a refresh
      if (isPageRefresh && wasPageVisited) {
        // Clear the flag and check for saved confirmation dialog state
        sessionStorage.removeItem('queueManagementPageRefreshed');
        const saved = localStorage.getItem('queueManagement_confirmDialog');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            showConfirmDialog: parsed.showConfirmDialog || false,
            confirmText: parsed.confirmText || '',
            confirmAction: parsed.confirmAction || ''
          };
        }
      } else {
        // Clear any stale refresh flags
        sessionStorage.removeItem('queueManagementPageRefreshed');
      }
      // If not a page refresh, clear any existing dialog state
      localStorage.removeItem('queueManagement_confirmDialog');
      return {
        showConfirmDialog: false,
        confirmText: '',
        confirmAction: ''
      };
    } catch {
      return {
        showConfirmDialog: false,
        confirmText: '',
        confirmAction: ''
      };
    }
  };

  // State for confirmation dialog persistence
  const [confirmDialogState, setConfirmDialogState] = useState(getInitialConfirmDialogState);
  
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
    moveFailedToPending,
    clearWatchlistPendingQueue,
    clearWatchlistFailedQueue,
    moveAllWatchlistPendingToFailed,
    moveAllWatchlistFailedToPending
  } = useQueueStore();

  const [state, setState] = useState({
    pending: {
      brands: [],
      loading: false,
      currentPage: parseInt(searchParams.get('pendingPage')) || 1,
      searchTerm: searchParams.get('pendingSearch') || '',
      itemsPerPage: parseInt(searchParams.get('pendingLimit')) || 10,
      totalCount: 0,
      error: null,
      isSearching: false
    },
    failed: {
      brands: [],
      loading: false,
      currentPage: parseInt(searchParams.get('failedPage')) || 1,
      searchTerm: searchParams.get('failedSearch') || '',
      itemsPerPage: parseInt(searchParams.get('failedLimit')) || 10,
      totalCount: 0,
      error: null,
      isSearching: false
    },
    admin: {
      isProcessingAction: false
    }
  });

  // Store original totals that don't change during search
  const [originalTotals, setOriginalTotals] = useState({
    pendingCount: 0,
    failedCount: 0,
    totalBrands: 0
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
    
    // Update URL parameters for persistence (except search)
    if (updates.currentPage !== undefined || updates.itemsPerPage !== undefined) {
      const newSearchParams = new URLSearchParams(searchParams);
      
      if (updates.currentPage !== undefined) {
        newSearchParams.set('pendingPage', updates.currentPage.toString());
      }
      if (updates.itemsPerPage !== undefined) {
        newSearchParams.set('pendingLimit', updates.itemsPerPage.toString());
      }
      
      setSearchParams(newSearchParams, { replace: true });
    }
  };

  const updateFailedState = (updates) => {
    setState(prev => ({
      ...prev,
      failed: { ...prev.failed, ...updates }
    }));
    
    // Update URL parameters for persistence (except search)
    if (updates.currentPage !== undefined || updates.itemsPerPage !== undefined) {
      const newSearchParams = new URLSearchParams(searchParams);
      
      if (updates.currentPage !== undefined) {
        newSearchParams.set('failedPage', updates.currentPage.toString());
      }
      if (updates.itemsPerPage !== undefined) {
        newSearchParams.set('failedLimit', updates.itemsPerPage.toString());
      }
      
      setSearchParams(newSearchParams, { replace: true });
    }
  };

  const updateAdminState = (updates) => {
    updateState({
      admin: { ...admin, ...updates }
    });
  };

  const loadPendingBrands = useCallback(async (searchTerm = null, page = null) => {
    // Single state update for loading
    updatePendingState({ 
      loading: true, 
      error: null,
      ...(searchTerm ? { isSearching: true } : {})
    });
    
    try {
      const pageToLoad = page || pending.currentPage;
      const response = await queueAPI.getPendingBrands(pageToLoad, pending.itemsPerPage, searchTerm);

      // Only update results if they match the current search term
      const currentSearch = pendingSearchRef.current;
      const searchToCheck = searchTerm || '';
      
      // If search terms don't match, ignore this response (it's stale)
      if (searchToCheck !== currentSearch) {
        updatePendingState({ isSearching: false, loading: false });
        return; 
      }

      const brands = response.data.data?.brands || [];
      const totalCount = response.data.data?.pagination?.total_items || 0;

      // Single final state update
      updatePendingState({
        brands,
        totalCount,
        currentPage: pageToLoad,
        isSearching: false,
        loading: false
      });

      // Update original totals only when not searching
      if (!searchTerm) {
        setOriginalTotals(prev => ({
          ...prev,
          pendingCount: totalCount,
          totalBrands: prev.failedCount + totalCount
        }));
      }
    } catch (error) {
      updatePendingState({ 
        error: error.message || 'Failed to load pending brands', 
        isSearching: false, 
        loading: false 
      });
      toast.error('Failed to load pending brands');
    }
  }, [pending.itemsPerPage]);

  const loadFailedBrands = useCallback(async (searchTerm = null, page = null) => {
    // Single state update for loading
    updateFailedState({ 
      loading: true, 
      error: null,
      ...(searchTerm ? { isSearching: true } : {})
    });
    
    try {
      const pageToLoad = page || failed.currentPage;
      const response = await queueAPI.getFailedBrands(pageToLoad, failed.itemsPerPage, searchTerm);

      // Only update results if they match the current search term
      const currentSearch = failedSearchRef.current;
      const searchToCheck = searchTerm || '';
      
      
      // If search terms don't match, ignore this response (it's stale)
      if (searchToCheck !== currentSearch) {
        updateFailedState({ isSearching: false, loading: false });
        return; 
      }

      const brands = response.data.data?.brands || [];
      const totalCount = response.data.data?.pagination?.total_items || 0;


      // Single final state update
      updateFailedState({
        brands,
        totalCount,
        currentPage: pageToLoad,
        isSearching: false,
        loading: false
      });

      // Update original totals only when not searching
      if (!searchTerm) {
        setOriginalTotals(prev => ({
          ...prev,
          failedCount: totalCount,
          totalBrands: prev.pendingCount + totalCount
        }));
      }
    } catch (error) {
      updateFailedState({ 
        error: error.message || 'Failed to load failed brands', 
        isSearching: false, 
        loading: false 
      });
      toast.error('Failed to load failed brands');
    }
  }, [failed.itemsPerPage]);


  useEffect(() => {
    // Load both pending and failed brands on component mount
    // Check if there are URL search parameters and load accordingly
    const pendingPage = parseInt(searchParams.get('pendingPage')) || 1;
    const pendingSearch = localStorage.getItem('queueManagement_pendingSearch') || '';
    const pendingLimit = parseInt(searchParams.get('pendingLimit')) || 10;
    const failedPage = parseInt(searchParams.get('failedPage')) || 1;
    const failedSearch = localStorage.getItem('queueManagement_failedSearch') || '';
    const failedLimit = parseInt(searchParams.get('failedLimit')) || 10;


    // Update state from URL parameters and localStorage fallback
    setState(prev => ({
      ...prev,
      pending: {
        ...prev.pending,
        currentPage: pendingPage,
        searchTerm: pendingSearch,
        itemsPerPage: pendingLimit
      },
      failed: {
        ...prev.failed,
        currentPage: failedPage,
        searchTerm: failedSearch,
        itemsPerPage: failedLimit
      }
    }));

    if (pendingSearch && pendingSearch.trim().length >= 3) {
      pendingSearchRef.current = pendingSearch;
      loadPendingBrands(pendingSearch);
    } else {
      loadPendingBrands();
    }

    if (failedSearch && failedSearch.trim().length >= 3) {
      failedSearchRef.current = failedSearch;
      loadFailedBrands(failedSearch);
    } else {
      loadFailedBrands();
    }

    // Mark initial mount as complete
    setTimeout(() => {
      isInitialMountRef.current = false;
    }, 100);
  }, []); // Empty dependencies - only run once on mount

  // Load pending brands when pending page changes
  useEffect(() => {
    // Skip initial mount - let mount useEffect handle it
    if (isInitialMountRef.current) {
      return;
    }
    
    // Only load pending brands when pending page changes
    loadPendingBrands(null, pending.currentPage);
  }, [pending.currentPage]);

  // Load failed brands when failed page changes
  useEffect(() => {
    // Skip initial mount - let mount useEffect handle it
    if (isInitialMountRef.current) {
      return;
    }
    
    // Only load failed brands when failed page changes
    loadFailedBrands(null, failed.currentPage);
  }, [failed.currentPage]);

  // Debounced search for pending queue
  useEffect(() => {
    // Don't run on initial mount to prevent duplicate calls
    if (isInitialMountRef.current) {
      return;
    }
    
    if (pending.searchTerm && pending.searchTerm.trim() !== '') {
      const timeoutId = setTimeout(() => {
        if (pending.searchTerm.trim().length >= 3) {
          pendingSearchRef.current = pending.searchTerm;
          loadPendingBrands(pending.searchTerm);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    } else if (pending.searchTerm === '') {
      // Handle clearing search - load normal data
      pendingSearchRef.current = '';
      loadPendingBrands();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.searchTerm]);

  // Debounced search for failed queue
  useEffect(() => {
    // Don't run on initial mount to prevent duplicate calls
    if (isInitialMountRef.current) {
      return;
    }
    
    if (failed.searchTerm && failed.searchTerm.trim() !== '') {
      const timeoutId = setTimeout(() => {
        if (failed.searchTerm.trim().length >= 3) {
          failedSearchRef.current = failed.searchTerm;
          loadFailedBrands(failed.searchTerm);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    } else if (failed.searchTerm === '') {
      // Handle clearing search - load normal data
      failedSearchRef.current = '';
      loadFailedBrands();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed.searchTerm]);

  // Detect page refresh and set flag
  useEffect(() => {
    // Detect if this is a page refresh (not initial load)
    const isInitialLoad = !sessionStorage.getItem('queueManagementPageVisited');
    
    if (!isInitialLoad) {
      // This is a page refresh, set the flag
      sessionStorage.setItem('queueManagementPageRefreshed', 'true');
    } else {
      // This is initial load, mark page as visited
      sessionStorage.setItem('queueManagementPageVisited', 'true');
    }

    // Cleanup function to clear the visited flag when navigating away
    return () => {
      sessionStorage.removeItem('queueManagementPageVisited');
    };
  }, []);

  // Save confirmation dialog state to localStorage whenever it changes
  useEffect(() => {
    if (confirmDialogState.showConfirmDialog) {
      localStorage.setItem('queueManagement_confirmDialog', JSON.stringify(confirmDialogState));
    } else {
      localStorage.removeItem('queueManagement_confirmDialog');
    }
  }, [confirmDialogState]);


  const handlePendingSearch = (searchTerm) => {
    updatePendingState({ searchTerm });

    // Save to localStorage only
    if (searchTerm && searchTerm.trim()) {
      localStorage.setItem('queueManagement_pendingSearch', searchTerm);
    } else {
      localStorage.removeItem('queueManagement_pendingSearch');
    }

    if (!searchTerm || searchTerm.trim() === '') {
      updatePendingState({ currentPage: 1 });
      // Don't call loadPendingBrands here - let useEffect handle it
    }
  };

  const handleFailedSearch = (searchTerm) => {
    updateFailedState({ searchTerm });

    // Save to localStorage only
    if (searchTerm && searchTerm.trim()) {
      localStorage.setItem('queueManagement_failedSearch', searchTerm);
    } else {
      localStorage.removeItem('queueManagement_failedSearch');
    }

    if (!searchTerm || searchTerm.trim() === '') {
      updateFailedState({ currentPage: 1 });
      // Don't call loadFailedBrands here - let useEffect handle it
    }
  };

  const clearPendingSearch = () => {
    pendingSearchRef.current = '';
    updatePendingState({ searchTerm: '', currentPage: 1 });
    
    // Clear localStorage only
    localStorage.removeItem('queueManagement_pendingSearch');
    
    // Don't call loadPendingBrands here - let useEffect handle it
  };

  const clearFailedSearch = () => {
    failedSearchRef.current = '';
    updateFailedState({ searchTerm: '', currentPage: 1 });
    
    // Clear localStorage only
    localStorage.removeItem('queueManagement_failedSearch');
    
    // Don't call loadFailedBrands here - let useEffect handle it
  };

  const handleRefresh = async () => {
    await Promise.all([loadPendingBrands(), loadFailedBrands()]);
    toast.success('Queue data refreshed successfully');
  };

  const handlePendingRefresh = async () => {
    await loadPendingBrands();
  };

  const handleFailedRefresh = async () => {
    await loadFailedBrands();
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
        case 'Clear Watchlist Pending Queue':
          response = await clearWatchlistPendingQueue();
          break;
        case 'Clear Watchlist Failed Queue':
          response = await clearWatchlistFailedQueue();
          break;
        case 'Move All Watchlist Pending to Failed':
          response = await moveAllWatchlistPendingToFailed();
          break;
        case 'Move All Watchlist Failed to Pending':
          response = await moveAllWatchlistFailedToPending();
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
        // When moving from pending to failed, refresh both queues
        await Promise.all([handlePendingRefresh(), handleFailedRefresh()]);
      } else {
        response = await moveFailedToPending(brandIdentifier);
        // When moving from failed to pending, refresh both queues
        await Promise.all([handlePendingRefresh(), handleFailedRefresh()]);
      }

      toast.success(`Brand ${brand.brand_name} moved to ${targetQueue} queue successfully`);

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
        await handlePendingRefresh();
      } else if (queueType === 'failed') {
        response = await removeFailedBrand(brandIdentifier);
        await handleFailedRefresh();
      } else {
        throw new Error('Invalid queue type');
      }

      toast.success(`Brand ${brand.brand_name} removed successfully`);

    } catch (error) {
      toast.error(`Failed to remove brand: ${error.response?.data?.message || error.message || error}`);
    } finally {
      updateAdminState({ isProcessingAction: false });
    }
  };

  
  if (adminLoading) {
    return <LoadingSpinner />;
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
              <div className="flex items-center space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-100 text-red-600 rounded-lg">
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
          confirmDialogState={confirmDialogState}
          onConfirmDialogStateChange={setConfirmDialogState}
          disabled={!isAdmin}
        />
      </Card>

      <QueueStats 
        pendingCount={originalTotals.pendingCount}
        failedCount={originalTotals.failedCount}
        totalBrands={originalTotals.totalBrands}
      />

      <PendingQueue
        pending={pending}
        onSearch={handlePendingSearch}
        onClearSearch={clearPendingSearch}
          onPageChange={(page) => {
            updatePendingState({ currentPage: page });
            
            // Prevent scroll jump by keeping pagination in view
          setTimeout(() => {
            const paginationElement = document.getElementById('pending-queue-pagination');
            if (paginationElement) {
              paginationElement.scrollIntoView({ 
                behavior: 'instant', 
                block: 'center',
                inline: 'nearest'
              });
            }
          }, 100); // Increased delay to ensure table re-render is complete
        }}
        onMoveBrand={handleMoveBrand}
        onRemoveBrand={handleRemoveBrand}
        isProcessingAction={isProcessingAction}
        disabled={!isAdmin}
      />

      <FailedQueue
        failed={failed}
        onSearch={handleFailedSearch}
        onClearSearch={clearFailedSearch}
          onPageChange={(page) => {
            updateFailedState({ currentPage: page });
            
            // Update URL parameters
            const newParams = new URLSearchParams(searchParams);
            newParams.set('failedPage', page.toString());
            setSearchParams(newParams);
            
            // Prevent scroll jump by keeping pagination in view
          setTimeout(() => {
            const paginationElement = document.getElementById('failed-queue-pagination');
            if (paginationElement) {
              paginationElement.scrollIntoView({ 
                behavior: 'instant', 
                block: 'center',
                inline: 'nearest'
              });
            }
          }, 100); // Increased delay to ensure table re-render is complete
        }}
        onMoveBrand={handleMoveBrand}
        onRemoveBrand={handleRemoveBrand}
        isProcessingAction={isProcessingAction}
        disabled={!isAdmin}
      />
    </div>
  );
};

export default QueueManagement;