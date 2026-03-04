// RegulationPanel.jsx
import { useState, useRef } from 'react';
import { X, Info } from 'lucide-react';
import { Button, Select, Slider, TooltipPortal } from '../common';
import { useForecast } from '../../contexts/ForecastContext';
import { MONTHS, EVENT_TYPES, MONTH_TO_IDX } from '../../utils/constants';
import { formatPercent } from '../../utils/formatters';

function findWeightColumn(weights, patterns) {
  if (!weights) return null;
  for (const pattern of patterns) {
    for (const col of Object.keys(weights)) {
      if (col.toLowerCase().includes(pattern.toLowerCase())) {
        return col;
      }
    }
  }
  return null;
}

function getBaseMultiplier(weights, columnName, monthIdx) {
  if (!columnName || !weights || !weights[columnName]) {
    return 1.0;
  }
  const value = weights[columnName];
  if (Array.isArray(value)) {
    try {
      const val = parseFloat(value[monthIdx - 1]);
      return isNaN(val) ? 1.0 : val;
    } catch {
      return 1.0;
    }
  }
  try {
    const val = parseFloat(value);
    return isNaN(val) ? 1.0 : val;
  } catch {
    return 1.0;
  }
}

function BaseWeightTooltipContent({ baseWeight, month }) {
  return (
    <div className="glass-strong rounded-lg p-2.5 shadow-xl border border-surface-200/50 whitespace-nowrap bg-white/95">
      <div className="text-xs text-surface-600 flex items-center gap-1">
        <span className="text-surface-400">Base weight ({month}):</span>
        <span className="font-semibold text-daikin-blue">{baseWeight.toFixed(4)}</span>
      </div>
    </div>
  );
}

