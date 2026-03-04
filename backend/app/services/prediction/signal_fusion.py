"""
Signal Fusion Service
Combines multiple signals (trend, seasonality, events) into final prediction.
All signal contributions are tracked for attribution.
"""

import numpy as np
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

from .time_series import TimeSeriesModel, ForecastResult, get_time_series_model
from .impact_model import ImpactModel, ImpactEstimate, get_impact_model


@dataclass
class SignalContribution:
    """Contribution of a single signal to the prediction."""
    signal_name: str
    signal_type: str  # 'baseline', 'trend', 'seasonal', 'event', 'economic'
    value: float  # Absolute contribution
    percentage: float  # Percentage contribution
    trust_score: float
    source: str
    is_data_driven: bool


@dataclass
class FusedPrediction:
    """Final fused prediction with full attribution."""
    target_month: str
    target_year: int
    baseline_value: float
    predicted_value: float
    confidence_lower: float
    confidence_upper: float
    combined_trust_score: float
    signal_contributions: List[SignalContribution]
    primary_drivers: List[str]
    warnings: List[str]
    data_quality: str


class SignalFusion:
    """
    Fuses multiple signals into a single prediction.

    Signals:
    1. Baseline forecast (from internal data)
    2. Historical trend (regression on market share)
    3. Seasonal patterns (month-specific indices)
    4. Event impacts (from intelligence extraction)
    5. Economic indicators (if available)

    All contributions are tracked for interpretability.
    """

    # Signal weights (sum to 1.0)
    DEFAULT_WEIGHTS = {
        'trend': 0.25,
        'seasonal': 0.20,
        'events': 0.35,
        'economic': 0.10,
        'baseline_adjustment': 0.10
    }

    def __init__(
        self,
        time_series_model: Optional[TimeSeriesModel] = None,
        impact_model: Optional[ImpactModel] = None
    ):
        self.time_series_model = time_series_model or get_time_series_model()
        self.impact_model = impact_model or get_impact_model()

    def fuse_signals(
        self,
        market_share_data: Dict[int, List[float]],
        target_year: int,
        target_month: str,
        baseline_value: float,
        events: Optional[List[Dict]] = None,
        economic_indicator: Optional[float] = None,
        apply_trend: bool = True,
        apply_seasonality: bool = True,
        trend_strength: float = 1.0
    ) -> FusedPrediction:
        """
        Fuse all signals into a single prediction.

        Args:
            market_share_data: Historical market share data
            target_year: Year to predict
            target_month: Month to predict
            baseline_value: Starting baseline value
            events: List of intelligence events to include
            economic_indicator: Optional economic adjustment factor
            apply_trend: Whether to apply historical trend
            apply_seasonality: Whether to apply seasonal indices
            trend_strength: Multiplier for trend effect

        Returns:
            FusedPrediction with full attribution
        """
        contributions = []
        warnings = []
        total_adjustment = 0
        total_variance = 0

        # 1. Baseline contribution
        contributions.append(SignalContribution(
            signal_name='Baseline Forecast',
            signal_type='baseline',
            value=baseline_value,
            percentage=100.0,  # Will be recalculated
            trust_score=1.0,
            source='Internal forecast data',
            is_data_driven=True
        ))

        # 2. Historical trend contribution
        if apply_trend:
            trend_result = self.time_series_model.analyze_trend(market_share_data)
            if trend_result and trend_result.is_significant:
                years_ahead = target_year - max(trend_result.years_analyzed)
                trend_adjustment = trend_result.slope * years_ahead * trend_strength

                # Scale to baseline
                if baseline_value > 0:
                    scaled_adjustment = (trend_adjustment / baseline_value) * baseline_value
                else:
                    scaled_adjustment = trend_adjustment

                total_adjustment += scaled_adjustment

                contributions.append(SignalContribution(
                    signal_name='Historical Trend',
                    signal_type='trend',
                    value=scaled_adjustment,
                    percentage=0,  # Will be calculated
                    trust_score=min(1.0, trend_result.r_squared + 0.3),
                    source=f'Linear regression (R²={trend_result.r_squared:.2f}, p={trend_result.p_value:.3f})',
                    is_data_driven=True
                ))

                # Add variance
                trend_variance = ((trend_result.confidence_interval[1] - trend_result.confidence_interval[0]) / 2) ** 2
                total_variance += trend_variance
            else:
                if trend_result:
                    warnings.append(f'Trend not statistically significant (p={trend_result.p_value:.3f})')
                else:
                    warnings.append('Insufficient data for trend analysis')

        # 3. Seasonal contribution
        if apply_seasonality:
            seasonal_indices = self.time_series_model.calculate_seasonal_indices(market_share_data)
            month_index = seasonal_indices.get(target_month)

            if month_index and month_index.sample_size >= 3:
                seasonal_adjustment = baseline_value * (month_index.index - 1)
                total_adjustment += seasonal_adjustment

                contributions.append(SignalContribution(
                    signal_name=f'{target_month} Seasonality',
                    signal_type='seasonal',
                    value=seasonal_adjustment,
                    percentage=0,
                    trust_score=0.85 if month_index.sample_size >= 5 else 0.7,
                    source=f'Historical seasonal index={month_index.index:.3f} (n={month_index.sample_size})',
                    is_data_driven=True
                ))

                # Add variance
                seasonal_variance = (baseline_value * month_index.std_dev) ** 2
                total_variance += seasonal_variance
            else:
                if month_index:
                    warnings.append(f'Limited seasonal data for {target_month} (n={month_index.sample_size})')

        # 4. Event impacts
        events = events or []
        event_adjustments = []

        for event in events:
            impact = self.impact_model.estimate_impact(event)

            # Convert percentage impact to absolute value
            event_adjustment = baseline_value * (impact.point_estimate / 100)
            event_adjustments.append(event_adjustment)
            total_adjustment += event_adjustment

            # Determine trust score from event
            event_trust = event.get('trust_score', 0.5)
            if impact.uncertainty_level == 'very_high':
                event_trust *= 0.6
            elif impact.uncertainty_level == 'high':
                event_trust *= 0.8

            contributions.append(SignalContribution(
                signal_name=event.get('headline', 'Unknown Event')[:50],
                signal_type='event',
                value=event_adjustment,
                percentage=0,
                trust_score=event_trust,
                source=event.get('source_name', 'Unknown'),
                is_data_driven=not impact.is_user_adjusted
            ))

            # Add variance from event
            impact_variance = ((impact.confidence_upper - impact.confidence_lower) / 2 * baseline_value / 100) ** 2
            total_variance += impact_variance

            # Include event warnings
            warnings.extend(impact.warnings)

        # 5. Economic indicator (if provided)
        if economic_indicator is not None:
            econ_adjustment = baseline_value * (economic_indicator / 100)
            total_adjustment += econ_adjustment

            contributions.append(SignalContribution(
                signal_name='Economic Indicator',
                signal_type='economic',
                value=econ_adjustment,
                percentage=0,
                trust_score=0.9,  # Economic data is generally reliable
                source='Economic indicator adjustment',
                is_data_driven=True
            ))

        # Calculate final prediction
        predicted_value = baseline_value + total_adjustment
        predicted_value = max(0, predicted_value)  # Ensure non-negative

        # Calculate confidence interval
        prediction_std = np.sqrt(total_variance) if total_variance > 0 else baseline_value * 0.05
        confidence_lower = max(0, predicted_value - 1.96 * prediction_std)
        confidence_upper = predicted_value + 1.96 * prediction_std

        # Calculate combined trust score (weighted average)
        if contributions:
            total_abs_contribution = sum(abs(c.value) for c in contributions[1:])  # Exclude baseline
            if total_abs_contribution > 0:
                combined_trust = sum(
                    c.trust_score * abs(c.value) / total_abs_contribution
                    for c in contributions[1:]
                )
            else:
                combined_trust = 1.0  # No adjustments, baseline only
        else:
            combined_trust = 1.0

        # Calculate percentages for contributions
        if baseline_value > 0:
            for c in contributions:
                if c.signal_type == 'baseline':
                    c.percentage = 100.0
                else:
                    c.percentage = (c.value / baseline_value) * 100

        # Identify primary drivers (top 3 by absolute contribution)
        non_baseline = [c for c in contributions if c.signal_type != 'baseline']
        sorted_contributions = sorted(non_baseline, key=lambda x: abs(x.value), reverse=True)
        primary_drivers = [
            f"{c.signal_name} ({c.value:+.2f})"
            for c in sorted_contributions[:3]
        ]

        # Assess data quality
        data_quality = self._assess_data_quality(contributions, warnings)

        return FusedPrediction(
            target_month=target_month,
            target_year=target_year,
            baseline_value=baseline_value,
            predicted_value=round(predicted_value, 2),
            confidence_lower=round(confidence_lower, 2),
            confidence_upper=round(confidence_upper, 2),
            combined_trust_score=round(combined_trust, 3),
            signal_contributions=contributions,
            primary_drivers=primary_drivers,
            warnings=warnings,
            data_quality=data_quality
        )

    def _assess_data_quality(
        self,
        contributions: List[SignalContribution],
        warnings: List[str]
    ) -> str:
        """Assess overall data quality."""
        # Count data-driven contributions
        data_driven_count = sum(1 for c in contributions if c.is_data_driven and c.signal_type != 'baseline')
        total_non_baseline = len([c for c in contributions if c.signal_type != 'baseline'])

        # Calculate average trust
        avg_trust = np.mean([c.trust_score for c in contributions])

        # Rate quality
        if data_driven_count >= 2 and avg_trust >= 0.75 and len(warnings) <= 1:
            return 'good'
        elif data_driven_count >= 1 and avg_trust >= 0.6 and len(warnings) <= 3:
            return 'moderate'
        elif avg_trust >= 0.4:
            return 'limited'
        else:
            return 'insufficient'

    def generate_monthly_predictions(
        self,
        market_share_data: Dict[int, List[float]],
        target_year: int,
        baseline_values: List[float],
        events: Optional[List[Dict]] = None,
        apply_trend: bool = True,
        apply_seasonality: bool = True,
        trend_strength: float = 1.0
    ) -> List[FusedPrediction]:
        """
        Generate predictions for all 12 months.

        Args:
            market_share_data: Historical market share data
            target_year: Year to predict
            baseline_values: List of 12 baseline values
            events: List of intelligence events
            apply_trend: Apply historical trend
            apply_seasonality: Apply seasonal patterns
            trend_strength: Trend multiplier

        Returns:
            List of 12 FusedPrediction objects
        """
        MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        predictions = []

        events = events or []

        for i, month in enumerate(MONTHS):
            baseline = baseline_values[i] if i < len(baseline_values) else 0

            # Filter events relevant to this month
            month_events = [
                e for e in events
                if self._event_affects_month(e, month, target_year)
            ]

            prediction = self.fuse_signals(
                market_share_data=market_share_data,
                target_year=target_year,
                target_month=month,
                baseline_value=baseline,
                events=month_events,
                apply_trend=apply_trend,
                apply_seasonality=apply_seasonality,
                trend_strength=trend_strength
            )
            predictions.append(prediction)

        return predictions

    def _event_affects_month(
        self,
        event: Dict,
        month: str,
        year: int
    ) -> bool:
        """Check if an event affects a specific month."""
        event_date = event.get('expected_date') or event.get('event_date')
        if not event_date:
            return True  # If no date, assume it affects all months

        # Parse event date (YYYY-MM format)
        try:
            if '-' in str(event_date):
                parts = str(event_date).split('-')
                event_year = int(parts[0])
                event_month_num = int(parts[1])

                MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                target_month_num = MONTHS.index(month) + 1

                # Event affects the target month and subsequent months
                if event_year < year:
                    return True
                elif event_year == year and event_month_num <= target_month_num:
                    return True
                else:
                    return False
            else:
                return True  # Can't parse, assume it affects

        except (ValueError, IndexError):
            return True


# Singleton instance
_signal_fusion = None

def get_signal_fusion() -> SignalFusion:
    """Get or create the signal fusion singleton."""
    global _signal_fusion
    if _signal_fusion is None:
        _signal_fusion = SignalFusion()
    return _signal_fusion
