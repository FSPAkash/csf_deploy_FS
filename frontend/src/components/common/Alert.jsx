import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react';
import clsx from 'clsx';
import Button from './Button';

const icons = {
  info: Info,
  success: CheckCircle,
  warning: AlertCircle,
  error: XCircle,
};

const styles = {
  info: {
    container: 'bg-sky-50 border-sky-200',
    icon: 'text-sky-500',
    title: 'text-sky-800',
    text: 'text-sky-700',
  },
  success: {
    container: 'bg-green-50 border-green-200',
    icon: 'text-green-500',
    title: 'text-green-800',
    text: 'text-green-700',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-500',
    title: 'text-amber-800',
    text: 'text-amber-700',
  },
  error: {
    container: 'bg-red-50 border-red-200',
    icon: 'text-red-500',
    title: 'text-red-800',
    text: 'text-red-700',
  },
};

function Alert({
  type = 'info',
  title,
  children,
  onClose,
  className,
  actions,
}) {
  const Icon = icons[type];
  const style = styles[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={clsx(
        'relative rounded-xl border p-4',
        style.container,
        className
      )}
    >
      <div className="flex gap-3">
        <div className={clsx('flex-shrink-0 mt-0.5', style.icon)}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={clsx('text-sm font-semibold mb-1', style.title)}>
              {title}
            </h4>
          )}
          <div className={clsx('text-sm', style.text)}>
            {children}
          </div>

          {actions && (
            <div className="mt-3 flex gap-2">
              {actions}
            </div>
          )}
        </div>

        {onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className={clsx('flex-shrink-0 -mr-1 -mt-1', style.text)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default Alert;