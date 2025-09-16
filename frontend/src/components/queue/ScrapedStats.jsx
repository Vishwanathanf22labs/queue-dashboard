import { useState } from 'react';
import useQueueStore from '../../stores/queueStore';
import Card from '../ui/Card';
import Table from '../ui/Table';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { Filter } from 'lucide-react';
import CustomDropdown from '../ui/CustomDropdown';

const ScrapedStats = () => {
  const { scrapedStats, scrapedStatsLoading, fetchScrapedStats } = useQueueStore();

  const [selectedPeriod, setSelectedPeriod] = useState(7);

  const periodOptions = [
    { value: 7, label: 'Last 7 days' },
    { value: 14, label: 'Last 14 days' },
    { value: 30, label: 'Last 30 days' }
  ];

  const handlePeriodChange = async (period) => {
    setSelectedPeriod(period);

    try {
      await fetchScrapedStats(null, period);
    } catch (error) {
      toast.error(`Failed to load scraped stats: ${error.message || error}`);
    }
  };

  const dailyStats = (scrapedStats?.stats || []).slice().reverse();

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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Scraped Statistics</h2>

        <CustomDropdown
          options={periodOptions}
          value={selectedPeriod}
          onChange={handlePeriodChange}
          className="w-full sm:w-auto sm:min-w-[180px]"
          icon={<Filter className="h-4 w-4 text-gray-400 mr-2" />}
        />
      </div>

      <Card>
        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Daily Breakdown</h3>
          {scrapedStatsLoading ? (
            <LoadingSpinner />
          ) : !scrapedStatsLoading && dailyStats && dailyStats.length > 0 ? (
            <>
              <div className="hidden lg:block">
                <Table
                  data={dailyStats}
                  columns={columns}
                  emptyMessage="No daily breakdown data available for the selected period."
                  className="shadow-md rounded-lg"
                />
              </div>

              <div className="lg:hidden space-y-3">
                {dailyStats.map((stat, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <h4 className="font-medium text-gray-900">
                        {new Date(stat.date).toLocaleDateString()}
                      </h4>
                      <span className="text-xs text-gray-500">Daily Stats</span>
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
            </>
          ) : !scrapedStatsLoading ? (
            <div className="text-center py-8 text-gray-500">
              <p>No daily breakdown data available for the selected period.</p>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
};

export default ScrapedStats;