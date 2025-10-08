import React, { useState, useEffect } from 'react';
import { queueAPI } from '../../services/api';
import StartScraperButton from '../scraper/StartScraperButton';
import StopScraperButton from '../scraper/StopScraperButton';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorDisplay from '../ui/ErrorDisplay';

const ScraperControls = ({ disabled = false }) => {
  const [scraperStatus, setScraperStatus] = useState('unknown');
  const [startTime, setStartTime] = useState(null);
  const [stopTime, setStopTime] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [brandTiming, setBrandTiming] = useState(null);
  const [brandTimingError, setBrandTimingError] = useState(null);
  const [brandTimingLoading, setBrandTimingLoading] = useState(false);

  const fetchScraperStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await queueAPI.getScraperStatus();
      setScraperStatus(response.data?.status || 'unknown');
      setStartTime(response.data?.startTime || null);
      setStopTime(response.data?.stopTime || null);
    } catch (err) {
      console.error('Failed to fetch scraper status:', err);
      setError('Failed to fetch scraper status');
      setScraperStatus('unknown');
      setStartTime(null);
      setStopTime(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScraperStatus();
  }, []);

  const fetchBrandTiming = async () => {
    try {
      setBrandTimingLoading(true);
      setBrandTimingError(null);
      const res = await queueAPI.getBrandTiming();
      setBrandTiming(res.data?.data || {});
    } catch (e) {
      setBrandTimingError('Failed to fetch brand timing');
      setBrandTiming(null);
    } finally {
      setBrandTimingLoading(false);
    }
  };

  useEffect(() => {
    fetchBrandTiming();
  }, []);

  const handleScraperStart = (result) => {
    // Refresh status after starting
    fetchScraperStatus();
  };

  const handleScraperStop = (result) => {
    // Refresh status after stopping
    fetchScraperStatus();
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Invalid Date';
    }
  };

  const getStatusInfo = (status) => {
    // Handle specific stopped reasons
    if (status && status.startsWith('stopped(')) {
      const reason = status.replace('stopped(', '').replace(')', '');
      let description = 'The scraper is stopped';
      
      // Map specific reasons to descriptions
      switch (reason) {
        case 'cooldown NWL':
          description = 'Stopped due to cooldown period for Non-Watchlist brands';
          break;
        case 'cooldown WL':
          description = 'Stopped due to cooldown period for Watchlist brands';
          break;
        case 'Hold':
          description = 'Stopped and held by user';
          break;
        default:
          description = `Stopped: ${reason}`;
      }
      
      return {
        text: status, // Show the full status including reason
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        description: description
      };
    }
    
    switch (status) {
      case 'running':
        return {
          text: 'Running',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          description: 'The scraper is currently processing brands'
        };
      case 'stopped':
      case 'not_running':
        return {
          text: 'Stopped',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          description: 'The scraper is not currently running'
        };
      default:
        return {
          text: status || 'Unknown',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          description: 'Unable to determine scraper status'
        };
    }
  };

  const statusInfo = getStatusInfo(scraperStatus);
  const isRunning = scraperStatus === 'running';

  function parseTimingValue(raw) {
    if (!raw) return null;
    try {
      if (typeof raw === 'string') {
        return JSON.parse(raw);
      }
      return raw;
    } catch (_) {
      return { date: raw };
    }
  }

  function formatTimingDate(raw) {
    const obj = parseTimingValue(raw);
    const ts = obj?.date;
    if (!ts) return 'Not set';
    return formatTimestamp(ts);
  }

  function renderTimingMeta(raw) {
    const obj = parseTimingValue(raw);
    if (!obj || obj.brandCount == null) return null;
    return <span className="ml-2 text-sm font-medium text-blue-600">({obj.brandCount} brands)</span>;
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={fetchScraperStatus} />;
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
              {statusInfo.text}
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Scraper Status</h3>
              <p className="text-sm text-gray-600">{statusInfo.description}</p>
            </div>
          </div>
          <button
            onClick={fetchScraperStatus}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh status"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        
        {/* Timestamps */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Last Started</h4>
              <p className="text-sm text-gray-600 font-mono">
                {formatTimestamp(startTime)}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Last Stopped</h4>
              <p className="text-sm text-gray-600 font-mono">
                {formatTimestamp(stopTime)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Timing Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Brand Timing</h3>
          <button
            onClick={fetchBrandTiming}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh timing"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {brandTimingLoading ? (
          <LoadingSpinner />
        ) : brandTimingError ? (
          <ErrorDisplay message={brandTimingError} onRetry={fetchBrandTiming} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Watchlist */}
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Watchlist</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Loaded:</span>{' '}
                  <span className="font-mono text-gray-800">
                    {formatTimingDate(brandTiming?.watchlist_loaded)}
                  </span>
                  {renderTimingMeta(brandTiming?.watchlist_loaded)}
                </div>
                <div>
                  <span className="text-gray-600">Completed:</span>{' '}
                  <span className="font-mono text-gray-800">
                    {formatTimingDate(brandTiming?.watchlist_dequeue)}
                  </span>
                  {renderTimingMeta(brandTiming?.watchlist_dequeue)}
                </div>
              </div>
            </div>

            {/* Non‑watchlist */}
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Non‑watchlist</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Loaded:</span>{' '}
                  <span className="font-mono text-gray-800">
                    {formatTimingDate(brandTiming?.regular_loaded)}
                  </span>
                  {renderTimingMeta(brandTiming?.regular_loaded)}
                </div>
                <div>
                  <span className="text-gray-600">Completed:</span>{' '}
                  <span className="font-mono text-gray-800">
                    {formatTimingDate(brandTiming?.regular_dequeue)}
                  </span>
                  {renderTimingMeta(brandTiming?.regular_dequeue)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Scraper Controls</h3>
        <div className="flex items-center space-x-4">
          <StartScraperButton
            onScraperStart={handleScraperStart}
            isDisabled={disabled || isRunning}
            size="lg"
          />
          <StopScraperButton
            onScraperStop={handleScraperStop}
            isDisabled={disabled || !isRunning}
            size="lg"
          />
        </div>
        <div className="mt-4 text-sm text-gray-600">
          {isRunning ? (
            <p>Click "Stop Scraper" to halt the current scraping process.</p>
          ) : (
            <p>Click "Start Scraper" to begin processing brands in the queue.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScraperControls;
