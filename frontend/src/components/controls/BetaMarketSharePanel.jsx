/**
 * Beta Market Share Panel - Enhanced with honest intelligence
 *
 * Features:
 * - Data quality indicators
 * - Confidence intervals
 * - Historical validation
 * - Transparent assumptions
 */

import { useState, useEffect } from 'react';
import { Info, AlertTriangle, CheckCircle, TrendingUp, Activity } from 'lucide-react';
import { Button, Select, Slider } from '../common';
import { MS_MODES } from '../../utils/constants';
import { formatPercent } from '../../utils/formatters';
import betaApi from '../../services/betaApi';

// Data quality badge component
function DataQualityBadge({ quality }) {
  const config = {
    good: { color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle, label: 'Good Data' },
    moderate: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: AlertTriangle, label: 'Moderate' },
    limited: { color: 'bg-orange-100 text-orange-700 border-orange-300', icon: AlertTriangle, label: 'Limited' },
    insufficient: { color: 'bg-red-100 text-red-700 border-red-300', icon: AlertTriangle, label: 'Insufficient' },
    none: { color: 'bg-gray-100 text-gray-500 border-gray-300', icon: Info, label: 'No Data' }
  };

  const cfg = config[quality] || config.none;
  const Icon = cfg.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// Metadata display component
