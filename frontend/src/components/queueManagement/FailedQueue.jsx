import Card from '../ui/Card';
import Table from '../ui/Table';
import Pagination from '../ui/Pagination';
import LoadingSpinner from '../ui/LoadingSpinner';
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
  isProcessingAction,
  disabled = false
}) => {
  const parseErrorMessage = (errorMsg) => {
    let importantPart = errorMsg || 'Unknown error';

    if (importantPart.includes(':')) {
      const parts = importantPart.split(':');
      importantPart = parts[parts.length - 1].trim();
    }

    if (importantPart.toLowerCase().includes('no matching script tag found')) {
      importantPart = 'No script tag';
    } else if (importantPart.toLowerCase().includes('session closed')) {
      importantPart = 'Session closed';
    } else if (importantPart.toLowerCase().includes('target closed')) {
      importantPart = 'Target closed';
    } else if (importantPart.toLowerCase().includes('protocol error')) {
      importantPart = 'Protocol error';
    } else if (importantPart.toLowerCase().includes('timeout')) {
      importantPart = 'Timeout';
    } else if (importantPart.toLowerCase().includes('network')) {
      importantPart = 'Network error';
    } else if (importantPart.toLowerCase().includes('connection')) {
      importantPart = 'Connection error';
    } else if (importantPart.toLowerCase().includes('failed to extract')) {
      importantPart = 'Extraction failed';
    }

    return importantPart;
  };

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
                    const url = `https://www.facebook.com/ads/library/?ad_type=all&country=US&view_all_page_id=${pageId}`;
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
      key: 'error_message',
      label: 'Error Message',
      render: (value, row) => {
        const errorMsg = value || row.error_message || row.error || row.message || 'Unknown error';
        const importantPart = parseErrorMessage(errorMsg);

        return (
          <div className="text-xs text-red-600 max-w-[100px] sm:max-w-[150px] truncate font-medium" title={errorMsg}>
            {importantPart}
          </div>
        );
      },
      className: 'hidden lg:table-cell'
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
            disabled={disabled || isProcessingAction}
            className="text-xs px-1 sm:px-2 py-1"
            title="Move to Pending Queue"
          >
            <Move className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => onRemoveBrand(row, 'failed')}
            disabled={disabled || isProcessingAction}
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
              loading={false}
            />
          </div>
          <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600">
            <span>Total: {failed.totalCount}</span>
            <span>Showing: {filteredFailedBrands.length}</span>
          </div>
        </div>
      </Card>

      <Card className="hidden md:block">
        {failed.error ? (
          <ErrorDisplay title="Error Loading Failed Queue" message={failed.error}>
            <Button onClick={() => onSearch('')}>Retry</Button>
          </ErrorDisplay>
        ) : filteredFailedBrands.length === 0 && (failed.loading || failed.isSearching) ? (
          <div className="text-center py-12 sm:py-16">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {failed.isSearching ? 'Searching...' : 'Loading...'}
                </h3>
                <p className="text-sm text-gray-500">
                  {failed.isSearching ? `Searching for "${failed.searchTerm}" across all pages` : 'Loading failed brands'}
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
          <div className="relative">
            <Table
              data={filteredFailedBrands}
              columns={failedColumns}
              emptyMessage="No failed brands found"
              className="shadow-md rounded-lg"
            />
            {failed.isSearching && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-start justify-center z-10 pt-16">
                <div className="flex flex-col items-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                  <div className="text-sm font-medium text-gray-900">
                    Searching...
                  </div>
                  <div className="text-xs text-gray-500">
                    Searching for "{failed.searchTerm}"
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="md:hidden space-y-3 relative">
        {failed.error ? (
          <Card>
            <ErrorDisplay title="Error Loading Failed Queue" message={failed.error}>
              <Button onClick={() => onSearch('')}>Retry</Button>
            </ErrorDisplay>
          </Card>
        ) : filteredFailedBrands.length === 0 ? (
          (failed.loading || failed.isSearching) ? (
            <Card>
              <div className="text-center py-8">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {failed.isSearching ? 'Searching...' : 'Loading...'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {failed.isSearching ? `Searching for "${failed.searchTerm}" across all pages` : 'Loading failed brands'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No failed brands found</h3>
                <p className="text-sm text-gray-500">
                  {failed.searchTerm ? 'Try adjusting your search terms' : 'All brands have been processed'}
                </p>
              </div>
            </Card>
          )
        ) : (
          <div className="relative">
            {filteredFailedBrands.map((brand, index) => {
              const position = (failed.currentPage - 1) * failed.itemsPerPage + index + 1;
              const brandName = brand.brand_name || 'Unknown Brand';
              const brandId = brand.queue_id || brand.brand_id || 'N/A';
              const pageId = brand.page_id || 'N/A';
              const errorMsg = brand.error_message || brand.error || brand.message || 'Unknown error';
              const parsedError = parseErrorMessage(errorMsg);

              return (
                <Card key={`${brandId}-${index}`} className="p-4 relative pb-16">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-red-600">
                            {position}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 text-lg">{brandName}</h3>
                      </div>
                    </div>

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

                    <div className="pt-2">
                      <span className="text-gray-500 text-sm">Error:</span>
                      <p className="text-sm text-red-600 mt-1 break-words font-medium" title={errorMsg}>
                        {parsedError}
                      </p>
                    </div>

                    <div className="flex flex-col space-y-2 pt-2">
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="info"
                          onClick={() => onMoveBrand(brand, 'pending')}
                          disabled={disabled || isProcessingAction}
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
                          disabled={disabled || isProcessingAction}
                          className="flex-1 text-xs"
                          title="Remove Brand"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>

                    {pageId && pageId !== 'N/A' && (
                      <button
                        onClick={() => {
                          const url = `https://www.facebook.com/ads/library/?ad_type=all&country=US&view_all_page_id=${pageId}`;
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
          </div>
        )}

        {failed.isSearching && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-start justify-center rounded-lg z-10 pt-16">
            <div className="flex flex-col items-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <div className="text-sm font-medium text-gray-900">
                Searching...
              </div>
              <div className="text-xs text-gray-500">
                Searching for "{failed.searchTerm}"
              </div>
            </div>
          </div>
        )}
      </div>

      <div id="failed-queue-pagination">
        <Pagination
          currentPage={failed.currentPage}
          totalPages={failedTotalPages}
          onPageChange={onPageChange}
          totalItems={failed.totalCount}
          itemsPerPage={failed.itemsPerPage}
          showPageInfo={true}
        />
      </div>
    </div>
  );
};

export default FailedQueue;