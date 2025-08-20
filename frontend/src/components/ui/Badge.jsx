import { sizeClasses } from '../../constants/data';
import { getVariantClasses, } from '../../utils/colors';

const Badge = ({ children, variant = 'gray', size = 'sm', className = '' }) => {
  const variantClasses = getVariantClasses(variant);

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${sizeClasses[size]} ${variantClasses} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
