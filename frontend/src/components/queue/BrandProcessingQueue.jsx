import { useState } from 'react';
import Card from '../ui/Card';
import LoadingState from '../ui/LoadingState';
import ErrorDisplay from '../ui/ErrorDisplay';
import Table from '../ui/Table';
import Pagination from '../ui/Pagination';
import useQueueStore from '../../stores/queueStore';
import { Users, Eye, ExternalLink } from 'lucide-react';
import { openFacebookAdLibrary } from '../../utils/facebookAdLibrary';

const BrandProcessingQueue = ({ onPageChange }) => {
  const { brandProcessingQueue, loading, error } = useQueueStore();

  const [currentPage, setCurrentPage] = useState(1);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    // Scroll to the table section when changing pages
    const tableSection = document.getElementById('brands-table-section');
    if (tableSection) {
      tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // Call the API to fetch the new page
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

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

  const { brands, pagination } = brandProcessingQueue;

  // Use server-side pagination data
  const totalItems = pagination?.total_items || 0;
  const totalPages = pagination?.total_pages || 1;
  const itemsPerPage = pagination?.per_page || 10;
  const apiCurrentPage = pagination?.current_page || 1;

  // Use brands directly from API and sort by date descending
  const currentPageBrands = (brands || []).sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return dateB - dateA; // Descending order (newest first)
  });

  const columns = [
    {
      key: 'brand',
      label: 'Brand',
      render: (value, brand) => (
        <div>
          <div className="flex items-center space-x-2">
            <div className="text-sm font-medium text-gray-900 max-w-[115px] sm:max-w-none truncate">
              {brand.brand_name || brand.page_name || 'Unknown'}
            </div>
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
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">All Brands Scrapped Queue</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div className="ml-2 sm:ml-3">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Regular Brands</p>
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
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Ads Found</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-900">
                {brands?.reduce((sum, brand) => sum + (brand.total_ads || 0), 0) || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card id="brands-table-section">
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Regular Brands in Queue</h3>
          <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-2">
            {loading && (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-xs sm:text-sm text-gray-500">Loading...</span>
              </div>
            )}
            <div className="text-xs sm:text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} brands
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingState size="lg" message="Loading brands..." />
        ) : !loading && currentPageBrands && currentPageBrands.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table
                data={currentPageBrands}
                columns={columns}
                emptyMessage="No brands in queue"
                className="shadow-md rounded-lg"
              />
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
                            {brand.brand_name || brand.page_name || 'Unknown'}
                          </h3>
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
            <p className="text-sm sm:text-base text-gray-500">No brands in queue</p>
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

export default BrandProcessingQueue;
