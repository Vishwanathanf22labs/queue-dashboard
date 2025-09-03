import Card from '../ui/Card';
import Table from '../ui/Table';
import Pagination from '../ui/Pagination';
import LoadingState from '../ui/LoadingState';
import ErrorDisplay from '../ui/ErrorDisplay';
import SearchInput from '../ui/SearchInput';
import Button from '../ui/Button';
import { Users, Tag, Move, Trash2, Search } from 'lucide-react';

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
      render: (value, row) => (
        <div className="flex items-center">
          <Users className="hidden sm:block h-4 w-4 text-gray-400 mr-2" />
          <div className="text-xs font-medium text-gray-900 max-w-[80px] sm:max-w-none truncate">
            {value || 'Unknown Brand'}
          </div>
        </div>
      )
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
              disabled={pending.loading || pending.isSearching}
            />
          </div>
          <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600">
            <span>Total: {pending.totalCount}</span>
            <span>Showing: {filteredPendingBrands.length}</span>
            {pending.searchTerm && (
              <span className="text-blue-600">
                {pending.isSearching ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                    Searching: "{pending.searchTerm}"
                  </span>
                ) : (
                  `Searching: "${pending.searchTerm}"`
                )}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card>
        {pending.error ? (
          <ErrorDisplay title="Error Loading Pending Queue" message={pending.error}>
            <Button onClick={() => onSearch('')}>Retry</Button>
          </ErrorDisplay>
        ) : pending.loading ? (
          <LoadingState size="lg" message="Loading pending brands..." />
        ) : pending.isSearching ? (
          <div className="text-center py-12 sm:py-16">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Searching...</h3>
                <p className="text-sm text-gray-500">
                  Searching for "{pending.searchTerm}" across all pages
                </p>
              </div>
            </div>
          </div>
        ) : filteredPendingBrands.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <Users className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No pending brands found</h3>
            <p className="text-sm sm:text-base text-gray-500">
              {pending.searchTerm ? 'Try adjusting your search terms' : 'All brands have been processed'}
            </p>
          </div>
        ) : (
          <Table
            data={filteredPendingBrands}
            columns={pendingColumns}
            emptyMessage="No pending brands found"
            className="shadow-md rounded-lg"
          />
        )}
      </Card>

      <Pagination
        currentPage={pending.currentPage}
        totalPages={pendingTotalPages}
        onPageChange={onPageChange}
        totalItems={pending.totalCount}
        itemsPerPage={pending.itemsPerPage}
        showPageInfo={true}
      />
    </div>
  );
};

export default PendingQueue;