function MetadataDisplay({ metadata }) {
  if (!metadata) return null;

  return (
    <div className="mt-3 p-3 bg-surface-50 rounded-lg text-xs space-y-2">
      {/* Data Quality */}
      {metadata.data_quality && (
        <div className="flex items-center justify-between">
          <span className="text-surface-500">Data Quality:</span>
          <DataQualityBadge quality={metadata.data_quality} />
        </div>
      )}

      {/* R-squared for historical mode */}
      {metadata.regression_stats && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-surface-500">R-squared:</span>
            <span className={`font-medium ${metadata.regression_stats.r_squared >= 0.7 ? 'text-green-600' : metadata.regression_stats.r_squared >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
              {metadata.regression_stats.r_squared}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-surface-500">Statistically Significant:</span>
            <span className={metadata.regression_stats.is_significant ? 'text-green-600' : 'text-red-600'}>
              {metadata.regression_stats.is_significant ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      )}

      {/* Confidence Interval */}
      {metadata.projection?.confidence_interval_95 && (
        <div className="flex items-center justify-between">
          <span className="text-surface-500">95% CI:</span>
          <span className="font-medium">
            {metadata.projection.confidence_interval_95.lower_pct}% to {metadata.projection.confidence_interval_95.upper_pct}%
          </span>
        </div>
      )}

      {/* Historical Validation */}
      {metadata.historical_validation && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-surface-500">Historical Range:</span>
            <span className="font-medium">
              {metadata.historical_validation.min_observed_yoy}% to {metadata.historical_validation.max_observed_yoy}%
            </span>
          </div>
          {!metadata.historical_validation.input_within_range && (
            <div className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              <span>Outside historical range</span>
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {metadata.warnings && metadata.warnings.length > 0 && (
        <div className="pt-2 border-t border-surface-200">
          {metadata.warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-1 text-amber-600">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Assumptions */}
      {metadata.assumptions && metadata.assumptions.length > 0 && (
        <div className="pt-2 border-t border-surface-200">
          <p className="text-surface-400 mb-1">Assumptions:</p>
          <ul className="list-disc list-inside text-surface-500 space-y-0.5">
            {metadata.assumptions.map((assumption, i) => (
              <li key={i}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BetaMarketSharePanel({
  marketShareData,
  selectedYear,
  mode,
  params,
  metadata,
  dataSummary,
  onModeChange,
  onParamsChange,
  onInfoClick
}) {
  const [showMetadata, setShowMetadata] = useState(false);

  // Mode options
  const modeOptions = [
    { value: MS_MODES.RELATIVE, label: 'Relative Change' },
    { value: MS_MODES.HISTORICAL, label: 'Historical Trend', disabled: !dataSummary?.capabilities?.historical_trend },
    { value: MS_MODES.COMPETITIVE, label: 'Scenario Planner' },
    { value: MS_MODES.MACRO, label: 'Macro Scenario' }
  ];

  // Competitive scenario types
  const competitiveTypes = [
    { value: 'single', label: 'Single Event' },
    { value: 'gradual', label: 'Gradual Shift' },
    { value: 'recovery', label: 'Recovery' }
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-daikin-dark">
            Market Share
          </h3>
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded">
            BETA
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowMetadata(!showMetadata)}
            className={showMetadata ? 'text-daikin-blue' : 'text-surface-400'}
          >
            <Activity className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onInfoClick}
            className="text-daikin-blue"
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Data Summary */}
      {dataSummary && (
        <div className="p-2 bg-surface-50 rounded-lg text-xs">
          <div className="flex items-center justify-between">
            <span className="text-surface-500">Available Data:</span>
            <span className="font-medium">{dataSummary.complete_years || 0} years</span>
          </div>
          {dataSummary.yoy_statistics && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-surface-500">Avg YoY Change:</span>
              <span className="font-medium">{dataSummary.yoy_statistics.mean_yoy_pct}%</span>
            </div>
          )}
        </div>
      )}

      {/* Mode Selector */}
      <Select
        label="Mode"
        value={mode}
        onChange={onModeChange}
        options={modeOptions}
      />

      {/* Mode-specific controls */}
      {mode === MS_MODES.RELATIVE && (
        <div className="space-y-3">
          <Slider
            label="Adjustment"
            value={params.delta || 0}
            min={-50}
            max={100}
            step={1}
            onChange={(val) => onParamsChange({ ...params, delta: val })}
            formatValue={(v) => formatPercent(v, true)}
          />
          {dataSummary?.yoy_statistics && (
            <p className="text-xs text-surface-400">
              Historical range: {dataSummary.yoy_statistics.min_yoy_pct}% to {dataSummary.yoy_statistics.max_yoy_pct}%
            </p>
          )}
        </div>
      )}

      {mode === MS_MODES.HISTORICAL && (
        <div className="space-y-3">
          {!dataSummary?.capabilities?.historical_trend ? (
            <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              Need at least 2 complete years of data for trend analysis.
            </div>
          ) : (
            <>
              <Slider
                label="Trend Strength"
                value={params.trend_strength || 100}
                min={0}
                max={200}
                step={10}
                onChange={(val) => onParamsChange({ ...params, trend_strength: val })}
                formatValue={(v) => `${v}%`}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="beta-seasonality"
                  checked={params.apply_seasonality !== false}
                  onChange={(e) => onParamsChange({ ...params, apply_seasonality: e.target.checked })}
                  className="rounded"
                  style={{ accentColor: '#00A0E4' }}
                />
                <label htmlFor="beta-seasonality" className="text-xs text-surface-600">
                  Apply Seasonality
                </label>
              </div>
              {!dataSummary?.capabilities?.historical_trend_reliable && (
                <p className="text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  Limited data - results may be unreliable
                </p>
              )}
            </>
          )}
        </div>
      )}

      {mode === MS_MODES.COMPETITIVE && (
        <div className="space-y-3">
          <Select
            label="Scenario Type"
            value={params.type || 'single'}
            onChange={(val) => onParamsChange({ ...params, type: val })}
            options={competitiveTypes}
          />

          {params.type === 'single' && (
            <>
              <Select
                label="Event Month"
                value={params.month || 'Jan'}
                onChange={(val) => onParamsChange({ ...params, month: val })}
                options={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => ({ value: m, label: m }))}
              />
              <Slider
                label="Impact"
                value={params.impact || 0}
                min={-30}
                max={30}
                step={1}
                onChange={(val) => onParamsChange({ ...params, impact: val })}
                formatValue={(v) => formatPercent(v, true)}
              />
              <Slider
                label="Duration (months)"
                value={params.duration || 1}
                min={1}
                max={6}
                step={1}
                onChange={(val) => onParamsChange({ ...params, duration: val })}
                formatValue={(v) => `${v} mo`}
              />
            </>
          )}

          {params.type === 'gradual' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="Start"
                  value={params.start_month || 'Apr'}
                  onChange={(val) => onParamsChange({ ...params, start_month: val })}
                  options={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => ({ value: m, label: m }))}
                />
                <Select
                  label="End"
                  value={params.end_month || 'Sep'}
                  onChange={(val) => onParamsChange({ ...params, end_month: val })}
                  options={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => ({ value: m, label: m }))}
                />
              </div>
              <Slider
                label="Cumulative Impact"
                value={params.cumulative_impact || 0}
                min={-30}
                max={30}
                step={1}
                onChange={(val) => onParamsChange({ ...params, cumulative_impact: val })}
                formatValue={(v) => formatPercent(v, true)}
              />
            </>
          )}

          {params.type === 'recovery' && (
            <>
              <Slider
                label="Initial Loss"
                value={params.initial_loss || -15}
                min={-30}
                max={0}
                step={1}
                onChange={(val) => onParamsChange({ ...params, initial_loss: val })}
                formatValue={(v) => formatPercent(v, true)}
              />
              <Slider
                label="Loss Duration"
                value={params.loss_duration || 3}
                min={1}
                max={6}
                step={1}
                onChange={(val) => onParamsChange({ ...params, loss_duration: val })}
                formatValue={(v) => `${v} mo`}
              />
              <Slider
                label="Recovery Duration"
                value={params.recovery_duration || 5}
                min={1}
                max={6}
                step={1}
                onChange={(val) => onParamsChange({ ...params, recovery_duration: val })}
                formatValue={(v) => `${v} mo`}
              />
            </>
          )}

          <p className="text-xs text-surface-400 italic">
            You define the scenario - impact is your assumption
          </p>
        </div>
      )}

      {mode === MS_MODES.MACRO && (
        <div className="space-y-3">
          <Slider
            label="Market Growth"
            value={params.market_growth || 0}
            min={-20}
            max={50}
            step={1}
            onChange={(val) => onParamsChange({ ...params, market_growth: val })}
            formatValue={(v) => formatPercent(v, true)}
          />
          <Slider
            label="Our Capacity"
            value={params.our_capacity || 0}
            min={-20}
            max={30}
            step={1}
            onChange={(val) => onParamsChange({ ...params, our_capacity: val })}
            formatValue={(v) => formatPercent(v, true)}
          />
          <Slider
            label="Elasticity"
            value={params.elasticity || 1.0}
            min={0.5}
            max={2.0}
            step={0.1}
            onChange={(val) => onParamsChange({ ...params, elasticity: val })}
            formatValue={(v) => v.toFixed(1)}
          />
          <p className="text-xs text-surface-400">
            Elasticity of 1.0 = 1:1 relationship (default assumption)
          </p>
        </div>
      )}

      {/* Metadata Display */}
      {showMetadata && <MetadataDisplay metadata={metadata} />}
    </div>
  );
}

export default BetaMarketSharePanel;
