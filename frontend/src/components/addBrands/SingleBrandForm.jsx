import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import BrandSearch from '../ui/BrandSearch';
import SortedSetInput from '../ui/SortedSetInput';
import { validateSingleBrand } from '../../utils/validation';
import { queueAPI } from '../../services/api';
import { Plus, Check } from 'lucide-react';

const SingleBrandForm = ({ loading, isSubmitting, onSubmittingChange, disabled = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const brandSearchRef = useRef(null);

  const getInitialSingleBrand = () => {
    try {
      const saved = localStorage.getItem('addBrands_singleBrand');
      return saved ? JSON.parse(saved) : { id: '', page_id: '', name: '', score: 0 };
    } catch {
      return { id: '', page_id: '', name: '', score: 0 };
    }
  };

  const [singleBrandForm, setSingleBrandForm] = useState(getInitialSingleBrand());

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
    localStorage.setItem('addBrands_singleBrand', JSON.stringify(singleBrandForm));
  }, [singleBrandForm]);

  const handleSingleBrandSelect = (brand) => {
    if (brand) {
      const newForm = {
        id: brand.brand_id.toString(),
        page_id: brand.page_id,
        name: brand.brand_name
      };
      setSingleBrandForm(newForm);
      toast.success(`Selected: ${brand.brand_name}`);
    } else {
      setSingleBrandForm({ id: '', page_id: '', name: '' });
    }
  };

  const isSearchDisabled = (formData) => {
    return Boolean(formData.id && formData.page_id && formData.name);
  };

  const handleSearchAttempt = () => {
    if (isSearchDisabled(singleBrandForm)) {
      toast.error('Only one brand allowed. Please remove the current brand first.');
      return;
    }
  };

  const clearSearchInputs = () => {
    setSingleBrandForm(getInitialSingleBrand());
    localStorage.removeItem('addBrands_singleBrand');
    if (brandSearchRef.current) {
      brandSearchRef.current.clearSearch();
    }
  };

  const handleSingleBrandSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting || loading) {
      toast.error('Please wait, a brand is already being processed.');
      return;
    }

    if (!singleBrandForm.id || !singleBrandForm.page_id) {
      toast.error('Please search and select a brand first.');
      return;
    }

    const validation = validateSingleBrand({
      id: parseInt(singleBrandForm.id),
      page_id: singleBrandForm.page_id,
      score: singleBrandForm.score || 0,
      queueType: queueType
    });

    if (!validation.success) {
      toast.error(validation.error);
      return;
    }

    try {
      onSubmittingChange(true);
      const result = await queueAPI.addSingleBrand(validation.data);
      toast.success(result.message || 'Brand added successfully');
      clearSearchInputs();

      setTimeout(() => {
        setSingleBrandForm({ id: '', page_id: '', name: '', score: 0 });
      }, 3000);

    } catch (error) {
      toast.error(error.message || 'Failed to add brand');
    } finally {
      onSubmittingChange(false);
    }
  };

  return (
    <form onSubmit={handleSingleBrandSubmit} className="space-y-4 sm:space-y-6">
      <div>
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Add Single Brand</h3>
        <p className="text-sm text-gray-600 mb-3 sm:mb-4">
          Add a brand to the regular pending queue or watchlist pending queue for scraping
        </p>
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
              Queue Type <span className="text-red-500">*</span>
            </label>
            <div className="flex space-x-4 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="queueType"
                  value="regular"
                  checked={queueType === 'regular'}
                  onChange={(e) => updateQueueType(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 accent-blue-600"
                  disabled={disabled || isSubmitting || loading}
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Regular Queue</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="queueType"
                  value="watchlist"
                  checked={queueType === 'watchlist'}
                  onChange={(e) => updateQueueType(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 accent-blue-600"
                  disabled={disabled || isSubmitting || loading}
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Watchlist Queue</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
              Search Brand <span className="text-red-500">*</span>
            </label>
            <BrandSearch
              ref={brandSearchRef}
              onBrandSelect={handleSingleBrandSelect}
              placeholder="Type brand name to search (e.g., 'nike', 'adidas')..."
              selectedBrand={singleBrandForm.id ? singleBrandForm : null}
              disabled={Boolean(disabled || isSubmitting || loading || isSearchDisabled(singleBrandForm))}
              onSearchAttempt={handleSearchAttempt}
            />
            <p className="mt-1.5 sm:mt-1 text-xs sm:text-sm text-gray-500 leading-relaxed">
              Only one brand can be selected at a time
            </p>
          </div>

          {singleBrandForm.id && singleBrandForm.page_id && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800">{singleBrandForm.name}</p>
                    <p className="text-sm text-green-700">
                      Brand ID: {singleBrandForm.id} | Page ID: {singleBrandForm.page_id}
                    </p>
                    <p className="text-sm text-green-600">
                      Queue Score: {singleBrandForm.score}
                      {singleBrandForm.score === 1 && ' (Priority)'}
                      {singleBrandForm.score === 0 && ' (Normal)'}
                      {singleBrandForm.score > 1 && ' (High Priority)'}
                      {singleBrandForm.score < 0 && ' (Low Priority)'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="remove"
                  size="sm"
                  onClick={() => {
                    setSingleBrandForm({ id: '', page_id: '', name: '', score: 0 });
                  }}
                  className="ml-3"
                >
                  Remove
                </Button>
              </div>
            </div>
          )}

          <SortedSetInput
            score={singleBrandForm.score}
            onScoreChange={(score) => {
              setSingleBrandForm({
                ...singleBrandForm,
                score: score !== null ? score : 0
              });
            }}
            disabled={disabled || !singleBrandForm.id || isSubmitting || loading}
            className="mt-4"
          />
        </div>
      </div>
      <Button type="submit" variant="primary" disabled={disabled || loading || isSubmitting || !singleBrandForm.id} className="w-full sm:w-auto">
        <Plus className="h-4 w-4 mr-2" />
        {isSubmitting ? 'Adding Brand...' : 'Add Brand'}
      </Button>
    </form>
  );
};

export default SingleBrandForm;
