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
  
  // Get queueType from URL params or default to 'regular'
  const queueType = searchParams.get('queueType') || 'regular';

  // Function to update URL params when queueType changes
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
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      <div>
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 sm:mb-3 lg:mb-4">Add All Brands</h3>

        {brandCounts && (
          <div className="space-y-3 mb-4">
            {/* First row - 4 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-gray-900">{brandCounts.total}</div>
                <div className="text-xs text-gray-600">Total Brands</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-blue-600">{brandCounts.regular_all}</div>
                <div className="text-xs text-blue-600">All Regular Brands</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-purple-600">{brandCounts.watchlist_all}</div>
                <div className="text-xs text-purple-600">All Watchlist Brands</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-green-600">{brandCounts.regular_active}</div>
                <div className="text-xs text-green-600">Regular Active</div>
              </div>
            </div>
            
            {/* Second row - 3 cards centered */}
            <div className="flex justify-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full lg:w-3/4">
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-red-600">{brandCounts.regular_inactive}</div>
                  <div className="text-xs text-red-600">Regular Inactive</div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-indigo-600">{brandCounts.watchlist_active}</div>
                  <div className="text-xs text-indigo-600">Watchlist Active</div>
                </div>
                <div className="bg-pink-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-pink-600">{brandCounts.watchlist_inactive}</div>
                  <div className="text-xs text-pink-600">Watchlist Inactive</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
            Queue Type <span className="text-red-500">*</span>
          </label>
          <div className="flex space-x-4 mb-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="addAllQueueType"
                value="regular"
                checked={queueType === 'regular'}
                onChange={(e) => updateQueueType(e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 accent-blue-600"
                disabled={disabled || isSubmitting || loading}
              />
              <span className="ml-2 text-base font-semibold text-gray-700">Regular Queue</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="addAllQueueType"
                value="watchlist"
                checked={queueType === 'watchlist'}
                onChange={(e) => updateQueueType(e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 accent-blue-600"
                disabled={disabled || isSubmitting || loading}
              />
              <span className="ml-2 text-base font-semibold text-gray-700">Watchlist Queue</span>
            </label>
          </div>
        </div>

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
          className="w-full max-w-xs mb-4"
        />

        <Button
          onClick={handleAddAllBrands}
          variant="primary"
          disabled={disabled || loading || isSubmitting}
          className="w-full"
        >
          <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
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
