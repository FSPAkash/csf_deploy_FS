/**
 * DriverWaterfall Component
 * Visualizes the attribution of prediction drivers as a waterfall chart.
 */

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import TrustBadge from '../intelligence/TrustBadge';

const COLORS = {
  baseline: '#3B82F6',     // Blue
  increase: '#10B981',     // Green
  decrease: '#F59E0B',     // Amber
  total: '#8B5CF6',        // Purple
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="glass-strong rounded-lg p-3 shadow-xl border border-surface-200/50 bg-white/95 min-w-[200px]">
      <p className="font-semibold text-daikin-dark text-sm mb-2">{data.name}</p>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-surface-500">Value:</span>
          <span className={`font-medium ${
            data.type === 'increase' ? 'text-emerald-600' :
            data.type === 'decrease' ? 'text-amber-600' :
            'text-daikin-dark'
          }`}>
            {data.type === 'baseline' || data.type === 'total'
              ? data.value.toFixed(2)
              : `${data.value >= 0 ? '+' : ''}${data.value.toFixed(2)}`
            }
          </span>
        </div>

        {data.percentage && data.type !== 'baseline' && data.type !== 'total' && (
          <div className="flex justify-between">
            <span className="text-surface-500">Impact:</span>
            <span className="font-medium text-daikin-dark">
              {data.percentage >= 0 ? '+' : ''}{data.percentage.toFixed(1)}%
            </span>
          </div>
        )}

        {data.source && (
          <div className="pt-1.5 border-t border-surface-200/50">
            <span className="text-surface-400">Source: </span>
            <span className="text-surface-600">{data.source}</span>
          </div>
        )}

        {data.trust !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-surface-500">Trust:</span>
            <TrustBadge score={data.trust} />
          </div>
        )}
      </div>
    </div>
  );
}

function DriverWaterfall({
  attribution,
  height = 300,
  showSummary = true,
}) {
  // Handle both the direct attribution format and the nested format
  const steps = attribution?.waterfall_steps || attribution?.steps || [];
  const summary = attribution?.summary || '';
  const totalChange = attribution?.total_change || attribution?.totalChange || 0;
  const totalChangePct = attribution?.total_change_pct || attribution?.totalChangePct || 0;
  const combinedTrust = attribution?.combined_trust_score || attribution?.combinedTrust || 0;

  // Transform waterfall steps to chart data
  const chartData = useMemo(() => {
    if (!steps || steps.length === 0) return [];

    return steps.map((step, idx) => {
      // Handle both object and dict formats
      const name = step.label || step.name || `Step ${idx}`;
      const value = step.value ?? 0;
      const stepType = step.step_type || step.type || 'increase';

      return {
        name: name.length > 20 ? name.substring(0, 18) + '...' : name,
        fullName: name,
        value,
        type: stepType,
        fill: COLORS[stepType] || COLORS.increase,
        source: step.source,
        trust: step.trust_score || step.trust,
        percentage: step.percentage,
        cumulative: step.cumulative,
      };
    });
  }, [steps]);

  // Calculate the start/end for waterfall effect
  const waterfallData = useMemo(() => {
    if (chartData.length === 0) return [];

    let runningTotal = 0;
    return chartData.map((item, idx) => {
      const prevTotal = runningTotal;

      if (item.type === 'baseline') {
        runningTotal = item.value;
        return {
          ...item,
          start: 0,
          end: item.value,
          displayValue: item.value,
        };
      } else if (item.type === 'total') {
        return {
          ...item,
          start: 0,
          end: item.value,
          displayValue: item.value,
        };
      } else {
        runningTotal += item.value;
        return {
          ...item,
          start: prevTotal,
          end: runningTotal,
          displayValue: item.value,
        };
      }
    });
  }, [chartData]);

  if (!steps || steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-surface-400">
        <Info className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs">No attribution data available</p>
        <p className="text-[10px] mt-1">Generate a prediction to see driver breakdown</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      {showSummary && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {totalChange >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-amber-500" />
              )}
              <span className={`text-lg font-semibold ${
                totalChange >= 0 ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {totalChange >= 0 ? '+' : ''}{totalChangePct.toFixed(1)}%
              </span>
              <span className="text-sm text-surface-500">from baseline</span>
            </div>
            {summary && (
              <p className="text-xs text-surface-600 leading-relaxed">{summary}</p>
            )}
          </div>

          <div className="flex-shrink-0">
            <TrustBadge score={combinedTrust} showDetails />
          </div>
        </div>
      )}

      {/* Waterfall Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={waterfallData}
            margin={{ top: 10, right: 10, left: 10, bottom: 30 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#64748b' }}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => v.toFixed(0)}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#e2e8f0" />

            {/* For waterfall effect, we use stacked bars */}
            <Bar
              dataKey="displayValue"
              radius={[4, 4, 0, 0]}
            >
              {waterfallData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.baseline }} />
          <span className="text-surface-500">Baseline</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.increase }} />
          <span className="text-surface-500">Increase</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.decrease }} />
          <span className="text-surface-500">Decrease</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.total }} />
          <span className="text-surface-500">Final</span>
        </div>
      </div>
    </div>
  );
}

export default DriverWaterfall;
