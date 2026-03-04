import { forwardRef, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

const Select = forwardRef(function Select(
  {
    label,
    value,
    onChange,
    options = [],
    placeholder = 'Select...',
    disabled = false,
    error,
    className,
    optionClassName,
    maxDropdownHeight = 200,
    size = 'default', // 'default' | 'sm'
  },
  ref
) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(maxDropdownHeight, options.length * 40 + 8);

      // Position above if not enough space below and more space above
      const shouldPositionAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      // For fixed positioning, use viewport-relative coordinates directly
      // getBoundingClientRect() already returns viewport-relative values
      setDropdownPosition({
        top: shouldPositionAbove
          ? rect.top - dropdownHeight - 4
          : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        openAbove: shouldPositionAbove,
      });
    }
  }, [isOpen, maxDropdownHeight, options.length]);

  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      const clickedInsideContainer = containerRef.current && containerRef.current.contains(event.target);
      const clickedInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);

      if (!clickedInsideContainer && !clickedInsideDropdown) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on scroll (but not when scrolling inside the dropdown)
  useEffect(() => {
    if (!isOpen) return;

    function handleScroll(event) {
      // Don't close if scrolling inside the dropdown
      if (dropdownRef.current && dropdownRef.current.contains(event.target)) {
        return;
      }
      setIsOpen(false);
    }

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  const selectedOption = options.find(opt =>
    typeof opt === 'object' ? opt.value === value : opt === value
  );

  const displayValue = selectedOption
    ? typeof selectedOption === 'object' ? selectedOption.label : selectedOption
    : placeholder;

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: dropdownPosition.openAbove ? 8 : -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: dropdownPosition.openAbove ? 8 : -8, scale: 0.96 }}
          transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          className={clsx(
            'fixed z-[9999]',
            'py-1 rounded-lg',
            'bg-white border border-surface-200 shadow-lg',
            'overflow-auto'
          )}
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            maxHeight: maxDropdownHeight,
          }}
        >
          {options.map((option, index) => {
            const optValue = typeof option === 'object' ? option.value : option;
            const optLabel = typeof option === 'object' ? option.label : option;
            const isSelected = optValue === value;

            return (
              <button
                key={optValue ?? index}
                type="button"
                onClick={() => {
                  onChange(optValue);
                  setIsOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center justify-between gap-2',
                  size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-sm',
                  'text-left transition-colors duration-100',
                  isSelected
                    ? 'bg-daikin-blue/10 text-daikin-blue'
                    : 'text-daikin-dark hover:bg-surface-100',
                  optionClassName
                )}
              >
                <span>{optLabel}</span>
                {isSelected && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-daikin-blue">
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </span>
                  )}
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {label && (
        <label className="block text-sm font-medium text-daikin-dark mb-1.5">
          {label}
        </label>
      )}

      <button
        ref={(node) => {
          buttonRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          'w-full flex items-center justify-between gap-2',
          size === 'sm' ? 'h-8 px-2.5 rounded-md text-[11px]' : 'h-10 px-3 rounded-lg text-sm',
          'glass-input text-left',
          'text-daikin-dark',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-red-500 focus:ring-red-500',
          isOpen && 'border-daikin-blue ring-2 ring-daikin-blue/20'
        )}
      >
        <span className={clsx(!selectedOption && 'text-surface-400')}>
          {displayValue}
        </span>
        <ChevronDown
          className={clsx(
            'text-surface-400 transition-transform duration-200',
            size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {createPortal(dropdownContent, document.body)}

      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
});

export default Select;