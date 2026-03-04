import numpy as np
from datetime import datetime
from ..utils.constants import MONTHS, MONTH_TO_IDX, IDX_TO_MONTH


# Reference impact ranges by event type (percentage impact on market share)
# Ranges grounded in LBNL-326E, IEA, AHRI, HARDI, RMI empirical data
INTEL_EVENT_IMPACT_RANGES = {
    'product_launch': {'range': (-5.0, -2.0), 'duration': 6},      # Competitor launch hurts us
    'pricing_change': {'range': (-10.0, 10.0), 'duration': 4},     # Bidirectional; brand cross-price elasticity ~2.0
    'supply_disruption': {'range': (5.0, 15.0), 'duration': 6},    # Competitor issues help us
    'regulatory_change': {'range': (-15.0, 20.0), 'duration': 12}, # Bidirectional; depends on compliance position
    'capacity_expansion': {'range': (-5.0, -1.0), 'duration': 12}, # More competition
    'market_entry': {'range': (-5.0, -2.0), 'duration': 18},       # New competitor
    'market_exit': {'range': (3.0, 10.0), 'duration': 9},          # Less competition
    'competitor_news': {'range': (-3.0, 3.0), 'duration': 3},      # General news; bidirectional
}

# For bidirectional ranges that cross zero, the midpoint is meaningless (0%).
# Default to the conservative negative side (assume competitor action hurts us)
# unless the NLP extractor provides directional impact_estimate values.
BIDIRECTIONAL_DEFAULT_SIDE = {
    'pricing_change': -0.33,       # Default: competitor price cut (use lower third of range)
    'regulatory_change': 0.25,     # Default: slight positive (Manufacturer generally ahead on compliance)
    'competitor_news': -0.33,      # Default: negative news about competitor actions
}


