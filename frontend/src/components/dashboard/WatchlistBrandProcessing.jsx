import React from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorDisplay from '../ui/ErrorDisplay';
import { Play, Clock, Hourglass, XCircle, CheckCircle, Eye, ExternalLink } from 'lucide-react';
import { openFacebookAdLibrary } from '../../utils/facebookAdLibrary';

const WatchlistBrandProcessing = ({ allBrandProcessingData, loading, error }) => {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <ErrorDisplay message={error} />
      </Card>
    );
  }

  if (!allBrandProcessingData) {
    return (
      <Card className="p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Watchlist Brand Processing</h3>
        <div className="text-center py-6 sm:py-8">
          <Eye className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
          <p className="text-gray-500 text-sm sm:text-base">No watchlist brand processing data available</p>
        </div>
      </Card>
    );
  }

  const { analytics, brands = [] } = allBrandProcessingData;
  const counters = analytics?.pre_computed_counters || {};

  // Get sample jobs for display (first few from each category)
  const activeJobs = brands.filter(brand => brand.job_status === 'active').slice(0, 6);
  const waitingJobs = brands.filter(brand => brand.job_status === 'waiting').slice(0, 6);
  const delayedJobs = brands.filter(brand => brand.job_status === 'delayed').slice(0, 6);
  const completedJobs = brands.filter(brand => brand.job_status === 'completed').slice(0, 6);
  const failedJobs = brands.filter(brand => brand.job_status === 'failed').slice(0, 6);
  const prioritizedJobs = brands.filter(brand => brand.job_status === 'prioritized').slice(0, 6);

  // Combine all jobs for display
  const allJobs = [...activeJobs, ...waitingJobs, ...delayedJobs, ...completedJobs, ...failedJobs, ...prioritizedJobs];

  const renderStatusCard = (status, jobs, title, icon, bgColor, iconColor) => {
    return (
      <Card key={status}>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{title}</h3>
        
        {jobs.length > 0 ? (
          <div className="space-y-4">
            {/* Header with count */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                {jobs.length} watchlist job{jobs.length !== 1 ? 's' : ''} {status}
              </span>
              <Badge variant={status === 'active' ? 'success' : status === 'waiting' ? 'warning' : status === 'prioritized' ? 'info' : 'secondary'} className="flex items-center space-x-1">
                {React.createElement(icon, { className: "h-3 w-3" })}
                <span>{counters[status] || 0}</span>
              </Badge>
            </div>

            {/* List of jobs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-96 overflow-y-auto scrollbar-hide">
              {jobs.map((job, index) => (
                <div key={`${job.job_id}-${index}`} className={`flex flex-col space-y-2 p-3 rounded-lg border min-h-[200px] ${bgColor}`}>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                      {React.createElement(icon, { className: "h-3 w-3 sm:h-4 sm:w-4" })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {job.page_name || job.brand_name || 'Unknown Brand'}
                        </p>
                        {job.page_id && (
                          <button
                            onClick={() => openFacebookAdLibrary(job.page_id)}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="View in Facebook Ad Library"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1 flex-1">
                    <p className="text-xs text-gray-500">
                      ID: {job.brand_id} | Page: {job.page_id}
                    </p>
                    {job.page_category && job.page_category !== 'Unknown' && (
                      <p className="text-xs text-gray-500">
                        Category: {job.page_category}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Job ID: {job.job_id}
                    </p>
                    <p className="text-xs text-gray-500">
                      {job.job_status === 'active' && 'Started at '}
                      {job.job_status === 'waiting' && 'Queued at '}
                      {job.job_status === 'completed' && 'Completed at '}
                      {job.job_status === 'failed' && 'Failed at '}
                      {job.job_status === 'prioritized' && 'Prioritized at '}
                      {job.job_status === 'delayed' && 'Created at '}
                      {new Date(job.status_timestamp || job.created_at).toLocaleDateString('en-GB')} {new Date(job.status_timestamp || job.created_at).toLocaleTimeString()}
                    </p>
                    {job.delayed_until && (
                      <p className="text-xs text-gray-500">
                        Delayed until {new Date(job.delayed_until).toLocaleString()}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Total Ads: {job.total_ads}
                    </p>
                  </div>
                  
                  <div className="flex justify-end mt-auto pt-2">
                    <Badge 
                      variant={
                        status === 'active' ? 'success' : 
                        status === 'waiting' ? 'warning' : 
                        status === 'prioritized' ? 'info' : 
                        status === 'delayed' ? 'secondary' :
                        status === 'completed' ? 'success' :
                        status === 'failed' ? 'destructive' :
                        'secondary'
                      }
                      className="text-xs"
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 sm:py-8">
            {React.createElement(icon, { className: "h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" })}
            <p className="text-gray-500 text-sm sm:text-base">No watchlist {status} jobs</p>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1">
      <Card>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
          Watchlist Brand Processing
        </h3>
        
        {allJobs.length > 0 ? (
          <div className="space-y-4">
            {/* Header with count and badges */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium text-gray-600">
                {allJobs.length} watchlist job{allJobs.length !== 1 ? 's' : ''} in processing
              </span>
              <div className="grid grid-cols-2 sm:flex sm:gap-2 sm:flex-wrap gap-1">
                <Badge variant="success" className="flex items-center justify-center space-x-1 text-xs px-2 py-1">
                  <Play className="h-2.5 w-2.5" />
                  <span className="text-xs">Active: {counters.active || 0}</span>
                </Badge>
                <Badge variant="warning" className="flex items-center justify-center space-x-1 text-xs px-2 py-1">
                  <Hourglass className="h-2.5 w-2.5" />
                  <span className="text-xs">Waiting: {counters.waiting || 0}</span>
                </Badge>
                <Badge variant="secondary" className="flex items-center justify-center space-x-1 text-xs px-2 py-1">
                  <Clock className="h-2.5 w-2.5" />
                  <span className="text-xs">Delayed: {counters.delayed || 0}</span>
                </Badge>
                <Badge variant="default" className="flex items-center justify-center space-x-1 text-xs px-2 py-1">
                  <CheckCircle className="h-2.5 w-2.5" />
                  <span className="text-xs">Complete: {counters.completed || 0}</span>
                </Badge>
                <Badge variant="error" className="flex items-center justify-center space-x-1 text-xs px-2 py-1">
                  <XCircle className="h-2.5 w-2.5" />
                  <span className="text-xs">Failed: {counters.failed || 0}</span>
                </Badge>
                <Badge variant="info" className="flex items-center justify-center space-x-1 text-xs px-2 py-1">
                  <Clock className="h-2.5 w-2.5" />
                  <span className="text-xs">Priority: {counters.prioritized || 0}</span>
                </Badge>
              </div>
            </div>

            {/* List of all processing jobs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-96 overflow-y-auto scrollbar-hide">
              {allJobs.map((job, index) => (
                <div key={`${job.job_id}-${index}`} className={`flex flex-col space-y-2 p-3 rounded-lg border min-h-[200px] ${
                  job.job_status === 'active' ? 'bg-green-50 border-green-200' :
                  job.job_status === 'waiting' ? 'bg-yellow-50 border-yellow-200' :
                  job.job_status === 'delayed' ? 'bg-orange-50 border-orange-200' :
                  job.job_status === 'completed' ? 'bg-green-50 border-green-200' :
                  job.job_status === 'failed' ? 'bg-red-50 border-red-200' :
                  job.job_status === 'prioritized' ? 'bg-blue-50 border-blue-200' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      job.job_status === 'active' ? 'bg-green-100' :
                      job.job_status === 'waiting' ? 'bg-yellow-100' :
                      job.job_status === 'delayed' ? 'bg-orange-100' :
                      job.job_status === 'completed' ? 'bg-green-100' :
                      job.job_status === 'failed' ? 'bg-red-100' :
                      job.job_status === 'prioritized' ? 'bg-blue-100' :
                      'bg-gray-100'
                    }`}>
                      {job.job_status === 'active' ? <Play className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" /> :
                       job.job_status === 'waiting' ? <Hourglass className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600" /> :
                       job.job_status === 'delayed' ? <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" /> :
                       job.job_status === 'completed' ? <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" /> :
                       job.job_status === 'failed' ? <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" /> :
                       job.job_status === 'prioritized' ? <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" /> :
                       <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {job.page_name || job.brand_name || 'Unknown Brand'}
                        </p>
                        {job.page_id && (
                          <button
                            onClick={() => openFacebookAdLibrary(job.page_id)}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="View in Facebook Ad Library"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1 flex-1">
                    <p className="text-xs text-gray-500">
                      ID: {job.brand_id} | Page: {job.page_id}
                    </p>
                    {job.page_category && job.page_category !== 'Unknown' && (
                      <p className="text-xs text-gray-500">
                        Category: {job.page_category}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Job ID: {job.job_id}
                    </p>
                    <p className="text-xs text-gray-500">
                      {job.job_status === 'active' && 'Started at '}
                      {job.job_status === 'waiting' && 'Queued at '}
                      {job.job_status === 'completed' && 'Completed at '}
                      {job.job_status === 'failed' && 'Failed at '}
                      {job.job_status === 'prioritized' && 'Prioritized at '}
                      {job.job_status === 'delayed' && 'Created at '}
                      {new Date(job.status_timestamp || job.created_at).toLocaleDateString('en-GB')} {new Date(job.status_timestamp || job.created_at).toLocaleTimeString()}
                    </p>
                    {job.delayed_until && (
                      <p className="text-xs text-gray-500">
                        Delayed until {new Date(job.delayed_until).toLocaleString()}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Total Ads: {job.total_ads}
                    </p>
                  </div>
                  
                  <div className="flex justify-end mt-auto pt-2">
                    <Badge 
                      variant={
                        job.job_status === 'active' ? 'success' :
                        job.job_status === 'waiting' ? 'warning' :
                        job.job_status === 'delayed' ? 'secondary' :
                        job.job_status === 'completed' ? 'success' :
                        job.job_status === 'failed' ? 'error' :
                        job.job_status === 'prioritized' ? 'info' :
                        'secondary'
                      }
                      className="text-xs"
                    >
                      {job.job_status === 'active' ? 'Active' :
                       job.job_status === 'waiting' ? 'Waiting' :
                       job.job_status === 'delayed' ? 'Delayed' :
                       job.job_status === 'completed' ? 'Completed' :
                       job.job_status === 'failed' ? 'Failed' :
                       job.job_status === 'prioritized' ? 'Prioritized' :
                       job.job_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 sm:py-8">
            <Eye className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
            <p className="text-gray-500 text-sm sm:text-base">No watchlist brand processing jobs</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default WatchlistBrandProcessing;