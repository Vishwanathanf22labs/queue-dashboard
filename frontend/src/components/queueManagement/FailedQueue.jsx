import Card from '../ui/Card';
import Table from '../ui/Table';
import Pagination from '../ui/Pagination';
import LoadingState from '../ui/LoadingState';
import ErrorDisplay from '../ui/ErrorDisplay';
import SearchInput from '../ui/SearchInput';
import Button from '../ui/Button';
import { AlertTriangle, Tag, Move, Trash2, Search, ExternalLink } from 'lucide-react';

const FailedQueue = ({ 
  failed, 
  onSearch, 
  onClearSearch, 
  onPageChange, 
  onMoveBrand, 
  onRemoveBrand, 
  isProcessingAction 
}) => {
  const failedColumns = [
    {
      key: 'position',
      label: 'Position',
      render: (value, row, rowIndex) => {
        const page = Number(failed.currentPage) || 1;
        const itemsPerPageNum = Number(failed.itemsPerPage) || 10;
        const rowIndexNum = Number(rowIndex) || 0;
        const position = (page - 1) * itemsPerPageNum + rowIndexNum + 1;

        return (
          <div className="flex items-center">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-xs sm:text-sm font-medium text-red-600">
                {position}
              </span>
            </div>
          </div>
        );
      },
      className: 'hidden sm:table-cell'
    },
    {
      key: 'brand_name',
      label: 'Brand Name',
      render: (value, row) => {
        const pageId = row.page_id || 'N/A';
        return (
          <div className="flex items-center">
            <AlertTriangle className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
            <div className="flex items-center space-x-2 flex-1">
              <div className="text-xs font-medium text-gray-900 max-w-[80px] sm:max-w-none truncate">
                {value || 'Unknown Brand'}
              </div>
              {pageId && pageId !== 'N/A' && (
                <button
                  onClick={() => {
                    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${pageId}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="View in Facebook Ad Library"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'queue_id',
      label: 'Brand ID',
      className: 'hidden md:table-cell',
      render: (value, row) => (
        <div className="flex items-center">
          <Tag className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
          <span className="text-xs font-mono text-gray-900 max-w-[60px] sm:max-w-none truncate">
            {value || row.brand_id || 'N/A'}
          </span>
        </div>
      )
    },
    {
      key: 'page_id',
      label: 'Page ID',
      render: (value) => (
        <div className="flex items-center">
          <Tag className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
          <span className="text-xs font-mono text-gray-900 max-w-[70px] sm:max-w-none truncate">
            {value || 'N/A'}
          </span>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (value, row) => (
        <div className="flex items-center space-x-1 sm:space-x-2">
          <Button
            size="sm"
            variant="info"
            onClick={() => onMoveBrand(row, 'pending')}
            disabled={isProcessingAction}
            className="text-xs px-1 sm:px-2 py-1"
            title="Move to Pending Queue"
          >
            <Move className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => onRemoveBrand(row, 'failed')}
            disabled={isProcessingAction}
            className="text-xs px-1 sm:px-2 py-1"
            title="Remove Brand"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    }
  ];

  const filteredFailedBrands = failed.brands;
  const failedTotalPages = Math.ceil(failed.totalCount / failed.itemsPerPage);

  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Failed Queue</h2>

      <Card className="mb-4 sm:mb-6">
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:gap-4">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={failed.searchTerm}
              onChange={(value) => onSearch(value)}
              placeholder="Search failed brands by name, ID, or page ID..."
              leftIcon={<Search className="h-4 w-4 text-gray-400" />}
              size="md"
              variant="default"
              showClearButton={true}
              onClear={onClearSearch}
              disabled={failed.loading || failed.isSearching}
            />
          </div>
          <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600">
            <span>Total: {failed.totalCount}</span>
            <span>Showing: {filteredFailedBrands.length}</span>
            {failed.searchTerm && (
              <span className="text-red-600">
                {failed.isSearching ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-1"></div>
                    Searching: "{failed.searchTerm}"
                  </span>
                ) : (
                  `Searching: "${failed.searchTerm}"`
                )}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Desktop Table View */}
      <Card className="hidden md:block">
        {failed.error ? (
          <ErrorDisplay title="Error Loading Failed Queue" message={failed.error}>
            <Button onClick={() => onSearch('')}>Retry</Button>
          </ErrorDisplay>
        ) : failed.loading ? (
          <LoadingState size="lg" message="Loading failed brands..." />
        ) : failed.isSearching ? (
          <div className="text-center py-12 sm:py-16">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Searching...</h3>
                <p className="text-sm text-gray-500">
                  Searching for "{failed.searchTerm}" across all pages
                </p>
              </div>
            </div>
          </div>
        ) : filteredFailedBrands.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No failed brands found</h3>
            <p className="text-sm sm:text-base text-gray-500">
              {failed.searchTerm ? 'Try adjusting your search terms' : 'All brands have been processed'}
            </p>
          </div>
        ) : (
          <Table
            data={filteredFailedBrands}
            columns={failedColumns}
            emptyMessage="No failed brands found"
            className="shadow-md rounded-lg"
          />
        )}
      </Card>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {failed.error ? (
          <Card>
            <ErrorDisplay title="Error Loading Failed Queue" message={failed.error}>
              <Button onClick={() => onSearch('')}>Retry</Button>
            </ErrorDisplay>
          </Card>
        ) : failed.loading ? (
          <Card>
            <LoadingState size="lg" message="Loading failed brands..." />
          </Card>
        ) : failed.isSearching ? (
          <Card>
            <div className="text-center py-8">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Searching...</h3>
                  <p className="text-sm text-gray-500">
                    Searching for "{failed.searchTerm}" across all pages
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ) : filteredFailedBrands.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No failed brands found</h3>
              <p className="text-sm text-gray-500">
                {failed.searchTerm ? 'Try adjusting your search terms' : 'All brands have been processed'}
              </p>
            </div>
          </Card>
        ) : (
          filteredFailedBrands.map((brand, index) => {
            const position = (failed.currentPage - 1) * failed.itemsPerPage + index + 1;
            const brandName = brand.brand_name || 'Unknown Brand';
            const brandId = brand.queue_id || brand.brand_id || 'N/A';
            const pageId = brand.page_id || 'N/A';

            return (
              <Card key={`${brandId}-${index}`} className="p-4 relative pb-16">
                <div className="space-y-3">
                  {/* Header with Position and Brand Name */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {/* Position Circle */}
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-red-600">
                          {position}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 text-lg">{brandName}</h3>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Brand ID:</span>
                      <span className="ml-2 font-medium text-gray-900 font-mono">{brandId}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Page ID:</span>
                      <span className="ml-2 font-medium text-gray-900 font-mono">{pageId}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col space-y-2 pt-2">
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="info"
                        onClick={() => onMoveBrand(brand, 'pending')}
                        disabled={isProcessingAction}
                        className="flex-1 text-xs"
                        title="Move to Pending Queue"
                      >
                        <Move className="h-3 w-3 mr-1" />
                        Move to Pending
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => onRemoveBrand(brand, 'failed')}
                        disabled={isProcessingAction}
                        className="flex-1 text-xs"
                        title="Remove Brand"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>

                  {/* External Link Icon - Bottom Right */}
                  {pageId && pageId !== 'N/A' && (
                    <button
                      onClick={() => {
                        const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${pageId}`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="absolute bottom-3 right-3 p-1.5 text-gray-400 hover:text-blue-600 transition-colors bg-white rounded-full shadow-sm border border-gray-200"
                      title="View in Facebook Ad Library"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Pagination
        currentPage={failed.currentPage}
        totalPages={failedTotalPages}
        onPageChange={onPageChange}
        totalItems={failed.totalCount}
        itemsPerPage={failed.itemsPerPage}
        showPageInfo={true}
      />
    </div>
  );
};

export default FailedQueue;
