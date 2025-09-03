import Card from '../ui/Card';
import { Link } from 'react-router-dom';
import { Clock, AlertTriangle, Globe, ArrowRight, List, XCircle } from 'lucide-react';

const QuickActions = ({ pendingCount, failedCount, watchlistPendingCount, watchlistFailedCount }) => {
  return (
    <Card>
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Link
          to="/pending-queue"
          className="flex items-center p-3 sm:p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 mr-2 sm:mr-3 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-blue-900 text-sm sm:text-base">View Pending Queue</p>
            <p className="text-xs sm:text-sm text-blue-600">{pendingCount} brands waiting</p>
          </div>
          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 ml-auto flex-shrink-0" />
        </Link>

        <Link
          to="/failed-queue"
          className="flex items-center p-3 sm:p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 mr-2 sm:mr-3 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-red-900 text-sm sm:text-base">View Failed Queue</p>
            <p className="text-xs sm:text-sm text-red-600">{failedCount} brands failed</p>
          </div>
          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 ml-auto flex-shrink-0" />
        </Link>

        <Link
          to="/watchlist-queues"
          className="flex items-center p-3 sm:p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
        >
          <List className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 mr-2 sm:mr-3 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base font-medium text-purple-900">Watchlist Queues</p>
            <p className="text-xs sm:text-sm text-purple-600">{watchlistPendingCount + watchlistFailedCount || 0} total brands</p>
          </div>
          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 ml-auto flex-shrink-0" />
        </Link>

        <Link
          to="/proxies"
          className="flex items-center p-3 sm:p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
        >
          <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 mr-2 sm:mr-3 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-green-900 text-sm sm:text-base">Manage Proxies</p>
            <p className="text-xs sm:text-sm text-green-600">Configure & monitor</p>
          </div>
          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 ml-auto flex-shrink-0" />
        </Link>
      </div>
    </Card>
  );
};

export default QuickActions;
