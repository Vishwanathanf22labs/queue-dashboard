import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorDisplay from '../components/ui/ErrorDisplay';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import RefreshControl from '../components/ui/RefreshControl';
import { useAdminLogin } from '../contexts/AdminLoginContext';
import toast from 'react-hot-toast';
import useQueueStore from '../stores/queueStore';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { AlertCircle, Search, Users, Hash, Tag, XCircle, ExternalLink, RotateCcw, Trash2, X, Shield } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
import useAdminStore from '../stores/adminStore';

const FailedQueue = () => {
  const { fetchFailedBrands, fetchReenqueueData, requeueSingleBrand, requeueAllBrands, deleteReenqueueBrand, deleteAllReenqueueBrands, loading } = useQueueStore();
  const { isAdmin, isLoading: adminLoading } = useAdminStore();
  const currentSearchRef = useRef('');
  const isInitialMountRef = useRef(true);
  const scrollPositionRef = useRef(0);
  const isScrollLockedRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { onAdminLogin } = useAdminLogin();
  
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

  // Separate state for reenqueue data
  const [reenqueueState, setReenqueueState] = useState({
    items: [],
    pagination: {},
    currentPage: 1,
    itemsPerPage: 10,
    isLoading: false
  });

  // Helper function to get initial confirmation dialog state from localStorage
  const getInitialConfirmDialogState = () => {
    try {
      const isPageRefresh = sessionStorage.getItem('failedQueuePageRefreshed') === 'true';
      const wasPageVisited = sessionStorage.getItem('failedQueuePageVisited') === 'true';
      
      if (isPageRefresh && wasPageVisited) {
        // Don't remove the flag here since it's used by both dialogs
        const saved = localStorage.getItem('failedQueue_confirmDialog');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            show: parsed.show || false,
            confirmText: parsed.confirmText || ''
          };
        }
      }
    } catch (error) {
      console.error('Error loading confirmation dialog state:', error);
    }
    return { show: false, confirmText: '' };
  };

  // Helper function to get initial requeue confirmation dialog state from localStorage
  const getInitialRequeueConfirmDialogState = () => {
    try {
      const isPageRefresh = sessionStorage.getItem('failedQueuePageRefreshed') === 'true';
      const wasPageVisited = sessionStorage.getItem('failedQueuePageVisited') === 'true';
      
      if (isPageRefresh && wasPageVisited) {
        // Don't remove the flag here since it's used by both dialogs
        const saved = localStorage.getItem('failedQueue_requeueConfirmDialog');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            show: parsed.show || false,
            confirmText: parsed.confirmText || ''
          };
        }
      }
    } catch (error) {
      console.error('Error loading requeue confirmation dialog state:', error);
    }
    return { show: false, confirmText: '' };
  };

  // Confirmation dialog state for Delete All
  const [confirmDialog, setConfirmDialog] = useState({ show: false, confirmText: '' });

  // Confirmation dialog state for Requeue All
  const [requeueConfirmDialog, setRequeueConfirmDialog] = useState({ show: false, confirmText: '' });

  const { searchTerm, currentPage, itemsPerPage, isRefreshing, brands, pagination, isSearching, error } = queueState;
  const { items: reenqueueItems, pagination: reenqueuePagination, currentPage: reenqueueCurrentPage, itemsPerPage: reenqueueItemsPerPage, isLoading: reenqueueLoading } = reenqueueState;

  const updateQueueState = (updates) => {
    setQueueState(prev => ({ ...prev, ...updates }));
  };

  useLayoutEffect(() => {
    if (isScrollLockedRef.current) {
      window.scrollTo(0, scrollPositionRef.current);
    }
  });

  // Handler for requeue single brand
  const handleRequeueSingle = async (itemId) => {

    const scrollPosition = window.scrollY;
    scrollPositionRef.current = scrollPosition;
    isScrollLockedRef.current = true;
    
    try {
      await requeueSingleBrand(itemId, 'non-watchlist');
      toast.success('Brand requeued successfully to pending queue');
      
      loadReenqueueData(reenqueueCurrentPage, false); // Reload current page
      loadFailedBrands(); // Reload failed brands to update counts
      
      setTimeout(() => {
        isScrollLockedRef.current = false;
      }, 100);
    } catch (error) {
      isScrollLockedRef.current = false;
      toast.error(`Failed to requeue brand: ${error.message}`);
    }
  };

  // Handler for requeue all brands
  const handleRequeueAll = () => {
    setRequeueConfirmDialog({ show: true, confirmText: '' });
  };

  const handleConfirmRequeueAll = async () => {
    if (requeueConfirmDialog.confirmText.toLowerCase() !== 'confirm') {
      toast.error('Please type "confirm" to proceed');
      return;
    }

    const scrollPosition = window.scrollY;
    scrollPositionRef.current = scrollPosition;
    isScrollLockedRef.current = true;

    try {
      const result = await requeueAllBrands('non-watchlist');
      toast.success(`${result.data.count} brands requeued successfully`);
      
      loadReenqueueData(1, false); // Reset to page 1
      loadFailedBrands(); // Reload failed brands to update counts
      setRequeueConfirmDialog({ show: false, confirmText: '' });
      
      setTimeout(() => {
        isScrollLockedRef.current = false;
      }, 100);
    } catch (error) {
      isScrollLockedRef.current = false;
      toast.error(`Failed to requeue all brands: ${error.message}`);
    }
  };

  const handleCancelRequeueAll = () => {
    setRequeueConfirmDialog({ show: false, confirmText: '' });
  };

  // Handler for delete single brand (no confirmation)
  const handleDeleteSingle = async (itemId) => {
    const scrollPosition = window.scrollY;
    scrollPositionRef.current = scrollPosition;
    isScrollLockedRef.current = true;
    
    try {
      await deleteReenqueueBrand(itemId, 'non-watchlist');
      toast.success('Brand deleted successfully from reenqueue list');
      
      loadReenqueueData(reenqueueCurrentPage, false); // Reload current page

      setTimeout(() => {
        isScrollLockedRef.current = false;
      }, 100);
    } catch (error) {
      isScrollLockedRef.current = false;
      toast.error(`Failed to delete brand: ${error.message}`);
    }
  };

  // Handler for delete all brands (with typing confirmation)
  const handleDeleteAllClick = () => {
    setConfirmDialog({ show: true, confirmText: '' });
  };

  const handleConfirmDeleteAll = async () => {
    if (confirmDialog.confirmText.toLowerCase() !== 'confirm') {
      toast.error('Please type "confirm" to proceed');
      return;
    }

    // Lock scroll position during the entire operation
    const scrollPosition = window.scrollY;
    scrollPositionRef.current = scrollPosition;
    isScrollLockedRef.current = true;

    try {
      const result = await deleteAllReenqueueBrands('non-watchlist');
      toast.success(`${result.data.count} brands deleted successfully`);
      
      setConfirmDialog({ show: false, confirmText: '' });
      loadReenqueueData(1, false); // Reset to page 1

      setTimeout(() => {
        isScrollLockedRef.current = false;
      }, 100);
    } catch (error) {
      isScrollLockedRef.current = false;
      toast.error(`Failed to delete all brands: ${error.message}`);
    }
  };

  const handleCancelDeleteAll = () => {
    setConfirmDialog({ show: false, confirmText: '' });
  };

  // Reenqueue table columns: Position → Brand Name → Brand ID → Page ID → Coverage → Actions
  const reenqueueColumns = [
    {
      key: 'position',
      label: 'Position',
      render: (value, row, rowIndex) => {
        const position = (reenqueueCurrentPage - 1) * reenqueueItemsPerPage + rowIndex + 1;
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
        const brandName = value || row.brand_name || 'Unknown Brand';
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
      key: 'id',
      label: 'Brand ID',
      render: (value) => (
        <div className="flex items-center">
          <Hash className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
          <span className="text-xs font-mono text-gray-900">
            {value || 'N/A'}
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
          <span className="text-xs font-mono text-gray-900">
            {value || 'N/A'}
          </span>
        </div>
      )
    },
    {
      key: 'coverage',
      label: 'Coverage',
      render: (value) => (
        <div className="flex items-center">
          <span className="text-xs font-medium text-blue-600">
            {value || 'N/A'}
          </span>
        </div>
      ),
      className: 'hidden sm:table-cell'
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleRequeueSingle(row.id)}
            disabled={!isAdmin}
            size="sm"
            variant="success"
            className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-green-600 transition-colors"
            title={!isAdmin ? 'Admin access required' : 'Requeue to Pending'}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button
            onClick={() => handleDeleteSingle(row.id)}
            disabled={!isAdmin}
            size="sm"
            variant="danger"
            className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-red-600 transition-colors"
            title={!isAdmin ? 'Admin access required' : 'Delete from List'}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )
    }
  ];

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

  const loadReenqueueData = useCallback(async (page = 1, showLoading = false) => {
    try {
      // Only show loading spinner on initial load, not on page changes
      if (showLoading) {
        setReenqueueState(prev => ({ ...prev, isLoading: true }));
      }
      
      // Always use the page parameter passed in
      const response = await fetchReenqueueData(page, 10, null, 'non-watchlist');
      
      let items = [];
      let pagination = {};

      if (response.items && response.pagination) {
        items = response.items;
        pagination = response.pagination;
      } else if (response.data) {
        items = response.data.items || response.data || [];
        pagination = response.data.pagination || {};
      } else {
        items = response || [];
        pagination = {};
      }

      setReenqueueState(prev => ({
        ...prev,
        items,
        pagination,
        currentPage: page,
        isLoading: false
      }));
    } catch (error) {
      console.error('Error loading reenqueue data:', error);
      setReenqueueState(prev => ({ ...prev, isLoading: false }));
    }
  }, [fetchReenqueueData]);

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

    // Load reenqueue data (show loading on initial load)
    loadReenqueueData(1, true);

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
  }, [currentPage]);

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
  }, [searchTerm]);

  // Handle reenqueue page changes
  useEffect(() => {
    // Skip initial mount
    if (isInitialMountRef.current) {
      return;
    }

    // Load reenqueue data when page changes
    loadReenqueueData(reenqueueCurrentPage, false);
  }, [reenqueueCurrentPage]);

  // Detect page refresh and set flag, then restore dialog states
  useEffect(() => {
    const isInitialLoad = !sessionStorage.getItem('failedQueuePageVisited');
    
    if (!isInitialLoad) {
      // This is a page refresh, set the flag
      sessionStorage.setItem('failedQueuePageRefreshed', 'true');
      
      // Restore dialog states from localStorage
      try {
        const savedConfirmDialog = localStorage.getItem('failedQueue_confirmDialog');
        if (savedConfirmDialog) {
          const parsed = JSON.parse(savedConfirmDialog);
          setConfirmDialog({
            show: parsed.show || false,
            confirmText: parsed.confirmText || ''
          });
        }
        
        const savedRequeueDialog = localStorage.getItem('failedQueue_requeueConfirmDialog');
        if (savedRequeueDialog) {
          const parsed = JSON.parse(savedRequeueDialog);
          setRequeueConfirmDialog({
            show: parsed.show || false,
            confirmText: parsed.confirmText || ''
          });
        }
      } catch (error) {
        console.error('Error restoring dialog states:', error);
      }
    } else {
      // This is initial load, mark page as visited
      sessionStorage.setItem('failedQueuePageVisited', 'true');
    }

    // Cleanup function to clear the visited flag when navigating away
    return () => {
      sessionStorage.removeItem('failedQueuePageVisited');
    };
  }, []);

  // Save confirmation dialog state to localStorage whenever it changes
  useEffect(() => {
    if (confirmDialog.show) {
      localStorage.setItem('failedQueue_confirmDialog', JSON.stringify(confirmDialog));
    } else {
      localStorage.removeItem('failedQueue_confirmDialog');
    }
  }, [confirmDialog]);

  // Save requeue confirmation dialog state to localStorage whenever it changes
  useEffect(() => {
    if (requeueConfirmDialog.show) {
      localStorage.setItem('failedQueue_requeueConfirmDialog', JSON.stringify(requeueConfirmDialog));
    } else {
      localStorage.removeItem('failedQueue_requeueConfirmDialog');
    }
  }, [requeueConfirmDialog]);


  // Auto-refresh hook
  const refreshFn = useCallback(async () => {
    try {
      if (searchTerm && searchTerm.trim().length >= 3) {
        await loadFailedBrands(searchTerm);
      } else {
        await loadFailedBrands();
      }
      toast.success('Failed queue refreshed successfully');
    } catch (error) {
      console.error('FailedQueue refresh failed:', error);
    }
  }, [searchTerm]);

  const { refreshInterval, isRefreshing: autoRefreshing, setIntervalValue, manualRefresh } = useAutoRefresh(
    refreshFn,
    [searchTerm, currentPage]
  );

  const handleRefresh = async () => {
    await manualRefresh();
    // Toast is now handled in refreshFn
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
    
    // Scroll to the table section when changing pages
    const tableSection = document.getElementById('failed-queue-table-section');
    if (tableSection) {
      tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

  if (adminLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6 xl:space-y-8">

      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Failed Queue</h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-600">
              {originalTotals.total_items || pagination.total_items || 0} brands that failed processing
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="w-full sm:w-auto">
              {!isAdmin && (reenqueuePagination.total_items || 0) > 0 ? (
                <button
                  onClick={onAdminLogin}
                  className="flex items-center justify-center sm:justify-start space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors cursor-pointer w-full sm:w-auto"
                >
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm font-medium">Admin Access Required</span>
                </button>
              ) : isAdmin && (reenqueuePagination.total_items || 0) > 0 ? (
                <div className="flex items-center justify-center sm:justify-start space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-100 text-green-800 rounded-lg w-full sm:w-auto">
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm font-medium">Admin Mode</span>
                </div>
              ) : null}
            </div>
            <div className="w-full sm:w-auto">
              <RefreshControl
                isRefreshing={autoRefreshing}
                refreshInterval={refreshInterval}
                onManualRefresh={handleRefresh}
                onIntervalChange={setIntervalValue}
              />
            </div>
          </div>
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
      <Card id="failed-queue-table-section" className="hidden md:block">
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

      {/* Pagination for Failed Brands Table */}
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

      {/* Reenqueue Data Section - Below Failed Brands Pagination */}
      {reenqueueItems && reenqueueItems.length > 0 && (
        <>
          <Card id="reenqueue-table-section" className="mt-6 mb-4">
            <div className="mb-4">
              {/* Header Section */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                <div className="flex-1">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                    Reenqueue List ({reenqueuePagination.total_items || 0})
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Brands waiting to be requeued for processing
                  </p>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <Button
                    onClick={handleRequeueAll}
                    disabled={!isAdmin}
                    size="sm"
                    variant="primary"
                    className="flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium w-full sm:w-auto"
                    title={!isAdmin ? 'Admin access required' : 'Requeue all brands'}
                  >
                    <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                    Requeue All
                  </Button>
                  <Button
                    onClick={handleDeleteAllClick}
                    disabled={!isAdmin}
                    size="sm"
                    variant="danger"
                    className="flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium w-full sm:w-auto"
                    title={!isAdmin ? 'Admin access required' : 'Delete all brands'}
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    Delete All
                  </Button>
                </div>
              </div>
            </div>
            {reenqueueLoading && reenqueueItems.length === 0 ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading reenqueue data...</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table
                    data={reenqueueItems}
                    columns={reenqueueColumns}
                    emptyMessage="No items in reenqueue list"
                    className="shadow-md rounded-lg"
                  />
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden space-y-3">
                  {reenqueueItems && reenqueueItems.length > 0 ? (
                    reenqueueItems.map((item, index) => {
                      const position = (reenqueueCurrentPage - 1) * reenqueueItemsPerPage + index + 1;
                      const brandName = item.brand_name || 'Unknown Brand';
                      const brandId = item.id || 'N/A';
                      const pageId = item.page_id || 'N/A';
                      const coverage = item.coverage || 'N/A';

                      return (
                        <Card key={`${brandId}-${index}`} className="p-4 relative pb-16">
                          <div className="space-y-3">
                            {/* Header with Brand Name and Position */}
                            <div className="flex items-start justify-between">
                              <div className="flex-1 pr-3">
                                <div className="flex items-center space-x-2 mb-1">
                                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-medium text-red-600">
                                      {position}
                                    </span>
                                  </div>
                                  <h3 className="font-semibold text-gray-900 text-base sm:text-lg leading-tight">
                                    {brandName}
                                  </h3>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md">
                                  <div className="text-sm font-bold">{coverage}</div>
                                  <div className="text-xs text-blue-600">Coverage</div>
                                </div>
                              </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Brand ID:</span>
                                <span className="ml-2 font-medium text-gray-900">{brandId}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Page ID:</span>
                                <span className="ml-2 font-medium text-gray-900">{pageId}</span>
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

                            {/* Action Buttons - Bottom Left */}
                            <div className="absolute bottom-3 left-3 flex items-center gap-2">
                              <Button
                                onClick={() => handleRequeueSingle(item.id)}
                                disabled={!isAdmin}
                                size="sm"
                                variant="success"
                                className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-green-600 transition-colors"
                                title={!isAdmin ? 'Admin access required' : 'Requeue to Pending'}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Requeue
                              </Button>
                              <Button
                                onClick={() => handleDeleteSingle(item.id)}
                                disabled={!isAdmin}
                                size="sm"
                                variant="danger"
                                className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-red-600 transition-colors"
                                title={!isAdmin ? 'Admin access required' : 'Delete from List'}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 sm:py-8">
                      <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
                      <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                        No items in reenqueue list
                      </h3>
                      <p className="text-sm sm:text-base text-gray-500">
                        All brands have been processed or requeued
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* Pagination for Reenqueue Table */}
          {reenqueuePagination.total_pages > 1 && (
            <Pagination
              currentPage={reenqueueCurrentPage}
              totalPages={reenqueuePagination.total_pages || 1}
              onPageChange={(page) => {
                // Immediately update only the reenqueue current page (no re-render of failed queue)
                setReenqueueState(prev => ({ ...prev, currentPage: page }));
                
                // Scroll to the reenqueue table section when changing pages
                const tableSection = document.getElementById('reenqueue-table-section');
                if (tableSection) {
                  tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              totalItems={reenqueuePagination.total_items || 0}
              itemsPerPage={reenqueueItemsPerPage}
              showPageInfo={true}
            />
          )}
        </>
      )}

      {/* Confirmation Dialog for Delete All */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete All Reenqueue Brands</h3>
              <button
                onClick={handleCancelDeleteAll}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                This action will permanently delete all brands from the reenqueue list. This action cannot be undone.
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Type <strong>"confirm"</strong> to proceed:
              </p>
              
              <input
                type="text"
                value={confirmDialog.confirmText}
                onChange={(e) => setConfirmDialog({ ...confirmDialog, confirmText: e.target.value })}
                placeholder="Type 'confirm' here"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={handleCancelDeleteAll}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDeleteAll}
                variant="danger"
                className="flex-1"
                disabled={confirmDialog.confirmText.toLowerCase() !== 'confirm'}
              >
                Delete All
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Requeue All */}
      {requeueConfirmDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Requeue All Brands</h3>
              <button
                onClick={handleCancelRequeueAll}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                This action will requeue all brands from the reenqueue list to the pending queue.
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Type <strong>"confirm"</strong> to proceed:
              </p>
              
              <input
                type="text"
                value={requeueConfirmDialog.confirmText}
                onChange={(e) => setRequeueConfirmDialog({ ...requeueConfirmDialog, confirmText: e.target.value })}
                placeholder="Type 'confirm' here"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={handleCancelRequeueAll}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmRequeueAll}
                variant="primary"
                className="flex-1"
                disabled={requeueConfirmDialog.confirmText.toLowerCase() !== 'confirm'}
              >
                Requeue All
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FailedQueue;