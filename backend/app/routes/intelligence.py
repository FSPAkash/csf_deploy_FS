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

# Import services
from ..services.intelligence.web_search import get_web_search_service
from ..services.intelligence.nlp_extractor import get_nlp_extractor
from ..services.intelligence.event_store import get_event_store
from ..services.intelligence.trust_scorer import get_trust_scorer
from ..services.prediction.time_series import get_time_series_model
from ..services.prediction.impact_model import get_impact_model
from ..services.prediction.signal_fusion import get_signal_fusion
from ..services.prediction.attribution import get_attribution_generator
from ..services.alerts.alert_engine import get_alert_engine
from ..services.alerts.alert_store import get_alert_store

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
    Search for competitive intelligence.

    Body:
    - competitors: List of competitor names to search
    - include_regulatory: Boolean to include regulatory search
    - include_industry: Boolean to include industry trends
    - quick_mode: Skip NLP extraction for faster results (optional)

    Returns:
    - events: List of search results
    - extraction_stats: Statistics about extraction
    """
    try:
        import time
        start_time = time.time()

        data = request.get_json() or {}

        competitors = data.get('competitors', ['Carrier', 'Trane', 'Lennox'])
        include_regulatory = data.get('include_regulatory', True)
        include_industry = data.get('include_industry', True)
        quick_mode = data.get('quick_mode', False)  # Skip NLP for faster results

        print(f"[Intelligence Search] Starting search for {len(competitors)} competitors, quick_mode={quick_mode}")

        # Get services
        web_search = get_web_search_service()
        nlp_extractor = get_nlp_extractor()
        event_store = get_event_store()
        trust_scorer = get_trust_scorer()

        # Check if NLP extractor has OpenAI configured
        has_openai = nlp_extractor.client is not None
        print(f"[Intelligence Search] OpenAI available: {has_openai}")

        all_events = []
        extraction_stats = {
            'total_results_fetched': 0,
            'total_events_extracted': 0,
            'by_type': {}
        }

        # Fetch intelligence
        fetch_start = time.time()
        intelligence = web_search.fetch_all_intelligence(competitors)
        print(f"[Intelligence Search] Fetch completed in {time.time() - fetch_start:.2f}s")

        # Count total results
        total_news = len(intelligence.get('competitor_news', []))
        total_regulatory = len(intelligence.get('regulatory', []))
        print(f"[Intelligence Search] Found {total_news} news items, {total_regulatory} regulatory items")

        # Process competitor news
        extract_start = time.time()

        # Limit NLP extraction to avoid timeouts (max 10 NEW items with OpenAI per call)
        max_nlp_items = 10 if has_openai and not quick_mode else 0
        nlp_new = 0  # Only counts fresh OpenAI calls
        nlp_cache_hits = 0

        for result in intelligence.get('competitor_news', []):
            extraction_stats['total_results_fetched'] += 1

            # Check if this URL has cached NLP results (free, no OpenAI call)
            is_cached = has_openai and not quick_mode and nlp_extractor.has_cached(result.url)

            # Skip NLP extraction if in quick mode or budget exhausted (and not cached)
            if quick_mode or not has_openai or (not is_cached and nlp_new >= max_nlp_items):
                # Store as raw search result without NLP extraction
                raw_event = {
                    'id': f"raw_{hash(result.url) % 1000000:06d}",
                    'event_id': f"raw_{hash(result.url) % 1000000:06d}",
                    'event_type': 'competitor_news',
                    'company': _extract_company_from_title(result.title),
                    'headline': result.title,
                    'description': result.snippet,
                    'source_url': result.url,
                    'source_name': result.source_name,
                    'published_date': result.published_date,
                    'trust_score': web_search.get_source_trust_score(result.url),
                    'confidence': 'low',
                    'is_raw_result': True
                }
                all_events.append(raw_event)
                continue

            # Extract events using NLP (from cache or fresh OpenAI call)
            text = f"{result.title}\n\n{result.snippet}"
            extraction = nlp_extractor.extract_from_text(
                text=text,
                source_url=result.url,
                source_name=result.source_name
            )

            if is_cached:
                nlp_cache_hits += 1
            else:
                nlp_new += 1

            if extraction.success:
                for event in extraction.events:
                    # Calculate trust score
                    event_dict = event.to_dict()
                    event_dict['trust_score'] = web_search.get_source_trust_score(result.url)

                    # Get full trust assessment
                    assessment = trust_scorer.assess_trust(event_dict)
                    event_dict['trust_score'] = assessment.final_score
                    event_dict['trust_explanation'] = assessment.explanation

                    # Store event
                    event_store.store_event(event_dict)
                    all_events.append(event_dict)

                    # Update stats
                    event_type = event.event_type
                    extraction_stats['by_type'][event_type] = extraction_stats['by_type'].get(event_type, 0) + 1
                    extraction_stats['total_events_extracted'] += 1

        print(f"[Intelligence Search] Competitor news processed in {time.time() - extract_start:.2f}s (NLP new: {nlp_new}, cached: {nlp_cache_hits})")

        # Process regulatory if requested
        if include_regulatory:
            reg_start = time.time()
            for result in intelligence.get('regulatory', []):
                extraction_stats['total_results_fetched'] += 1

                is_cached = has_openai and not quick_mode and nlp_extractor.has_cached(result.url)

                # Skip NLP for regulatory in quick mode or if budget exhausted (and not cached)
                if quick_mode or not has_openai or (not is_cached and nlp_new >= max_nlp_items):
                    raw_event = {
                        'id': f"raw_{hash(result.url) % 1000000:06d}",
                        'event_id': f"raw_{hash(result.url) % 1000000:06d}",
                        'event_type': 'regulatory_change',
                        'company': None,
                        'headline': result.title,
                        'description': result.snippet,
                        'source_url': result.url,
                        'source_name': result.source_name,
                        'published_date': result.published_date,
                        'trust_score': web_search.get_source_trust_score(result.url),
                        'confidence': 'low',
                        'is_raw_result': True
                    }
                    all_events.append(raw_event)
                    continue

                text = f"{result.title}\n\n{result.snippet}"
                extraction = nlp_extractor.extract_from_text(
                    text=text,
                    source_url=result.url,
                    source_name=result.source_name
                )

                if is_cached:
                    nlp_cache_hits += 1
                else:
                    nlp_new += 1

                if extraction.success:
                    for event in extraction.events:
                        event_dict = event.to_dict()
                        event_dict['trust_score'] = web_search.get_source_trust_score(result.url)

                        assessment = trust_scorer.assess_trust(event_dict)
                        event_dict['trust_score'] = assessment.final_score

                        event_store.store_event(event_dict)
                        all_events.append(event_dict)

                        event_type = event.event_type
                        extraction_stats['by_type'][event_type] = extraction_stats['by_type'].get(event_type, 0) + 1
                        extraction_stats['total_events_extracted'] += 1

            print(f"[Intelligence Search] Regulatory processed in {time.time() - reg_start:.2f}s")

        # Generate alerts for new events
        alert_engine = get_alert_engine()
        alert_store = get_alert_store()

        alerts = alert_engine.check_event_alerts(all_events)
        alerts.extend(alert_engine.check_regulatory_alerts(all_events))

        for alert in alerts:
            alert_store.save_alert(alert)

        total_time = time.time() - start_time
        print(f"[Intelligence Search] Complete! Total time: {total_time:.2f}s, Events: {len(all_events)}, NLP new: {nlp_new}, cached: {nlp_cache_hits}")

        return jsonify({
            'success': True,
            'events': all_events,
            'extraction_stats': extraction_stats,
            'alerts_generated': len(alerts),
            'processing_time_seconds': round(total_time, 2),
            'openai_available': has_openai,
            'nlp_items_processed': nlp_new + nlp_cache_hits,
            'nlp_new_extractions': nlp_new,
            'nlp_cache_hits': nlp_cache_hits
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
    Get intelligence events with filtering.

    Query params:
    - event_type: Filter by event type
    - company: Filter by company name
    - product: Filter by affected product
    - min_trust: Minimum trust score (0-1)
    - since: ISO datetime - only events after this
    - limit: Maximum results (default 50)
    """
    try:
        event_type = request.args.get('event_type')
        company = request.args.get('company')
        product = request.args.get('product')
        min_trust = float(request.args.get('min_trust', 0))
        since = request.args.get('since')
        limit = int(request.args.get('limit', 50))

        event_store = get_event_store()

        events = event_store.get_events(
            event_type=event_type,
            company=company,
            product=product,
            min_trust=min_trust,
            since=since,
            limit=limit
        )

        return jsonify({
            'success': True,
            'events': events,
            'count': len(events)
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
    """Get a single event by ID."""
    try:
        event_store = get_event_store()
        event = event_store.get_event_by_id(event_id)

        if not event:
            return jsonify({
                'success': False,
                'error': 'Event not found'
            }), 404

        # Get full trust assessment
        trust_scorer = get_trust_scorer()
        all_events = event_store.get_events(limit=50)
        assessment = trust_scorer.assess_trust(event, all_events)

        event['trust_details'] = trust_scorer.explain_score(assessment)

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
