import ScraperControls from '../components/queue/ScraperControls';
import PriorityQueueManager from '../components/queue/PriorityQueueManager';
import AdminAccessRequired from '../components/ui/AdminAccessRequired';
import useAdminStore from '../stores/adminStore';

const ScraperControlsPage = () => {
  const { isAdmin, isLoading: adminLoading } = useAdminStore();

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return <AdminAccessRequired />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">



        <div className="space-y-6">
          <ScraperControls />

          <PriorityQueueManager />

        </div>
      </div>
    </div>
  );
};

export default ScraperControlsPage;
