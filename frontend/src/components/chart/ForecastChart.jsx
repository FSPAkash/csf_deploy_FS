import { useMemo, memo, useCallback, useRef, useState } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import { Eye, EyeOff, Calendar, Crosshair, RotateCcw, AlertTriangle, ArrowRight, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MONTHS, CHART_COLORS } from '../../utils/constants';
import { formatNumber } from '../../utils/formatters';

function formatDataDate(dateString) {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

const EFFECT_DISPLAY_NAMES = {
  'trend': 'Trend Correction',
  'trans': 'Transition Sep-Dec',
  'pf_pos': 'Pull Forward (+) 21-22',
  'pf_neg': 'Pull Forward (-) 2023',
  'pfpos': 'Pull Forward (+) 21-22',
  'pfneg': 'Pull Forward (-) 2023',
  'upromoup': 'Promotion',
  'upromodwn': 'Promo Spillover',
  'dpromoup': 'Promotion',
  'dpromodwn': 'Promo Spillover',
  'Locked_Promo': 'Locked Promotion',
  'Promo_March_Reduction': 'March Promo Offset',
  'shortage': 'Supply Shortage',
  'Locked_Shortage': 'Locked Shortage',
  'regulation': 'Regulation Impact',
  'epa': 'EPA Regulation',
  'Locked_Regulation': 'Locked Regulation',
  'Custom': 'Custom Event',
  'Locked_Custom': 'Locked Custom Event',
  'Intelligence_Events': 'Market Intelligence',
  'DampenedUp': 'Dampening Applied',
};

function getEffectDisplayName(effectName) {
  if (EFFECT_DISPLAY_NAMES[effectName]) {
    return EFFECT_DISPLAY_NAMES[effectName];
  }
  const lowerName = effectName.toLowerCase();
  for (const [key, displayName] of Object.entries(EFFECT_DISPLAY_NAMES)) {
    if (lowerName.includes(key.toLowerCase())) {
      return displayName;
    }
  }
  return effectName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getRankLabel(rank, total) {
  if (total <= 1) return null;
  return `#${rank + 1}`;
}

const CustomTooltip = memo(function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload;
  const appliedEffects = dataPoint?.appliedEffects || [];

  const activeEffects = appliedEffects
    .filter(([_, multiplier]) => Math.abs(multiplier - 1.0) > 0.001)
    .map(([name, multiplier]) => ({
      name: getEffectDisplayName(name),
      rawName: name,
      multiplier,
      impact: Math.abs(multiplier - 1.0)
    }))
    .sort((a, b) => b.impact - a.impact);

  const seenNames = new Set();
  const uniqueEffects = activeEffects.filter(effect => {
    if (seenNames.has(effect.name)) return false;
    seenNames.add(effect.name);
    return true;
  });

  // Filter out std dev entries from tooltip payload, show as single combined line
  const stdDevUpperEntry = payload.find(e => e.dataKey === 'stdDevUpper');
  const stdDevLowerEntry = payload.find(e => e.dataKey === 'stdDevLower');
  const regularPayload = payload.filter(e => e.dataKey !== 'stdDevUpper' && e.dataKey !== 'stdDevLower');

  return (
    <div className="glass-strong rounded-lg p-3 shadow-lg border border-surface-200/50 min-w-[220px]">
      <p className="font-semibold text-daikin-dark mb-2">{label}</p>
      <div className="space-y-1">
        {regularPayload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-surface-600">{entry.name}:</span>
            <span className="font-medium text-daikin-dark">
              {formatNumber(entry.value, 2)}
            </span>
          </div>
        ))}
        {stdDevUpperEntry && stdDevLowerEntry && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: CHART_COLORS.simulated, backgroundColor: 'transparent' }} />
            <span className="text-surface-600">+/- 1 Std Dev:</span>
            <span className="font-medium text-daikin-dark">
              {formatNumber(stdDevLowerEntry.value, 0)} - {formatNumber(stdDevUpperEntry.value, 0)}
            </span>
          </div>
        )}
      </div>

      {uniqueEffects.length > 0 && (
        <div className="mt-3 pt-2 border-t border-surface-200/50">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1.5">
            Applied Simulations {uniqueEffects.length > 1 ? '(impact rank)' : ''}
          </p>
          <div className="space-y-1">
            {uniqueEffects.map((effect, idx) => {
              const rankLabel = getRankLabel(idx, uniqueEffects.length);
              const isPositive = effect.multiplier > 1;
              return (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  {rankLabel && (
                    <span className="w-5 text-[10px] font-medium text-surface-400">
                      {rankLabel}
                    </span>
                  )}
                  <div className={`w-2 h-2 rounded-full ${
                    isPositive ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                  <span className={`${idx === 0 ? 'font-medium text-daikin-dark' : 'text-surface-600'}`}>
                    {effect.name}
                  </span>
                </div>
              );
            })}
          </div>
          {uniqueEffects.length > 1 && (
            <div className="mt-2 pt-1.5 border-t border-surface-100 text-[9px] text-surface-400">
              #1 = Largest impact | #{uniqueEffects.length} = Smallest
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const LineToggle = memo(function LineToggle({
  label,
  color,
  isActive,
  onChange,
  disabled = false,
  dashed = false,
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!isActive)}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
        transition-all duration-200 ease-out
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
        ${isActive ? 'bg-white shadow-md border border-surface-200' : 'bg-surface-100/50 border border-transparent'}
      `}
    >
      <div className="relative flex items-center w-5">
        {dashed ? (
          <div className="flex gap-0.5">
            <div className="w-1.5 h-0.5 rounded-full" style={{ backgroundColor: isActive ? color : '#9CA3AF' }} />
            <div className="w-1.5 h-0.5 rounded-full" style={{ backgroundColor: isActive ? color : '#9CA3AF' }} />
          </div>
        ) : (
          <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: isActive ? color : '#9CA3AF' }} />
        )}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-2"
          style={{ borderColor: isActive ? color : '#9CA3AF', backgroundColor: isActive ? color : 'transparent' }}
        />
      </div>
      <span className={isActive ? 'text-daikin-dark' : 'text-surface-400'}>{label}</span>
      {isActive ? <Eye className="w-3 h-3 text-surface-400" /> : <EyeOff className="w-3 h-3 text-surface-300" />}
    </button>
  );
});

const WarningBadge = memo(function WarningBadge({ month }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
      {month}: Review Recommended
    </div>
  );
});

