import Card from '../ui/Card';
import Table from '../ui/Table';
import Pagination from '../ui/Pagination';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorDisplay from '../ui/ErrorDisplay';
import SearchInput from '../ui/SearchInput';
import Button from '../ui/Button';
import { Users, Tag, Move, Trash2, Search, ExternalLink } from 'lucide-react';

const PendingQueue = ({ 
  pending, 
  onSearch, 
  onClearSearch, 
  onPageChange, 
  onMoveBrand, 
  onRemoveBrand, 
  isProcessingAction 
}) => {
  const pendingColumns = [
    {
      key: 'position',
      label: 'Position',
      render: (value, row, rowIndex) => {
        const page = Number(pending.currentPage) || 1;
        const itemsPerPageNum = Number(pending.itemsPerPage) || 10;
        const rowIndexNum = Number(rowIndex) || 0;
        const position = (page - 1) * itemsPerPageNum + rowIndexNum + 1;

        return (
          <div className="flex items-center">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-xs sm:text-sm font-medium text-blue-600">
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
            <Users className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
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
            variant="warning"
            onClick={() => onMoveBrand(row, 'failed')}
            disabled={isProcessingAction}
            className="text-xs px-1 sm:px-2 py-1"
            title="Move to Failed Queue"
          >
            <Move className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => onRemoveBrand(row, 'pending')}
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

  const filteredPendingBrands = pending.brands;
  const pendingTotalPages = Math.ceil(pending.totalCount / pending.itemsPerPage);

  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Pending Queue</h2>

      <Card className="mb-4 sm:mb-6">
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:gap-4">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={pending.searchTerm}
              onChange={(value) => onSearch(value)}
              placeholder="Search pending brands by name, ID, or page ID..."
              leftIcon={<Search className="h-4 w-4 text-gray-400" />}
              size="md"
              variant="default"
              showClearButton={true}
              onClear={onClearSearch}
              loading={false}
            />
          </div>
          <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600">
            <span>Total: {pending.totalCount}</span>
            <span>Showing: {filteredPendingBrands.length}</span>
          </div>
        </div>
      </Card>

      {/* Desktop Table View */}
      <Card className="hidden md:block">
        {pending.error ? (
          <ErrorDisplay title="Error Loading Pending Queue" message={pending.error}>
            <Button onClick={() => onSearch('')}>Retry</Button>
          </ErrorDisplay>
        ) : filteredPendingBrands.length === 0 && (pending.loading || pending.isSearching) ? (
          // Show loading state only when no data exists yet AND loading
          <div className="text-center py-12 sm:py-16">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {pending.isSearching ? 'Searching...' : 'Loading...'}
                </h3>
                <p className="text-sm text-gray-500">
                  {pending.isSearching ? `Searching for "${pending.searchTerm}" across all pages` : 'Loading pending brands'}
                </p>
              </div>
            </div>
          </div>
        ) : filteredPendingBrands.length === 0 ? (
          // Show empty state when no data and not loading
          <div className="text-center py-8 sm:py-12">
            <Users className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No pending brands found</h3>
            <p className="text-sm sm:text-base text-gray-500">
              {pending.searchTerm ? 'Try adjusting your search terms' : 'All brands have been processed'}
            </p>
          </div>
        ) : (
          // Show table when there's data
          <div className="relative">
            <Table
              data={filteredPendingBrands}
              columns={pendingColumns}
              emptyMessage="No pending brands found"
              className="shadow-md rounded-lg"
            />
            {/* Show loading overlay in table area when searching */}
            {pending.isSearching && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-start justify-center z-10 pt-16">
                <div className="flex flex-col items-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <div className="text-sm font-medium text-gray-900">
                    Searching...
                  </div>
                  <div className="text-xs text-gray-500">
                    Searching for "{pending.searchTerm}"
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {pending.error ? (
          <Card>
            <ErrorDisplay title="Error Loading Pending Queue" message={pending.error}>
              <Button onClick={() => onSearch('')}>Retry</Button>
            </ErrorDisplay>
          </Card>
        ) : filteredPendingBrands.length === 0 ? (
          // Show loading state only when no data exists yet AND loading
          (pending.loading || pending.isSearching) ? (
            <Card>
              <div className="text-center py-8">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {pending.isSearching ? 'Searching...' : 'Loading...'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {pending.isSearching ? `Searching for "${pending.searchTerm}" across all pages` : 'Loading pending brands'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
          <Card>
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No pending brands found</h3>
              <p className="text-sm text-gray-500">
                {pending.searchTerm ? 'Try adjusting your search terms' : 'All brands have been processed'}
              </p>
            </div>
          </Card>
          )
        ) : (
          <div className="relative">
            {filteredPendingBrands.map((brand, index) => {
            const position = (pending.currentPage - 1) * pending.itemsPerPage + index + 1;
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
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
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
                        variant="warning"
                        onClick={() => onMoveBrand(brand, 'failed')}
                        disabled={isProcessingAction}
                        className="flex-1 text-xs"
                        title="Move to Failed Queue"
                      >
                        <Move className="h-3 w-3 mr-1" />
                        Move to Failed
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => onRemoveBrand(brand, 'pending')}
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
          })}
          
          {/* Loading overlay for mobile cards when searching */}
          {pending.isSearching && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-start justify-center rounded-lg z-10 pt-16">
              <div className="flex flex-col items-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <div className="text-sm font-medium text-gray-900">
                  Searching...
                </div>
                <div className="text-xs text-gray-500">
                  Searching for "{pending.searchTerm}"
                </div>
              </div>
            </div>
          )}
          </div>
        )}
      </div>

      <div id="pending-queue-pagination">
        <Pagination
          currentPage={pending.currentPage}
          totalPages={pendingTotalPages}
          onPageChange={onPageChange}
          totalItems={pending.totalCount}
          itemsPerPage={pending.itemsPerPage}
          showPageInfo={true}
        />
      </div>
    </div>
  );
};

export default PendingQueue;
