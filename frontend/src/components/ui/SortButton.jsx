import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const SortButton = ({ 
  label, 
  sortBy, 
  currentSortBy, 
  currentSortOrder, 
  onSortChange,
  className = ""
}) => {
  const isActive = currentSortBy === sortBy;
  
  const handleClick = () => {
    if (sortBy === 'normal') {
      onSortChange('normal', 'desc');
    } else if (isActive) {
      // Toggle between asc and desc
      const newOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
      onSortChange(sortBy, newOrder);
    } else {
      // Set new sort field with desc as default
      onSortChange(sortBy, 'desc');
    }
  };

  const getIcon = () => {
    if (sortBy === 'normal') {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    
    if (!isActive) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    
    return currentSortOrder === 'desc' ? 
      <ArrowDown className="h-4 w-4 text-blue-600" /> : 
      <ArrowUp className="h-4 w-4 text-blue-600" />;
  };

  const getButtonClass = () => {
    const baseClass = "inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500";
    
    if (isActive) {
      return `${baseClass} border-blue-600 text-blue-600 bg-blue-50 hover:bg-blue-100`;
    }
    
    return `${baseClass} border-gray-300 text-gray-700 bg-white hover:bg-gray-50`;
  };

  return (
    <button
      onClick={handleClick}
      className={`${getButtonClass()} ${className}`}
      title={`Sort by ${label}`}
    >
      {getIcon()}
      <span className="ml-2">{label}</span>
    </button>
  );
};

export default SortButton;
