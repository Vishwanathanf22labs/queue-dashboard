import { Clock, Play, Square, Pause } from 'lucide-react';

const CooldownIndicator = ({ 
  scraperStatus,
  scraperStatusData
}) => {
  if (!scraperStatus || scraperStatus === 'unknown') {
    return null;
  }

  const getStatusInfo = (status) => {
    // Handle specific stopped reasons from API
    if (status && status.startsWith('stopped(')) {
      const reason = status.replace('stopped(', '').replace(')', '');
      let label = '';
      let bgColor = '';
      let textColor = '';
      let icon = Square;
      
      switch (reason) {
        case 'cooldown NWL':
          label = 'Cooldown NWL';
          bgColor = 'bg-yellow-100';
          textColor = 'text-yellow-800';
          icon = Clock;
          break;
        case 'cooldown WL':
          label = 'Cooldown WL';
          bgColor = 'bg-blue-100';
          textColor = 'text-blue-800';
          icon = Clock;
          break;
        case 'Hold':
          label = 'Hold';
          bgColor = 'bg-red-100';
          textColor = 'text-red-800';
          icon = Square;
          break;
        default:
          label = status;
          bgColor = 'bg-gray-100';
          textColor = 'text-gray-800';
          icon = Square;
      }
      
      return { label, bgColor, textColor, icon };
    }
    
    switch (status) {
      case 'running':
        return { 
          label: 'Running', 
          bgColor: 'bg-green-100', 
          textColor: 'text-green-800', 
          icon: Play 
        };
      case 'paused':
        return { 
          label: 'Paused', 
          bgColor: 'bg-yellow-100', 
          textColor: 'text-yellow-800', 
          icon: Pause 
        };
      case 'stopped':
        return { 
          label: 'Stopped', 
          bgColor: 'bg-red-100', 
          textColor: 'text-red-800', 
          icon: Square 
        };
      default:
        return { 
          label: status, 
          bgColor: 'bg-gray-100', 
          textColor: 'text-gray-800', 
          icon: Clock 
        };
    }
  };

  const statusInfo = getStatusInfo(scraperStatus);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="flex items-center space-x-2">
      <StatusIcon className="h-4 w-4 text-gray-600" />
      <span className="text-sm font-medium text-gray-700">Status:</span>
      <div className={`flex items-center space-x-1 px-2 py-1 ${statusInfo.bgColor} ${statusInfo.textColor} rounded-full`}>
        <StatusIcon className="h-3 w-3" />
        <span className="text-xs font-medium">
          {statusInfo.label}
          {scraperStatusData?.stopTime && scraperStatus !== 'running' && (
            <span className="ml-1 opacity-75">
              {new Date(scraperStatusData.stopTime).toLocaleTimeString()}
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

export default CooldownIndicator;
