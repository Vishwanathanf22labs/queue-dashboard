import React, { useState } from 'react';
import Card from '../components/ui/Card';
import ScraperControls from '../components/queue/ScraperControls';
import useAdminStore from '../stores/adminStore';
import { Shield } from 'lucide-react';

const ScraperControlsPage = () => {
  const { isAdmin, isLoading: adminLoading } = useAdminStore();
  const [scraperStatus, setScraperStatus] = useState('unknown');
  const [statusData, setStatusData] = useState(null);

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <div className="p-8 text-center">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-pink-100 border border-pink-200 rounded-full flex items-center justify-center">
                  <Shield className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Admin Access Required</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    This page requires administrator privileges. Please log in with<br className="hidden sm:block" />
                    your admin credentials to access scraper control features.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Scraper Controls</h1>
                <p className="text-base text-gray-600">Control and monitor the Facebook ads scraper process</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Admin Mode</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Scraper Controls Component */}
          <ScraperControls 
            onStatusChange={(status) => {
              setScraperStatus(status);
            }}
            onStatusDataChange={(data) => {
              setStatusData(data);
            }}
          />

          {/* Live Scraper Status Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Scraper Status</h3>
                <div className="space-y-4">
                  {/* Status Badge */}
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      scraperStatus === 'running' ? 'bg-green-500 animate-pulse' :
                      scraperStatus === 'paused' ? 'bg-yellow-500' :
                      scraperStatus === 'stopped' ? 'bg-red-500' : 'bg-gray-400'
                    }`}></div>
                    <span className={`font-medium ${
                      scraperStatus === 'running' ? 'text-green-700' :
                      scraperStatus === 'paused' ? 'text-yellow-700' :
                      scraperStatus === 'stopped' ? 'text-red-700' : 'text-gray-600'
                    }`}>
                      Status: {scraperStatus === 'running' ? 'Running' : 
                              scraperStatus === 'paused' ? 'Paused' : 
                              scraperStatus === 'stopped' ? 'Stopped' : 'Unknown'}
                    </span>
                  </div>
                  
                  {/* Brand Information */}
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
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue Information</h3>
                <div className="space-y-4">
                  {statusData ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-blue-600">{statusData.pending_count || 0}</div>
                          <div className="text-sm text-blue-700">Pending Brands</div>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-red-600">{statusData.failed_count || 0}</div>
                          <div className="text-sm text-red-700">Failed Brands</div>
                        </div>
                      </div>
                      
                      {scraperStatus === 'running' && statusData.pending_count > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="text-sm font-medium text-green-800 mb-2">Progress</div>
                          <div className="w-full bg-green-200 rounded-full h-2 mb-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${Math.max(0, Math.min(100, ((statusData.total_queued - statusData.pending_count) / statusData.total_queued) * 100))}%` 
                              }}
                            ></div>
                          </div>
                          <div className="text-sm text-green-600">
                            {statusData.pending_count} brands remaining in queue
                          </div>
                        </div>
                      )}
                      
                      <div className="text-sm text-gray-600">
                        Last updated: {statusData.timestamp ? new Date(statusData.timestamp).toLocaleString() : 'Never'}
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-500 text-center py-4">
                      No queue information available
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
