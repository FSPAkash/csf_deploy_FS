"""
Event Store Service
SQLite-based persistence for intelligence events and predictions.
"""

import os
import json
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from contextlib import contextmanager
from dataclasses import dataclass, asdict

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'intelligence.db')


@dataclass
class StoredEvent:
    """Event stored in the database."""
    id: str
    event_type: str
    company: Optional[str]
    headline: str
    description: str
    source_url: str
    source_name: str
    trust_score: float
    date_extracted: str
    event_date: Optional[str]
    geographic_scope: str
    products_affected: str  # JSON array
    impact_estimate_low: Optional[float]
    impact_estimate_high: Optional[float]
    confidence: str
    supporting_quote: str
    is_validated: bool
    user_adjusted_impact: Optional[float]
    expires_at: Optional[str]

    def to_dict(self) -> Dict:
        d = asdict(self)
        # Parse JSON fields
        try:
            d['products_affected'] = json.loads(d['products_affected']) if d['products_affected'] else []
        except:
            d['products_affected'] = []
        return d


class EventStore:
    """
    SQLite-based storage for intelligence events.
    """

    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH
        self._ensure_db_exists()

    def _ensure_db_exists(self):
        """Create database and tables if they don't exist."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)

        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Events table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS intelligence_events (
                    id TEXT PRIMARY KEY,
                    event_type TEXT NOT NULL,
                    company TEXT,
                    headline TEXT NOT NULL,
                    description TEXT,
                    source_url TEXT,
                    source_name TEXT,
                    trust_score REAL NOT NULL DEFAULT 0.5,
                    date_extracted TEXT DEFAULT CURRENT_TIMESTAMP,
                    event_date TEXT,
                    geographic_scope TEXT DEFAULT 'US',
                    products_affected TEXT,
                    impact_estimate_low REAL,
                    impact_estimate_high REAL,
                    confidence TEXT DEFAULT 'medium',
                    supporting_quote TEXT,
                    is_validated INTEGER DEFAULT 0,
                    user_adjusted_impact REAL,
                    expires_at TEXT
                )
            ''')

            # Predictions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS predictions (
                    id TEXT PRIMARY KEY,
                    product TEXT NOT NULL,
                    aps_class TEXT,
                    target_month TEXT NOT NULL,
                    generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    baseline_value REAL,
                    predicted_value REAL,
                    confidence_lower REAL,
                    confidence_upper REAL,
                    driver_attribution TEXT,
                    events_included TEXT,
                    combined_trust_score REAL,
                    model_version TEXT
                )
            ''')

            # Alerts table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS alerts (
                    id TEXT PRIMARY KEY,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    severity TEXT NOT NULL,
                    category TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    affected_products TEXT,
                    affected_months TEXT,
                    source_event_id TEXT,
                    trust_score REAL,
                    is_read INTEGER DEFAULT 0,
                    is_dismissed INTEGER DEFAULT 0,
                    requires_action INTEGER DEFAULT 0,
                    suggested_actions TEXT,
                    expires_at TEXT
                )
            ''')

            # Historical impacts table (for learning)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS historical_impacts (
                    id TEXT PRIMARY KEY,
                    event_type TEXT NOT NULL,
                    company TEXT,
                    event_date TEXT,
                    products_affected TEXT,
                    observed_impact REAL,
                    duration_months INTEGER,
                    notes TEXT
                )
            ''')

            # Create indices for common queries
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_events_type ON intelligence_events(event_type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_events_company ON intelligence_events(company)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_events_date ON intelligence_events(date_extracted)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_predictions_product ON predictions(product)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity)')

            conn.commit()

    @contextmanager
    def _get_connection(self):
        """Context manager for database connections."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def store_event(self, event: Dict) -> str:
        """
        Store an extracted event in the database.

        Args:
            event: Event dictionary with required fields

        Returns:
            Event ID
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            event_id = event.get('event_id') or event.get('id')
            if not event_id:
                import hashlib
                event_id = hashlib.md5(
                    f"{event.get('headline', '')}:{event.get('source_url', '')}".encode()
                ).hexdigest()[:16]

            # Serialize list fields
            products = event.get('products_affected', [])
            if isinstance(products, list):
                products = json.dumps(products)

            cursor.execute('''
                INSERT OR REPLACE INTO intelligence_events
                (id, event_type, company, headline, description, source_url, source_name,
                 trust_score, date_extracted, event_date, geographic_scope, products_affected,
                 impact_estimate_low, impact_estimate_high, confidence, supporting_quote,
                 is_validated, user_adjusted_impact, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                event_id,
                event.get('event_type', 'unknown'),
                event.get('company'),
                event.get('headline', ''),
                event.get('description', ''),
                event.get('source_url', ''),
                event.get('source_name', ''),
                event.get('trust_score', 0.5),
                event.get('extracted_at') or datetime.now().isoformat(),
                event.get('expected_date') or event.get('event_date'),
                event.get('geographic_scope', 'US'),
                products,
                event.get('impact_estimate_low'),
                event.get('impact_estimate_high'),
                event.get('confidence', 'medium'),
                event.get('supporting_quote', ''),
                1 if event.get('is_validated') else 0,
                event.get('user_adjusted_impact'),
                event.get('expires_at')
            ))

            conn.commit()
            return event_id

    def get_events(
        self,
        event_type: Optional[str] = None,
        company: Optional[str] = None,
        product: Optional[str] = None,
        min_trust: float = 0.0,
        since: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        """
        Query events with filtering.

        Args:
            event_type: Filter by event type
            company: Filter by company name
            product: Filter by affected product
            min_trust: Minimum trust score
            since: ISO datetime string - only return events after this
            limit: Maximum results

        Returns:
            List of event dictionaries
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            query = "SELECT * FROM intelligence_events WHERE trust_score >= ? AND event_type IS NOT NULL AND event_type != '' AND LOWER(event_type) != 'null'"
            params = [min_trust]

            if event_type:
                query += ' AND event_type = ?'
                params.append(event_type)

            if company:
                query += ' AND company LIKE ?'
                params.append(f'%{company}%')

            if product:
                query += ' AND products_affected LIKE ?'
                params.append(f'%{product}%')

            if since:
                query += ' AND date_extracted >= ?'
                params.append(since)

            query += ' ORDER BY date_extracted DESC LIMIT ?'
            params.append(limit)

            cursor.execute(query, params)
            rows = cursor.fetchall()

            events = []
            for row in rows:
                event = dict(row)
                # Parse JSON fields
                try:
                    event['products_affected'] = json.loads(event['products_affected']) if event['products_affected'] else []
                except:
                    event['products_affected'] = []
                events.append(event)

            return events

    def get_event_by_id(self, event_id: str) -> Optional[Dict]:
        """Get a single event by ID."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM intelligence_events WHERE id = ?', (event_id,))
            row = cursor.fetchone()

            if row:
                event = dict(row)
                try:
                    event['products_affected'] = json.loads(event['products_affected']) if event['products_affected'] else []
                except:
                    event['products_affected'] = []
                return event
            return None

    def update_event_impact(
        self,
        event_id: str,
        impact_low: Optional[float] = None,
        impact_high: Optional[float] = None,
        user_adjusted: Optional[float] = None
    ) -> bool:
        """
        Update impact estimates for an event.

        Args:
            event_id: Event ID
            impact_low: Lower bound of impact estimate
            impact_high: Upper bound of impact estimate
            user_adjusted: User's manual override

        Returns:
            True if updated successfully
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            updates = []
            params = []

            if impact_low is not None:
                updates.append('impact_estimate_low = ?')
                params.append(impact_low)

            if impact_high is not None:
                updates.append('impact_estimate_high = ?')
                params.append(impact_high)

            if user_adjusted is not None:
                updates.append('user_adjusted_impact = ?')
                params.append(user_adjusted)

            if not updates:
                return False

            query = f'UPDATE intelligence_events SET {", ".join(updates)} WHERE id = ?'
            params.append(event_id)

            cursor.execute(query, params)
            conn.commit()

            return cursor.rowcount > 0

    def store_prediction(self, prediction: Dict) -> str:
        """Store a prediction result."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            prediction_id = prediction.get('id')
            if not prediction_id:
                import hashlib
                prediction_id = hashlib.md5(
                    f"{prediction.get('product', '')}:{prediction.get('target_month', '')}:{datetime.now().isoformat()}".encode()
                ).hexdigest()[:16]

            cursor.execute('''
                INSERT OR REPLACE INTO predictions
                (id, product, aps_class, target_month, generated_at, baseline_value,
                 predicted_value, confidence_lower, confidence_upper, driver_attribution,
                 events_included, combined_trust_score, model_version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                prediction_id,
                prediction.get('product', ''),
                prediction.get('aps_class'),
                prediction.get('target_month', ''),
                prediction.get('generated_at') or datetime.now().isoformat(),
                prediction.get('baseline_value'),
                prediction.get('predicted_value'),
                prediction.get('confidence_lower'),
                prediction.get('confidence_upper'),
                json.dumps(prediction.get('driver_attribution', {})),
                json.dumps(prediction.get('events_included', [])),
                prediction.get('combined_trust_score'),
                prediction.get('model_version', '1.0')
            ))

            conn.commit()
            return prediction_id

    def get_predictions(
        self,
        product: Optional[str] = None,
        target_month: Optional[str] = None,
        limit: int = 12
    ) -> List[Dict]:
        """Get stored predictions."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            query = 'SELECT * FROM predictions WHERE 1=1'
            params = []

            if product:
                query += ' AND product = ?'
                params.append(product)

            if target_month:
                query += ' AND target_month = ?'
                params.append(target_month)

            query += ' ORDER BY generated_at DESC LIMIT ?'
            params.append(limit)

            cursor.execute(query, params)
            rows = cursor.fetchall()

            predictions = []
            for row in rows:
                pred = dict(row)
                try:
                    pred['driver_attribution'] = json.loads(pred['driver_attribution']) if pred['driver_attribution'] else {}
                    pred['events_included'] = json.loads(pred['events_included']) if pred['events_included'] else []
                except:
                    pred['driver_attribution'] = {}
                    pred['events_included'] = []
                predictions.append(pred)

            return predictions

    def store_alert(self, alert: Dict) -> str:
        """Store an alert."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            alert_id = alert.get('id')
            if not alert_id:
                import hashlib
                alert_id = hashlib.md5(
                    f"{alert.get('title', '')}:{datetime.now().isoformat()}".encode()
                ).hexdigest()[:16]

            cursor.execute('''
                INSERT OR REPLACE INTO alerts
                (id, created_at, severity, category, title, description, affected_products,
                 affected_months, source_event_id, trust_score, is_read, is_dismissed,
                 requires_action, suggested_actions, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                alert_id,
                alert.get('created_at') or datetime.now().isoformat(),
                alert.get('severity', 'medium'),
                alert.get('category', 'event'),
                alert.get('title', ''),
                alert.get('description', ''),
                json.dumps(alert.get('affected_products', [])),
                json.dumps(alert.get('affected_months', [])),
                alert.get('source_event_id'),
                alert.get('trust_score'),
                1 if alert.get('is_read') else 0,
                1 if alert.get('is_dismissed') else 0,
                1 if alert.get('requires_action') else 0,
                json.dumps(alert.get('suggested_actions', [])),
                alert.get('expires_at')
            ))

            conn.commit()
            return alert_id

    def get_alerts(
        self,
        severity: Optional[str] = None,
        category: Optional[str] = None,
        unread_only: bool = False,
        include_dismissed: bool = False,
        limit: int = 20
    ) -> List[Dict]:
        """Get alerts with filtering."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            query = 'SELECT * FROM alerts WHERE 1=1'
            params = []

            if severity:
                query += ' AND severity = ?'
                params.append(severity)

            if category:
                query += ' AND category = ?'
                params.append(category)

            if unread_only:
                query += ' AND is_read = 0'

            if not include_dismissed:
                query += ' AND is_dismissed = 0'

            query += ' ORDER BY created_at DESC LIMIT ?'
            params.append(limit)

            cursor.execute(query, params)
            rows = cursor.fetchall()

            alerts = []
            for row in rows:
                alert = dict(row)
                try:
                    alert['affected_products'] = json.loads(alert['affected_products']) if alert['affected_products'] else []
                    alert['affected_months'] = json.loads(alert['affected_months']) if alert['affected_months'] else []
                    alert['suggested_actions'] = json.loads(alert['suggested_actions']) if alert['suggested_actions'] else []
                except:
                    alert['affected_products'] = []
                    alert['affected_months'] = []
                    alert['suggested_actions'] = []
                alerts.append(alert)

            return alerts

    def mark_alert_read(self, alert_id: str) -> bool:
        """Mark an alert as read."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE alerts SET is_read = 1 WHERE id = ?', (alert_id,))
            conn.commit()
            return cursor.rowcount > 0

    def dismiss_alert(self, alert_id: str) -> bool:
        """Dismiss an alert."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE alerts SET is_dismissed = 1 WHERE id = ?', (alert_id,))
            conn.commit()
            return cursor.rowcount > 0

    def store_historical_impact(self, impact: Dict) -> str:
        """Store a historical impact for learning."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            impact_id = impact.get('id')
            if not impact_id:
                import hashlib
                impact_id = hashlib.md5(
                    f"{impact.get('event_type', '')}:{impact.get('event_date', '')}".encode()
                ).hexdigest()[:16]

            cursor.execute('''
                INSERT OR REPLACE INTO historical_impacts
                (id, event_type, company, event_date, products_affected, observed_impact,
                 duration_months, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                impact_id,
                impact.get('event_type', ''),
                impact.get('company'),
                impact.get('event_date'),
                json.dumps(impact.get('products_affected', [])),
                impact.get('observed_impact'),
                impact.get('duration_months'),
                impact.get('notes')
            ))

            conn.commit()
            return impact_id

    def get_historical_impacts(
        self,
        event_type: Optional[str] = None,
        company: Optional[str] = None
    ) -> List[Dict]:
        """Get historical impacts for learning/analogues."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            query = 'SELECT * FROM historical_impacts WHERE 1=1'
            params = []

            if event_type:
                query += ' AND event_type = ?'
                params.append(event_type)

            if company:
                query += ' AND company LIKE ?'
                params.append(f'%{company}%')

            cursor.execute(query, params)
            rows = cursor.fetchall()

            impacts = []
            for row in rows:
                impact = dict(row)
                try:
                    impact['products_affected'] = json.loads(impact['products_affected']) if impact['products_affected'] else []
                except:
                    impact['products_affected'] = []
                impacts.append(impact)

            return impacts

    def get_stats(self) -> Dict:
        """Get database statistics."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            stats = {}

            cursor.execute('SELECT COUNT(*) FROM intelligence_events')
            stats['total_events'] = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(*) FROM predictions')
            stats['total_predictions'] = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(*) FROM alerts WHERE is_dismissed = 0')
            stats['active_alerts'] = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(*) FROM alerts WHERE is_read = 0')
            stats['unread_alerts'] = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(*) FROM historical_impacts')
            stats['historical_impacts'] = cursor.fetchone()[0]

            return stats


# Singleton instance
_event_store = None

def get_event_store() -> EventStore:
    """Get or create the event store singleton."""
    global _event_store
    if _event_store is None:
        _event_store = EventStore()
    return _event_store
