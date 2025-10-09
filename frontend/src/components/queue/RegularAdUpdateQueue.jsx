import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../ui/Card';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorDisplay from '../ui/ErrorDisplay';
import Table from '../ui/Table';
import Pagination from '../ui/Pagination';
import SearchInput from '../ui/SearchInput';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import useQueueStore from '../../stores/queueStore';
import { Users, Eye, ExternalLink, Circle } from 'lucide-react';
import { openFacebookAdLibrary } from '../../utils/facebookAdLibrary';

const RegularAdUpdateQueue = ({ onPageChange, onSortChange, onSearch, searchTerm, onClearSearch, isSearching }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { adUpdateQueue, loading, error } = useQueueStore();

  // Get pagination and sorting state from URL params
  const currentPage = parseInt(searchParams.get('regularAdUpdatePage')) || 1;
  const sortBy = searchParams.get('regularAdUpdateSortBy') || 'normal';
  const sortOrder = searchParams.get('regularAdUpdateSortOrder') || 'desc';
  
  // Store original totals (for static display - don't change during search)
  const [originalTotals, setOriginalTotals] = useState({
    total_items: 0,
    total_ads: 0
  });

  // Update original totals only when NOT searching
  useEffect(() => {
    if (adUpdateQueue) {
      const isSearchActive = searchTerm && searchTerm.trim().length > 0;
      
      // Only update original totals when NOT searching
      if (!isSearchActive) {
        setOriginalTotals({
          total_items: adUpdateQueue.pagination?.total_items || 0,
          total_ads: adUpdateQueue.total_ads_regular || 0
        });
      }
    }
  }, [adUpdateQueue, searchTerm]);

  // Don't make API calls on mount - let the parent Dashboard handle initial loading
  // The parent will load data with the correct saved state from localStorage
  // No useEffect needed here as Dashboard already handles the initial API calls

  // Status indicator component - show colored dot for all statuses
  const StatusIndicator = ({ status }) => {
    const getStatusColor = (status) => {
      switch (status) {
        case 'active':
          return 'text-green-500';
        case 'waiting':
          return 'text-yellow-500';
        case 'delayed':
          return 'text-orange-500';
        case 'completed':
          return 'text-blue-500';
        case 'failed':
          return 'text-red-500';
        case 'prioritized':
          return 'text-purple-500';
        default:
          return 'text-gray-400';
      }
    };

    const getStatusTitle = (status) => {
      switch (status) {
        case 'active':
          return 'Active';
        case 'waiting':
          return 'Waiting';
        case 'delayed':
          return 'Delayed';
        case 'completed':
          return 'Completed';
        case 'failed':
          return 'Failed';
        case 'prioritized':
          return 'Prioritized';
        default:
          return 'Unknown';
      }
    };

    return (
      <Circle 
        className={`h-2 w-2 ${getStatusColor(status)}`}
        fill="currentColor"
        title={getStatusTitle(status)}
      />
    );
  };


  const handlePageChange = (newPage) => {
    if (onPageChange) {
      onPageChange(newPage, sortBy, sortOrder);
    }
    // Scroll to the table section when changing pages
    const tableSection = document.getElementById('ad-update-table-section');
    if (tableSection) {
      tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSortChange = (field, order) => {
    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    newParams.set('regularAdUpdatePage', '1'); // Reset to page 1 when sorting
    newParams.set('regularAdUpdateSortBy', field);
    newParams.set('regularAdUpdateSortOrder', order);
    setSearchParams(newParams);
    
    if (onSortChange) {
      onSortChange(field, order);
    }
  };

  if (loading && !adUpdateQueue) {
    return (
      <Card>
        <LoadingSpinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorDisplay title="Error Loading Queue" message={error} />
      </Card>
    );
  }

  if (!adUpdateQueue) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">No data available</p>
        </div>
      </Card>
    );
  }

  const { brands, pagination } = adUpdateQueue;

  // Use server-side pagination data
  const totalItems = pagination?.total_items || 0;
  const totalPages = pagination?.total_pages || 1;
  const itemsPerPage = pagination?.per_page || 10;
  const apiCurrentPage = pagination?.current_page || 1;
  

  // Use brands directly from API (server-side sorted)
  const currentPageBrands = brands || [];

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
      label: 'Regular Brand',
      sortable: false, // Brand name is not sortable
      render: (value, brand) => (
        <div>
          <div className="flex items-center space-x-2">
            <div className="text-sm font-medium text-gray-900 max-w-[115px] sm:max-w-none truncate">
              {brand.brand_name || brand.page_name || brand.actual_name || 'Unknown'}
            </div>
            <StatusIndicator status={brand.job_status} />
            {brand.page_id && brand.page_id !== 'N/A' && (
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
              {brand.page_category}
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
        <div className="text-sm text-gray-900">{value || 0}</div>
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Regular Ad-Update Queue</h2>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div className="ml-2 sm:ml-3">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Regular Brands</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-900">{originalTotals.total_items || totalItems || 0}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
              <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            </div>
            <div className="ml-2 sm:ml-3">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Ads Found</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-900">
                {originalTotals.total_ads || adUpdateQueue?.total_ads_regular || 0}
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
                {adUpdateQueue?.analytics?.current_page_total_ads || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search Input */}
      <Card>
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:gap-4">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchTerm || ''}
              onChange={onSearch}
              placeholder="Search regular ad-update by name, ID, or page ID..."
              leftIcon={<Search className="h-4 w-4 text-gray-400" />}
              size="md"
              variant="default"
              showClearButton={true}
              onClear={onClearSearch}
            />
          </div>
          <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600">
            <span>Total: {originalTotals.total_items || totalItems}</span>
            <span>Showing: {currentPageBrands.length}</span>
          </div>
        </div>
      </Card>

      <Card id="ad-update-table-section">
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Regular Ad-Update in Queue</h3>
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap sm:items-center gap-1 sm:gap-3 mt-1">
              {/* Active */}
              <div className="flex items-center space-x-1 justify-center">
                <Circle className="h-2.5 w-2.5 text-green-500" fill="currentColor" />
                <span className="text-xs font-medium text-gray-700">Active:</span>
                <span className="text-xs font-bold text-gray-900">
                  {adUpdateQueue?.analytics?.pre_computed_counters?.active || 0}
                </span>
              </div>
              
              {/* Waiting */}
              <div className="flex items-center space-x-1 justify-center">
                <Circle className="h-2.5 w-2.5 text-yellow-500" fill="currentColor" />
                <span className="text-xs font-medium text-gray-700">Waiting:</span>
                <span className="text-xs font-bold text-gray-900">
                  {adUpdateQueue?.analytics?.pre_computed_counters?.waiting || 0}
                </span>
              </div>
              
              {/* Delayed */}
              <div className="flex items-center space-x-1 justify-center">
                <Circle className="h-2.5 w-2.5 text-orange-500" fill="currentColor" />
                <span className="text-xs font-medium text-gray-700">Delayed:</span>
                <span className="text-xs font-bold text-gray-900">
                  {adUpdateQueue?.analytics?.pre_computed_counters?.delayed || 0}
                </span>
              </div>
              
              {/* Completed */}
              <div className="flex items-center space-x-1 justify-center">
                <Circle className="h-2.5 w-2.5 text-blue-500" fill="currentColor" />
                <span className="text-xs font-medium text-gray-700">Completed:</span>
                <span className="text-xs font-bold text-gray-900">
                  {adUpdateQueue?.analytics?.pre_computed_counters?.completed || 0}
                </span>
              </div>
              
              {/* Failed */}
              <div className="flex items-center space-x-1 justify-center">
                <Circle className="h-2.5 w-2.5 text-red-500" fill="currentColor" />
                <span className="text-xs font-medium text-gray-700">Failed:</span>
                <span className="text-xs font-bold text-gray-900">
                  {adUpdateQueue?.analytics?.pre_computed_counters?.failed || 0}
                </span>
              </div>
              
              {/* Prioritized */}
              <div className="flex items-center space-x-1 justify-center">
                <Circle className="h-2.5 w-2.5 text-purple-500" fill="currentColor" />
                <span className="text-xs font-medium text-gray-700">Prioritized:</span>
                <span className="text-xs font-bold text-gray-900">
                  {adUpdateQueue?.analytics?.pre_computed_counters?.prioritized || 0}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-2">
            <div className="text-xs sm:text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} brands
            </div>
          </div>
        </div>


        {isSearching ? (
          <div className="text-center py-12 sm:py-16">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Searching...</h3>
                <p className="text-sm text-gray-500">
                  Searching for "{searchTerm}" in regular ad-update queue
                </p>
              </div>
            </div>
          </div>
        ) : loading ? (
          <LoadingSpinner />
        ) : !loading && currentPageBrands && currentPageBrands.length > 0 ? (
          <>
            {/* Mobile Sorting Controls */}
            <div className="md:hidden mb-4">
              <div className="flex flex-nowrap gap-1 overflow-x-auto">
                <span className="text-xs font-medium text-gray-700 self-center flex-shrink-0 mr-1">Sort by:</span>
                <div className="flex gap-0.5 flex-nowrap min-w-0">
                  <button
                    onClick={() => handleSortChange('normal', sortBy === 'normal' && sortOrder === 'desc' ? 'asc' : 'desc')}
                    className={`flex items-center space-x-0.5 px-1.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      sortBy === 'normal' 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <ChevronUp className={`h-2 w-2 ${sortBy === 'normal' && sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <ChevronDown className={`h-2 w-2 -mt-1 ${sortBy === 'normal' && sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span>Normal</span>
                  </button>
                  
                  <button
                    onClick={() => handleSortChange('total_ads', sortBy === 'total_ads' && sortOrder === 'desc' ? 'asc' : 'desc')}
                    className={`flex items-center space-x-0.5 px-1.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      sortBy === 'total_ads' 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <ChevronUp className={`h-2 w-2 ${sortBy === 'total_ads' && sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <ChevronDown className={`h-2 w-2 -mt-1 ${sortBy === 'total_ads' && sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span>Ads Count</span>
                  </button>
                  
                  <button
                    onClick={() => handleSortChange('created_at', sortBy === 'created_at' && sortOrder === 'desc' ? 'asc' : 'desc')}
                    className={`flex items-center space-x-0.5 px-1.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      sortBy === 'created_at' 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <ChevronUp className={`h-2 w-2 ${sortBy === 'created_at' && sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <ChevronDown className={`h-2 w-2 -mt-1 ${sortBy === 'created_at' && sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span>Created Date</span>
                  </button>
                </div>
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
                        label="Regular Brand"
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
                    {currentPageBrands.map((brand, index) => (
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
              {currentPageBrands.map((brand, index) => (
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
                          {brand.page_id && brand.page_id !== 'N/A' && (
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
                        <div className="text-lg font-bold text-purple-600">{brand.total_ads || 0}</div>
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
                      <div className="text-xs text-gray-400">
                        {brand.page_category}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : !loading ? (
          <div className="text-center py-6 sm:py-8">
            <Users className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No brands found' : 'No brands in queue'}
            </h3>
            <p className="text-sm sm:text-base text-gray-500">
              {searchTerm ? 'Try adjusting your search terms' : 'All ad-updates processed'}
            </p>
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

export default RegularAdUpdateQueue;
