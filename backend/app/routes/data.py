import os
import numpy as np
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..services.excel_handler import excel_handler
from ..utils.constants import PRODUCT_APS_MAPPING

data_bp = Blueprint('data', __name__)


@data_bp.route('/template/<product>', methods=['GET'])
@jwt_required()
def get_template(product):
    """Generate and return template Excel file path"""
    include_aps = request.args.get('include_aps', 'false').lower() == 'true'
    
    try:
        template_path = excel_handler.generate_template_excel(product, include_aps)
        return jsonify({
            'success': True,
            'template_path': template_path,
            'message': f'Template generated for {product}'
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@data_bp.route('/years/<product>', methods=['GET'])
@jwt_required()
def get_available_years(product):
    """Get available years for a product"""
    aps_class = request.args.get('aps_class')
    
    print(f"[DEBUG] ===== GET YEARS =====")
    print(f"[DEBUG] Product: {product}, APS Class: {aps_class}")
    
    baseline_path = excel_handler.get_product_filename(product, 'post_processed', aps_class)
    print(f"[DEBUG] Baseline path: {baseline_path}")
    print(f"[DEBUG] File exists: {os.path.exists(baseline_path) if baseline_path else False}")
    
    # List files in data directory for debugging
    data_dir = excel_handler.data_dir
    if os.path.exists(data_dir):
        files = [f for f in os.listdir(data_dir) if f.startswith(product)]
        print(f"[DEBUG] Files for {product}: {files}")
    
    baseline_data = excel_handler.read_yearly_data(baseline_path)
    print(f"[DEBUG] Baseline data keys: {list(baseline_data.keys()) if baseline_data else 'Empty'}")
    
    if baseline_data and len(baseline_data) > 0:
        years = sorted(list(baseline_data.keys()), reverse=True)
        print(f"[DEBUG] Returning years: {years}")
        return jsonify({
            'success': True,
            'years': years
        }), 200
    
    print(f"[DEBUG] No data found for {product}")
    return jsonify({
        'success': False,
        'years': [],
        'message': f'No data found for {product}'
    }), 404


@data_bp.route('/baseline/<product>/<int:year>', methods=['GET'])
@jwt_required()
def get_baseline_data(product, year):
    """Get baseline data for a specific product and year"""
    aps_class = request.args.get('aps_class')
    
    print(f"[DEBUG] ===== GET BASELINE =====")
    print(f"[DEBUG] Product: {product}, Year: {year}, APS Class: {aps_class}")
    
    baseline_path = excel_handler.get_product_filename(product, 'post_processed', aps_class)
    print(f"[DEBUG] Baseline path: {baseline_path}")
    
    if not baseline_path or not os.path.exists(baseline_path):
        print(f"[DEBUG] File not found: {baseline_path}")
        return jsonify({
            'success': False,
            'message': 'Baseline file not found'
        }), 404
    
    yearly_data = excel_handler.read_yearly_data(baseline_path)
    print(f"[DEBUG] Available years: {list(yearly_data.keys()) if yearly_data else 'None'}")
    
    if yearly_data and year in yearly_data:
        baseline = yearly_data[year]
        print(f"[DEBUG] Baseline for {year}: {baseline}")
        
        # Convert any NaN to 0
        baseline = [0.0 if (isinstance(v, float) and np.isnan(v)) else float(v) for v in baseline]
        
        return jsonify({
            'success': True,
            'baseline': baseline
        }), 200
    
    # Try integer conversion of year keys
    if yearly_data:
        for y in yearly_data.keys():
            if int(y) == int(year):
                baseline = yearly_data[y]
                baseline = [0.0 if (isinstance(v, float) and np.isnan(v)) else float(v) for v in baseline]
                print(f"[DEBUG] Found baseline with key conversion: {baseline}")
                return jsonify({
                    'success': True,
                    'baseline': baseline
                }), 200
    
    print(f"[DEBUG] No data for year {year}")
    return jsonify({
        'success': False,
        'message': f'No data for year {year}'
    }), 404


@data_bp.route('/actuals/<product>/<int:year>', methods=['GET'])
@jwt_required()
def get_actuals_data(product, year):
    """Get actuals data for a specific product and year"""
    aps_class = request.args.get('aps_class')
    
    print(f"[DEBUG] ===== GET ACTUALS =====")
    print(f"[DEBUG] Product: {product}, Year: {year}, APS Class: {aps_class}")
    
    actuals_path = excel_handler.get_product_filename(product, 'actual', aps_class)
    print(f"[DEBUG] Actuals path: {actuals_path}")
    
    if not actuals_path or not os.path.exists(actuals_path):
        print(f"[DEBUG] Actuals file not found")
        return jsonify({
            'success': False,
            'message': 'Actuals file not found'
        }), 404
    
    yearly_data = excel_handler.read_yearly_data(actuals_path)
    
    if yearly_data and year in yearly_data:
        actuals = yearly_data[year]
        actuals = [0.0 if (isinstance(v, float) and np.isnan(v)) else float(v) for v in actuals]
        return jsonify({
            'success': True,
            'actuals': actuals
        }), 200
    
    # Try integer conversion
    if yearly_data:
        for y in yearly_data.keys():
            if int(y) == int(year):
                actuals = yearly_data[y]
                actuals = [0.0 if (isinstance(v, float) and np.isnan(v)) else float(v) for v in actuals]
                return jsonify({
                    'success': True,
                    'actuals': actuals
                }), 200
    
    return jsonify({
        'success': False,
        'message': f'No actuals for year {year}'
    }), 404


@data_bp.route('/delivered/<product>/<int:year>', methods=['GET'])
@jwt_required()
def get_delivered_data(product, year):
    """Get delivered data for a specific product and year"""
    aps_class = request.args.get('aps_class')
    
    print(f"[DEBUG] ===== GET DELIVERED =====")
    print(f"[DEBUG] Product: {product}, Year: {year}, APS Class: {aps_class}")
    
    delivered_path = excel_handler.get_product_filename(product, 'Delivered', aps_class)
    print(f"[DEBUG] Delivered path: {delivered_path}")
    
    if not delivered_path or not os.path.exists(delivered_path):
        print(f"[DEBUG] Delivered file not found")
        return jsonify({
            'success': False,
            'message': 'Delivered file not found'
        }), 404
    
    yearly_data = excel_handler.read_yearly_data(delivered_path)
    
    if yearly_data and year in yearly_data:
        delivered = yearly_data[year]
        delivered = [0.0 if (isinstance(v, float) and np.isnan(v)) else float(v) for v in delivered]
        return jsonify({
            'success': True,
            'delivered': delivered
        }), 200
    
    # Try integer conversion
    if yearly_data:
        for y in yearly_data.keys():
            if int(y) == int(year):
                delivered = yearly_data[y]
                delivered = [0.0 if (isinstance(v, float) and np.isnan(v)) else float(v) for v in delivered]
                return jsonify({
                    'success': True,
                    'delivered': delivered
                }), 200
    
    return jsonify({
        'success': False,
        'message': f'No delivered data for year {year}'
    }), 404


@data_bp.route('/weights/<product>', methods=['GET'])
@jwt_required()
def get_weights(product):
    """Get weights for a product"""
    print(f"[DEBUG] ===== GET WEIGHTS =====")
    print(f"[DEBUG] Product: {product}")
    
    weights_path = excel_handler.get_product_filename(product, 'weights', None)
    print(f"[DEBUG] Weights path: {weights_path}")
    
    if not weights_path or not os.path.exists(weights_path):
        print(f"[DEBUG] Weights file not found")
        return jsonify({
            'success': False,
            'message': 'Weights file not found'
        }), 404
    
    weights = excel_handler.read_weights(weights_path)
    
    if weights:
        return jsonify({
            'success': True,
            'weights': weights
        }), 200
    
    return jsonify({
        'success': False,
        'message': 'Could not read weights'
    }), 404


@data_bp.route('/market-share/<product>', methods=['GET'])
@jwt_required()
def get_market_share(product):
    """Get market share data for a product"""
    print(f"[DEBUG] ===== GET MARKET SHARE =====")
    print(f"[DEBUG] Product: {product}")
    
    ms_path = excel_handler.get_product_filename(product, 'market_share', None)
    print(f"[DEBUG] Market share path: {ms_path}")
    
    if not ms_path or not os.path.exists(ms_path):
        print(f"[DEBUG] Market share file not found")
        return jsonify({
            'success': False,
            'message': 'Market share file not found'
        }), 404
    
    yearly_data = excel_handler.read_yearly_data(ms_path)
    
    if yearly_data:
        # Clean NaN values
        cleaned_data = {}
        for year, values in yearly_data.items():
            cleaned_data[year] = [0.0 if (isinstance(v, float) and np.isnan(v)) else float(v) for v in values]
        
        return jsonify({
            'success': True,
            'market_share': cleaned_data
        }), 200
    
    return jsonify({
        'success': False,
        'message': 'Could not read market share data'
    }), 404


@data_bp.route('/products', methods=['GET'])
@jwt_required()
def get_products():
    """Get list of available products and their APS classes"""
    print(f"[DEBUG] ===== GET PRODUCTS =====")
    
    products, aps_classes = excel_handler.discover_products_and_aps()
    
    print(f"[DEBUG] Discovered products: {products}")
    print(f"[DEBUG] APS classes: {aps_classes}")
    
    return jsonify({
        'success': True,
        'products': products,
        'aps_classes': aps_classes
    }), 200


@data_bp.route('/debug/<product>', methods=['GET'])
@jwt_required()
def debug_product_data(product):
    """Debug endpoint to check product data structure"""
    aps_class = request.args.get('aps_class')
    
    results = {
        'product': product,
        'aps_class': aps_class,
        'data_dir': excel_handler.data_dir,
        'data_dir_exists': os.path.exists(excel_handler.data_dir),
        'files': [],
        'data_types': {}
    }
    
    # List all files for this product
    if os.path.exists(excel_handler.data_dir):
        results['files'] = [f for f in os.listdir(excel_handler.data_dir) if f.startswith(product)]
    
    # Check each data type
    data_types = ['post_processed', 'actual', 'Delivered', 'weights', 'market_share']
    
    for dt in data_types:
        path = excel_handler.get_product_filename(product, dt, aps_class)
        results['data_types'][dt] = {
            'path': path,
            'exists': os.path.exists(path) if path else False,
        }
        
        if path and os.path.exists(path):
            try:
                import pandas as pd
                df = pd.read_csv(path)
                results['data_types'][dt]['columns'] = df.columns.tolist()
                results['data_types'][dt]['shape'] = list(df.shape)
                results['data_types'][dt]['sample'] = df.head(2).to_dict('records')
            except Exception as e:
                results['data_types'][dt]['error'] = str(e)
    
    return jsonify(results), 200


@data_bp.route('/list-files', methods=['GET'])
@jwt_required()
def list_files():
    """List all files in data directory"""
    data_dir = excel_handler.data_dir

    if os.path.exists(data_dir):
        files = os.listdir(data_dir)
        return jsonify({
            'success': True,
            'files': files,
            'directory': data_dir
        }), 200

    return jsonify({
        'success': False,
        'error': 'Data directory not found',
        'directory': data_dir
    }), 404


@data_bp.route('/metadata', methods=['GET'])
@jwt_required()
def get_data_metadata():
    """Get metadata about data files including upload dates"""
    try:
        metadata = excel_handler.get_data_metadata()
        return jsonify({
            'success': True,
            'metadata': metadata
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e),
            'metadata': {}
        }), 200  # Return 200 even on error, with empty metadata


@data_bp.route('/metadata/<product>', methods=['GET'])
@jwt_required()
def get_product_metadata(product):
    """Get metadata for a specific product"""
    try:
        metadata = excel_handler.get_data_metadata()
        product_metadata = metadata.get('products', {}).get(product, {})

        # Also include global baseline date if product-specific not available
        if not product_metadata.get('baseline_data_date'):
            product_metadata['baseline_data_date'] = metadata.get('baseline_data_date')

        return jsonify({
            'success': True,
            'product': product,
            'metadata': product_metadata
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e),
            'metadata': {}
        }), 200