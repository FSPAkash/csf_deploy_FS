// components/controls/ControlsPanel.jsx
import { memo } from 'react';
import { GlassCard } from '../common';
import MarketSharePanel from './MarketSharePanel';
import PromotionPanel from './PromotionPanel';
import ShortagePanel from './ShortagePanel';
import RegulationPanel from './RegulationPanel';
import CustomEventPanel from './CustomEventPanel';

const ControlsPanel = memo(function ControlsPanel({
  weights,
  marketShareData,
  selectedYear,
  lockedEvents,
  simParams,
  onUpdateParams,
  onNavigateToMSGuide,
  onNavigateToPromoGuide,
  onNavigateToRegulationGuide,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
      {/* Market Share Panel */}
      <GlassCard padding="md" className="lg:col-span-1" data-tutorial="market-share-panel">
        <MarketSharePanel
          marketShareData={marketShareData}
          selectedYear={selectedYear}
          mode={simParams.ms_mode}
          params={simParams.ms_params}
          onModeChange={(mode) => onUpdateParams({ ms_mode: mode })}
          onParamsChange={(params) => onUpdateParams({ ms_params: params })}
          onInfoClick={onNavigateToMSGuide}
        />
      </GlassCard>

      {/* Promotion Panel */}
      <GlassCard padding="md" className="lg:col-span-1" data-tutorial="promotion-panel">
        <PromotionPanel
          weights={weights}
          settings={simParams.promo_settings}
          toggleSettings={simParams.toggle_settings}
          lockedEvents={lockedEvents.Promo || []}
          onChange={(settings) => onUpdateParams({ promo_settings: settings })}
          onToggleChange={(key, value) => {
            onUpdateParams({
              toggle_settings: {
                ...simParams.toggle_settings,
                [key]: value,
              },
            });
          }}
          onInfoClick={onNavigateToPromoGuide}
        />
      </GlassCard>

      {/* Shortage Panel */}
      <GlassCard padding="md" className="lg:col-span-1" data-tutorial="shortage-panel">
        <ShortagePanel
          weights={weights}
          settings={simParams.shortage_settings}
          lockedEvents={lockedEvents.Shortage || []}
          onChange={(settings) => onUpdateParams({ shortage_settings: settings })}
        />
      </GlassCard>

      {/* Regulation Panel */}
      <GlassCard padding="md" className="lg:col-span-1" data-tutorial="regulation-panel">
        <RegulationPanel
          weights={weights}
          settings={simParams.regulation_settings}
          lockedEvents={lockedEvents.Regulation || []}
          onChange={(settings) => onUpdateParams({ regulation_settings: settings })}
          onInfoClick={onNavigateToRegulationGuide}
        />
      </GlassCard>

      {/* Custom Event Panel */}
      <GlassCard padding="md" className="lg:col-span-1" data-tutorial="custom-event-panel">
        <CustomEventPanel
          settings={simParams.custom_settings}
          lockedEvents={lockedEvents.Custom || []}
          onChange={(settings) => onUpdateParams({ custom_settings: settings })}
        />
      </GlassCard>
    </div>
  );
});

export default ControlsPanel;