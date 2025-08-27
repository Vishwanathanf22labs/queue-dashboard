import Card from '../ui/Card';
import { Clock, AlertTriangle, Play, Eye } from 'lucide-react';

const DashboardStats = ({ 
  pendingCount, 
  failedCount, 
  activeCount, 
  processedAdsToday 
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      <Card>
        <div className="flex items-center">
          <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg">
            <Clock className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-yellow-600" />
          </div>
          <div className="ml-2 sm:ml-3 lg:ml-4">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Pending Queue</p>
            <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-yellow-600">{pendingCount}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center">
          <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-red-600" />
          </div>
          <div className="ml-2 sm:ml-3 lg:ml-4">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Failed Queue</p>
            <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-red-600">{failedCount}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center">
          <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
            <Play className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-green-600" />
          </div>
          <div className="ml-2 sm:ml-3 lg:ml-4">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Active Brands</p>
            <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-green-600">{activeCount}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center">
          <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
            <Eye className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-blue-600" />
          </div>
          <div className="ml-2 sm:ml-3 lg:ml-4">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Processed Ads</p>
            <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-blue-600">{processedAdsToday}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DashboardStats;
