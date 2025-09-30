import { useState, useCallback, useEffect } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Table from '../ui/Table';
import { proxyAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, Trash2, RotateCcw, Lock, Unlock, Edit, X } from 'lucide-react';
import EditProxyModal from './EditProxyModal';

// Helper function to format failure reasons for display
const formatFailureReason = (failureReason) => {
  if (!failureReason) return 'failed';

  const reasonMap = {
    'Rate limit detected during scrolling': 'RL',
    'health_check_failed': 'fail hc',
    'cooldown': 'cooldown',
    'manual deactive': 'disabled'
  };

  if (reasonMap[failureReason]) {
    return reasonMap[failureReason];
  }

  if (failureReason.toLowerCase().includes('rate limit')) {
    return 'RL';
  }

  if (failureReason.toLowerCase().includes('manual')) {
    return 'disabled';
  }

  return 'fail';
};

// Helper function to get initial editing proxy state from localStorage
const getInitialEditingProxyState = () => {
  try {
    const isPageRefresh = sessionStorage.getItem('proxyPageRefreshed') === 'true';
    if (isPageRefresh) {
      const saved = localStorage.getItem('proxyList_editingProxy');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  } catch {
    return null;
  }
};

// Helper function to get initial locking proxy state from localStorage
const getInitialLockingProxyState = () => {
  try {
    const isPageRefresh = sessionStorage.getItem('proxyPageRefreshed') === 'true';
    if (isPageRefresh) {
      const saved = localStorage.getItem('proxyList_lockingProxy');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  } catch {
    return null;
  }
};

// Helper function to get initial lock input from localStorage
const getInitialLockInputState = () => {
  try {
    const isPageRefresh = sessionStorage.getItem('proxyPageRefreshed') === 'true';
    if (isPageRefresh) {
      const saved = localStorage.getItem('proxyList_lockInput');
      return saved || '';
    }
    return '';
  } catch {
    return '';
  }
};

const ProxyList = ({ proxies, onProxyRemoved, onProxyUpdated }) => {
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [unlockingProxy, setUnlockingProxy] = useState(null);
  const [lockingProxy, setLockingProxy] = useState(getInitialLockingProxyState);
  const [lockInput, setLockInput] = useState(getInitialLockInputState);
  const [editingProxy, setEditingProxy] = useState(getInitialEditingProxyState);

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

  const handleLockProxy = useCallback(async (proxyId, identifier, namespace) => {
    try {
      const response = await proxyAPI.lockProxy(proxyId, identifier, namespace);

      if (response.data.success) {
        toast.success('Proxy locked successfully');
        onProxyUpdated?.(proxyId, {
          is_locked: true,
          lock_worker: response.data.data.lock_value,
          lock_key: response.data.data.lock_key
        });
        setLockInput('');
        setLockingProxy(null);
        // Clear from localStorage
        try {
          localStorage.removeItem('proxyList_lockingProxy');
          localStorage.removeItem('proxyList_lockInput');
        } catch (error) {
          console.error('Error removing locking proxy from localStorage:', error);
        }
      } else {
        toast.error(response.data.message || 'Failed to lock proxy');
      }
    } catch (error) {
      console.error('Lock error:', error);
      if (error.response?.status === 401) {
        toast.error('Admin authentication required');
      } else if (error.response?.status === 404) {
        toast.error('Lock endpoint not found - check server configuration');
      } else {
        toast.error(error.response?.data?.message || 'Error locking proxy');
      }
    } finally {
      setLockingProxy(null);
    }
  }, [onProxyUpdated]);

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
      console.error('Unlock error:', error);
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
    try {
      localStorage.setItem('proxyList_editingProxy', JSON.stringify(proxy));
    } catch (error) {
      console.error('Error saving editing proxy to localStorage:', error);
    }
  }, []);

  const handleProxyUpdated = useCallback((proxyId, updates) => {
    onProxyUpdated?.(proxyId, updates);
    setEditingProxy(null);
    try {
      localStorage.removeItem('proxyList_editingProxy');
    } catch (error) {
      console.error('Error removing editing proxy from localStorage:', error);
    }
  }, [onProxyUpdated]);

  const handleCloseEditModal = useCallback(() => {
    setEditingProxy(null);
    try {
      localStorage.removeItem('proxyList_editingProxy');
    } catch (error) {
      console.error('Error removing editing proxy from localStorage:', error);
    }
  }, []);

  const handleLockIconClick = useCallback((proxy) => {
    if (!proxy.is_locked) {
      setLockingProxy(proxy.id);
      setLockInput('');
      try {
        localStorage.setItem('proxyList_lockingProxy', JSON.stringify(proxy.id));
        localStorage.setItem('proxyList_lockInput', '');
      } catch (error) {
        console.error('Error saving locking proxy to localStorage:', error);
      }
    }
  }, []);

  const handleLockSubmit = useCallback((proxy) => {
    if (!lockInput.trim()) {
      toast.error('Please enter a value (e.g., watchlist:1 or non-watchlist:1)');
      return;
    }

    const userValue = lockInput.trim();
    handleLockProxy(proxy.id, userValue, null);
  }, [lockInput, handleLockProxy]);

  const handleLockCancel = useCallback(() => {
    setLockingProxy(null);
    setLockInput('');
    try {
      localStorage.removeItem('proxyList_lockingProxy');
      localStorage.removeItem('proxyList_lockInput');
    } catch (error) {
      console.error('Error removing locking proxy from localStorage:', error);
    }
  }, []);

  // Save lockInput to localStorage whenever it changes
  useEffect(() => {
    if (lockingProxy !== null) {
      try {
        localStorage.setItem('proxyList_lockInput', lockInput);
      } catch (error) {
        console.error('Error saving lock input to localStorage:', error);
      }
    }
  }, [lockInput, lockingProxy]);

  // Detect page refresh and restore state
  useEffect(() => {
    const isInitialLoad = !sessionStorage.getItem('proxyPageVisited');
    if (!isInitialLoad) {
      sessionStorage.setItem('proxyPageRefreshed', 'true');
    } else {
      sessionStorage.setItem('proxyPageVisited', 'true');
    }

    // Only restore state after setting the flag
    setTimeout(() => {
      // Restore editing proxy state
      const savedEditingProxy = getInitialEditingProxyState();
      if (savedEditingProxy) {
        const proxyStillExists = proxies.some(proxy => proxy.id === savedEditingProxy.id);
        if (proxyStillExists) {
          setEditingProxy(savedEditingProxy);
        } else {
          localStorage.removeItem('proxyList_editingProxy');
        }
      }

      // Restore locking proxy state
      const savedLockingProxyId = getInitialLockingProxyState();
      if (savedLockingProxyId) {
        const proxyStillExists = proxies.some(proxy => proxy.id === savedLockingProxyId);
        if (proxyStillExists) {
          setLockingProxy(savedLockingProxyId);
          const savedLockInput = getInitialLockInputState();
          setLockInput(savedLockInput);
        } else {
          localStorage.removeItem('proxyList_lockingProxy');
          localStorage.removeItem('proxyList_lockInput');
        }
      }

      // Clear the refresh flag after restoration
      sessionStorage.removeItem('proxyPageRefreshed');
    }, 0);
  }, []);

  // Cleanup on unmount (page navigation)
  useEffect(() => {
    return () => {
      const isPageRefresh = sessionStorage.getItem('proxyPageRefreshed') === 'true';
      if (!isPageRefresh) {
        localStorage.removeItem('proxyList_editingProxy');
        localStorage.removeItem('proxyList_lockingProxy');
        localStorage.removeItem('proxyList_lockInput');
      }
    };
  }, []);

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
            {proxy.is_locked ? (
              <div
                className="absolute top-1 left-1 cursor-pointer hover:bg-orange-100 px-1 py-0.5 rounded z-10 text-xs text-orange-600 font-medium bg-white border border-orange-200"
                onClick={() => handleUnlockProxy(proxy.id, proxy.lock_key)}
                title={`Click to unlock proxy locked by ${proxy.lock_worker}`}
              >
                🔒 {(() => {
                  if (!proxy.lock_worker) return 'WL-1';
                  if (proxy.lock_worker.includes('non-watchlist')) {
                    const match = proxy.lock_worker.match(/non-watchlist:(\d+)/);
                    const number = match ? match[1] : '1';
                    return `NWL-${number}`;
                  } else if (proxy.lock_worker.includes('watchlist')) {
                    const match = proxy.lock_worker.match(/watchlist:(\d+)/);
                    const number = match ? match[1] : '1';
                    return `WL-${number}`;
                  } else {
                    return 'WL-1';
                  }
                })()}
              </div>
            ) : (
              <div
                className="absolute top-1 left-1 cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded z-10 text-xs text-blue-600 font-medium bg-white border border-blue-200"
                onClick={() => handleLockIconClick(proxy)}
                title="Click to lock proxy"
              >
                🔓 Lock
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

      {/* Desktop view */}
      <div className="hidden xl:block overflow-hidden">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
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

          <div className="divide-y divide-gray-200">
            {proxies.map((proxy, index) => (
              <div key={proxy.id} className={`relative grid grid-cols-12 gap-1 px-4 py-3 text-xs hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                {proxy.is_locked ? (
                  <div
                    className="absolute left-1 top-1 cursor-pointer hover:bg-orange-100 px-1 py-0.5 rounded z-10 text-xs text-orange-600 font-medium bg-white border border-orange-200"
                    onClick={() => handleUnlockProxy(proxy.id, proxy.lock_key)}
                    title={`Click to unlock proxy locked by ${proxy.lock_worker}`}
                  >
                    🔒 {(() => {
                      if (!proxy.lock_worker) return 'WL-1';
                      if (proxy.lock_worker.includes('non-watchlist')) {
                        const match = proxy.lock_worker.match(/non-watchlist:(\d+)/);
                        const number = match ? match[1] : '1';
                        return `NWL-${number}`;
                      } else if (proxy.lock_worker.includes('watchlist')) {
                        const match = proxy.lock_worker.match(/watchlist:(\d+)/);
                        const number = match ? match[1] : '1';
                        return `WL-${number}`;
                      } else {
                        return 'WL-1';
                      }
                    })()}
                  </div>
                ) : (
                  <div
                    className="absolute left-1 top-1 cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded z-10 text-xs text-blue-600 font-medium bg-white border border-blue-200"
                    onClick={() => handleLockIconClick(proxy)}
                    title="Click to lock proxy"
                  >
                    🔓 Lock
                  </div>
                )}

                <div className={`col-span-3 flex flex-col items-center justify-center min-w-0 ${proxy.is_locked || lockingProxy === proxy.id ? 'pt-6' : ''}`}>
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
                      <div>Disabled: {proxy.disabled_date}</div>
                      <div>{proxy.disabled_time}</div>
                    </div>
                  )}
                </div>

                <div className="col-span-1 flex items-center justify-center">
                  <span className="text-gray-900 truncate">
                    {proxy.country || 'Unknown'}
                  </span>
                </div>

                <div className="col-span-1 flex items-center justify-center">
                  <Badge variant="info" size="sm" className="text-xs px-1 py-0.5">
                    {proxy.type?.toUpperCase() || 'HTTP'}
                  </Badge>
                </div>

                <div className="col-span-1 flex items-center justify-center">
                  <Badge
                    variant={proxy.is_working ? 'success' : (proxy.failure_reason === 'manual deactive' ? 'warning' : 'error')}
                    size="sm"
                    className="text-xs px-1 py-0.5"
                  >
                    {proxy.is_working ? 'Good' : formatFailureReason(proxy.failure_reason)}
                  </Badge>
                </div>

                <div className="col-span-1 flex items-center justify-center">
                  <span className="font-medium text-green-600">
                    {proxy.successCount || proxy.success_count || 0}
                  </span>
                </div>

                <div className="col-span-1 flex items-center justify-center">
                  <span className="font-medium text-red-600">
                    {proxy.failCount || proxy.fail_count || 0}
                  </span>
                </div>

                <div className="col-span-1 flex items-center justify-center">
                  <span className="font-medium text-gray-900">
                    {proxy.usage_count || 0}
                  </span>
                </div>

                <div className="col-span-2 flex flex-col items-center justify-center min-w-0">
                  <div className="text-gray-900 truncate w-full text-center">
                    {proxy.added_date}
                  </div>
                  <div className="text-gray-500 truncate w-full text-center">
                    {proxy.added_time}
                  </div>
                </div>

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
        onClose={handleCloseEditModal}
        proxy={editingProxy}
        onProxyUpdated={handleProxyUpdated}
      />

      {lockingProxy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Lock Proxy</h3>
              <button
                onClick={handleLockCancel}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                title="Close"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Enter the lock value (e.g., "watchlist:1" or "non-watchlist:1"):
            </p>
            <input
              type="text"
              value={lockInput}
              onChange={(e) => setLockInput(e.target.value)}
              placeholder="Enter value (e.g., watchlist:1)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const proxy = proxies.find(p => p.id === lockingProxy);
                  if (proxy) handleLockSubmit(proxy);
                }
              }}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleLockCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const proxy = proxies.find(p => p.id === lockingProxy);
                  if (proxy) handleLockSubmit(proxy);
                }}
                disabled={!lockInput.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Lock Proxy
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ProxyList;