import { useState } from 'react';
import Card from '../ui/Card';
import LoadingState from '../ui/LoadingState';
import ErrorDisplay from '../ui/ErrorDisplay';
import Table from '../ui/Table';
import Pagination from '../ui/Pagination';
import { Eye, Users } from 'lucide-react';

const WatchlistAdsCountTable = ({ watchlistBrandsQueue, loading, error, onPageChange }) => {
  const [currentPage, setCurrentPage] = useState(1);

  if (loading && !watchlistBrandsQueue) {
    return (
      <Card>
        <LoadingState size="lg" message="Loading watchlist ads count..." />
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

  // Use watchlist brands directly from the API
  const watchlistBrands = watchlistBrandsQueue.brands || [];
  const totalPages = watchlistBrandsQueue.pagination?.total_pages || 1;
  const totalItems = watchlistBrandsQueue.pagination?.total_items || 0;
  const itemsPerPage = watchlistBrandsQueue.pagination?.per_page || 10;
  const apiCurrentPage = watchlistBrandsQueue.pagination?.current_page || 1;



  // Calculate display range
  const startIndex = (apiCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);



  const columns = [
    {
      key: 'brand',
      label: 'Watchlist Brand',
      render: (value, brand) => (
        <div>
          <div className="text-sm font-medium text-gray-900 max-w-[115px] sm:max-w-none truncate">
            {brand.brand_name || brand.page_name || 'Unknown'}
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
      render: (value) => (
        <div className="text-sm text-gray-900 font-medium">{value || 0}</div>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (value) => (
        <div className="text-sm text-gray-500 max-w-[80px] sm:max-w-none truncate">
          {value ? new Date(value).toLocaleDateString() : 'N/A'}
        </div>
      )
    }
  ];

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-900">Watchlist Ads Count</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
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
                {watchlistBrands.reduce((sum, brand) => sum + (brand.total_ads || 0), 0) || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-blue-900">Watchlist Brands in Queue</h3>
          <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-2">
            {loading && (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-xs sm:text-sm text-gray-500">Loading...</span>
              </div>
            )}
            <div className="text-xs sm:text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} watchlist brands
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingState size="lg" message="Loading watchlist brands..." />
        ) : watchlistBrands && watchlistBrands.length > 0 ? (
          <Table
            data={watchlistBrands}
            columns={columns}
            emptyMessage="No watchlist brands in queue"
            className="shadow-md rounded-lg"
          />
        ) : (
          <div className="text-center py-6 sm:py-8">
            <Users className="h-8 w-8 sm:h-12 sm:w-12 text-blue-300 mx-auto mb-2 sm:mb-3" />
            <p className="text-sm sm:text-base text-gray-500">No watchlist brands in queue</p>
          </div>
        )}

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
