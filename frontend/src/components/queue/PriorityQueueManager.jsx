import { useState, useCallback } from 'react';
import Button from '../ui/Button';
import { queueAPI } from '../../services/api';
import { ChevronDown } from 'lucide-react';

const PriorityQueueManager = () => {
  const [formData, setFormData] = useState({
    queueType: 'pending',
    brandName: '',
    newPosition: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showQueueDropdown, setShowQueueDropdown] = useState(false);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleQueueTypeChange = useCallback((queueType) => {
    setFormData(prev => ({
      ...prev,
      queueType
    }));
    setShowQueueDropdown(false);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!formData.brandName.trim() || !formData.newPosition.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    const position = parseInt(formData.newPosition);
    if (isNaN(position) || position < 1) {
      setMessage({ type: 'error', text: 'Position must be a positive number' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await queueAPI.changeBrandPriority(
        formData.queueType,
        formData.brandName.trim(),
        position
      );

      setMessage({ 
        type: 'success', 
        text: `Successfully moved brand "${formData.brandName}" to position ${position} in ${formData.queueType} queue` 
      });

      // Reset form
      setFormData({
        queueType: 'pending',
        brandName: '',
        newPosition: ''
      });

    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to change brand priority';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [formData]);

  const clearMessage = useCallback(() => {
    setMessage({ type: '', text: '' });
  }, []);

  const getQueueTypeLabel = (type) => {
    return type === 'pending' ? 'Pending Queue' : 'Failed Queue';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Priority Queue Manager
        </h3>
        <p className="text-sm text-gray-600">
          Change the position of brands in pending or failed queues by searching for the brand name and specifying a new position.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div>
            <label htmlFor="queueType" className="block text-sm font-medium text-gray-700 mb-1">
              Queue Type
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowQueueDropdown(!showQueueDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <span>{getQueueTypeLabel(formData.queueType)}</span>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                  showQueueDropdown ? 'rotate-180' : ''
                }`} />
              </button>
              
              {/* Dropdown Menu */}
              {showQueueDropdown && (
                <div className="absolute right-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  <button
                    type="button"
                    onClick={() => handleQueueTypeChange('pending')}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      formData.queueType === 'pending' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    Pending Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQueueTypeChange('failed')}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      formData.queueType === 'failed' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    Failed Queue
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="brandName" className="block text-sm font-medium text-gray-700 mb-1">
              Brand Name
            </label>
            <input
              type="text"
              id="brandName"
              name="brandName"
              value={formData.brandName}
              onChange={handleInputChange}
              placeholder="Enter brand name to search"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>


          <div>
            <label htmlFor="newPosition" className="block text-sm font-medium text-gray-700 mb-1">
              New Position
            </label>
            <input
              type="number"
              id="newPosition"
              name="newPosition"
              value={formData.newPosition}
              onChange={handleInputChange}
              placeholder="Enter position number"
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className="min-w-[120px]"
          >
            {loading ? 'Updating...' : 'Update Priority'}
          </Button>
        </div>
      </form>


      {message.text && (
        <div className={`mt-4 p-3 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex justify-between items-center">
            <span>{message.text}</span>
            <button
              onClick={clearMessage}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default PriorityQueueManager;
