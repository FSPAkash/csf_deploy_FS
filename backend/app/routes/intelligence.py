"""
Intelligence API Endpoints
Routes for competitive intelligence, predictions, and alerts.
ONLY available in Beta2 dashboard.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from functools import wraps
from datetime import datetime
import traceback
import json
import os

# Import services
from ..services.intelligence.event_store import get_event_store
from ..services.intelligence.trust_scorer import get_trust_scorer
from ..services.prediction.time_series import get_time_series_model
from ..services.prediction.impact_model import get_impact_model
from ..services.prediction.signal_fusion import get_signal_fusion
from ..services.prediction.attribution import get_attribution_generator
from ..services.alerts.alert_engine import get_alert_engine
from ..services.alerts.alert_store import get_alert_store

# Load static intelligence data for demo mode
_STATIC_EVENTS = None
def _load_static_events():
    global _STATIC_EVENTS
    if _STATIC_EVENTS is None:
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data')
        export_path = os.path.join(data_dir, 'intelligence_export.json')
        try:
            with open(export_path, 'r', encoding='utf-8') as f:
                _STATIC_EVENTS = json.load(f)
            print(f"[Intelligence] Loaded {len(_STATIC_EVENTS)} static events from intelligence_export.json")
        except Exception as e:
            print(f"[Intelligence] Failed to load intelligence_export.json: {e}")
            _STATIC_EVENTS = []
    return _STATIC_EVENTS

bp = Blueprint('intelligence', __name__, url_prefix='/api/intelligence')


def _extract_company_from_title(title: str) -> str:
    """Extract company name from news title if present."""
    competitors = [
        'Carrier', 'Trane', 'Lennox', 'Johnson Controls', 'York',
        'Rheem', 'Goodman', 'Mitsubishi', 'Fujitsu', 'LG', 'Samsung',
        'Bosch', 'Bryant', 'American Standard', 'Ruud', 'Amana'
    ]
    title_lower = title.lower()
    for company in competitors:
        if company.lower() in title_lower:
            return company
    return None


def beta2_required(fn):
    """Decorator to require beta2 access."""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if not claims.get('is_beta'):
            return jsonify({
                'success': False,
                'error': 'Beta2 access required'
            }), 403
        return fn(*args, **kwargs)
    return wrapper


# ============================================
# INTELLIGENCE ENDPOINTS
# ============================================

@bp.route('/search', methods=['POST'])
@beta2_required
def search_intelligence():
    """
    Demo mode: returns pre-loaded intelligence from intelligence_export.json.
    No live web search or OpenAI calls are made.
    """
    try:
        data = request.get_json() or {}
        competitors = data.get('competitors', ['Carrier', 'Trane', 'Lennox'])

        all_events = _load_static_events()

        # Filter by requested competitors (case-insensitive)
        comp_lower = {c.lower() for c in competitors}
        filtered = [
            e for e in all_events
            if not e.get('company')
            or str(e['company']).lower() == 'null'
            or str(e['company']).lower() in comp_lower
            or any(c in str(e.get('company', '')).lower() for c in comp_lower)
        ]

        # Build stats
        by_type = {}
        for e in filtered:
            et = e.get('event_type', 'unknown')
            by_type[et] = by_type.get(et, 0) + 1

        return jsonify({
            'success': True,
            'events': filtered,
            'extraction_stats': {
                'total_results_fetched': len(filtered),
                'total_events_extracted': len(filtered),
                'by_type': by_type
            },
            'alerts_generated': 0,
            'processing_time_seconds': 0.0,
            'openai_available': False,
            'nlp_items_processed': 0,
            'nlp_new_extractions': 0,
            'nlp_cache_hits': 0,
            'demo_mode': True
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/events', methods=['GET'])
@beta2_required
def get_events():
    """
    Demo mode: returns pre-loaded events from intelligence_export.json
    with optional filtering.
    """
    try:
        event_type = request.args.get('event_type')
        company = request.args.get('company')
        product = request.args.get('product')
        min_trust = float(request.args.get('min_trust', 0))
        limit = int(request.args.get('limit', 50))

        all_events = _load_static_events()

        filtered = []
        for e in all_events:
            if event_type and e.get('event_type') != event_type:
                continue
            if company and company.lower() not in str(e.get('company', '')).lower():
                continue
            if product and product not in (e.get('products_affected') or []):
                continue
            if (e.get('trust_score') or 0) < min_trust:
                continue
            filtered.append(e)
            if len(filtered) >= limit:
                break

        return jsonify({
            'success': True,
            'events': filtered,
            'count': len(filtered)
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/events/<event_id>', methods=['GET'])
@beta2_required
def get_event(event_id):
    """Get a single event by ID from static data."""
    try:
        all_events = _load_static_events()
        event = next((e for e in all_events if e.get('id') == event_id), None)

        if not event:
            return jsonify({
                'success': False,
                'error': 'Event not found'
            }), 404

        return jsonify({
            'success': True,
            'event': event
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/events/<event_id>/impact', methods=['PUT'])
@beta2_required
def update_event_impact(event_id):
    """
    Update impact estimates for an event.

    Body:
    - impact_low: Lower bound estimate
    - impact_high: Upper bound estimate
    - user_adjusted: User's manual override
    """
    try:
        data = request.get_json() or {}
        event_store = get_event_store()

        success = event_store.update_event_impact(
            event_id=event_id,
            impact_low=data.get('impact_low'),
            impact_high=data.get('impact_high'),
            user_adjusted=data.get('user_adjusted')
        )

        if not success:
            return jsonify({
                'success': False,
                'error': 'Event not found or update failed'
            }), 404

        return jsonify({
            'success': True,
            'message': 'Impact updated'
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================
# PREDICTION ENDPOINTS
# ============================================

@bp.route('/predict', methods=['POST'])
@beta2_required
def generate_prediction():
    """
    Generate market share predictions.

    Body:
    - product: Product code (required)
    - target_year: Year to predict (required)
    - baseline_values: List of 12 baseline values (required)
    - market_share_data: Historical market share data (required)
    - include_event_ids: List of event IDs to include
    - apply_trend: Apply historical trend (default true)
    - apply_seasonality: Apply seasonal patterns (default true)
    - trend_strength: Trend multiplier (default 1.0)

    Returns:
    - predictions: List of 12 monthly predictions
    - attribution: Driver attribution for each month
    - alerts: Generated alerts
    """
    try:
        data = request.get_json() or {}

        product = data.get('product')
        target_year = data.get('target_year')
        baseline_values = data.get('baseline_values', [])
        market_share_data = data.get('market_share_data', {})

        if not product or not target_year or not baseline_values:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: product, target_year, baseline_values'
            }), 400

        include_event_ids = data.get('include_event_ids', [])
        apply_trend = data.get('apply_trend', True)
        apply_seasonality = data.get('apply_seasonality', True)
        trend_strength = data.get('trend_strength', 1.0)

        # Convert market share data keys to integers
        ms_data = {}
        for year, values in market_share_data.items():
            try:
                ms_data[int(year)] = values
            except:
                pass

        # Get events if specified
        event_store = get_event_store()
        events = []
        if include_event_ids:
            for eid in include_event_ids:
                event = event_store.get_event_by_id(eid)
                if event:
                    events.append(event)
        else:
            # Get recent high-trust events
            events = event_store.get_events(min_trust=0.6, limit=10)

        # Load historical impacts for impact model
        historical_impacts = event_store.get_historical_impacts()
        impact_model = get_impact_model(historical_impacts)

        # Generate predictions
        signal_fusion = get_signal_fusion()
        predictions = signal_fusion.generate_monthly_predictions(
            market_share_data=ms_data,
            target_year=target_year,
            baseline_values=baseline_values,
            events=events,
            apply_trend=apply_trend,
            apply_seasonality=apply_seasonality,
            trend_strength=trend_strength
        )

        # Generate attribution for each prediction
        attribution_gen = get_attribution_generator()
        attributions = []
        for pred in predictions:
            attr = attribution_gen.generate_attribution(pred)
            attributions.append(attr.to_dict() if hasattr(attr, 'to_dict') else {
                'target_month': attr.target_month,
                'baseline_value': attr.baseline_value,
                'predicted_value': attr.predicted_value,
                'total_change': attr.total_change,
                'total_change_pct': attr.total_change_pct,
                'waterfall_steps': [s.__dict__ for s in attr.waterfall_steps],
                'primary_drivers': attr.primary_drivers,
                'summary': attr.summary,
                'combined_trust_score': attr.combined_trust_score
            })

        # Store predictions
        for i, pred in enumerate(predictions):
            MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            event_store.store_prediction({
                'product': product,
                'target_month': f"{target_year}-{str(i+1).zfill(2)}",
                'baseline_value': baseline_values[i] if i < len(baseline_values) else 0,
                'predicted_value': pred.predicted_value,
                'confidence_lower': pred.confidence_lower,
                'confidence_upper': pred.confidence_upper,
                'driver_attribution': attributions[i] if i < len(attributions) else {},
                'events_included': [e.get('id') for e in events],
                'combined_trust_score': pred.combined_trust_score
            })

        # Generate alerts
        alert_engine = get_alert_engine()
        prediction_dicts = [
            {
                'predicted_value': p.predicted_value,
                'combined_trust_score': p.combined_trust_score
            }
            for p in predictions
        ]
        alerts = alert_engine.check_prediction_alerts(prediction_dicts, baseline_values, product)

        # Save alerts
        alert_store = get_alert_store()
        for alert in alerts:
            alert_store.save_alert(alert)

        return jsonify({
            'success': True,
            'predictions': [
                {
                    'target_month': p.target_month,
                    'baseline_value': p.baseline_value,
                    'predicted_value': p.predicted_value,
                    'confidence_lower': p.confidence_lower,
                    'confidence_upper': p.confidence_upper,
                    'combined_trust_score': p.combined_trust_score,
                    'primary_drivers': p.primary_drivers,
                    'data_quality': p.data_quality,
                    'warnings': p.warnings
                }
                for p in predictions
            ],
            'attributions': attributions,
            'events_used': len(events),
            'alerts': [a.to_dict() for a in alerts]
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/attribution/<product>/<month>', methods=['GET'])
@beta2_required
def get_attribution(product, month):
    """
    Get driver attribution for a specific product/month.

    Returns the most recent prediction attribution.
    """
    try:
        event_store = get_event_store()
        predictions = event_store.get_predictions(product=product, limit=12)

        if not predictions:
            return jsonify({
                'success': False,
                'error': 'No predictions found for this product'
            }), 404

        # Find prediction for requested month
        target = None
        for pred in predictions:
            if pred.get('target_month', '').endswith(month.zfill(2)):
                target = pred
                break

        if not target:
            target = predictions[0]  # Return most recent

        attribution_gen = get_attribution_generator()
        chart_data = attribution_gen.to_chart_data(target.get('driver_attribution', {}))

        return jsonify({
            'success': True,
            'product': product,
            'attribution': target.get('driver_attribution', {}),
            'chart_data': chart_data
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================
# ALERT ENDPOINTS
# ============================================

@bp.route('/alerts', methods=['GET'])
@beta2_required
def get_alerts():
    """
    Get alerts with filtering.

    Query params:
    - severity: Filter by severity (high, medium, low)
    - category: Filter by category (prediction, event, regulatory, data_quality)
    - unread_only: Only return unread alerts
    - limit: Maximum results (default 20)
    """
    try:
        severity = request.args.get('severity')
        category = request.args.get('category')
        unread_only = request.args.get('unread_only', '').lower() == 'true'
        limit = int(request.args.get('limit', 20))

        alert_store = get_alert_store()

        alerts = alert_store.get_alerts(
            severity=severity,
            category=category,
            unread_only=unread_only,
            limit=limit
        )

        summary = alert_store.get_alert_summary()

        return jsonify({
            'success': True,
            'alerts': alerts,
            'summary': summary
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/alerts/<alert_id>/read', methods=['PUT'])
@beta2_required
def mark_alert_read(alert_id):
    """Mark an alert as read."""
    try:
        alert_store = get_alert_store()
        success = alert_store.mark_read(alert_id)

        return jsonify({
            'success': success
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/alerts/<alert_id>/dismiss', methods=['PUT'])
@beta2_required
def dismiss_alert(alert_id):
    """Dismiss an alert."""
    try:
        alert_store = get_alert_store()
        success = alert_store.dismiss(alert_id)

        return jsonify({
            'success': success
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/alerts/read-all', methods=['PUT'])
@beta2_required
def mark_all_read():
    """Mark all alerts as read."""
    try:
        alert_store = get_alert_store()
        count = alert_store.mark_all_read()

        return jsonify({
            'success': True,
            'marked_count': count
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================
# REFERENCE DATA ENDPOINTS
# ============================================

@bp.route('/reference/event-types', methods=['GET'])
@beta2_required
def get_event_types():
    """Get reference information about event types."""
    try:
        impact_model = get_impact_model()
        ranges = impact_model.get_reference_ranges()

        return jsonify({
            'success': True,
            'event_types': ranges
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/reference/trust-scores', methods=['GET'])
@beta2_required
def get_trust_info():
    """Get information about trust scoring."""
    try:
        trust_scorer = get_trust_scorer()

        return jsonify({
            'success': True,
            'source_scores': trust_scorer.SOURCE_SCORES,
            'weights': trust_scorer.WEIGHTS,
            'confidence_scores': trust_scorer.CONFIDENCE_SCORES
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/stats', methods=['GET'])
@beta2_required
def get_stats():
    """Get database statistics."""
    try:
        event_store = get_event_store()
        stats = event_store.get_stats()

        return jsonify({
            'success': True,
            'stats': stats
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
