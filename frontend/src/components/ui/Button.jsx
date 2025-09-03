import { sizeClasses } from '../../constants/data';
import { colors } from '../../utils/colors';
import Spinner from './Spinner';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  className = '',
  ...props
}) => {

  const getVariantClasses = () => {
    if (disabled) return colors.primary.disabled;

    switch (variant) {
      case 'custom':
        return '';
      case 'tab':
        return 'bg-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent';
      case 'tab-active':
        return 'bg-transparent text-blue-600 border-b-2 border-blue-500';
      case 'remove':
        return 'bg-transparent text-red-600 hover:text-red-800 hover:bg-red-50 border border-transparent';
      case 'retry':
        return 'bg-red-600 text-white hover:bg-red-700 border border-red-600';
      case 'ghost':
        return 'bg-transparent text-gray-900 hover:bg-gray-50 border border-transparent';
      case 'mobile-menu':
        return 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200 shadow-lg';
      case 'pagination':
        return 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-50 hover:text-gray-700';
      case 'pagination-active':
        return 'bg-blue-600 text-white border border-blue-600';
      case 'pagination-disabled':
        return 'bg-white text-gray-500 border border-gray-300 opacity-50 cursor-not-allowed';
      case 'success':
        return 'bg-green-600 text-white hover:bg-green-700 border border-green-600';
      case 'warning':
        return 'bg-yellow-600 text-white hover:bg-yellow-700 border border-yellow-600';
      case 'error':
        return 'bg-red-600 text-white hover:bg-red-700 border border-red-600';
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700 border border-red-600';
      case 'info':
        return 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600';
      case 'outline':
        return 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-700';
      default:
        return `${colors[variant]?.default || colors.primary.default} ${colors[variant]?.hover || colors.primary.hover}`;
    }
  };

  const variantClasses = getVariantClasses();

  if (variant === 'custom' && size === 'custom') {
    return (
      <button
        type={type}
        disabled={disabled || loading}
        onClick={onClick}
        className={className}
        {...props}
      >
        {loading && (
          <Spinner />
        )}
        {children}
      </button>
    );
  }

  const focusClasses = `focus:ring-${variant === 'primary' ? 'blue' : variant === 'outline' ? 'gray' : 'blue'}-500`;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`inline-flex items-center justify-center font-medium rounded-lg border transition-colors duration-200 focus:outline-none focus:ring-1 ${sizeClasses[size]} ${variantClasses} ${focusClasses} ${className}`}
      {...props}
    >
      {loading && (
        <Spinner />
      )}
      {children}
    </button>
  );
};

export default Button;