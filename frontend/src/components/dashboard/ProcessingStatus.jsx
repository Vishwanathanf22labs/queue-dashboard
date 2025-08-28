import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { Play, Clock, Pause, Square, Hourglass } from 'lucide-react';

const ProcessingStatus = ({ 
  currentlyProcessing, 
  nextBrand, 
  scraperStatus, 
  scraperStatusLoading, 
  formattedStartTime,
  pendingCount = 0
}) => {
  const getScraperStatusInfo = (status) => {
    switch (status) {
      case 'running':
        return { variant: 'success', icon: Play, label: 'Running' };
      case 'paused':
        return { variant: 'warning', icon: Pause, label: 'Paused' };
      case 'stopped':
        return { variant: 'error', icon: Square, label: 'Stopped' };
      default:
        return { variant: 'secondary', icon: Clock, label: 'Unknown' };
    }
  };

  // Check if we should show waiting message (when scraper is running but no brand processing)
  // Only show waiting when there are NO pending brands in queue
  const shouldShowWaiting = scraperStatus === 'running' && !currentlyProcessing && pendingCount === 0;

  return (
    <div className={`grid gap-4 sm:gap-6 ${pendingCount === 0 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
      <Card>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Currently Processing</h3>
        {currentlyProcessing ? (
          <div className="space-y-3">
            <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Play className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                    {currentlyProcessing.brand_name || 'Unknown Brand'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    ID: {currentlyProcessing.brand_id} | Page: {currentlyProcessing.page_id}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Status: {currentlyProcessing.status || 'Unknown'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Started at {formattedStartTime}
                  </p>
                  {currentlyProcessing.processing_duration > 0 && (
                    <p className="text-xs sm:text-sm text-gray-500">
                      Duration: {Math.round(currentlyProcessing.processing_duration / 1000)}s
                    </p>
                  )}
                  {currentlyProcessing.total_ads > 0 && (
                    <p className="text-xs sm:text-sm text-gray-500">
                      Total Ads: {currentlyProcessing.total_ads}
                    </p>
                  )}
                  {currentlyProcessing.proxy && (
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-gray-500">
                        IP: {currentlyProcessing.proxy.proxy?.host}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        Port: {currentlyProcessing.proxy.proxy?.port}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <Badge 
                  variant={currentlyProcessing.status === 'complete' ? 'success' : 'info'} 
                  className="self-start sm:self-auto"
                >
                  {currentlyProcessing.status === 'complete' ? 'Completed' : 'Active'}
                </Badge>

                {!scraperStatusLoading && (
                  (() => {
                    const statusInfo = getScraperStatusInfo(scraperStatus);
                    const StatusIcon = statusInfo.icon;
                    return (
                      <Badge variant={statusInfo.variant} className="flex items-center space-x-1">
                        <StatusIcon className="h-3 w-3" />
                        <span>{statusInfo.label}</span>
                      </Badge>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 sm:py-8">
            {shouldShowWaiting ? (
              <>
                <Hourglass className="h-8 w-8 sm:h-12 sm:w-12 text-yellow-500 mx-auto mb-2 sm:mb-3" />
                <p className="text-gray-900 text-sm sm:text-base font-medium mb-2">Waiting for next brand to scrape</p>
                <p className="text-gray-500 text-xs sm:text-sm">The scraper is running and will process the next brand in queue</p>
              </>
            ) : (
              <>
                <Play className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
                <p className="text-gray-500 text-sm sm:text-base">
                  {pendingCount === 0 ? 'No brands in queue' : 'No brand currently processing'}
                </p>
              </>
            )}

            {!scraperStatusLoading && (
              <div className="mt-3">
                {(() => {
                  const statusInfo = getScraperStatusInfo(scraperStatus);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <Badge variant={statusInfo.variant} className="inline-flex items-center space-x-1">
                      <StatusIcon className="h-3 w-3" />
                      <span>{statusInfo.label}</span>
                    </Badge>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Only show Next in Line card when there are NO pending brands */}
      {pendingCount === 0 && (
        <Card>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Next in Line</h3>
          {nextBrand ? (
            <div className="space-y-3">
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                      {nextBrand.brand_name || 'Unknown Brand'}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      ID: {nextBrand.queue_id || 'N/A'} | Page: {nextBrand.page_id || 'N/A'}
                    </p>
                  </div>
                </div>
                <Badge variant="info" className="self-start sm:self-auto">Waiting</Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <Clock className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
              <p className="text-gray-500 text-sm sm:text-base">No brands in queue</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default ProcessingStatus;
