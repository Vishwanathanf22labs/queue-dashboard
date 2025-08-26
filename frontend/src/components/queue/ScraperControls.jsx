import { useState, useEffect, useCallback, useRef } from 'react';
import Button from '../ui/Button';
import { queueAPI } from '../../services/api';

const ScraperControls = ({ onStatusChange, onStatusDataChange, className = '' }) => {
  const [state, setState] = useState({
    scraperStatus: 'unknown',
    isLoading: false,
    lastAction: null,
    error: null,
    statusData: null
  });

  // Use refs to store the latest callback functions
  const onStatusChangeRef = useRef(onStatusChange);
  const onStatusDataChangeRef = useRef(onStatusDataChange);

  // Update refs when props change
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onStatusDataChangeRef.current = onStatusDataChange;
  }, [onStatusChange, onStatusDataChange]);

  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const fetchScraperStatus = useCallback(async () => {
    try {
      const response = await queueAPI.getScraperStatus();
      if (!response.data) {
        updateState({
          error: 'Invalid response structure from server',
          scraperStatus: 'stopped'
        });
        return;
      }

      if (!response.data.data) {
        updateState({
          error: 'Invalid response structure from server - missing data wrapper',
          scraperStatus: 'stopped'
        });
        return;
      }

      const status = response.data.data.status;

      if (status && ['running', 'paused', 'stopped'].includes(status)) {
        updateState({
          scraperStatus: status,
          statusData: response.data.data,
          error: null
        });

        // Use refs to avoid dependency issues
        if (onStatusChangeRef.current) {
          onStatusChangeRef.current(status);
        }

        if (onStatusDataChangeRef.current) {
          onStatusDataChangeRef.current(response.data.data);
        }
      } else {
        updateState({
          scraperStatus: 'stopped',
          error: `Invalid status received: "${status}"`
        });
      }
    } catch (err) {
      console.error('Error fetching scraper status:', err);
      updateState({
        error: 'Failed to fetch scraper status',
        scraperStatus: 'stopped'
      });
    }
  }, [updateState]); // Only updateState as dependency

  const handleScraperAction = useCallback(async (action) => {
    if (state.isLoading) return;

    updateState({
      isLoading: true,
      error: null
    });

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
        updateState({
          lastAction: {
            action,
            timestamp: new Date().toISOString(),
            message: response.data.message
          }
        });

        // Fetch status after successful action
        await fetchScraperStatus();
      } else {
        updateState({
          error: response.data.message || `Failed to ${action} scraper`
        });
      }
    } catch (err) {
      console.error(`Error ${action}ing scraper:`, err);
      updateState({
        error: err.response?.data?.message || `Failed to ${action} scraper`
      });
    } finally {
      updateState({ isLoading: false });
    }
  }, [state.isLoading, fetchScraperStatus, updateState]);

  // Fetch status only once on mount
  useEffect(() => {
    fetchScraperStatus();
  }, []); // Empty dependency array - only run on mount

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-gray-900">Scraper Controls</h3>
        </div>

        {state.lastAction && (
          <div className="text-sm text-gray-500">
            Last action: {state.lastAction.action} at {new Date(state.lastAction.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>

      {state.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{state.error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          variant="success"
          size="md"
          onClick={() => handleScraperAction('start')}
          disabled={state.scraperStatus === 'running' || state.isLoading}
          loading={state.isLoading && state.lastAction?.action === 'start'}
          className="w-full"
        >
          Start
        </Button>

        <Button
          variant="warning"
          size="md"
          onClick={() => handleScraperAction('pause')}
          disabled={state.scraperStatus !== 'running' || state.isLoading}
          loading={state.isLoading && state.lastAction?.action === 'pause'}
          className="w-full"
        >
          Pause
        </Button>

        <Button
          variant="primary"
          size="md"
          onClick={() => handleScraperAction('resume')}
          disabled={state.scraperStatus !== 'paused' || state.isLoading}
          loading={state.isLoading && state.lastAction?.action === 'resume'}
          className="w-full"
        >
          Resume
        </Button>

        <Button
          variant="error"
          size="md"
          onClick={() => handleScraperAction('stop')}
          disabled={state.scraperStatus === 'stopped' || state.isLoading}
          loading={state.isLoading && state.lastAction?.action === 'stop'}
          className="w-full"
        >
          Stop
        </Button>
      </div>
    </div>
  );
};

export default ScraperControls;