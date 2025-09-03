import Button from '../ui/Button';
import { Trash2, ArrowRight, ArrowLeft } from 'lucide-react';

const QueueControls = ({ isProcessingAction, onAdminAction }) => {
  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Queue Management Controls</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
        <Button
          variant="danger"
          onClick={() => onAdminAction('Clear All Queues')}
          disabled={isProcessingAction}
          className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
        >
          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Clear All Queues</span>
          <span className="sm:hidden">Clear All</span>
        </Button>

        <Button
          variant="warning"
          onClick={() => onAdminAction('Clear Pending Queue')}
          disabled={isProcessingAction}
          className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
        >
          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Clear Pending Queue</span>
          <span className="sm:hidden">Clear Pending</span>
        </Button>

        <Button
          variant="warning"
          onClick={() => onAdminAction('Clear Failed Queue')}
          disabled={isProcessingAction}
          size="sm"
          className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
        >
          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
          <span>
            <span className="hidden sm:inline">Clear Failed Queue</span>
            <span className="sm:hidden">Clear Failed</span>
          </span>
        </Button>

        <Button
          variant="info"
          onClick={() => onAdminAction('Move All Pending to Failed')}
          disabled={isProcessingAction}
          className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
        >
          <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden lg:inline">All Pending → Failed</span>
          <span className="hidden sm:inline lg:hidden">Pending → Failed</span>
          <span className="sm:hidden">P→F</span>
        </Button>

        <Button
          variant="success"
          onClick={() => onAdminAction('Move All Failed to Pending')}
          disabled={isProcessingAction}
          className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-2.5"
        >
          <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden lg:inline">All Failed → Pending</span>
          <span className="hidden sm:inline lg:hidden">Failed → Pending</span>
          <span className="sm:hidden">F→P</span>
        </Button>
      </div>
    </div>
  );
};

export default QueueControls;
