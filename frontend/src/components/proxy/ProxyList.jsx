import { useState, useCallback } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Table from '../ui/Table';
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
      <Badge variant="success" size="sm">Working</Badge>
    ) : (
      <Badge variant="error" size="sm">Failed</Badge>
    );
  };

  const getTypeBadge = (type) => {
    const typeVariants = {
      http: 'info',
      https: 'success',
      socks4: 'warning',
      socks5: 'primary'
    };

    return (
      <Badge variant={typeVariants[type] || 'gray'} size="sm">
        {type?.toUpperCase() || 'UNKNOWN'}
      </Badge>
    );
  };


  const columns = [
    {
      key: 'proxy',
      label: 'Proxy',
      headerAlign: 'center',
      render: (value, row) => (
        <div className="flex flex-col items-center">
          <div className="text-sm font-medium text-gray-900">
            {row.ip}:{row.port}
          </div>
          {row.username && (
            <div className="text-xs text-gray-500 mt-1">
              {row.username}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'country',
      label: 'Country',
      headerAlign: 'center',
      render: (value, row) => (
        <div className="text-sm text-gray-900">
          {row.country || 'Unknown'}
        </div>
      )
    },
    {
      key: 'type',
      label: 'Type',
      headerAlign: 'center',
      render: (value, row) => getTypeBadge(row.type)
    },
    {
      key: 'status',
      label: 'Status',
      headerAlign: 'center',
      render: (value, row) => getStatusBadge(row.is_working)
    },
    {
      key: 'usage',
      label: 'Usage',
      headerAlign: 'center',
      render: (value, row) => (
        <div className="text-sm font-medium text-gray-900">
          {row.usage_count || 0}
        </div>
      )
    },
    {
      key: 'added',
      label: 'Added',
      headerAlign: 'center',
      render: (value, row) => (
        <div>
          <div className="text-sm text-gray-900">{row.added_date}</div>
          <div className="text-xs text-gray-500 mt-1">{row.added_time}</div>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      headerAlign: 'center',
      render: (value, row) => (
        <div className="flex flex-col space-y-1.5 items-center">
          <Button
            onClick={() => handleStatusUpdate(row.id, !row.is_working)}
            disabled={updatingStatus === row.id}
            variant={row.is_working ? 'error' : 'success'}
            size="sm"
            loading={updatingStatus === row.id}
          >
            {row.is_working ? 'Mark Failed' : 'Mark Working'}
          </Button>

          <Button
            onClick={() => handleRemoveProxy(row.id)}
            variant="error"
            size="sm"
          >
            Remove
          </Button>
        </div>
      )
    }
  ];

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
      <div className="block sm:hidden space-y-4">
        {proxies.map((proxy) => (
          <div key={proxy.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="space-y-3">
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

              <div className="flex flex-col space-y-2 pt-2 border-t border-gray-200">
                <Button
                  onClick={() => handleStatusUpdate(proxy.id, !proxy.is_working)}
                  disabled={updatingStatus === proxy.id}
                  variant={proxy.is_working ? 'error' : 'success'}
                  size="sm"
                  className="w-full"
                  loading={updatingStatus === proxy.id}
                >
                  {proxy.is_working ? 'Mark Failed' : 'Mark Working'}
                </Button>

                <Button
                  onClick={() => handleRemoveProxy(proxy.id)}
                  variant="error"
                  size="sm"
                  className="w-full"
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>


      <div className="hidden sm:block">
        <Table
          data={proxies}
          columns={columns}
          emptyMessage="No proxies found"
          className="shadow-md rounded-lg"
        />
      </div>
    </Card>
  );
};

export default ProxyList;
