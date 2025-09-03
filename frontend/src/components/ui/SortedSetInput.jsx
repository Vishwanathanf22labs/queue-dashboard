import { useState, useEffect } from 'react';
import Input from './Input';

const SortedSetInput = ({ 
  score, 
  onScoreChange, 
  disabled = false, 
  className = "",
  placeholder = "Enter score (e.g., 1 for priority, 0 for normal)"
}) => {
  const [state, setState] = useState({
    inputValue: score || '',
    error: ''
  });

  // Update input value when score prop changes (for auto-reset)
  useEffect(() => {
    setState(prev => ({ ...prev, inputValue: score || '' }));
  }, [score]);

  const handleInputChange = (value) => {
    setState(prev => ({ ...prev, inputValue: value, error: '' }));

    // Validate input
    if (value === '') {
      onScoreChange(null);
      return;
    }

    // Allow only numbers and decimal points
    if (!/^\d*\.?\d*$/.test(value)) {
      setState(prev => ({ ...prev, error: 'Please enter a valid number' }));
      onScoreChange(null);
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setState(prev => ({ ...prev, error: 'Please enter a valid number' }));
      onScoreChange(null);
      return;
    }

    // Score can be any number (positive, negative, or zero)
    onScoreChange(numValue);
  };

  const handleBlur = () => {
    if (state.inputValue === '') {
      onScoreChange(0); // Default to 0 if empty
      setState(prev => ({ ...prev, inputValue: '0' }));
    }
  };

  const getScoreDescription = (score) => {
    if (score === null || score === undefined) return '';
    if (score === 1) return 'Priority (scraped first)';
    if (score === 0) return 'Normal (scraped after priority)';
    if (score > 1) return `High priority (score: ${score})`;
    if (score < 0) return `Low priority (score: ${score})`;
    return `Custom score: ${score}`;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Input
        label="Queue Score"
        required={true}
        value={state.inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        error={state.error}
        size="md"
        variant="outline"
        className="w-full"
        rightIcon={
          state.inputValue && !state.error ? (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {getScoreDescription(parseFloat(state.inputValue))}
            </span>
          ) : null
        }
      />
    </div>
  );
};

export default SortedSetInput;
