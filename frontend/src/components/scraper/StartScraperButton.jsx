import React, { useState } from 'react';
import { queueAPI } from '../../services/api';
import toast from 'react-hot-toast';
import Button from '../ui/Button';

const StartScraperButton = ({ 
  onScraperStart, 
  isDisabled = false, 
  className = "",
  size = "md"
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleStartScraper = async () => {
    try {
      setIsLoading(true);
      const response = await queueAPI.startScraper();
      
      if (response.data.success) {
        const startTime = response.data.startTime;
        const formattedTime = startTime ? new Date(startTime).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }) : 'Unknown';
        
        toast.success(`Scraper started successfully at ${formattedTime}`);
        if (onScraperStart) {
          onScraperStart(response.data);
        }
      } else {
        toast.error(response.data.message || 'Failed to start scraper');
      }
    } catch (error) {
      console.error('Error starting scraper:', error);
      const errorMessage = error.response?.data?.message || 'Failed to start scraper';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleStartScraper}
      disabled={isDisabled || isLoading}
      loading={isLoading}
      variant="primary"
      size={size}
      className={`${className} ${isLoading ? 'opacity-75' : ''}`}
    >
      {isLoading ? 'Starting...' : 'Start Scraper'}
    </Button>
  );
};

export default StartScraperButton;
