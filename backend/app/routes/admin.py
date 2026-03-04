from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt
import os
import tempfile

from ..services.excel_handler import excel_handler
from ..utils.constants import PRODUCT_APS_MAPPING, EXCEL_SHEETS
from ..config import Config

admin_bp = Blueprint('admin', __name__)

def admin_required():
    """Check if current user is admin"""
    claims = get_jwt()
    return claims.get('is_admin', False)

@admin_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_data():
    """Upload Excel file with product data"""
    if not admin_required():
        return jsonify({'success': False, 'message': 'Admin required'}), 403
    
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'}), 400
    
    file = request.files['file']
    product_code = request.form.get('product_code', '').upper()
    aps_class = request.form.get('aps_class')
    upload_type = request.form.get('upload_type', 'product')
    
    if not product_code:
        return jsonify({'success': False, 'message': 'Product code required'}), 400
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({'success': False, 'message': 'File must be Excel (.xlsx or .xls)'}), 400
    
    try:
        import pandas as pd
        import os
        
        # Read Excel file directly from the upload
        xl = pd.ExcelFile(file)
        available_sheets = xl.sheet_names
        
        files_created = []
        warnings = []
        
        # Ensure data directory exists
        data_dir = current_app.config.get('DATA_DIR', 'data')
        os.makedirs(data_dir, exist_ok=True)
        
        # Helper for case-insensitive sheet matching
        def find_sheet(name):
            name_lower = name.lower().replace(' ', '')
            for sheet in available_sheets:
                if sheet.lower().replace(' ', '') == name_lower:
                    return sheet
            return None
        
        # Helper to save CSV
        def save_csv(sheet_name, output_name):
            sheet = find_sheet(sheet_name)
            if sheet:
                df = pd.read_excel(xl, sheet_name=sheet)
                if aps_class and sheet_name not in ['Weights', 'MarketShare']:
                    output_path = os.path.join(data_dir, f"{product_code}_{aps_class}_{output_name}.csv")
                else:
                    output_path = os.path.join(data_dir, f"{product_code}_{output_name}.csv")
                df.to_csv(output_path, index=False)
                files_created.append(f"{sheet_name}: {os.path.basename(output_path)}")
                return True
            return False
        
        # Process required sheets
        if not save_csv('Baseline', 'post_processed'):
            return jsonify({
                'success': False,
                'message': f'Baseline sheet not found. Available sheets: {available_sheets}'
            }), 400
        
        # Process optional sheets
        if aps_class is None:
            if not save_csv('Weights', 'weights'):
                warnings.append('Weights sheet not found')
            save_csv('MarketShare', 'market_share')
        
        save_csv('Actuals', 'actual')
        save_csv('Delivered', 'Delivered')
        
        return jsonify({
            'success': True,
            'message': f'Data uploaded for {product_code}',
            'files_created': files_created,
            'warnings': warnings
        }), 200
        
    except Exception as e:
        import traceback
        print(f"Upload error: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@admin_bp.route('/template', methods=['GET'])
@jwt_required()
def download_template():
    """Download template Excel file"""
    if not admin_required():
        return jsonify({
            'success': False,
            'message': 'Admin access required'
        }), 403
    
    product_code = request.args.get('product', 'XX').upper()
    include_aps = request.args.get('include_aps', 'false').lower() == 'true'
    
    try:
        template_path = excel_handler.generate_template_excel(product_code, include_aps)
        return send_file(
            template_path,
            as_attachment=True,
            download_name=f'{product_code}_template.xlsx'
        )
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@admin_bp.route('/products', methods=['GET'])
@jwt_required()
def list_products():
    """List all available products with their status"""
    if not admin_required():
        return jsonify({
            'success': False,
            'message': 'Admin access required'
        }), 403
    
    products, aps_classes = excel_handler.discover_products_and_aps()
    
    product_details = []
    for product in products:
        has_weights = os.path.exists(
            excel_handler.get_product_filename(product, 'weights', None)
        )
        has_ms = os.path.exists(
            excel_handler.get_product_filename(product, 'market_share', None)
        )
        has_baseline = os.path.exists(
            excel_handler.get_product_filename(product, 'post_processed', None)
        )
        
        product_details.append({
            'code': product,
            'aps_classes': aps_classes.get(product, []),
            'available_aps': PRODUCT_APS_MAPPING.get(product, []),
            'has_weights': has_weights,
            'has_market_share': has_ms,
            'has_baseline': has_baseline
        })
    
    return jsonify({
        'success': True,
        'products': product_details
    }), 200

@admin_bp.route('/delete/<product>', methods=['DELETE'])
@jwt_required()
def delete_product(product):
    """Delete all data for a product"""
    if not admin_required():
        return jsonify({
            'success': False,
            'message': 'Admin access required'
        }), 403
    
    aps_class = request.args.get('aps_class')
    
    deleted_files = []
    errors = []
    
    data_dir = Config.DATA_DIR
    
    if not os.path.exists(data_dir):
        return jsonify({
            'success': True,
            'deleted_files': [],
            'errors': []
        }), 200
    
    if aps_class:
        pattern = f"{product}_{aps_class.replace(' ', '_')}_"
        for filename in os.listdir(data_dir):
            if filename.startswith(pattern):
                try:
                    os.remove(os.path.join(data_dir, filename))
                    deleted_files.append(filename)
                except Exception as e:
                    errors.append(f"Failed to delete {filename}: {str(e)}")
    else:
        for filename in os.listdir(data_dir):
            if filename.startswith(f"{product}_"):
                try:
                    os.remove(os.path.join(data_dir, filename))
                    deleted_files.append(filename)
                except Exception as e:
                    errors.append(f"Failed to delete {filename}: {str(e)}")
    
    return jsonify({
        'success': len(errors) == 0,
        'deleted_files': deleted_files,
        'errors': errors
    }), 200 if len(errors) == 0 else 207

@admin_bp.route('/preview', methods=['POST'])
@jwt_required()
def preview_upload():
    """Preview Excel file contents before upload"""
    if not admin_required():
        return jsonify({'success': False, 'message': 'Admin required'}), 403

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'}), 400

    file = request.files['file']

    try:
        import pandas as pd
        import numpy as np

        xl = pd.ExcelFile(file)
        sheets_preview = {}

        for sheet_name in xl.sheet_names:
            df = pd.read_excel(xl, sheet_name=sheet_name)

            # Replace NaN with None for JSON serialization
            df = df.replace({np.nan: None})

            # Convert to JSON-serializable format
            preview_data = df.head(5).to_dict('records')

            # Convert any remaining non-serializable types
            for row in preview_data:
                for key, value in row.items():
                    if isinstance(value, (np.integer, np.floating)):
                        row[key] = float(value)
                    elif pd.isna(value):
                        row[key] = None

            sheets_preview[sheet_name] = {
                'columns': [str(c) for c in df.columns.tolist()],
                'row_count': len(df),
                'preview': preview_data
            }

        return jsonify({
            'success': True,
            'sheets': sheets_preview,
            'expected_sheets': EXCEL_SHEETS
        }), 200

    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"Preview error: {error_msg}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': error_msg
        }), 400


