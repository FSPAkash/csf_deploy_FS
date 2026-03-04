import clsx from 'clsx';

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-12 px-4', className)}>
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-surface-400" />
        </div>
      )}
      
      {title && (
        <h3 className="text-lg font-semibold text-daikin-dark mb-2">
          {title}
        </h3>
      )}
      
      {description && (
        <p className="text-sm text-surface-500 text-center max-w-sm mb-6">
          {description}
        </p>
      )}
      
      {action}
    </div>
  );
}

export default EmptyState;