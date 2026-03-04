/**
 * TrustBadge Component
 * Displays trust score with visual indicator and tooltip.
 */

import { useState, useRef } from 'react';
import { TooltipPortal } from '../common';

const TRUST_LEVELS = {
  official: { min: 0.85, label: 'Official', color: 'emerald' },
  verified: { min: 0.70, label: 'Verified', color: 'blue' },
  news: { min: 0.55, label: 'News', color: 'amber' },
  unverified: { min: 0.40, label: 'Unverified', color: 'orange' },
  low: { min: 0, label: 'Low', color: 'red' },
};

function getTrustLevel(score) {
  if (score >= TRUST_LEVELS.official.min) return 'official';
  if (score >= TRUST_LEVELS.verified.min) return 'verified';
  if (score >= TRUST_LEVELS.news.min) return 'news';
  if (score >= TRUST_LEVELS.unverified.min) return 'unverified';
  return 'low';
}

const colorClasses = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  red: 'bg-red-50 text-red-700 border-red-200',
};

function TrustBadge({ score, showDetails = false, explanation = null }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const badgeRef = useRef(null);

  const level = getTrustLevel(score);
  const config = TRUST_LEVELS[level];
  const percentage = Math.round(score * 100);

  return (
    <div
      ref={badgeRef}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClasses[config.color]} cursor-help transition-all hover:shadow-sm`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span>{config.label}</span>
      {showDetails && (
        <span className="font-semibold">{percentage}%</span>
      )}

      <TooltipPortal anchorRef={badgeRef} isVisible={showTooltip}>
        <div className="glass-strong rounded-lg p-3 shadow-xl border border-surface-200/50 whitespace-nowrap bg-white/95 max-w-xs">
          <div className="text-xs font-semibold text-daikin-dark mb-2">
            Trust Score: {percentage}%
          </div>
          <div className="text-xs text-surface-600 mb-2">
            {config.label}
          </div>
          {explanation && (
            <div className="text-[10px] text-surface-500 border-t border-surface-200/50 pt-2 mt-2">
              {explanation}
            </div>
          )}
          <div className="mt-2 h-1.5 bg-surface-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                config.color === 'emerald' ? 'bg-emerald-500' :
                config.color === 'blue' ? 'bg-blue-500' :
                config.color === 'amber' ? 'bg-amber-500' :
                config.color === 'orange' ? 'bg-orange-500' :
                'bg-red-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </TooltipPortal>
    </div>
  );
}

export default TrustBadge;
