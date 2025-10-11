import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { proxyAPI } from '../services/api';
import ProxyManager from '../components/proxy/ProxyManager';
import ProxyList from '../components/proxy/ProxyList';
import ProxyStats from '../components/proxy/ProxyStats';
import SearchInput from '../components/ui/SearchInput';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Pagination from '../components/ui/Pagination';
import RefreshControl from '../components/ui/RefreshControl';
import { useAdminLogin } from '../contexts/AdminLoginContext';
import toast from 'react-hot-toast';
import useAdminStore from '../stores/adminStore';
import useAutoRefresh from '../hooks/useAutoRefresh';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Search, Shield } from 'lucide-react';
import CustomDropdown from '../components/ui/CustomDropdown';

const Proxies = () => {
  const { isAdmin, isLoading: adminLoading } = useAdminStore();
  const { onAdminLogin } = useAdminLogin();
  const [searchParams, setSearchParams] = useSearchParams();

  const isInitialMountRef = useRef(true);
  const prevParamsRef = useRef({ page: null, search: null, filter: null });

  const [dataState, setDataState] = useState({
    proxies: [],
    stats: null,
    managementStats: null,
    totalPages: 1,
    totalItems: 0,
    isSearching: false
  });

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1);
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);


  const updateDataState = useCallback((updates) => {
    setDataState(prev => ({ ...prev, ...updates }));
  }, []);


  const loadProxies = useCallback(async (page = 1, filterType = 'all', search = null, showLoading = true) => {
    try {
      if (search && search.trim()) {
        setDataState(prev => ({ ...prev, isSearching: true }));
      } else if (showLoading) {
        setIsLoading(true);
      }

      const response = await proxyAPI.getProxies(page, 10, filterType, search || '');

      if (response.data.success) {
        const proxies = response.data.data.proxies || [];
        const totalPages = response.data.data.pagination?.pages || 1;
        const currentPage = response.data.data.pagination?.page || 1;
        const totalItems = response.data.data.pagination?.total || 0;

        setDataState(prev => ({
          ...prev,
          proxies,
          totalPages,
          totalItems,
          isSearching: false
        }));

        if (search && search.trim() && proxies.length === 0) {
          toast(`No proxies found for "${search}"`, {
            icon: 'ℹ',
            duration: 3000,
          });
        }
      } else {
        toast.error(response.data.message || 'Failed to load proxies');
        setDataState(prev => ({ ...prev, isSearching: false }));
      }
    } catch (error) {
      console.error('Error loading proxies:', error);
      toast.error('Error loading proxies');
      setDataState(prev => ({ ...prev, isSearching: false }));
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);


  const loadStats = useCallback(async () => {
    try {
      const response = await proxyAPI.getProxyStats();
      if (response.data.success) {
        updateDataState({ stats: response.data.data });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [updateDataState]);

  const loadManagementStats = useCallback(async () => {
    try {
      const response = await proxyAPI.getProxyManagementStats();
      if (response.data.success) {
        updateDataState({ managementStats: response.data.data });
      }
    } catch (error) {
      console.error('Error loading management stats:', error);
    }
  }, [updateDataState]);

  useEffect(() => {
    const urlPage = parseInt(searchParams.get('page')) || 1;
    const urlSearch = searchParams.get('search') || '';
    const urlFilter = searchParams.get('filter') || 'all';

    setCurrentPage(urlPage);
    setSearchTerm(urlSearch);
    setFilter(urlFilter);

    prevParamsRef.current = { page: urlPage, search: urlSearch, filter: urlFilter };

    if (isInitialMountRef.current) {
      loadProxies(urlPage, urlFilter, urlSearch || null, true);
      loadStats();
      loadManagementStats();
      isInitialMountRef.current = false;
    } else {
      loadProxies(urlPage, urlFilter, urlSearch || null, false);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterDropdown && !event.target.closest('.filter-dropdown')) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterDropdown]);




  const handleProxyRemoved = useCallback(async (proxyId) => {
    setDataState(prev => ({
      ...prev,
      proxies: prev.proxies.filter(proxy => proxy._id !== proxyId),
      totalItems: prev.totalItems - 1
    }));

    setTimeout(async () => {
      await Promise.all([
        loadStats(),
        loadManagementStats(),
        loadProxies(currentPage, filter, searchTerm, false)
      ]);
    }, 100);
  }, [loadStats, loadManagementStats, currentPage, filter, searchTerm, loadProxies]);


  const handleProxyUpdated = useCallback(async (proxyId, updates) => {

    setDataState(prev => ({
      ...prev,
      proxies: prev.proxies.map(proxy =>
        proxy._id === proxyId ? { ...proxy, ...updates } : proxy
      )
    }));

    setTimeout(async () => {
      await Promise.all([
        loadStats(),
        loadManagementStats(),
        loadProxies(currentPage, filter, searchTerm, false)
      ]);
    }, 100);
  }, [loadStats, loadManagementStats, currentPage, filter, searchTerm, loadProxies]);


  const handleProxyAdded = useCallback(async (newProxy) => {
    await Promise.all([
      loadStats(),
      loadManagementStats(),
      loadProxies(currentPage, filter, searchTerm, false)
    ]);
  }, [loadStats, loadManagementStats, currentPage, filter, searchTerm, loadProxies]);

  const handleSearch = useCallback((searchValue) => {
    const newParams = new URLSearchParams(searchParams);
    if (searchValue && searchValue.trim()) {
      newParams.set('search', searchValue);
      newParams.set('page', '1');
    } else {
      newParams.delete('search');
      newParams.set('page', '1');
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearSearch = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleFilterChange = useCallback((newFilter) => {
    setShowFilterDropdown(false);

    const newParams = new URLSearchParams(searchParams);
    newParams.set('filter', newFilter);
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);


  const handlePageChange = useCallback((page) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const refreshFn = useCallback(async () => {
    try {
      await Promise.all([
        loadStats(),
        loadManagementStats(),
        loadProxies(currentPage, filter, searchTerm, false)
      ]);
      toast.success('Proxies refreshed successfully');
    } catch (error) {
      console.error('Proxies refresh failed:', error);
    }
  }, [loadStats, loadManagementStats, loadProxies, currentPage, filter, searchTerm]);

  const { refreshInterval, isRefreshing, setIntervalValue, manualRefresh } = useAutoRefresh(
    refreshFn,
    [currentPage, filter, searchTerm]
  );

  const handleRefresh = async () => {
    await manualRefresh();
  };





  if (adminLoading) {
    return <LoadingSpinner />;
  }



  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Proxy Management</h1>
              <p className="mt-2 text-xs sm:text-sm lg:text-base text-gray-600">
                Manage your proxy configurations, monitor health, and control proxy rotation
              </p>
            </div>

            <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:gap-3">
              {isAdmin ? (
                <div className="flex items-center space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-100 text-green-800 rounded-lg">
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm font-medium">Admin Mode</span>
                </div>
              ) : (
                <button
                  onClick={onAdminLogin}
                  className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Admin Access Required
                </button>
              )}

              <RefreshControl
                isRefreshing={isRefreshing}
                refreshInterval={refreshInterval}
                onManualRefresh={handleRefresh}
                onIntervalChange={setIntervalValue}
              />
            </div>
          </div>
        </div>


        <ProxyStats stats={dataState.stats} managementStats={dataState.managementStats} />


        <Card className="mb-4 sm:mb-6">
          <div className="space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="w-full">
                <SearchInput
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Search proxies by IP, port, country, username, or type..."
                  leftIcon={<Search className="h-4 w-4 text-gray-400" />}
                  size="md"
                  variant="default"
                  showClearButton={true}
                  onClear={clearSearch}
                  disabled={isLoading}
                />
              </div>


              <CustomDropdown
                options={[
                  { value: 'all', label: 'All Proxies' },
                  { value: 'working', label: 'Working Only' },
                  { value: 'failed', label: 'Failed Only' },
                  { value: 'last_month', label: 'Last Month' }
                ]}
                value={filter}
                onChange={handleFilterChange}
                placeholder="Select filter"
                className="w-full"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 sm:space-x-4 text-sm text-gray-600">
              <div className="flex items-center justify-between sm:justify-start">
                <span className="font-medium">Total: {dataState.totalItems}</span>
              </div>
              {searchTerm && (
                <div className="text-blue-600 text-center sm:text-left">
                  {dataState.isSearching ? (
                    <span className="flex items-center justify-center sm:justify-start">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                      Searching: "{searchTerm}"
                    </span>
                  ) : (
                    `Searching: "${searchTerm}"`
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>


        <div className="mb-6">
          <ProxyManager
            onProxyAdded={handleProxyAdded}
            onRefreshProxies={() => loadProxies(currentPage, filter, searchTerm)}
            disabled={!isAdmin}
          />
        </div>


        <div className="mb-6">
          <ProxyList
            proxies={dataState.proxies}
            onProxyRemoved={handleProxyRemoved}
            onProxyUpdated={handleProxyUpdated}
            disabled={!isAdmin}
          />
        </div>

        {dataState.totalPages > 1 && (
          <Card>
            <Pagination
              currentPage={currentPage}
              totalPages={dataState.totalPages}
              onPageChange={handlePageChange}
              totalItems={dataState.totalItems}
              itemsPerPage={10}
              showPageInfo={true}
            />
          </Card>
        )}
      </div>

    </div>
  );
};

export default Proxies;