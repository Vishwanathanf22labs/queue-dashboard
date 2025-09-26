import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { Play, Clock, Eye, Hourglass, ExternalLink } from 'lucide-react';
import { openFacebookAdLibrary } from '../../utils/facebookAdLibrary';

const WatchlistProcessingStatus = ({ 
  currentlyProcessing, 
  watchlistPendingCount = 0,
  nextWatchlistBrand = null
}) => {
  // Filter brands that have is_watchlist: true
  const getWatchlistCurrentlyProcessing = () => {
    if (!currentlyProcessing) {
      return [];
    }

    // Handle both single brand and array of brands
    const processingArray = Array.isArray(currentlyProcessing) ? currentlyProcessing : [currentlyProcessing];
    
    // Filter brands that are in the watchlist
    return processingArray.filter(brand => {
      return brand && brand.is_watchlist === true;
    });
  };

  const watchlistProcessingBrands = getWatchlistCurrentlyProcessing();

  // Check if we should show waiting message (when scraper is running but no watchlist brand processing)
  // Only show waiting when there are NO pending watchlist brands in queue
  const shouldShowWaiting = (!currentlyProcessing || currentlyProcessing.length === 0) && watchlistPendingCount === 0;

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1">
      <Card>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
          Watchlist Currently Scraping
        </h3>
        
        {watchlistProcessingBrands.length > 0 ? (
          <div className="space-y-4">
            {/* Header with count */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                {watchlistProcessingBrands.length} watchlist brand{watchlistProcessingBrands.length !== 1 ? 's' : ''} processing
              </span>
              <Badge variant="info" className="flex items-center space-x-1">
                <Eye className="h-3 w-3" />
                <span>Watchlist</span>
              </Badge>
            </div>

            {/* List of processing watchlist brands */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-96 overflow-y-auto scrollbar-hide">
              {watchlistProcessingBrands.map((brand, index) => (
                <div key={`${brand.brand_id}-${brand.page_id}-${index}`} className="flex flex-col space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200 min-h-[200px]">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Play className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
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
                      console.log(`Watchlist Brand ${brand.brand_id}: status="${brand.status}", variant="${badgeVariant}"`);
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
                <p className="text-gray-900 text-sm sm:text-base font-medium mb-2">Waiting for next watchlist brand to scrape</p>
                <p className="text-gray-500 text-xs sm:text-sm">The scraper will process the next watchlist brand in queue</p>
              </>
            ) : (
              <>
                <Eye className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
                <p className="text-gray-500 text-sm sm:text-base">
                  {watchlistPendingCount === 0 ? 'No watchlist brands in queue' : 'No watchlist brands currently processing'}
                </p>
              </>
            )}
          </div>
        )}
      </Card>

      {watchlistPendingCount === 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Next in Line</h3>
            {nextWatchlistBrand && Array.isArray(nextWatchlistBrand) && nextWatchlistBrand.length > 0 && (
              <span className="text-sm text-gray-500">{nextWatchlistBrand.length} brands waiting</span>
            )}
          </div>
          {nextWatchlistBrand && Array.isArray(nextWatchlistBrand) && nextWatchlistBrand.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {nextWatchlistBrand.map((brand, index) => (
                <div key={brand.queue_id || index} className="flex flex-col space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200 min-h-[140px]">
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
          ) : nextWatchlistBrand && !Array.isArray(nextWatchlistBrand) ? (
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
                        {nextWatchlistBrand.brand_name || 'Unknown Brand'}
                      </p>
                      {nextWatchlistBrand.page_id && (
                        <button
                          onClick={() => openFacebookAdLibrary(nextWatchlistBrand.page_id)}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="View in Facebook Ad Library"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500">
                      ID: {nextWatchlistBrand.queue_id || 'N/A'} | Page: {nextWatchlistBrand.page_id || 'N/A'}
                    </p>
                  </div>
                </div>
                <Badge variant="info" className="self-start sm:self-auto">Waiting</Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <Clock className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
              <p className="text-gray-500 text-sm sm:text-base">No watchlist brands in queue</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default WatchlistProcessingStatus;

