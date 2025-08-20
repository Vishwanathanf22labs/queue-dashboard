const Card = ({ children, className = '', title, subtitle, padding = 'p-6' }) => {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${padding} ${className}`}>
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
