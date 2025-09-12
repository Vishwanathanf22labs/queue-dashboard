import Card from '../ui/Card';
import { Clock, AlertTriangle, Play, Eye, List, XCircle, BarChart3 } from 'lucide-react';

const DashboardStats = ({ 
  pendingCount, 
  failedCount, 
  activeCount, 
  brandsScrapedToday,
  watchlistPendingCount = 0,
  watchlistFailedCount = 0,
  watchlistCompletedCount = 0,
  adsProcessed = 0
}) => {
  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      {/* Main Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-yellow-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">Pending Queue</p>
              <div className="space-y-1">
                <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-yellow-600">{pendingCount}</p>
                {pendingCount === 0 && failedCount === 0 && (
                  <p className="text-xs text-gray-700">cooldown applied</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-red-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">Failed Queue</p>
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
              <p className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">Active Brands</p>
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
              <p className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">Brands Scraped</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-blue-600">{brandsScrapedToday}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Watchlist and Processing Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
              <List className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-purple-600" />
            </div>
             <div className="ml-2 sm:ml-3 lg:ml-4 flex-1 min-w-0">
               <p className="text-xs sm:text-sm font-medium text-gray-600 break-words">Watchlist Pending</p>
               <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600">{watchlistPendingCount}</p>
             </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-orange-100 rounded-lg">
              <XCircle className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-orange-600" />
            </div>
             <div className="ml-2 sm:ml-3 lg:ml-4 flex-1 min-w-0">
               <p className="text-xs sm:text-sm font-medium text-gray-600 break-words">Watchlist Failed</p>
               <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600">{watchlistFailedCount}</p>
             </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
              <Eye className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-green-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 break-words">Watchlist Completed</p>
              <div className="space-y-1">
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">{watchlistCompletedCount}</p>
                {watchlistPendingCount === 0 && (
                  <p className="text-xs text-gray-700">cooldown applied</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-indigo-100 rounded-lg">
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-indigo-600" />
            </div>
             <div className="ml-2 sm:ml-3 lg:ml-4 flex-1 min-w-0">
               <p className="text-xs sm:text-sm font-medium text-gray-600 break-words">Ads Processed</p>
               <p className="text-lg sm:text-xl lg:text-2xl font-bold text-indigo-600">{adsProcessed}</p>
             </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardStats;
