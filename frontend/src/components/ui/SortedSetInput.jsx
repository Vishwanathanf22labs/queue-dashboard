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

  useEffect(() => {
    setState(prev => ({ ...prev, inputValue: score || '' }));
  }, [score]);

  const handleInputChange = (value) => {
    setState(prev => ({ ...prev, inputValue: value, error: '' }));

    if (value === '') {
      onScoreChange(null);
      return;
    }

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

    onScoreChange(numValue);
  };

  const handleBlur = () => {
    if (state.inputValue === '') {
      onScoreChange(0);
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
