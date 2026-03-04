import numpy as np
from ..utils.constants import MONTHS

class MarketShareService:
    
    def calculate_relative_change(self, delta_pct):
        """
        Mode 1: Relative Change - uniform adjustment
        """
        adjustment = 1.0 + (delta_pct / 100.0)
        return {m: adjustment for m in MONTHS}
    
    def calculate_historical_trend(
        self,
        market_share_data,
        selected_year,
        trend_strength=100,
        apply_seasonality=True
    ):
        """
        Mode 2: Historical Trend - data-driven projection
        """
        if not market_share_data:
            return {m: 1.0 for m in MONTHS}

        # Ensure selected_year is int for calculations
        selected_year = int(selected_year)

        # Normalize market_share_data keys to integers (JSON sends string keys)
        normalized_data = {}
        for year_key, values in market_share_data.items():
            normalized_data[int(year_key)] = values

        # Get complete years (all 12 months with valid data)
        complete_years = self._get_complete_years(normalized_data, selected_year)

        if len(complete_years) < 2:
            return {m: 1.0 for m in MONTHS}

        # Calculate annual averages and trend
        annual_avg = {year: np.mean(normalized_data[year]) for year in complete_years}

        years_array = np.array(list(annual_avg.keys()))
        ms_array = np.array(list(annual_avg.values()))

        # Linear regression
        years_normalized = years_array - min(years_array)
        slope, intercept = np.polyfit(years_normalized, ms_array, 1)

        # Project to forecast year
        forecast_offset = selected_year - min(years_array)
        projected_avg = intercept + (slope * forecast_offset)

        # Calculate delta from latest year
        latest_year = max(complete_years)
        latest_avg = annual_avg[latest_year]

        delta = (projected_avg - latest_avg) / latest_avg if latest_avg > 0 else 0
        final_delta = delta * (trend_strength / 100.0)

        # Calculate seasonal indices
        seasonal_index = {}
        if apply_seasonality:
            for month_idx in range(12):
                month_values = [normalized_data[year][month_idx] for year in complete_years]
                month_avg = np.mean(month_values)
                overall_avg = np.mean(ms_array)
                seasonal_index[month_idx] = month_avg / overall_avg if overall_avg > 0 else 1.0
        else:
            seasonal_index = {i: 1.0 for i in range(12)}

        # Apply adjustments
        adjustments = {}
        for month_idx, month in enumerate(MONTHS):
            month_delta = final_delta * seasonal_index[month_idx]
            adjustments[month] = 1.0 + month_delta

        return adjustments
    
    def calculate_competitive_intelligence(self, event_config):
        """
        Mode 3: Competitive Intelligence - event-based
        """
        event_type = event_config.get('type', 'single')
        
        if event_type == 'single':
            return self._single_event(
                event_config.get('month', 'Jan'),
                event_config.get('impact', 0),
                event_config.get('duration', 1)
            )
        elif event_type == 'gradual':
            return self._gradual_shift(
                event_config.get('start_month', 'Apr'),
                event_config.get('end_month', 'Sep'),
                event_config.get('cumulative_impact', -10)
            )
        elif event_type == 'recovery':
            return self._recovery_scenario(
                event_config.get('loss_duration', 3),
                event_config.get('initial_loss', -15),
                event_config.get('recovery_duration', 5)
            )
        
        return {m: 1.0 for m in MONTHS}
    
    def calculate_macro_scenario(self, market_growth, our_capacity):
        """
        Mode 4: Macro Scenario - market size vs capacity
        """
        relative_growth = our_capacity - market_growth
        adjustment = 1.0 + (relative_growth / 100.0)
        return {m: adjustment for m in MONTHS}
    
    def _get_complete_years(self, market_share_data, selected_year):
        """Get years with complete 12-month data.

        Expects market_share_data with integer keys (pre-normalized).
        """
        complete = []
        selected_year = int(selected_year)

        for year, values in market_share_data.items():
            year_int = int(year)  # Ensure int comparison
            if year_int >= selected_year:
                continue
            if len(values) == 12 and all(v > 0 and not np.isnan(v) for v in values):
                complete.append(year_int)
        return sorted(complete)
    
    def _single_event(self, event_month, impact, duration):
        """Single event impact for specified duration"""
        adjustments = {m: 1.0 for m in MONTHS}
        start_idx = MONTHS.index(event_month)
        
        for i in range(start_idx, min(start_idx + duration, 12)):
            adjustments[MONTHS[i]] = 1.0 + (impact / 100.0)
        
        return adjustments
    
    def _gradual_shift(self, start_month, end_month, cumulative_impact):
        """Gradual shift from start to end month"""
        adjustments = {m: 1.0 for m in MONTHS}
        start_idx = MONTHS.index(start_month)
        end_idx = MONTHS.index(end_month)
        
        if end_idx < start_idx:
            return adjustments
        
        transition_months = end_idx - start_idx + 1
        
        for i, month in enumerate(MONTHS):
            if i < start_idx:
                adjustments[month] = 1.0
            elif i <= end_idx:
                progress = (i - start_idx + 1) / transition_months
                impact = cumulative_impact * progress
                adjustments[month] = 1.0 + (impact / 100.0)
            else:
                adjustments[month] = 1.0 + (cumulative_impact / 100.0)
        
        return adjustments
    
    def _recovery_scenario(self, loss_duration, initial_loss, recovery_duration):
        """Temporary loss with recovery"""
        adjustments = {m: 1.0 for m in MONTHS}
        
        for i, month in enumerate(MONTHS):
            if i < loss_duration:
                adjustments[month] = 1.0 + (initial_loss / 100.0)
            elif i < loss_duration + recovery_duration:
                recovery_progress = (i - loss_duration + 1) / recovery_duration
                current_impact = initial_loss * (1 - recovery_progress)
                adjustments[month] = 1.0 + (current_impact / 100.0)
            else:
                adjustments[month] = 1.0
        
        return adjustments


# Singleton instance
market_share_service = MarketShareService()