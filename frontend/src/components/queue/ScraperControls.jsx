import { useEffect, useState } from 'react';
import useQueueStore from '../../stores/queueStore';
import { Play, Pause, Square, Clock } from 'lucide-react';
import LoadingState from '../ui/LoadingState';
import ErrorDisplay from '../ui/ErrorDisplay';
import Button from '../ui/Button';

const ScraperControls = ({ onStatusChange, onStatusDataChange }) => {
  const { fetchScraperStatus } = useQueueStore();
  const [scraperStatus, setScraperStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getStatusInfo = (status) => {
    switch (status) {
      case 'running':
        return { 
          variant: 'success', 
          icon: Play, 
          label: 'Running',
          description: 'The scraper is currently active and processing brands',
          color: 'text-green-600',
          bgColor: 'bg-green-100'
        };
      case 'not_running':
        return { 
          variant: 'secondary', 
          icon: Pause, 
          label: 'Not Running',
          description: 'The scraper is not currently processing any brands',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100'
        };
      case 'paused':
        return { 
          variant: 'warning', 
          icon: Pause, 
          label: 'Paused',
          description: 'The scraper is temporarily paused',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100'
        };
      case 'stopped':
        return { 
          variant: 'error', 
          icon: Square, 
          label: 'Stopped',
          description: 'The scraper is currently stopped',
          color: 'text-red-600',
          bgColor: 'bg-red-100'
        };
      default:
        return { 
          variant: 'secondary', 
          icon: Clock, 
          label: 'Unknown',
          description: 'Unable to determine scraper status',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100'
        };
    }
  };

  const loadScraperStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchScraperStatus();
      setScraperStatus(result.status);
      
      if (onStatusChange) {
        onStatusChange(result.status);
      }
      if (onStatusDataChange) {
        onStatusDataChange(result.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch scraper status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScraperStatus();
  }, []);

  const handleRefresh = () => {
    loadScraperStatus();
  };

  if (loading && !scraperStatus) {
    return <LoadingState size="lg" message="Loading scraper status..." />;
  }

  if (error) {
    return (
      <ErrorDisplay title="Error Loading Scraper Status" message={error}>
        <Button variant="retry" size="md" onClick={handleRefresh}>
          Retry
        </Button>
      </ErrorDisplay>
    );
  }

  const statusInfo = getStatusInfo(scraperStatus);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scraper Controls</h1>
          <p className="text-gray-600 mt-1">Monitor and view scraper status</p>
        </div>
        <Button onClick={handleRefresh} disabled={loading}>
          Refresh Status
        </Button>
      </div>
    </div>
  );
};

export default ScraperControls;
