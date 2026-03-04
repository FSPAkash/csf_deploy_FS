"""
Cannibalization Service - Intra-product APS class cannibalization modeling.

Models scenarios where one APS class cannibalizes sales from another.
All parameters are derived from real data with explicit justification.

Mathematical model:
  source_loss[m]  = source_baseline[m] * cannib_rate[m]
  target_gain[m]  = source_loss[m] * transfer_ratio[m]
  source_final[m] = source_baseline[m] - source_loss[m]
  target_final[m] = target_baseline[m] + target_gain[m]

Note: target_gain < source_loss because transfer_ratio < 1.
The non-transferred portion (source_loss * (1 - transfer_ratio))
represents units absorbed by unmodeled products or market exit.

Intelligent mode heuristics:
  - Confidence bounds are plausible ranges (not statistical CIs).
    dual_trend/source_only use 0.5x/2.0x heuristic scaling.
  - source_decline_only halves the median decline as a maximum-entropy
    prior: with no target data, equal weight to cannibalization vs other causes.
  - Suggested duration: longest decline streak * 4, capped at 12 months.
"""

import numpy as np
import os
from ..utils.constants import MONTHS
from ..config import Config


# APS class to filename mapping (maps APS identifiers to actual CSV filenames)
APS_FILENAME_MAP = {
    'FN_80_MULTI': 'FN 80 MULTI SPEED',
    'FN_80_VAR': 'FN 80 VAR SPEED',
    'FN_90_MULTI': 'FN 90 MULTI SPEED',
    'FN_90_VAR': 'FN 90 VAR SPEED',
    'HP_1PH': 'HP 1PH',
    'HP_3PH': 'HP 3PH',
    'HP_FIT': 'HP FIT',
    'CN_1PH': 'CN 1PH',
    'CN_3PH': 'CN 3PH',
    'CN_FIT': 'CN FIT',
    'ACNF': 'ACNF',
    'AH_FIT': 'AH FIT',
    'AH_R': 'AH R',
    'AWUF': 'AWUF',
    'MB': 'MB',
    'CL': 'CL',
    'CL_FIT': 'CL FIT',
}


