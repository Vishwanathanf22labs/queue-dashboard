import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import CustomDropdown from '../ui/CustomDropdown';
import { queueAPI } from '../../services/api';
import { RefreshCw } from 'lucide-react';

const AddAllBrandsForm = ({ loading, isSubmitting, onSubmittingChange }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandCounts, setBrandCounts] = useState(null);

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
      const result = await queueAPI.addAllBrands(statusParam);

      toast.success(result.message || 'Brands added successfully');

      await fetchBrandCounts();
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-semibold text-gray-900">{brandCounts.total}</div>
              <div className="text-xs text-gray-600">Total Brands</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-lg font-semibold text-green-600">{brandCounts.active}</div>
              <div className="text-xs text-green-600">Active Brands</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-lg font-semibold text-red-600">{brandCounts.inactive}</div>
              <div className="text-xs text-gray-600">Inactive Brands</div>
            </div>
          </div>
        )}

        <CustomDropdown
          options={[
            {
              value: 'all',
              label: `All Brands ${brandCounts ? `(${brandCounts.total})` : ''}`
            },
            {
              value: 'Active',
              label: `Active Brands Only ${brandCounts ? `(${brandCounts.active})` : ''}`
            },
            {
              value: 'Inactive',
              label: `Inactive Brands Only ${brandCounts ? `(${brandCounts.inactive})` : ''}`
            }
          ]}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
          className="w-full max-w-xs mb-4"
        />

        <Button
          onClick={handleAddAllBrands}
          variant="primary"
          disabled={loading || isSubmitting}
          className="w-full"
        >
          <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
          {isSubmitting
            ? 'Adding Brands...'
            : statusFilter === 'all'
              ? 'Add All Brands to Queue'
              : `Add ${statusFilter} Brands to Queue`
          }
        </Button>
      </div>
    </div>
  );
};

export default AddAllBrandsForm;
