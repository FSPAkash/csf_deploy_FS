import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const Toggle = forwardRef(function Toggle(
  {
    label,
    checked,
    onChange,
    disabled = false,
    size = 'md',
    className,
  },
  ref
) {
  const sizes = {
    sm: {
      track: 'w-8 h-5',
      thumb: 'w-3.5 h-3.5',
      translate: 14,
    },
    md: {
      track: 'w-11 h-6',
      thumb: 'w-4.5 h-4.5',
      translate: 20,
    },
    lg: {
      track: 'w-14 h-7',
      thumb: 'w-5.5 h-5.5',
      translate: 28,
    },
  };

  const sizeConfig = sizes[size];

  return (
    <label
      className={clsx(
        'inline-flex items-center gap-2 cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="relative">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        
        <div
          className={clsx(
            sizeConfig.track,
            'rounded-full transition-colors duration-200',
            checked 
              ? 'bg-gradient-to-r from-daikin-blue to-daikin-light' 
              : 'bg-surface-300'
          )}
        >
          <motion.div
            className={clsx(
              'absolute top-0.5 left-0.5',
              'bg-white rounded-full shadow-md',
              size === 'sm' && 'w-4 h-4',
              size === 'md' && 'w-5 h-5',
              size === 'lg' && 'w-6 h-6'
            )}
            animate={{ 
              x: checked ? sizeConfig.translate : 0 
            }}
            transition={{ 
              type: 'spring', 
              stiffness: 500, 
              damping: 30 
            }}
          />
        </div>
      </div>

      {label && (
        <span className="text-sm text-daikin-dark">{label}</span>
      )}
    </label>
  );
});

export default Toggle;