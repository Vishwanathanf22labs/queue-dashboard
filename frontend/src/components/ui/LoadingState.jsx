import Spinner from './Spinner';

const LoadingState = ({ size = 'lg', className = '', message = 'Loading...' }) => (
  <div className={`flex flex-col justify-center items-center py-8 ${className}`}>
    <Spinner size={size} />
    {message && (
      <span className="text-sm text-gray-500 mt-2">{message}</span>
    )}
  </div>
);

export default LoadingState;

