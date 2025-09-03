import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Calendar,
  AlertCircle,
  Eye
} from 'lucide-react';
import api from '../services/api';
import Card from '../components/ui/Card';
import Pagination from '../components/ui/Pagination';
import SearchInput from '../components/ui/SearchInput';
import Button from '../components/ui/Button';
import LoadingState from '../components/ui/LoadingState';
import ErrorDisplay from '../components/ui/ErrorDisplay';

const PipelineStatusPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // State management
  const [data, setData] = useState({
    brands: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      pages: 1,
      hasNext: false,
      hasPrev: false
    }
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(
    searchParams.get('date') || new Date().toISOString().split('T')[0]
  );

  // Debounced search term to avoid excessive filtering
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Memoize filtered brands
  const filteredBrands = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return data.brands;
    }

    const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
    return data.brands.filter(brand =>
      brand.brandName?.toLowerCase().includes(lowerSearchTerm) ||
      brand.brandId?.toString().includes(debouncedSearchTerm) ||
      brand.pageId?.toLowerCase().includes(lowerSearchTerm)
    );
  }, [data.brands, debouncedSearchTerm]);

  // Memoize API call to prevent unnecessary calls
  const fetchPipelineStatus = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      });

      if (selectedDate) {
        params.append('date', selectedDate);
      }

      const response = await api.get(`/pipeline-status/all?${params}`);

      if (response.data && response.data.brands) {
        setData(response.data);
      } else {
        setData({
          brands: response.data || [],
          pagination: {
            page: 1,
            limit: 10,
            total: response.data?.length || 0,
            pages: 1,
            hasNext: false,
            hasPrev: false
          }
        });
      }
    } catch (error) {
      console.error('Error fetching pipeline status:', error);
      setError('Failed to fetch pipeline status. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, selectedDate]);

  // Fetch data on component mount and when dependencies change
  useEffect(() => {
    fetchPipelineStatus();
  }, [fetchPipelineStatus]);

  // Memoize handlers to prevent unnecessary re-renders
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPipelineStatus();
  }, [fetchPipelineStatus]);

  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
    setLoading(true);
  }, []);

  const handleDateChange = useCallback((date) => {
    setSelectedDate(date);
    setCurrentPage(1);
    setLoading(true);
    setSearchParams({ date });
  }, [setSearchParams]);

  // Memoize status functions to prevent recreation on every render
  const getStatusIcon = useCallback((status, completed) => {
    const completedStatuses = [
      'Started', 'Completed',
      'Stored (has new ads)', 'Stored (no new ads today)', 'Stored (processing done)',
      'COMPLETED'
    ];

    if (completed) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }

    if (completedStatuses.includes(status)) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }

    switch (status) {
      case 'Blocked':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'Unknown':
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
      case 'In progress (some ads stored)':
      case 'In progress (no ads yet)':
      case 'In progress (not finished)':
      case 'WAITING':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'Failed/blocked':
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'Not started':
      case 'NOT_PROCESSED':
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
      default:
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  }, []);

  const getStatusColor = useCallback((status, completed) => {
    const completedStatuses = [
      'Started', 'Completed',
      'Stored (has new ads)', 'Stored (no new ads today)', 'Stored (processing done)',
      'COMPLETED'
    ];

    if (completed) {
      return 'text-green-600';
    }

    if (completedStatuses.includes(status)) {
      return 'text-green-600';
    }

    switch (status) {
      case 'Blocked':
      case 'Failed/blocked':
      case 'FAILED':
        return 'text-red-600';
      case 'Unknown':
      case 'Not started':
      case 'NOT_PROCESSED':
        return 'text-gray-500';
      case 'In progress (some ads stored)':
      case 'In progress (no ads yet)':
      case 'In progress (not finished)':
      case 'WAITING':
        return 'text-yellow-600';
      default:
        return 'text-gray-500';
    }
  }, []);

  const getStatusText = useCallback((status, completed) => {
    if (completed) return 'Completed';

    switch (status) {
      case 'Started':
        return 'Started';
      case 'Completed':
        return 'Completed';
      case 'Blocked':
        return 'Blocked';
      case 'Unknown':
        return 'Unknown';
      case 'Stored (has new ads)':
        return 'Stored (has new ads)';
      case 'Stored (no new ads today)':
        return 'Stored (no new ads today)';
      case 'Stored (processing done)':
        return 'Stored (processing done)';
      case 'In progress (some ads stored)':
        return 'In progress (some ads stored)';
      case 'In progress (no ads yet)':
        return 'In progress (no ads yet)';
      case 'In progress (not finished)':
        return 'In progress (not finished)';
      case 'Failed/blocked':
        return 'Failed/blocked';
      case 'Not started':
        return 'Not started';
      case 'WAITING':
        return 'Waiting';
      case 'FAILED':
        return 'Failed';
      case 'NOT_PROCESSED':
        return 'Not Started';
      case 'COMPLETED':
        return 'Completed';
      default:
        return 'Unknown';
    }
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  // Memoize brand card component to prevent unnecessary re-renders
  const BrandCard = React.memo(({ brand }) => (
    <Card key={brand.brandId} className="hover:shadow-lg transition-shadow duration-200">
      {/* Brand Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {brand.brandName || 'Unknown Brand'}
          </h3>
          <p className="text-sm text-gray-500">ID: {brand.brandId}</p>
          {brand.pageId && (
            <p className="text-xs text-gray-400">Page: {brand.pageId}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {brand.scraping?.completed && (
            <div className="w-2 h-2 bg-green-500 rounded-full" title="All stages complete" />
          )}
        </div>
      </div>

      {/* Pipeline Stages */}
      <div className="space-y-3">
        {/* Scraping Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon(brand.scraping?.status, brand.scraping?.completed)}
            <div>
              <p className="text-sm font-medium text-gray-900">Scraping</p>
              <p className="text-xs text-gray-500">
                {getStatusText(brand.scraping?.status, brand.scraping?.completed)}
              </p>
            </div>
          </div>
          <div className="text-right">
            {brand.scraping?.timestamp && (
              <p className="text-xs text-gray-400">
                {formatDate(brand.scraping.timestamp)}
              </p>
            )}
          </div>
        </div>

        {/* DB Stored Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon(brand.dbStored?.status, brand.dbStored?.completed)}
            <div>
              <p className="text-sm font-medium text-gray-900">DB Stored</p>
              <p className="text-xs text-gray-500">
                {brand.dbStored?.status || 'Not started'}
              </p>
            </div>
          </div>
          <div className="text-right">
            {brand.dbStored?.activeAds > 0 && (
              <p className="text-xs text-gray-400">
                {brand.dbStored.activeAds} ads
              </p>
            )}
          </div>
        </div>

        {/* Typesense Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon(brand.typesense?.status, brand.typesense?.completed)}
            <div>
              <p className="text-sm font-medium text-gray-900">Typesense</p>
              <p className="text-xs text-gray-500">
                {getStatusText(brand.typesense?.status, brand.typesense?.completed)}
              </p>
            </div>
          </div>
          <div className="text-right">
            {brand.typesense?.totalAds > 0 && (
              <p className="text-xs text-gray-400">
                {brand.typesense.adsWithTypesense}/{brand.typesense.totalAds} ads
              </p>
            )}
          </div>
        </div>

        {/* File Upload Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon(brand.fileUpload?.status, brand.fileUpload?.completed)}
            <div>
              <p className="text-sm font-medium text-gray-900">File Upload</p>
              <p className="text-xs text-gray-500">
                {getStatusText(brand.fileUpload?.status, brand.fileUpload?.completed)}
              </p>
            </div>
          </div>
          <div className="text-right">
            {brand.fileUpload?.totalMedia > 0 && (
              <p className="text-xs text-gray-400">
                {brand.fileUpload.mediaWithAllUrls}/{brand.fileUpload.totalMedia} files
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Additional Info */}
      {(brand.typesense?.adsInQueue > 0 || brand.typesense?.adsFailed > 0 ||
        brand.fileUpload?.mediaInQueue > 0 || brand.fileUpload?.mediaFailed > 0) && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex flex-wrap gap-2 text-xs">
              {brand.typesense?.adsInQueue > 0 && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                  {brand.typesense.adsInQueue} in queue
                </span>
              )}
              {brand.typesense?.adsFailed > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                  {brand.typesense.adsFailed} failed
                </span>
              )}
              {brand.fileUpload?.mediaInQueue > 0 && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                  {brand.fileUpload.mediaInQueue} files queued
                </span>
              )}
              {brand.fileUpload?.mediaFailed > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                  {brand.fileUpload.mediaFailed} files failed
                </span>
              )}
            </div>
          </div>
        )}
    </Card>
  ));

  if (loading && !refreshing) {
    return <LoadingState message="Loading pipeline status..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center py-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pipeline Status Dashboard</h1>
              <p className="mt-2 text-sm text-gray-600">
                Monitor the complete processing status for all brands
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Date Picker */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Refresh Button */}
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="primary"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && <ErrorDisplay error={error} className="mb-6" />}

        {/* Search and Filters */}
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search brands by name, ID, or page ID..."
                leftIcon={<Search className="h-4 w-4" />}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Eye className="h-4 w-4" />
              <span>Showing {filteredBrands.length} of {data.pagination.total} brands</span>
            </div>
          </div>
        </Card>

        {/* Brand Cards Grid */}
        {filteredBrands.length === 0 ? (
          <Card className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No brands found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try adjusting your search terms' : 'No brands available for the selected date'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {filteredBrands.map((brand) => (
              <BrandCard key={brand.brandId} brand={brand} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data.pagination.pages > 1 && (
          <Card>
            <Pagination
              currentPage={data.pagination.page}
              totalPages={data.pagination.pages}
              onPageChange={handlePageChange}
              totalItems={data.pagination.total}
              itemsPerPage={data.pagination.limit}
              showPageInfo={true}
            />
          </Card>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Last updated: {new Date().toLocaleString()}</p>
          {selectedDate && (
            <p className="mt-1">Showing data for: {formatDate(selectedDate)}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PipelineStatusPage;
