/**
 * PredictionPanel Component
 * Main panel for intelligent market share predictions.
 */

import { useState, useMemo } from 'react';
import {
  Brain, Play, Settings, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, AlertTriangle, Info, Loader2
} from 'lucide-react';
import { Button, Slider, Checkbox } from '../common';
import { useIntelligence } from '../../contexts/IntelligenceContext';
import DriverWaterfall from './DriverWaterfall';
import TrustBadge from '../intelligence/TrustBadge';

function MonthPredictionCard({ prediction, isSelected, onClick }) {
  const {
    target_month,
    baseline_value,
    predicted_value,
    confidence_lower,
    confidence_upper,
    combined_trust_score,
    primary_drivers,
    data_quality,
    warnings,
  } = prediction;

  const change = predicted_value - baseline_value;
  const changePct = baseline_value > 0 ? (change / baseline_value) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'border-daikin-blue bg-daikin-blue/5 shadow-sm'
          : 'border-surface-200/50 hover:border-surface-300 bg-white/50'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-daikin-dark">{target_month}</span>
        <TrustBadge score={combined_trust_score} />
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-lg font-bold text-daikin-dark">
          {predicted_value?.toFixed(1)}
        </span>
        <span className={`text-sm font-medium ${isPositive ? 'text-emerald-600' : 'text-amber-600'}`}>
          {isPositive ? '+' : ''}{changePct.toFixed(1)}%
        </span>
      </div>

      <div className="text-[10px] text-surface-400">
        CI: {confidence_lower?.toFixed(1)} - {confidence_upper?.toFixed(1)}
      </div>

      {warnings && warnings.length > 0 && (
        <div className="mt-2 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
          <span className="text-[10px] text-amber-600">{warnings[0]}</span>
        </div>
      )}

      {primary_drivers && primary_drivers.length > 0 && (
        <div className="mt-2 pt-2 border-t border-surface-100">
          <p className="text-[10px] text-surface-400 mb-1">Top Driver:</p>
          <p className="text-[10px] text-surface-600 truncate">{primary_drivers[0]}</p>
        </div>
      )}
    </div>
  );
}

