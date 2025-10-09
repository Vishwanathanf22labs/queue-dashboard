import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { Play, Clock, Pause, Square, Hourglass, ExternalLink } from 'lucide-react';
import { openFacebookAdLibrary } from '../../utils/facebookAdLibrary';

const ProcessingStatus = ({ 
  currentlyProcessing, 
  nextBrand, 
  scraperStatus, 
  scraperStatusLoading, 
  formattedStartTime,
  pendingCount = 0,
  failedCount = 0
}) => {
  const getScraperStatusInfo = (status) => {
    // Handle specific stopped reasons
    if (status && status.startsWith('stopped(')) {
      const reason = status.replace('stopped(', '').replace(')', '');
      let label = status; // Show the full status including reason
      
      // Map specific reasons to shorter labels for display
      switch (reason) {
        case 'cooldown NWL':
          label = 'Stopped (Cooldown Regular)';
          return { variant: 'cooldownNWL', icon: Square, label: label };
        case 'cooldown WL':
          label = 'Stopped (Cooldown Watchlist)';
          return { variant: 'cooldownWL', icon: Square, label: label };
        case 'Hold':
          label = 'Stopped (Hold)';
          break;
        default:
          label = status;
      }
      
      return { variant: 'warning', icon: Square, label: label };
    }
    
    // Handle direct cooldown status (not wrapped in stopped())
    if (status === 'cooldown(WL)' || status === 'cooldown (WL)') {
      return { variant: 'cooldownWL', icon: Square, label: 'Cooldown (Watchlist Only)' };
    }
    
    if (status === 'cooldown(NWL)' || status === 'cooldown (NWL)') {
      return { variant: 'cooldownNWL', icon: Square, label: 'Cooldown (Regular Only)' };
    }
    
    switch (status) {
      case 'running':
        return { variant: 'success', icon: Play, label: 'Running' };
      case 'paused':
        return { variant: 'warning', icon: Pause, label: 'Paused' };
      case 'stopped':
        return { variant: 'error', icon: Square, label: 'Stopped' };
      case 'not_running':
        return { variant: 'secondary', icon: Square, label: 'Not Running' };
      default:
        return { variant: 'secondary', icon: Clock, label: status || 'Unknown' };
    }
  };

  // Filter out watchlist brands - only show non-watchlist brands
  const getNonWatchlistCurrentlyProcessing = () => {
    if (!currentlyProcessing) {
      return [];
    }
    
    const processingArray = Array.isArray(currentlyProcessing) ? currentlyProcessing : [currentlyProcessing];
    return processingArray.filter(brand => {
      return brand && brand.is_watchlist !== true;
    });
  };

  const nonWatchlistProcessingBrands = getNonWatchlistCurrentlyProcessing();

  // Calculate total count (regular + watchlist currently processing)
  const totalCurrentlyProcessingCount = currentlyProcessing ? 
    (Array.isArray(currentlyProcessing) ? currentlyProcessing.length : 1) : 0;

  // Check if we should show waiting message (when scraper is running but no brand processing)
  // Show waiting when scraper is running and card is empty, regardless of queue count
  const shouldShowWaiting = scraperStatus === 'running' && (!currentlyProcessing || currentlyProcessing.length === 0);

  // Determine if status badge should be visible based on scraper status
  const shouldShowStatusBadge = () => {
    if (scraperStatus === 'cooldown(WL)' || scraperStatus === 'cooldown (WL)' || 
        scraperStatus === 'stopped(cooldown WL)') {
      return false;
    }
    
    // Show badge for all other statuses including cooldown(NWL)
    return true;
  };

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1">
      <Card>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Regular Currently Scraping
          </h3>
          {shouldShowStatusBadge() && !scraperStatusLoading && (
            (() => {
              // Show the actual API status instead of overriding it
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
        {nonWatchlistProcessingBrands.length > 0 ? (
          <div className="space-y-4">
            {/* Header with count */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                {totalCurrentlyProcessingCount} brand{totalCurrentlyProcessingCount !== 1 ? 's' : ''} processing
              </span>
            </div>

            {/* List of processing brands */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-96 overflow-y-auto scrollbar-hide">
              {nonWatchlistProcessingBrands.map((brand, index) => (
                <div key={`${brand.brand_id}-${brand.page_id}-${index}`} className="flex flex-col space-y-2 p-3 bg-gray-50 rounded-lg border min-h-[200px]">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Play className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {brand.brand_name || brand.page_name || brand.actual_name || 'Unknown Brand'}
                        </p>
                        {brand.page_id && (
                          <button
                            onClick={() => openFacebookAdLibrary(brand.page_id)}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="View in Facebook Ad Library"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1 flex-1">
                    <p className="text-xs text-gray-500">
                      ID: {brand.brand_id} | Page: {brand.page_id}
                    </p>
                    <p className="text-xs text-gray-500">
                      Status: {brand.status || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Started at {new Date(brand.started_at).toLocaleTimeString()}
                    </p>
                    {brand.processing_duration > 0 && (
                      <p className="text-xs text-gray-500">
                        Duration: {Math.round(brand.processing_duration / 1000)}s
                      </p>
                    )}
                    {brand.total_ads > 0 && (
                      <p className="text-xs text-gray-500">
                        Total Ads: {brand.total_ads}
                      </p>
                    )}
                    {brand.proxy && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">
                          IP: {brand.proxy.host}
                        </p>
                        <p className="text-xs text-gray-500">
                          Port: {brand.proxy.port}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end mt-auto pt-2">
                    {(() => {
                      const badgeVariant = brand.status === 'completed' || brand.status === 'complete' 
                        ? 'success' 
                        : brand.status === 'failed' 
                          ? 'error' 
                          : 'info';
                      return (
                        <Badge 
                          variant={badgeVariant} 
                          className="text-xs"
                        >
                          {brand.status === 'completed' || brand.status === 'complete' 
                            ? 'Completed' 
                            : brand.status === 'failed' 
                              ? 'Failed' 
                              : 'Active'
                          }
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              ))}
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
                  {pendingCount === 0 ? 'No brands in queue' : 'No regular brands currently processing'}
                </p>
              </>
            )}

          </div>
        )}
      </Card>

      {/* Only show Next in Line card when there are NO pending brands AND there are failed brands */}
      {pendingCount === 0 && failedCount > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Next in Line</h3>
            {nextBrand && Array.isArray(nextBrand) && nextBrand.length > 0 && (
              <span className="text-sm text-gray-500">{nextBrand.length} brands waiting</span>
            )}
          </div>
          {nextBrand && Array.isArray(nextBrand) && nextBrand.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {nextBrand.map((brand, index) => (
                <div key={brand.queue_id || index} className="flex flex-col space-y-2 p-3 bg-gray-50 rounded-lg border min-h-[140px]">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock className="h-3 w-3 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {brand.brand_name || brand.page_name || brand.actual_name || 'Unknown Brand'}
                        </p>
                        {brand.page_id && (
                          <button
                            onClick={() => openFacebookAdLibrary(brand.page_id)}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="View in Facebook Ad Library"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1 flex-1">
                    <p className="text-xs text-gray-500">
                      ID: {brand.queue_id || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Page: {brand.page_id || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Position: #{brand.queue_position || index + 1}
                    </p>
                  </div>
                  
                  <div className="flex justify-end mt-auto pt-2">
                    <Badge variant="info" className="text-xs">Waiting</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : nextBrand && !Array.isArray(nextBrand) ? (
            // Fallback for single brand object (backward compatibility)
            <div className="space-y-3">
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                        {nextBrand.brand_name || 'Unknown Brand'}
                      </p>
                      {nextBrand.page_id && (
                        <button
                          onClick={() => openFacebookAdLibrary(nextBrand.page_id)}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="View in Facebook Ad Library"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      )}
                    </div>
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