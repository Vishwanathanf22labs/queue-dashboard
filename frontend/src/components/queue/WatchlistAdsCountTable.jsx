import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../ui/Card';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorDisplay from '../ui/ErrorDisplay';
import Table from '../ui/Table';
import Pagination from '../ui/Pagination';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Eye, Users, ExternalLink, Circle } from 'lucide-react';
import { openFacebookAdLibrary } from '../../utils/facebookAdLibrary';

const WatchlistAdsCountTable = ({ watchlistBrandsQueue, loading, error, onPageChange, onSortChange }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get pagination and sorting state from URL params
  const currentPage = parseInt(searchParams.get('watchlistPage')) || 1;
  const sortBy = searchParams.get('watchlistSortBy') || 'normal';
  const sortOrder = searchParams.get('watchlistSortOrder') || 'desc';
  

  // Don't make API calls on mount - let the parent Dashboard handle initial loading
  // The parent will load data with the correct saved state from localStorage
  // No useEffect needed here as Dashboard already handles the initial API calls

  // Status indicator component - only show green dot for active
  const StatusIndicator = ({ status }) => {
    if (status === 'active') {
      return (
        <Circle 
          className="h-2 w-2 text-green-500" 
          fill="currentColor"
          title="Active"
        />
      );
    }
    return null; // No dot for other statuses
  };

  if (loading && !watchlistBrandsQueue) {
    return (
      <Card>
        <LoadingSpinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorDisplay title="Error Loading Watchlist Ads Count" message={error} />
      </Card>
    );
  }

  if (!watchlistBrandsQueue) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">No data available</p>
        </div>
      </Card>
    );
  }

  // Use watchlist brands directly from the API (server-side sorted)
  const watchlistBrands = watchlistBrandsQueue.brands || [];
  const totalPages = watchlistBrandsQueue.pagination?.total_pages || 1;
  const totalItems = watchlistBrandsQueue.pagination?.total_items || 0;
  const itemsPerPage = watchlistBrandsQueue.pagination?.per_page || 10;
  const apiCurrentPage = watchlistBrandsQueue.pagination?.current_page || 1;
  



  // Calculate display range
  const startIndex = (apiCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);



  // Sortable header component
  const SortableHeader = ({ field, label, currentSortBy, currentSortOrder, onSortChange }) => {
    const isActive = currentSortBy === field;
    const isAsc = isActive && currentSortOrder === 'asc';
    const isDesc = isActive && currentSortOrder === 'desc';

    const handleClick = () => {
      if (field === 'normal') {
        onSortChange('normal', 'desc');
      } else if (isActive) {
        // Toggle between asc and desc
        onSortChange(field, isAsc ? 'desc' : 'asc');
      } else {
        // Set to desc by default
        onSortChange(field, 'desc');
      }
    };

    return (
      <th 
        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none relative group"
        onClick={handleClick}
        title={field === 'normal' ? 'Normal' : undefined}
      >
        <div className="flex items-center space-x-1">
          <span>{label}</span>
          <div className="flex flex-col">
            <ChevronUp 
              className={`h-3 w-3 ${isAsc ? 'text-blue-600' : 'text-gray-300'}`} 
            />
            <ChevronDown 
              className={`h-3 w-3 -mt-1 ${isDesc ? 'text-blue-600' : 'text-gray-300'}`} 
            />
          </div>
        </div>
        {field === 'normal' && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
            Normal
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
          </div>
        )}
      </th>
    );
  };

  const columns = [
    {
      key: 'brand',
      label: 'Watchlist Brand',
      sortable: false, // Brand name is not sortable
      render: (value, brand) => (
        <div>
          <div className="flex items-center space-x-2">
            <div className="text-sm font-medium text-gray-900 max-w-[115px] sm:max-w-none truncate">
              {brand.brand_name || brand.page_name || brand.actual_name || 'Unknown'}
            </div>
            <StatusIndicator status={brand.job_status} />
            {brand.page_id && (
              <button
                onClick={() => openFacebookAdLibrary(brand.page_id)}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                title="View in Facebook Ad Library"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="text-sm text-gray-500 max-w-[115px] sm:max-w-none truncate">
            ID: {brand.brand_id} | Page: {brand.page_id}
          </div>
          {brand.page_category && (
            <div className="text-xs text-blue-600 max-w-[115px] sm:max-w-none truncate">
              ⭐ Watchlist • {brand.page_category}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'total_ads',
      label: 'Ads Count',
      sortable: true,
      render: (value) => (
        <div className="text-sm text-gray-900 font-medium">{value || 0}</div>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value) => (
        <div className="text-sm text-gray-500 max-w-[80px] sm:max-w-none truncate">
          {value ? new Date(value).toLocaleDateString() : 'N/A'}
        </div>
      )
    }
  ];

  const handlePageChange = (newPage) => {
    if (onPageChange) {
      onPageChange(newPage, sortBy, sortOrder);
    }
  };

  const handleSortChange = (field, order) => {
    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    newParams.set('watchlistPage', '1'); // Reset to page 1 when sorting
    newParams.set('watchlistSortBy', field);
    newParams.set('watchlistSortOrder', order);
    setSearchParams(newParams);
    
    if (onSortChange) {
      onSortChange(field, order);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-900">Watchlist Ads Count</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div className="ml-2 sm:ml-3">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Watchlist Jobs</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-900">{totalItems || 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
              <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            </div>
            <div className="ml-2 sm:ml-3">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Watchlist Ads Found</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-900">
                {watchlistBrandsQueue?.total_ads_watchlist || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
              <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div className="ml-2 sm:ml-3">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Current Page Ads</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-900">
                {watchlistBrandsQueue?.analytics?.current_page_total_ads || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-blue-900">Watchlist Brands in Queue</h3>
            <div className="flex items-center space-x-2 mt-1">
              <div className="flex items-center space-x-1">
                <Circle className="h-3 w-3 text-green-500" fill="currentColor" />
                <span className="text-sm font-medium text-gray-700">Active:</span>
                <span className="text-sm font-bold text-gray-900">
                  {watchlistBrandsQueue?.analytics?.pre_computed_counters?.active || 0}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-2">
            <div className="text-xs sm:text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} watchlist brands
            </div>
          </div>
        </div>


        {loading ? (
          <LoadingSpinner />
        ) : !loading && watchlistBrands && watchlistBrands.length > 0 ? (
          <>
            {/* Mobile Sorting Controls */}
            <div className="md:hidden mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Sort by:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSortChange('normal', sortBy === 'normal' && sortOrder === 'desc' ? 'asc' : 'desc')}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    sortBy === 'normal' 
                      ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <ChevronUp className={`h-3 w-3 ${sortBy === 'normal' && sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <ChevronDown className={`h-3 w-3 -mt-1 ${sortBy === 'normal' && sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span>Normal</span>
                </button>
                
                <button
                  onClick={() => handleSortChange('total_ads', sortBy === 'total_ads' && sortOrder === 'desc' ? 'asc' : 'desc')}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    sortBy === 'total_ads' 
                      ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <ChevronUp className={`h-3 w-3 ${sortBy === 'total_ads' && sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <ChevronDown className={`h-3 w-3 -mt-1 ${sortBy === 'total_ads' && sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span>Ads Count</span>
                </button>
                
                <button
                  onClick={() => handleSortChange('created_at', sortBy === 'created_at' && sortOrder === 'desc' ? 'asc' : 'desc')}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    sortBy === 'created_at' 
                      ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <ChevronUp className={`h-3 w-3 ${sortBy === 'created_at' && sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <ChevronDown className={`h-3 w-3 -mt-1 ${sortBy === 'created_at' && sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span>Created Date</span>
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              <div className="overflow-hidden shadow-md rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <SortableHeader
                        field="normal"
                        label="Watchlist Brand"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSortChange={handleSortChange}
                      />
                      <SortableHeader
                        field="total_ads"
                        label="Ads Count"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSortChange={handleSortChange}
                      />
                      <SortableHeader
                        field="created_at"
                        label="Created"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSortChange={handleSortChange}
                      />
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {watchlistBrands.map((brand, index) => (
                      <tr key={`${brand.brand_id}-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {columns[0].render(null, brand)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {columns[1].render(brand.total_ads, brand)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {columns[2].render(brand.created_at, brand)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-3">
              {watchlistBrands.map((brand, index) => (
                <Card key={`${brand.brand_id}-${index}`} className="p-4 relative pb-12">
                  <div className="space-y-3">
                    {/* Header with Brand Name */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-3">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                            {brand.brand_name || brand.page_name || brand.actual_name || 'Unknown'}
                          </h3>
                          <StatusIndicator status={brand.job_status} />
                          {brand.page_id && (
                            <button
                              onClick={() => openFacebookAdLibrary(brand.page_id)}
                              className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="View in Facebook Ad Library"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold text-blue-600">{brand.total_ads || 0}</div>
                        <div className="text-xs text-gray-500">Ads</div>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Brand ID:</span>
                        <span className="ml-2 font-medium text-gray-900">{brand.brand_id}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Page ID:</span>
                        <span className="ml-2 font-medium text-gray-900">{brand.page_id}</span>
                      </div>
                    </div>

                    {/* Created Date */}
                    <div className="text-sm">
                      <span className="text-gray-500">Created:</span>
                      <span className="ml-2 text-gray-900">
                        {brand.created_at ? new Date(brand.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>

                    {/* Category */}
                    {brand.page_category && (
                      <div className="text-xs text-blue-600">
                        ⭐ Watchlist • {brand.page_category}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : !loading ? (
          <div className="text-center py-6 sm:py-8">
            <Users className="h-8 w-8 sm:h-12 sm:w-12 text-blue-300 mx-auto mb-2 sm:mb-3" />
            <p className="text-sm sm:text-base text-gray-500">No watchlist brands in queue</p>
          </div>
        ) : null}

        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              currentPage={apiCurrentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              showPageInfo={true}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default WatchlistAdsCountTable;
