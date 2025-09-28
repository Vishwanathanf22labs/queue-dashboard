import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import CustomDropdown from '../ui/CustomDropdown';
import { proxyAPI } from '../../services/api';
import { validateNamespace, validateViewport } from '../../utils/validation';
import toast from 'react-hot-toast';

const EditProxyModal = ({ isOpen, onClose, proxy, onProxyUpdated }) => {
  const [formData, setFormData] = useState({
    namespace: '',
    userAgent: '',
    viewport: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (proxy && isOpen) {
      setFormData({
        namespace: proxy.namespace || '',
        userAgent: proxy.userAgent || '',
        viewport: proxy.viewport || ''
      });
    }
  }, [proxy, isOpen]);

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate namespace
    const namespaceValidation = validateNamespace(formData.namespace);
    if (!namespaceValidation.success) {
      toast.error(namespaceValidation.error);
      return;
    }

    // Validate viewport
    const viewportValidation = validateViewport(formData.viewport);
    if (!viewportValidation.success) {
      toast.error(viewportValidation.error);
      return;
    }

    if (!formData.userAgent) {
      toast.error('User Agent is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await proxyAPI.updateProxy(proxy.id, {
        namespace: formData.namespace,
        userAgent: formData.userAgent,
        viewport: formData.viewport
      });

      if (response.data.success) {
        toast.success('Proxy updated successfully');
        onProxyUpdated?.(proxy.id, {
          namespace: formData.namespace,
          userAgent: formData.userAgent,
          viewport: formData.viewport
        });
        onClose();
      } else {
        toast.error(response.data.message || 'Failed to update proxy');
      }
    } catch (error) {
      toast.error('Error updating proxy');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Edit Proxy</h3>
          <p className="text-sm text-gray-600 mt-1">
            {proxy?.ip}:{proxy?.port}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Namespace <span className="text-red-500">*</span>
            </label>
            <CustomDropdown
              options={[
                { value: 'non-watchlist', label: 'Non-Watchlist' },
                { value: 'watchlist', label: 'Watchlist' }
              ]}
              value={formData.namespace}
              onChange={(value) => handleInputChange('namespace', value)}
              placeholder="Select namespace"
              className="w-full"
              required
            />
          </div>

          <Input
            label="User Agent"
            name="userAgent"
            value={formData.userAgent}
            onChange={(value) => handleInputChange('userAgent', value)}
            placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            required
            fullWidth
          />

          <Input
            label="Viewport"
            name="viewport"
            value={formData.viewport}
            onChange={(value) => handleInputChange('viewport', value)}
            placeholder="1366,768"
            required
            fullWidth
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isLoading}
              disabled={isLoading}
            >
              Update Proxy
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProxyModal;
