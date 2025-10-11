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

  const [originalTotals, setOriginalTotals] = useState({
    total_items: 0,
    total_pages: 0
  });

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'pending');
  const [queueState, setQueueState] = useState({
    searchTerm: searchParams.get('search') || '',
    currentPage: parseInt(searchParams.get('page')) || 1,
    itemsPerPage: parseInt(searchParams.get('limit')) || 10,
    brands: [],
    pagination: {},
    isSearching: false
  });

  const [reenqueueState, setReenqueueState] = useState({
    items: [],
    pagination: {},
    currentPage: parseInt(searchParams.get('reenqueue_page')) || 1,
    itemsPerPage: 10,
    isLoading: false
  });

  const getInitialConfirmDialogState = () => {
    try {
      const isPageRefresh = sessionStorage.getItem('watchlistQueuesPageRefreshed') === 'true';
      const wasPageVisited = sessionStorage.getItem('watchlistQueuesPageVisited') === 'true';

      if (isPageRefresh && wasPageVisited) {
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

  const getInitialRequeueConfirmDialogState = () => {
    try {
      const isPageRefresh = sessionStorage.getItem('watchlistQueuesPageRefreshed') === 'true';
      const wasPageVisited = sessionStorage.getItem('watchlistQueuesPageVisited') === 'true';

      if (isPageRefresh && wasPageVisited) {
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

  const [confirmDialog, setConfirmDialog] = useState({ show: false, confirmText: '' });

  const [requeueConfirmDialog, setRequeueConfirmDialog] = useState({ show: false, confirmText: '' });

  const { searchTerm, currentPage, itemsPerPage, brands, pagination, isSearching } = queueState;
  const { items: reenqueueItems, pagination: reenqueuePagination, currentPage: reenqueueCurrentPage, itemsPerPage: reenqueueItemsPerPage, isLoading: reenqueueLoading } = reenqueueState;

  const updateQueueState = (updates) => {
    setQueueState(prev => ({ ...prev, ...updates }));
  };

  const handleRequeueSingle = async (itemId) => {
    try {
      await requeueSingleBrand(itemId, 'watchlist');
      toast.success('Brand requeued successfully to watchlist pending queue');
      loadReenqueueData(reenqueueCurrentPage, false);
      loadBrands();
    } catch (error) {
      toast.error(`Failed to requeue brand: ${error.message}`);
    }
  };

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
      loadReenqueueData(1, false);
      loadBrands();
      setRequeueConfirmDialog({ show: false, confirmText: '' });
    } catch (error) {
      toast.error(`Failed to requeue all brands: ${error.message}`);
    }
  };

  const handleCancelRequeueAll = () => {
    setRequeueConfirmDialog({ show: false, confirmText: '' });
  };

  const handleDeleteSingle = async (itemId) => {
    try {
      await deleteReenqueueBrand(itemId, 'watchlist');
      toast.success('Brand deleted successfully from reenqueue list');
      loadReenqueueData(reenqueueCurrentPage, false);
    } catch (error) {
      toast.error(`Failed to delete brand: ${error.message}`);
    }
  };

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
      loadReenqueueData(1, false);
    } catch (error) {
      toast.error(`Failed to delete all brands: ${error.message}`);
    }
  };

  const handleCancelDeleteAll = () => {
    setConfirmDialog({ show: false, confirmText: '' });
  };

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
        const score = row.score || 'N/A';
        return (
          <div className="flex items-center">
            <Users className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
            <div className="flex items-center space-x-2 flex-1">
              <div className="text-xs font-medium text-gray-900 max-w-[80px] sm:max-w-none truncate">
                <span title={`Score: ${score}`}>
                  {brandName}
                  {score !== 'N/A' && (
                    <span className="text-blue-600 font-bold ml-1 text-base">({score})</span>
                  )}
                </span>
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
        const score = row.score || 'N/A';
        return (
          <div className="flex items-center">
            <Users className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
            <div className="flex items-center space-x-2 flex-1">
              <div className="text-xs font-medium text-gray-900 max-w-[80px] sm:max-w-none truncate">
                <span title={`Score: ${score}`}>
                  {brandName}
                  {score !== 'N/A' && (
                    <span className="text-blue-600 font-bold ml-1 text-base">({score})</span>
                  )}
                </span>
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
        const score = row.score || 'N/A';
        return (
          <div className="flex items-center">
            <Users className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
            <div className="flex items-center space-x-2 flex-1">
              <div className="text-xs font-medium text-gray-900 max-w-[80px] sm:max-w-none truncate">
                <span title={`Score: ${score}`}>
                  {brandName}
                  {score !== 'N/A' && (
                    <span className="text-blue-600 font-bold ml-1 text-base">({score})</span>
                  )}
                </span>
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

        let importantPart = errorMessage;

        if (errorMessage.includes(':')) {
          const parts = errorMessage.split(':');
          importantPart = parts[parts.length - 1].trim();
        }

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
      if (showLoading) {
        setReenqueueState(prev => ({ ...prev, isLoading: true }));
      }

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

      const currentSearch = currentSearchRef.current;
      const searchToCheck = searchTerm || '';

      let response;
      if (activeTab === 'pending') {
        response = await fetchWatchlistPendingBrands(pageToLoad, itemsPerPage, searchTerm);
      } else {
        response = await fetchWatchlistFailedBrands(pageToLoad, itemsPerPage, searchTerm);
      }

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
  }, [activeTab, itemsPerPage]);

  const handleSearch = (searchTerm) => {
    updateQueueState({ searchTerm });

    const newParams = new URLSearchParams(searchParams);
    if (searchTerm && searchTerm.trim()) {
      newParams.set('search', searchTerm);
      newParams.set('page', '1');
    } else {
      newParams.delete('search');
      newParams.set('page', '1');
    }
    newParams.set('tab', activeTab);
    setSearchParams(newParams);

    if (!searchTerm || searchTerm.trim() === '') {
      updateQueueState({ currentPage: 1 });
    }
  };

  const clearSearch = () => {
    currentSearchRef.current = '';
    updateQueueState({ searchTerm: '', currentPage: 1 });

    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.set('page', '1');
    newParams.set('tab', activeTab);
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage) => {
    updateQueueState({ currentPage: newPage });

    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    newParams.set('tab', activeTab);
    setSearchParams(newParams);

    const tableSection = document.getElementById('watchlist-queues-table-section');
    if (tableSection) {
      tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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

    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.set('page', '1');
    newParams.set('tab', activeTab);
    setSearchParams(newParams);

    await manualRefresh();
  };

  const handleItemsPerPageChange = async (newItemsPerPage) => {
    updateQueueState({
      itemsPerPage: newItemsPerPage,
      currentPage: 1
    });

    const newParams = new URLSearchParams(searchParams);
    newParams.set('limit', newItemsPerPage.toString());
    newParams.set('page', '1');
    newParams.set('tab', activeTab);
    setSearchParams(newParams);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    updateQueueState({ currentPage: 1, searchTerm: '' });

    const newParams = new URLSearchParams();
    newParams.set('tab', tab);
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  useEffect(() => {
    if (searchTerm && searchTerm.trim() !== '') {
      const timeoutId = setTimeout(() => {
        if (searchTerm.trim().length >= 3) {
          currentSearchRef.current = searchTerm;
          loadBrands(searchTerm);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      currentSearchRef.current = '';
      loadBrands(null, currentPage);
    }
  }, [currentPage, itemsPerPage, activeTab, searchTerm]);

  useEffect(() => {
    if (activeTab === 'failed') {
      const initialReenqueuePage = parseInt(searchParams.get('reenqueue_page')) || 1;
      loadReenqueueData(initialReenqueuePage, true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'failed') {
      return;
    }

    const initialReenqueuePage = parseInt(searchParams.get('reenqueue_page')) || 1;
    if (reenqueueCurrentPage !== initialReenqueuePage) {
      loadReenqueueData(reenqueueCurrentPage, false);
    }
  }, [reenqueueCurrentPage]);

  useEffect(() => {
    const isInitialLoad = !sessionStorage.getItem('watchlistQueuesPageVisited');

    if (!isInitialLoad) {
      sessionStorage.setItem('watchlistQueuesPageRefreshed', 'true');

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
      sessionStorage.setItem('watchlistQueuesPageVisited', 'true');
    }

    return () => {
      sessionStorage.removeItem('watchlistQueuesPageVisited');
    };
  }, []);

  useEffect(() => {
    if (confirmDialog.show) {
      localStorage.setItem('watchlistQueues_confirmDialog', JSON.stringify(confirmDialog));
    } else {
      localStorage.removeItem('watchlistQueues_confirmDialog');
    }
  }, [confirmDialog]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Watchlist Queues</h1>
          <p className="text-sm text-gray-600">Manage watchlist pending and failed brands</p>
        </div>

        <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-3">
          {activeTab === 'failed' && (
            <>
              {isAdmin ? (
                <div className="flex items-center justify-center space-x-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm font-medium">Admin Mode</span>
                </div>
              ) : (
                <button
                  onClick={onAdminLogin}
                  className="flex items-center justify-center space-x-2 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors cursor-pointer"
                >
                  <Shield className="h-4 w-4" />
                  <span className="text-sm font-medium">Admin Access Required</span>
                </button>
              )}
            </>
          )}

          <RefreshControl
            isRefreshing={isRefreshing}
            refreshInterval={refreshInterval}
            onManualRefresh={handleRefresh}
            onIntervalChange={setIntervalValue}
          />
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex space-x-3">
            <button
              onClick={() => handleTabChange('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'pending'
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              Pending Queue
            </button>
            <button
              onClick={() => handleTabChange('failed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'failed'
                  ? 'bg-orange-100 text-orange-700 border border-orange-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              Failed Queue
            </button>
          </div>

        </div>
      </Card>

      <div className="flex items-center gap-3">
        <div className={`p-2 bg-${tabColor}-100 rounded-lg`}>
          {React.createElement(tabIcon, { className: `h-6 w-6 text-${tabColor}-600` })}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{tabTitle}</h2>
          <p className="text-sm text-gray-600">{tabDescription}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`rounded-lg p-3 text-center ${activeTab === 'pending' ? 'bg-purple-100' : 'bg-red-100'}`}>
          <div className="text-sm font-medium text-gray-700 mb-1">
            Total {activeTab === 'pending' ? 'Pending' : 'Failed'} Brands
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
            const score = brand.score || 'N/A';
            const isPending = activeTab === 'pending';

            return (
              <Card key={`${brandId}-${index}`} className="p-4 relative pb-12">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 ${isPending ? 'bg-purple-100' : 'bg-red-100'} rounded-full flex items-center justify-center`}>
                        <span className={`text-sm font-medium ${isPending ? 'text-purple-600' : 'text-red-600'}`}>
                          {position}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 text-lg" title={`Score: ${score}`}>
                        {brandName}
                        {score !== 'N/A' && (
                          <span className="text-blue-600 font-bold ml-1 text-xl">({score})</span>
                        )}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={isPending ? "info" : "error"}>
                        {isPending ? 'Watchlist Pending' : 'Failed'}
                      </Badge>
                    </div>
                  </div>

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

                  {!isPending && (
                    <div className="pt-2">
                      <span className="text-gray-500 text-sm">Error:</span>
                      <p className="text-sm text-red-600 mt-1 break-words font-medium" title={brand.error_message || 'Unknown error'}>
                        {(() => {
                          const errorMessage = brand.error_message || 'Unknown error';
                          let importantPart = errorMessage;

                          if (errorMessage.includes(':')) {
                            const parts = errorMessage.split(':');
                            importantPart = parts[parts.length - 1].trim();
                          }

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

      {activeTab === 'failed' && reenqueueItems && reenqueueItems.length > 0 && (
        <>
          <Card id="reenqueue-table-section" className="mt-6 mb-4">
            <div className="mb-4">
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
                <div className="hidden md:block">
                  <Table
                    data={reenqueueItems}
                    columns={reenqueueColumns}
                    emptyMessage="No items in reenqueue list"
                    className="shadow-md rounded-lg"
                  />
                </div>

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
                            <div className="flex items-start justify-between">
                              <div className="flex-1 pr-3">
                                <div className="flex items-center space-x-2 mb-1">
                                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-medium text-purple-600">
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

                            <div className="absolute bottom-3 left-3 flex items-center gap-2">
                              <Button
                                onClick={() => handleRequeueSingle(item.id)}
                                disabled={!isAdmin}
                                size="sm"
                                variant="success"
                                className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-green-600 transition-colors"
                                title={!isAdmin ? 'Admin access required' : 'Requeue to Watchlist Pending'}
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
                        All watchlist brands have been processed or requeued
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>

          {reenqueuePagination.total_pages > 1 && (
            <Pagination
              currentPage={reenqueueCurrentPage}
              totalPages={reenqueuePagination.total_pages || 1}
              onPageChange={(page) => {
                setReenqueueState(prev => ({ ...prev, currentPage: page }));

                const newParams = new URLSearchParams(searchParams);
                newParams.set('reenqueue_page', page.toString());
                if (searchParams.get('tab')) {
                  newParams.set('tab', searchParams.get('tab'));
                }
                setSearchParams(newParams, { replace: true });

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
