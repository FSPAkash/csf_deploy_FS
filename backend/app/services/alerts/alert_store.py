"""
Alert Store
Wrapper around EventStore for alert-specific operations.
"""

from typing import Dict, List, Optional
from datetime import datetime

from ..intelligence.event_store import EventStore, get_event_store


class AlertStore:
    """
    Alert storage operations using the shared EventStore.
    """

    def __init__(self, event_store: Optional[EventStore] = None):
        self.event_store = event_store or get_event_store()

    def save_alert(self, alert) -> str:
        """
        Save an alert to the database.

        Args:
            alert: Alert object or dictionary

        Returns:
            Alert ID
        """
        if hasattr(alert, 'to_dict'):
            alert_dict = alert.to_dict()
        else:
            alert_dict = alert

        return self.event_store.store_alert(alert_dict)

    def save_alerts(self, alerts: List) -> List[str]:
        """
        Save multiple alerts.

        Args:
            alerts: List of Alert objects or dictionaries

        Returns:
            List of alert IDs
        """
        ids = []
        for alert in alerts:
            alert_id = self.save_alert(alert)
            ids.append(alert_id)
        return ids

    def get_alerts(
        self,
        severity: Optional[str] = None,
        category: Optional[str] = None,
        unread_only: bool = False,
        include_dismissed: bool = False,
        limit: int = 20
    ) -> List[Dict]:
        """
        Get alerts with filtering.

        Args:
            severity: Filter by severity
            category: Filter by category
            unread_only: Only return unread alerts
            include_dismissed: Include dismissed alerts
            limit: Maximum results

        Returns:
            List of alert dictionaries
        """
        return self.event_store.get_alerts(
            severity=severity,
            category=category,
            unread_only=unread_only,
            include_dismissed=include_dismissed,
            limit=limit
        )

    def get_unread_count(self) -> int:
        """Get count of unread alerts."""
        alerts = self.event_store.get_alerts(unread_only=True, limit=1000)
        return len(alerts)

    def get_high_priority_alerts(self) -> List[Dict]:
        """Get high-severity alerts that require action."""
        alerts = self.event_store.get_alerts(
            severity='high',
            include_dismissed=False,
            limit=50
        )
        return [a for a in alerts if a.get('requires_action')]

    def mark_read(self, alert_id: str) -> bool:
        """Mark an alert as read."""
        return self.event_store.mark_alert_read(alert_id)

    def mark_all_read(self) -> int:
        """Mark all alerts as read."""
        alerts = self.event_store.get_alerts(unread_only=True, limit=1000)
        count = 0
        for alert in alerts:
            if self.event_store.mark_alert_read(alert['id']):
                count += 1
        return count

    def dismiss(self, alert_id: str) -> bool:
        """Dismiss an alert."""
        return self.event_store.dismiss_alert(alert_id)

    def get_alert_summary(self) -> Dict:
        """Get summary of current alert status."""
        all_alerts = self.event_store.get_alerts(include_dismissed=False, limit=1000)

        summary = {
            'total_active': len(all_alerts),
            'unread': sum(1 for a in all_alerts if not a.get('is_read')),
            'high_priority': sum(1 for a in all_alerts if a.get('severity') == 'high'),
            'requires_action': sum(1 for a in all_alerts if a.get('requires_action')),
            'by_category': {},
            'by_severity': {'high': 0, 'medium': 0, 'low': 0}
        }

        for alert in all_alerts:
            cat = alert.get('category', 'other')
            summary['by_category'][cat] = summary['by_category'].get(cat, 0) + 1

            severity = alert.get('severity', 'medium')
            if severity in summary['by_severity']:
                summary['by_severity'][severity] += 1

        return summary


# Singleton instance
_alert_store = None

def get_alert_store() -> AlertStore:
    """Get or create the alert store singleton."""
    global _alert_store
    if _alert_store is None:
        _alert_store = AlertStore()
    return _alert_store
