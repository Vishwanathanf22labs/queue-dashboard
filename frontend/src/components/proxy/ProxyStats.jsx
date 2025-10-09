import Card from '../ui/Card';

const ProxyStats = ({ stats, managementStats }) => {
  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* First Row - 4 Cards (2 on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {/* 1. Total Proxies */}
        <Card padding="p-3 sm:p-4 lg:p-6">
          <div className="text-center">
            <div className="flex justify-center mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">Total Proxies</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{stats?.total_proxies || 0}</p>
          </div>
        </Card>

        {/* 2. Working Proxies */}
        <Card padding="p-3 sm:p-4 lg:p-6">
          <div className="text-center">
            <div className="flex justify-center mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">Working Proxies</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">{stats?.working_proxies || 0}</p>
          </div>
        </Card>

        {/* 3. Failed Proxies */}
        <Card padding="p-3 sm:p-4 lg:p-6">
          <div className="text-center">
            <div className="flex justify-center mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">Failed Proxies</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600">
              {(stats?.total_proxies || 0) - (stats?.working_proxies || 0)}
            </p>
          </div>
        </Card>

        {/* 4. Total Usage */}
        <Card padding="p-3 sm:p-4 lg:p-6">
          <div className="text-center">
            <div className="flex justify-center mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">Total Usage</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-600">{stats?.total_usage || 0}</p>
          </div>
        </Card>
      </div>

      {/* Second Row - 4 Cards (2 on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {/* 5. Total Success Count */}
        <Card padding="p-3 sm:p-4 lg:p-6">
          <div className="text-center">
            <div className="flex justify-center mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">Total Success Count</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">{stats?.total_success_count || 0}</p>
          </div>
        </Card>

        {/* 6. Total Failed Count */}
        <Card padding="p-3 sm:p-4 lg:p-6">
          <div className="text-center">
            <div className="flex justify-center mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">Total Failed Count</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600">{stats?.total_failed_count || 0}</p>
          </div>
        </Card>

        {/* 7. Locked Proxies */}
        <Card padding="p-3 sm:p-4 lg:p-6">
          <div className="text-center">
            <div className="flex justify-center mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">Locked Proxies</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600">{stats?.locked_proxies || 0}</p>
          </div>
        </Card>

        {/* 8. Total Added */}
        {managementStats && (
          <Card padding="p-3 sm:p-4 lg:p-6">
            <div className="text-center">
              <div className="flex justify-center mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">Total Added</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-emerald-600">{managementStats?.total_added || 0}</p>
            </div>
          </Card>
        )}
      </div>

      {/* Third Row - 2 Cards (2 on mobile, 2 on desktop) */}
      {managementStats && (
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-2 sm:gap-4">
          {/* 9. Total Removed */}
          <Card padding="p-3 sm:p-4 lg:p-6">
            <div className="text-center">
              <div className="flex justify-center mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-rose-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">Total Removed</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-rose-600">{managementStats?.total_removed || 0}</p>
            </div>
          </Card>

          {/* 10. Last Updated */}
          <Card padding="p-3 sm:p-4 lg:p-6">
            <div className="text-center">
              <div className="flex justify-center mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">Last Updated</p>
              <p className="text-sm sm:text-base lg:text-lg font-bold text-purple-600">
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