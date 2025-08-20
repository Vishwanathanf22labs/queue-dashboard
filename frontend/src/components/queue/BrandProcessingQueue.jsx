import { useState, useEffect } from 'react';
import Card from '../ui/Card';
import LoadingState from '../ui/LoadingState';
import ErrorDisplay from '../ui/ErrorDisplay';
import Table from '../ui/Table';
import Pagination from '../ui/Pagination';
import useQueueStore from '../../stores/queueStore';
import { Users, Eye } from 'lucide-react';

const BrandProcessingQueue = ({ onPageChange }) => {
  const { brandProcessingQueue, loading, error } = useQueueStore();

  const [currentPage, setCurrentPage] = useState(1);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    // Call the parent's page change handler instead of making API call directly
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  // Removed useEffect - parent Dashboard component handles the API call
  // This prevents duplicate API calls

  if (loading && !brandProcessingQueue) {
    return (
      <Card>
        <LoadingState size="lg" message="Loading brand processing queue..." />
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

  if (!brandProcessingQueue) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">No data available</p>
        </div>
      </Card>
    );
  }

  const { brands, pagination, totals } = brandProcessingQueue;
  const totalPages = pagination?.total_pages || 1;
  const totalItems = pagination?.total_items || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Brands Scrapped Queue</h2>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div className="ml-2 sm:ml-3">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Jobs Created</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{totals?.total_jobs_created || 0}</p>
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
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                {brands?.reduce((sum, brand) => sum + (brand.total_ads || 0), 0) || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>


      <Card>
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Brands in Queue</h3>
          <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-2">
            {loading && (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-xs sm:text-sm text-gray-500">Loading...</span>
              </div>
            )}
            <div className="text-xs sm:text-sm text-gray-600">
              Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, totalItems)} of {totalItems} brands
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingState size="lg" message="Loading brands..." />
        ) : brands && brands.length > 0 ? (
          <Table
            data={brands}
            columns={[
              {
                key: 'brand',
                label: 'Brand',
                render: (value, brand) => (
                  <div>
                    <div className="text-sm font-medium text-gray-900 max-w-[115px] sm:max-w-none truncate">
                      {brand.brand_name || brand.page_name || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-500 max-w-[115px] sm:max-w-none truncate">
                      ID: {brand.brand_id} | Page: {brand.page_id}
                    </div>
                    {brand.page_category && (
                      <div className="text-xs text-gray-400 max-w-[115px] sm:max-w-none truncate">
                        {brand.page_category}
                      </div>
                    )}
                  </div>
                )
              },
              {
                key: 'total_ads',
                label: 'Ads Count',
                render: (value) => (
                  <div className="text-sm text-gray-900">{value || 0}</div>
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
            ]}
            emptyMessage="No brands in queue"
          />
        ) : (
          <div className="text-center py-6 sm:py-8">
            <Users className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
            <p className="text-sm sm:text-base text-gray-500">No brands in queue</p>
          </div>
        )}

    
        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              totalItems={totalItems}
              itemsPerPage={10}
              showPageInfo={true}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default BrandProcessingQueue;
