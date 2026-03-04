import clsx from 'clsx';

function Skeleton({ className, variant = 'rectangular', animation = 'pulse' }) {
  const variants = {
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
    text: 'rounded h-4',
  };

  const animations = {
    pulse: 'animate-pulse',
    shimmer: 'shimmer',
    none: '',
  };

  return (
    <div
      className={clsx(
        'bg-surface-200',
        variants[variant],
        animations[animation],
        className
      )}
    />
  );
}

function SkeletonText({ lines = 3, className }) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={clsx(
            'h-4',
            i === lines - 1 && 'w-3/4' // Last line shorter
          )}
        />
      ))}
    </div>
  );
}

function SkeletonCard({ className }) {
  return (
    <div className={clsx('glass-card p-4', className)}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circular" className="w-10 h-10" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/3 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

function SkeletonChart({ className }) {
  return (
    <div className={clsx('glass-card p-6', className)}>
      <Skeleton className="h-6 w-1/3 mb-4" />
      <div className="flex items-end gap-2 h-64">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-4">
        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => (
          <Skeleton key={month} className="h-3 w-6" />
        ))}
      </div>
    </div>
  );
}

function SkeletonControls({ className }) {
  return (
    <div className={clsx('grid grid-cols-5 gap-4', className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="glass-card p-4">
          <Skeleton className="h-5 w-2/3 mb-4" />
          <Skeleton className="h-10 w-full mb-3" />
          <Skeleton className="h-8 w-full mb-3" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

Skeleton.Text = SkeletonText;
Skeleton.Card = SkeletonCard;
Skeleton.Chart = SkeletonChart;
Skeleton.Controls = SkeletonControls;

export default Skeleton;