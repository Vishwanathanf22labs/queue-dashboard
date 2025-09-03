import { useState, useRef, useEffect, forwardRef } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import Button from './Button';

const Input = forwardRef(({
  value = '',
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  placeholder = '',
  type = 'text',
  name,
  id,
  label,
  description,
  required = false,
  size = 'md',
  variant = 'default',
  className = '',
  disabled = false,
  readOnly = false,
  autoComplete,
  autoFocus = false,
  maxLength,
  minLength,
  leftIcon = null,
  rightIcon = null,
  loading = false,
  error = null,
  success = null,
  showPasswordToggle = false,
  containerClassName = '',
  fullWidth = true,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby,
  pattern,
  min,
  max,
  step,
  onInput,
  onKeyUp,
  onKeyPress,
}, ref) => {
  const [state, setState] = useState({
    internalValue: value,
    isFocused: false,
    showPassword: false
  });

  const { internalValue, isFocused, showPassword } = state;
  const inputRef = useRef(null);

  const finalRef = ref || inputRef;

  useEffect(() => {
    setState(prev => ({ ...prev, internalValue: value }));
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setState(prev => ({ ...prev, internalValue: newValue }));
    if (onChange) onChange(newValue);
    if (onInput) onInput(e);
  };

  const handleFocus = (e) => {
    setState(prev => ({ ...prev, isFocused: true }));
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    setState(prev => ({ ...prev, isFocused: false }));
    if (onBlur) onBlur(e);
  };

  const togglePasswordVisibility = () => {
    setState(prev => ({ ...prev, showPassword: !prev.showPassword }));
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-xs';
      case 'lg':
        return 'px-4 py-3 text-base';
      default:
        return 'px-3 py-2 text-sm';
    }
  };

  const getVariantClasses = () => {
    const baseClasses = 'border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-opacity-50';

    switch (variant) {
      case 'outline':
        return `${baseClasses} border-gray-300 bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-blue-500`;
      case 'filled':
        return `${baseClasses} border-transparent bg-gray-100 hover:bg-gray-200 focus:bg-white focus:border-blue-500 focus:ring-blue-500`;
      case 'success':
        return `${baseClasses} border-green-300 bg-green-50 focus:border-green-500 focus:ring-green-500`;
      case 'error':
        return `${baseClasses} border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500`;
      default:
        return `${baseClasses} border-gray-300 bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-blue-500`;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'h-3 w-3';
      case 'lg':
        return 'h-5 w-5';
      default:
        return 'h-4 w-4';
    }
  };

  const getLeftPadding = () => {
    if (leftIcon) return 'pl-10';
    return '';
  };

  const getRightPadding = () => {
    if (rightIcon || showPasswordToggle) return 'pr-10';
    return '';
  };

  const getInputType = () => {
    if (type === 'password' && showPasswordToggle) {
      return showPassword ? 'text' : 'password';
    }
    return type;
  };

  const getStatusIcon = () => {
    if (loading) {
      return (
        <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 ${getIconSize()}`} />
      );
    }

    if (error) {
      return <AlertCircle className={`${getIconSize()} text-red-500`} />;
    }

    if (success) {
      return <CheckCircle className={`${getIconSize()} text-green-500`} />;
    }

    if (showPasswordToggle && type === 'password') {
      return (
        <Button
          type="button"
          onClick={togglePasswordVisibility}
          variant="ghost"
          size="sm"
          className={`text-gray-400 hover:text-gray-600 transition-colors p-0 h-auto w-auto`}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className={getIconSize()} /> : <Eye className={getIconSize()} />}
        </Button>
      );
    }

    if (rightIcon) {
      return <div className="text-gray-400">{rightIcon}</div>;
    }

    return null;
  };

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${containerClassName}`}>

      {label && (
        <label
          htmlFor={id || name}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {description && (
        <p className="text-xs text-gray-500 mb-2">{description}</p>
      )}


      <div className="relative">

        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
            {leftIcon}
          </div>
        )}

        <input
          ref={finalRef}
          id={id || name}
          name={name}
          type={getInputType()}
          value={internalValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onKeyPress={onKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          min={min}
          max={max}
          step={step}
          aria-label={ariaLabel || label || placeholder}
          aria-describedby={ariaDescribedby}
          aria-invalid={error ? 'true' : 'false'}
          aria-required={required}
          className={`
            w-full rounded-lg transition-all duration-200
            ${getSizeClasses()}
            ${getVariantClasses()}
            ${getLeftPadding()}
            ${getRightPadding()}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}
            ${readOnly ? 'bg-gray-50 cursor-default' : ''}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
            ${success ? 'border-green-500 focus:border-green-500 focus:ring-green-500' : ''}
            ${isFocused && !error && !success ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
            ${className}
          `}
        />

        {(rightIcon || showPasswordToggle || loading || error || success) && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {getStatusIcon()}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-1 text-xs text-red-500 flex items-center">
          <AlertCircle className={`${getIconSize()} mr-1 flex-shrink-0`} />
          <span className="truncate">{error}</span>
        </div>
      )}


      {success && (
        <div className="mt-1 text-xs text-green-500 flex items-center">
          <CheckCircle className={`${getIconSize()} mr-1 flex-shrink-0`} />
          <span className="truncate">{success}</span>
        </div>
      )}

      {maxLength && (
        <div className="mt-1 text-xs text-gray-400 text-right">
          {internalValue.length}/{maxLength}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;