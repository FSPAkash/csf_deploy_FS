import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import clsx from 'clsx';

const Checkbox = forwardRef(function Checkbox(
  {
    label,
    checked,
    onChange,
    disabled = false,
    className,
  },
  ref
) {
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
            'w-5 h-5 rounded-md border-2 transition-all duration-200',
            'flex items-center justify-center',
            checked
              ? 'bg-daikin-blue border-daikin-blue'
              : 'bg-white border-surface-300 hover:border-daikin-blue/50'
          )}
        >
          <motion.div
            initial={false}
            animate={{ 
              scale: checked ? 1 : 0,
              opacity: checked ? 1 : 0,
            }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
          </motion.div>
        </div>
      </div>

      {label && (
        <span className="text-sm text-daikin-dark">{label}</span>
      )}
    </label>
  );
});

export default Checkbox;