function MultiplierMathTooltipContent({ baseWeight, adjustPct, finalMultiplier, month, isCapped }) {
  const sliderMultiplier = 1 + (adjustPct || 0) / 100;
  const uncappedResult = baseWeight * sliderMultiplier;

  return (
    <div className="glass-strong rounded-lg p-3 shadow-xl border border-surface-200/50 whitespace-nowrap bg-white/95">
      <div className="text-[10px] uppercase tracking-wider text-surface-400 mb-2">
        Multiplier Calculation
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-surface-500">Base weight ({month})</span>
          <span className="font-medium text-daikin-dark">{baseWeight.toFixed(4)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-surface-500">Adjustment ({adjustPct > 0 ? '+' : ''}{adjustPct}%)</span>
          <span className="font-medium text-daikin-dark">× {sliderMultiplier.toFixed(2)}</span>
        </div>
        <div className="border-t border-surface-200/50 pt-1.5 flex items-center justify-between gap-4">
          <span className="text-surface-500">Result</span>
          <span className="font-medium text-surface-600">{uncappedResult.toFixed(4)}</span>
        </div>
        {isCapped && (
          <div className="flex items-center justify-between gap-4 text-amber-600">
            <span>Capped at 1.0</span>
            <span className="font-medium">→ {formatPercent((finalMultiplier - 1) * 100, 1, true)}</span>
          </div>
        )}
        {!isCapped && (
          <div className="flex items-center justify-between gap-4 text-daikin-blue">
            <span className="font-medium">Final</span>
            <span className="font-semibold">{formatPercent((finalMultiplier - 1) * 100, 1, true)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LockedEventItem({ event, onRemove }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const infoRef = useRef(null);

  const baseWeight = event.baseWeight || 1.0;
  const sliderMultiplier = 1 + (event.pct || 0) / 100;
  const uncappedResult = baseWeight * sliderMultiplier;
  const isCapped = uncappedResult > 1.0 && event.multiplier === 1.0;
  const isNegative = event.multiplier < 1;

  return (
    <div className="group inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-daikin-blue/5 to-daikin-blue/10 border border-daikin-blue/20 hover:border-daikin-blue/30 transition-all duration-200">
      <span className="text-[11px] font-semibold text-daikin-dark tracking-tight">{event.month}</span>
      <span className={`text-[11px] font-bold tabular-nums ${isNegative ? 'text-amber-600' : 'text-emerald-600'}`}>
        {formatPercent((event.multiplier - 1) * 100, 1, true)}
      </span>
      <div
        ref={infoRef}
        className="flex items-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Info className="h-3 w-3 text-daikin-blue/40 hover:text-daikin-blue cursor-help transition-colors" />
        <TooltipPortal anchorRef={infoRef} isVisible={showTooltip}>
          <MultiplierMathTooltipContent
            baseWeight={event.baseWeight || 1.0}
            adjustPct={event.pct || 0}
            finalMultiplier={event.multiplier}
            month={event.month}
            isCapped={isCapped}
          />
        </TooltipPortal>
      </div>
      <button
        onClick={onRemove}
        className="ml-0.5 p-0.5 rounded-full text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-60 group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function RegulationPanel({
  weights,
  settings,
  lockedEvents,
  onChange,
  onInfoClick,
}) {
  const { addLockedEvent, removeLockedEvent } = useForecast();
  const [showMultiplierMathTooltip, setShowMultiplierMathTooltip] = useState(false);
  const [showMonthBaseWeightTooltip, setShowMonthBaseWeightTooltip] = useState(false);

  const multiplierInfoRef = useRef(null);
  const baseWeightInfoRef = useRef(null);

  const lockedMonths = lockedEvents.map(e => e.month);
  const availableMonths = MONTHS.filter(m => !lockedMonths.includes(m));
  const canAddMore = lockedEvents.length < 3;

  const regulationCol = findWeightColumn(weights, ['regulation', 'epa']);

  const getBaseWeightForMonth = (month) => {
    if (!month) return 1.0;
    const monthIdx = MONTH_TO_IDX[month];
    return getBaseMultiplier(weights, regulationCol, monthIdx);
  };

  const currentBaseWeight = getBaseWeightForMonth(settings.month);

  const calculateFinalMultiplier = (month, pct) => {
    const baseWeight = getBaseWeightForMonth(month);
    const sliderAdjustment = 1 + (pct || 0) / 100;
    const multiplier = baseWeight * sliderAdjustment;
    return Math.min(multiplier, 1.0);
  };

  const previewMultiplier = settings.month
    ? calculateFinalMultiplier(settings.month, settings.pct)
    : null;

  const uncappedResult = settings.month
    ? currentBaseWeight * (1 + (settings.pct || 0) / 100)
    : null;
  const isCapped = uncappedResult > 1.0 && previewMultiplier === 1.0;

  const handleLockEvent = () => {
    if (!settings.month) return;

    const baseWeight = getBaseWeightForMonth(settings.month);
    const finalMultiplier = calculateFinalMultiplier(settings.month, settings.pct);

    addLockedEvent(EVENT_TYPES.REGULATION, {
      month: settings.month,
      pct: settings.pct,
      baseWeight: baseWeight,
      multiplier: finalMultiplier,
    });

    onChange({ ...settings, month: null, pct: 0 });
  };

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-daikin-dark">
          Regulation Event
        </h3>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onInfoClick}
          className="text-daikin-blue"
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select
              label="Month"
              value={settings.month}
              onChange={(value) => onChange({ ...settings, month: value })}
              options={[
                { value: null, label: 'None' },
                ...availableMonths.map(m => ({ value: m, label: m })),
              ]}
              disabled={!canAddMore}
            />
          </div>
          {settings.month && (
            <div
              ref={baseWeightInfoRef}
              className="relative mb-2"
              onMouseEnter={() => setShowMonthBaseWeightTooltip(true)}
              onMouseLeave={() => setShowMonthBaseWeightTooltip(false)}
            >
              <Info className="h-4 w-4 text-daikin-blue/50 hover:text-daikin-blue cursor-help transition-colors" />
              <TooltipPortal anchorRef={baseWeightInfoRef} isVisible={showMonthBaseWeightTooltip}>
                <BaseWeightTooltipContent
                  baseWeight={currentBaseWeight}
                  month={settings.month}
                />
              </TooltipPortal>
            </div>
          )}
        </div>
      </div>

      {settings.month && (
        <>
          <Slider
            label="Impact Adjust"
            value={settings.pct || 0}
            onChange={(value) => onChange({ ...settings, pct: value })}
            min={-50}
            max={50}
            step={5}
            formatValue={(v) => `${v > 0 ? '+' : ''}${v}%`}
          />

          <div className="relative text-xs text-center glass-subtle p-2.5 rounded-lg border border-daikin-blue/20 bg-daikin-light/10">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-surface-600">Final multiplier:</span>
              <span className="font-semibold text-daikin-blue">{previewMultiplier.toFixed(4)}</span>
              <span className="text-daikin-blue/70">
                ({formatPercent((previewMultiplier - 1) * 100, 1, true)})
              </span>
              <div
                ref={multiplierInfoRef}
                className="relative inline-flex"
                onMouseEnter={() => setShowMultiplierMathTooltip(true)}
                onMouseLeave={() => setShowMultiplierMathTooltip(false)}
              >
                <Info className="h-3.5 w-3.5 text-daikin-blue/50 hover:text-daikin-blue cursor-help transition-colors" />
                <TooltipPortal anchorRef={multiplierInfoRef} isVisible={showMultiplierMathTooltip}>
                  <MultiplierMathTooltipContent
                    baseWeight={currentBaseWeight}
                    adjustPct={settings.pct || 0}
                    finalMultiplier={previewMultiplier}
                    month={settings.month}
                    isCapped={isCapped}
                  />
                </TooltipPortal>
              </div>
            </div>
            {isCapped && (
              <div className="text-amber-600 mt-1">Capped at 1.0 (no increase)</div>
            )}
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleLockEvent}
            className="w-full"
          >
            Lock in {settings.month} Regulation
          </Button>
        </>
      )}

      {lockedEvents.length > 0 && (
        <div className="pt-3 border-t border-surface-200/50 relative">
          <p className="text-[10px] font-medium text-surface-400 uppercase tracking-wider mb-2">Locked</p>
          <div className="flex flex-wrap gap-1.5">
            {lockedEvents.map((event) => (
              <LockedEventItem
                key={event.month}
                event={event}
                onRemove={() => removeLockedEvent(EVENT_TYPES.REGULATION, event.month)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RegulationPanel;