class SimulationEngine:
    def __init__(self):
        self.damp_k = 0.5

    def get_base_mult(self, weights_dict, colname, month_idx):
        """Get base multiplier from weights"""
        if colname not in weights_dict:
            return 1.0
        v = weights_dict[colname]
        if isinstance(v, (list, tuple, np.ndarray)):
            try:
                return float(v[month_idx - 1])
            except:
                return 1.0
        else:
            try:
                return float(v)
            except:
                return 1.0

    def apply_slider_mult(self, base, pct):
        """Apply percentage adjustment to base multiplier"""
        return base * (1.0 + pct / 100.0)

    def find_weight_column(self, weights, patterns):
        """Find a weight column matching any of the patterns"""
        for pattern in patterns:
            for col in weights.keys():
                if pattern.lower() in col.lower():
                    return col
        return None

    def calculate_intel_event_impact(self, event, month_idx):
        """
        Calculate the impact of an intelligence event on a specific month.

        Uses trust-weighted impact with exponential decay from event date.

        Mathematical model:
        - impact = point_estimate * trust_score * decay_factor
        - decay_factor = exp(-lambda * months_since_event)
        - lambda = -ln(0.1) / duration (reaches 10% at duration end)

        Args:
            event: Intelligence event dict with impact estimates and trust score
            month_idx: Target month index (0-11)

        Returns:
            Float impact percentage for the month
        """
        event_type = event.get('event_type', 'competitor_news')
        trust_score = event.get('trust_score', 0.5)

        # Get point estimate: user override > explicit estimates > reference range
        if event.get('user_adjusted_impact') is not None:
            point_estimate = float(event.get('user_adjusted_impact'))
        elif event.get('impact_estimate_low') is not None and event.get('impact_estimate_high') is not None:
            point_estimate = (float(event.get('impact_estimate_low')) + float(event.get('impact_estimate_high'))) / 2
        else:
            # Use reference range with directional default for bidirectional ranges
            ref = INTEL_EVENT_IMPACT_RANGES.get(event_type, {'range': (-1.0, 1.0), 'duration': 6})
            range_low, range_high = ref['range']
            if event_type in BIDIRECTIONAL_DEFAULT_SIDE:
                # For ranges that cross zero, use a directional default instead of midpoint (which would be ~0%)
                # The default_side is a position within the range: -1.0=low, 0.0=mid, 1.0=high
                side = BIDIRECTIONAL_DEFAULT_SIDE[event_type]
                mid = (range_low + range_high) / 2
                half_span = (range_high - range_low) / 2
                point_estimate = mid + side * half_span
            else:
                point_estimate = (range_low + range_high) / 2

        # Get event timing - try to parse event_date, fall back to current month
        event_month_idx = None
        event_date_str = event.get('event_date') or event.get('date_extracted')

        if event_date_str:
            try:
                # Try various date formats
                for fmt in ['%Y-%m-%d', '%Y-%m', '%B %Y', '%b %Y']:
                    try:
                        dt = datetime.strptime(event_date_str[:10], fmt)
                        event_month_idx = dt.month - 1  # 0-indexed
                        break
                    except:
                        continue
            except:
                pass

        # Default: assume event is happening now/soon (current month logic)
        if event_month_idx is None:
            # Assume event affects from current month forward
            event_month_idx = max(0, month_idx - 1)

        # Calculate months since event
        months_since = month_idx - event_month_idx

        # Event hasn't happened yet - no impact
        if months_since < 0:
            return 0.0

        # Get duration for decay
        ref = INTEL_EVENT_IMPACT_RANGES.get(event_type, {'range': (-1.0, 1.0), 'duration': 6})
        duration = ref['duration']

        # Event impact has fully decayed
        if months_since > duration:
            return 0.0

        # Calculate exponential decay
        # lambda chosen so impact decays to 10% at duration_months
        lambda_decay = -np.log(0.1) / duration
        decay_factor = np.exp(-lambda_decay * months_since)

        # Trust-weighted impact with decay
        impact = point_estimate * trust_score * decay_factor

        return impact

    def compute_intel_adjustments(self, intel_events):
        """
        Compute monthly adjustment multipliers from intelligence events.

        Combines multiple event impacts with diminishing returns to prevent
        unrealistic stacking of effects.

        Mathematical model:
        - Combine positive and negative impacts separately
        - Apply diminishing returns: effective = raw / (1 + k * |raw|)
        - Convert percentage to multiplier: mult = 1 + (pct / 100)

        Args:
            intel_events: List of intelligence event dicts

        Returns:
            Dict mapping month names to multipliers
        """
        if not intel_events:
            return {m: 1.0 for m in MONTHS}

        # Calculate combined impact for each month
        monthly_impacts = {m: 0.0 for m in MONTHS}
        impact_details = {m: [] for m in MONTHS}

        for event in intel_events:
            for month_idx, month in enumerate(MONTHS):
                impact = self.calculate_intel_event_impact(event, month_idx)
                if abs(impact) > 0.001:  # Only track meaningful impacts
                    monthly_impacts[month] += impact
                    impact_details[month].append({
                        'event_id': event.get('id', 'unknown'),
                        'event_type': event.get('event_type', 'unknown'),
                        'headline': event.get('headline', '')[:50],
                        'raw_impact': impact
                    })

        # Apply diminishing returns and convert to multipliers
        k = 0.1  # Diminishing returns factor
        adjustments = {}

        for month in MONTHS:
            raw_impact = monthly_impacts[month]

            # Separate positive and negative impacts for asymmetric diminishing returns
            if raw_impact > 0:
                effective = raw_impact / (1 + k * abs(raw_impact))
            elif raw_impact < 0:
                effective = raw_impact / (1 + k * abs(raw_impact))
            else:
                effective = 0.0

            # Convert percentage to multiplier
            # -2% impact means multiply by 0.98
            multiplier = 1.0 + (effective / 100.0)

            # Clamp to reasonable bounds (max 20% change from intel events)
            multiplier = max(0.80, min(1.20, multiplier))

            adjustments[month] = multiplier

        return adjustments

    def compute_simulation(
        self,
        baseline_vals,
        weights,
        ms_settings,
        promo_settings,
        shortage_settings,
        regulation_settings,
        custom_settings,
        toggle_settings,
        locked_events,
        damp_k=0.5,
        intel_events=None
    ):
        """
        Main simulation computation - preserves all original logic

        Parameters:
        - baseline_vals: list of 12 monthly baseline values
        - weights: dict of weight columns
        - ms_settings: market share settings dict
        - promo_settings: promotion event settings
        - shortage_settings: shortage event settings
        - regulation_settings: regulation event settings
        - custom_settings: custom event settings
        - toggle_settings: effect toggle settings
        - locked_events: dict of locked events by type
        - damp_k: dampening factor
        - intel_events: list of intelligence event dicts (optional)
        """

        # Calculate intelligence event adjustments
        intel_adjustments = self.compute_intel_adjustments(intel_events or [])

        # Start with baseline values
        working_baseline = baseline_vals[:]
        
        # Apply Remove Historical March Madness if enabled
        if toggle_settings.get('march_madness', False):
            working_baseline[2] = working_baseline[2] * 0.6  # March
            working_baseline[5] = working_baseline[5] * 1.2  # June
        
        # Precompute multipliers from toggles
        base_mults = {m: 1.0 for m in MONTHS}
        applied_details = {m: [] for m in MONTHS}
        
        # Trend toggle
        if toggle_settings.get('trend', False):
            trend_col = self.find_weight_column(weights, ['trend'])
            if trend_col:
                for i, m in enumerate(MONTHS, start=1):
                    bm = self.get_base_mult(weights, trend_col, i)
                    base_mults[m] *= bm
                    applied_details[m].append((trend_col, float(bm)))
        
        # Trans Sep-Dec toggle
        if toggle_settings.get('trans', False):
            trans_col = self.find_weight_column(weights, ['trans'])
            if trans_col:
                for i in range(9, 13):  # Sep-Dec
                    mm = IDX_TO_MONTH[i]
                    bm = self.get_base_mult(weights, trans_col, i)
                    base_mults[mm] *= bm
                    applied_details[mm].append((trans_col, float(bm)))
        
        # PF Pos toggle
        if toggle_settings.get('pf_pos', False):
            pf_pos_col = self.find_weight_column(weights, ['pf_pos', 'pfpos'])
            if pf_pos_col:
                for i, m in enumerate(MONTHS, start=1):
                    bm = self.get_base_mult(weights, pf_pos_col, i)
                    base_mults[m] *= bm
                    applied_details[m].append((pf_pos_col, float(bm)))
        
        # PF Neg toggle
        if toggle_settings.get('pf_neg', False):
            pf_neg_col = self.find_weight_column(weights, ['pf_neg', 'pfneg'])
            if pf_neg_col:
                for i, m in enumerate(MONTHS, start=1):
                    bm = self.get_base_mult(weights, pf_neg_col, i)
                    base_mults[m] *= bm
                    applied_details[m].append((pf_neg_col, float(bm)))
        
        # Copy for local modifications
        local_applied = {m: applied_details[m][:] for m in MONTHS}
        local_mults = {m: base_mults[m] for m in MONTHS}
        
        # Apply locked promo events
        # FIXED: Locked events now store the complete multiplier (base weight * slider adjustment)
        # so we apply it directly without recalculating
        for locked_event in locked_events.get('Promo', []):
            month = locked_event['month']
            multiplier = locked_event['multiplier']
            # The multiplier already includes the base weight, apply directly
            local_mults[month] *= multiplier
            local_applied[month].append(("Locked_Promo", float(multiplier)))
        
        # Current promo event
        promo_month = promo_settings.get('month')
        if promo_month and promo_month != "None":
            i = MONTH_TO_IDX[promo_month]
            promo_pct = promo_settings.get('pct', 0)
            
            # Determine up/down columns based on month
            if i <= 6:
                up_col = self.find_weight_column(weights, ['upromoup'])
                dwn_col = self.find_weight_column(weights, ['upromodwn'])
            else:
                up_col = self.find_weight_column(weights, ['dpromoup'])
                dwn_col = self.find_weight_column(weights, ['dpromodwn'])
            
            if up_col:
                base_w = self.get_base_mult(weights, up_col, i)
                applied_w = self.apply_slider_mult(base_w, promo_pct)
                
                # Cap June promo
                if promo_month == "Jun":
                    applied_w = min(applied_w, 1.06)
                
                local_mults[promo_month] *= applied_w
                local_applied[promo_month].append((up_col, float(applied_w)))
                
                # March reduction (if not locked)
                lock_march = toggle_settings.get('lock_march', False)
                if not lock_march and promo_month != "Mar":
                    march_reduction = 1.0 / applied_w if applied_w > 0 else 1.0
                    local_mults["Mar"] *= march_reduction
                    local_applied["Mar"].append(("Promo_March_Reduction", float(march_reduction)))
            
            # Spillover to next month
            spill_enabled = promo_settings.get('spill_enabled', True)
            spill_pct = promo_settings.get('spill_pct', 10)
            
            if i < 12 and dwn_col and promo_month != "Jun":
                nxt = IDX_TO_MONTH[i + 1]
                base_dn = self.get_base_mult(weights, dwn_col, i + 1)
                applied_dn = base_dn
                
                if spill_enabled and promo_pct > 0 and applied_dn < 1.0:
                    reduction_frac = spill_pct / 100.0
                    promo_scale = min(promo_pct / 25.0, 1.0)
                    reduction_frac = reduction_frac * promo_scale
                    applied_dn = applied_dn + (1.0 - applied_dn) * reduction_frac
                
                local_mults[nxt] *= applied_dn
                local_applied[nxt].append((dwn_col, float(applied_dn)))
        
        # Apply locked shortage events
        # FIXED: Use stored multiplier directly (includes base weight)
        for locked_event in locked_events.get('Shortage', []):
            month = locked_event['month']
            multiplier = locked_event['multiplier']
            local_mults[month] *= multiplier
            local_applied[month].append(("Locked_Shortage", float(multiplier)))
        
        # Current shortage event
        shortage_month = shortage_settings.get('month')
        if shortage_month and shortage_month != "None":
            i = MONTH_TO_IDX[shortage_month]
            shortage_pct = shortage_settings.get('pct', 0)
            
            col = self.find_weight_column(weights, ['shortage'])
            if col:
                base_w = self.get_base_mult(weights, col, i)
                applied = self.apply_slider_mult(base_w, shortage_pct)
                applied = min(applied, 1.0)  # Cap at 1.0
                local_mults[shortage_month] *= applied
                local_applied[shortage_month].append((col, float(applied)))
        
        # Apply locked regulation events
        # FIXED: Use stored multiplier directly (includes base weight)
        for locked_event in locked_events.get('Regulation', []):
            month = locked_event['month']
            multiplier = locked_event['multiplier']
            local_mults[month] *= multiplier
            local_applied[month].append(("Locked_Regulation", float(multiplier)))
        
        # Current regulation event
        regulation_month = regulation_settings.get('month')
        if regulation_month and regulation_month != "None":
            i = MONTH_TO_IDX[regulation_month]
            regulation_pct = regulation_settings.get('pct', 0)
            
            col = self.find_weight_column(weights, ['regulation', 'epa'])
            if col:
                base_w = self.get_base_mult(weights, col, i)
                applied = self.apply_slider_mult(base_w, regulation_pct)
                applied = min(applied, 1.0)
                local_mults[regulation_month] *= applied
                local_applied[regulation_month].append((col, float(applied)))
        
        # Apply locked custom events
        # FIXED: Use stored multiplier directly (includes base weight)
        for locked_event in locked_events.get('Custom', []):
            month = locked_event['month']
            multiplier = locked_event['multiplier']
            local_mults[month] *= multiplier
            local_applied[month].append(("Locked_Custom", float(multiplier)))
        
        # Current custom event
        custom_month = custom_settings.get('month')
        if custom_month and custom_month != "None":
            custom_weight = custom_settings.get('weight', 1.0)
            custom_pct = custom_settings.get('pct', 0)
            applied = self.apply_slider_mult(custom_weight, custom_pct)
            local_mults[custom_month] *= applied
            local_applied[custom_month].append(("Custom", float(applied)))
        
        # Apply dampening
        final_mults = {}
        final_applied = {}
        
        for m in MONTHS:
            factors = [v for (_, v) in local_applied[m]]
            ups = [v for v in factors if v > 1.0]
            others = [v for v in factors if v <= 1.0]
            
            prod_ups = np.prod(ups) if ups else 1.0
            prod_others = np.prod(others) if others else 1.0
            
            if prod_ups > 1.0 and len(ups) > 1:
                damped_up = 1.0 + (prod_ups - 1.0) / (1.0 + damp_k)
            else:
                damped_up = prod_ups
            
            final_mult = float(damped_up * prod_others)
            final_mults[m] = final_mult
            
            readable = [(name, float(val)) for (name, val) in local_applied[m]]
            if damped_up != prod_ups:
                readable.append(("DampenedUp", float(damped_up)))
            final_applied[m] = readable
        
        # Compute final simulated values
        simulated = []
        for i, m in enumerate(MONTHS):
            base_val = working_baseline[i]
            event_mult = final_mults[m]
            ms_adj = ms_settings.get('adjustments', {}).get(m, 1.0)
            intel_mult = intel_adjustments.get(m, 1.0)

            sim_val = base_val * event_mult * ms_adj * intel_mult
            simulated.append(sim_val)

            # Track intel adjustment in applied details
            if intel_mult != 1.0:
                final_applied[m].append(("Intelligence_Events", float(intel_mult)))

        return {
            'simulated': simulated,
            'final_multipliers': final_mults,
            'applied_details': final_applied,
            'working_baseline': working_baseline,
            'intel_adjustments': intel_adjustments
        }

    def calculate_exceeded_months(self, simulated, baseline_vals, sensitivity=1.5):
        """
        Calculate which months exceed threshold for warnings
        Uses Coefficient of Variation approach
        """
        exceeded = []
        
        for i, m in enumerate(MONTHS):
            baseline_val = float(baseline_vals[i])
            sim_val = float(simulated[i])
            
            # Local context: 3-month rolling window
            window_start = max(0, i - 1)
            window_end = min(12, i + 2)
            local_window = baseline_vals[window_start:window_end]
            
            # Local volatility
            local_mean = np.mean(local_window)
            local_std = np.std(local_window)
            local_cv = local_std / local_mean if local_mean > 0 else 0.15
            
            # Product-level volatility
            year_mean = np.mean(baseline_vals)
            year_std = np.std(baseline_vals)
            year_cv = year_std / year_mean if year_mean > 0 else 0.15
            
            # Combined threshold
            combined_cv = max(local_cv, year_cv * 0.5)
            threshold_pct = max(0.08, combined_cv * sensitivity)
            month_threshold = baseline_val * (1 + threshold_pct)
            
            if sim_val > month_threshold:
                exceeded.append({
                    'month': m,
                    'index': i,
                    'simulated': sim_val,
                    'baseline': baseline_val,
                    'threshold': month_threshold
                })
        
        return exceeded


# Singleton instance
simulation_engine = SimulationEngine()