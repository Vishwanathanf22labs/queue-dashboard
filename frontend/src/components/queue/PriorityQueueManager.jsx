import { useState, useCallback } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import CustomDropdown from '../ui/CustomDropdown';
import { queueAPI } from '../../services/api';

const PriorityQueueManager = ({ disabled = false }) => {
  const [state, setState] = useState({
    formData: {
      queueType: 'pending',
      brandName: '',
      newScore: ''
    },
    loading: false,
    message: { type: '', text: '' }
  });

  const handleInputChange = useCallback((name, value) => {
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        [name]: value
      }
    }));
  }, []);

  const handleQueueTypeChange = useCallback((queueType) => {
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        queueType,
        newScore: '' // Clear the score/position when changing queue type
      },
      showQueueDropdown: false
    }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!state.formData.brandName.trim() || !state.formData.newScore.trim()) {
      setState(prev => ({
        ...prev,
        message: { type: 'error', text: 'Please fill in all fields' }
      }));
      return;
    }

    const value = parseFloat(state.formData.newScore);
    if (isNaN(value)) {
      setState(prev => ({
        ...prev,
        message: {
          type: 'error',
          text: isListQueue(state.formData.queueType) ? 'Position must be a valid number' : 'Score must be a valid number'
        }
      }));
      return;
    }

    // Additional validation for list queue position
    if (isListQueue(state.formData.queueType) && value < 1) {
      setState(prev => ({
        ...prev,
        message: { type: 'error', text: 'Position must be 1 or greater' }
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      loading: true,
      message: { type: '', text: '' }
    }));

    try {
      const response = await queueAPI.changeBrandScore(
        state.formData.queueType,
        state.formData.brandName.trim(),
        value
      );

      setState(prev => ({
        ...prev,
        message: {
          type: 'success',
          text: response.message || `Successfully updated brand "${state.formData.brandName}"`
        },
        formData: {
          queueType: 'pending',
          brandName: '',
          newScore: ''
        }
      }));

    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to change brand priority';
      setState(prev => ({
        ...prev,
        message: { type: 'error', text: errorMessage }
      }));
    } finally {
      setState(prev => ({
        ...prev,
        loading: false
      }));
    }
  }, [state.formData]);

  const clearMessage = useCallback(() => {
    setState(prev => ({
      ...prev,
      message: { type: '', text: '' }
    }));
  }, []);

  // Helper function to determine if queue is a list (position-based)
  const isListQueue = (queueType) => {
    return queueType === 'failed' || queueType === 'watchlist_failed';
  };

  // Helper function to determine if queue is a sorted set (score-based)
  const isSortedSetQueue = (queueType) => {
    return queueType === 'pending' || queueType === 'watchlist_pending';
  };

  // Dynamic labels and placeholders based on queue type
  const isListQueueSelected = isListQueue(state.formData.queueType);
  const scoreLabel = isListQueueSelected ? 'New Position' : 'New Score';
  const scorePlaceholder = isListQueueSelected
    ? 'Enter position (1 for first, 2 for second, etc.)'
    : 'Enter score (e.g., 1 for priority, 0 for normal)';

  // Dynamic description based on queue type
  const getDescription = () => {
    if (isListQueueSelected) {
      const queueName = state.formData.queueType === 'failed' ? 'failed' : 'watchlist failed';
      return `Change the position of brands in the ${queueName} queue by specifying a new position (1 = first, 2 = second, etc.).`;
    } else {
      const queueName = state.formData.queueType === 'pending' ? 'pending' : 'watchlist pending';
      return `Change the score of brands in the ${queueName} queue by specifying a new score.`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
          Priority Queue Manager
        </h3>
        <p className="text-xs sm:text-sm text-gray-600">
          Manage the priority of brands by changing their score in the pending queue or adjusting their position in the failed queue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div>
            <CustomDropdown
              label="Queue Type"
              value={state.formData.queueType}
              onChange={handleQueueTypeChange}
              disabled={disabled}
              options={[
                { value: 'pending', label: 'Brands Pending Queue' },
                { value: 'failed', label: 'Brands Failed Queue' },
                { value: 'watchlist_pending', label: 'Watchlist Pending Queue' },
                { value: 'watchlist_failed', label: 'Watchlist Failed Queue' }
              ]}
              className="w-full"
            />
          </div>

          <div>
            <Input
              type="text"
              id="brandName"
              name="brandName"
              label="Brand Identifier"
              value={state.formData.brandName}
              onChange={(value) => handleInputChange('brandName', value)}
              placeholder="Enter brand name, page_id, or brand_id"
              className="w-full"
              disabled={disabled}
            />
          </div>

          <div>
            <Input
              type="text"
              id="newScore"
              name="newScore"
              label={scoreLabel}
              value={state.formData.newScore}
              onChange={(value) => handleInputChange('newScore', value)}
              placeholder={scorePlaceholder}
              className="w-full"
              disabled={disabled}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={disabled || state.loading}
            className="min-w-[120px]"
          >
            {state.loading ? 'Updating...' : isListQueueSelected ? 'Update Position' : 'Update Score'}
          </Button>
        </div>
      </form>

      {state.message.text && (
        <div className={`mt-4 p-3 rounded-md ${state.message.type === 'success'
          ? 'bg-green-50 border border-green-200 text-green-800'
          : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
          <div className="flex justify-between items-center">
            <span>{state.message.text}</span>
            <Button
              type="button"
              variant="ghost"
              onClick={clearMessage}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              ×
            </Button>
          </div>
        </div>
      )}

    </div>
  );
};

export default PriorityQueueManager;