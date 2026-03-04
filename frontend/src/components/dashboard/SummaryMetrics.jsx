import { Download } from 'lucide-react';
import { GlassCard, Button } from '../common';
import { formatNumber, formatPercent, getDeltaColor } from '../../utils/formatters';
import clsx from 'clsx';

function MetricCard({ label, value, subValue, className }) {
  return (
    <div className={clsx('text-center', className)}>
      <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-xl font-bold text-daikin-dark">
        {value}
      </p>
      {subValue && (
        <p className="text-xs text-surface-400 mt-0.5">
          {subValue}
        </p>
      )}
    </div>
  );
}

function SummaryMetrics({ stats, onExport, isLoading }) {
  if (!stats) {
    return null;
  }

  const { avgSimulated, totalSimulated, deltaPercent } = stats;

  return (
    <GlassCard variant="panel" padding="md">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-1 h-8 bg-gradient-to-b from-daikin-blue to-daikin-light rounded-full" />
          <span className="text-sm font-semibold text-daikin-dark">Summary</span>
        </div>

        <div className="flex flex-wrap items-center gap-8">
          <MetricCard
            label="Avg Simulated"
            value={formatNumber(avgSimulated, 1)}
          />
          
          <MetricCard
            label="Total Simulated"
            value={formatNumber(totalSimulated, 0)}
          />
          
          <MetricCard
            label="vs Baseline"
            value={
              <span className={getDeltaColor(deltaPercent)}>
                {formatPercent(deltaPercent, 1, true)}
              </span>
            }
          />
        </div>

        <div data-tutorial="export-button">
          <Button
            variant="primary"
            size="sm"
            onClick={onExport}
            disabled={isLoading}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Export CSV
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

export default SummaryMetrics;