import { forwardRef } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

const Button = forwardRef(function Button(
  {
    children,
    className,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    ...props
  },
  ref
) {
  const baseStyles = `
    inline-flex items-center justify-center gap-2
    font-medium rounded-lg
    transition-all duration-200 ease-apple
    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variants = {
    primary: `
      bg-daikin-blue text-white
      hover:bg-daikin-blue/90
      active:scale-[0.98]
      shadow-button hover:shadow-button-hover
      focus-visible:ring-daikin-blue
    `,
    secondary: `
      bg-white text-daikin-dark
      border border-surface-200
      hover:bg-surface-50 hover:border-surface-300
      active:scale-[0.98]
      shadow-sm hover:shadow-md
      focus-visible:ring-daikin-blue
    `,
    ghost: `
      bg-transparent text-daikin-dark
      hover:bg-surface-100
      active:bg-surface-200
      focus-visible:ring-daikin-blue
    `,
    danger: `
      bg-red-500 text-white
      hover:bg-red-600
      active:scale-[0.98]
      shadow-sm hover:shadow-md
      focus-visible:ring-red-500
    `,
    outline: `
      bg-transparent text-daikin-blue
      border-2 border-daikin-blue
      hover:bg-daikin-blue/5
      active:scale-[0.98]
      focus-visible:ring-daikin-blue
    `,
    glass: `
      glass text-daikin-dark
      hover:bg-white/80
      active:scale-[0.98]
      shadow-glass hover:shadow-glass-strong
      focus-visible:ring-daikin-blue
    `,
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
    xl: 'h-14 px-8 text-lg',
    icon: 'h-10 w-10',
    'icon-sm': 'h-8 w-8',
    'icon-lg': 'h-12 w-12',
  };

  return (
    <button
      ref={ref}
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : leftIcon ? (
        <span className="flex-shrink-0">{leftIcon}</span>
      ) : null}
      
      {children && <span>{children}</span>}
      
      {rightIcon && !isLoading && (
        <span className="flex-shrink-0">{rightIcon}</span>
      )}
    </button>
  );
});

export default Button;