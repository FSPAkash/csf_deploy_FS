import { Info } from 'lucide-react';
import { Button, Select, Slider, Toggle, Badge } from '../common';
import { MS_MODES, MONTHS } from '../../utils/constants';
import { formatPercent } from '../../utils/formatters';
import { useTutorial } from '../../contexts/TutorialContext';

function MarketSharePanel({
  marketShareData,
  selectedYear,
  mode,
  params,
  onModeChange,
  onParamsChange,
  onInfoClick,
}) {
  const { isActive: isTutorialActive, currentStep } = useTutorial();

  // During market share tutorial step (step 7), only allow Relative Change
  const isMarketShareTutorialStep = isTutorialActive && currentStep === 7;

  const modeOptions = [
    { value: MS_MODES.RELATIVE, label: 'Relative Change' },
    { value: MS_MODES.HISTORICAL, label: 'Historical Trend', beta: true },
    { value: MS_MODES.COMPETITIVE, label: 'Competitive Intelligence' },
    { value: MS_MODES.MACRO, label: 'Macro Scenario', beta: true },
  ];

  const eventPatternOptions = [
    { value: 'single', label: 'Single' },
    { value: 'gradual', label: 'Gradual' },
    { value: 'recovery', label: 'Recovery' },
  ];

  const hasHistoricalData = marketShareData && Object.keys(marketShareData).length >= 2;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-daikin-dark">
          Market Share Scenarios
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

      {/* Mode Selector - Stacked Radio Buttons */}
      <div>
        <label className="block text-sm font-medium text-daikin-dark mb-2">
          Scenario Mode
        </label>

        <div className="space-y-2">
          {modeOptions.map((option) => {
            // During tutorial, disable all options except Relative Change
            const isDisabled = isMarketShareTutorialStep && option.value !== MS_MODES.RELATIVE;

            return (
              <label
                key={option.value}
                className={`flex items-center gap-2 group ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="scenarioMode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={(e) => !isDisabled && onModeChange(e.target.value)}
                  disabled={isDisabled}
                  style={{
                    accentColor: '#00a0e47f',
                    WebkitAppearance: 'radio',
                    appearance: 'radio'
                  }}
                  className="w-4 h-4"
                />
                <span className={`text-sm ${isDisabled ? 'text-surface-400' : 'text-daikin-dark group-hover:text-daikin-blue'} transition-colors`}>
                  {option.label}
                </span>
                {option.beta && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                    BETA
                  </span>
                )}
                {isDisabled && (
                  <span className="text-[10px] text-surface-400 italic ml-auto">
                    (tutorial only)
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Mode-specific controls */}
      {mode === MS_MODES.RELATIVE && (
        <div className="space-y-3">
          <div data-tutorial="market-share-slider">
            <Slider
              label="MS Performance Delta"
              value={params.delta || 0}
              onChange={(value) => onParamsChange({ ...params, delta: value })}
              min={-50}
              max={100}
              step={5}
              formatValue={(v) => `${v > 0 ? '+' : ''}${v}%`}
            />
          </div>

          {(params.delta || 0) === 0 ? (
            <Badge variant="success">Trust Model - No MS adjustment</Badge>
          ) : (
            <Badge variant={(params.delta || 0) > 0 ? 'info' : 'warning'}>
              {formatPercent(params.delta || 0, 0, true)} adjustment
            </Badge>
          )}
        </div>
      )}

      {mode === MS_MODES.HISTORICAL && (
        <div className="space-y-3">
          {!hasHistoricalData ? (
            <Badge variant="warning">
              Need 2+ years of historical data
            </Badge>
          ) : (
            <>
              <Slider
                label="Trend Strength"
                value={params.trend_strength || 100}
                onChange={(value) => onParamsChange({ ...params, trend_strength: value })}
                min={0}
                max={200}
                step={10}
                formatValue={(v) => `${v}%`}
              />

              <Toggle
                label="Apply Seasonal Pattern"
                checked={params.apply_seasonality !== false}
                onChange={(checked) => onParamsChange({ ...params, apply_seasonality: checked })}
              />
            </>
          )}
        </div>
      )}

      {mode === MS_MODES.COMPETITIVE && (
        <div className="space-y-3">
          {/* Event Pattern - Button Style Radio Group */}
          <div>
            <label className="block text-sm font-medium text-daikin-dark mb-2">
              Event Pattern
            </label>

            <div className="flex rounded-lg overflow-hidden border border-surface-200">
              {eventPatternOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onParamsChange({ ...params, type: option.value })}
                  className={`
                    flex-1 px-3 py-2 text-xs font-medium transition-colors
                    ${index !== 0 ? 'border-l border-surface-200' : ''}
                    ${(params.type || 'single') === option.value
                      ? 'bg-daikin-blue text-white'
                      : 'bg-white text-daikin-dark hover:bg-surface-50'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {(params.type || 'single') === 'single' && (
            <>
              <Select
                label="Event Month"
                value={params.month || MONTHS[0]}
                onChange={(value) => onParamsChange({ ...params, month: value })}
                options={MONTHS}
                maxDropdownHeight={150}
              />
              <Slider
                label="MS Impact"
                value={params.impact || 0}
                onChange={(value) => onParamsChange({ ...params, impact: value })}
                min={-30}
                max={30}
                step={1}
                formatValue={(v) => `${v > 0 ? '+' : ''}${v}%`}
              />
              <Slider
                label="Duration (months)"
                value={params.duration || 1}
                onChange={(value) => onParamsChange({ ...params, duration: value })}
                min={1}
                max={6}
                step={1}
              />
            </>
          )}

          {params.type === 'gradual' && (
            <>
              <Select
                label="Shift Start"
                value={params.start_month || 'Apr'}
                onChange={(value) => onParamsChange({ ...params, start_month: value })}
                options={MONTHS}
                maxDropdownHeight={150}
              />
              <Select
                label="Shift End"
                value={params.end_month || 'Sep'}
                onChange={(value) => onParamsChange({ ...params, end_month: value })}
                options={MONTHS}
                maxDropdownHeight={150}
              />
              <Slider
                label="Cumulative Impact"
                value={params.cumulative_impact || -10}
                onChange={(value) => onParamsChange({ ...params, cumulative_impact: value })}
                min={-30}
                max={30}
                step={1}
                formatValue={(v) => `${v > 0 ? '+' : ''}${v}%`}
              />
            </>
          )}

          {params.type === 'recovery' && (
            <>
              <Slider
                label="Loss Duration (months)"
                value={params.loss_duration || 3}
                onChange={(value) => onParamsChange({ ...params, loss_duration: value })}
                min={1}
                max={6}
                step={1}
              />
              <Slider
                label="Initial Loss"
                value={params.initial_loss || -15}
                onChange={(value) => onParamsChange({ ...params, initial_loss: value })}
                min={-30}
                max={0}
                step={1}
                formatValue={(v) => `${v}%`}
              />
              <Slider
                label="Recovery Duration (months)"
                value={params.recovery_duration || 5}
                onChange={(value) => onParamsChange({ ...params, recovery_duration: value })}
                min={1}
                max={8}
                step={1}
              />
            </>
          )}
        </div>
      )}

      {mode === MS_MODES.MACRO && (
        <div className="space-y-3">
          <Slider
            label="Total Market Growth"
            value={params.market_growth || 0}
            onChange={(value) => onParamsChange({ ...params, market_growth: value })}
            min={-20}
            max={50}
            step={5}
            formatValue={(v) => `${v > 0 ? '+' : ''}${v}%`}
          />
          <Slider
            label="Our Capacity Growth"
            value={params.our_capacity || 0}
            onChange={(value) => onParamsChange({ ...params, our_capacity: value })}
            min={-20}
            max={30}
            step={5}
            formatValue={(v) => `${v > 0 ? '+' : ''}${v}%`}
          />

          {(() => {
            const relativeGrowth = (params.our_capacity || 0) - (params.market_growth || 0);
            if (relativeGrowth > 0) {
              return <Badge variant="success">MS Gain: +{relativeGrowth}%</Badge>;
            } else if (relativeGrowth < 0) {
              return <Badge variant="warning">MS Loss: {relativeGrowth}%</Badge>;
            }
            return <Badge variant="info">MS Stable</Badge>;
          })()}
        </div>
      )}
    </div>
  );
}

export default MarketSharePanel;
