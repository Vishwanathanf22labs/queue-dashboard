import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

const CustomDropdown = ({
  label,
  options,
  value,
  onChange,
  placeholder = "Select option",
  className = "",
  disabled = false,
  icon = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionClick = (option) => {
    onChange(option.value);
    setIsOpen(false);
  };

  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex items-center px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 focus:outline-none transition-all duration-200 w-full ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
        >
          {icon}
          <span className="text-sm font-medium text-gray-900 flex-1 text-left">
            {displayText}
          </span>
          <ChevronDown className={`h-4 w-4 text-gray-400 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
            }`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleOptionClick(option)}
                className={`w-full px-3 py-2 text-left text-sm first:rounded-t-lg last:rounded-b-lg transition-colors duration-150 ${value === option.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomDropdown;