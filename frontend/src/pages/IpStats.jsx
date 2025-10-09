import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ipStatsAPI } from '../services/api';
import SearchInput from '../components/ui/SearchInput';
import Pagination from '../components/ui/Pagination';
import RefreshControl from '../components/ui/RefreshControl';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import useAutoRefresh from '../hooks/useAutoRefresh';
import useEnvironmentStore from '../stores/environmentStore';
import toast from 'react-hot-toast';
import { openFacebookAdLibrary } from '../utils/facebookAdLibrary';
import {
  Search,
  Server,
  Activity,
  Target,
  CheckCircle,
  XCircle,
  TrendingUp,
  Tag,
  Hash,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink
} from 'lucide-react';

const IpStats = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentEnvironment, isLoading: environmentLoading } = useEnvironmentStore();

  const isInitialMountRef = useRef(true);
  const previousEnvironmentRef = useRef(currentEnvironment);

  const [dataState, setDataState] = useState({
    ipStats: [],
    brands: [],
    brandsPagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false
    },
    originalTotal: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1);
  const [selectedIp, setSelectedIp] = useState(searchParams.get('ip') || '');
  const [sortBy, setSortBy] = useState(() => {
    const urlSortBy = searchParams.get('sortBy');
    return urlSortBy && urlSortBy !== 'undefined' ? urlSortBy : 'adsCount';
  });
  const [sortOrder, setSortOrder] = useState(() => {
    const urlSortOrder = searchParams.get('sortOrder');
    return urlSortOrder && urlSortOrder !== 'undefined' ? urlSortOrder : 'asc';
  });

  const updateDataState = useCallback((updates) => {
    setDataState(prev => ({ ...prev, ...updates }));
  }, []);

  const loadIpStats = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }

      const response = await ipStatsAPI.getIpStatsList(1, 100, '', 'totalAds', 'desc');

      if (response.data.success) {
        const ipStats = response.data.data.data || [];
        updateDataState({ ipStats });

        if (!selectedIp && ipStats.length > 0) {
          setSelectedIp(ipStats[0].ip);
          const newParams = new URLSearchParams(searchParams);
          newParams.set('ip', ipStats[0].ip);
          newParams.set('page', '1');
          setSearchParams(newParams, { replace: true });
        }
      } else {
        toast.error(response.data.message || 'Failed to load IP stats');
      }
    } catch (error) {
      console.error('Error loading IP stats:', error);
      toast.error('Error loading IP stats');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [updateDataState, selectedIp, searchParams, setSearchParams]);

  const loadBrands = useCallback(async (ip, page = 1, search = '', sortField = 'adsCount', sortDir = 'asc', showLoading = true) => {
    if (!ip) return;

    try {
      if (search) {
        setIsSearching(true);
      } else if (showLoading) {
        setBrandsLoading(true);
      }

      const response = await ipStatsAPI.getIpBrands(ip, page, 10, search);

      if (response.data.success) {
        let brands = response.data.data.data || [];
        const pagination = response.data.data.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        };

        brands.sort((a, b) => {
          if (sortField === 'adsCount') {
            const aVal = a.adsCount || 0;
            const bVal = b.adsCount || 0;
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
          }
          return 0;
        });

        updateDataState({
          brands,
          brandsPagination: {
            ...pagination,
            total: pagination.total || 0
          },
          originalTotal: pagination.total || 0
        });
      } else {
        toast.error(response.data.message || 'Failed to load brands');
      }
    } catch (error) {
      console.error('Error loading brands:', error);
      toast.error('Error loading brands');
    } finally {
      if (search) {
        setIsSearching(false);
      } else if (showLoading) {
        setBrandsLoading(false);
      }
    }
  }, [updateDataState]);


  useEffect(() => {
    const urlIp = searchParams.get('ip') || '';
    const urlPage = parseInt(searchParams.get('page')) || 1;
    const urlSearch = searchParams.get('search') || '';
    const urlSortBy = searchParams.get('sortBy') && searchParams.get('sortBy') !== 'undefined' ? searchParams.get('sortBy') : 'adsCount';
    const urlSortOrder = searchParams.get('sortOrder') && searchParams.get('sortOrder') !== 'undefined' ? searchParams.get('sortOrder') : 'asc';
    const hasUndefinedParams = searchParams.get('sortBy') === 'undefined' || searchParams.get('sortOrder') === 'undefined';
    if (hasUndefinedParams && isInitialMountRef.current) {
      const newParams = new URLSearchParams(searchParams);
      if (searchParams.get('sortBy') === 'undefined') {
        newParams.set('sortBy', 'adsCount');
      }
      if (searchParams.get('sortOrder') === 'undefined') {
        newParams.set('sortOrder', 'asc');
      }
      setSearchParams(newParams, { replace: true });
      return;
    }

    setSelectedIp(urlIp);
    setCurrentPage(urlPage);
    setSearchTerm(urlSearch);
    setSortBy(urlSortBy);
    setSortOrder(urlSortOrder);


    if (isInitialMountRef.current) {

      loadIpStats(true);
      isInitialMountRef.current = false;
    } else {
      loadIpStats(false);
    }
  }, [searchParams, loadIpStats, setSearchParams]);

  // Combined effect for loading brands - prevents duplicate calls
  useEffect(() => {
    if (!selectedIp) return;

    // Handle search with debouncing
    if (searchTerm && searchTerm.trim() !== '') {
      if (searchTerm.trim().length >= 3) {
        const timeoutId = setTimeout(() => {
          loadBrands(selectedIp, currentPage, searchTerm, sortBy, sortOrder);
        }, 300);

        return () => clearTimeout(timeoutId);
      }
    } else {
      // Load brands immediately for non-search cases
      loadBrands(selectedIp, currentPage, '', sortBy, sortOrder);
    }
  }, [selectedIp, currentPage, searchTerm, sortBy, sortOrder, loadBrands]);

  // Reload data when environment changes
  useEffect(() => {
    // Only trigger if environment actually changed
    if (!environmentLoading && !isInitialMountRef.current && previousEnvironmentRef.current !== currentEnvironment) {
      previousEnvironmentRef.current = currentEnvironment;
      // Reload IP stats for new environment
      loadIpStats(false);
    }
  }, [currentEnvironment, environmentLoading, loadIpStats]);

  const handleSearch = useCallback((searchValue) => {
    setSearchTerm(searchValue);

    const newParams = new URLSearchParams(searchParams);
    if (searchValue && searchValue.trim()) {
      newParams.set('search', searchValue);
      newParams.set('page', '1');
    } else {
      newParams.delete('search');
      newParams.set('page', '1');
    }
    setSearchParams(newParams, { replace: true });

    if (!searchValue || searchValue.trim() === '') {
      setCurrentPage(1);
    }
  }, [searchParams, setSearchParams]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setCurrentPage(1);

    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handlePageChange = useCallback((page) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleTabChange = useCallback((ip) => {
    setSelectedIp(ip);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('ip', ip);
    newParams.set('page', '1');
    newParams.delete('search');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSortChange = useCallback((field, order) => {
    let newField, newOrder;

    if (order === undefined) {
      if (sortBy === field) {
        newField = field;
        newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      } else {
        newField = field;
        newOrder = 'asc';
      }
    } else {
      newField = field || 'adsCount';
      newOrder = order || 'asc';
    }

    const newParams = new URLSearchParams(searchParams);
    newParams.set('sortBy', newField);
    newParams.set('sortOrder', newOrder);
    newParams.set('page', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams, sortBy, sortOrder]);


  const refreshFn = useCallback(async () => {
    try {
      try {
        await ipStatsAPI.invalidateIpStatsCache();
      } catch (cacheError) {
        console.warn('IP Stats cache invalidation failed:', cacheError);
      }

      await loadIpStats(false);
      // loadBrands will be triggered automatically by useEffect when loadIpStats completes
      toast.success('IP stats refreshed successfully');
    } catch (error) {
      console.error('IP stats refresh failed:', error);
    }
  }, [loadIpStats]);

  const { refreshInterval, isRefreshing, setIntervalValue, manualRefresh } = useAutoRefresh(
    refreshFn,
    []
  );

  const handleRefresh = async () => {
    await manualRefresh();
  };

  const currentIpStats = dataState.ipStats.find(stat => stat.ip === selectedIp);

  const brandsColumns = [
    {
      key: 'sno',
      label: 'S.No',
      sortable: false,
      headerAlign: 'center',
      className: 'text-center',
      render: (value, row, index) => (
        <div className="text-sm text-gray-900 text-center">
          {(currentPage - 1) * 10 + index + 1}
        </div>
      )
    },
    {
      key: 'brandName',
      label: 'Brand Name',
      sortable: false,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <div className="font-medium text-gray-900">{value}</div>
          {row.pageId && (
            <button
              onClick={() => openFacebookAdLibrary(row.pageId)}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
              title="View in Facebook Ad Library"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      )
    },
    {
      key: 'brandId',
      label: 'Brand ID',
      sortable: false,
      headerAlign: 'center',
      className: 'text-center',
      render: (value) => (
        <div className="text-sm text-gray-600 text-center font-mono">
          {value}
        </div>
      )
    },
    {
      key: 'pageId',
      label: 'Page ID',
      sortable: false,
      render: (value) => (
        <div className="text-sm text-gray-600 font-mono">
          {value}
        </div>
      )
    },
    {
      key: 'adsCount',
      label: 'Ads Count',
      sortable: true,
      headerAlign: 'center',
      className: 'text-center whitespace-nowrap min-w-[100px]',
      render: (value) => (
        <div className="text-sm text-gray-900 text-center font-medium">
          {value.toLocaleString()}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (value) => {
        switch (value?.toLowerCase()) {
          case 'complete':
          case 'completed':
            return <Badge variant="success">Complete</Badge>;
          case 'failed':
          case 'error':
            return <Badge variant="error">Failed</Badge>;
          default:
            return <Badge variant="secondary">{value}</Badge>;
        }
      }
    }
  ];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">IP Stats</h1>
              <p className="mt-2 text-sm md:text-base text-gray-600">
                Monitor scraping performance and brand statistics per IP address
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
              <RefreshControl
                isRefreshing={isRefreshing}
                refreshInterval={refreshInterval}
                onManualRefresh={handleRefresh}
                onIntervalChange={setIntervalValue}
              />
            </div>
          </div>
        </div>


        {dataState.ipStats.length > 0 && (
          <Card className="mb-6">
            <div className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-base md:text-lg font-semibold text-gray-900">IP Addresses</h2>
                  <span className="text-xs md:text-sm text-gray-500">
                    {dataState.ipStats.length} IP{dataState.ipStats.length !== 1 ? 's' : ''} found
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:flex md:flex-wrap md:justify-start gap-2">
                {dataState.ipStats.map((ipStat) => (
                  <button
                    key={ipStat.ip}
                    onClick={() => handleTabChange(ipStat.ip)}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors text-xs md:text-sm ${selectedIp === ipStat.ip
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'
                      }`}
                  >
                    <Server className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="font-mono">{ipStat.ip}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        )}

        {selectedIp && currentIpStats && (
          <>
            <Card className="mb-6">
              <div className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="h-8 w-8 md:h-10 md:w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Server className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-semibold text-gray-900 font-mono">
                        {selectedIp}
                      </h3>
                      <p className="text-xs md:text-sm text-gray-500">IP Stats</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                  <div className="text-center p-3 md:p-0">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 mb-1">
                      <Target className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
                      <span className="text-xs md:text-sm font-medium text-gray-700">Total Brands</span>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-green-600">
                      {currentIpStats.totalBrands.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-center p-3 md:p-0">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 mb-1">
                      <Activity className="h-3 w-3 md:h-4 md:w-4 text-purple-600" />
                      <span className="text-xs md:text-sm font-medium text-gray-700">Total Ads</span>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-purple-600">
                      {currentIpStats.totalAds.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-center p-3 md:p-0">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 mb-1">
                      <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-emerald-600" />
                      <span className="text-xs md:text-sm font-medium text-gray-700">Completed</span>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-emerald-600">
                      {currentIpStats.completed.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-center p-3 md:p-0">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 mb-1">
                      <XCircle className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
                      <span className="text-xs md:text-sm font-medium text-gray-700">Failed</span>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-red-600">
                      {currentIpStats.failed.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-center p-3 md:p-0 col-span-2 md:col-span-1">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 mb-1">
                      <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-orange-600" />
                      <span className="text-xs md:text-sm font-medium text-gray-700">Total</span>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-orange-600">
                      {currentIpStats.total.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="mb-6">
              <div className="p-4 md:p-6">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 sm:space-x-4">
                    <div className="flex-1">
                      <SearchInput
                        value={searchTerm}
                        onChange={handleSearch}
                        placeholder="Search brands by name, brand ID, or page ID..."
                        leftIcon={<Search className="h-4 w-4 text-gray-400" />}
                        size="md"
                        variant="default"
                        showClearButton={true}
                        onClear={clearSearch}
                      />
                    </div>
                    <div className="flex items-center space-x-2 text-xs md:text-sm text-gray-600">
                      <span className="font-medium">Total: {dataState.originalTotal}</span>
                      <span className="text-gray-400">|</span>
                      <span>Showing: {dataState.brands.length}</span>
                    </div>
                  </div>
                  
                  {/* Mobile Sorting Button */}
                  <div className="md:hidden flex justify-center">
                    <button
                      onClick={() => handleSortChange('adsCount')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors border border-gray-200"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      Sort by Ads Count
                      {sortBy === 'adsCount' && (
                        sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="mb-6">
              {isSearching ? (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <div className="text-center">
                      <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">Searching...</h3>
                      <p className="text-sm text-gray-500">
                        Searching for "{searchTerm}" across brands
                      </p>
                    </div>
                  </div>
                </div>
              ) : dataState.brands.length === 0 ? (
                <div className="text-center py-8">
                  <Tag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No Brands Found</h3>
                  <p className="text-sm text-gray-500">
                    {searchTerm ? 'Try adjusting your search terms' : `No brands found for IP ${selectedIp}`}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block">
                    <Table
                      data={dataState.brands}
                      columns={brandsColumns}
                      loading={brandsLoading}
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      onSortChange={handleSortChange}
                      emptyMessage="No brands found for this IP"
                      emptyIcon={Tag}
                    />
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-gray-200">
                    {dataState.brands.map((brand, index) => (
                      <div key={brand._id || index} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="space-y-3">
                          {/* S.No and Brand Name */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                  {(currentPage - 1) * 10 + index + 1}
                                </span>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <h3 className="font-semibold text-gray-900 text-sm truncate">
                                    {brand.brandName}
                                  </h3>
                                  {brand.pageId && (
                                    <button
                                      onClick={() => openFacebookAdLibrary(brand.pageId)}
                                      className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                      title="View in Facebook Ad Library"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {brand.status && (
                              <div className="flex-shrink-0">
                                {brand.status?.toLowerCase() === 'complete' || brand.status?.toLowerCase() === 'completed' ? (
                                  <Badge variant="success">Complete</Badge>
                                ) : brand.status?.toLowerCase() === 'failed' || brand.status?.toLowerCase() === 'error' ? (
                                  <Badge variant="error">Failed</Badge>
                                ) : (
                                  <Badge variant="secondary">{brand.status}</Badge>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Brand ID and Page ID */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className="flex items-center gap-1 text-gray-500 mb-1">
                                <Hash className="h-3 w-3" />
                                <span className="font-medium">Brand ID</span>
                              </div>
                              <div className="text-gray-900 font-mono text-xs break-all">
                                {brand.brandId}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-1 text-gray-500 mb-1">
                                <Eye className="h-3 w-3" />
                                <span className="font-medium">Page ID</span>
                              </div>
                              <div className="text-gray-900 font-mono text-xs break-all">
                                {brand.pageId}
                              </div>
                            </div>
                          </div>

                          {/* Ads Count */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <span className="text-xs font-medium text-gray-500">Ads Count</span>
                            <span className="text-sm font-bold text-gray-900">
                              {brand.adsCount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
            {dataState.brandsPagination.totalPages > 1 && (
              <Card>
                <Pagination
                  currentPage={currentPage}
                  totalPages={dataState.brandsPagination.totalPages}
                  onPageChange={handlePageChange}
                  totalItems={dataState.brandsPagination.total}
                  itemsPerPage={10}
                  showPageInfo={true}
                />
              </Card>
            )}
          </>
        )}


        {dataState.ipStats.length === 0 && !isLoading && (
          <Card>
            <div className="text-center py-12">
              <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No IP Stats Found</h3>
              <p className="text-gray-500">No IP statistics are available at the moment.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default IpStats;