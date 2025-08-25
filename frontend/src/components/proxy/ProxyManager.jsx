import React, { useState, useCallback, useEffect } from 'react';
import Button from '../ui/Button';
import { proxyAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { ChevronDown } from 'lucide-react';

const ProxyManager = ({ onProxyAdded, onProxyRemoved }) => {
  const [formData, setFormData] = useState({
    ip: '',
    port: '',
    country: '',
    type: 'http',
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showTypeDropdown && !event.target.closest('.type-dropdown')) {
        setShowTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTypeDropdown]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleTypeChange = useCallback((type) => {
    setFormData(prev => ({ ...prev, type }));
    setShowTypeDropdown(false);
  }, []);

  const getTypeLabel = (type) => {
    return type?.toUpperCase() || 'HTTP';
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!formData.ip || !formData.port) {
      toast.error('IP and Port are required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await proxyAPI.addProxy(formData);
      
      if (response.data.success) {
        toast.success('Proxy added successfully');
        setFormData({
          ip: '',
          port: '',
          country: '',
          type: 'http',
          username: '',
          password: ''
        });
        onProxyAdded?.(response.data.data);
      } else {
        toast.error(response.data.message || 'Failed to add proxy');
      }
    } catch (error) {
      toast.error('Error adding proxy');
    } finally {
      setIsLoading(false);
    }
  }, [formData, onProxyAdded]);

  const handleRemoveProxy = useCallback(async (proxyId) => {
    if (!confirm('Are you sure you want to remove this proxy?')) {
      return;
    }

    try {
      const response = await proxyAPI.removeProxy(proxyId);
      
      if (response.data.success) {
        toast.success('Proxy removed successfully');
        onProxyRemoved?.(proxyId);
      } else {
        toast.error(response.data.message || 'Failed to remove proxy');
      }
    } catch (error) {
      toast.error('Error removing proxy');
    }
  }, [onProxyRemoved]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Proxy</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              IP Address *
            </label>
            <input
              type="text"
              name="ip"
              value={formData.ip}
              onChange={handleInputChange}
              placeholder="192.168.1.100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Port *
            </label>
            <input
              type="text"
              name="port"
              value={formData.port}
              onChange={handleInputChange}
              placeholder="8080"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              placeholder="United States"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="type-dropdown">
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <span>{getTypeLabel(formData.type)}</span>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                  showTypeDropdown ? 'rotate-180' : ''
                }`} />
              </button>
              
              {showTypeDropdown && (
                <div className="absolute right-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('http')}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      formData.type === 'http' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    HTTP
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('https')}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      formData.type === 'https' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    HTTPS
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('socks4')}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      formData.type === 'socks4' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    SOCKS4
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('socks5')}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      formData.type === 'socks5' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    SOCKS5
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="proxyuser"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="proxypass"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md disabled:opacity-50"
          >
            {isLoading ? 'Adding...' : 'Add Proxy'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProxyManager;
