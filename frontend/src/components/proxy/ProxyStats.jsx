import Card from '../ui/Card';

const ProxyStats = ({ stats, managementStats }) => {
  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Main Proxy Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="p-6">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-2">Total Proxies</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.total_proxies || 0}</p>
          </div>
        </Card>

        <Card padding="p-6">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-2">Working Proxies</p>
            <p className="text-2xl font-semibold text-green-600">{stats?.working_proxies || 0}</p>
          </div>
        </Card>

        <Card padding="p-6">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-2">Failed Proxies</p>
            <p className="text-2xl font-semibold text-red-600">
              {(stats?.total_proxies || 0) - (stats?.working_proxies || 0)}
            </p>
          </div>
        </Card>

        <Card padding="p-6">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-2">Total Usage</p>
            <p className="text-2xl font-semibold text-yellow-600">{stats?.total_usage || 0}</p>
          </div>
        </Card>
      </div>

      {/* Management Stats */}
      {managementStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card padding="p-6">
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="w-8 h-8 bg-emerald-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-2">Total Added</p>
              <p className="text-2xl font-semibold text-emerald-600">{managementStats?.total_added || 0}</p>
            </div>
          </Card>

          <Card padding="p-6">
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="w-8 h-8 bg-rose-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-2">Total Removed</p>
              <p className="text-2xl font-semibold text-rose-600">{managementStats?.total_removed || 0}</p>
            </div>
          </Card>

          <Card padding="p-6">
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-2">Last Updated</p>
              <p className="text-lg font-semibold text-purple-600">
                {managementStats?.last_updated ? new Date(managementStats.last_updated).toLocaleDateString() : 'Never'}
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ProxyStats;
