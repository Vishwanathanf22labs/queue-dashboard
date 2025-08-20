import React, { useState, useEffect, useCallback } from 'react';
import Button from '../ui/Button';
import { queueAPI } from '../../services/api';

const ScraperControls = ({ onStatusChange, onStatusDataChange, className = '' }) => {
  const [scraperStatus, setScraperStatus] = useState('unknown');
  const [isLoading, setIsLoading] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [error, setError] = useState(null);
  const [statusData, setStatusData] = useState(null);


  const fetchScraperStatus = useCallback(async () => {
    try {
      const response = await queueAPI.getScraperStatus();
      
      // Check if response has the expected structure
      if (!response.data) {
        setError('Invalid response structure from server');
        setScraperStatus('stopped');
        return;
      }
      
      // Check if response.data.data exists (backend wraps status in data.data)
      if (!response.data.data) {
        setError('Invalid response structure from server - missing data wrapper');
        setScraperStatus('stopped');
        return;
      }
      
      // The backend wraps the status in response.data.data
      const status = response.data.data.status;
      
      // Ensure we have a valid status
      if (status && ['running', 'paused', 'stopped'].includes(status)) {
        setScraperStatus(status);
        setStatusData(response.data.data); // Store full status data
        setError(null);
        
        // Notify parent component if callback exists
        if (onStatusChange) {
          onStatusChange(status);
        }
        
        // Notify parent component of status data changes
        if (onStatusDataChange) {
          onStatusDataChange(response.data.data);
        }
      } else {
        setScraperStatus('stopped'); // Default to stopped
        setError(`Invalid status received: "${status}"`);
      }
    } catch (err) {
      console.error('Error fetching scraper status:', err);
      setError('Failed to fetch scraper status');
      setScraperStatus('stopped'); // Default to stopped on error
    }
  }, []); // Remove dependencies to prevent recreation

  // Memoized function to handle scraper actions - won't recreate on every render
  const handleScraperAction = useCallback(async (action) => {
    if (isLoading) return; // Prevent multiple simultaneous calls
    
    setIsLoading(true);
    setError(null);
    
    try {
      let response;
      
      switch (action) {
        case 'start':
          response = await queueAPI.startScraper();
          break;
        case 'stop':
          response = await queueAPI.stopScraper();
          break;
        case 'pause':
          response = await queueAPI.pauseScraper();
          break;
        case 'resume':
          response = await queueAPI.resumeScraper();
          break;
        default:
          throw new Error('Invalid action');
      }
      
      if (response.data.success) {
        setLastAction({
          action,
          timestamp: new Date().toISOString(),
          message: response.data.message
        });
        
        // Fetch updated status after successful action
        await fetchScraperStatus();
      } else {
        setError(response.data.message || `Failed to ${action} scraper`);
      }
    } catch (err) {
      console.error(`Error ${action}ing scraper:`, err);
      setError(err.response?.data?.message || `Failed to ${action} scraper`);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, fetchScraperStatus]);

  // Fetch initial status on component mount - only once
  useEffect(() => {
    fetchScraperStatus();
  }, []); // Empty dependency array - only run once

  // Auto-refresh removed - users can manually refresh when needed

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-gray-900">Scraper Controls</h3>
        </div>
        
        {lastAction && (
          <div className="text-sm text-gray-500">
            Last action: {lastAction.action} at {new Date(lastAction.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          variant="success"
          size="md"
          onClick={() => handleScraperAction('start')}
          disabled={scraperStatus === 'running' || isLoading}
          loading={isLoading && lastAction?.action === 'start'}
          className="w-full"
        >
          Start
        </Button>

        <Button
          variant="warning"
          size="md"
          onClick={() => handleScraperAction('pause')}
          disabled={scraperStatus !== 'running' || isLoading}
          loading={isLoading && lastAction?.action === 'pause'}
          className="w-full"
        >
          Pause
        </Button>

        <Button
          variant="primary"
          size="md"
          onClick={() => handleScraperAction('resume')}
          disabled={scraperStatus !== 'paused' || isLoading}
          loading={isLoading && lastAction?.action === 'resume'}
          className="w-full"
        >
          Resume
        </Button>

        <Button
          variant="error"
          size="md"
          onClick={() => handleScraperAction('stop')}
          disabled={scraperStatus === 'stopped' || isLoading}
          loading={isLoading && lastAction?.action === 'stop'}
          className="w-full"
        >
          Stop
        </Button>
      </div>
    </div>
  );
};

export default ScraperControls;
