"""
Driver Attribution Service
Creates interpretable waterfall breakdowns of prediction drivers.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime

from .signal_fusion import FusedPrediction, SignalContribution


@dataclass
class WaterfallStep:
    """Single step in a waterfall chart."""
    label: str
    value: float  # The contribution/delta
    cumulative: float  # Running total
    percentage: float  # Percentage of baseline
    step_type: str  # 'baseline', 'increase', 'decrease', 'total'
    source: str
    trust_score: float
    is_data_driven: bool


@dataclass
class DriverAttribution:
    """Complete driver attribution for a prediction."""
    target_month: str
    target_year: int
    baseline_value: float
    predicted_value: float
    total_change: float
    total_change_pct: float
    waterfall_steps: List[WaterfallStep]
    top_positive_drivers: List[Dict]
    top_negative_drivers: List[Dict]
    combined_trust_score: float
    summary: str


class AttributionGenerator:
    """
    Generates interpretable driver attribution from predictions.
    """

    def __init__(self):
        pass

    def generate_attribution(
        self,
        prediction: FusedPrediction
    ) -> DriverAttribution:
        """
        Generate driver attribution from a fused prediction.

        Args:
            prediction: FusedPrediction object

        Returns:
            DriverAttribution with waterfall breakdown
        """
        waterfall_steps = []
        cumulative = 0

        # Start with baseline
        baseline = prediction.baseline_value
        cumulative = baseline

        waterfall_steps.append(WaterfallStep(
            label='Baseline Forecast',
            value=baseline,
            cumulative=baseline,
            percentage=100.0,
            step_type='baseline',
            source='Internal forecast',
            trust_score=1.0,
            is_data_driven=True
        ))

        # Add each contribution as a step
        for contrib in prediction.signal_contributions:
            if contrib.signal_type == 'baseline':
                continue  # Already added

            step_type = 'increase' if contrib.value >= 0 else 'decrease'
            cumulative += contrib.value

            waterfall_steps.append(WaterfallStep(
                label=contrib.signal_name,
                value=contrib.value,
                cumulative=round(cumulative, 2),
                percentage=round((contrib.value / baseline) * 100, 2) if baseline > 0 else 0,
                step_type=step_type,
                source=contrib.source,
                trust_score=contrib.trust_score,
                is_data_driven=contrib.is_data_driven
            ))

        # Add final total
        waterfall_steps.append(WaterfallStep(
            label='Predicted Value',
            value=prediction.predicted_value,
            cumulative=prediction.predicted_value,
            percentage=round((prediction.predicted_value / baseline) * 100, 2) if baseline > 0 else 0,
            step_type='total',
            source='Combined prediction',
            trust_score=prediction.combined_trust_score,
            is_data_driven=True
        ))

        # Identify top positive and negative drivers
        non_baseline = [c for c in prediction.signal_contributions if c.signal_type != 'baseline']

        positive_drivers = sorted(
            [c for c in non_baseline if c.value > 0],
            key=lambda x: x.value,
            reverse=True
        )[:3]

        negative_drivers = sorted(
            [c for c in non_baseline if c.value < 0],
            key=lambda x: x.value
        )[:3]

        # Calculate totals
        total_change = prediction.predicted_value - baseline
        total_change_pct = (total_change / baseline) * 100 if baseline > 0 else 0

        # Generate summary
        summary = self._generate_summary(
            prediction, positive_drivers, negative_drivers, total_change_pct
        )

        return DriverAttribution(
            target_month=prediction.target_month,
            target_year=prediction.target_year,
            baseline_value=baseline,
            predicted_value=prediction.predicted_value,
            total_change=round(total_change, 2),
            total_change_pct=round(total_change_pct, 2),
            waterfall_steps=waterfall_steps,
            top_positive_drivers=[{
                'name': d.signal_name,
                'value': round(d.value, 2),
                'percentage': round((d.value / baseline) * 100, 2) if baseline > 0 else 0,
                'source': d.source,
                'trust': d.trust_score
            } for d in positive_drivers],
            top_negative_drivers=[{
                'name': d.signal_name,
                'value': round(d.value, 2),
                'percentage': round((d.value / baseline) * 100, 2) if baseline > 0 else 0,
                'source': d.source,
                'trust': d.trust_score
            } for d in negative_drivers],
            combined_trust_score=prediction.combined_trust_score,
            summary=summary
        )

    def _generate_summary(
        self,
        prediction: FusedPrediction,
        positive_drivers: List[SignalContribution],
        negative_drivers: List[SignalContribution],
        total_change_pct: float
    ) -> str:
        """Generate human-readable summary of attribution."""
        parts = []

        # Overall direction
        if total_change_pct > 2:
            parts.append(f"Predicted market share is up {total_change_pct:.1f}% vs baseline.")
        elif total_change_pct < -2:
            parts.append(f"Predicted market share is down {abs(total_change_pct):.1f}% vs baseline.")
        else:
            parts.append(f"Predicted market share is roughly flat ({total_change_pct:+.1f}%).")

        # Top drivers
        if positive_drivers:
            top_pos = positive_drivers[0]
            parts.append(f"Primary positive driver: {top_pos.signal_name} (+{(top_pos.value / prediction.baseline_value * 100):.1f}%).")

        if negative_drivers:
            top_neg = negative_drivers[0]
            parts.append(f"Primary negative driver: {top_neg.signal_name} ({(top_neg.value / prediction.baseline_value * 100):.1f}%).")

        # Trust score note
        if prediction.combined_trust_score < 0.6:
            parts.append("Note: Overall confidence is limited due to uncertain inputs.")
        elif prediction.combined_trust_score >= 0.8:
            parts.append("Prediction has high confidence based on data-driven inputs.")

        return " ".join(parts)

    def to_chart_data(self, attribution: DriverAttribution) -> Dict[str, Any]:
        """
        Convert attribution to chart-ready format.

        Returns format suitable for recharts waterfall or bar chart.
        """
        chart_data = []

        for i, step in enumerate(attribution.waterfall_steps):
            if step.step_type == 'baseline':
                chart_data.append({
                    'name': step.label,
                    'value': step.value,
                    'fill': '#3B82F6',  # Blue
                    'type': 'baseline',
                    'trust': step.trust_score
                })
            elif step.step_type == 'total':
                chart_data.append({
                    'name': step.label,
                    'value': step.value,
                    'fill': '#8B5CF6',  # Purple
                    'type': 'total',
                    'trust': step.trust_score
                })
            elif step.step_type == 'increase':
                chart_data.append({
                    'name': step.label,
                    'value': step.value,
                    'fill': '#10B981',  # Green
                    'type': 'increase',
                    'trust': step.trust_score
                })
            else:  # decrease
                chart_data.append({
                    'name': step.label,
                    'value': step.value,
                    'fill': '#F59E0B',  # Amber
                    'type': 'decrease',
                    'trust': step.trust_score
                })

        return {
            'chartData': chart_data,
            'summary': attribution.summary,
            'totalChange': attribution.total_change,
            'totalChangePct': attribution.total_change_pct,
            'combinedTrust': attribution.combined_trust_score
        }

    def compare_attributions(
        self,
        attributions: List[DriverAttribution]
    ) -> Dict[str, Any]:
        """
        Compare attributions across multiple months or scenarios.

        Args:
            attributions: List of DriverAttribution objects

        Returns:
            Comparison summary
        """
        if not attributions:
            return {'error': 'No attributions provided'}

        # Collect all unique drivers
        all_drivers = set()
        for attr in attributions:
            for step in attr.waterfall_steps:
                if step.step_type not in ('baseline', 'total'):
                    all_drivers.add(step.label)

        # Build comparison matrix
        comparison = {
            'months': [],
            'drivers': list(all_drivers),
            'values': {}
        }

        for driver in all_drivers:
            comparison['values'][driver] = []

        for attr in attributions:
            comparison['months'].append(f"{attr.target_month} {attr.target_year}")

            # Find each driver's value for this month
            driver_values = {step.label: step.value for step in attr.waterfall_steps}

            for driver in all_drivers:
                comparison['values'][driver].append(driver_values.get(driver, 0))

        # Calculate consistency (how stable each driver is)
        import numpy as np
        consistency_scores = {}
        for driver, values in comparison['values'].items():
            if len(values) > 1:
                std = np.std(values)
                mean = np.mean(values)
                cv = abs(std / mean) if mean != 0 else 0
                consistency_scores[driver] = 1 - min(cv, 1)  # Higher = more consistent
            else:
                consistency_scores[driver] = 1.0

        comparison['consistency_scores'] = consistency_scores

        return comparison


# Singleton instance
_attribution_generator = None

def get_attribution_generator() -> AttributionGenerator:
    """Get or create the attribution generator singleton."""
    global _attribution_generator
    if _attribution_generator is None:
        _attribution_generator = AttributionGenerator()
    return _attribution_generator
