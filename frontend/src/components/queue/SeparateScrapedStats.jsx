import { useState } from 'react';
import useQueueStore from '../../stores/queueStore';
import Card from '../ui/Card';
import Table from '../ui/Table';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { Filter, Eye, EyeOff } from 'lucide-react';
import CustomDropdown from '../ui/CustomDropdown';

const SeparateScrapedStats = () => {
  const { 
    separateScrapedStats, 
    separateScrapedStatsLoading, 
    fetchSeparateScrapedStats 
  } = useQueueStore();

  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [showWatchlist, setShowWatchlist] = useState(true);
  const [showRegular, setShowRegular] = useState(true);

  const periodOptions = [
    { value: 7, label: 'Last 7 days' },
    { value: 14, label: 'Last 14 days' },
    { value: 30, label: 'Last 30 days' }
  ];

  const handlePeriodChange = async (period) => {
    setSelectedPeriod(period);

    try {
      await fetchSeparateScrapedStats(null, period);
    } catch (error) {
      toast.error(`Failed to load separate scraped stats: ${error.message || error}`);
    }
  };

  const watchlistStats = separateScrapedStats?.watchlist || [];
  const regularStats = separateScrapedStats?.regular || [];
  const getCurrentDateTotals = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayWatchlistStats = watchlistStats.find(stat => stat.date === today);
    const todayRegularStats = regularStats.find(stat => stat.date === today);
    const totalBrandsScraped = (todayWatchlistStats?.brands_scraped || 0) + (todayRegularStats?.brands_scraped || 0);
    const totalBrandsProcessed = (todayWatchlistStats?.brands_processed || 0) + (todayRegularStats?.brands_processed || 0);
    const totalFailed = (todayWatchlistStats?.brands_scrapped_failed || 0) + (todayRegularStats?.brands_scrapped_failed || 0);
    const totalAdsProcessed = (todayWatchlistStats?.ads_processed || 0) + (todayRegularStats?.ads_processed || 0);
    
    return {
      brandsScraped: totalBrandsScraped,
      brandsProcessed: totalBrandsProcessed,
      failed: totalFailed,
      adsProcessed: totalAdsProcessed
    };
  };

  const currentDateTotals = getCurrentDateTotals();

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (value) => (
        <div className="text-sm text-gray-900">
          {new Date(value).toLocaleDateString()}
        </div>
      )
    },
    {
      key: 'brands_scraped',
      label: 'Brands Scraped',
      headerAlign: 'center',
      render: (value) => (
        <div className="text-sm text-center text-gray-900 font-medium">
          {value || 0}
        </div>
      )
    },
    {
      key: 'brands_processed',
      label: 'Brands Processed',
      headerAlign: 'center',
      render: (value) => (
        <div className="text-sm text-center text-gray-900">
          {value || 0}
        </div>
      )
    },
    {
      key: 'brands_scrapped_failed',
      label: 'Failed',
      headerAlign: 'center',
      render: (value) => (
        <div className="text-sm text-center text-red-600 font-medium">
          {value || 0}
        </div>
      )
    },
    {
      key: 'ads_processed',
      label: 'Ads Processed',
      headerAlign: 'center',
      render: (value) => (
        <div className="text-sm text-center text-gray-900">
          {value || 0}
        </div>
      )
    }
  ];

  const renderMobileStats = (stats, type) => (
    <div className="lg:hidden space-y-3">
      {stats.map((stat, index) => (
        <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h4 className="font-medium text-gray-900">
              {new Date(stat.date).toLocaleDateString()}
            </h4>
            <span className="text-xs text-gray-500">{type} Stats</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-purple-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Brands Scraped</p>
              <p className="text-lg font-semibold text-purple-600">{stat.brands_scraped || 0}</p>
            </div>

            <div className="text-center p-2 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Brands Processed</p>
              <p className="text-lg font-semibold text-green-600">{stat.brands_processed || 0}</p>
            </div>

            <div className="text-center p-2 bg-red-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Failed</p>
              <p className="text-lg font-semibold text-red-600">{stat.brands_scrapped_failed || 0}</p>
            </div>

            <div className="text-center p-2 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Ads Processed</p>
              <p className="text-lg font-semibold text-blue-600">{stat.ads_processed || 0}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Scraped Statistics</h2>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setShowWatchlist(!showWatchlist)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showWatchlist 
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {showWatchlist ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Watchlist
            </button>
            <button
              onClick={() => setShowRegular(!showRegular)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showRegular 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {showRegular ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Regular
            </button>
          </div>

          <CustomDropdown
            options={periodOptions}
            value={selectedPeriod}
            onChange={handlePeriodChange}
            className="w-full sm:w-auto sm:min-w-[180px]"
            icon={<Filter className="h-4 w-4 text-gray-400 mr-2" />}
          />
        </div>
      </div>

      <Card>
        <div className="p-4 sm:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Today's Summary</h3>
            <p className="text-sm text-gray-600">
              Combined totals for {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-1">
                {currentDateTotals.brandsScraped}
              </div>
              <div className="text-xs sm:text-sm text-purple-700 font-medium">
                Total Brands Scraped
              </div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">
                {currentDateTotals.brandsProcessed}
              </div>
              <div className="text-xs sm:text-sm text-green-700 font-medium">
                Total Brands Processed
              </div>
            </div>
            
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-2xl sm:text-3xl font-bold text-red-600 mb-1">
                {currentDateTotals.failed}
              </div>
              <div className="text-xs sm:text-sm text-red-700 font-medium">
                Total Failed
              </div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">
                {currentDateTotals.adsProcessed}
              </div>
              <div className="text-xs sm:text-sm text-blue-700 font-medium">
                Total Ads Processed
              </div>
            </div>
          </div>
        </div>
      </Card>

      {separateScrapedStatsLoading ? (
        <Card>
          <div className="p-4 sm:p-6">
            <LoadingSpinner />
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Watchlist Stats */}
          {showWatchlist && (
            <Card>
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4 sm:mb-6">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Watchlist Brands - Daily Breakdown</h3>
                </div>
                
                {watchlistStats && watchlistStats.length > 0 ? (
                  <>
                    <div className="hidden lg:block">
                      <Table
                        data={watchlistStats}
                        columns={columns}
                        emptyMessage="No watchlist daily breakdown data available for the selected period."
                        className="shadow-md rounded-lg"
                      />
                    </div>
                    {renderMobileStats(watchlistStats, 'Watchlist')}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No watchlist daily breakdown data available for the selected period.</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Regular Stats */}
          {showRegular && (
            <Card>
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4 sm:mb-6">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Regular Brands - Daily Breakdown</h3>
                </div>
                
                {regularStats && regularStats.length > 0 ? (
                  <>
                    <div className="hidden lg:block">
                      <Table
                        data={regularStats}
                        columns={columns}
                        emptyMessage="No regular daily breakdown data available for the selected period."
                        className="shadow-md rounded-lg"
                      />
                    </div>
                    {renderMobileStats(regularStats, 'Regular')}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No regular daily breakdown data available for the selected period.</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Show message if both are hidden */}
          {!showWatchlist && !showRegular && (
            <Card>
              <div className="p-4 sm:p-6">
                <div className="text-center py-8 text-gray-500">
                  <p>Please enable at least one statistics view (Watchlist or Regular) to see data.</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default SeparateScrapedStats;
