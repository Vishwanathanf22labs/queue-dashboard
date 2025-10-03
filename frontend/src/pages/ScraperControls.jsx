import ScraperControls from '../components/queue/ScraperControls';
import PriorityQueueManager from '../components/queue/PriorityQueueManager';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import useAdminStore from '../stores/adminStore';
import { Shield } from 'lucide-react';

const ScraperControlsPage = () => {
  const { isAdmin, isLoading: adminLoading } = useAdminStore();

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
              <div className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-red-600 bg-red-100 rounded-lg">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Admin Access Required
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <ScraperControls disabled={!isAdmin} />

          <PriorityQueueManager disabled={!isAdmin} />

        </div>
      </div>
    </div>
  );
};

export default ScraperControlsPage;
