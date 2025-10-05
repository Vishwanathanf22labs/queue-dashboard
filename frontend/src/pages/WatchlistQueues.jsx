import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { Clock, Search, Users, Hash, Tag, XCircle, AlertCircle, ExternalLink, RotateCcw, Trash2, X, Shield } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
import CustomDropdown from '../components/ui/CustomDropdown';
import useAdminStore from '../stores/adminStore';

const WatchlistQueues = () => {
  const { fetchWatchlistPendingBrands, fetchWatchlistFailedBrands, fetchReenqueueData, requeueSingleBrand, requeueAllBrands, deleteReenqueueBrand, deleteAllReenqueueBrands } = useQueueStore();
  const { isAdmin, isLoading: adminLoading } = useAdminStore();
  const currentSearchRef = useRef('');
  const [searchParams, setSearchParams] = useSearchParams();
  const { onAdminLogin } = useAdminLogin();
  
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

  // Separate state for reenqueue data
  const [reenqueueState, setReenqueueState] = useState({
    items: [],
    pagination: {},
    currentPage: parseInt(searchParams.get('reenqueue_page')) || 1,
    itemsPerPage: 10,
    isLoading: false
  });

  // Helper function to get initial confirmation dialog state from localStorage
  const getInitialConfirmDialogState = () => {
    try {
      const isPageRefresh = sessionStorage.getItem('watchlistQueuesPageRefreshed') === 'true';
      const wasPageVisited = sessionStorage.getItem('watchlistQueuesPageVisited') === 'true';
      
      if (isPageRefresh && wasPageVisited) {
        // Don't remove the flag here since it's used by both dialogs
        const saved = localStorage.getItem('watchlistQueues_confirmDialog');
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
      const isPageRefresh = sessionStorage.getItem('watchlistQueuesPageRefreshed') === 'true';
      const wasPageVisited = sessionStorage.getItem('watchlistQueuesPageVisited') === 'true';
      
      if (isPageRefresh && wasPageVisited) {
        // Don't remove the flag here since it's used by both dialogs
        const saved = localStorage.getItem('watchlistQueues_requeueConfirmDialog');
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

  const { searchTerm, currentPage, itemsPerPage, brands, pagination, isSearching } = queueState;
  const { items: reenqueueItems, pagination: reenqueuePagination, currentPage: reenqueueCurrentPage, itemsPerPage: reenqueueItemsPerPage, isLoading: reenqueueLoading } = reenqueueState;

  const updateQueueState = (updates) => {
    setQueueState(prev => ({ ...prev, ...updates }));
  };

  // Handler for requeue single brand (watchlist)
  const handleRequeueSingle = async (itemId) => {
    try {
      await requeueSingleBrand(itemId, 'watchlist');
      toast.success('Brand requeued successfully to watchlist pending queue');
      loadReenqueueData(reenqueueCurrentPage, false); // Reload current page
      loadBrands(); // Reload brands to update counts
    } catch (error) {
      toast.error(`Failed to requeue brand: ${error.message}`);
    }
  };

  // Handler for requeue all brands (watchlist)
  const handleRequeueAll = () => {
    setRequeueConfirmDialog({ show: true, confirmText: '' });
  };

  const handleConfirmRequeueAll = async () => {
    if (requeueConfirmDialog.confirmText.toLowerCase() !== 'confirm') {
      toast.error('Please type "confirm" to proceed');
      return;
    }

    try {
      const result = await requeueAllBrands('watchlist');
      toast.success(`${result.data.count} brands requeued successfully`);
      loadReenqueueData(1, false); // Reset to page 1
      loadBrands(); // Reload brands to update counts
      setRequeueConfirmDialog({ show: false, confirmText: '' });
    } catch (error) {
      toast.error(`Failed to requeue all brands: ${error.message}`);
    }
  };

  const handleCancelRequeueAll = () => {
    setRequeueConfirmDialog({ show: false, confirmText: '' });
  };

  // Handler for delete single brand (watchlist) - no confirmation
  const handleDeleteSingle = async (itemId) => {
    try {
      await deleteReenqueueBrand(itemId, 'watchlist');
      toast.success('Brand deleted successfully from reenqueue list');
      loadReenqueueData(reenqueueCurrentPage, false); // Reload current page
    } catch (error) {
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

    try {
      const result = await deleteAllReenqueueBrands('watchlist');
      toast.success(`${result.data.count} brands deleted successfully`);
      setConfirmDialog({ show: false, confirmText: '' });
      loadReenqueueData(1, false); // Reset to page 1
    } catch (error) {
      toast.error(`Failed to delete all brands: ${error.message}`);
    }
  };

  const handleCancelDeleteAll = () => {
    setConfirmDialog({ show: false, confirmText: '' });
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

  // Reenqueue table columns: Position → Brand Name → Brand ID → Page ID → Coverage
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
            title={!isAdmin ? 'Admin access required' : 'Requeue to Watchlist Pending'}
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

  const loadReenqueueData = useCallback(async (page = 1, showLoading = false) => {
    try {
      // Only show loading spinner on initial load, not on page changes
      if (showLoading) {
        setReenqueueState(prev => ({ ...prev, isLoading: true }));
      }
      
      // Always use the page parameter passed in
      const response = await fetchReenqueueData(page, 10, null, 'watchlist');
      
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
    
    // Scroll to the table section when changing pages
    const tableSection = document.getElementById('watchlist-queues-table-section');
    if (tableSection) {
      tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Auto-refresh hook
  const refreshFn = useCallback(async () => {
    try {
      if (activeTab === 'pending') {
        await loadBrands(null, currentPage);
      } else {
        await Promise.all([
          loadBrands(null, currentPage),
          loadReenqueueData(reenqueueCurrentPage, false)
        ]);
      }
      toast.success('Watchlist queues refreshed successfully');
    } catch (error) {
      console.error('WatchlistQueues refresh failed:', error);
    }
  }, [activeTab, currentPage, reenqueueCurrentPage, loadBrands, loadReenqueueData]);

  const { refreshInterval, isRefreshing, setIntervalValue, manualRefresh } = useAutoRefresh(
    refreshFn,
    [activeTab, currentPage, reenqueueCurrentPage]
  );

  const handleRefresh = async () => {
    updateQueueState({ currentPage: 1, searchTerm: '' });
    
    // Update URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.set('page', '1');
    newParams.set('tab', activeTab); // Preserve active tab
    setSearchParams(newParams);
    
    await manualRefresh();
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

  // Load reenqueue data when on failed tab
  // Handle reenqueue data loading - combined logic to prevent duplicate calls
  useEffect(() => {
    if (activeTab === 'failed') {
      const initialReenqueuePage = parseInt(searchParams.get('reenqueue_page')) || 1;
      loadReenqueueData(initialReenqueuePage, true); // Show loading on initial tab load
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    // Skip if not on failed tab
    if (activeTab !== 'failed') {
      return;
    }

    // Load reenqueue data when page changes (but not on initial tab load)
    const initialReenqueuePage = parseInt(searchParams.get('reenqueue_page')) || 1;
    if (reenqueueCurrentPage !== initialReenqueuePage) {
      loadReenqueueData(reenqueueCurrentPage, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reenqueueCurrentPage]);

  // Detect page refresh and set flag, then restore dialog states
  useEffect(() => {
    const isInitialLoad = !sessionStorage.getItem('watchlistQueuesPageVisited');
    
    if (!isInitialLoad) {
      // This is a page refresh, set the flag
      sessionStorage.setItem('watchlistQueuesPageRefreshed', 'true');
      
      // Restore dialog states from localStorage
      try {
        const savedConfirmDialog = localStorage.getItem('watchlistQueues_confirmDialog');
        if (savedConfirmDialog) {
          const parsed = JSON.parse(savedConfirmDialog);
          setConfirmDialog({
            show: parsed.show || false,
            confirmText: parsed.confirmText || ''
          });
        }
        
        const savedRequeueDialog = localStorage.getItem('watchlistQueues_requeueConfirmDialog');
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
      sessionStorage.setItem('watchlistQueuesPageVisited', 'true');
    }

    // Cleanup function to clear the visited flag when navigating away
    return () => {
      sessionStorage.removeItem('watchlistQueuesPageVisited');
    };
  }, []);

  // Save confirmation dialog state to localStorage whenever it changes
  useEffect(() => {
    if (confirmDialog.show) {
      localStorage.setItem('watchlistQueues_confirmDialog', JSON.stringify(confirmDialog));
    } else {
      localStorage.removeItem('watchlistQueues_confirmDialog');
    }
  }, [confirmDialog]);

  // Save requeue confirmation dialog state to localStorage whenever it changes
  useEffect(() => {
    if (requeueConfirmDialog.show) {
      localStorage.setItem('watchlistQueues_requeueConfirmDialog', JSON.stringify(requeueConfirmDialog));
    } else {
      localStorage.removeItem('watchlistQueues_requeueConfirmDialog');
    }
  }, [requeueConfirmDialog]);


  const currentColumns = activeTab === 'pending' ? pendingColumns : failedColumns;
  const tabIcon = activeTab === 'pending' ? Clock : XCircle;
  const tabColor = activeTab === 'pending' ? 'purple' : 'orange';
  const tabTitle = activeTab === 'pending' ? 'Watchlist Pending Queue' : 'Watchlist Failed Queue';
  const tabDescription = activeTab === 'pending' 
    ? 'Manage brands waiting in the watchlist pending queue' 
    : 'Manage brands that failed in the watchlist processing';

  if (adminLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Watchlist Queues</h1>
          <p className="text-sm text-gray-600">Manage watchlist pending and failed brands</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {activeTab === 'failed' && !isAdmin && (reenqueuePagination.total_items || 0) > 0 ? (
            <button
              onClick={onAdminLogin}
              className="flex items-center space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors cursor-pointer"
            >
              <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm font-medium">Admin Access Required</span>
            </button>
          ) : activeTab === 'failed' && isAdmin && (reenqueuePagination.total_items || 0) > 0 ? (
            <div className="flex items-center space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-100 text-green-800 rounded-lg">
              <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm font-medium">Admin Mode</span>
            </div>
          ) : null}
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
          
          <div className="flex items-center gap-3">
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
            
            <RefreshControl
              isRefreshing={isRefreshing}
              refreshInterval={refreshInterval}
              onManualRefresh={handleRefresh}
              onIntervalChange={setIntervalValue}
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
       <Card id="watchlist-queues-table-section" className="hidden md:block">
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

       {/* Pagination for Brands Table */}
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

       {/* Reenqueue Data Section - Below Brands Pagination (Only in Failed Tab) */}
       {activeTab === 'failed' && reenqueueItems && reenqueueItems.length > 0 && (
         <>
           <Card id="reenqueue-table-section" className="mt-6 mb-4">
             <div className="mb-4 flex items-center justify-between">
               <div>
                 <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                   <AlertCircle className="h-5 w-5 text-orange-600" />
                   Reenqueue List ({reenqueuePagination.total_items || 0})
                 </h2>
                 <p className="text-sm text-gray-600 mt-1">
                   Brands waiting to be requeued for processing
                 </p>
               </div>
               <div className="flex items-center gap-3">
                 <Button
                   onClick={handleRequeueAll}
                   disabled={!isAdmin}
                   size="md"
                   variant="primary"
                   className="flex items-center gap-2 px-4 py-2 font-medium"
                   title={!isAdmin ? 'Admin access required' : 'Requeue all brands'}
                 >
                   <RotateCcw className="h-4 w-4" />
                   Requeue All
                 </Button>
                 <Button
                   onClick={handleDeleteAllClick}
                   disabled={!isAdmin}
                   size="md"
                   variant="danger"
                   className="flex items-center gap-2 px-4 py-2 font-medium"
                   title={!isAdmin ? 'Admin access required' : 'Delete all brands'}
                 >
                   <Trash2 className="h-4 w-4" />
                   Delete All
                 </Button>
               </div>
             </div>
             {reenqueueLoading && reenqueueItems.length === 0 ? (
               <div className="text-center py-8">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                 <p className="text-sm text-gray-500 mt-2">Loading reenqueue data...</p>
               </div>
             ) : (
               <Table
                 data={reenqueueItems}
                 columns={reenqueueColumns}
                 emptyMessage="No items in reenqueue list"
                 className="shadow-md rounded-lg"
               />
             )}
           </Card>

           {/* Pagination for Reenqueue Table */}
           {reenqueuePagination.total_pages > 1 && (
             <Pagination
               currentPage={reenqueueCurrentPage}
               totalPages={reenqueuePagination.total_pages || 1}
               onPageChange={(page) => {
                 // Update reenqueue current page
                 setReenqueueState(prev => ({ ...prev, currentPage: page }));
                 
                 // Update URL parameter
                 const newParams = new URLSearchParams(searchParams);
                 newParams.set('reenqueue_page', page.toString());
                 if (searchParams.get('tab')) {
                   newParams.set('tab', searchParams.get('tab'));
                 }
                 setSearchParams(newParams, { replace: true });
                 
                 // Scroll to the table section when changing pages
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
                 This action will permanently delete all brands from the watchlist reenqueue list. This action cannot be undone.
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
                 This action will requeue all brands from the reenqueue list to the watchlist pending queue.
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

export default WatchlistQueues;
