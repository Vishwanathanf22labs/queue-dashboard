import React from 'react';

const Toggle = ({ 
  isOn, 
  onToggle, 
  disabled = false, 
  size = 'md',
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-4',
    md: 'w-12 h-6',
    lg: 'w-16 h-8'
  };

  const thumbSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-7 h-7'
  };

  const thumbPositionClasses = {
    sm: isOn ? 'translate-x-4' : 'translate-x-0.5',
    md: isOn ? 'translate-x-6' : 'translate-x-0.5',
    lg: isOn ? 'translate-x-8' : 'translate-x-0.5'
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`
        relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out
        ${sizeClasses[size]}
        ${isOn ? 'bg-red-500' : 'bg-blue-600'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      <span
        className={`
          inline-block rounded-full bg-white shadow-lg transform transition-transform duration-200 ease-in-out
          ${thumbSizeClasses[size]}
          ${thumbPositionClasses[size]}
        `}
      />
    </button>
  );
};

export default Toggle;
