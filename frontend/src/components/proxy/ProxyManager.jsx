import { useState, useCallback } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Input from '../ui/Input';
import CustomDropdown from '../ui/CustomDropdown';
import { proxyAPI } from '../../services/api';
import toast from 'react-hot-toast';

const ProxyManager = ({ onProxyAdded, onRefreshProxies }) => {
  const [state, setState] = useState({
    formData: {
      ip: '',
      port: '',
      country: '',
      type: 'http',
      username: '',
      password: '',
      namespace: ''
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



  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!state.formData.ip || !state.formData.port) {
      toast.error('IP and Port are required');
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
            country: '',
            type: 'http',
            username: '',
            password: '',
            namespace: ''
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="IP Address"
            name="ip"
            value={state.formData.ip}
            onChange={(value) => handleInputChange('ip', value)}
            placeholder="192.168.1.100"
            required
            fullWidth
          />

          <Input
            label="Port"
            name="port"
            value={state.formData.port}
            onChange={(value) => handleInputChange('port', value)}
            placeholder="8080"
            required
            fullWidth
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Country"
            name="country"
            value={state.formData.country}
            onChange={(value) => handleInputChange('country', value)}
            placeholder="United States"
            fullWidth
          />

          <CustomDropdown
            options={[
              { value: 'http', label: 'HTTP' },
              { value: 'https', label: 'HTTPS' },
              { value: 'socks4', label: 'SOCKS4' },
              { value: 'socks5', label: 'SOCKS5' }
            ]}
            value={state.formData.type}
            onChange={handleTypeChange}
            placeholder="Select type"
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Username"
            name="username"
            value={state.formData.username}
            onChange={(value) => handleInputChange('username', value)}
            placeholder="proxyuser"
            fullWidth
          />

          <Input
            label="Password"
            name="password"
            type="password"
            value={state.formData.password}
            onChange={(value) => handleInputChange('password', value)}
            placeholder="proxypass"
            showPasswordToggle
            fullWidth
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Input
            label="Namespace (Optional)"
            name="namespace"
            value={state.formData.namespace}
            onChange={(value) => handleInputChange('namespace', value)}
            placeholder="Enter namespace for this proxy"
            fullWidth
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={state.isLoading}
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
