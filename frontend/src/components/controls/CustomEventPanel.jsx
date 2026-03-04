// CustomEventPanel.jsx
import { useState, useRef } from 'react';
import { X, Info } from 'lucide-react';
import { Button, Select, Slider, NumberInput, TooltipPortal } from '../common';
import { useForecast } from '../../contexts/ForecastContext';
import { MONTHS, EVENT_TYPES } from '../../utils/constants';
import { formatPercent } from '../../utils/formatters';

function MultiplierMathTooltipContent({ baseWeight, adjustPct, finalMultiplier, month }) {
  const sliderMultiplier = 1 + (adjustPct || 0) / 100;

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
        <div className="border-t border-surface-200/50 pt-1.5 flex items-center justify-between gap-4 text-daikin-blue">
          <span className="font-medium">Final</span>
          <span className="font-semibold">{formatPercent((finalMultiplier - 1) * 100, 1, true)}</span>
        </div>
      </div>
    </div>
  );
}

function LockedEventItem({ event, onRemove }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const infoRef = useRef(null);
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
            baseWeight={event.baseWeight || event.weight || 1.0}
            adjustPct={event.pct || 0}
            finalMultiplier={event.multiplier}
            month={event.month}
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

function CustomEventPanel({
  settings,
  lockedEvents,
  onChange,
  onInfoClick,
}) {
  const { addLockedEvent, removeLockedEvent } = useForecast();
  const [showMultiplierMathTooltip, setShowMultiplierMathTooltip] = useState(false);
  const multiplierInfoRef = useRef(null);

  const lockedMonths = lockedEvents.map(e => e.month);
  const availableMonths = MONTHS.filter(m => !lockedMonths.includes(m));
  const canAddMore = lockedEvents.length < 3;

  const handleLockEvent = () => {
    if (!settings.month) return;

    const baseWeight = settings.weight || 1.0;
    const pct = settings.pct || 0;
    const multiplier = baseWeight * (1 + pct / 100);

    addLockedEvent(EVENT_TYPES.CUSTOM, {
      month: settings.month,
      weight: baseWeight,
      pct,
      baseWeight: baseWeight,
      multiplier,
    });

    onChange({ ...settings, month: null, weight: 1.0, pct: 0 });
  };

  const currentBaseWeight = settings.weight || 1.0;
  const currentMultiplier = currentBaseWeight * (1 + (settings.pct || 0) / 100);

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-daikin-dark">
          Custom Event
        </h3>
        {onInfoClick && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onInfoClick}
            className="text-daikin-blue"
          >
            <Info className="h-4 w-4" />
          </Button>
        )}
      </div>

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

      {settings.month && (
        <>
          <NumberInput
            label="Base Weight"
            value={settings.weight || 1.0}
            onChange={(value) => onChange({ ...settings, weight: value })}
            min={0.4}
            max={1.6}
            step={0.01}
          />

          <Slider
            label="Adjust"
            value={settings.pct || 0}
            onChange={(value) => onChange({ ...settings, pct: value })}
            min={-40}
            max={60}
            step={5}
            formatValue={(v) => `${v > 0 ? '+' : ''}${v}%`}
          />

          <div className="relative text-xs text-center glass-subtle p-2.5 rounded-lg border border-daikin-blue/20 bg-daikin-light/10">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-surface-600">Final multiplier:</span>
              <span className="font-semibold text-daikin-blue">{currentMultiplier.toFixed(4)}</span>
              <span className="text-daikin-blue/70">
                ({formatPercent((currentMultiplier - 1) * 100, 1, true)})
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
                    finalMultiplier={currentMultiplier}
                    month={settings.month}
                  />
                </TooltipPortal>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleLockEvent}
            className="w-full"
          >
            Lock in {settings.month} Custom
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
                onRemove={() => removeLockedEvent(EVENT_TYPES.CUSTOM, event.month)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomEventPanel;
