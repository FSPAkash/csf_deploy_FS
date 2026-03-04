import clsx from 'clsx';

function Spinner({ size = 'md', className }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3',
    xl: 'h-12 w-12 border-4',
  };

  return (
    <div
      className={clsx(
        'animate-spin rounded-full',
        'border-daikin-light border-t-daikin-blue',
        sizes[size],
        className
      )}
    />
  );
}

export default Spinner;