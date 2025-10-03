import { useState, useCallback } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Input from '../ui/Input';
import CustomDropdown from '../ui/CustomDropdown';
import { proxyAPI } from '../../services/api';
import { validateNamespace, validateViewport } from '../../utils/validation';
import toast from 'react-hot-toast';

const ProxyManager = ({ onProxyAdded, onRefreshProxies, disabled = false }) => {
  const [state, setState] = useState({
    formData: {
      ip: '',
      port: '',
      version: 'ipv4',
      country: '',
      type: 'http',
      username: '',
      password: '',
      namespace: '',
      userAgent: '',
      viewport: ''
    },
    isLoading: false
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

  const handleTypeChange = useCallback((type) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, type }
    }));
  }, []);

  const handleVersionChange = useCallback((version) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, version }
    }));
  }, []);



  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!state.formData.ip || !state.formData.port) {
      toast.error('IP and Port are required');
      return;
    }

    if (!state.formData.username) {
      toast.error('Username is required');
      return;
    }

    if (!state.formData.password) {
      toast.error('Password is required');
      return;
    }

    if (!state.formData.type) {
      toast.error('Protocol is required');
      return;
    }

    // Validate namespace
    const namespaceValidation = validateNamespace(state.formData.namespace);
    if (!namespaceValidation.success) {
      toast.error(namespaceValidation.error);
      return;
    }

    if (!state.formData.userAgent) {
      toast.error('User Agent is required');
      return;
    }

    // Validate viewport
    const viewportValidation = validateViewport(state.formData.viewport);
    if (!viewportValidation.success) {
      toast.error(viewportValidation.error);
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const response = await proxyAPI.addProxy(state.formData);

      if (response.data.success) {
        toast.success('Proxy added successfully');
        setState(prev => ({
          ...prev,
          formData: {
            ip: '',
            port: '',
            version: 'ipv4',
            country: '',
            type: 'http',
            username: '',
            password: '',
            namespace: '',
            userAgent: '',
            viewport: ''
          },
          isLoading: false
        }));
        onProxyAdded?.(response.data.data);
        if (onRefreshProxies) {
          onRefreshProxies();
        }
      } else {
        toast.error(response.data.message || 'Failed to add proxy');
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      toast.error('Error adding proxy');
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.formData, onProxyAdded]);



  return (
    <Card title="Add New Proxy">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: IP Address and Port */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="IP Address"
            name="ip"
            value={state.formData.ip}
            onChange={(value) => handleInputChange('ip', value)}
            placeholder="192.168.1.100"
            required
            fullWidth
            disabled={disabled}
          />

          <Input
            label="Port"
            name="port"
            value={state.formData.port}
            onChange={(value) => handleInputChange('port', value)}
            placeholder="8080"
            required
            fullWidth
            disabled={disabled}
          />
        </div>

        {/* Row 2: Version and Country */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Version <span className="text-red-500">*</span>
            </label>
            <CustomDropdown
              options={[
                { value: 'ipv4', label: 'IPv4' },
                { value: 'ipv6', label: 'IPv6' }
              ]}
              value={state.formData.version}
              onChange={handleVersionChange}
              placeholder="Select version"
              className="w-full"
              required
              disabled={disabled}
            />
          </div>

          <Input
            label="Country"
            name="country"
            value={state.formData.country}
            onChange={(value) => handleInputChange('country', value)}
            placeholder="United States"
            fullWidth
            disabled={disabled}
          />
        </div>

        {/* Row 3: Protocol and Namespace */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Protocol <span className="text-red-500">*</span>
            </label>
            <CustomDropdown
              options={[
                { value: 'http', label: 'HTTP' },
                { value: 'https', label: 'HTTPS' },
                { value: 'socks4', label: 'SOCKS4' },
                { value: 'socks5', label: 'SOCKS5' }
              ]}
              value={state.formData.type}
              onChange={handleTypeChange}
              placeholder="Select protocol"
              className="w-full"
              required
              disabled={disabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Namespace <span className="text-red-500">*</span>
            </label>
            <CustomDropdown
              options={[
                { value: 'non-watchlist', label: 'Non-Watchlist' },
                { value: 'watchlist', label: 'Watchlist' }
              ]}
              value={state.formData.namespace}
              onChange={(value) => handleInputChange('namespace', value)}
              placeholder="Select namespace"
              className="w-full"
              required
              disabled={disabled}
            />
          </div>
        </div>

        {/* Row 4: Username and Password */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Username"
            name="username"
            value={state.formData.username}
            onChange={(value) => handleInputChange('username', value)}
            placeholder="proxyuser"
            required
            fullWidth
            disabled={disabled}
          />

          <Input
            label="Password"
            name="password"
            type="password"
            value={state.formData.password}
            onChange={(value) => handleInputChange('password', value)}
            placeholder="proxypass"
            showPasswordToggle
            required
            fullWidth
            disabled={disabled}
          />
        </div>

        {/* Row 5: User Agent and Viewport */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="User Agent"
            name="userAgent"
            value={state.formData.userAgent}
            onChange={(value) => handleInputChange('userAgent', value)}
            placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            required
            fullWidth
            disabled={disabled}
          />

          <Input
            label="Viewport"
            name="viewport"
            value={state.formData.viewport}
            onChange={(value) => handleInputChange('viewport', value)}
            placeholder="1366,768"
            required
            fullWidth
            disabled={disabled}
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={disabled || state.isLoading}
            loading={state.isLoading}
            variant="primary"
            size="md"
          >
            Add Proxy
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default ProxyManager;