@admin_bp.route('/upload-bulk', methods=['POST'])
@jwt_required()
def upload_bulk_product_data():
    """
    Upload bulk product baseline data from a single Excel file.
    File format: MM_DD_YY_Product_Data.xlsx
    - Rows: Product codes (CL, CN, FN, HP, AH, etc.)
    - Columns: Dates in YY-Mon format (e.g., 19-Apr = April 2019)
    """
    if not admin_required():
        return jsonify({'success': False, 'message': 'Admin required'}), 403

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'}), 400

    file = request.files['file']
    filename = file.filename

    if not filename.endswith(('.xlsx', '.xls')):
        return jsonify({'success': False, 'message': 'File must be Excel (.xlsx or .xls)'}), 400

    try:
        result = excel_handler.parse_bulk_product_excel(file, filename)

        if result['success']:
            return jsonify({
                'success': True,
                'message': f"Updated baseline data for {len(result['products_updated'])} products",
                'products_updated': result['products_updated'],
                'files_created': result['files_created'],
                'data_date': result['data_date'],
                'warnings': result['warnings']
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to parse Excel file',
                'errors': result['errors'],
                'warnings': result['warnings']
            }), 400

    except Exception as e:
        import traceback
        print(f"Bulk upload error: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@admin_bp.route('/data-metadata', methods=['GET'])
@jwt_required()
def get_data_metadata():
    """Get metadata about uploaded data (dates, etc.)"""
    try:
        metadata = excel_handler.get_data_metadata()
        return jsonify({
            'success': True,
            'metadata': metadata
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@admin_bp.route('/analysis-month', methods=['POST'])
@jwt_required()
def set_analysis_month():
    """Set the focus analysis month (visible to all users on chart)"""
    if not admin_required():
        return jsonify({'success': False, 'message': 'Admin required'}), 403

    data = request.get_json()
    month = data.get('month')  # 0-11 (Jan=0, Dec=11)
    year = data.get('year')

    if month is None or year is None:
        return jsonify({
            'success': False,
            'message': 'Month and year are required'
        }), 400

    try:
        metadata = excel_handler.get_data_metadata()
        metadata['analysis_month'] = month
        metadata['analysis_year'] = year
        excel_handler.save_data_metadata(metadata)

        return jsonify({
            'success': True,
            'message': f'Analysis month set to {month}/{year}',
            'analysis_month': month,
            'analysis_year': year
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500