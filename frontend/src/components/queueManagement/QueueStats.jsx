import Card from '../ui/Card';
import { Users, AlertTriangle, RefreshCw } from 'lucide-react';

const QueueStats = ({ pendingCount, failedCount }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-3 sm:mb-4 lg:mb-6">
      <Card>
        <div className="flex items-center">
          <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-blue-600" />
          </div>
          <div className="ml-2 sm:ml-3 lg:ml-4">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Total Pending</p>
            <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-blue-600">
              {pendingCount}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center">
          <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-red-600" />
          </div>
          <div className="ml-2 sm:ml-3 lg:ml-4">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Total Failed</p>
            <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-red-600">
              {failedCount}
            </p>
          </div>
        </div>
      </Card>

      <Card className="sm:col-span-2 lg:col-span-1">
        <div className="flex items-center">
          <div className="p-2 sm:p-3 bg-gray-100 rounded-lg">
            <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600" />
          </div>
          <div className="ml-2 sm:ml-3 lg:ml-4">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Total Brands</p>
            <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-600">
              {pendingCount + failedCount}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default QueueStats;
