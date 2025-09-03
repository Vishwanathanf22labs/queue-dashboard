import { useState, useEffect, useCallback } from 'react';
import { proxyAPI } from '../services/api';
import ProxyManager from '../components/proxy/ProxyManager';
import ProxyList from '../components/proxy/ProxyList';
import ProxyStats from '../components/proxy/ProxyStats';
import SearchInput from '../components/ui/SearchInput';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import toast from 'react-hot-toast';
import useAdminStore from '../stores/adminStore';
import AdminAccessRequired from '../components/ui/AdminAccessRequired';
import { Search } from 'lucide-react';
import CustomDropdown from '../components/ui/CustomDropdown';

const Proxies = () => {
  const { isAdmin, isLoading: adminLoading } = useAdminStore();
  const [dataState, setDataState] = useState({
    proxies: [],
    stats: null,
    managementStats: null, // ✅ NEW: Added management stats
    currentPage: 1,
    totalPages: 1,
    filter: 'all'
  });


  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);


  const updateDataState = useCallback((updates) => {
    setDataState(prev => ({ ...prev, ...updates }));
  }, []);

  const loadProxies = useCallback(async (page = 1, filterType = 'all', search = '') => {
    try {
      console.log('Loading proxies with:', { page, filterType, search });
      const response = await proxyAPI.getProxies(page, 10, filterType, search);

      if (response.data.success) {
        const proxies = response.data.data.proxies || [];
        const totalPages = response.data.data.pagination?.pages || 1;
        const currentPage = response.data.data.pagination?.page || 1;

        console.log('Proxies loaded successfully:', { 
          count: proxies.length, 
          totalPages, 
          currentPage,
          filter: response.data.data.filter,
          search: response.data.data.search
        });

        updateDataState({
          proxies,
          totalPages,
          currentPage
        });

        if (search && search.trim() && proxies.length === 0) {
          toast.info(`No proxies found matching "${search}"`);
        }
      } else {
        console.error('Failed to load proxies:', response.data);
        toast.error(response.data.message || 'Failed to load proxies');
      }
    } catch (error) {
      console.error('Error loading proxies:', error);
      toast.error('Error loading proxies');
    }
  }, []);


  const loadStats = useCallback(async () => {
    try {
      const response = await proxyAPI.getProxyStats();
      if (response.data.success) {
        updateDataState({ stats: response.data.data });
        console.log('Stats loaded successfully:', response.data.data);
      } else {
        console.error('Failed to load stats:', response.data);
        toast.error('Failed to load proxy statistics');
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('Error loading proxy statistics');
    }
  }, []);

  const loadManagementStats = useCallback(async () => {
    try {
      const response = await proxyAPI.getProxyManagementStats();
      if (response.data.success) {
        updateDataState({ managementStats: response.data.data });
        console.log('Management stats loaded successfully:', response.data.data);
      } else {
        console.error('Failed to load management stats:', response.data);
        toast.error('Failed to load proxy management statistics');
      }
    } catch (error) {
      console.error('Error loading management stats:', error);
      toast.error('Error loading proxy management statistics');
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const initializeData = async () => {
      setIsLoading(true);
      await Promise.all([
        loadProxies(),
        loadStats(),
        loadManagementStats() // ✅ NEW: Load management stats
      ]);
      setIsLoading(false);
    };

    initializeData();
  }, [loadProxies, loadStats, loadManagementStats, isAdmin]);


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


  const handleProxyAdded = useCallback((newProxy) => {
    updateDataState(prev => ({
      ...prev,
      proxies: [newProxy, ...prev.proxies]
    }));
    loadStats();
    loadManagementStats(); // ✅ NEW: Reload management stats
    loadProxies(dataState.currentPage, dataState.filter, searchTerm);
  }, [loadStats, loadManagementStats, dataState.currentPage, dataState.filter, searchTerm, loadProxies, updateDataState]);


  const handleProxyRemoved = useCallback((proxyId) => {
    updateDataState(prev => ({
      ...prev,
      proxies: prev.proxies.filter(proxy => proxy.id !== proxyId)
    }));
    loadStats();
    loadManagementStats(); // ✅ NEW: Reload management stats
    loadProxies(dataState.currentPage, dataState.filter, searchTerm);
  }, [loadStats, loadManagementStats, dataState.currentPage, dataState.filter, searchTerm, loadProxies, updateDataState]);


  const handleProxyUpdated = useCallback((proxyId, updates) => {
    updateDataState(prev => ({
      ...prev,
      proxies: prev.proxies.map(proxy =>
        proxy.id === proxyId ? { ...proxy, ...updates } : proxy
      )
    }));
    loadStats();
    loadManagementStats(); // ✅ NEW: Reload management stats
    loadProxies(dataState.currentPage, dataState.filter, searchTerm);
  }, [loadStats, loadManagementStats, dataState.currentPage, dataState.filter, searchTerm, loadProxies, updateDataState]);

  const handleSearch = useCallback(async (value) => {
    console.log('Search changed to:', value);
    setSearchTerm(value);

    if (!value.trim()) {
      loadProxies(1, dataState.filter, '');
      return;
    }

    setIsSearching(true);
    try {
      await loadProxies(1, dataState.filter, value);
    } finally {
      setIsSearching(false);
    }
  }, [dataState.filter, loadProxies]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    loadProxies(1, dataState.filter, '');
  }, [dataState.filter, loadProxies]);

  const handleFilterChange = useCallback((newFilter) => {
    console.log('Filter changed to:', newFilter);
    updateDataState({
      filter: newFilter,
      currentPage: 1
    });
    setShowFilterDropdown(false);
    loadProxies(1, newFilter, searchTerm);
  }, [searchTerm, loadProxies, updateDataState]);


  const handlePageChange = useCallback((page) => {
    updateDataState({ currentPage: page });
    loadProxies(page, dataState.filter, searchTerm);
  }, [dataState.filter, searchTerm, loadProxies, updateDataState]);





  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }


  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AdminAccessRequired
            title="Admin Access Required"
            description="This page requires administrator privileges. Please log in with your admin credentials to access proxy management features."
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading proxies...</p>
          <p className="text-sm text-gray-400 mt-2">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Proxy Management</h1>
          <p className="mt-2 text-gray-600">
            Manage your proxy configurations, monitor health, and control proxy rotation
          </p>
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
                value={dataState.filter}
                onChange={handleFilterChange}
                placeholder="Select filter"
                className="w-full"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 sm:space-x-4 text-sm text-gray-600">
              <div className="flex items-center justify-between sm:justify-start">
                <span className="font-medium">Total: {dataState.proxies.length}</span>
              </div>
              {searchTerm && (
                <div className="text-blue-600 text-center sm:text-left">
                  {isSearching ? (
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
            onRefreshProxies={() => loadProxies(dataState.currentPage, dataState.filter, searchTerm)}
          />
        </div>


        <div className="mb-6">
          <ProxyList
            proxies={dataState.proxies}
            onProxyRemoved={handleProxyRemoved}
            onProxyUpdated={handleProxyUpdated}
          />
        </div>

        {dataState.totalPages > 1 && (
          <Card>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Page {dataState.currentPage} of {dataState.totalPages}
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => handlePageChange(dataState.currentPage - 1)}
                  disabled={dataState.currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => handlePageChange(dataState.currentPage + 1)}
                  disabled={dataState.currentPage === dataState.totalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Proxies;
