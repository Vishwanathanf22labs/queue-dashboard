import { useState, useRef, useEffect } from 'react';
import useQueueStore from '../../stores/queueStore';
import Card from '../ui/Card';
import Table from '../ui/Table';
import toast from 'react-hot-toast';
import { Filter, ChevronDown } from 'lucide-react';

const ScrapedStats = () => {
  const { scrapedStats, fetchScrapedStats } = useQueueStore();


  const [uiState, setUiState] = useState({
    selectedPeriod: 7,
    showDropdown: false,
  });

  const { selectedPeriod, showDropdown } = uiState;

  const updateUiState = (updates) => {
    setUiState(prev => ({ ...prev, ...updates }));
  };

  const dropdownRef = useRef(null);


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        updateUiState({ showDropdown: false });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const periodOptions = [
    { value: 7, label: 'Last 7 days' },
    { value: 14, label: 'Last 14 days' },
    { value: 30, label: 'Last 30 days' }
  ];

  const handlePeriodChange = async (period) => {
    updateUiState({ 
      selectedPeriod: period, 
      showDropdown: false 
    });
    
    try {
      await fetchScrapedStats(null, period);
    } catch (error) {
      toast.error(`Failed to load scraped stats: ${error.message || error}`);
    }
  };

  const selectedOption = periodOptions.find(option => option.value === selectedPeriod);


  const dailyStats = scrapedStats?.stats || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Scraped Statistics</h2>
        
  
        <div className="relative w-full sm:w-auto" ref={dropdownRef}>
          <button
            onClick={() => updateUiState({ showDropdown: !showDropdown })}
            className="flex items-center px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 focus:outline-none transition-all duration-200 w-full sm:min-w-[180px]"
          >
            <Filter className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-sm font-medium text-gray-900 flex-1 text-left">
              {selectedOption?.label}
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 ml-2 transition-transform duration-200 ${
              showDropdown ? 'rotate-180' : ''
            }`} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handlePeriodChange(option.value)}
                  className={`w-full px-3 py-2 text-left text-sm first:rounded-t-lg last:rounded-b-lg transition-colors duration-150 ${
                    selectedPeriod === option.value 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Card>
        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Daily Breakdown</h3>
          {dailyStats && dailyStats.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <Table
                  data={dailyStats}
                  columns={[
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
                  ]}
                  emptyMessage="No daily breakdown data available for the selected period."
                />
              </div>

              {/* Mobile Card View */}
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
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No daily breakdown data available for the selected period.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ScrapedStats;
