import { useState, useCallback } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Table from '../ui/Table';
import { proxyAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, Trash2, RotateCcw, Lock, Unlock, Edit } from 'lucide-react';
import EditProxyModal from './EditProxyModal';

// Helper function to format failure reasons for display
const formatFailureReason = (failureReason) => {
  if (!failureReason) return 'failed';

  // Map failure reasons to display text as requested
  const reasonMap = {
    'Rate limit detected during scrolling': 'RL',
    'health_check_failed': 'fail hc',
    'cooldown': 'cooldown',
    'manual deactive': 'disabled'
  };

  // Check for exact matches first
  if (reasonMap[failureReason]) {
    return reasonMap[failureReason];
  }

  // Check for partial matches (e.g., "Rate limit detected..." -> "RL")
  if (failureReason.toLowerCase().includes('rate limit')) {
    return 'RL';
  }

  if (failureReason.toLowerCase().includes('manual')) {
    return 'disabled';
  }

  // Default to 'fail' for any other failure reasons
  return 'fail';
};

const ProxyList = ({ proxies, onProxyRemoved, onProxyUpdated }) => {
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [unlockingProxy, setUnlockingProxy] = useState(null);
  const [editingProxy, setEditingProxy] = useState(null);

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

  const handleUnlockProxy = useCallback(async (proxyId, lockKey) => {
    setUnlockingProxy(proxyId);
    try {
      const response = await proxyAPI.unlockProxy(lockKey);

      if (response.data.success) {
        toast.success('Proxy unlocked successfully');
        onProxyUpdated?.(proxyId, { is_locked: false, lock_worker: null, lock_key: null });
      } else {
        toast.error(response.data.message || 'Failed to unlock proxy');
      }
    } catch (error) {
      console.error('Unlock error:', error); // Debug log
      if (error.response?.status === 401) {
        toast.error('Admin authentication required');
      } else if (error.response?.status === 404) {
        toast.error('Unlock endpoint not found - check server configuration');
      } else {
        toast.error(error.response?.data?.message || 'Error unlocking proxy');
      }
    } finally {
      setUnlockingProxy(null);
    }
  }, [onProxyUpdated]);

  const handleEditProxy = useCallback((proxy) => {
    setEditingProxy(proxy);
  }, []);

  const handleProxyUpdated = useCallback((proxyId, updates) => {
    onProxyUpdated?.(proxyId, updates);
    setEditingProxy(null);
  }, [onProxyUpdated]);

  if (!proxies || proxies.length === 0) {
    return (
      <Card title="Proxy List" subtitle="Manage your proxy configurations">
        <div className="text-center py-8">
          <p className="text-gray-500 text-lg">No proxies found</p>
          <p className="text-gray-400 text-sm mt-2">Add your first proxy to get started</p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Proxy List" subtitle="Manage your proxy configurations">
      {/* Mobile view */}
      <div className="block xl:hidden space-y-4">
        {proxies.map((proxy) => (
          <div key={proxy.id} className="relative bg-gray-50 rounded-lg p-4 border border-gray-200">
            {/* Lock indicator floating in top left */}
            {proxy.is_locked && (
              <div
                className="absolute top-1 left-1 cursor-pointer hover:bg-orange-100 px-1 py-0.5 rounded z-10 text-xs text-orange-600 font-medium bg-white border border-orange-200"
                onClick={() => handleUnlockProxy(proxy.id, proxy.lock_key)}
                title={`Click to unlock proxy locked by ${proxy.lock_worker}`}
              >
                {proxy.lock_worker && (proxy.lock_worker.includes('non-watchlist') || proxy.lock_worker === 'non-watchlist') ? 'NWL-1' : 'WL-1'}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 break-all">
                    {proxy.ip}:{proxy.port}
                  </div>
                  {proxy.username && (
                    <div className="text-xs text-gray-500 mt-1 break-all">
                      {proxy.username}
                    </div>
                  )}
                </div>
                <div className="ml-3 flex-shrink-0">
                  <Badge
                    variant={proxy.is_working ? 'success' : (proxy.failure_reason === 'manual deactive' ? 'warning' : 'error')}
                    size="sm"
                  >
                    {proxy.is_working ? 'Working' : formatFailureReason(proxy.failure_reason)}
                  </Badge>
                </div>
              </div>

              {/* Disabled info in a separate section */}
              {proxy.disabled_at && (
                <div className="bg-red-50 border border-red-200 rounded px-2 py-1">
                  <div className="text-xs text-red-600 font-medium">
                    Disabled: {proxy.disabled_date} {proxy.disabled_time}
                  </div>
                </div>
              )}

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
                    <Badge variant="info" size="sm">
                      {proxy.type?.toUpperCase() || 'HTTP'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Success:</span>
                  <div className="font-medium text-green-600">
                    {proxy.successCount || proxy.success_count || 0}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Failed:</span>
                  <div className="font-medium text-red-600">
                    {proxy.failCount || proxy.fail_count || 0}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Total Usage:</span>
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

              <div className="flex items-center justify-center space-x-2 pt-2 border-t border-gray-200">
                <Button
                  onClick={() => handleEditProxy(proxy)}
                  variant="outline"
                  size="sm"
                  className="p-2 min-w-0"
                  title="Edit Proxy"
                >
                  <Edit className="h-4 w-4" />
                </Button>

                <Button
                  onClick={() => handleStatusUpdate(proxy.id, !proxy.is_working)}
                  disabled={updatingStatus === proxy.id}
                  variant={proxy.is_working ? 'outline' : 'success'}
                  size="sm"
                  className={`p-2 min-w-0 ${proxy.is_working ? 'border-red-500 text-red-500 hover:bg-red-50' : ''}`}
                  title={proxy.is_working ? 'Mark as Failed' : 'Mark as Working'}
                  loading={updatingStatus === proxy.id}
                >
                  {proxy.is_working ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </Button>

                <Button
                  onClick={() => handleRemoveProxy(proxy.id)}
                  variant="outline"
                  size="sm"
                  className="p-2 min-w-0 border-red-500 text-red-500 hover:bg-red-50"
                  title="Remove Proxy"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop view - Custom Table Implementation */}
      <div className="hidden xl:block overflow-hidden">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          {/* Table Header */}
          <div className="bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-12 gap-1 px-4 py-3 text-xs font-medium text-gray-700 uppercase tracking-wider">
              <div className="col-span-3 text-center">Proxy</div>
              <div className="col-span-1 text-center">Country</div>
              <div className="col-span-1 text-center">Type</div>
              <div className="col-span-1 text-center">Status</div>
              <div className="col-span-1 text-center">Success</div>
              <div className="col-span-1 text-center">Failed</div>
              <div className="col-span-1 text-center">Usage</div>
              <div className="col-span-2 text-center">Added</div>
              <div className="col-span-1 text-center">Actions</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-200">
            {proxies.map((proxy, index) => (
              <div key={proxy.id} className={`relative grid grid-cols-12 gap-1 px-4 py-3 text-xs hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                {/* Lock indicator floating in top left */}
                {proxy.is_locked && (
                  <div
                    className="absolute left-1 top-1 cursor-pointer hover:bg-orange-100 px-1 py-0.5 rounded z-10 text-xs text-orange-600 font-medium bg-white border border-orange-200"
                    onClick={() => handleUnlockProxy(proxy.id, proxy.lock_key)}
                    title={`Click to unlock proxy locked by ${proxy.lock_worker}`}
                  >
                    {proxy.lock_worker && (proxy.lock_worker.includes('non-watchlist') || proxy.lock_worker === 'non-watchlist') ? 'NWL-1' : 'WL-1'}
                  </div>
                )}

                {/* Proxy */}
                <div className={`col-span-3 flex flex-col items-center justify-center min-w-0 ${proxy.is_locked ? 'pt-6' : ''}`}>
                  <div className="font-medium text-gray-900 truncate w-full text-center">
                    {proxy.ip}:{proxy.port}
                  </div>
                  {proxy.username && (
                    <div className="text-gray-500 truncate w-full text-center">
                      {proxy.username}
                    </div>
                  )}
                  {proxy.disabled_at && (
                    <div className="text-[10px] text-red-600 w-full text-center mt-1 bg-red-50 rounded px-1 py-0.5 border border-red-200">
                      Disabled: {proxy.disabled_date}
                    </div>
                  )}
                </div>

                {/* Country */}
                <div className="col-span-1 flex items-center justify-center">
                  <span className="text-gray-900 truncate">
                    {proxy.country || 'Unknown'}
                  </span>
                </div>

                {/* Type */}
                <div className="col-span-1 flex items-center justify-center">
                  <Badge variant="info" size="sm" className="text-xs px-1 py-0.5">
                    {proxy.type?.toUpperCase() || 'HTTP'}
                  </Badge>
                </div>

                {/* Status */}
                <div className="col-span-1 flex items-center justify-center">
                  <Badge
                    variant={proxy.is_working ? 'success' : (proxy.failure_reason === 'manual deactive' ? 'warning' : 'error')}
                    size="sm"
                    className="text-xs px-1 py-0.5"
                  >
                    {proxy.is_working ? 'Good' : formatFailureReason(proxy.failure_reason)}
                  </Badge>
                </div>

                {/* Success */}
                <div className="col-span-1 flex items-center justify-center">
                  <span className="font-medium text-green-600">
                    {proxy.successCount || proxy.success_count || 0}
                  </span>
                </div>

                {/* Failed */}
                <div className="col-span-1 flex items-center justify-center">
                  <span className="font-medium text-red-600">
                    {proxy.failCount || proxy.fail_count || 0}
                  </span>
                </div>

                {/* Total */}
                <div className="col-span-1 flex items-center justify-center">
                  <span className="font-medium text-gray-900">
                    {proxy.usage_count || 0}
                  </span>
                </div>

                {/* Added */}
                <div className="col-span-2 flex flex-col items-center justify-center min-w-0">
                  <div className="text-gray-900 truncate w-full text-center">
                    {proxy.added_date}
                  </div>
                  <div className="text-gray-500 truncate w-full text-center">
                    {proxy.added_time}
                  </div>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center justify-center space-x-1">
                  <button
                    onClick={() => handleEditProxy(proxy)}
                    className="p-1 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center"
                    title="Edit Proxy"
                  >
                    <Edit className="h-3 w-3 text-gray-600" />
                  </button>

                  <button
                    onClick={() => handleStatusUpdate(proxy.id, !proxy.is_working)}
                    disabled={updatingStatus === proxy.id}
                    className={`p-1 border rounded hover:bg-gray-50 flex items-center justify-center ${proxy.is_working
                        ? 'border-red-300 text-red-500 hover:bg-red-50'
                        : 'border-green-300 text-green-500 hover:bg-green-50'
                      }`}
                    title={proxy.is_working ? 'Mark as Failed' : 'Mark as Working'}
                  >
                    {proxy.is_working ? (
                      <XCircle className="h-3 w-3" />
                    ) : (
                      <CheckCircle className="h-3 w-3" />
                    )}
                  </button>

                  <button
                    onClick={() => handleRemoveProxy(proxy.id)}
                    className="p-1 border border-red-300 text-red-500 rounded hover:bg-red-50 flex items-center justify-center"
                    title="Remove Proxy"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <EditProxyModal
        isOpen={editingProxy !== null}
        onClose={() => setEditingProxy(null)}
        proxy={editingProxy}
        onProxyUpdated={handleProxyUpdated}
      />
    </Card>
  );
};

export default ProxyList;