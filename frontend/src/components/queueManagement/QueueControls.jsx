import Button from '../ui/Button';
import { Trash2, ArrowRight, ArrowLeft, X } from 'lucide-react';

const QueueControls = ({ isProcessingAction, onAdminAction, confirmDialogState, onConfirmDialogStateChange, disabled = false }) => {
  const { showConfirmDialog, confirmText, confirmAction } = confirmDialogState;

  const handleClearAllClick = () => {
    onConfirmDialogStateChange({
      showConfirmDialog: true,
      confirmText: '',
      confirmAction: 'Clear All Queues'
    });
  };

  const handleClearCurrentlyScrapingClick = () => {
    onConfirmDialogStateChange({
      showConfirmDialog: true,
      confirmText: '',
      confirmAction: 'Clear Currently Scraping'
    });
  };

  const handleWatchlistClearPendingClick = () => {
    onConfirmDialogStateChange({
      showConfirmDialog: true,
      confirmText: '',
      confirmAction: 'Clear Watchlist Pending Queue'
    });
  };

  const handleWatchlistClearFailedClick = () => {
    onConfirmDialogStateChange({
      showConfirmDialog: true,
      confirmText: '',
      confirmAction: 'Clear Watchlist Failed Queue'
    });
  };

  const handleWatchlistPendingToFailedClick = () => {
    onConfirmDialogStateChange({
      showConfirmDialog: true,
      confirmText: '',
      confirmAction: 'Move All Watchlist Pending to Failed'
    });
  };

  const handleWatchlistFailedToPendingClick = () => {
    onConfirmDialogStateChange({
      showConfirmDialog: true,
      confirmText: '',
      confirmAction: 'Move All Watchlist Failed to Pending'
    });
  };

  const handleClearPendingClick = () => {
    onConfirmDialogStateChange({
      showConfirmDialog: true,
      confirmText: '',
      confirmAction: 'Clear Pending Queue'
    });
  };

  const handleClearFailedClick = () => {
    onConfirmDialogStateChange({
      showConfirmDialog: true,
      confirmText: '',
      confirmAction: 'Clear Failed Queue'
    });
  };

  const handlePendingToFailedClick = () => {
    onConfirmDialogStateChange({
      showConfirmDialog: true,
      confirmText: '',
      confirmAction: 'Move All Pending to Failed'
    });
  };

  const handleFailedToPendingClick = () => {
    onConfirmDialogStateChange({
      showConfirmDialog: true,
      confirmText: '',
      confirmAction: 'Move All Failed to Pending'
    });
  };

  const handleConfirmAction = () => {
    if (confirmText.toLowerCase() === 'confirm') {
      onAdminAction(confirmAction);
      onConfirmDialogStateChange({
        showConfirmDialog: false,
        confirmText: '',
        confirmAction: ''
      });
    }
  };

  const handleCancelAction = () => {
    onConfirmDialogStateChange({
      showConfirmDialog: false,
      confirmText: '',
      confirmAction: ''
    });
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Queue Management Controls</h2>
      
      {/* Clear All Queues - Common */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <Button
            variant="danger"
            onClick={handleClearAllClick}
            disabled={disabled || isProcessingAction}
            className="flex items-center justify-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5 px-3 sm:px-4"
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Clear All Queues</span>
            <span className="sm:hidden">Clear All</span>
          </Button>
          
          <Button
            variant="danger"
            onClick={handleClearCurrentlyScrapingClick}
            disabled={disabled || isProcessingAction}
            className="flex items-center justify-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5 px-3 sm:px-4"
          >
            <X className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Clear Currently Scraping</span>
            <span className="sm:hidden">Clear Scraping</span>
          </Button>

          {/* Clear Cache Only (Cache Redis) */}
          <Button
            variant="danger"
            onClick={() => onConfirmDialogStateChange({
              showConfirmDialog: true,
              confirmText: '',
              confirmAction: 'Clear Cache Only'
            })}
            disabled={disabled || isProcessingAction}
            className="flex items-center justify-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5 px-3 sm:px-4"
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Clear Cache Only</span>
            <span className="sm:hidden">Clear Cache</span>
          </Button>
        </div>
      </div>

      {/* Regular Queue Controls */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Regular Queues</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <Button
            variant="warning"
            onClick={handleClearPendingClick}
            disabled={disabled || isProcessingAction}
            className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Clear Pending Queue</span>
            <span className="sm:hidden">Clear Pending</span>
          </Button>

          <Button
            variant="warning"
            onClick={handleClearFailedClick}
            disabled={disabled || isProcessingAction}
            className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Clear Failed Queue</span>
            <span className="sm:hidden">Clear Failed</span>
          </Button>

          <Button
            variant="info"
            onClick={handlePendingToFailedClick}
            disabled={disabled || isProcessingAction}
            className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
          >
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden lg:inline">All Pending → Failed</span>
            <span className="hidden sm:inline lg:hidden">Pending → Failed</span>
            <span className="sm:hidden">P→F</span>
          </Button>

          <Button
            variant="success"
            onClick={handleFailedToPendingClick}
            disabled={disabled || isProcessingAction}
            className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
          >
            <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden lg:inline">All Failed → Pending</span>
            <span className="hidden sm:inline lg:hidden">Failed → Pending</span>
            <span className="sm:hidden">F→P</span>
          </Button>
        </div>
      </div>

      {/* Watchlist Queue Controls */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Watchlist Queues</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <Button
            variant="warning"
            onClick={handleWatchlistClearPendingClick}
            disabled={disabled || isProcessingAction}
            className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Clear Watchlist Pending</span>
            <span className="sm:hidden">Clear WL Pending</span>
          </Button>

          <Button
            variant="warning"
            onClick={handleWatchlistClearFailedClick}
            disabled={disabled || isProcessingAction}
            className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Clear Watchlist Failed</span>
            <span className="sm:hidden">Clear WL Failed</span>
          </Button>

          <Button
            variant="info"
            onClick={handleWatchlistPendingToFailedClick}
            disabled={disabled || isProcessingAction}
            className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
          >
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden lg:inline">WL Pending → Failed</span>
            <span className="hidden sm:inline lg:hidden">WL P→F</span>
            <span className="sm:hidden">WL P→F</span>
          </Button>

          <Button
            variant="success"
            onClick={handleWatchlistFailedToPendingClick}
            disabled={disabled || isProcessingAction}
            className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
          >
            <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden lg:inline">WL Failed → Pending</span>
            <span className="hidden sm:inline lg:hidden">WL F→P</span>
            <span className="sm:hidden">WL F→P</span>
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Confirm {confirmAction}</h3>
              <button
                onClick={handleCancelAction}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                {confirmAction === 'Clear All Queues' 
                  ? 'This action will permanently clear ALL queues (both regular and watchlist pending/failed queues). This action cannot be undone.'
                  : confirmAction === 'Clear Cache Only'
                    ? 'This will safely clear only Cache Redis (pipeline, queue, brand caches) and related frontend cache data. Admin login and other important data will remain untouched. Type confirm to proceed.'
                    : confirmAction.includes('Clear')
                    ? `This action will permanently clear the ${confirmAction.toLowerCase().replace('clear ', '').replace(' queue', '')} queue. This action cannot be undone.`
                  : `This action will move all brands in the ${confirmAction.toLowerCase().replace('move all ', '').replace(' to ', ' → ')}. This action cannot be undone.`
                }
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Type <strong>"confirm"</strong> to proceed:
              </p>
              
              <input
                type="text"
                value={confirmText}
                onChange={(e) => onConfirmDialogStateChange({
                  ...confirmDialogState,
                  confirmText: e.target.value
                })}
                placeholder="Type 'confirm' here"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={handleCancelAction}
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                variant={confirmAction.includes('Clear') ? 'danger' : confirmAction.includes('Failed to Pending') ? 'success' : 'info'}
                onClick={handleConfirmAction}
                disabled={confirmText.toLowerCase() !== 'confirm' || isProcessingAction}
                className="px-4 py-2"
              >
                {isProcessingAction ? 'Processing...' : confirmAction}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueueControls;
