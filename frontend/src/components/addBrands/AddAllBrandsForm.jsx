import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import CustomDropdown from '../ui/CustomDropdown';
import { queueAPI } from '../../services/api';
import { RefreshCw } from 'lucide-react';

const AddAllBrandsForm = ({ loading, isSubmitting, onSubmittingChange, disabled = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState('all');
  const [brandCounts, setBrandCounts] = useState(null);

  const queueType = searchParams.get('queueType') || 'regular';

  const updateQueueType = (newQueueType) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (newQueueType === 'regular') {
      newSearchParams.delete('queueType');
    } else {
      newSearchParams.set('queueType', newQueueType);
    }
    setSearchParams(newSearchParams);
  };

  useEffect(() => {
    fetchBrandCounts();
  }, []);

  const fetchBrandCounts = async () => {
    try {
      const response = await queueAPI.getBrandCounts();
      if (response.data.success) {
        setBrandCounts(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch brand counts:', error);
    }
  };

  const handleAddAllBrands = async () => {
    try {
      onSubmittingChange(true);

      const statusParam = statusFilter === 'all' ? null : statusFilter;
      const result = await queueAPI.addAllBrands(statusParam, queueType);

      toast.success(result.message || 'Brands added successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to add brands');
    } finally {
      onSubmittingChange(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Add All Brands</h3>
        <p className="text-xs text-gray-600 mb-4">
          Add all brands or filtered brands to the regular pending queue or watchlist pending queue for scraping
        </p>

        {brandCounts && (
          <div className="mb-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <div className="bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm">
                <div className="text-lg font-bold text-gray-900 mb-1">{brandCounts.total}</div>
                <div className="text-xs text-gray-600">Total Brands</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center shadow-sm">
                <div className="text-lg font-bold text-blue-600 mb-1">{brandCounts.regular_all}</div>
                <div className="text-xs text-blue-600">All Regular Brands</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center shadow-sm">
                <div className="text-lg font-bold text-purple-600 mb-1">{brandCounts.watchlist_all}</div>
                <div className="text-xs text-purple-600">All Watchlist Brands</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center shadow-sm">
                <div className="text-lg font-bold text-green-600 mb-1">{brandCounts.regular_active}</div>
                <div className="text-xs text-green-600">Regular Active</div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl mx-auto">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center shadow-sm">
                <div className="text-lg font-bold text-red-600 mb-1">{brandCounts.regular_inactive}</div>
                <div className="text-xs text-red-600">Regular Inactive</div>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center shadow-sm">
                <div className="text-lg font-bold text-indigo-600 mb-1">{brandCounts.watchlist_active}</div>
                <div className="text-xs text-indigo-600">Watchlist Active</div>
              </div>
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-center shadow-sm col-span-2 lg:col-span-1">
                <div className="text-lg font-bold text-pink-600 mb-1">{brandCounts.watchlist_inactive}</div>
                <div className="text-xs text-pink-600">Watchlist Inactive</div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
            Queue Type <span className="text-red-500">*</span>
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="addAllQueueType"
                value="regular"
                checked={queueType === 'regular'}
                onChange={(e) => updateQueueType(e.target.value)}
                className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 focus:ring-blue-500 border-gray-300 accent-blue-600"
                disabled={disabled || isSubmitting || loading}
              />
              <span className="ml-2 text-xs sm:text-sm font-medium text-gray-700">Regular Queue</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="addAllQueueType"
                value="watchlist"
                checked={queueType === 'watchlist'}
                onChange={(e) => updateQueueType(e.target.value)}
                className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 focus:ring-blue-500 border-gray-300 accent-blue-600"
                disabled={disabled || isSubmitting || loading}
              />
              <span className="ml-2 text-xs sm:text-sm font-medium text-gray-700">Watchlist Queue</span>
            </label>
          </div>
        </div>

        <div className="mb-4">
          <CustomDropdown
            options={[
              {
                value: 'all',
                label: `All Brands ${brandCounts ? `(${brandCounts.total})` : ''}`
              },
              {
                value: 'regular_all',
                label: `All Regular Brands ${brandCounts ? `(${brandCounts.regular_all})` : ''}`
              },
              {
                value: 'watchlist_all',
                label: `All Watchlist Brands ${brandCounts ? `(${brandCounts.watchlist_all})` : ''}`
              },
              {
                value: 'regular_active',
                label: `Regular Active Brands ${brandCounts ? `(${brandCounts.regular_active})` : ''}`
              },
              {
                value: 'regular_inactive',
                label: `Regular Inactive Brands ${brandCounts ? `(${brandCounts.regular_inactive})` : ''}`
              },
              {
                value: 'watchlist_active',
                label: `Watchlist Active Brands ${brandCounts ? `(${brandCounts.watchlist_active})` : ''}`
              },
              {
                value: 'watchlist_inactive',
                label: `Watchlist Inactive Brands ${brandCounts ? `(${brandCounts.watchlist_inactive})` : ''}`
              }
            ]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            className="w-full max-w-sm"
          />
        </div>

        <Button
          onClick={handleAddAllBrands}
          variant="primary"
          disabled={disabled || loading || isSubmitting}
          className="w-full py-2"
        >
          <RefreshCw className="h-3 w-3 mr-2" />
          {isSubmitting
            ? 'Adding Brands...'
            : statusFilter === 'all'
              ? 'Add All Brands to Queue'
              : statusFilter === 'regular_all'
                ? 'Add All Regular Brands to Queue'
                : statusFilter === 'watchlist_all'
                  ? 'Add All Watchlist Brands to Queue'
                  : statusFilter === 'regular_active'
                    ? 'Add Regular Active Brands to Queue'
                    : statusFilter === 'regular_inactive'
                      ? 'Add Regular Inactive Brands to Queue'
                      : statusFilter === 'watchlist_active'
                        ? 'Add Watchlist Active Brands to Queue'
                        : statusFilter === 'watchlist_inactive'
                          ? 'Add Watchlist Inactive Brands to Queue'
                          : `Add ${statusFilter} Brands to Queue`
          }
        </Button>
      </div>
    </div>
  );
};

export default AddAllBrandsForm;
