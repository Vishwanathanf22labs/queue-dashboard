import Spinner from './Spinner';

const LoadingState = ({ 
  size = 'lg', 
  className = '', 
  message = 'Loading...',
  variant = 'default' // 'default', 'page', 'inline'
}) => {
  if (variant === 'page') {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
        <div className="text-center">
          <Spinner size={size} />
          {message && (
            <p className="mt-4 text-lg font-medium text-gray-900">{message}</p>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center justify-center py-2 ${className}`}>
        <Spinner size="sm" />
        {message && (
          <span className="ml-2 text-sm text-gray-500">{message}</span>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={`flex flex-col justify-center items-center py-8 ${className}`}>
      <Spinner size={size} />
      {message && (
        <span className="text-sm text-gray-500 mt-2">{message}</span>
      )}
    </div>
  );
};

export default LoadingState;

