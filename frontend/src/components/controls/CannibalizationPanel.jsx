/**
 * Cannibalization Panel - Models intra-product APS class cannibalization.
 *
 * Two modes:
 * - Naive: User controls start, duration, rate via sliders
 * - Intelligent: System derives parameters from market share data
 *
 * All numbers trace back to real data with explicit justification.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Info, AlertTriangle, CheckCircle, Activity, ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Select, Slider } from '../common';
import { MONTHS } from '../../utils/constants';
import { formatNumber } from '../../utils/formatters';
import betaApi from '../../services/betaApi';


// Source/target presets for quick selection
const CANNIB_PRESETS = [
  {
    label: 'FN-80 -> HP-1PH',
    sourceProduct: 'FN',
    sourceApsClasses: ['FN_80_MULTI', 'FN_80_VAR'],
    sourceLabel: 'FN-80 (Multi + Var)',
    targetProduct: 'HP',
    targetApsClass: 'HP_1PH',
    targetLabel: 'HP-1PH',
  },
];


function DataQualityBadge({ quality }) {
  const config = {
    good: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle, label: 'Good' },
    moderate: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle, label: 'Moderate' },
    limited: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: AlertTriangle, label: 'Limited' },
    insufficient: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertTriangle, label: 'Low' },
  };
  const cfg = config[quality] || config.limited;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}


function ImpactSummary({ result }) {
  if (!result || result.error) return null;

  const srcLoss = result.source?.annual_loss || 0;
  const srcPct = result.source?.annual_loss_pct || 0;
  const tgtGain = result.target?.annual_gain || 0;
  const tgtPct = result.target?.annual_gain_pct || 0;

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="p-2 bg-red-50/60 rounded-lg border border-red-100">
        <p className="text-[9px] uppercase text-red-400 font-medium">Source Loss</p>
        <p className="text-sm font-bold text-red-600">-{formatNumber(srcLoss)}</p>
        <p className="text-[10px] text-red-500">-{srcPct}% annual</p>
      </div>
      <div className="p-2 bg-emerald-50/60 rounded-lg border border-emerald-100">
        <p className="text-[9px] uppercase text-emerald-400 font-medium">Target Gain</p>
        <p className="text-sm font-bold text-emerald-600">+{formatNumber(tgtGain)}</p>
        <p className="text-[10px] text-emerald-500">+{tgtPct}% annual</p>
      </div>
    </div>
  );
}


function JustificationTooltip({ anchorRect, result, analysis, onMouseEnter, onMouseLeave }) {
  const tooltipRef = useRef(null);
  const [position, setPosition] = useState(null);
  const j = result.justification;

  useEffect(() => {
    if (!anchorRect || !tooltipRef.current) return;
    const updatePosition = () => {
      const tooltipEl = tooltipRef.current;
      if (!tooltipEl) return;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 14;
      const maxWidth = Math.min(300, viewportWidth - padding * 2);
      const tooltipRect = tooltipEl.getBoundingClientRect();
      const tooltipWidth = Math.min(tooltipRect.width || maxWidth, maxWidth);
      const naturalHeight = tooltipEl.scrollHeight || tooltipRect.height || 360;

      const spaceBelow = viewportHeight - anchorRect.bottom - padding;
      const spaceAbove = anchorRect.top - padding;
      const placeBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;
      const availableSpace = Math.max(160, placeBelow ? spaceBelow : spaceAbove);
      const maxHeight = Math.min(520, availableSpace);

      let left = anchorRect.left + (anchorRect.width / 2) - (tooltipWidth / 2);
      if (anchorRect.right > viewportWidth - 260) {
        left = anchorRect.right - tooltipWidth;
      }
      if (left < padding) left = padding;
      if (left + tooltipWidth > viewportWidth - padding) {
        left = viewportWidth - tooltipWidth - padding;
      }

      let top = placeBelow ? anchorRect.bottom + 10 : anchorRect.top - Math.min(naturalHeight, maxHeight) - 10;
      if (top + maxHeight > viewportHeight - padding) top = viewportHeight - maxHeight - padding;
      if (top < padding) top = padding;

      setPosition({ top, left, width: tooltipWidth, maxHeight });
    };

    const raf = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(raf);
  }, [anchorRect]);

  return createPortal(
    <motion.div
      ref={tooltipRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      className="fixed z-[9999] w-[300px] max-w-[calc(100vw-28px)] bg-white/92 backdrop-blur-2xl rounded-2xl border border-white/80 overflow-x-hidden overflow-y-auto"
      style={{
        top: position ? `${position.top}px` : '-9999px',
        left: position ? `${position.left}px` : '-9999px',
        width: position?.width ? `${position.width}px` : undefined,
        maxHeight: position?.maxHeight ? `${position.maxHeight}px` : undefined,
        overscrollBehavior: 'contain',
        visibility: position ? 'visible' : 'hidden',
        boxShadow: '0 16px 40px rgba(15,23,42,0.14)'
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-white/60 border-b border-white/60">
        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-sky-500">Methodology</div>
      </div>

      <div className="p-4 space-y-3">
        {/* Method & Derivation */}
        <div className="pb-2 border-b border-surface-200/60 space-y-1.5">
          {j.method && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-surface-500">Method</span>
              <span className="font-semibold text-surface-700">{j.method.replace(/_/g, ' ')}</span>
            </div>
          )}
          {j.transfer_ratio_source && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-surface-500">Transfer Ratio</span>
              <span className="font-semibold text-surface-700">{j.transfer_ratio_source}</span>
            </div>
          )}
          {j.confidence_range && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-surface-500">Confidence Range</span>
              <span className="font-semibold text-surface-700">{j.confidence_range}</span>
            </div>
          )}
        </div>

        {/* Derivation description */}
        {j.method_description && (
          <div className="pb-2 border-b border-surface-200/60">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-surface-400 mb-2">
              Derivation
            </div>
            <p className="text-[11px] text-surface-600 leading-relaxed">{j.method_description}</p>
          </div>
        )}

        {/* Correlated periods */}
        {analysis?.correlation?.correlated_periods?.length > 0 && (
          <div className="pb-2 border-b border-surface-200/60">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-surface-400 mb-2">
              Correlated Periods
            </div>
            <div className="flex flex-wrap gap-1">
              {analysis.correlation.correlated_periods.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-daikin-blue/10">
                  <span className="text-[9px] font-mono font-bold text-daikin-blue">{p.period}</span>
                  <span className="text-[9px] font-mono text-red-500">{p.source_change_pct}%</span>
                  <ArrowRight className="h-2.5 w-2.5 text-surface-300" />
                  <span className="text-[9px] font-mono text-emerald-500">+{p.target_change_pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assumptions */}
        {j.assumptions?.length > 0 && (
          <div className="pb-2 border-b border-surface-200/60">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-surface-400 mb-2">
              Assumptions
            </div>
            <div className="space-y-1">
              {j.assumptions.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-surface-300 mt-1.5 flex-shrink-0" />
                  <span className="text-surface-600">{a}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data quality factors */}
        {analysis?.data_quality?.factors?.length > 0 && (
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-surface-400 mb-2">
              Data Backing
            </div>
            <div className="space-y-1">
              {analysis.data_quality.factors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                  <span className="text-surface-600">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>,
    document.body
  );
}


function JustificationSection({ result, analysis }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const infoRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const isHoveringTooltipRef = useRef(false);

  const handleMouseEnterInfo = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (infoRef.current) setAnchorRect(infoRef.current.getBoundingClientRect());
    setShowTooltip(true);
  }, []);

  const handleMouseLeaveInfo = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isHoveringTooltipRef.current) { setShowTooltip(false); setAnchorRect(null); }
    }, 150);
  }, []);

  const handleMouseEnterTooltip = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    isHoveringTooltipRef.current = true;
  }, []);

  const handleMouseLeaveTooltip = useCallback(() => {
    isHoveringTooltipRef.current = false;
    hoverTimeoutRef.current = setTimeout(() => { setShowTooltip(false); setAnchorRect(null); }, 150);
  }, []);

  useEffect(() => { return () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }; }, []);

  if (!result?.justification) return null;

  return (
    <div className="mt-3 border-t border-surface-200/50 pt-3 flex items-center gap-1.5">
      <button
        ref={infoRef}
        onMouseEnter={handleMouseEnterInfo}
        onMouseLeave={handleMouseLeaveInfo}
        className="p-1.5 rounded-lg border border-surface-200 text-surface-400 hover:text-sky-500 hover:border-sky-200 hover:bg-sky-50/50 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <span className="text-[10px] text-surface-400">Methodology</span>

      <AnimatePresence>
        {showTooltip && anchorRect && (
          <JustificationTooltip
            anchorRect={anchorRect}
            result={result}
            analysis={analysis}
            onMouseEnter={handleMouseEnterTooltip}
            onMouseLeave={handleMouseLeaveTooltip}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


function CannibalizationPanel({ selectedYear, onResult }) {
  const [mode, setMode] = useState('naive');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  // Naive mode params
  const [startMonth, setStartMonth] = useState(0);
  const [duration, setDuration] = useState(6);
  const [peakRate, setPeakRate] = useState(5);
  const [rampShape, setRampShape] = useState('linear');

  // Intelligent mode params
  const [intelligentStart, setIntelligentStart] = useState(0);

  const simulateTimeoutRef = useRef(null);
  const preset = CANNIB_PRESETS[selectedPreset];

  // Load analysis when preset or year changes
  useEffect(() => {
    const loadAnalysis = async () => {
      setLoading(true);
      try {
        const resp = await betaApi.analyzeCannibalization({
          sourceProduct: preset.sourceProduct,
          sourceApsClasses: preset.sourceApsClasses,
          targetProduct: preset.targetProduct,
          targetApsClass: preset.targetApsClass,
          selectedYear: selectedYear,
        });
        if (resp.success) {
          setAnalysis(resp);

          // Update slider bounds from analysis
          if (resp.slider_bounds?.peak_rate_recommended) {
            setPeakRate(Math.min(resp.slider_bounds.peak_rate_recommended, 15));
          }
        }
      } catch (err) {
        console.error('Cannibalization analysis failed:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, [selectedPreset, selectedYear, preset.sourceProduct, preset.sourceApsClasses, preset.targetProduct, preset.targetApsClass]);

  // Run simulation (debounced)
  const runSimulation = useCallback(async () => {
    if (!analysis) return;

    const simParams = mode === 'naive'
      ? { start_month: startMonth, duration, peak_rate: peakRate, ramp_shape: rampShape }
      : { expected_start_month: intelligentStart };

    try {
      const resp = await betaApi.simulateCannibalization({
        sourceProduct: preset.sourceProduct,
        sourceApsClasses: preset.sourceApsClasses,
        targetProduct: preset.targetProduct,
        targetApsClass: preset.targetApsClass,
        selectedYear: selectedYear,
        mode,
        simulationParams: simParams,
      });
      if (resp.success) {
        setResult(resp);
        if (onResult) onResult({
          ...resp,
          sourceLabel: preset.sourceLabel,
          targetLabel: preset.targetLabel,
          sourceProduct: preset.sourceProduct,
          targetProduct: preset.targetProduct,
          transferRatio: analysis?.transfer_ratios?.annual,
          sourceAnnualTotal: analysis?.source?.annual_total,
          targetAnnualTotal: analysis?.target?.annual_total,
          dataQuality: analysis?.data_quality?.quality,
        });
      }
    } catch (err) {
      console.error('Cannibalization simulation failed:', err);
    }
  }, [analysis, mode, startMonth, duration, peakRate, rampShape, intelligentStart, preset, selectedYear, onResult]);

  useEffect(() => {
    if (simulateTimeoutRef.current) clearTimeout(simulateTimeoutRef.current);
    simulateTimeoutRef.current = setTimeout(runSimulation, 250);
    return () => { if (simulateTimeoutRef.current) clearTimeout(simulateTimeoutRef.current); };
  }, [runSimulation]);

  const monthOptions = MONTHS.map((m, i) => ({ value: i, label: m }));

  const intelligentAvailable = analysis?.intelligent_defaults?.available;
  const dataQuality = analysis?.data_quality?.quality;

  return (
    <div className="space-y-3">
      {/* Header with quality badge */}
      <div className="flex items-center justify-between">
        <span className="text-m font-semibold text-daikin-dark">Cannibalization Scenario</span>
        <div className="flex items-center gap-1">
          {dataQuality && <DataQualityBadge quality={dataQuality} />}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowMetadata(!showMetadata)}
            className={showMetadata ? 'text-daikin-blue' : 'text-surface-400'}
          >
            <Activity className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <>
          {/* Source / Target display */}
          <div className="flex items-center gap-2 p-2 bg-surface-50/50 rounded-lg">
            <div className="flex-1 text-center">
              <p className="text-[9px] uppercase text-red-400 font-medium">Source (loses)</p>
              <p className="text-[11px] font-semibold text-daikin-dark">{preset.sourceLabel}</p>
              {analysis && (
                <p className="text-[9px] text-surface-400">{formatNumber(analysis.source?.annual_total)} /yr</p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-surface-300 flex-shrink-0" />
            <div className="flex-1 text-center">
              <p className="text-[9px] uppercase text-emerald-400 font-medium">Target (gains)</p>
              <p className="text-[11px] font-semibold text-daikin-dark">{preset.targetLabel}</p>
              {analysis && (
                <p className="text-[9px] text-surface-400">{formatNumber(analysis.target?.annual_total)} /yr</p>
              )}
            </div>
          </div>

          {/* Transfer ratio display */}
          {analysis?.transfer_ratios && (
            <div className="p-2 bg-surface-50/50 rounded-lg">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-surface-400">Transfer Ratio (annual):</span>
                <span className="font-semibold text-surface-700">
                  {(analysis.transfer_ratios.annual * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-[9px] text-surface-400 mt-0.5">
                Of lost source units, {(analysis.transfer_ratios.annual * 100).toFixed(1)}% become target units
              </p>
              <p className="text-[9px] text-surface-300 italic">
                Source: baseline volume ratio
              </p>
            </div>
          )}

          {/* Mode selector */}
          <div className="flex gap-1">
            <button
              onClick={() => setMode('naive')}
              className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                mode === 'naive'
                  ? 'bg-daikin-blue/10 text-daikin-blue border border-daikin-blue/30'
                  : 'bg-surface-50 text-surface-500 border border-surface-200/50 hover:border-surface-300'
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => intelligentAvailable && setMode('intelligent')}
              disabled={!intelligentAvailable}
              className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                mode === 'intelligent'
                  ? 'bg-daikin-blue/10 text-daikin-blue border border-daikin-blue/30'
                  : intelligentAvailable
                    ? 'bg-surface-50 text-surface-500 border border-surface-200/50 hover:border-surface-300'
                    : 'bg-surface-50 text-surface-300 border border-surface-100 cursor-not-allowed'
              }`}
            >
              Intelligent
            </button>
          </div>

          {!intelligentAvailable && mode !== 'intelligent' && (
            <p className="text-[9px] text-amber-500">
              <AlertTriangle className="h-3 w-3 inline mr-0.5" />
              Intelligent mode needs market share data for at least the source product.
            </p>
          )}

          {/* Naive mode controls */}
          {mode === 'naive' && (
            <div className="space-y-3">
              <Select
                label="Start Month"
                value={startMonth}
                onChange={(val) => setStartMonth(Number(val))}
                options={monthOptions}
              />

              <Slider
                label="Ramp Duration"
                value={duration}
                min={1}
                max={12}
                step={1}
                onChange={setDuration}
                formatValue={(v) => `${v} mo`}
              />

              <Slider
                label="Peak Rate"
                value={peakRate}
                min={0}
                max={analysis?.slider_bounds?.peak_rate_max || 30}
                step={0.5}
                onChange={setPeakRate}
                formatValue={(v) => `${v}%`}
              />

              {analysis?.slider_bounds?.peak_rate_historical_max != null && (
                <p className="text-[9px] text-surface-400">
                  Historical max decline: {analysis.slider_bounds.peak_rate_historical_max}%
                  {peakRate > analysis.slider_bounds.peak_rate_historical_max && (
                    <span className="text-amber-500 ml-1">(exceeds historical)</span>
                  )}
                </p>
              )}

              <div className="flex gap-1">
                <button
                  onClick={() => setRampShape('linear')}
                  className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                    rampShape === 'linear'
                      ? 'bg-surface-200 text-surface-700'
                      : 'bg-surface-50 text-surface-400 hover:bg-surface-100'
                  }`}
                >
                  Linear Ramp
                </button>
                <button
                  onClick={() => setRampShape('logistic')}
                  className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                    rampShape === 'logistic'
                      ? 'bg-surface-200 text-surface-700'
                      : 'bg-surface-50 text-surface-400 hover:bg-surface-100'
                  }`}
                >
                  S-Curve
                </button>
              </div>
            </div>
          )}

          {/* Intelligent mode controls */}
          {mode === 'intelligent' && intelligentAvailable && (
            <div className="space-y-3">
              <Select
                label="Expected Start"
                value={intelligentStart}
                onChange={(val) => setIntelligentStart(Number(val))}
                options={monthOptions}
              />

              {/* Derived parameters (read-only) */}
              <div className="p-2.5 bg-surface-50/50 rounded-lg space-y-1.5">
                <p className="text-[9px] uppercase text-surface-400 font-medium tracking-wider">Data-Derived Parameters</p>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-surface-500">Annual Rate:</span>
                  <span className="font-semibold text-daikin-dark">
                    {analysis.intelligent_defaults.annual_rate_pct}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-surface-500">Confidence:</span>
                  <span className="font-medium text-surface-600">
                    {analysis.intelligent_defaults.confidence_lower_pct}% - {analysis.intelligent_defaults.confidence_upper_pct}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-surface-500">Duration:</span>
                  <span className="font-medium text-surface-600">
                    {analysis.intelligent_defaults.suggested_duration} months
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-surface-500">Method:</span>
                  <span className="font-medium text-surface-600">
                    {analysis.intelligent_defaults.method?.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-surface-500">Data points:</span>
                  <span className="font-medium text-surface-600">
                    {analysis.intelligent_defaults.data_points_used}
                  </span>
                </div>

                <p className="text-[9px] text-surface-300 italic pt-1 border-t border-surface-200/50">
                  {analysis.intelligent_defaults.method_description}
                </p>
              </div>
            </div>
          )}

          {/* Impact summary */}
          {result && !result.error && <ImpactSummary result={result} />}

          {/* Metadata: market share data availability */}
          {showMetadata && analysis && (
            <div className="p-2.5 bg-surface-50 rounded-lg text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-surface-500">Source MS Data:</span>
                <span className={`font-medium ${analysis.source?.ms_available ? 'text-emerald-600' : 'text-red-500'}`}>
                  {analysis.source?.ms_available ? `${analysis.source.ms_years} years` : 'Not uploaded'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">Target MS Data:</span>
                <span className={`font-medium ${analysis.target?.ms_available ? 'text-emerald-600' : 'text-red-500'}`}>
                  {analysis.target?.ms_available ? `${analysis.target.ms_years} years` : 'Not uploaded'}
                </span>
              </div>
              {analysis.correlation && (
                <div className="flex items-center justify-between">
                  <span className="text-surface-500">Correlated Signals:</span>
                  <span className={`font-medium ${
                    analysis.correlation.signal_strength === 'strong' ? 'text-emerald-600'
                    : analysis.correlation.signal_strength === 'moderate' ? 'text-amber-600'
                    : 'text-surface-400'
                  }`}>
                    {analysis.correlation.correlation_count} / {analysis.correlation.total_common_periods} periods
                  </span>
                </div>
              )}

              {/* Source trend summary */}
              {analysis.source_trends && (
                <div className="pt-2 border-t border-surface-200">
                  <p className="text-[9px] uppercase text-surface-400 font-medium mb-1">Source Trends</p>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500">Median YoY:</span>
                    <span className="font-medium">{analysis.source_trends.median_change}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500">Decline years:</span>
                    <span className="font-medium">{analysis.source_trends.decline_years} / {analysis.source_trends.total_years}</span>
                  </div>
                </div>
              )}

              {/* Target trend summary */}
              {analysis.target_trends && (
                <div className="pt-2 border-t border-surface-200">
                  <p className="text-[9px] uppercase text-surface-400 font-medium mb-1">Target Trends</p>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500">Median YoY:</span>
                    <span className="font-medium">{analysis.target_trends.median_change}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500">Growth years:</span>
                    <span className="font-medium">{analysis.target_trends.growth_years} / {analysis.target_trends.total_years}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Justification section */}
          <JustificationSection result={result} analysis={analysis} />

          {loading && (
            <div className="flex items-center justify-center py-2">
              <div className="w-4 h-4 border-2 border-daikin-blue/30 border-t-daikin-blue rounded-full animate-spin" />
              <span className="ml-2 text-[10px] text-surface-400">Analyzing...</span>
            </div>
          )}
        </>
    </div>
  );
}

export default CannibalizationPanel;
