import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import Button from './Button';

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  showPageInfo = true,
  className = ''
}) => {

  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>

      {showPageInfo && (
        <div className="text-sm text-gray-700">
          Showing{' '}
          <span className="font-medium">
            {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}
          </span>
          {' '}to{' '}
          <span className="font-medium">
            {Math.min(currentPage * itemsPerPage, totalItems)}
          </span>
          {' '}of{' '}
          <span className="font-medium">{totalItems}</span>
          {' '}results
        </div>
      )}


      <div className="flex items-center gap-1">

        <Button
          variant="pagination"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-8 h-8 p-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>


        {visiblePages.map((page, index) => (
          <div key={index}>
            {page === '...' ? (
              <span className="flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-500">
                <MoreHorizontal className="w-4 h-4" />
              </span>
            ) : (
              <Button
                variant={page === currentPage ? 'pagination-active' : 'pagination'}
                size="sm"
                onClick={() => onPageChange(page)}
                className="w-8 h-8 p-0"
              >
                {page}
              </Button>
            )}
          </div>
        ))}

        <Button
          variant="pagination"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-8 h-8 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default Pagination;