/**
 * AlertCard.jsx
 * Individual alert display card with actions
 */

import React from 'react';

const SEVERITY_STYLES = {
  high: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/50',
    icon: '!',
    iconBg: 'bg-red-500',
    text: 'text-red-400'
  },
  medium: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    icon: '!',
    iconBg: 'bg-amber-500',
    text: 'text-amber-400'
  },
  low: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    icon: 'i',
    iconBg: 'bg-blue-500',
    text: 'text-blue-400'
  }
};

const ALERT_TYPE_LABELS = {
  prediction_change: 'Prediction Change',
  new_event: 'New Event',
  trust_warning: 'Trust Warning',
  threshold_breach: 'Threshold Breach'
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const AlertCard = ({
  alert,
  onMarkRead,
  onDismiss,
  compact = false
}) => {
  const severity = alert.severity || 'medium';
  const styles = SEVERITY_STYLES[severity] || SEVERITY_STYLES.medium;
  const isRead = alert.read;

  if (compact) {
    return (
      <div
        className={`
          flex items-center gap-2 p-2 rounded-lg
          ${styles.bg} ${styles.border} border
          ${isRead ? 'opacity-60' : ''}
          transition-all duration-200
        `}
      >
        <div className={`
          w-5 h-5 rounded-full ${styles.iconBg}
          flex items-center justify-center
          text-white text-xs font-bold
        `}>
          {styles.icon}
        </div>
        <span className="flex-1 text-sm text-white/90 truncate">
          {alert.message}
        </span>
        {!isRead && (
          <div className="w-2 h-2 bg-blue-400 rounded-full" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`
        relative p-4 rounded-xl
        ${styles.bg} ${styles.border} border
        ${isRead ? 'opacity-70' : ''}
        transition-all duration-200
        hover:opacity-100
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className={`
            w-6 h-6 rounded-full ${styles.iconBg}
            flex items-center justify-center
            text-white text-sm font-bold
          `}>
            {styles.icon}
          </div>
          <div>
            <span className={`text-xs font-medium ${styles.text}`}>
              {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
            </span>
            {alert.product && (
              <span className="text-xs text-white/50 ml-2">
                {alert.product}
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-white/40">
          {formatTimestamp(alert.created_at)}
        </span>
      </div>

      {/* Message */}
      <p className="text-sm text-white/90 mb-3 leading-relaxed">
        {alert.message}
      </p>

      {/* Details (if available) */}
      {alert.details && (
        <div className="mb-3 p-2 rounded-lg bg-white/5">
          {alert.details.previous_value !== undefined && alert.details.new_value !== undefined && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/50">Change:</span>
              <span className="text-white/70">{alert.details.previous_value}%</span>
              <span className="text-white/40">→</span>
              <span className={alert.details.new_value > alert.details.previous_value ? 'text-green-400' : 'text-red-400'}>
                {alert.details.new_value}%
              </span>
            </div>
          )}
          {alert.details.event_title && (
            <div className="text-xs text-white/70 mt-1">
              Event: {alert.details.event_title}
            </div>
          )}
          {alert.details.trust_score !== undefined && (
            <div className="text-xs text-white/70 mt-1">
              Trust Score: {(alert.details.trust_score * 100).toFixed(0)}%
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {!isRead && onMarkRead && (
          <button
            onClick={() => onMarkRead(alert.id)}
            className="px-2.5 py-1 text-xs text-white/70 hover:text-white
                       bg-white/10 hover:bg-white/20 rounded-md
                       transition-all duration-200"
          >
            Mark Read
          </button>
        )}
        {onDismiss && (
          <button
            onClick={() => onDismiss(alert.id)}
            className="px-2.5 py-1 text-xs text-white/50 hover:text-white/70
                       hover:bg-white/10 rounded-md
                       transition-all duration-200"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Unread indicator */}
      {!isRead && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-blue-400 rounded-full" />
      )}
    </div>
  );
};

export default AlertCard;
