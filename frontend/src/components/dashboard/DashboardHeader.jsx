import Button from '../ui/Button';
import CustomDropdown from '../ui/CustomDropdown';
import { RefreshCw } from 'lucide-react';

const DashboardHeader = ({ 
  refreshInterval, 
  isRefreshing, 
  onManualRefresh, 
  onIntervalChange 
}) => {
  const refreshIntervals = [
    { value: 0, label: 'Off' },
    { value: 5, label: '5s' },
    { value: 10, label: '10s' },
    { value: 15, label: '15s' },
    { value: 20, label: '20s' },
    { value: 30, label: '30s' },
    { value: 1800, label: '30min' }
  ];

  return (
    <div className="mb-4 sm:mb-6 lg:mb-8">
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="pr-4 sm:pr-8 lg:pr-16 xl:pr-0">
          <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900">Madangles Queues</h1>
          <p className="text-xs sm:text-sm lg:text-base text-gray-600">Monitor your brand processing queue</p>
        </div>

        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-3">
          <div className="relative flex items-center border border-gray-300 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow w-full sm:w-auto">
            <button
              onClick={onManualRefresh}
              disabled={isRefreshing}
              className="flex items-center px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 border-r border-gray-300 rounded-l-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
              title="Click to refresh now"
            >
              <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              <span className="xs:hidden">Refresh</span>
            </button>

            <CustomDropdown
              options={refreshIntervals}
              value={refreshInterval}
              onChange={onIntervalChange}
              placeholder="Off"
              className="[&>div>button]:border-0 [&>div>button]:rounded-none [&>div>button]:rounded-r-lg [&>div>button]:bg-transparent [&>div>button]:py-1.5 w-16 sm:w-20"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
