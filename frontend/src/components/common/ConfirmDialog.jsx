import { Modal, Button } from './index';
import { AlertTriangle, Trash2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

const icons = {
  danger: Trash2,
  warning: AlertTriangle,
  info: AlertCircle,
};

const iconStyles = {
  danger: 'bg-red-100 text-red-600',
  warning: 'bg-amber-100 text-amber-600',
  info: 'bg-sky-100 text-sky-600',
};

const buttonVariants = {
  danger: 'danger',
  warning: 'primary',
  info: 'primary',
};

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) {
  const Icon = icons[variant];

  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
    >
      <div className="text-center">
        <div 
          className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4',
            iconStyles[variant]
          )}
        >
          <Icon className="h-6 w-6" />
        </div>

        <h3 className="text-lg font-semibold text-daikin-dark mb-2">
          {title}
        </h3>

        <p className="text-surface-500 text-sm mb-6">
          {message}
        </p>

        <div className="flex gap-3 justify-center">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={buttonVariants[variant]}
            onClick={handleConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;