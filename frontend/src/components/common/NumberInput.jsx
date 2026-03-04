import { forwardRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import clsx from 'clsx';
import Button from './Button';

const NumberInput = forwardRef(function NumberInput(
  {
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    disabled = false,
    error,
    className,
    showControls = true,
    formatDisplay,
  },
  ref
) {
  const handleIncrement = () => {
    const newValue = value + step;
    if (max === undefined || newValue <= max) {
      onChange(newValue);
    }
  };

  const handleDecrement = () => {
    const newValue = value - step;
    if (min === undefined || newValue >= min) {
      onChange(newValue);
    }
  };

  const handleInputChange = (e) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      if ((min === undefined || newValue >= min) && (max === undefined || newValue <= max)) {
        onChange(newValue);
      }
    }
  };

  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-daikin-dark mb-1.5">
          {label}
        </label>
      )}

      <div className="flex items-center gap-2">
        {showControls && (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={handleDecrement}
            disabled={disabled || (min !== undefined && value <= min)}
          >
            <Minus className="h-4 w-4" />
          </Button>
        )}

        <input
          ref={ref}
          type="number"
          value={value}
          onChange={handleInputChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className={clsx(
            'flex-1 h-10 px-3 rounded-lg text-center',
            'glass-input text-sm font-medium',
            'focus:outline-none',
            disabled && 'opacity-50 cursor-not-allowed',
            error && 'border-red-500'
          )}
        />

        {showControls && (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={handleIncrement}
            disabled={disabled || (max !== undefined && value >= max)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
});

export default NumberInput;