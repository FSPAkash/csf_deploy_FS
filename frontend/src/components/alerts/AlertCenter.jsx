/**
 * AlertCenter.jsx
 * Full alert management panel with filtering and actions
 */

import React, { useState } from 'react';
import AlertCard from './AlertCard';
import AlertBadge from './AlertBadge';

const AlertCenter = ({
  alerts = [],
  alertSummary = { total_active: 0, unread: 0, by_severity: { high: 0, medium: 0, low: 0 } },
  onMarkRead,
  onDismiss,
  onMarkAllRead,
  isLoading = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'high', 'medium', 'low'

  const unreadCount = alertSummary?.unread ?? alerts.filter(a => !a.read).length;

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'unread') return !alert.read;
    if (filter === 'high' || filter === 'medium' || filter === 'low') {
      return alert.severity === filter;
    }
    return true;
  });

  // Sort by newest first, then by severity
  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    // Unread first
    if (!a.read && b.read) return -1;
    if (a.read && !b.read) return 1;
    // Then by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const severityDiff = (severityOrder[a.severity] || 1) - (severityOrder[b.severity] || 1);
    if (severityDiff !== 0) return severityDiff;
    // Then by date
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative flex items-center gap-2 px-3 py-2
          rounded-lg border transition-all duration-200
          ${isOpen
            ? 'bg-white/20 border-white/30 text-white'
            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
          }
        `}
      >
        <span className="text-sm font-medium">Alerts</span>

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="min-w-[18px] h-[18px] px-1
                           bg-red-500 text-white text-xs font-bold
                           rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Alert Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[70vh]
                        bg-slate-900/95 backdrop-blur-xl rounded-xl
                        border border-white/10 shadow-2xl z-50
                        overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Alerts</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && onMarkAllRead && (
                  <button
                    onClick={onMarkAllRead}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/50 hover:text-white transition-colors text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-white/60">
                  High: {alertSummary?.by_severity?.high ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-white/60">
                  Medium: {alertSummary?.by_severity?.medium ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-white/60">
                  Low: {alertSummary?.by_severity?.low ?? 0}
                </span>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1 mt-3">
              {['all', 'unread', 'high', 'medium', 'low'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`
                    px-2.5 py-1 text-xs rounded-md transition-all duration-200
                    ${filter === f
                      ? 'bg-white/20 text-white'
                      : 'text-white/50 hover:text-white/70 hover:bg-white/10'
                    }
                  `}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Alert List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
              </div>
            ) : sortedAlerts.length > 0 ? (
              sortedAlerts.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onMarkRead={onMarkRead}
                  onDismiss={onDismiss}
                />
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-white/50">
                  {filter === 'all' ? 'No alerts yet' : `No ${filter} alerts`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertCenter;