function PredictionPanel({
  product,
  year,
  baselineValues,
  marketShareData,
  selectedEvents = [],
  onPredictionsGenerated,
}) {
  const {
    predictions,
    attributions,
    isPredicting,
    error,
    generatePrediction,
  } = useIntelligence();

  const [showSettings, setShowSettings] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [settings, setSettings] = useState({
    apply_trend: true,
    apply_seasonality: true,
    trend_strength: 1.0,
  });

  const handleGenerate = async () => {
    if (!product || !year || !baselineValues || baselineValues.length === 0) {
      return;
    }

    const result = await generatePrediction({
      product,
      target_year: year,
      baseline_values: baselineValues,
      market_share_data: marketShareData,
      include_event_ids: selectedEvents.map(e => e.id),
      apply_trend: settings.apply_trend,
      apply_seasonality: settings.apply_seasonality,
      trend_strength: settings.trend_strength,
    });

    if (result.success && onPredictionsGenerated) {
      onPredictionsGenerated(result.predictions);
    }
  };

  const selectedPrediction = useMemo(() => {
    if (!selectedMonth || !predictions) return null;
    return predictions.find(p => p.target_month === selectedMonth);
  }, [selectedMonth, predictions]);

  const selectedAttribution = useMemo(() => {
    if (!selectedMonth || !attributions) return null;
    const idx = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(selectedMonth);
    return attributions[idx];
  }, [selectedMonth, attributions]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!predictions || predictions.length === 0) return null;

    const changes = predictions.map(p => {
      const idx = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(p.target_month);
      const baseline = baselineValues?.[idx] || 0;
      return baseline > 0 ? ((p.predicted_value - baseline) / baseline) * 100 : 0;
    });

    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const maxChange = Math.max(...changes);
    const minChange = Math.min(...changes);
    const avgTrust = predictions.reduce((a, p) => a + (p.combined_trust_score || 0), 0) / predictions.length;

    return { avgChange, maxChange, minChange, avgTrust };
  }, [predictions, baselineValues]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-daikin-blue" />
          <h3 className="text-sm font-semibold text-daikin-dark">Intelligent Prediction</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-colors ${
              showSettings ? 'bg-daikin-blue/10 text-daikin-blue' : 'text-surface-400 hover:text-daikin-blue hover:bg-surface-100'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerate}
            disabled={isPredicting || !product || !baselineValues?.length}
          >
            {isPredicting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                Predicting...
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="p-3 rounded-lg border border-surface-200/50 bg-surface-50/50 space-y-3">
          <div className="flex items-center gap-4">
            <Checkbox
              label="Apply Historical Trend"
              checked={settings.apply_trend}
              onChange={(checked) => setSettings(s => ({ ...s, apply_trend: checked }))}
            />
            <Checkbox
              label="Apply Seasonality"
              checked={settings.apply_seasonality}
              onChange={(checked) => setSettings(s => ({ ...s, apply_seasonality: checked }))}
            />
          </div>

          {settings.apply_trend && (
            <Slider
              label="Trend Strength"
              value={settings.trend_strength * 100}
              onChange={(v) => setSettings(s => ({ ...s, trend_strength: v / 100 }))}
              min={0}
              max={200}
              step={10}
              formatValue={(v) => `${v}%`}
            />
          )}

          <div className="text-[10px] text-surface-400">
            Events included: {selectedEvents.length}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Stats */}
      {summaryStats && (
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 rounded-lg bg-surface-50 border border-surface-200/50 text-center">
            <p className="text-[10px] text-surface-400 mb-0.5">Avg Change</p>
            <p className={`text-sm font-semibold ${summaryStats.avgChange >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {summaryStats.avgChange >= 0 ? '+' : ''}{summaryStats.avgChange.toFixed(1)}%
            </p>
          </div>
          <div className="p-2 rounded-lg bg-surface-50 border border-surface-200/50 text-center">
            <p className="text-[10px] text-surface-400 mb-0.5">Max</p>
            <p className="text-sm font-semibold text-emerald-600">+{summaryStats.maxChange.toFixed(1)}%</p>
          </div>
          <div className="p-2 rounded-lg bg-surface-50 border border-surface-200/50 text-center">
            <p className="text-[10px] text-surface-400 mb-0.5">Min</p>
            <p className="text-sm font-semibold text-amber-600">{summaryStats.minChange.toFixed(1)}%</p>
          </div>
          <div className="p-2 rounded-lg bg-surface-50 border border-surface-200/50 text-center">
            <p className="text-[10px] text-surface-400 mb-0.5">Trust</p>
            <p className="text-sm font-semibold text-daikin-blue">{(summaryStats.avgTrust * 100).toFixed(0)}%</p>
          </div>
        </div>
      )}

      {/* Monthly Predictions Grid */}
      {predictions && predictions.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {predictions.map(pred => (
            <MonthPredictionCard
              key={pred.target_month}
              prediction={pred}
              isSelected={selectedMonth === pred.target_month}
              onClick={() => setSelectedMonth(
                selectedMonth === pred.target_month ? null : pred.target_month
              )}
            />
          ))}
        </div>
      )}

      {/* Driver Attribution */}
      {selectedAttribution && (
        <div className="pt-3 border-t border-surface-200/50">
          <h4 className="text-xs font-semibold text-surface-600 mb-3 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            {selectedMonth} Prediction Breakdown
          </h4>
          <DriverWaterfall attribution={selectedAttribution} height={250} />
        </div>
      )}

      {/* Empty State */}
      {(!predictions || predictions.length === 0) && !isPredicting && (
        <div className="flex flex-col items-center justify-center py-8 text-surface-400">
          <Brain className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-xs">No predictions generated yet</p>
          <p className="text-[10px] mt-1">Click "Generate" to create intelligent predictions</p>
        </div>
      )}
    </div>
  );
}

export default PredictionPanel;
