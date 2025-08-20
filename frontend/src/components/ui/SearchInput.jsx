import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';


const SearchInput = ({
  // Core props
  value = '',
  onChange,
  placeholder = 'Search...',
  
  // Styling props
  size = 'md', // 'sm', 'md', 'lg'
  variant = 'default', // 'default', 'outline', 'filled'
  className = '',
  
  // Functionality props
  debounceMs = 300,
  minLength = 0,
  showClearButton = true,
  disabled = false,
  
  // Icon props
  leftIcon = null,
  rightIcon = null,
  
  // Status props
  loading = false,
  error = null,
  
  // Event handlers
  onClear,
  onFocus,
  onBlur,
  onKeyDown,
  
  // Accessibility
  id,
  name,
  'aria-label': ariaLabel,
  
  // Container props
  containerClassName = '',
  showStats = false,
  stats = null,
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Sync internal value with external value
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Handle input change with debouncing
  const handleChange = (e) => {
    const newValue = e.target.value;
    setInternalValue(newValue);

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new timeout for debounced onChange
    if (onChange) {
      debounceRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    }
  };

  // Handle clear button click
  const handleClear = () => {
    setInternalValue('');
    if (onChange) onChange('');
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  // Handle focus
  const handleFocus = (e) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  // Handle blur
  const handleBlur = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-xs';
      case 'lg':
        return 'px-4 py-3 text-base';
      default: // md
        return 'px-3 py-2 text-sm';
    }
  };

  // Get variant classes
  const getVariantClasses = () => {
    switch (variant) {
      case 'outline':
        return 'border border-gray-300 bg-white hover:border-gray-400 focus:border-blue-500';
      case 'filled':
        return 'border border-transparent bg-gray-100 hover:bg-gray-200 focus:bg-white focus:border-blue-500';
      default: // default
        return 'border border-gray-300 bg-white hover:border-gray-400 focus:border-blue-500';
    }
  };

  // Get icon size
  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'h-3 w-3';
      case 'lg':
        return 'h-5 w-5';
      default: // md
        return 'h-4 w-4';
    }
  };

  // Get left padding based on left icon
  const getLeftPadding = () => {
    if (leftIcon) return 'pl-10';
    return '';
  };

  // Get right padding based on right icon and clear button
  const getRightPadding = () => {
    if (rightIcon || (showClearButton && internalValue)) return 'pr-10';
    return '';
  };

  return (
    <div className={`relative ${containerClassName}`}>
 
      <div className="relative">
      
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            {leftIcon}
          </div>
        )}

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          value={internalValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel || placeholder}
          className={`
            w-full rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
            ${getSizeClasses()}
            ${getVariantClasses()}
            ${getLeftPadding()}
            ${getRightPadding()}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
            ${isFocused ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
            ${className}
          `}
        />

        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {loading ? (
            <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 ${getIconSize()}`} />
          ) : rightIcon ? (
            <div className="text-gray-400">{rightIcon}</div>
          ) : showClearButton && internalValue ? (
            <button
              type="button"
              onClick={handleClear}
              className={`text-gray-400 hover:text-gray-600 transition-colors ${getIconSize()}`}
              aria-label="Clear search"
            >
              <X />
            </button>
          ) : null}
        </div>
      </div>

      
      {error && (
        <div className="mt-1 text-xs text-red-500 flex items-center">
          <span className="truncate">{error}</span>
        </div>
      )}


      {showStats && stats && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
          <span>Total: {stats.total}</span>
          <span>Showing: {stats.showing}</span>
        </div>
      )}

   
      {minLength > 0 && internalValue && internalValue.length < minLength && (
        <div className="mt-1 text-xs text-gray-400 flex items-center">
          <Search className={`${getIconSize()} mr-1`} />
          <span>Type at least {minLength} characters to search</span>
        </div>
      )}
    </div>
  );
};

export default SearchInput;
