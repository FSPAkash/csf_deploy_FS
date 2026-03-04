"""
Beta API Routes - Protected endpoints for beta features

Only accessible by users with is_beta=True
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from functools import wraps

from ..services.market_share_beta import market_share_beta_service
from ..services.simulation import simulation_engine
from ..services.intelligence.event_store import get_event_store
from ..services.cannibalization import cannibalization_service
from ..services.feedback import feedback_service
from ..utils.constants import MONTHS

beta_bp = Blueprint('beta', __name__)


def beta_required(fn):
    """Decorator to require beta access"""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if not claims.get('is_beta', False):
            return jsonify({
                'success': False,
                'message': 'Beta access required'
            }), 403
        return fn(*args, **kwargs)
    return wrapper


@beta_bp.route('/data-summary', methods=['POST'])
@beta_required
def get_data_summary():
    """Get summary of available data and what analysis is possible"""
    data = request.get_json()
    market_share_data = data.get('market_share_data', {})
    selected_year = data.get('selected_year', 2025)

    # Convert string keys to int if needed
    if market_share_data:
        market_share_data = {int(k): v for k, v in market_share_data.items()}

    summary = market_share_beta_service.get_data_summary(
        market_share_data,
        selected_year
    )

    return jsonify({
        'success': True,
        'summary': summary
    }), 200


@beta_bp.route('/simulate', methods=['POST'])
@beta_required
def simulate_beta():
    """
    Enhanced simulation with metadata and uncertainty quantification
    """
    data = request.get_json()

    # Extract parameters
    baseline_vals = data.get('baseline_vals', [0] * 12)
    weights = data.get('weights', {})
    market_share_data = data.get('market_share_data', {})
    selected_year = data.get('selected_year', 2025)

    # Convert market share data keys to int
    if market_share_data:
        market_share_data = {int(k): v for k, v in market_share_data.items()}

    # Market share settings
    ms_mode = data.get('ms_mode', 'relative')
    ms_params = data.get('ms_params', {})

    # Calculate market share adjustments with metadata
    if ms_mode == 'relative':
        ms_result = market_share_beta_service.calculate_relative_change(
            ms_params.get('delta', 0),
            historical_data=market_share_data
        )
    elif ms_mode == 'historical':
        ms_result = market_share_beta_service.calculate_historical_trend(
            market_share_data,
            selected_year,
            ms_params.get('trend_strength', 100),
            ms_params.get('apply_seasonality', True)
        )
    elif ms_mode == 'competitive':
        ms_result = market_share_beta_service.calculate_competitive_scenario(
            ms_params
        )
    elif ms_mode == 'macro':
        ms_result = market_share_beta_service.calculate_macro_scenario(
            ms_params.get('market_growth', 0),
            ms_params.get('our_capacity', 0),
            ms_params.get('elasticity', 1.0)
        )
    else:
        ms_result = {
            'adjustments': {m: 1.0 for m in MONTHS},
            'metadata': {'mode': 'none', 'error': 'Unknown mode'}
        }

    ms_adjustments = ms_result['adjustments']
    ms_metadata = ms_result['metadata']

    ms_settings = {
        'mode': ms_mode,
        'adjustments': ms_adjustments
    }

    # Event settings
    promo_settings = data.get('promo_settings', {'month': None})
    shortage_settings = data.get('shortage_settings', {'month': None})
    regulation_settings = data.get('regulation_settings', {'month': None})
    custom_settings = data.get('custom_settings', {'month': None})

    # Toggle settings
    toggle_settings = data.get('toggle_settings', {})

    # Locked events
    locked_events = data.get('locked_events', {})

    # Intelligence events - fetch full event data from IDs
    selected_intel_event_objects = data.get('selected_intel_event_objects', [])
    selected_intel_event_ids = data.get('selected_intel_events', [])
    intel_events = []

    if selected_intel_event_objects:
        # Use the full event objects sent directly from the frontend.
        # This handles both raw (un-stored) and NLP-extracted events.
        for event_obj in selected_intel_event_objects:
            # Normalize the ID field so downstream code can reference event['id']
            if 'id' not in event_obj and 'event_id' in event_obj:
                event_obj['id'] = event_obj['event_id']
            intel_events.append(event_obj)
    elif selected_intel_event_ids:
        # Fallback: look up by ID in the database (only works for stored events)
        event_store = get_event_store()
        for event_id in selected_intel_event_ids:
            event = event_store.get_event_by_id(event_id)
            if event:
                intel_events.append(event)

    # Run simulation
    result = simulation_engine.compute_simulation(
        baseline_vals=baseline_vals,
        weights=weights,
        ms_settings=ms_settings,
        promo_settings=promo_settings,
        shortage_settings=shortage_settings,
        regulation_settings=regulation_settings,
        custom_settings=custom_settings,
        toggle_settings=toggle_settings,
        locked_events=locked_events,
        damp_k=data.get('damp_k', 0.5),
        intel_events=intel_events
    )

    # Calculate exceeded months for warnings
    exceeded = simulation_engine.calculate_exceeded_months(
        result['simulated'],
        baseline_vals,
        sensitivity=1.5
    )

    # Calculate confidence bands if historical mode
    confidence_bands = None
    if ms_mode == 'historical' and 'projection' in ms_metadata:
        ci = ms_metadata['projection'].get('confidence_interval_95', {})
        if ci:
            lower_pct = ci.get('lower_pct', 0) / 100
            upper_pct = ci.get('upper_pct', 0) / 100
            confidence_bands = {
                'lower': [baseline_vals[i] * (1 + lower_pct) for i in range(12)],
                'upper': [baseline_vals[i] * (1 + upper_pct) for i in range(12)]
            }

    return jsonify({
        'success': True,
        'simulated': result['simulated'],
        'final_multipliers': result['final_multipliers'],
        'applied_details': result['applied_details'],
        'ms_adjustments': ms_adjustments,
        'ms_metadata': ms_metadata,
        'confidence_bands': confidence_bands,
        'exceeded_months': exceeded,
        'intel_adjustments': result.get('intel_adjustments', {}),
        'intel_events_count': len(intel_events)
    }), 200


@beta_bp.route('/validate-input', methods=['POST'])
@beta_required
def validate_input():
    """
    Validate user input against historical data
    """
    data = request.get_json()
    input_value = data.get('value', 0)
    input_type = data.get('type', 'yoy_change')  # yoy_change, absolute, etc.
    market_share_data = data.get('market_share_data', {})

    if market_share_data:
        market_share_data = {int(k): v for k, v in market_share_data.items()}

    validation = {
        'input_value': input_value,
        'input_type': input_type,
        'is_valid': True,
        'warnings': [],
        'suggestions': []
    }

    if input_type == 'yoy_change' and market_share_data:
        # Get historical YoY changes
        summary = market_share_beta_service.get_data_summary(market_share_data, 2099)

        if 'yoy_statistics' in summary:
            stats = summary['yoy_statistics']
            min_yoy = stats['min_yoy_pct']
            max_yoy = stats['max_yoy_pct']
            mean_yoy = stats['mean_yoy_pct']

            validation['historical_range'] = {
                'min': min_yoy,
                'max': max_yoy,
                'mean': mean_yoy
            }

            if input_value < min_yoy:
                validation['warnings'].append(
                    f"Input ({input_value}%) is below historical minimum ({min_yoy}%)"
                )
                validation['suggestions'].append(
                    f"Consider using a value closer to historical range ({min_yoy}% to {max_yoy}%)"
                )
            elif input_value > max_yoy:
                validation['warnings'].append(
                    f"Input ({input_value}%) is above historical maximum ({max_yoy}%)"
                )
                validation['suggestions'].append(
                    f"Consider using a value closer to historical range ({min_yoy}% to {max_yoy}%)"
                )

    return jsonify({
        'success': True,
        'validation': validation
    }), 200


@beta_bp.route('/cannibalization/analyze', methods=['POST'])
@beta_required
def analyze_cannibalization():
    """
    Analyze cannibalization potential between source and target products.

    Loads cross-product data and returns data-derived defaults for
    intelligent mode, transfer ratios, trend analysis, and justification.
    """
    data = request.get_json()

    source_product = data.get('source_product', 'FN')
    source_aps_classes = data.get('source_aps_classes', ['FN_80_MULTI', 'FN_80_VAR'])
    target_product = data.get('target_product', 'HP')
    target_aps_class = data.get('target_aps_class', 'HP_1PH')
    selected_year = data.get('selected_year', 2026)

    try:
        result = cannibalization_service.analyze(
            source_product=source_product,
            source_aps_classes=source_aps_classes,
            target_product=target_product,
            target_aps_class=target_aps_class,
            year=selected_year,
        )

        return jsonify({
            'success': True,
            **result,
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e),
        }), 500


@beta_bp.route('/cannibalization/simulate', methods=['POST'])
@beta_required
def simulate_cannibalization():
    """
    Run cannibalization simulation with either naive or intelligent mode.

    Returns adjusted source and target baselines with full breakdown
    and justification metadata.
    """
    data = request.get_json()

    source_product = data.get('source_product', 'FN')
    source_aps_classes = data.get('source_aps_classes', ['FN_80_MULTI', 'FN_80_VAR'])
    target_product = data.get('target_product', 'HP')
    target_aps_class = data.get('target_aps_class', 'HP_1PH')
    selected_year = data.get('selected_year', 2026)
    mode = data.get('mode', 'naive')
    params = data.get('params', {})

    try:
        # Load cross-product data
        cross_data = cannibalization_service.load_cross_product_data(
            source_product, source_aps_classes,
            target_product, target_aps_class, selected_year,
        )

        # Run simulation
        result = cannibalization_service.simulate(
            source_baseline=cross_data['source_baseline'],
            target_baseline=cross_data['target_baseline'],
            mode=mode,
            params=params,
            source_market_share=cross_data['source_market_share'],
            target_market_share=cross_data['target_market_share'],
        )

        return jsonify({
            'success': True,
            **result,
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e),
        }), 500


# ============================================
# FEEDBACK
# ============================================

@beta_bp.route('/feedback', methods=['POST'])
@beta_required
def submit_feedback():
    """
    Submit user feedback. Appends to a persistent Excel file.

    Body: { category, rating (1-5), comment }
    """
    data = request.get_json()
    category = data.get('category', '')
    rating = data.get('rating')
    comment = data.get('comment', '')

    if not category:
        return jsonify({'success': False, 'message': 'Category is required'}), 400

    identity = get_jwt_identity()
    username = identity if isinstance(identity, str) else identity.get('username', 'unknown')

    try:
        row = feedback_service.submit(
            username=username,
            category=category,
            rating=rating,
            comment=comment,
        )
        return jsonify({'success': True, 'feedback': row}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500
