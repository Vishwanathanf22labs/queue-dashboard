import React, { useState } from 'react';
import { queueAPI } from '../../services/api';
import toast from 'react-hot-toast';
import Button from '../ui/Button';

const StopScraperButton = ({
  onScraperStop,
  isDisabled = false,
  className = "",
  size = "md"
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleStopScraper = async () => {
    try {
      setIsLoading(true);
      const response = await queueAPI.stopScraper();

      if (response.data.success) {
        const stopTime = response.data.stopTime;
        const formattedTime = stopTime ? new Date(stopTime).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }) : 'Unknown';

        toast.success(`Scraper stopped successfully at ${formattedTime}`);
        if (onScraperStop) {
          onScraperStop(response.data);
        }
      } else {
        toast.error(response.data.message || 'Failed to stop scraper');
      }
    } catch (error) {
      console.error('Error stopping scraper:', error);
      const errorMessage = error.response?.data?.message || 'Failed to stop scraper';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleStopScraper}
      disabled={isDisabled || isLoading}
      loading={isLoading}
      variant="danger"
      size={size}
      className={`${className} ${isLoading ? 'opacity-75' : ''}`}
    >
      {isLoading ? 'Stopping...' : 'Stop Scraper'}
    </Button>
  );
};

export default StopScraperButton;
