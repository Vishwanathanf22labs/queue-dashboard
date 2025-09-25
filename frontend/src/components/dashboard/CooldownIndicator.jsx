import { Clock, Users, Eye } from 'lucide-react';

const CooldownIndicator = ({ 
  regularCooldown = false, 
  watchlistCooldown = false 
}) => {
  if (!regularCooldown && !watchlistCooldown) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      <Clock className="h-4 w-4 text-blue-600" />
      <span className="text-sm font-medium text-gray-700">Cooldown:</span>
      <div className="flex items-center space-x-2">
        {regularCooldown && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
            <Users className="h-3 w-3" />
            <span className="text-xs font-medium">Regular</span>
          </div>
        )}
        {watchlistCooldown && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 rounded-full">
            <Eye className="h-3 w-3" />
            <span className="text-xs font-medium">Watchlist</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CooldownIndicator;
