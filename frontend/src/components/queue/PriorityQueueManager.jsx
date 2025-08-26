import { useState, useCallback } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import CustomDropdown from '../ui/CustomDropdown';
import { queueAPI } from '../../services/api';

const PriorityQueueManager = () => {
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
        queueType
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

    const score = parseFloat(state.formData.newScore);
    if (isNaN(score)) {
      setState(prev => ({
        ...prev,
        message: { type: 'error', text: 'Score must be a valid number' }
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
        score
      );

      setState(prev => ({
        ...prev,
        message: {
          type: 'success',
          text: `Successfully updated brand "${state.formData.brandName}" score to ${score} in ${state.formData.queueType} queue`
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



  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Priority Queue Manager
        </h3>
        <p className="text-sm text-gray-600">
          Change the score of brands in pending or failed queues by searching for the brand name and specifying a new score.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div>
            <CustomDropdown
              label="Queue Type"
              value={state.formData.queueType}
              onChange={handleQueueTypeChange}
              options={[
                { value: 'pending', label: 'Pending Queue' },
                { value: 'failed', label: 'Failed Queue' }
              ]}
              className="w-full"
            />
          </div>

          <div>
            <Input
              type="text"
              id="brandName"
              name="brandName"
              label="Brand Name"
              value={state.formData.brandName}
              onChange={(value) => handleInputChange('brandName', value)}
              placeholder="Enter brand name to search"
              className="w-full"
            />
          </div>


          <div>
            <Input
              type="text"
              id="newScore"
              name="newScore"
              label="New Score"
              value={state.formData.newScore}
              onChange={(value) => handleInputChange('newScore', value)}
              placeholder="Enter score (e.g., 1 for priority, 0 for normal)"
              className="w-full"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={state.loading}
            className="min-w-[120px]"
          >
            {state.loading ? 'Updating...' : 'Update Score'}
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