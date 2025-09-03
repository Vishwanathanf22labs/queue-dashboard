import { useState } from 'react';
import Card from '../components/ui/Card';
import ScraperControls from '../components/queue/ScraperControls';
import PriorityQueueManager from '../components/queue/PriorityQueueManager';
import AdminAccessRequired from '../components/ui/AdminAccessRequired';
import useAdminStore from '../stores/adminStore';
import { Shield } from 'lucide-react';

const ScraperControlsPage = () => {
  const { isAdmin, isLoading: adminLoading } = useAdminStore();
  const [state, setState] = useState({
    scraperStatus: 'unknown',
    statusData: null
  });

  const { scraperStatus, statusData } = state;

  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

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
          <ScraperControls
            onStatusChange={(status) => {
              updateState({ scraperStatus: status });
            }}
            onStatusDataChange={(data) => {
              updateState({ statusData: data });
            }}
          />

          <PriorityQueueManager />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Scraper Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${scraperStatus === 'running' ? 'bg-green-500 animate-pulse' :
                      scraperStatus === 'paused' ? 'bg-yellow-500' :
                        scraperStatus === 'stopped' ? 'bg-red-500' :
                        scraperStatus === 'not_running' ? 'bg-gray-500' : 'bg-gray-400'
                      }`}></div>
                    <span className={`font-medium ${scraperStatus === 'running' ? 'text-green-700' :
                      scraperStatus === 'paused' ? 'text-yellow-700' :
                        scraperStatus === 'stopped' ? 'text-red-700' :
                        scraperStatus === 'not_running' ? 'text-gray-700' : 'text-gray-600'
                      }`}>
                      Status: {scraperStatus === 'running' ? 'Running' :
                        scraperStatus === 'paused' ? 'Paused' :
                          scraperStatus === 'stopped' ? 'Stopped' :
                          scraperStatus === 'not_running' ? 'Not Running' : 'Unknown'}
                    </span>
                  </div>

                  {statusData && (
                    <div className="space-y-3">
                      {scraperStatus === 'running' && statusData.current_brand && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="text-sm font-medium text-green-800 mb-2">Currently Processing:</div>
                          <div className="text-sm text-green-700">Brand: {statusData.current_brand.name}</div>
                          <div className="text-sm text-green-600">Page ID: {statusData.current_brand.page_id}</div>
                          {statusData.current_brand.started_at && (
                            <div className="text-sm text-green-600">Started: {new Date(statusData.current_brand.started_at).toLocaleString()}</div>
                          )}
                        </div>
                      )}

                      {scraperStatus === 'paused' && statusData.paused_brand && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <div className="text-sm font-medium text-yellow-800 mb-2">Paused At Brand:</div>
                          <div className="text-sm text-yellow-700">Brand: {statusData.paused_brand.name}</div>
                          <div className="text-sm text-yellow-600">Page ID: {statusData.paused_brand.page_id}</div>
                          {statusData.paused_at && (
                            <div className="text-sm text-yellow-600">Paused: {new Date(statusData.paused_at).toLocaleString()}</div>
                          )}
                        </div>
                      )}

                      {scraperStatus === 'stopped' && statusData.last_processed_brand && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="text-sm font-medium text-red-800 mb-2">Last Processed Brand:</div>
                          <div className="text-sm text-red-700">Brand: {statusData.last_processed_brand.name}</div>
                          <div className="text-sm text-red-600">Page ID: {statusData.last_processed_brand.page_id}</div>
                          {statusData.stopped_at && (
                            <div className="text-sm text-red-600">Stopped: {new Date(statusData.stopped_at).toLocaleString()}</div>
                          )}
                        </div>
                      )}

                      {scraperStatus === 'not_running' && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="text-sm font-medium text-gray-800 mb-2">Scraper Status:</div>
                          <div className="text-sm text-gray-700">No brands currently processing</div>
                          <div className="text-sm text-gray-600">The scraper appears to be idle</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>


          </div>
        </div>
      </div>
    </div>
  );
};

export default ScraperControlsPage;