const PulsatingDot = memo(function PulsatingDot({ cx, cy }) {
  if (cx === undefined || cy === undefined) return null;

  return (
    <g>
      <circle cx={cx} cy={cy} r={36} fill="#0097E0" opacity={0.3}>
        <animate attributeName="r" values="8;16;8" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={6} fill="#0097E0" stroke="#ffffff" strokeWidth={2}>
        <animate attributeName="r" values="5;7;5" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </g>
  );
});

function calculateFixedDomain(baseline, simulated, delivered, actuals, cannibalizationResult = null, extraValues = []) {
  // When in cannibalization mode, only use cannibalization values for proper Y-axis scaling
  if (cannibalizationResult) {
    const allValues = [];
    if (cannibalizationResult.source?.adjusted_baseline) {
      allValues.push(...cannibalizationResult.source.adjusted_baseline.filter(v => v != null && !isNaN(v)));
    }
    if (cannibalizationResult.source?.original_baseline) {
      allValues.push(...cannibalizationResult.source.original_baseline.filter(v => v != null && !isNaN(v)));
    }
    if (cannibalizationResult.target?.adjusted_baseline) {
      allValues.push(...cannibalizationResult.target.adjusted_baseline.filter(v => v != null && !isNaN(v)));
    }
    if (cannibalizationResult.target?.original_baseline) {
      allValues.push(...cannibalizationResult.target.original_baseline.filter(v => v != null && !isNaN(v)));
    }
    if (allValues.length === 0) return [0, 100];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min;
    const padding = range * 0.15;
    return [
      Math.max(0, Math.floor((min - padding) / 10) * 10),
      Math.ceil((max + padding) / 10) * 10
    ];
  }

  const allValues = [
    ...(baseline || []),
    ...(simulated || []),
    ...(delivered || []),
    ...(actuals || []),
    ...(extraValues || []),
  ].filter(v => v != null && !isNaN(v));

  if (allValues.length === 0) return [0, 100];

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min;
  const padding = range * 0.15;

  return [
    Math.max(0, Math.floor((min - padding) / 10) * 10),
    Math.ceil((max + padding) / 10) * 10
  ];
}

