import { forwardRef } from 'react';
import clsx from 'clsx';

const GlassCard = forwardRef(function GlassCard(
  { 
    children, 
    className, 
    variant = 'default', 
    hover = false,
    padding = 'md',
    ...props 
  }, 
  ref
) {
  const variants = {
    default: 'glass-card',
    subtle: 'glass-subtle rounded-xl',
    strong: 'glass-strong rounded-xl',
    panel: 'glass-panel',
  };

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  };

  return (
    <div
      ref={ref}
      className={clsx(
        variants[variant],
        paddings[padding],
        hover && 'glass-card-interactive cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export default GlassCard;