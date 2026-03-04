"""
Alert Engine Service
Generates alerts based on predictions, events, and thresholds.
"""

import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict


@dataclass
class Alert:
    """Alert data structure."""
    id: str
    created_at: str
    severity: str  # 'high', 'medium', 'low'
    category: str  # 'prediction', 'event', 'regulatory', 'data_quality'
    title: str
    description: str
    affected_products: List[str]
    affected_months: List[str]
    source_event_id: Optional[str]
    trust_score: Optional[float]
    requires_action: bool
    suggested_actions: List[str]
    expires_at: Optional[str]

    def to_dict(self) -> Dict:
        return asdict(self)


class AlertEngine:
    """
    Engine for generating and managing alerts.

    Alert Types:
    1. Prediction alerts - significant forecast changes
    2. Event alerts - new competitive intelligence
    3. Regulatory alerts - regulatory announcements
    4. Data quality alerts - data issues or staleness
    """

    # Thresholds for alert generation
    THRESHOLDS = {
        'prediction_change_high': 5.0,     # % change from baseline triggers high alert
        'prediction_change_medium': 3.0,   # % change triggers medium alert
        'prediction_change_low': 2.0,      # % change triggers low alert
        'event_trust_minimum': 0.5,        # Minimum trust to generate event alert
        'regulatory_auto_high': True,      # Regulatory events always high priority
        'data_staleness_days': 30,         # Days before data is considered stale
    }

    def __init__(self):
        pass

    def _generate_alert_id(self, category: str, title: str) -> str:
        """Generate unique alert ID."""
        content = f"{category}:{title}:{datetime.now().date()}"
        return hashlib.md5(content.encode()).hexdigest()[:16]

    def check_prediction_alerts(
        self,
        predictions: List[Dict],
        baselines: List[float],
        product: str
    ) -> List[Alert]:
        """
        Check predictions for significant deviations from baseline.

        Args:
            predictions: List of prediction results
            baselines: Baseline values for comparison
            product: Product code

        Returns:
            List of generated alerts
        """
        alerts = []
        MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

        for i, pred in enumerate(predictions):
            if i >= len(baselines):
                continue

            baseline = baselines[i]
            predicted = pred.get('predicted_value', baseline)
            month = MONTHS[i] if i < len(MONTHS) else f'Month {i+1}'

            if baseline == 0:
                continue

            change_pct = ((predicted - baseline) / baseline) * 100

            # Check against thresholds
            severity = None
            if abs(change_pct) >= self.THRESHOLDS['prediction_change_high']:
                severity = 'high'
            elif abs(change_pct) >= self.THRESHOLDS['prediction_change_medium']:
                severity = 'medium'
            elif abs(change_pct) >= self.THRESHOLDS['prediction_change_low']:
                severity = 'low'

            if severity:
                direction = 'increase' if change_pct > 0 else 'decrease'

                alert = Alert(
                    id=self._generate_alert_id('prediction', f'{product}-{month}'),
                    created_at=datetime.now().isoformat(),
                    severity=severity,
                    category='prediction',
                    title=f'{product} {month}: Significant {direction} predicted',
                    description=f'Market share for {product} in {month} is predicted to {direction} by {abs(change_pct):.1f}% from baseline.',
                    affected_products=[product],
                    affected_months=[month],
                    source_event_id=None,
                    trust_score=pred.get('combined_trust_score', 0.7),
                    requires_action=severity == 'high',
                    suggested_actions=[
                        'Review driving factors in the prediction breakdown',
                        f'Verify assumptions for {month} forecast',
                        'Consider adjusting scenario parameters'
                    ],
                    expires_at=(datetime.now() + timedelta(days=7)).isoformat()
                )
                alerts.append(alert)

        return alerts

    def check_event_alerts(
        self,
        events: List[Dict]
    ) -> List[Alert]:
        """
        Generate alerts for new competitive events.

        Args:
            events: List of intelligence events

        Returns:
            List of generated alerts
        """
        alerts = []

        for event in events:
            trust_score = event.get('trust_score', 0.5)

            # Skip low-trust events
            if trust_score < self.THRESHOLDS['event_trust_minimum']:
                continue

            event_type = event.get('event_type', 'unknown')
            company = event.get('company', 'Unknown')
            headline = event.get('headline', 'New market event')

            # Determine severity based on event type and trust
            if event_type in ['regulatory_change', 'market_exit']:
                severity = 'high'
            elif event_type in ['product_launch', 'supply_disruption'] and trust_score >= 0.7:
                severity = 'high'
            elif event_type in ['product_launch', 'pricing_change', 'capacity_expansion']:
                severity = 'medium'
            else:
                severity = 'low'

            products_affected = event.get('products_affected', [])
            if isinstance(products_affected, str):
                try:
                    import json
                    products_affected = json.loads(products_affected)
                except:
                    products_affected = []

            alert = Alert(
                id=self._generate_alert_id('event', event.get('id', headline)),
                created_at=datetime.now().isoformat(),
                severity=severity,
                category='event',
                title=f'{company}: {headline[:60]}',
                description=f'Competitive intelligence: {event.get("description", headline)}',
                affected_products=products_affected,
                affected_months=[],  # Will be determined by impact model
                source_event_id=event.get('id') or event.get('event_id'),
                trust_score=trust_score,
                requires_action=severity == 'high',
                suggested_actions=[
                    'Review event details and source',
                    'Consider including in scenario analysis',
                    'Adjust impact estimate if needed'
                ],
                expires_at=(datetime.now() + timedelta(days=14)).isoformat()
            )
            alerts.append(alert)

        return alerts

    def check_regulatory_alerts(
        self,
        events: List[Dict]
    ) -> List[Alert]:
        """
        Generate high-priority alerts for regulatory events.

        Args:
            events: List of intelligence events

        Returns:
            List of regulatory alerts
        """
        alerts = []

        regulatory_events = [
            e for e in events
            if e.get('event_type') == 'regulatory_change'
        ]

        for event in regulatory_events:
            headline = event.get('headline', 'Regulatory update')
            description = event.get('description', headline)

            products_affected = event.get('products_affected', [])
            if isinstance(products_affected, str):
                try:
                    import json
                    products_affected = json.loads(products_affected)
                except:
                    products_affected = []

            # Regulatory alerts are always high priority if from official source
            trust_score = event.get('trust_score', 0.5)
            severity = 'high' if trust_score >= 0.8 else 'medium'

            alert = Alert(
                id=self._generate_alert_id('regulatory', event.get('id', headline)),
                created_at=datetime.now().isoformat(),
                severity=severity,
                category='regulatory',
                title=f'Regulatory: {headline[:60]}',
                description=description,
                affected_products=products_affected if products_affected else ['ALL'],
                affected_months=[],
                source_event_id=event.get('id') or event.get('event_id'),
                trust_score=trust_score,
                requires_action=True,
                suggested_actions=[
                    'Review regulatory details',
                    'Assess compliance requirements',
                    'Update product forecasts accordingly',
                    'Consult regulatory affairs team'
                ],
                expires_at=(datetime.now() + timedelta(days=30)).isoformat()
            )
            alerts.append(alert)

        return alerts

    def check_data_quality_alerts(
        self,
        data_info: Dict
    ) -> List[Alert]:
        """
        Generate alerts for data quality issues.

        Args:
            data_info: Dictionary with data quality information

        Returns:
            List of data quality alerts
        """
        alerts = []

        # Check for stale data
        last_updated = data_info.get('last_updated')
        if last_updated:
            try:
                last_date = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
                days_old = (datetime.now(last_date.tzinfo if last_date.tzinfo else None) - last_date).days

                if days_old > self.THRESHOLDS['data_staleness_days']:
                    alert = Alert(
                        id=self._generate_alert_id('data_quality', 'stale_data'),
                        created_at=datetime.now().isoformat(),
                        severity='medium',
                        category='data_quality',
                        title='Data may be outdated',
                        description=f'Market share data was last updated {days_old} days ago. Consider refreshing data sources.',
                        affected_products=data_info.get('products', []),
                        affected_months=[],
                        source_event_id=None,
                        trust_score=None,
                        requires_action=False,
                        suggested_actions=[
                            'Refresh market share data',
                            'Check for new data sources'
                        ],
                        expires_at=(datetime.now() + timedelta(days=7)).isoformat()
                    )
                    alerts.append(alert)
            except (ValueError, TypeError):
                pass

        # Check for missing data
        missing_months = data_info.get('missing_months', [])
        if missing_months:
            alert = Alert(
                id=self._generate_alert_id('data_quality', 'missing_data'),
                created_at=datetime.now().isoformat(),
                severity='low',
                category='data_quality',
                title='Incomplete data detected',
                description=f'Missing data for months: {", ".join(missing_months)}. Predictions may be less reliable.',
                affected_products=data_info.get('products', []),
                affected_months=missing_months,
                source_event_id=None,
                trust_score=None,
                requires_action=False,
                suggested_actions=[
                    'Review data completeness',
                    'Consider data interpolation'
                ],
                expires_at=(datetime.now() + timedelta(days=30)).isoformat()
            )
            alerts.append(alert)

        return alerts

    def generate_all_alerts(
        self,
        predictions: Optional[List[Dict]] = None,
        baselines: Optional[List[float]] = None,
        product: Optional[str] = None,
        events: Optional[List[Dict]] = None,
        data_info: Optional[Dict] = None
    ) -> List[Alert]:
        """
        Generate all applicable alerts.

        Args:
            predictions: Prediction results
            baselines: Baseline values
            product: Product code
            events: Intelligence events
            data_info: Data quality information

        Returns:
            Comprehensive list of alerts
        """
        all_alerts = []

        # Prediction alerts
        if predictions and baselines and product:
            all_alerts.extend(
                self.check_prediction_alerts(predictions, baselines, product)
            )

        # Event alerts
        if events:
            all_alerts.extend(self.check_event_alerts(events))
            all_alerts.extend(self.check_regulatory_alerts(events))

        # Data quality alerts
        if data_info:
            all_alerts.extend(self.check_data_quality_alerts(data_info))

        # Sort by severity (high first) then by date
        severity_order = {'high': 0, 'medium': 1, 'low': 2}
        all_alerts.sort(key=lambda x: (severity_order.get(x.severity, 3), x.created_at), reverse=False)

        return all_alerts

    def summarize_alerts(self, alerts: List[Alert]) -> Dict[str, Any]:
        """
        Generate summary statistics for alerts.

        Args:
            alerts: List of alerts

        Returns:
            Summary dictionary
        """
        if not alerts:
            return {
                'total': 0,
                'by_severity': {'high': 0, 'medium': 0, 'low': 0},
                'by_category': {},
                'requires_action': 0
            }

        by_severity = {'high': 0, 'medium': 0, 'low': 0}
        by_category = {}
        requires_action = 0

        for alert in alerts:
            by_severity[alert.severity] = by_severity.get(alert.severity, 0) + 1
            by_category[alert.category] = by_category.get(alert.category, 0) + 1
            if alert.requires_action:
                requires_action += 1

        return {
            'total': len(alerts),
            'by_severity': by_severity,
            'by_category': by_category,
            'requires_action': requires_action
        }


# Singleton instance
_alert_engine = None

def get_alert_engine() -> AlertEngine:
    """Get or create the alert engine singleton."""
    global _alert_engine
    if _alert_engine is None:
        _alert_engine = AlertEngine()
    return _alert_engine
