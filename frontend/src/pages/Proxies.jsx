import React, { useState, useEffect, useCallback } from 'react';
import { proxyAPI } from '../services/api';
import ProxyManager from '../components/proxy/ProxyManager';
import ProxyList from '../components/proxy/ProxyList';
import ProxyStats from '../components/proxy/ProxyStats';
import SearchInput from '../components/ui/SearchInput';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
import useAdminStore from '../stores/adminStore';
import { Shield, Search, ChevronDown } from 'lucide-react';

const Proxies = () => {
  const { isAdmin, isLoading: adminLoading } = useAdminStore();
  const [proxies, setProxies] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Load proxies
  const loadProxies = useCallback(async (page = 1, filterType = 'all', search = '') => {
    try {
      const response = await proxyAPI.getProxies(page, 10, filterType, search);
      
      if (response.data.success) {
        const proxies = response.data.data.proxies || [];
        const totalPages = response.data.data.pagination?.pages || 1;
        const currentPage = response.data.data.pagination?.page || 1;
        
        setProxies(proxies);
        setTotalPages(totalPages);
        setCurrentPage(currentPage);
        
        // Show message if search returned no results
        if (search && search.trim() && proxies.length === 0) {
          toast.info(`No proxies found matching "${search}"`);
        }
      } else {
        toast.error(response.data.message || 'Failed to load proxies');
      }
    } catch (error) {
      toast.error('Error loading proxies');
    }
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const response = await proxyAPI.getProxyStats();
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      // Silent fail for stats
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!isAdmin) return; // Don't load data if not admin
    
    const initializeData = async () => {
      setIsLoading(true);
      await Promise.all([
        loadProxies(),
        loadStats()
      ]);
      setIsLoading(false);
    };

    initializeData();
  }, [loadProxies, loadStats, isAdmin]);

  // Close dropdown when clicking outside
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

  // Handle proxy added
  const handleProxyAdded = useCallback((newProxy) => {
    setProxies(prev => [newProxy, ...prev]);
    loadStats();
  }, [loadStats]);

  // Handle proxy removed
  const handleProxyRemoved = useCallback((proxyId) => {
    setProxies(prev => prev.filter(proxy => proxy.id !== proxyId));
    loadStats();
  }, [loadStats]);

  // Handle proxy updated
  const handleProxyUpdated = useCallback((proxyId, updates) => {
    setProxies(prev => prev.map(proxy => 
      proxy.id === proxyId ? { ...proxy, ...updates } : proxy
    ));
    loadStats();
  }, [loadStats]);

  // Handle search - now called automatically while typing
  const handleSearch = useCallback(async (value) => {
    setSearchTerm(value);
    
    if (!value.trim()) {
      // If search is cleared, load all proxies
      loadProxies(1, filter, '');
      return;
    }

    setIsSearching(true);
    try {
      await loadProxies(1, filter, value);
    } finally {
      setIsSearching(false);
    }
  }, [filter, loadProxies]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    loadProxies(1, filter, '');
  }, [filter, loadProxies]);

  // Handle filter change
  const handleFilterChange = useCallback((newFilter) => {
    setFilter(newFilter);
    setCurrentPage(1);
    setShowFilterDropdown(false);
    loadProxies(1, newFilter, searchTerm);
  }, [searchTerm, loadProxies]);

  // Handle page change
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    loadProxies(page, filter, searchTerm);
  }, [filter, searchTerm, loadProxies]);

  // Get filter label
  const getFilterLabel = (filterType) => {
    switch (filterType) {
      case 'working': return 'Working Only';
      case 'failed': return 'Failed Only';
      case 'last_month': return 'Last Month';
      default: return 'All Proxies';
    }
  };

  // Admin loading state
  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Admin access required
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-pink-100 border border-pink-200 rounded-full flex items-center justify-center">
                <Shield className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Admin Access Required</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This page requires administrator privileges. Please log in with<br className="hidden sm:block" />
                  your admin credentials to access proxy management features.
                </p>
              </div>
            </div>
          </div>
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Proxy Management</h1>
          <p className="mt-2 text-gray-600">
            Manage your proxy configurations, monitor health, and control proxy rotation
          </p>
        </div>

        {/* Stats Cards */}
        <ProxyStats stats={stats} />

        {/* Controls and Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Search */}
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

              {/* Filter Dropdown */}
              <div className="relative filter-dropdown w-full">
                <button
                  type="button"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <span>{getFilterLabel(filter)}</span>
                  <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                    showFilterDropdown ? 'rotate-180' : ''
                  }`} />
                </button>
                
                {showFilterDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <button
                      type="button"
                      onClick={() => handleFilterChange('all')}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                        filter === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      All Proxies
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFilterChange('working')}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                        filter === 'working' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      Working Only
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFilterChange('failed')}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                        filter === 'failed' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      Failed Only
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFilterChange('last_month')}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                        filter === 'last_month' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      Last Month
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Search Status */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 sm:space-x-4 text-sm text-gray-600">
              <div className="flex items-center justify-between sm:justify-start">
                <span className="font-medium">Total: {proxies.length}</span>
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
        </div>

        {/* Add Proxy Form */}
        <div className="mb-6">
          <ProxyManager 
            onProxyAdded={handleProxyAdded}
            onProxyRemoved={handleProxyRemoved}
          />
        </div>

        {/* Proxy List */}
        <div className="mb-6">
          <ProxyList
            proxies={proxies}
            onProxyRemoved={handleProxyRemoved}
            onProxyUpdated={handleProxyUpdated}
          />
        </div>

        {totalPages > 1 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Proxies;
