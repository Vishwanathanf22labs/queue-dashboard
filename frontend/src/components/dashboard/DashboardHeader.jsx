import Button from '../ui/Button';
import CustomDropdown from '../ui/CustomDropdown';
import CooldownIndicator from './CooldownIndicator';
import { RefreshCw, Shield, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useEnvironmentStore from '../../stores/environmentStore';
import useAdminStore from '../../stores/adminStore';
import { useAdminLogin } from '../../contexts/AdminLoginContext';

const DashboardHeader = ({ 
  refreshInterval, 
  isRefreshing, 
  onManualRefresh, 
  onIntervalChange,
  scraperStatus,
  scraperStatusData
}) => {
  const { currentEnvironment } = useEnvironmentStore();
  const { isAdmin, logout } = useAdminStore();
  const { onAdminLogin } = useAdminLogin();
  const navigate = useNavigate();
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-xs sm:text-sm lg:text-base text-gray-600">Manage your brands</p>
            </div>
            <div className="mt-2 sm:mt-0 sm:ml-4">
              <CooldownIndicator
                scraperStatus={scraperStatus}
                scraperStatusData={scraperStatusData}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-3">
          {/* Current Environment Display */}
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg shadow-sm h-10 transition-colors cursor-pointer"
            title="Click to go to Settings page"
          >
            <div className={`w-2 h-2 rounded-full ${currentEnvironment === 'production' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
            <span className="text-sm font-medium text-gray-700">
              {currentEnvironment === 'production' ? 'Production' : 'Stage'}
            </span>
          </button>

          {/* Admin Login/Logout Button */}
          {isAdmin ? (
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors h-10"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          ) : (
            <button
              onClick={onAdminLogin}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors h-10"
            >
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Admin Login</span>
            </button>
          )}

          <div className="relative flex items-center border border-gray-300 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow w-full sm:w-auto h-10">
            <button
              onClick={onManualRefresh}
              disabled={isRefreshing}
              className="flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 border-r border-gray-300 rounded-l-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none h-10"
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
