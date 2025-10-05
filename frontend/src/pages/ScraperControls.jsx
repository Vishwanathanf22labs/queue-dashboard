import { useState, useCallback } from 'react';
import ScraperControls from '../components/queue/ScraperControls';
import PriorityQueueManager from '../components/queue/PriorityQueueManager';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import RefreshControl from '../components/ui/RefreshControl';
import { useAdminLogin } from '../contexts/AdminLoginContext';
import useAdminStore from '../stores/adminStore';
import useAutoRefresh from '../hooks/useAutoRefresh';
import toast from 'react-hot-toast';
import { Shield } from 'lucide-react';

const ScraperControlsPage = () => {
  const { isAdmin, isLoading: adminLoading } = useAdminStore();
  const [componentKey, setComponentKey] = useState(0);
  const { onAdminLogin } = useAdminLogin();

  // Auto-refresh hook - remounts children to refresh both sections
  const refreshFn = useCallback(() => {
    try {
      setComponentKey(k => k + 1);
      toast.success('Scraper controls refreshed successfully');
    } catch (error) {
      console.error('ScraperControls refresh failed:', error);
    }
  }, []);

  const { refreshInterval, isRefreshing, setIntervalValue, manualRefresh } = useAutoRefresh(
    refreshFn,
    []
  );

  const handleRefresh = async () => {
    await manualRefresh();
  };

  if (adminLoading) {
    return <LoadingSpinner />;
  }


  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Admin Access Badge */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Scraper Controls</h1>
              <p className="text-xs sm:text-sm lg:text-base text-gray-600">Monitor and control scraper status</p>
            </div>
            
            {!isAdmin && (
              <button
                onClick={onAdminLogin}
                className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors cursor-pointer"
              >
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Admin Access Required
              </button>
            )}

            <RefreshControl
              isRefreshing={isRefreshing}
              refreshInterval={refreshInterval}
              onManualRefresh={handleRefresh}
              onIntervalChange={setIntervalValue}
            />
          </div>
        </div>

        <div className="space-y-6">
          <ScraperControls key={`scraper-${componentKey}`} disabled={!isAdmin} />

          <PriorityQueueManager key={`priority-${componentKey}`} disabled={!isAdmin} />

        </div>
      </div>
    </div>
  );
};

export default ScraperControlsPage;