function ForecastChart({
  baseline,
  simulated,
  delivered,
  actuals,
  exceededMonths = [],
  product,
  apsClass,
  year,
  showBaseline,
  showDelivered,
  showActuals,
  onToggleBaseline,
  onToggleDelivered,
  onToggleActuals,
  dataDate = null,
  focusMonth = null,
  onFocusToggle,
  analysisMonth,
  analysisYear,
  availableYears = [],
  setSelectedYear,
  onReset,
  appliedDetails = {},
  height = 420,
  cannibalizationResult = null,
  baselineData = {},
  showStdDev = false,
  onToggleStdDev,
}) {
  const fixedDomainRef = useRef(null);
  const lastKeyRef = useRef(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCannibSource, setShowCannibSource] = useState(true);
  const [showCannibTarget, setShowCannibTarget] = useState(true);

  const dataKey = `${product}-${apsClass}-${year}`;
  const cannibKey = cannibalizationResult ?
    `${cannibalizationResult.sourceProduct}-${cannibalizationResult.targetProduct}` :
    'none';

  const simulatedKey = simulated ? simulated.reduce((a, b) => a + (b || 0), 0).toFixed(2) : 'none';
  const fullKey = `${dataKey}-${cannibKey}-${simulatedKey}`;

  const hasDelivered = delivered?.some(v => v != null && !isNaN(v)) ?? false;
  const hasActuals = actuals?.some(v => v != null && !isNaN(v)) ?? false;
  const hasBaseline = baseline?.some(v => v != null && !isNaN(v)) ?? false;
  const hasSimulated = simulated?.some(v => v != null && !isNaN(v)) ?? false;

  // Compute monthly std dev across all available years of baseline data
  const monthlyStdDev = useMemo(() => {
    if (!baselineData || typeof baselineData !== 'object') return null;
    const years = Object.keys(baselineData).map(Number).filter(y => !isNaN(y));
    if (years.length < 2) return null;
    const stdDevs = [];
    for (let m = 0; m < 12; m++) {
      const values = years
        .map(y => baselineData[y]?.[m])
        .filter(v => v != null && !isNaN(v) && v > 0);
      if (values.length < 2) {
        stdDevs.push(0);
        continue;
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
      stdDevs.push(Math.sqrt(variance));
    }
    return stdDevs;
  }, [baselineData]);

  const hasStdDev = monthlyStdDev != null && monthlyStdDev.some(v => v > 0);

  const stdDevKey = showStdDev && monthlyStdDev ? monthlyStdDev.reduce((a, b) => a + b, 0).toFixed(2) : 'none';
  const fullKeyWithStd = `${fullKey}-std${stdDevKey}`;

  if (fullKeyWithStd !== lastKeyRef.current) {
    lastKeyRef.current = fullKeyWithStd;
    // Include std dev bounds in domain calculation when active
    let stdDevUpper = null;
    let stdDevLower = null;
    if (showStdDev && monthlyStdDev && simulated) {
      stdDevUpper = simulated.map((v, i) => v != null ? v + (monthlyStdDev[i] || 0) : null);
      stdDevLower = simulated.map((v, i) => v != null ? v - (monthlyStdDev[i] || 0) : null);
    }
    const extraValues = [
      ...(stdDevUpper || []),
      ...(stdDevLower || []),
    ].filter(v => v != null && !isNaN(v));
    fixedDomainRef.current = calculateFixedDomain(
      baseline, simulated, delivered, actuals, cannibalizationResult,
      extraValues
    );
  }

  const yAxisDomain = fixedDomainRef.current || [0, 100];

  const focusMonthName = focusMonth !== null ? MONTHS[focusMonth] : null;

  const hasCannibSource = cannibalizationResult?.source?.adjusted_baseline?.some(v => v != null) ?? false;
  const hasCannibTarget = cannibalizationResult?.target?.adjusted_baseline?.some(v => v != null) ?? false;
  const hasCannibSourceBase = cannibalizationResult?.source?.original_baseline?.some(v => v != null) ?? false;
  const hasCannibTargetBase = cannibalizationResult?.target?.original_baseline?.some(v => v != null) ?? false;
  const hasCannib = hasCannibSource || hasCannibTarget;

  const isCurrentProductInvolved = hasCannib && cannibalizationResult && (
    product === cannibalizationResult.sourceProduct ||
    product === cannibalizationResult.targetProduct
  );

  const chartData = useMemo(() => {
    return MONTHS.map((month, index) => {
      const data = { month, monthIndex: index };
      if (baseline?.[index] != null && !isNaN(baseline[index])) data.baseline = baseline[index];
      if (simulated?.[index] != null && !isNaN(simulated[index])) data.simulated = simulated[index];
      if (delivered?.[index] != null && !isNaN(delivered[index])) data.delivered = delivered[index];
      if (actuals?.[index] != null && !isNaN(actuals[index])) data.actuals = actuals[index];
      if (cannibalizationResult?.source?.adjusted_baseline?.[index] != null) {
        data.cannibSource = cannibalizationResult.source.adjusted_baseline[index];
      }
      if (cannibalizationResult?.target?.adjusted_baseline?.[index] != null) {
        data.cannibTarget = cannibalizationResult.target.adjusted_baseline[index];
      }
      if (cannibalizationResult?.source?.original_baseline?.[index] != null) {
        data.cannibSourceBase = cannibalizationResult.source.original_baseline[index];
      }
      if (cannibalizationResult?.target?.original_baseline?.[index] != null) {
        data.cannibTargetBase = cannibalizationResult.target.original_baseline[index];
      }
      // Add std dev bounds centered on the simulated value
      if (showStdDev && monthlyStdDev?.[index] > 0 && data.simulated != null) {
        const sd = monthlyStdDev[index];
        data.stdDevUpper = data.simulated + sd;
        data.stdDevLower = data.simulated - sd;
      }
      data.appliedEffects = appliedDetails[month] || [];
      return data;
    });
  }, [baseline, simulated, delivered, actuals, appliedDetails, cannibalizationResult, showStdDev, monthlyStdDev]);

  const reorderedData = useMemo(() => {
    if (focusMonth === null || focusMonth === undefined) {
      return chartData;
    }
    // Show 4 months before focus and 2 months after (7 total)
    const result = [];
    const selectedYearNum = Number(year);
    for (let offset = -4; offset <= 2; offset++) {
      const monthIdx = (focusMonth + offset + 12) % 12;
      const source = chartData[monthIdx];
      // Determine the year for this month (wraps across year boundary)
      let monthYear = selectedYearNum;
      if (focusMonth + offset < 0) monthYear = selectedYearNum - 1;
      else if (focusMonth + offset > 11) monthYear = selectedYearNum + 1;
      const shortYear = String(monthYear).slice(-2);
      result.push({ ...source, month: `${MONTHS[monthIdx]}-${shortYear}` });
    }
    return result;
  }, [chartData, focusMonth, year]);

  const validData = useMemo(() => {
    return reorderedData.filter(d => {
      const hasValue = v => v !== undefined && v !== null && v !== 0;
      return hasValue(d.baseline) || hasValue(d.simulated) ||
        hasValue(d.delivered) || hasValue(d.actuals) ||
        hasValue(d.cannibSource) || hasValue(d.cannibTarget) ||
        hasValue(d.cannibSourceBase) || hasValue(d.cannibTargetBase);
    });
  }, [reorderedData]);

  const title = apsClass ? `${product} - ${apsClass} | Year: ${year}` : `${product} | Year: ${year}`;

  const tickFormatter = useCallback((value) => formatNumber(value, 0), []);

  const exceededDataPoints = useMemo(() => {
    return exceededMonths
      .map(exceeded => {
        const dataPoint = validData.find(d => d.month === exceeded.month || d.month.startsWith(exceeded.month));
        if (!dataPoint?.simulated) return null;
        return { month: dataPoint.month, value: dataPoint.simulated };
      })
      .filter(Boolean);
  }, [exceededMonths, validData]);

  const focusMonthDataPoint = useMemo(() => {
    if (!focusMonthName || focusMonth === null) return null;
    // When focus is active, month labels include year suffix (e.g., "Apr-26")
    const matchLabel = validData.find(d => d.month.startsWith(focusMonthName));
    if (!matchLabel?.simulated) return null;
    return { month: matchLabel.month, value: matchLabel.simulated };
  }, [focusMonthName, focusMonth, validData]);

  const formattedDataDate = formatDataDate(dataDate);

  const chartHeight = height || 420;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: chartHeight }}>
      <div className="h-10 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {formattedDataDate && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-daikin-blue/10 border border-daikin-blue/20 text-daikin-blue text-xs font-medium">
            <Calendar className="w-3 h-3" />
            <span>Data updated: {formattedDataDate}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2" data-tutorial="chart-toggles">
          {!hasCannib && (
            <>
              <LineToggle
                label="Baseline"
                color={CHART_COLORS.baseline}
                isActive={showBaseline}
                onChange={onToggleBaseline}
                disabled={!hasBaseline}
              />
              <LineToggle
                label="Delivered"
                color={CHART_COLORS.delivered}
                isActive={showDelivered}
                onChange={onToggleDelivered}
                disabled={!hasDelivered}
                dashed
              />
              <LineToggle
                label="Actuals"
                color={CHART_COLORS.actuals}
                isActive={showActuals}
                onChange={onToggleActuals}
                disabled={!hasActuals}
                dashed
              />
            </>
          )}
          {hasCannib && (
            <>
              <div className="w-px h-5 bg-surface-200 mx-1" />
              {hasCannibSourceBase && (
                <LineToggle
                  label={`${cannibalizationResult?.sourceLabel || 'Source'} Base`}
                  color={CHART_COLORS.cannibSourceBase}
                  isActive={showCannibSource}
                  onChange={setShowCannibSource}
                  disabled={!hasCannibSourceBase}
                />
              )}
              <LineToggle
                label={`${cannibalizationResult?.sourceLabel || 'Source'} Adj.`}
                color={CHART_COLORS.cannibSource}
                isActive={showCannibSource}
                onChange={setShowCannibSource}
                disabled={!hasCannibSource}
                dashed
              />
              {hasCannibTargetBase && (
                <LineToggle
                  label={`${cannibalizationResult?.targetLabel || 'Target'} Base`}
                  color={CHART_COLORS.cannibTargetBase}
                  isActive={showCannibTarget}
                  onChange={setShowCannibTarget}
                  disabled={!hasCannibTargetBase}
                />
              )}
              <LineToggle
                label={`${cannibalizationResult?.targetLabel || 'Target'} Adj.`}
                color={CHART_COLORS.cannibTarget}
                isActive={showCannibTarget}
                onChange={setShowCannibTarget}
                disabled={!hasCannibTarget}
                dashed
              />
            </>
          )}

          {analysisMonth !== null && analysisYear !== null && onFocusToggle && (
            <>
              <div className="w-0.5 h-5 bg-sky-400 mx-1" />
              <button
                onClick={() => {
                  const isActive = focusMonth === analysisMonth;
                  if (isActive) {
                    onFocusToggle(null);
                  } else {
                    if (setSelectedYear && availableYears?.length > 0) {
                      const yearMatch = availableYears.find(y => Number(y) === Number(analysisYear));
                      if (yearMatch !== undefined && Number(year) !== Number(analysisYear)) {
                        setSelectedYear(yearMatch);
                      }
                    }
                    onFocusToggle(analysisMonth);
                  }
                }}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all
                  ${focusMonth === analysisMonth
                    ? 'bg-daikin-blue text-white shadow-sm'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                  }
                `}
              >
                <Crosshair className="w-3.5 h-3.5" />
                {focusMonth === analysisMonth
                  ? `${MONTHS[analysisMonth]} ${analysisYear}`
                  : 'Focus T+4'
                }
              </button>
            </>
          )}



          {onReset && hasBaseline && hasSimulated &&
           baseline.some((val, idx) => Math.abs((val || 0) - (simulated[idx] || 0)) > 0.001) && (
            <div className="relative">
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center justify-center w-7 h-7 rounded-md bg-rose-50/80 text-rose-400 hover:bg-rose-100/80 hover:text-rose-500 transition-all border border-rose-200/50"
                title="Reset all simulations"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </motion.button>

              <AnimatePresence>
                {showResetConfirm && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute top-full right-0 mt-2 p-3 bg-rose-50 backdrop-blur-2xl rounded-xl border border-rose-100/50 shadow-lg z-50 w-56"
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-rose-50/80 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-surface-600">Reset all simulations?</p>
                        <p className="text-[9px] text-surface-400 mt-0.5">This will clear all scenario settings.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1 px-2.5 py-1.5 text-[10px] font-semibold rounded-md bg-surface-100/60 text-surface-500 hover:bg-surface-200/80 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onReset();
                          setShowResetConfirm(false);
                        }}
                        className="flex-1 px-2.5 py-1.5 text-[10px] font-semibold rounded-md bg-rose-100/80 text-rose-500 hover:bg-rose-200/80 transition-colors"
                      >
                        Yes, Reset
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={validData}
            margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
          >
            <defs>
              <style>
                {`
                  .recharts-line-curve {
                    transition: d 150ms ease-out;
                  }
                  .recharts-line-dots circle {
                    transition: cx 150ms ease-out, cy 150ms ease-out;
                  }
                `}
              </style>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#9eb4e0ff" vertical={false} />

            <XAxis
              dataKey="month"
              tick={{ fill: '#525252', fontSize: 10 }}
              axisLine={{ stroke: '#E5E5E5' }}
              tickLine={{ stroke: '#E5E5E5' }}
            />

            <YAxis
              domain={yAxisDomain}
              tick={{ fill: '#525252', fontSize: 10 }}
              axisLine={{ stroke: '#E5E5E5' }}
              tickLine={{ stroke: '#E5E5E5' }}
              tickFormatter={tickFormatter}
              width={40}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              wrapperStyle={{ paddingTop: 8, fontSize: '11px' }}
              iconType="circle"
              iconSize={6}
            />

            {showStdDev && hasStdDev && hasSimulated && !hasCannib && (
              <>
                <Area
                  type="monotone"
                  dataKey="stdDevUpper"
                  fill={CHART_COLORS.simulated}
                  fillOpacity={0.1}
                  stroke={CHART_COLORS.simulated}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  strokeOpacity={0.35}
                  isAnimationActive={false}
                  legendType="none"
                  dot={false}
                  activeDot={false}
                />
                <Area
                  type="monotone"
                  dataKey="stdDevLower"
                  fill="#ffffff"
                  fillOpacity={1}
                  stroke={CHART_COLORS.simulated}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  strokeOpacity={0.35}
                  isAnimationActive={false}
                  legendType="none"
                  dot={false}
                  activeDot={false}
                />
              </>
            )}

            {!hasCannib && showBaseline && hasBaseline && (
              <Line
                type="monotone"
                dataKey="baseline"
                name="Manufacturer Baseline"
                stroke={CHART_COLORS.baseline}
                strokeWidth={2.5}
                dot={{ r: 4, fill: CHART_COLORS.baseline }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            )}

            {!hasCannib && hasSimulated && (
              <Line
                type="monotone"
                dataKey="simulated"
                name="Simulated"
                stroke={CHART_COLORS.simulated}
                strokeWidth={3}
                dot={{ r: 5, fill: CHART_COLORS.simulated }}
                activeDot={{ r: 7 }}
                isAnimationActive={false}
              />
            )}

            {!hasCannib && showDelivered && hasDelivered && (
              <Line
                type="monotone"
                dataKey="delivered"
                name="Manufacturer Baseline (current delivery)"
                stroke={CHART_COLORS.delivered}
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: CHART_COLORS.delivered }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            )}

            {!hasCannib && showActuals && hasActuals && (
              <Line
                type="monotone"
                dataKey="actuals"
                name="Actuals"
                stroke={CHART_COLORS.actuals}
                strokeWidth={2.5}
                strokeDasharray="8 4"
                dot={{ r: 4, fill: CHART_COLORS.actuals }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            )}

            {showCannibSource && hasCannibSourceBase && (
              <Line
                type="monotone"
                dataKey="cannibSourceBase"
                name={`${cannibalizationResult?.sourceLabel || 'Source'} Baseline`}
                stroke={CHART_COLORS.cannibSourceBase}
                strokeWidth={1.5}
                strokeOpacity={0.6}
                dot={{ r: 2.5, fill: CHART_COLORS.cannibSourceBase }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            )}

            {showCannibSource && hasCannibSource && (
              <Line
                type="monotone"
                dataKey="cannibSource"
                name={`${cannibalizationResult?.sourceLabel || 'Source'} Adjusted`}
                stroke={CHART_COLORS.cannibSource}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, fill: CHART_COLORS.cannibSource }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            )}

            {showCannibTarget && hasCannibTargetBase && (
              <Line
                type="monotone"
                dataKey="cannibTargetBase"
                name={`${cannibalizationResult?.targetLabel || 'Target'} Baseline`}
                stroke={CHART_COLORS.cannibTargetBase}
                strokeWidth={1.5}
                strokeOpacity={0.6}
                dot={{ r: 2.5, fill: CHART_COLORS.cannibTargetBase }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            )}

            {showCannibTarget && hasCannibTarget && (
              <Line
                type="monotone"
                dataKey="cannibTarget"
                name={`${cannibalizationResult?.targetLabel || 'Target'} Adjusted`}
                stroke={CHART_COLORS.cannibTarget}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, fill: CHART_COLORS.cannibTarget }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            )}

            {exceededDataPoints.map((point) => (
              <ReferenceDot
                key={point.month}
                x={point.month}
                y={point.value}
                r={8}
                fill="#FEF3C7"
                stroke="#F59E0B"
                strokeWidth={2}
              />
            ))}

            {focusMonthDataPoint && (
              <ReferenceDot
                x={focusMonthDataPoint.month}
                y={focusMonthDataPoint.value}
                shape={<PulsatingDot />}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="h-10 flex items-center justify-between px-2">
        <div className="flex flex-wrap items-center gap-2">
          {exceededMonths.map((exceeded) => (
            <WarningBadge key={exceeded.month} month={exceeded.month} />
          ))}
        </div>

        {hasStdDev && !hasCannib && onToggleStdDev && (
          <button
            type="button"
            onClick={() => onToggleStdDev(!showStdDev)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
              transition-all duration-200 ease-out cursor-pointer hover:scale-105
              ${showStdDev
                ? 'bg-white shadow-md border border-surface-200'
                : 'bg-surface-100/50 border border-transparent'
              }
            `}
          >
            <div className="relative flex items-center w-5">
              <div
                className="w-5 h-3 rounded-full relative"
                style={{
                  backgroundColor: showStdDev ? `${CHART_COLORS.simulated}20` : '#E5E7EB',
                  border: `1.5px solid ${showStdDev ? CHART_COLORS.simulated : '#9CA3AF'}`,
                }}
              >
                <div
                  className="absolute top-0.5 w-1.5 h-1.5 rounded-full transition-all duration-200"
                  style={{
                    backgroundColor: showStdDev ? CHART_COLORS.simulated : '#9CA3AF',
                    left: showStdDev ? '10px' : '2px',
                  }}
                />
              </div>
            </div>
            <span className={showStdDev ? 'text-daikin-dark' : 'text-surface-400'}>
              Std Dev Bounds
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export default ForecastChart;
