import { useState, useEffect, useRef } from 'react';
import Card from '../ui/Card';
import { Clock, AlertTriangle, Play, Eye, List, XCircle } from 'lucide-react';

const DashboardStats = ({ 
  pendingCount, 
  failedCount, 
  activeCount, 
  brandsScrapedToday,
  watchlistPendingCount = 0,
  watchlistFailedCount = 0,
  watchlistCompletedCount = 0,
  adsProcessed = 0
}) => {
  const [timerState, setTimerState] = useState({
    isRunning: false,
    timeLeft: 0,
    showTimer: false
  });
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const isLoadedFromStorage = useRef(false);

  // Timer duration: 30 minutes in seconds
  const TIMER_DURATION = 30 * 60; // 30 minutes

  // Load timer state from localStorage on component mount
  useEffect(() => {
    const savedTimerState = localStorage.getItem('watchlistTimerState');
    if (savedTimerState) {
      const parsedState = JSON.parse(savedTimerState);
      const now = Date.now();
      const elapsed = Math.floor((now - parsedState.startTime) / 1000);
      const remainingTime = Math.max(0, parsedState.timeLeft - elapsed);
      
      console.log('Timer restoration debug:', {
        savedTimeLeft: parsedState.timeLeft,
        startTime: parsedState.startTime,
        now: now,
        elapsed: elapsed,
        remainingTime: remainingTime
      });
      
      if (remainingTime > 0 && parsedState.isRunning) {
        setTimerState({
          isRunning: true,
          timeLeft: remainingTime,
          showTimer: true
        });
        startTimeRef.current = parsedState.startTime;
        isLoadedFromStorage.current = true;
      } else {
        // Timer expired, clear localStorage
        localStorage.removeItem('watchlistTimerState');
      }
    }
  }, []);

  // Start timer when watchlist completed count becomes 0
  useEffect(() => {
    // Don't start timer if we just loaded from storage
    if (isLoadedFromStorage.current) {
      isLoadedFromStorage.current = false;
      return;
    }

    if (watchlistCompletedCount === 0 && !timerState.isRunning && !timerState.showTimer) {
      const startTime = Date.now();
      const newState = {
        isRunning: true,
        timeLeft: TIMER_DURATION,
        showTimer: true
      };
      setTimerState(newState);
      startTimeRef.current = startTime;
      
      // Save to localStorage
      localStorage.setItem('watchlistTimerState', JSON.stringify({
        ...newState,
        startTime: startTime
      }));
    } else if (watchlistCompletedCount > 0) {
      // Reset timer if count becomes greater than 0
      setTimerState({
        isRunning: false,
        timeLeft: 0,
        showTimer: false
      });
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Clear localStorage
      localStorage.removeItem('watchlistTimerState');
    }
  }, [watchlistCompletedCount, timerState.isRunning, timerState.showTimer]);

  // Timer countdown effect
  useEffect(() => {
    if (timerState.isRunning && timerState.timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimerState(prev => {
          const newTimeLeft = prev.timeLeft - 1;
          if (newTimeLeft <= 0) {
            // Timer finished, hide the timer and clear localStorage
            localStorage.removeItem('watchlistTimerState');
            return {
              isRunning: false,
              timeLeft: 0,
              showTimer: false
            };
          }
          
          return {
            ...prev,
            timeLeft: newTimeLeft
          };
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timerState.isRunning, timerState.timeLeft]);

  // Update localStorage periodically (every 10 seconds) instead of every second
  useEffect(() => {
    if (timerState.isRunning && timerState.timeLeft > 0) {
      const updateInterval = setInterval(() => {
        localStorage.setItem('watchlistTimerState', JSON.stringify({
          ...timerState,
          startTime: startTimeRef.current
        }));
      }, 10000); // Update every 10 seconds

      return () => clearInterval(updateInterval);
    }
  }, [timerState.isRunning, timerState.timeLeft, timerState.showTimer]);

  // Format time for display
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      {/* Main Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-yellow-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">Pending Queue</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-red-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">Failed Queue</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-red-600">{failedCount}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
              <Play className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-green-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">Active Brands</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-green-600">{activeCount}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
              <Eye className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-blue-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">Brands Scraped</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-blue-600">{brandsScrapedToday}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Watchlist and Processing Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
              <List className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-purple-600" />
            </div>
             <div className="ml-2 sm:ml-3 lg:ml-4 flex-1 min-w-0">
               <p className="text-xs sm:text-sm font-medium text-gray-600 break-words">Watchlist Pending</p>
               <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600">{watchlistPendingCount}</p>
             </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-orange-100 rounded-lg">
              <XCircle className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-orange-600" />
            </div>
             <div className="ml-2 sm:ml-3 lg:ml-4 flex-1 min-w-0">
               <p className="text-xs sm:text-sm font-medium text-gray-600 break-words">Watchlist Failed</p>
               <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600">{watchlistFailedCount}</p>
             </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
              <Eye className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-green-600" />
            </div>
            <div className="ml-2 sm:ml-3 lg:ml-4 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 break-words">Watchlist Completed</p>
              {timerState.showTimer ? (
                <div className="space-y-1">
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">{watchlistCompletedCount}</p>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-3 w-3 text-orange-500" />
                    <p className="text-xs text-orange-600 font-medium">
                      Wait for next load: {formatTime(timerState.timeLeft)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">{watchlistCompletedCount}</p>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-indigo-100 rounded-lg">
              <Eye className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-indigo-600" />
            </div>
             <div className="ml-2 sm:ml-3 lg:ml-4 flex-1 min-w-0">
               <p className="text-xs sm:text-sm font-medium text-gray-600 break-words">Ads Processed</p>
               <p className="text-lg sm:text-xl lg:text-2xl font-bold text-indigo-600">{adsProcessed}</p>
             </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardStats;
