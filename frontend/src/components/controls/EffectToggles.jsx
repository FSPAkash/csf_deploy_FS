import { GlassCard, Toggle } from '../common';

function EffectToggles({ toggles, onToggle }) {
  return (
    <GlassCard variant="panel" padding="sm" className="mt-4">
      <div className="flex flex-wrap items-center gap-6">
        <span className="text-sm font-medium text-daikin-dark">
          Effect Toggles:
        </span>

        <Toggle
          label="Pull Forward (+) 21-22"
          checked={toggles.pf_pos}
          onChange={(checked) => onToggle('pf_pos', checked)}
          size="sm"
        />

        <Toggle
          label="Pull Forward (-) 2023"
          checked={toggles.pf_neg}
          onChange={(checked) => onToggle('pf_neg', checked)}
          size="sm"
        />

        <Toggle
          label="Trend Correction"
          checked={toggles.trend}
          onChange={(checked) => onToggle('trend', checked)}
          size="sm"
        />

        <div data-tutorial="toggle-march-madness">
          <Toggle
            label="Transition Sep-Dec"
            checked={toggles.trans}
            onChange={(checked) => onToggle('trans', checked)}
            size="sm"
          />
        </div>
      </div>
    </GlassCard>
  );
}

export default EffectToggles;