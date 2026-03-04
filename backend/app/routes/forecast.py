from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import numpy as np

from ..services.excel_handler import excel_handler
from ..services.simulation import simulation_engine
from ..services.market_share import market_share_service
from ..utils.constants import MONTHS, PRODUCT_APS_MAPPING

forecast_bp = Blueprint('forecast', __name__)

@forecast_bp.route('/products', methods=['GET'])
@jwt_required()
def get_products():
    """Get available products and APS classes"""
    products, aps_classes = excel_handler.discover_products_and_aps()
    
    return jsonify({
        'success': True,
        'products': products,
        'aps_classes': aps_classes,
        'product_aps_mapping': PRODUCT_APS_MAPPING
    }), 200

@forecast_bp.route('/data/<product>', methods=['GET'])
@jwt_required()
def get_product_data(product):
    """Get all data for a product"""
    aps_class = request.args.get('aps_class')

    # Load baseline data - try APS-specific first, then fall back to product-level
    baseline_path = excel_handler.get_product_filename(product, 'post_processed', aps_class)
    baseline_data = excel_handler.read_yearly_data(baseline_path)

    # If APS-specific file doesn't exist, try product-level file
    if not baseline_data and aps_class:
        print(f"[DEBUG] APS-specific file not found, falling back to product-level for {product}")
        baseline_path = excel_handler.get_product_filename(product, 'post_processed', None)
        baseline_data = excel_handler.read_yearly_data(baseline_path)

    if not baseline_data:
        return jsonify({
            'success': False,
            'message': f'No baseline data found for {product}'
        }), 404

    # Load other data - same fallback strategy
    actuals_path = excel_handler.get_product_filename(product, 'actual', aps_class)
    actuals_data = excel_handler.read_yearly_data(actuals_path, 10)
    if not actuals_data and aps_class:
        actuals_path = excel_handler.get_product_filename(product, 'actual', None)
        actuals_data = excel_handler.read_yearly_data(actuals_path, 10)

    delivered_path = excel_handler.get_product_filename(product, 'Delivered', aps_class)
    delivered_data = excel_handler.read_yearly_data(delivered_path)
    if not delivered_data and aps_class:
        delivered_path = excel_handler.get_product_filename(product, 'Delivered', None)
        delivered_data = excel_handler.read_yearly_data(delivered_path)

    if actuals_data:
        # Pad actuals to 12 months
        for year in actuals_data:
            actuals_data[year] = actuals_data[year] + [None, None]
    
    # Load weights (product-level)
    weights_path = excel_handler.get_product_filename(product, 'weights', None)
    weights = excel_handler.read_weights(weights_path)
    
    # Load market share (product-level)
    ms_path = excel_handler.get_product_filename(product, 'market_share', None)
    market_share_data = excel_handler.read_yearly_data(ms_path)
    
    # Get available years
    available_years = set(baseline_data.keys())
    if actuals_data:
        available_years.update(actuals_data.keys())
    if delivered_data:
        available_years.update(delivered_data.keys())
    
    return jsonify({
        'success': True,
        'product': product,
        'aps_class': aps_class,
        'baseline': baseline_data,
        'actuals': actuals_data,
        'delivered': delivered_data,
        'weights': weights,
        'market_share': market_share_data,
        'available_years': sorted(list(available_years), reverse=True)
    }), 200

@forecast_bp.route('/simulate', methods=['POST'])
@jwt_required()
def simulate():
    """Run simulation with provided parameters"""
    data = request.get_json()
    
    # Extract parameters
    baseline_vals = data.get('baseline_vals', [0] * 12)
    weights = data.get('weights', {})
    
    # Market share settings
    ms_mode = data.get('ms_mode', 'relative')
    ms_params = data.get('ms_params', {})
    
    if ms_mode == 'relative':
        ms_adjustments = market_share_service.calculate_relative_change(
            ms_params.get('delta', 0)
        )
    elif ms_mode == 'historical':
        ms_adjustments = market_share_service.calculate_historical_trend(
            data.get('market_share_data'),
            data.get('selected_year', 2025),
            ms_params.get('trend_strength', 100),
            ms_params.get('apply_seasonality', True)
        )
    elif ms_mode == 'competitive':
        ms_adjustments = market_share_service.calculate_competitive_intelligence(
            ms_params
        )
    elif ms_mode == 'macro':
        ms_adjustments = market_share_service.calculate_macro_scenario(
            ms_params.get('market_growth', 0),
            ms_params.get('our_capacity', 0)
        )
    else:
        ms_adjustments = {m: 1.0 for m in MONTHS}
    
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
        damp_k=data.get('damp_k', 0.5)
    )
    
    # Calculate exceeded months for warnings
    exceeded = simulation_engine.calculate_exceeded_months(
        result['simulated'],
        baseline_vals,
        sensitivity=1.5
    )
    
    return jsonify({
        'success': True,
        'simulated': result['simulated'],
        'final_multipliers': result['final_multipliers'],
        'applied_details': result['applied_details'],
        'ms_adjustments': ms_adjustments,
        'exceeded_months': exceeded
    }), 200

@forecast_bp.route('/export', methods=['POST'])
@jwt_required()
def export_simulation():
    """Export simulation results as CSV data"""
    data = request.get_json()
    
    product = data.get('product', '')
    aps_class = data.get('aps_class')
    year = data.get('year', 2025)
    baseline = data.get('baseline', [])
    simulated = data.get('simulated', [])
    multipliers = data.get('multipliers', {})
    ms_adjustments = data.get('ms_adjustments', {})
    ms_mode = data.get('ms_mode', '')
    applied_details = data.get('applied_details', {})
    
    # Build CSV content
    rows = []
    headers = [
        'Product', 'APS_Class', 'Year', 'Month',
        'Manufacturer_Baseline', 'Event_Multiplier', 'MS_Adjustment',
        'MS_Mode', 'Simulated', 'Delta_vs_Baseline_Pct', 'Applied_Events'
    ]
    rows.append(','.join(headers))
    
    for i, month in enumerate(MONTHS):
        baseline_val = baseline[i] if i < len(baseline) else 0
        sim_val = simulated[i] if i < len(simulated) else 0
        mult = multipliers.get(month, 1.0)
        ms_adj = ms_adjustments.get(month, 1.0)
        
        delta = ((sim_val - baseline_val) / baseline_val * 100) if baseline_val != 0 else 0
        
        events = applied_details.get(month, [])
        events_str = '; '.join([f"{n}:{v:.4f}" for n, v in events]) if events else 'None'
        
        row = [
            product,
            aps_class or 'Product Total',
            str(year),
            month,
            f"{baseline_val:.2f}",
            f"{mult:.4f}",
            f"{ms_adj:.4f}",
            ms_mode,
            f"{sim_val:.2f}",
            f"{delta:.2f}",
            f'"{events_str}"'
        ]
        rows.append(','.join(row))
    
    csv_content = '\n'.join(rows)
    
    return jsonify({
        'success': True,
        'csv_content': csv_content,
        'filename': f"simulation_{product}_{aps_class or 'total'}_{year}.csv"
    }), 200