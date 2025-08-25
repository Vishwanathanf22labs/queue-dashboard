import React, { useState, useCallback } from 'react';
import Button from '../ui/Button';
import { proxyAPI } from '../../services/api';
import toast from 'react-hot-toast';

const ProxyList = ({ proxies, onProxyRemoved, onProxyUpdated }) => {
  const [updatingStatus, setUpdatingStatus] = useState(null);

  const handleStatusUpdate = useCallback(async (proxyId, isWorking) => {
    setUpdatingStatus(proxyId);
    try {
      const response = await proxyAPI.updateProxyStatus(proxyId, isWorking);
      
      if (response.data.success) {
        toast.success(`Proxy marked as ${isWorking ? 'working' : 'not working'}`);
        onProxyUpdated?.(proxyId, { is_working: isWorking });
      } else {
        toast.error(response.data.message || 'Failed to update proxy status');
      }
    } catch (error) {
      toast.error('Error updating proxy status');
    } finally {
      setUpdatingStatus(null);
    }
  }, [onProxyUpdated]);

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

  const getStatusBadge = (isWorking) => {
    return isWorking ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
        Working
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
        Failed
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const typeColors = {
      http: 'bg-blue-100 text-blue-800 border-blue-200',
      https: 'bg-green-100 text-green-800 border-green-200',
      socks4: 'bg-purple-100 text-purple-800 border-purple-200',
      socks5: 'bg-indigo-100 text-indigo-800 border-indigo-200'
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${typeColors[type] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
        {type?.toUpperCase() || 'UNKNOWN'}
      </span>
    );
  };

  if (!proxies || proxies.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <p className="text-gray-500 text-lg">No proxies found</p>
        <p className="text-gray-400 text-sm mt-2">Add your first proxy to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 text-center sm:text-left">Proxy List</h3>
        <p className="text-sm text-gray-500 mt-1 text-center sm:text-left">Manage your proxy configurations</p>
      </div>
      
      {/* Mobile Card View */}
      <div className="block sm:hidden p-4 space-y-4">
        {proxies.map((proxy) => (
          <div key={proxy.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="space-y-3">
              {/* Proxy Info */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 break-all">
                    {proxy.ip}:{proxy.port}
                  </div>
                  {proxy.username && (
                    <div className="text-xs text-gray-500 mt-1 break-all">
                      {proxy.username}
                    </div>
                  )}
                </div>
                <div className="ml-3">
                  {getStatusBadge(proxy.is_working)}
                </div>
              </div>
              
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-500">Country:</span>
                  <div className="font-medium text-gray-900 break-all">
                    {proxy.country || 'Unknown'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Type:</span>
                  <div className="mt-1">
                    {getTypeBadge(proxy.type)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Usage:</span>
                  <div className="font-medium text-gray-900">
                    {proxy.usage_count || 0}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Added:</span>
                  <div className="font-medium text-gray-900 text-xs break-all">
                    {proxy.added_date}
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex flex-col space-y-2 pt-2 border-t border-gray-200">
                <Button
                  onClick={() => handleStatusUpdate(proxy.id, !proxy.is_working)}
                  disabled={updatingStatus === proxy.id}
                  className={`w-full px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    proxy.is_working 
                      ? 'bg-red-600 hover:bg-red-700 text-white border border-red-600' 
                      : 'bg-green-600 hover:bg-green-700 text-white border border-green-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {updatingStatus === proxy.id 
                    ? 'Updating...' 
                    : proxy.is_working ? 'Mark Failed' : 'Mark Working'
                  }
                </Button>
                
                <Button
                  onClick={() => handleRemoveProxy(proxy.id)}
                  className="w-full px-3 py-2 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md border border-red-600 transition-colors"
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Proxy
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Country
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Usage
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Added
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {proxies.map((proxy) => (
              <tr key={proxy.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center">
                    <div className="text-sm font-medium text-gray-900">
                      {proxy.ip}:{proxy.port}
                    </div>
                    {proxy.username && (
                      <div className="text-xs text-gray-500 mt-1">
                        {proxy.username}
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="px-4 py-3 text-center">
                  <div className="text-sm text-gray-900">
                    {proxy.country || 'Unknown'}
                  </div>
                </td>
                
                <td className="px-4 py-3 text-center">
                  {getTypeBadge(proxy.type)}
                </td>
                
                <td className="px-4 py-3 text-center">
                  {getStatusBadge(proxy.is_working)}
                </td>
                
                <td className="px-4 py-3 text-center">
                  <div className="text-sm font-medium text-gray-900">
                    {proxy.usage_count || 0}
                  </div>
                </td>
                
                <td className="px-4 py-3 text-center">
                  <div className="text-sm text-gray-900">{proxy.added_date}</div>
                  <div className="text-xs text-gray-500 mt-1">{proxy.added_time}</div>
                </td>
                
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col space-y-1.5 items-center">
                    <Button
                      onClick={() => handleStatusUpdate(proxy.id, !proxy.is_working)}
                      disabled={updatingStatus === proxy.id}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        proxy.is_working 
                          ? 'bg-red-600 hover:bg-red-700 text-white border border-red-600' 
                          : 'bg-green-600 hover:bg-green-700 text-white border border-green-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {updatingStatus === proxy.id 
                        ? 'Updating...' 
                        : proxy.is_working ? 'Mark Failed' : 'Mark Working'
                      }
                    </Button>
                    
                    <Button
                      onClick={() => handleRemoveProxy(proxy.id)}
                      className="px-2.5 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md border border-red-600 transition-colors"
                    >
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProxyList;
