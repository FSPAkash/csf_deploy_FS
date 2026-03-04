"""
Beta Market Share Service - Honest Intelligence Implementation

This service provides market share calculations with:
1. Transparent uncertainty quantification
2. Clear distinction between data-driven and assumption-driven outputs
3. Statistical validation and confidence intervals
4. No fabricated data or made-up correlations
"""

import numpy as np
from scipy import stats
from ..utils.constants import MONTHS


class MarketShareBetaService:
    """Enhanced market share service with honest intelligence"""

    def calculate_relative_change(self, delta_pct, historical_data=None):
        """
        Mode 1: Relative Change - uniform adjustment with historical validation

        Returns adjustment AND metadata about whether input is within historical norms
        """
        adjustment = 1.0 + (delta_pct / 100.0)
        adjustments = {m: adjustment for m in MONTHS}

        # Calculate metadata
        metadata = {
            'mode': 'relative',
            'input_delta_pct': delta_pct,
            'data_driven': False,
            'assumptions': ['Uniform adjustment applied to all months'],
            'limitations': ['Does not account for seasonality or external factors']
        }

        # If historical data provided, validate against observed ranges
        if historical_data and len(historical_data) >= 2:
            yoy_changes = self._calculate_yoy_changes(historical_data)
            if yoy_changes:
                metadata['historical_validation'] = {
                    'min_observed_yoy': round(min(yoy_changes) * 100, 1),
                    'max_observed_yoy': round(max(yoy_changes) * 100, 1),
                    'mean_observed_yoy': round(np.mean(yoy_changes) * 100, 1),
                    'input_within_range': bool(min(yoy_changes) <= (delta_pct / 100) <= max(yoy_changes)),
                    'percentile': self._calculate_percentile(delta_pct / 100, yoy_changes)
                }

                # Add warning if outside historical range
                if not metadata['historical_validation']['input_within_range']:
                    metadata['warnings'] = [
                        f"Input of {delta_pct}% is outside historically observed range "
                        f"({metadata['historical_validation']['min_observed_yoy']}% to "
                        f"{metadata['historical_validation']['max_observed_yoy']}%)"
                    ]

        return {
            'adjustments': adjustments,
            'metadata': metadata
        }

    def calculate_historical_trend(
        self,
        market_share_data,
        selected_year,
        trend_strength=100,
        apply_seasonality=True
    ):
        """
        Mode 2: Historical Trend - data-driven projection with confidence intervals

        Returns adjustments with R-squared, confidence interval, and data quality info
        """
        metadata = {
            'mode': 'historical',
            'data_driven': True,
            'trend_strength_pct': trend_strength,
            'seasonality_applied': apply_seasonality
        }

        if not market_share_data:
            return {
                'adjustments': {m: 1.0 for m in MONTHS},
                'metadata': {
                    **metadata,
                    'error': 'No market share data provided',
                    'data_quality': 'none'
                }
            }

        # Get complete years
        complete_years = self._get_complete_years(market_share_data, selected_year)

        if len(complete_years) < 2:
            return {
                'adjustments': {m: 1.0 for m in MONTHS},
                'metadata': {
                    **metadata,
                    'error': 'Insufficient historical data (need at least 2 complete years)',
                    'years_available': len(complete_years),
                    'data_quality': 'insufficient'
                }
            }

        # Calculate annual averages
        annual_avg = {year: np.mean(market_share_data[year]) for year in complete_years}

        years_array = np.array(list(annual_avg.keys()))
        ms_array = np.array(list(annual_avg.values()))

        # Linear regression with full statistics
        years_normalized = years_array - min(years_array)
        slope, intercept, r_value, p_value, std_err = stats.linregress(years_normalized, ms_array)

        r_squared = r_value ** 2

        # Calculate confidence interval for the slope
        n = len(years_array)
        t_critical = stats.t.ppf(0.975, n - 2)  # 95% CI
        slope_ci = t_critical * std_err

        # Project to forecast year
        forecast_offset = selected_year - min(years_array)
        projected_avg = intercept + (slope * forecast_offset)

        # Calculate prediction interval
        x_mean = np.mean(years_normalized)
        ss_x = np.sum((years_normalized - x_mean) ** 2)
        residuals = ms_array - (intercept + slope * years_normalized)
        mse = np.sum(residuals ** 2) / (n - 2)

        se_pred = np.sqrt(mse * (1 + 1/n + (forecast_offset - x_mean)**2 / ss_x))
        prediction_ci = t_critical * se_pred

        # Calculate delta from latest year
        latest_year = max(complete_years)
        latest_avg = annual_avg[latest_year]

        delta = (projected_avg - latest_avg) / latest_avg if latest_avg > 0 else 0
        final_delta = delta * (trend_strength / 100.0)

        # Calculate delta confidence interval
        delta_lower = ((projected_avg - prediction_ci) - latest_avg) / latest_avg if latest_avg > 0 else 0
        delta_upper = ((projected_avg + prediction_ci) - latest_avg) / latest_avg if latest_avg > 0 else 0

        # Seasonal indices
        seasonal_index = {}
        seasonal_stats = {}
        if apply_seasonality:
            for month_idx in range(12):
                month_values = [market_share_data[year][month_idx] for year in complete_years]
                month_avg = np.mean(month_values)
                month_std = np.std(month_values)
                overall_avg = np.mean(ms_array)
                seasonal_index[month_idx] = month_avg / overall_avg if overall_avg > 0 else 1.0
                seasonal_stats[MONTHS[month_idx]] = {
                    'index': round(seasonal_index[month_idx], 3),
                    'std': round(month_std, 4)
                }
        else:
            seasonal_index = {i: 1.0 for i in range(12)}

        # Apply adjustments
        adjustments = {}
        adjustment_details = {}
        for month_idx, month in enumerate(MONTHS):
            month_delta = final_delta * seasonal_index[month_idx]
            adjustments[month] = 1.0 + month_delta
            adjustment_details[month] = {
                'base_delta': round(final_delta * 100, 2),
                'seasonal_factor': round(seasonal_index[month_idx], 3),
                'final_adjustment': round(adjustments[month], 4)
            }

        # Determine data quality rating
        if n >= 5 and r_squared >= 0.7:
            data_quality = 'good'
        elif n >= 3 and r_squared >= 0.5:
            data_quality = 'moderate'
        else:
            data_quality = 'limited'

        metadata.update({
            'years_used': complete_years,
            'n_years': n,
            'data_quality': data_quality,
            'regression_stats': {
                'slope_annual_pct': round(slope / latest_avg * 100, 2) if latest_avg > 0 else 0,
                'r_squared': round(float(r_squared), 3),
                'p_value': round(float(p_value), 4),
                'is_significant': bool(p_value < 0.05)
            },
            'projection': {
                'point_estimate_delta_pct': round(final_delta * 100, 2),
                'confidence_interval_95': {
                    'lower_pct': round(delta_lower * (trend_strength / 100) * 100, 2),
                    'upper_pct': round(delta_upper * (trend_strength / 100) * 100, 2)
                }
            },
            'seasonal_indices': seasonal_stats if apply_seasonality else None,
            'adjustment_details': adjustment_details,
            'assumptions': [
                'Linear trend assumed',
                'Past performance extrapolated to future',
                'No external factors considered'
            ],
            'limitations': [
                f'Based on only {n} years of data' if n < 5 else None,
                'Trend may not continue' if r_squared < 0.7 else None,
                'Result not statistically significant (p > 0.05)' if p_value >= 0.05 else None
            ]
        })

        # Filter out None limitations
        metadata['limitations'] = [l for l in metadata['limitations'] if l]

        # Add warnings
        warnings = []
        if r_squared < 0.5:
            warnings.append(f"Low R-squared ({round(r_squared, 2)}) indicates weak trend fit")
        if p_value >= 0.05:
            warnings.append("Trend is not statistically significant at 95% confidence")
        if n < 3:
            warnings.append("Very limited data - results highly uncertain")
        if metadata['limitations']:
            metadata['warnings'] = warnings

        return {
            'adjustments': adjustments,
            'metadata': metadata
        }

    def calculate_competitive_scenario(self, scenario_config):
        """
        Mode 3: Competitive Scenario (renamed from Intelligence)

        Honest approach: User defines the scenario, system applies it transparently
        No pretense of detecting or predicting competitive actions
        """
        scenario_type = scenario_config.get('type', 'single')

        metadata = {
            'mode': 'competitive_scenario',
            'scenario_type': scenario_type,
            'data_driven': False,
            'assumptions': ['User-defined scenario'],
            'limitations': ['Impact estimates are assumptions, not predictions']
        }

        if scenario_type == 'single':
            result = self._single_event_scenario(
                scenario_config.get('month', 'Jan'),
                scenario_config.get('impact', 0),
                scenario_config.get('duration', 1)
            )
        elif scenario_type == 'gradual':
            result = self._gradual_shift_scenario(
                scenario_config.get('start_month', 'Apr'),
                scenario_config.get('end_month', 'Sep'),
                scenario_config.get('cumulative_impact', -10)
            )
        elif scenario_type == 'recovery':
            result = self._recovery_scenario(
                scenario_config.get('loss_duration', 3),
                scenario_config.get('initial_loss', -15),
                scenario_config.get('recovery_duration', 5)
            )
        else:
            result = {
                'adjustments': {m: 1.0 for m in MONTHS},
                'scenario_details': {}
            }

        metadata['scenario_details'] = result.get('scenario_details', {})
        metadata['user_inputs'] = scenario_config

        return {
            'adjustments': result['adjustments'],
            'metadata': metadata
        }

    def calculate_macro_scenario(self, market_growth, our_capacity, elasticity=1.0):
        """
        Mode 4: Macro Scenario - market size vs capacity with explicit elasticity

        Elasticity = 1.0 means 1:1 relationship (default, assumed)
        User can override if they have validated elasticity from prior analysis
        """
        relative_growth = our_capacity - market_growth
        adjustment = 1.0 + (relative_growth / 100.0) * elasticity
        adjustments = {m: adjustment for m in MONTHS}

        metadata = {
            'mode': 'macro_scenario',
            'data_driven': False,
            'inputs': {
                'market_growth_pct': market_growth,
                'our_capacity_pct': our_capacity,
                'elasticity': elasticity
            },
            'calculated': {
                'relative_growth_pct': relative_growth,
                'final_adjustment': round(adjustment, 4)
            },
            'assumptions': [
                f'Elasticity of {elasticity} assumed (1.0 = 1:1 relationship)',
                'Market share change equals capacity differential times elasticity',
                'Uniform effect across all months'
            ],
            'limitations': [
                'Elasticity is an assumption unless validated by prior analysis',
                'Does not account for competitive responses',
                'Does not account for demand elasticity'
            ]
        }

        if elasticity == 1.0:
            metadata['warnings'] = [
                'Using default elasticity of 1.0. Override if you have validated data.'
            ]

        return {
            'adjustments': adjustments,
            'metadata': metadata
        }

    def get_data_summary(self, market_share_data, selected_year):
        """
        Provide a summary of available data quality and what analysis is possible
        """
        if not market_share_data:
            return {
                'has_data': False,
                'message': 'No market share data available'
            }

        complete_years = self._get_complete_years(market_share_data, selected_year)
        all_years = sorted(market_share_data.keys())

        summary = {
            'has_data': True,
            'total_years': len(all_years),
            'complete_years': len(complete_years),
            'year_range': f"{min(all_years)}-{max(all_years)}" if all_years else None,
            'usable_years': complete_years,
            'capabilities': {
                'relative_change': True,  # Always available
                'historical_trend': len(complete_years) >= 2,
                'historical_trend_reliable': len(complete_years) >= 4,
                'competitive_scenario': True,  # Always available (user-driven)
                'macro_scenario': True  # Always available (user-driven)
            }
        }

        if complete_years:
            # Calculate basic stats
            all_values = []
            for year in complete_years:
                all_values.extend(market_share_data[year])

            summary['statistics'] = {
                'overall_mean': round(np.mean(all_values), 4),
                'overall_std': round(np.std(all_values), 4),
                'coefficient_of_variation': round(np.std(all_values) / np.mean(all_values), 3) if np.mean(all_values) > 0 else None
            }

            # YoY changes
            yoy_changes = self._calculate_yoy_changes(market_share_data)
            if yoy_changes:
                summary['yoy_statistics'] = {
                    'mean_yoy_pct': round(np.mean(yoy_changes) * 100, 2),
                    'std_yoy_pct': round(np.std(yoy_changes) * 100, 2),
                    'min_yoy_pct': round(min(yoy_changes) * 100, 2),
                    'max_yoy_pct': round(max(yoy_changes) * 100, 2)
                }

        return summary

    # Helper methods

    def _get_complete_years(self, market_share_data, selected_year):
        """Get years with complete 12-month data, excluding forecast year"""
        complete = []
        for year, values in market_share_data.items():
            if year >= selected_year:
                continue
            if len(values) == 12 and all(v is not None and not np.isnan(v) and v > 0 for v in values):
                complete.append(year)
        return sorted(complete)

    def _calculate_yoy_changes(self, market_share_data):
        """Calculate year-over-year percentage changes"""
        years = sorted([y for y in market_share_data.keys() if len(market_share_data[y]) == 12])
        if len(years) < 2:
            return []

        changes = []
        for i in range(1, len(years)):
            prev_avg = np.mean(market_share_data[years[i-1]])
            curr_avg = np.mean(market_share_data[years[i]])
            if prev_avg > 0:
                changes.append((curr_avg - prev_avg) / prev_avg)

        return changes

    def _calculate_percentile(self, value, distribution):
        """Calculate what percentile a value falls into"""
        if not distribution:
            return None
        return round(stats.percentileofscore(distribution, value), 1)

    def _single_event_scenario(self, event_month, impact, duration):
        """Single event with specified duration"""
        adjustments = {m: 1.0 for m in MONTHS}
        start_idx = MONTHS.index(event_month)

        affected_months = []
        for i in range(start_idx, min(start_idx + duration, 12)):
            adjustments[MONTHS[i]] = 1.0 + (impact / 100.0)
            affected_months.append(MONTHS[i])

        return {
            'adjustments': adjustments,
            'scenario_details': {
                'event_month': event_month,
                'impact_pct': impact,
                'duration_months': duration,
                'affected_months': affected_months
            }
        }

    def _gradual_shift_scenario(self, start_month, end_month, cumulative_impact):
        """Gradual shift between two months"""
        adjustments = {m: 1.0 for m in MONTHS}
        start_idx = MONTHS.index(start_month)
        end_idx = MONTHS.index(end_month)

        if end_idx < start_idx:
            return {'adjustments': adjustments, 'scenario_details': {'error': 'End month before start month'}}

        transition_months = end_idx - start_idx + 1
        monthly_impacts = {}

        for i, month in enumerate(MONTHS):
            if i < start_idx:
                adjustments[month] = 1.0
            elif i <= end_idx:
                progress = (i - start_idx + 1) / transition_months
                impact = cumulative_impact * progress
                adjustments[month] = 1.0 + (impact / 100.0)
                monthly_impacts[month] = round(impact, 2)
            else:
                adjustments[month] = 1.0 + (cumulative_impact / 100.0)
                monthly_impacts[month] = cumulative_impact

        return {
            'adjustments': adjustments,
            'scenario_details': {
                'start_month': start_month,
                'end_month': end_month,
                'cumulative_impact_pct': cumulative_impact,
                'monthly_impacts': monthly_impacts
            }
        }

    def _recovery_scenario(self, loss_duration, initial_loss, recovery_duration):
        """Loss followed by recovery"""
        adjustments = {m: 1.0 for m in MONTHS}
        monthly_impacts = {}

        for i, month in enumerate(MONTHS):
            if i < loss_duration:
                adjustments[month] = 1.0 + (initial_loss / 100.0)
                monthly_impacts[month] = initial_loss
            elif i < loss_duration + recovery_duration:
                recovery_progress = (i - loss_duration + 1) / recovery_duration
                current_impact = initial_loss * (1 - recovery_progress)
                adjustments[month] = 1.0 + (current_impact / 100.0)
                monthly_impacts[month] = round(current_impact, 2)
            else:
                adjustments[month] = 1.0
                monthly_impacts[month] = 0

        return {
            'adjustments': adjustments,
            'scenario_details': {
                'loss_duration_months': loss_duration,
                'initial_loss_pct': initial_loss,
                'recovery_duration_months': recovery_duration,
                'monthly_impacts': monthly_impacts
            }
        }


# Singleton instance
market_share_beta_service = MarketShareBetaService()
