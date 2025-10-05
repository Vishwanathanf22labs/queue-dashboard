import React from 'react';
import CustomDropdown from './CustomDropdown';
import { RefreshCw } from 'lucide-react';

// A reusable refresh control identical to the Dashboard's control
// Props:
// - isRefreshing: boolean
// - refreshInterval: number (seconds)
// - onManualRefresh: () => void
// - onIntervalChange: (value: number) => void
// - className?: string
const RefreshControl = ({
  isRefreshing = false,
  refreshInterval = 0,
  onManualRefresh,
  onIntervalChange,
  className = ''
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
    <div className={`relative flex items-center border border-gray-300 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow w-full sm:w-auto h-10 ${className}`}>
      <button
        onClick={onManualRefresh}
        disabled={isRefreshing}
        className="flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 border-r border-gray-300 rounded-l-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none h-10"
        title="Click to refresh now"
        type="button"
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
  );
};

export default RefreshControl;


