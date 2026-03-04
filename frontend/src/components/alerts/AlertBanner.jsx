/**
 * AlertBanner.jsx
 * Top banner for high-priority alerts
 */

import React, { useState, useEffect } from 'react';

const AlertBanner = ({ alerts, onDismiss, onViewAll }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Filter to high severity alerts only
  const highPriorityAlerts = alerts?.filter(a => a.severity === 'high' && !a.read) || [];

  // Auto-rotate through alerts
  useEffect(() => {
    if (highPriorityAlerts.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % highPriorityAlerts.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [highPriorityAlerts.length]);

  if (!highPriorityAlerts.length || !isVisible) return null;

  const currentAlert = highPriorityAlerts[currentIndex];

  return (
    <div className="relative w-full bg-gradient-to-r from-red-600/90 to-red-500/90
                    backdrop-blur-sm border-b border-red-400/30">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        {/* Alert Message */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Alert:</span>
          <p className="text-sm text-white font-medium">
            {currentAlert.message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Alert counter */}
          {highPriorityAlerts.length > 1 && (
            <span className="text-xs text-white/70">
              {currentIndex + 1} of {highPriorityAlerts.length}
            </span>
          )}

          {/* View All Button */}
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="px-3 py-1 text-xs font-medium text-white
                         bg-white/20 hover:bg-white/30 rounded-md
                         transition-all duration-200"
            >
              View All
            </button>
          )}

          {/* Dismiss Button */}
          <button
            onClick={() => {
              if (onDismiss) onDismiss(currentAlert.id);
              if (highPriorityAlerts.length === 1) setIsVisible(false);
            }}
            className="text-white/70 hover:text-white transition-colors text-xs font-medium"
            title="Dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Progress bar for auto-rotation */}
      {highPriorityAlerts.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
          <div
            className="h-full bg-white/50 transition-all duration-5000 ease-linear"
            style={{
              width: `${((currentIndex + 1) / highPriorityAlerts.length) * 100}%`,
              animation: 'progress 5s linear infinite'
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default AlertBanner;
