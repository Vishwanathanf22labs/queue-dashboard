const ErrorDisplay = ({ title, message, className = '', children }) => (
  <div className={`text-center py-8 ${className}`}>
    <h2 className="text-lg sm:text-xl font-semibold text-red-800 mb-2">
      {title}
    </h2>
    {message && <p className="text-gray-600 mb-4">{message}</p>}
    {children}
  </div>
);

export default ErrorDisplay;