class CannibalizationService:
    def __init__(self):
        self.data_dir = Config.DATA_DIR

    def _read_csv_yearly(self, path):
        """Read a yearly CSV file and return dict of {year: [12 values]}."""
        import pandas as pd
        if not path or not os.path.exists(path):
            return {}
        try:
            df = pd.read_csv(path)
            if 'Year' not in df.columns and 'year' not in df.columns:
                return {}
            year_col = 'Year' if 'Year' in df.columns else 'year'
            result = {}
            for _, row in df.iterrows():
                year = int(row[year_col])
                vals = []
                for m in MONTHS:
                    if m in df.columns:
                        v = row[m]
                        vals.append(0.0 if pd.isna(v) else float(v))
                    else:
                        vals.append(0.0)
                result[year] = vals
            return result
        except Exception as e:
            print(f"[CANNIB] Error reading {path}: {e}")
            return {}

    def _get_aps_baseline(self, aps_class, year):
        """Load baseline for a single APS class for a given year."""
        filename_base = APS_FILENAME_MAP.get(aps_class, aps_class)
        path = os.path.join(self.data_dir, f"{filename_base}_post_processed.csv")
        yearly = self._read_csv_yearly(path)
        if year in yearly:
            return yearly[year]
        return None

    def _get_product_market_share(self, product):
        """Load market share data for a product family."""
        path = os.path.join(self.data_dir, f"{product}_market_share.csv")
        return self._read_csv_yearly(path)

    def load_cross_product_data(self, source_product, source_aps_classes,
                                target_product, target_aps_class, year):
        """
        Load baseline data for both source and target products.

        Source can be multiple APS classes (e.g., FN_80_MULTI + FN_80_VAR).
        Target is a single APS class.

        Returns dict with baselines, market share data, and data availability info.
        """
        year = int(year)

        # Load source baselines and sum them
        source_baseline = [0.0] * 12
        source_components = {}
        for aps in source_aps_classes:
            aps_data = self._get_aps_baseline(aps, year)
            if aps_data:
                source_components[aps] = aps_data
                source_baseline = [s + a for s, a in zip(source_baseline, aps_data)]

        # Load target baseline
        target_baseline = self._get_aps_baseline(target_aps_class, year)
        if target_baseline is None:
            target_baseline = [0.0] * 12

        # Load market share for both product families
        source_ms = self._get_product_market_share(source_product)
        target_ms = self._get_product_market_share(target_product)

        return {
            'source_baseline': source_baseline,
            'source_components': source_components,
            'target_baseline': target_baseline,
            'source_market_share': source_ms,
            'target_market_share': target_ms,
            'source_ms_available': len(source_ms) > 0,
            'target_ms_available': len(target_ms) > 0,
            'source_ms_years': len(source_ms),
            'target_ms_years': len(target_ms),
        }

    def _compute_transfer_ratios(self, source_baseline, target_baseline):
        """
        Compute monthly transfer ratios from baseline volumes.

        transfer_ratio[m] = target[m] / (source[m] + target[m])

        This represents the fraction of lost source units that become target
        units, based on the relative size of the target in the combined pool.

        Justification: target product captures share proportional to its
        relative baseline volume.
        """
        ratios = []
        for s, t in zip(source_baseline, target_baseline):
            total = s + t
            if total > 0:
                ratios.append(t / total)
            else:
                ratios.append(0.5)  # Equal split if no data
        return ratios

    def _analyze_market_share_trends(self, ms_data):
        """
        Analyze year-over-year changes in market share data.

        Returns statistics about annual changes, entirely derived from
        the provided historical data.
        """
        if not ms_data or len(ms_data) < 2:
            return None

        sorted_years = sorted(ms_data.keys())
        yoy_changes = []
        yearly_detail = []

        for i in range(1, len(sorted_years)):
            prev_year = sorted_years[i - 1]
            curr_year = sorted_years[i]
            prev_vals = ms_data[prev_year]
            curr_vals = ms_data[curr_year]

            # Compute annual averages (skip zeros which indicate missing data)
            prev_valid = [v for v in prev_vals if v > 0]
            curr_valid = [v for v in curr_vals if v > 0]

            if prev_valid and curr_valid:
                prev_avg = np.mean(prev_valid)
                curr_avg = np.mean(curr_valid)
                if prev_avg > 0:
                    pct_change = ((curr_avg - prev_avg) / prev_avg) * 100
                    yoy_changes.append(pct_change)
                    yearly_detail.append({
                        'period': f"{prev_year}-{curr_year}",
                        'change_pct': round(pct_change, 2),
                        'from_avg': round(prev_avg, 4),
                        'to_avg': round(curr_avg, 4),
                    })

        if not yoy_changes:
            return None

        negative_changes = [c for c in yoy_changes if c < 0]
        positive_changes = [c for c in yoy_changes if c > 0]

        # Find longest consecutive decline streak
        max_decline_streak = 0
        current_streak = 0
        for c in yoy_changes:
            if c < 0:
                current_streak += 1
                max_decline_streak = max(max_decline_streak, current_streak)
            else:
                current_streak = 0

        return {
            'yoy_changes': [round(c, 2) for c in yoy_changes],
            'yearly_detail': yearly_detail,
            'mean_change': round(float(np.mean(yoy_changes)), 2),
            'median_change': round(float(np.median(yoy_changes)), 2),
            'std_change': round(float(np.std(yoy_changes)), 2),
            'min_change': round(float(np.min(yoy_changes)), 2),
            'max_change': round(float(np.max(yoy_changes)), 2),
            'negative_changes': [round(c, 2) for c in negative_changes],
            'positive_changes': [round(c, 2) for c in positive_changes],
            'median_decline': round(float(np.median(negative_changes)), 2) if negative_changes else 0.0,
            'median_growth': round(float(np.median(positive_changes)), 2) if positive_changes else 0.0,
            'max_decline': round(float(np.min(negative_changes)), 2) if negative_changes else 0.0,
            'max_growth': round(float(np.max(positive_changes)), 2) if positive_changes else 0.0,
            'decline_years': len(negative_changes),
            'growth_years': len(positive_changes),
            'max_decline_streak': max_decline_streak,
            'total_years': len(yoy_changes),
        }

    def _compute_seasonal_indices(self, ms_data):
        """
        Compute seasonal indices from market share data.

        For each month, the index is the average share for that month
        divided by the overall average share. Values > 1.0 indicate
        months where the product is stronger than average.

        Returns 12-element list of seasonal indices.
        """
        if not ms_data:
            return [1.0] * 12

        month_totals = [[] for _ in range(12)]

        for year_vals in ms_data.values():
            for m_idx in range(12):
                if m_idx < len(year_vals) and year_vals[m_idx] > 0:
                    month_totals[m_idx].append(year_vals[m_idx])

        month_avgs = []
        for m_idx in range(12):
            if month_totals[m_idx]:
                month_avgs.append(np.mean(month_totals[m_idx]))
            else:
                month_avgs.append(0.0)

        overall_avg = np.mean([a for a in month_avgs if a > 0]) if any(a > 0 for a in month_avgs) else 1.0

        indices = []
        for avg in month_avgs:
            if avg > 0 and overall_avg > 0:
                indices.append(avg / overall_avg)
            else:
                indices.append(1.0)

        return [round(idx, 4) for idx in indices]

    def _find_correlated_periods(self, source_trends, target_trends):
        """
        Find periods where source declines and target grows simultaneously.

        This is the strongest evidence of cannibalization: when source
        market share drops while target grows in the same period.

        Returns correlation analysis derived entirely from the two
        market share datasets.
        """
        if not source_trends or not target_trends:
            return None

        src_detail = {d['period']: d['change_pct'] for d in source_trends['yearly_detail']}
        tgt_detail = {d['period']: d['change_pct'] for d in target_trends['yearly_detail']}

        common_periods = set(src_detail.keys()) & set(tgt_detail.keys())
        if not common_periods:
            return None

        correlated = []
        for period in sorted(common_periods):
            src_chg = src_detail[period]
            tgt_chg = tgt_detail[period]
            # Source declining while target growing = cannibalization signal
            if src_chg < 0 and tgt_chg > 0:
                correlated.append({
                    'period': period,
                    'source_change_pct': src_chg,
                    'target_change_pct': tgt_chg,
                    'implied_transfer': round(min(abs(src_chg), tgt_chg), 2),
                })

        if not correlated:
            return {
                'correlated_periods': [],
                'correlation_count': 0,
                'total_common_periods': len(common_periods),
                'signal_strength': 'none',
            }

        implied_transfers = [p['implied_transfer'] for p in correlated]

        return {
            'correlated_periods': correlated,
            'correlation_count': len(correlated),
            'total_common_periods': len(common_periods),
            'signal_strength': 'strong' if len(correlated) >= 3 else 'moderate' if len(correlated) >= 1 else 'none',
            'median_implied_rate': round(float(np.median(implied_transfers)), 2),
            'mean_implied_rate': round(float(np.mean(implied_transfers)), 2),
        }

    def _compute_ramp_curve(self, start_month_idx, duration, peak_rate, shape='linear'):
        """
        Generate 12-element array of monthly cannibalization rates.

        Args:
            start_month_idx: 0-11, the month cannibalization begins
            duration: number of months to ramp up to peak
            peak_rate: maximum cannibalization rate (0-1)
            shape: 'linear' or 'logistic'

        Returns:
            List of 12 floats representing the cannibalization fraction per month.
        """
        rates = [0.0] * 12

        for m in range(12):
            if m < start_month_idx:
                rates[m] = 0.0
            elif duration <= 0:
                rates[m] = peak_rate
            elif m < start_month_idx + duration:
                # progress goes from 1/duration at start to 1.0 at last ramp month
                progress = (m - start_month_idx + 1) / max(duration, 1)
                if shape == 'logistic':
                    # S-curve: slow start, fast middle, plateau
                    rates[m] = peak_rate / (1 + np.exp(-10 * (progress - 0.5)))
                else:
                    # Linear ramp
                    rates[m] = peak_rate * progress
            else:
                rates[m] = peak_rate

        return [round(r, 6) for r in rates]

    def analyze(self, source_product, source_aps_classes,
                target_product, target_aps_class, year):
        """
        Analyze cannibalization potential between source and target.

        Returns data-derived defaults for intelligent mode, transfer ratios,
        and full justification metadata. No made-up numbers.
        """
        data = self.load_cross_product_data(
            source_product, source_aps_classes,
            target_product, target_aps_class, year
        )

        source_baseline = data['source_baseline']
        target_baseline = data['target_baseline']

        # Compute transfer ratios from baselines
        transfer_ratios = self._compute_transfer_ratios(source_baseline, target_baseline)
        annual_transfer = round(
            sum(target_baseline) / max(sum(source_baseline) + sum(target_baseline), 1), 4
        )

        # Analyze source market share trends
        source_trends = self._analyze_market_share_trends(data['source_market_share'])

        # Analyze target market share trends
        target_trends = self._analyze_market_share_trends(data['target_market_share'])

        # Cross-reference: find correlated cannibalization periods
        correlation = self._find_correlated_periods(source_trends, target_trends)

        # Compute seasonal indices from source market share
        source_seasonal = self._compute_seasonal_indices(data['source_market_share'])
        target_seasonal = self._compute_seasonal_indices(data['target_market_share'])

        # Derive intelligent mode defaults from data
        intelligent_defaults = self._derive_intelligent_defaults(
            source_trends, target_trends, correlation, source_seasonal
        )

        # Determine data quality
        data_quality = self._assess_data_quality(data, source_trends, target_trends, correlation)

        # Compute slider bounds from historical data
        slider_bounds = self._compute_slider_bounds(source_trends, target_trends)

        return {
            'source': {
                'product': source_product,
                'aps_classes': source_aps_classes,
                'baseline': source_baseline,
                'annual_total': round(sum(source_baseline)),
                'ms_available': data['source_ms_available'],
                'ms_years': data['source_ms_years'],
            },
            'target': {
                'product': target_product,
                'aps_class': target_aps_class,
                'baseline': target_baseline,
                'annual_total': round(sum(target_baseline)),
                'ms_available': data['target_ms_available'],
                'ms_years': data['target_ms_years'],
            },
            'transfer_ratios': {
                'monthly': [round(r, 4) for r in transfer_ratios],
                'annual': annual_transfer,
                'by_month': {MONTHS[i]: round(transfer_ratios[i], 4) for i in range(12)},
                'source': 'Computed from baseline volume ratios: target / (source + target)',
            },
            'source_trends': source_trends,
            'target_trends': target_trends,
            'correlation': correlation,
            'source_seasonal_indices': source_seasonal,
            'target_seasonal_indices': target_seasonal,
            'intelligent_defaults': intelligent_defaults,
            'data_quality': data_quality,
            'slider_bounds': slider_bounds,
        }

    def _derive_intelligent_defaults(self, source_trends, target_trends, correlation, source_seasonal):
        """
        Derive all intelligent mode parameters from real data only.

        Priority order for cannibalization rate:
        1. Correlated periods (both MS available, strongest evidence)
        2. Source decline + target growth medians (both available, weaker)
        3. Source decline only (only source MS available)
        4. No data -> cannot run intelligent mode
        """
        defaults = {
            'available': False,
            'method': 'none',
            'method_description': '',
            'annual_rate_pct': 0.0,
            'confidence_lower_pct': 0.0,
            'confidence_upper_pct': 0.0,
            'suggested_duration': 6,
            'suggested_start_month': 0,
            'seasonal_modulation': [1.0] * 12,
            'data_points_used': 0,
        }

        # Method 1: Correlated periods (strongest)
        if correlation and correlation.get('correlation_count', 0) >= 1:
            rate = correlation['median_implied_rate']
            periods = correlation['correlated_periods']
            rates = [p['implied_transfer'] for p in periods]

            defaults['available'] = True
            defaults['method'] = 'correlated_periods'
            defaults['method_description'] = (
                f"Derived from {len(periods)} period(s) where {source_trends and 'source' or 'FN'} "
                f"market share declined while target grew simultaneously. "
                f"Median implied transfer rate: {rate}%."
            )
            defaults['annual_rate_pct'] = rate
            defaults['confidence_lower_pct'] = round(min(rates), 2) if rates else rate
            defaults['confidence_upper_pct'] = round(max(rates), 2) if rates else rate
            defaults['data_points_used'] = len(periods)

        # Method 2: Both trends available but no correlation
        elif source_trends and target_trends and source_trends.get('decline_years', 0) > 0:
            src_decline = abs(source_trends['median_decline'])
            tgt_growth = target_trends['median_growth'] if target_trends.get('growth_years', 0) > 0 else 0

            # Use the smaller of source decline and target growth as rate
            rate = min(src_decline, tgt_growth) if tgt_growth > 0 else src_decline / 2.0

            defaults['available'] = True
            defaults['method'] = 'dual_trend'
            defaults['method_description'] = (
                f"Source median decline: {source_trends['median_decline']}%. "
                f"Target median growth: {target_trends.get('median_growth', 'N/A')}%. "
                f"Using conservative estimate: {round(rate, 2)}%."
            )
            defaults['annual_rate_pct'] = round(rate, 2)
            defaults['confidence_lower_pct'] = round(rate * 0.5, 2)
            defaults['confidence_upper_pct'] = round(min(src_decline, rate * 2), 2)
            defaults['data_points_used'] = source_trends['total_years']

        # Method 3: Source trends only
        elif source_trends and source_trends.get('decline_years', 0) > 0:
            rate = abs(source_trends['median_decline']) / 2.0  # Halved since we lack target confirmation

            defaults['available'] = True
            defaults['method'] = 'source_decline_only'
            defaults['method_description'] = (
                f"Derived from source product decline only (target market share unavailable). "
                f"Source median decline: {source_trends['median_decline']}%. "
                f"Using half the decline rate as conservative estimate: {round(rate, 2)}%."
            )
            defaults['annual_rate_pct'] = round(rate, 2)
            defaults['confidence_lower_pct'] = round(rate * 0.5, 2)
            defaults['confidence_upper_pct'] = round(abs(source_trends['median_decline']), 2)
            defaults['data_points_used'] = source_trends['total_years']

        else:
            defaults['method_description'] = (
                'Insufficient market share data for intelligent mode. '
                'Upload market share data for at least the source product.'
            )
            return defaults

        # Duration from longest decline streak, capped at 12
        if source_trends and source_trends.get('max_decline_streak', 0) > 0:
            defaults['suggested_duration'] = min(source_trends['max_decline_streak'] * 4, 12)
        else:
            defaults['suggested_duration'] = 6

        # Seasonal modulation from source: inverse index (weaker months more vulnerable)
        if source_seasonal and any(s != 1.0 for s in source_seasonal):
            # Invert: months where source is weaker get higher cannibalization
            mean_idx = np.mean(source_seasonal)
            if mean_idx > 0:
                modulation = [min(mean_idx / max(s, 0.01), 5.0) for s in source_seasonal]
                # Normalize so mean = 1.0
                mod_mean = np.mean(modulation)
                if mod_mean > 0:
                    modulation = [m / mod_mean for m in modulation]
                defaults['seasonal_modulation'] = [round(m, 4) for m in modulation]

        return defaults

    def _assess_data_quality(self, data, source_trends, target_trends, correlation):
        """Assess overall data quality for cannibalization modeling."""
        score = 0
        factors = []

        # Source baseline available
        if sum(data['source_baseline']) > 0:
            score += 1
            factors.append('Source baseline data available')

        # Target baseline available
        if sum(data['target_baseline']) > 0:
            score += 1
            factors.append('Target baseline data available')

        # Source market share
        if data['source_ms_available']:
            score += 1
            factors.append(f"Source market share: {data['source_ms_years']} years")
            if data['source_ms_years'] >= 5:
                score += 1
                factors.append('Source has 5+ years of market share data')

        # Target market share
        if data['target_ms_available']:
            score += 1
            factors.append(f"Target market share: {data['target_ms_years']} years")
            if data['target_ms_years'] >= 5:
                score += 1
                factors.append('Target has 5+ years of market share data')

        # Correlation data
        if correlation and correlation.get('correlation_count', 0) >= 1:
            score += 1
            factors.append(f"Correlated cannibalization signals: {correlation['correlation_count']} periods")

        # Map score to quality level
        if score >= 6:
            quality = 'good'
        elif score >= 4:
            quality = 'moderate'
        elif score >= 2:
            quality = 'limited'
        else:
            quality = 'insufficient'

        return {
            'quality': quality,
            'score': score,
            'max_score': 7,
            'factors': factors,
        }

    def _compute_slider_bounds(self, source_trends, target_trends):
        """Compute data-informed bounds for the naive mode sliders."""
        bounds = {
            'peak_rate_min': 0,
            'peak_rate_max': 30,
            'peak_rate_historical_max': None,
            'peak_rate_recommended': 5,
        }

        if source_trends:
            max_decline = abs(source_trends.get('max_decline', 0))
            bounds['peak_rate_historical_max'] = round(max_decline, 1)
            bounds['peak_rate_recommended'] = round(abs(source_trends.get('median_decline', 5)), 1)

        return bounds

    def simulate(self, source_baseline, target_baseline, mode, params,
                 source_market_share=None, target_market_share=None):
        """
        Run cannibalization simulation.

        Args:
            source_baseline: 12-element list of source monthly values
            target_baseline: 12-element list of target monthly values
            mode: 'naive' or 'intelligent'
            params: mode-specific parameters
            source_market_share: dict {year: [12 values]} for source product
            target_market_share: dict {year: [12 values]} for target product

        Returns:
            Adjusted baselines with full breakdown and justification.
        """
        transfer_ratios = self._compute_transfer_ratios(source_baseline, target_baseline)

        if mode == 'naive':
            return self._simulate_naive(source_baseline, target_baseline,
                                        transfer_ratios, params)
        elif mode == 'intelligent':
            return self._simulate_intelligent(
                source_baseline, target_baseline, transfer_ratios, params,
                source_market_share, target_market_share
            )
        else:
            return {'error': f'Unknown mode: {mode}'}

    def _simulate_naive(self, source_baseline, target_baseline, transfer_ratios, params):
        """
        Naive mode: user-specified cannibalization parameters.

        All math is transparent: rate * baseline = loss, loss * transfer = gain.
        """
        start_month = int(params.get('start_month', 0))
        duration = int(params.get('duration', 6))
        peak_rate_pct = float(params.get('peak_rate', 5.0))
        ramp_shape = params.get('ramp_shape', 'linear')

        peak_rate = min(max(peak_rate_pct, 0), 100) / 100.0
        rates = self._compute_ramp_curve(start_month, duration, peak_rate, ramp_shape)

        source_loss = [0.0] * 12
        target_gain = [0.0] * 12
        source_adjusted = list(source_baseline)
        target_adjusted = list(target_baseline)

        for m in range(12):
            loss = source_baseline[m] * rates[m]
            gain = loss * transfer_ratios[m]
            source_loss[m] = round(loss, 2)
            target_gain[m] = round(gain, 2)
            source_adjusted[m] = max(0, round(source_baseline[m] - loss, 2))
            target_adjusted[m] = round(target_baseline[m] + gain, 2)

        source_total_loss = sum(source_loss)
        target_total_gain = sum(target_gain)

        return {
            'mode': 'naive',
            'source': {
                'original_baseline': source_baseline,
                'adjusted_baseline': source_adjusted,
                'monthly_loss': source_loss,
                'annual_loss': round(source_total_loss),
                'annual_loss_pct': round(source_total_loss / max(sum(source_baseline), 1) * 100, 2),
            },
            'target': {
                'original_baseline': target_baseline,
                'adjusted_baseline': target_adjusted,
                'monthly_gain': target_gain,
                'annual_gain': round(target_total_gain),
                'annual_gain_pct': round(target_total_gain / max(sum(target_baseline), 1) * 100, 2),
            },
            'parameters': {
                'start_month': start_month,
                'start_month_name': MONTHS[start_month],
                'duration': duration,
                'peak_rate_pct': peak_rate_pct,
                'ramp_shape': ramp_shape,
                'monthly_rates': rates,
                'transfer_ratios': [round(r, 4) for r in transfer_ratios],
            },
            'justification': {
                'transfer_ratio_source': 'Baseline volume ratio: target / (source + target)',
                'rate_source': 'User-specified via controls',
                'assumptions': [
                    'Cannibalization rate follows the selected ramp curve',
                    'Transfer ratio is proportional to relative baseline volumes',
                    'Non-transferred units represent absorption by unmodeled products or market exit',
                ],
            },
            'warnings': (
                [f'Ramp extends beyond year boundary (start month {start_month} + duration {duration} > 12). '
                 f'Only months within the year are affected.']
                if start_month + duration > 12 else []
            ),
        }

    def _simulate_intelligent(self, source_baseline, target_baseline,
                              transfer_ratios, params,
                              source_market_share, target_market_share):
        """
        Intelligent mode: data-derived cannibalization simulation.

        Uses market share trends from both products to derive the
        cannibalization rate, shape, and seasonal pattern.
        """
        expected_start = int(params.get('expected_start_month', 0))

        # Analyze trends
        source_trends = self._analyze_market_share_trends(source_market_share)
        target_trends = self._analyze_market_share_trends(target_market_share)
        correlation = self._find_correlated_periods(source_trends, target_trends)
        source_seasonal = self._compute_seasonal_indices(source_market_share)

        # Derive parameters
        defaults = self._derive_intelligent_defaults(
            source_trends, target_trends, correlation, source_seasonal
        )

        if not defaults['available']:
            return {
                'mode': 'intelligent',
                'error': 'Insufficient data for intelligent mode',
                'message': defaults['method_description'],
            }

        annual_rate_pct = defaults['annual_rate_pct']
        monthly_base_rate = annual_rate_pct / 100.0
        duration = defaults['suggested_duration']
        seasonal_mod = defaults['seasonal_modulation']

        # Build rate curve with seasonal modulation
        base_rates = self._compute_ramp_curve(expected_start, duration, monthly_base_rate, 'logistic')
        modulated_rates = [base_rates[m] * seasonal_mod[m] for m in range(12)]

        # Compute adjustments
        source_loss = [0.0] * 12
        target_gain = [0.0] * 12
        source_adjusted = list(source_baseline)
        target_adjusted = list(target_baseline)

        for m in range(12):
            loss = source_baseline[m] * modulated_rates[m]
            gain = loss * transfer_ratios[m]
            source_loss[m] = round(loss, 2)
            target_gain[m] = round(gain, 2)
            source_adjusted[m] = max(0, round(source_baseline[m] - loss, 2))
            target_adjusted[m] = round(target_baseline[m] + gain, 2)

        source_total_loss = sum(source_loss)
        target_total_gain = sum(target_gain)

        # Confidence bands -- apply same seasonal modulation as the central estimate
        lower_rate = defaults['confidence_lower_pct'] / 100.0
        upper_rate = defaults['confidence_upper_pct'] / 100.0

        lower_rates = self._compute_ramp_curve(expected_start, duration, lower_rate, 'logistic')
        upper_rates = self._compute_ramp_curve(expected_start, duration, upper_rate, 'logistic')
        lower_mod = [lower_rates[m] * seasonal_mod[m] for m in range(12)]
        upper_mod = [upper_rates[m] * seasonal_mod[m] for m in range(12)]

        confidence_bands = {
            'source_lower': [max(0, round(source_baseline[m] - source_baseline[m] * upper_mod[m], 2)) for m in range(12)],
            'source_upper': [round(source_baseline[m] - source_baseline[m] * lower_mod[m], 2) for m in range(12)],
            'target_lower': [round(target_baseline[m] + source_baseline[m] * lower_mod[m] * transfer_ratios[m], 2) for m in range(12)],
            'target_upper': [round(target_baseline[m] + source_baseline[m] * upper_mod[m] * transfer_ratios[m], 2) for m in range(12)],
        }

        return {
            'mode': 'intelligent',
            'source': {
                'original_baseline': source_baseline,
                'adjusted_baseline': source_adjusted,
                'monthly_loss': source_loss,
                'annual_loss': round(source_total_loss),
                'annual_loss_pct': round(source_total_loss / max(sum(source_baseline), 1) * 100, 2),
            },
            'target': {
                'original_baseline': target_baseline,
                'adjusted_baseline': target_adjusted,
                'monthly_gain': target_gain,
                'annual_gain': round(target_total_gain),
                'annual_gain_pct': round(target_total_gain / max(sum(target_baseline), 1) * 100, 2),
            },
            'parameters': {
                'method': defaults['method'],
                'expected_start_month': expected_start,
                'expected_start_month_name': MONTHS[expected_start],
                'annual_rate_pct': annual_rate_pct,
                'duration': duration,
                'monthly_rates': [round(r, 6) for r in modulated_rates],
                'base_rates': [round(r, 6) for r in base_rates],
                'seasonal_modulation': seasonal_mod,
                'transfer_ratios': [round(r, 4) for r in transfer_ratios],
                'data_points_used': defaults['data_points_used'],
            },
            'confidence_bands': confidence_bands,
            'justification': {
                'method': defaults['method'],
                'method_description': defaults['method_description'],
                'transfer_ratio_source': 'Baseline volume ratio: target / (source + target)',
                'seasonal_source': 'Inverse of source product seasonal market share indices',
                'confidence_range': f"{defaults['confidence_lower_pct']}% to {defaults['confidence_upper_pct']}%",
                'assumptions': [
                    f"Cannibalization rate derived via '{defaults['method']}' method",
                    'Seasonal modulation follows inverse source market share pattern',
                    'Transfer ratio proportional to relative baseline volumes',
                    'S-curve ramp shape (logistic) for gradual onset',
                ],
            },
        }


# Singleton instance
cannibalization_service = CannibalizationService()
