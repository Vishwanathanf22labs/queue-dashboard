import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import Button from './Button';
import Input from './Input';

const SearchInput = ({
  value = '',
  onChange,
  placeholder = 'Search...',
  size = 'md',
  variant = 'default',
  className = '',
  debounceMs = 300,
  minLength = 0,
  showClearButton = true,
  disabled = false,
  leftIcon = null,
  rightIcon = null,
  loading = false,
  error = null,
  onClear,
  onFocus,
  onBlur,
  onKeyDown,
  id,
  name,
  'aria-label': ariaLabel,
  containerClassName = '',
  showStats = false,
  stats = null,
}) => {
  const [state, setState] = useState({
    internalValue: value,
    isFocused: false
  });
  const { internalValue, isFocused } = state;
  const refs = useRef({
    debounce: null,
    input: null
  });

  useEffect(() => {
    setState(prev => ({ ...prev, internalValue: value }));
  }, [value]);

  const handleChange = (value) => {
    // The Input component passes the value directly, not an event object
    setState(prev => ({ ...prev, internalValue: value }));

    if (refs.current.debounce) {
      clearTimeout(refs.current.debounce);
    }

    if (onChange) {
      refs.current.debounce = setTimeout(() => {
        onChange(value);
      }, debounceMs);
    }
  };

  const handleClear = () => {
    setState(prev => ({ ...prev, internalValue: '' }));
    if (onChange) onChange('');
    if (onClear) onClear();
    refs.current.input?.focus();
  };

  const handleFocus = (e) => {
    setState(prev => ({ ...prev, isFocused: true }));
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    setState(prev => ({ ...prev, isFocused: false }));
    if (onBlur) onBlur(e);
  };



  return (
    <div className={`relative ${containerClassName}`}>

      <div className="relative">

        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            {leftIcon}
          </div>
        )}

        <Input
          ref={(el) => { refs.current.input = el; }}
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
          size={size}
          variant={variant}
          className={className}
          leftIcon={leftIcon}
          error={error}
        />

        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {loading ? (
            <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 ${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />
          ) : rightIcon ? (
            <div className="text-gray-400">{rightIcon}</div>
          ) : showClearButton && internalValue ? (
            <Button
              type="button"
              onClick={handleClear}
              variant="ghost"
              size="sm"
              className={`text-gray-400 hover:text-gray-600 transition-colors p-0 h-auto w-auto`}
              aria-label="Clear search"
            >
              <X className={size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />
            </Button>
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
          <Search className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} mr-1`} />
          <span>Type at least {minLength} characters to search</span>
        </div>
      )}
    </div>
  );
};

export default SearchInput;