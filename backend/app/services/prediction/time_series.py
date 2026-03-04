"""
Time Series Model
Statistical forecasting of market share using historical data.
All predictions include uncertainty quantification.
"""

import numpy as np
from scipy import stats
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class TrendResult:
    """Result of trend analysis."""
    slope: float
    intercept: float
    r_squared: float
    p_value: float
    is_significant: bool
    trend_direction: str  # 'increasing', 'decreasing', 'stable'
    annual_change_pct: float
    confidence_interval: Tuple[float, float]
    data_points: int
    years_analyzed: List[int]


@dataclass
class SeasonalIndex:
    """Seasonal index for a month."""
    month: str
    index: float
    std_dev: float
    sample_size: int


@dataclass
class ForecastResult:
    """Result of time series forecast."""
    target_month: str
    baseline_value: float
    trend_adjustment: float
    seasonal_adjustment: float
    predicted_value: float
    confidence_lower: float
    confidence_upper: float
    prediction_std: float
    methodology: str
    data_quality: str


class TimeSeriesModel:
    """
    Time series forecasting for market share.
    Uses linear regression for trend and historical averages for seasonality.
    All uncertainty is quantified and reported.
    """

    MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    def __init__(self):
        pass

    def analyze_trend(
        self,
        market_share_data: Dict[int, List[float]],
        min_years: int = 3
    ) -> Optional[TrendResult]:
        """
        Analyze long-term trend in market share data.

        Args:
            market_share_data: Dictionary {year: [12 monthly values]}
            min_years: Minimum years required for analysis

        Returns:
            TrendResult or None if insufficient data
        """
        # Get complete years (all 12 months with valid data)
        complete_years = []
        annual_averages = []

        for year, values in sorted(market_share_data.items()):
            if isinstance(year, str):
                try:
                    year = int(year)
                except:
                    continue

            if values and len(values) >= 12:
                valid_values = [v for v in values if v is not None and not np.isnan(v)]
                if len(valid_values) >= 10:  # At least 10 valid months
                    complete_years.append(year)
                    annual_averages.append(np.mean(valid_values))

        if len(complete_years) < min_years:
            return None

        # Convert to numpy arrays
        x = np.array(complete_years)
        y = np.array(annual_averages)

        # Perform linear regression
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)

        r_squared = r_value ** 2

        # Calculate confidence interval for slope
        n = len(x)
        t_crit = stats.t.ppf(0.975, n - 2)  # 95% CI
        slope_ci = (slope - t_crit * std_err, slope + t_crit * std_err)

        # Determine trend direction
        if p_value < 0.05:
            if slope > 0.1:
                trend_direction = 'increasing'
            elif slope < -0.1:
                trend_direction = 'decreasing'
            else:
                trend_direction = 'stable'
        else:
            trend_direction = 'stable'  # Not statistically significant

        # Calculate annual change percentage
        mean_value = np.mean(y)
        annual_change_pct = (slope / mean_value * 100) if mean_value != 0 else 0

        return TrendResult(
            slope=slope,
            intercept=intercept,
            r_squared=r_squared,
            p_value=p_value,
            is_significant=p_value < 0.05,
            trend_direction=trend_direction,
            annual_change_pct=annual_change_pct,
            confidence_interval=slope_ci,
            data_points=n,
            years_analyzed=complete_years
        )

    def calculate_seasonal_indices(
        self,
        market_share_data: Dict[int, List[float]]
    ) -> Dict[str, SeasonalIndex]:
        """
        Calculate seasonal index for each month.
        Index > 1 means above-average, < 1 means below-average.

        Args:
            market_share_data: Dictionary {year: [12 monthly values]}

        Returns:
            Dictionary {month_name: SeasonalIndex}
        """
        # Collect values by month across all years
        month_values = {m: [] for m in self.MONTHS}

        for year, values in market_share_data.items():
            if values and len(values) >= 12:
                for i, month in enumerate(self.MONTHS):
                    if values[i] is not None and not np.isnan(values[i]):
                        month_values[month].append(values[i])

        # Calculate overall mean
        all_values = []
        for vals in month_values.values():
            all_values.extend(vals)

        if not all_values:
            # Return neutral indices if no data
            return {m: SeasonalIndex(m, 1.0, 0.0, 0) for m in self.MONTHS}

        overall_mean = np.mean(all_values)

        # Calculate seasonal index for each month
        seasonal_indices = {}
        for month in self.MONTHS:
            vals = month_values[month]
            if vals:
                month_mean = np.mean(vals)
                index = month_mean / overall_mean if overall_mean != 0 else 1.0
                std_dev = np.std(vals) / overall_mean if overall_mean != 0 else 0
                seasonal_indices[month] = SeasonalIndex(
                    month=month,
                    index=index,
                    std_dev=std_dev,
                    sample_size=len(vals)
                )
            else:
                seasonal_indices[month] = SeasonalIndex(
                    month=month,
                    index=1.0,
                    std_dev=0.0,
                    sample_size=0
                )

        return seasonal_indices

    def forecast_market_share(
        self,
        market_share_data: Dict[int, List[float]],
        target_year: int,
        target_month: str,
        baseline_value: float,
        apply_trend: bool = True,
        apply_seasonality: bool = True,
        trend_strength: float = 1.0
    ) -> ForecastResult:
        """
        Generate market share forecast for a specific month.

        Args:
            market_share_data: Historical market share data
            target_year: Year to forecast
            target_month: Month to forecast (e.g., 'Jan')
            baseline_value: Baseline forecast value to adjust
            apply_trend: Whether to apply trend adjustment
            apply_seasonality: Whether to apply seasonal adjustment
            trend_strength: Multiplier for trend effect (0-2)

        Returns:
            ForecastResult with prediction and confidence intervals
        """
        methodology_parts = ['Baseline']
        trend_adjustment = 0
        seasonal_adjustment = 0
        prediction_variance = 0

        # Analyze trend if requested
        trend_result = None
        if apply_trend:
            trend_result = self.analyze_trend(market_share_data)
            if trend_result and trend_result.is_significant:
                # Project trend to target year
                years_ahead = target_year - max(trend_result.years_analyzed)
                trend_adjustment = trend_result.slope * years_ahead * trend_strength

                # Scale adjustment relative to baseline
                if baseline_value > 0:
                    trend_adjustment = (trend_adjustment / baseline_value) * baseline_value

                methodology_parts.append(f'Linear trend (R²={trend_result.r_squared:.2f})')

                # Add variance from trend uncertainty
                prediction_variance += (trend_result.confidence_interval[1] - trend_result.confidence_interval[0]) ** 2

        # Calculate seasonal indices if requested
        if apply_seasonality:
            seasonal_indices = self.calculate_seasonal_indices(market_share_data)
            month_index = seasonal_indices.get(target_month)

            if month_index and month_index.sample_size >= 3:
                # Seasonal adjustment is the deviation from mean
                seasonal_adjustment = baseline_value * (month_index.index - 1)
                methodology_parts.append(f'Seasonality ({target_month} index={month_index.index:.2f})')

                # Add variance from seasonal uncertainty
                prediction_variance += (baseline_value * month_index.std_dev) ** 2

        # Calculate predicted value
        predicted_value = baseline_value + trend_adjustment + seasonal_adjustment

        # Calculate confidence interval (95%)
        prediction_std = np.sqrt(prediction_variance) if prediction_variance > 0 else baseline_value * 0.05
        confidence_lower = predicted_value - 1.96 * prediction_std
        confidence_upper = predicted_value + 1.96 * prediction_std

        # Ensure predictions are non-negative
        predicted_value = max(0, predicted_value)
        confidence_lower = max(0, confidence_lower)

        # Determine data quality
        data_quality = self._assess_data_quality(market_share_data, trend_result)

        return ForecastResult(
            target_month=target_month,
            baseline_value=baseline_value,
            trend_adjustment=trend_adjustment,
            seasonal_adjustment=seasonal_adjustment,
            predicted_value=predicted_value,
            confidence_lower=confidence_lower,
            confidence_upper=confidence_upper,
            prediction_std=prediction_std,
            methodology=' + '.join(methodology_parts),
            data_quality=data_quality
        )

    def _assess_data_quality(
        self,
        market_share_data: Dict,
        trend_result: Optional[TrendResult]
    ) -> str:
        """Assess the quality of available data for forecasting."""
        # Count complete years
        complete_years = 0
        for year, values in market_share_data.items():
            if values and len(values) >= 12:
                valid = [v for v in values if v is not None and not np.isnan(v)]
                if len(valid) >= 10:
                    complete_years += 1

        # Rate quality
        if complete_years >= 5 and trend_result and trend_result.r_squared >= 0.7:
            return 'good'
        elif complete_years >= 3 and trend_result and trend_result.r_squared >= 0.5:
            return 'moderate'
        elif complete_years >= 2:
            return 'limited'
        else:
            return 'insufficient'

    def generate_forecast_series(
        self,
        market_share_data: Dict[int, List[float]],
        target_year: int,
        baseline_values: List[float],
        apply_trend: bool = True,
        apply_seasonality: bool = True,
        trend_strength: float = 1.0
    ) -> List[ForecastResult]:
        """
        Generate forecasts for all 12 months.

        Args:
            market_share_data: Historical market share data
            target_year: Year to forecast
            baseline_values: List of 12 baseline values
            apply_trend: Whether to apply trend
            apply_seasonality: Whether to apply seasonality
            trend_strength: Trend effect multiplier

        Returns:
            List of 12 ForecastResult objects
        """
        results = []

        for i, month in enumerate(self.MONTHS):
            baseline = baseline_values[i] if i < len(baseline_values) else 0

            result = self.forecast_market_share(
                market_share_data=market_share_data,
                target_year=target_year,
                target_month=month,
                baseline_value=baseline,
                apply_trend=apply_trend,
                apply_seasonality=apply_seasonality,
                trend_strength=trend_strength
            )
            results.append(result)

        return results

    def get_historical_statistics(
        self,
        market_share_data: Dict[int, List[float]]
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive historical statistics.

        Args:
            market_share_data: Historical market share data

        Returns:
            Dictionary with statistical summaries
        """
        # Collect all values
        all_values = []
        yoy_changes = []
        year_averages = {}

        sorted_years = sorted([int(y) for y in market_share_data.keys()])

        for year in sorted_years:
            values = market_share_data.get(year) or market_share_data.get(str(year))
            if values:
                valid = [v for v in values if v is not None and not np.isnan(v)]
                if valid:
                    all_values.extend(valid)
                    year_averages[year] = np.mean(valid)

        # Calculate year-over-year changes
        prev_avg = None
        for year in sorted_years:
            if year in year_averages:
                if prev_avg is not None:
                    yoy_change = ((year_averages[year] - prev_avg) / prev_avg) * 100
                    yoy_changes.append(yoy_change)
                prev_avg = year_averages[year]

        # Compile statistics
        stats_result = {
            'overall': {
                'mean': np.mean(all_values) if all_values else 0,
                'std': np.std(all_values) if all_values else 0,
                'min': np.min(all_values) if all_values else 0,
                'max': np.max(all_values) if all_values else 0,
                'count': len(all_values)
            },
            'yoy_changes': {
                'mean': np.mean(yoy_changes) if yoy_changes else 0,
                'std': np.std(yoy_changes) if yoy_changes else 0,
                'min': np.min(yoy_changes) if yoy_changes else 0,
                'max': np.max(yoy_changes) if yoy_changes else 0,
                'count': len(yoy_changes)
            },
            'years_available': sorted_years,
            'complete_years': len(year_averages)
        }

        return stats_result


# Singleton instance
_time_series_model = None

def get_time_series_model() -> TimeSeriesModel:
    """Get or create the time series model singleton."""
    global _time_series_model
    if _time_series_model is None:
        _time_series_model = TimeSeriesModel()
    return _time_series_model
