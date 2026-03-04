import pandas as pd
import numpy as np
import os
import re
import json
from datetime import datetime
from ..utils.constants import (
    PRODUCT_APS_MAPPING, MONTHS, EXCEL_SHEETS, WEIGHT_COLUMNS
)
from ..config import Config

# Metadata file to store data update info
METADATA_FILE = 'data_metadata.json'

# APS class to filename mapping (APS identifiers to actual CSV filename prefixes)
APS_FILENAME_MAP = {
    'FN_80_MULTI': 'FN 80 MULTI SPEED',
    'FN_80_VAR': 'FN 80 VAR SPEED',
    'FN_90_MULTI': 'FN 90 MULTI SPEED',
    'FN_90_VAR': 'FN 90 VAR SPEED',
    'HP_1PH': 'HP 1PH',
    'HP_3PH': 'HP 3PH',
    'HP_FIT': 'HP FIT',
    'CN_1PH': 'CN 1PH',
    'CN_3PH': 'CN 3PH',
    'CN_FIT': 'CN FIT',
    'CN_L_3PH': 'CN L 3PH',
    'ACNF': 'ACNF',
    'AH_FIT': 'AH FIT',
    'AH_R': 'AH R',
    'AWUF': 'AWUF',
    'MB': 'MB',
    'CL': 'CL',
    'CL_FIT': 'CL FIT',
    'AHKD_3PH': 'AHKD 3PH',
    'HP_L_3PH': 'HP L 3PH',
}


class ExcelHandler:
    def __init__(self):
        self.data_dir = Config.DATA_DIR
        print(f"[DEBUG] ExcelHandler initialized with data_dir: {self.data_dir}")

    def _get_metadata_path(self):
        """Get path to metadata file"""
        return os.path.join(self.data_dir, METADATA_FILE)

    def get_data_metadata(self):
        """Read data metadata (upload dates, etc.)"""
        metadata_path = self._get_metadata_path()
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"[ERROR] Failed to read metadata: {e}")
        return {}

    def save_data_metadata(self, metadata):
        """Save data metadata"""
        metadata_path = self._get_metadata_path()
        os.makedirs(os.path.dirname(metadata_path), exist_ok=True) if os.path.dirname(metadata_path) else None
        try:
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
        except Exception as e:
            print(f"[ERROR] Failed to save metadata: {e}")

    def parse_filename_date(self, filename):
        """
        Parse date from filename in format MM_DD_YY_Product_Data.xlsx
        Returns date string or None if parsing fails
        """
        # Match pattern: MM_DD_YY at start of filename
        match = re.match(r'^(\d{2})_(\d{2})_(\d{2})_', filename)
        if match:
            month, day, year = match.groups()
            # Convert 2-digit year to 4-digit (assume 20xx)
            full_year = f"20{year}"
            try:
                date_obj = datetime(int(full_year), int(month), int(day))
                return date_obj.strftime('%Y-%m-%d')
            except ValueError:
                pass
        return None

    def parse_bulk_product_excel(self, file_obj, filename):
        """
        Parse bulk product Excel file with format:
        - Rows: Product codes (CL, CN, FN, HP, AH, etc.)
        - Columns: Dates in YY-Mon format (e.g., 19-Apr = April 2019)

        Returns dict with results and metadata
        """
        result = {
            'success': False,
            'products_updated': [],
            'files_created': [],
            'errors': [],
            'warnings': [],
            'data_date': None
        }

        try:
            print(f"[DEBUG] Parsing bulk product Excel: {filename}")

            # Parse date from filename
            data_date = self.parse_filename_date(filename)
            result['data_date'] = data_date
            print(f"[DEBUG] Parsed data date from filename: {data_date}")

            # Read the Excel file
            df = pd.read_excel(file_obj, sheet_name=0)
            print(f"[DEBUG] Excel shape: {df.shape}")
            print(f"[DEBUG] Columns (first 10): {list(df.columns)[:10]}")
            print(f"[DEBUG] First column values: {df.iloc[:, 0].tolist()}")

            # First column should be product codes
            product_col = df.columns[0]
            products_in_file = df[product_col].tolist()
            print(f"[DEBUG] Products in file: {products_in_file}")

            # Parse date columns - they can come in different formats:
            # 1. datetime objects from format like "19-Apr" (Excel interprets as Apr 19)
            # 2. string format like "Jan-26", "Feb-26" (Mon-YY)
            date_columns = []
            month_name_map = {
                'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
            }

            for col in df.columns[1:]:  # Skip first column (product names)
                month = None
                calendar_year = None

                if isinstance(col, datetime):
                    # Pandas parsed it as datetime - extract month and year
                    # Note: Excel interprets "19-Apr" as April 19, 2025 (current year)
                    # We need to interpret the day as the year
                    year = col.day  # The "19" becomes day
                    month = col.month
                    # Convert 2-digit year to fiscal year (April = start of fiscal year)
                    if year < 50:
                        calendar_year = 2000 + year
                    else:
                        calendar_year = 1900 + year
                elif isinstance(col, str):
                    # String format like "Jan-26" or "Jan-2026"
                    col_clean = col.strip()
                    # Try Mon-YY or Mon-YYYY format
                    match = re.match(r'^([A-Za-z]{3})-(\d{2,4})$', col_clean)
                    if match:
                        month_str, year_str = match.groups()
                        month = month_name_map.get(month_str.lower())
                        if month:
                            if len(year_str) == 2:
                                year_int = int(year_str)
                                calendar_year = 2000 + year_int if year_int < 50 else 1900 + year_int
                            else:
                                calendar_year = int(year_str)
                            print(f"[DEBUG] Parsed string column: {col} -> Month={month}, Year={calendar_year}")

                if month and calendar_year:
                    date_columns.append({
                        'col': col,
                        'month': month,
                        'calendar_year': calendar_year,
                    })
                    print(f"[DEBUG] Parsed column: {col} -> Month={month}, CalYear={calendar_year}")

            if not date_columns:
                result['errors'].append("No valid date columns found in Excel file")
                return result

            print(f"[DEBUG] Total date columns parsed: {len(date_columns)}")

            # Ensure data directory exists
            os.makedirs(self.data_dir, exist_ok=True)

            # Process each product row
            for idx, row in df.iterrows():
                product_code = str(row[product_col]).strip().upper()

                if not product_code or product_code == 'NAN':
                    continue

                print(f"[DEBUG] Processing product: {product_code}")

                # Organize data by calendar year
                yearly_data = {}

                for date_info in date_columns:
                    col = date_info['col']
                    month = date_info['month']  # 1=Jan, 2=Feb, ..., 12=Dec
                    calendar_year = date_info['calendar_year']

                    value = row[col]
                    if pd.isna(value):
                        value = 0.0
                    else:
                        value = float(value)

                    # Store by calendar year (not fiscal year)
                    # MONTHS array is calendar-ordered: Jan=0, Feb=1, ..., Dec=11
                    if calendar_year not in yearly_data:
                        yearly_data[calendar_year] = [0.0] * 12

                    # Calendar month index (0-based): Jan=0, Feb=1, ..., Dec=11
                    calendar_month_idx = month - 1

                    yearly_data[calendar_year][calendar_month_idx] = value
                    print(f"[DEBUG] {col} -> Year={calendar_year}, Month={MONTHS[calendar_month_idx]}, Value={value}")

                print(f"[DEBUG] {product_code} calendar years: {list(yearly_data.keys())}")

                # Save as CSV in standard format
                output_data = []
                for year in sorted(yearly_data.keys()):
                    output_data.append({
                        'Year': year,
                        **{MONTHS[i]: yearly_data[year][i] for i in range(12)}
                    })

                output_df = pd.DataFrame(output_data)
                output_path = os.path.join(self.data_dir, f"{product_code}_post_processed.csv")
                output_df.to_csv(output_path, index=False)

                result['products_updated'].append(product_code)
                result['files_created'].append(f"{product_code}_post_processed.csv")
                print(f"[DEBUG] Saved {output_path}")

            # Update metadata with data date
            if data_date:
                metadata = self.get_data_metadata()
                metadata['baseline_data_date'] = data_date
                metadata['baseline_updated_at'] = datetime.now().isoformat()
                metadata['baseline_filename'] = filename
                for product in result['products_updated']:
                    if 'products' not in metadata:
                        metadata['products'] = {}
                    metadata['products'][product] = {
                        'baseline_data_date': data_date,
                        'updated_at': datetime.now().isoformat()
                    }
                self.save_data_metadata(metadata)

            result['success'] = True
            print(f"[DEBUG] Bulk parse complete: {result}")

        except Exception as e:
            print(f"[ERROR] Bulk parse error: {str(e)}")
            import traceback
            traceback.print_exc()
            result['errors'].append(str(e))

        return result
    
    def get_product_filename(self, product, file_type, aps_class=None):
        """Generate product-specific or APS-specific filename"""
        if aps_class:
            filename = f"{product}_{aps_class.replace(' ', '_')}_{file_type}.csv"
        else:
            filename = f"{product}_{file_type}.csv"
        
        full_path = os.path.join(self.data_dir, filename)
        print(f"[DEBUG] get_product_filename: {full_path}, exists: {os.path.exists(full_path)}")
        
        return full_path
    
    def parse_unified_excel(self, file_path, product_code, aps_class=None):
        """
        Parse a unified Excel file with multiple sheets.
        """
        result = {
            'success': False,
            'files_created': [],
            'errors': [],
            'warnings': []
        }
        
        try:
            print(f"[DEBUG] Parsing Excel file: {file_path}")
            print(f"[DEBUG] Product: {product_code}, APS Class: {aps_class}")
            
            xl = pd.ExcelFile(file_path)
            available_sheets = xl.sheet_names
            print(f"[DEBUG] Available sheets: {available_sheets}")
            
            # Process Baseline (required)
            if EXCEL_SHEETS['baseline'] in available_sheets:
                df = pd.read_excel(xl, sheet_name=EXCEL_SHEETS['baseline'])
                print(f"[DEBUG] Baseline sheet columns: {df.columns.tolist()}")
                print(f"[DEBUG] Baseline sheet shape: {df.shape}")
                print(f"[DEBUG] Baseline sheet head:\n{df.head()}")
                
                baseline_path = self.get_product_filename(
                    product_code, 'post_processed', aps_class
                )
                self._save_yearly_data(df, baseline_path)
                result['files_created'].append(f"Baseline: {os.path.basename(baseline_path)}")
            else:
                result['errors'].append(f"Baseline sheet '{EXCEL_SHEETS['baseline']}' is required. Available sheets: {available_sheets}")
                return result
            
            # Process Actuals (optional)
            if EXCEL_SHEETS['actuals'] in available_sheets:
                df = pd.read_excel(xl, sheet_name=EXCEL_SHEETS['actuals'])
                print(f"[DEBUG] Actuals sheet columns: {df.columns.tolist()}")
                actuals_path = self.get_product_filename(
                    product_code, 'actual', aps_class
                )
                self._save_yearly_data(df, actuals_path)
                result['files_created'].append(f"Actuals: {os.path.basename(actuals_path)}")
            else:
                result['warnings'].append(f"Actuals sheet not found")
            
            # Process Delivered (optional)
            if EXCEL_SHEETS['delivered'] in available_sheets:
                df = pd.read_excel(xl, sheet_name=EXCEL_SHEETS['delivered'])
                print(f"[DEBUG] Delivered sheet columns: {df.columns.tolist()}")
                delivered_path = self.get_product_filename(
                    product_code, 'Delivered', aps_class
                )
                self._save_yearly_data(df, delivered_path)
                result['files_created'].append(f"Delivered: {os.path.basename(delivered_path)}")
            else:
                result['warnings'].append(f"Delivered sheet not found")
            
            # Process Weights (product-level only, not APS-specific)
            if EXCEL_SHEETS['weights'] in available_sheets and aps_class is None:
                df = pd.read_excel(xl, sheet_name=EXCEL_SHEETS['weights'])
                print(f"[DEBUG] Weights sheet columns: {df.columns.tolist()}")
                weights_path = self.get_product_filename(product_code, 'weights', None)
                self._save_weights(df, weights_path)
                result['files_created'].append(f"Weights: {os.path.basename(weights_path)}")
            
            # Process Market Share (product-level only)
            if EXCEL_SHEETS['market_share'] in available_sheets and aps_class is None:
                df = pd.read_excel(xl, sheet_name=EXCEL_SHEETS['market_share'])
                print(f"[DEBUG] MarketShare sheet columns: {df.columns.tolist()}")
                ms_path = self.get_product_filename(product_code, 'market_share', None)
                self._save_yearly_data(df, ms_path)
                result['files_created'].append(f"Market Share: {os.path.basename(ms_path)}")
            
            result['success'] = True
            print(f"[DEBUG] Parse result: {result}")
            
        except Exception as e:
            print(f"[ERROR] Parse error: {str(e)}")
            import traceback
            traceback.print_exc()
            result['errors'].append(str(e))
        
        return result
    
    def _save_yearly_data(self, df, path):
        """Save yearly data to CSV in standard format"""
        print(f"[DEBUG] Saving yearly data to: {path}")
        print(f"[DEBUG] Input columns: {df.columns.tolist()}")
        
        # Ensure proper column names
        expected_cols = ['Year'] + MONTHS
        
        # Try to normalize column names - strip whitespace
        df.columns = df.columns.str.strip()
        
        # Handle Year column
        if 'Year' not in df.columns:
            if 'year' in df.columns:
                df = df.rename(columns={'year': 'Year'})
            elif 'YEAR' in df.columns:
                df = df.rename(columns={'YEAR': 'Year'})
        
        # Ensure all month columns exist with proper casing
        for col in MONTHS:
            if col not in df.columns:
                # Try case-insensitive match
                for existing_col in df.columns:
                    if existing_col.lower() == col.lower():
                        df = df.rename(columns={existing_col: col})
                        break
        
        # Convert Year to integer
        if 'Year' in df.columns:
            df['Year'] = df['Year'].astype(int)
        
        # Convert month columns to float, replacing NaN with 0
        for col in MONTHS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
        
        print(f"[DEBUG] Output columns: {df.columns.tolist()}")
        print(f"[DEBUG] Output data:\n{df}")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(path), exist_ok=True) if os.path.dirname(path) else None
        
        df.to_csv(path, index=False)
        print(f"[DEBUG] Saved to {path}, file exists: {os.path.exists(path)}")
    
    def _save_weights(self, df, path):
        """Save weights data to CSV"""
        print(f"[DEBUG] Saving weights to: {path}")
        df.to_csv(path, index=False)
    
    def read_yearly_data(self, path, expected_months=12):
        """Read CSV with Year column and monthly data"""
        print(f"[DEBUG] read_yearly_data called with path: {path}")
        
        try:
            if not path or not os.path.exists(path):
                print(f"[DEBUG] Path does not exist: {path}")
                return {}
            
            df = pd.read_csv(path)
            print(f"[DEBUG] Read CSV successfully")
            print(f"[DEBUG] Columns: {df.columns.tolist()}")
            print(f"[DEBUG] Shape: {df.shape}")
            print(f"[DEBUG] Dtypes:\n{df.dtypes}")
            print(f"[DEBUG] Head:\n{df.head()}")
            
            # Check if it's old format (no Year column)
            if 'Year' not in df.columns and 'year' not in df.columns:
                print(f"[DEBUG] No Year column found, checking for old format")
                df_old = pd.read_csv(path, header=None)
                if df_old.shape[0] == 1 and df_old.shape[1] >= expected_months:
                    current_year = datetime.now().year
                    values = df_old.iloc[0, :expected_months].astype(float).tolist()
                    print(f"[DEBUG] Old format detected, using year {current_year}")
                    return {current_year: values}
                print(f"[DEBUG] Not old format, returning empty")
                return {}
            
            # Process year-based format
            year_col = 'Year' if 'Year' in df.columns else 'year'
            df[year_col] = df[year_col].astype(int)
            
            yearly_data = {}
            month_cols = MONTHS[:expected_months]
            
            print(f"[DEBUG] Looking for month columns: {month_cols}")
            
            # Check which month columns exist
            existing_month_cols = [col for col in month_cols if col in df.columns]
            print(f"[DEBUG] Existing month columns: {existing_month_cols}")
            
            for _, row in df.iterrows():
                year = int(row[year_col])
                values = []
                
                if len(existing_month_cols) == expected_months:
                    # All month columns exist
                    for col in month_cols:
                        val = row[col]
                        if pd.isna(val):
                            values.append(0.0)
                        else:
                            values.append(float(val))
                elif len(existing_month_cols) > 0:
                    # Some month columns exist
                    for col in month_cols:
                        if col in df.columns:
                            val = row[col]
                            if pd.isna(val):
                                values.append(0.0)
                            else:
                                values.append(float(val))
                        else:
                            values.append(0.0)
                else:
                    # No month columns, try numeric columns
                    numeric_cols = [col for col in df.columns if col != year_col]
                    print(f"[DEBUG] Using fallback numeric columns: {numeric_cols}")
                    for i in range(min(expected_months, len(numeric_cols))):
                        val = row[numeric_cols[i]]
                        if pd.isna(val):
                            values.append(0.0)
                        else:
                            values.append(float(val))
                
                # Pad with zeros if needed
                while len(values) < expected_months:
                    values.append(0.0)
                
                yearly_data[year] = values[:expected_months]
                print(f"[DEBUG] Year {year}: {values[:3]}... (first 3 values)")
            
            print(f"[DEBUG] Final yearly_data keys: {list(yearly_data.keys())}")
            return yearly_data
            
        except Exception as e:
            print(f"[ERROR] Error reading {path}: {str(e)}")
            import traceback
            traceback.print_exc()
            return {}
    
    def read_weights(self, path):
        """Read weights file"""
        print(f"[DEBUG] read_weights called with path: {path}")
        
        try:
            if not path or not os.path.exists(path):
                print(f"[DEBUG] Weights path does not exist: {path}")
                return None
            
            wf = pd.read_csv(path)
            print(f"[DEBUG] Weights columns: {wf.columns.tolist()}")
            print(f"[DEBUG] Weights shape: {wf.shape}")
            
            weights_dict = {}
            
            for col in wf.columns:
                col_data = wf[col].dropna().tolist()
                numeric = []
                for x in col_data:
                    try:
                        numeric.append(float(x))
                    except Exception:
                        pass
                
                if len(numeric) >= 12:
                    weights_dict[col] = numeric[:12]
                elif len(numeric) == 1:
                    weights_dict[col] = float(numeric[0])
                elif len(numeric) == 0:
                    weights_dict[col] = 1.0
                else:
                    arr = numeric[:]
                    while len(arr) < 12:
                        arr.append(arr[-1] if arr else 1.0)
                    weights_dict[col] = arr
            
            print(f"[DEBUG] Weights dict keys: {list(weights_dict.keys())}")
            return weights_dict
            
        except Exception as e:
            print(f"[ERROR] Error reading weights {path}: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def discover_products_and_aps(self):
        """Scan data directory for available products and APS classes"""
        print(f"[DEBUG] discover_products_and_aps called")
        print(f"[DEBUG] Data dir: {self.data_dir}")
        
        products = set()
        aps_classes = {}
        
        if not os.path.exists(self.data_dir):
            print(f"[DEBUG] Data directory does not exist: {self.data_dir}")
            return [], {}
        
        all_files = os.listdir(self.data_dir)
        print(f"[DEBUG] All files in data dir: {all_files}")
        
        # Find all weights files (product-level only)
        for filename in all_files:
            if filename.endswith('_weights.csv'):
                parts = filename.replace('_weights.csv', '').split('_')
                if len(parts) == 1:
                    product = parts[0]
                    if product in PRODUCT_APS_MAPPING:
                        products.add(product)
                        print(f"[DEBUG] Found product from weights: {product}")
        
        # Also check for post_processed files
        for filename in all_files:
            if filename.endswith('_post_processed.csv'):
                parts = filename.replace('_post_processed.csv', '').split('_')
                if len(parts) == 1:
                    product = parts[0]
                    if product in PRODUCT_APS_MAPPING:
                        products.add(product)
                        print(f"[DEBUG] Found product from post_processed: {product}")
        
        # Populate APS classes for each product
        # Strategy: Return all expected APS classes from PRODUCT_APS_MAPPING
        # The frontend will show all classes, and the backend will fallback to product-level data if APS file doesn't exist
        for product in products:
            aps_classes[product] = []
            if product in PRODUCT_APS_MAPPING:
                # Add all expected APS classes from the mapping
                aps_classes[product] = list(PRODUCT_APS_MAPPING[product])
                print(f"[DEBUG] Product {product} has APS classes: {aps_classes[product]}")

                # Optional: Mark which ones actually have files (for debugging)
                for aps in PRODUCT_APS_MAPPING[product]:
                    filename_prefix = APS_FILENAME_MAP.get(aps, aps.replace('_', ' '))
                    has_file = any(
                        filename.startswith(f"{filename_prefix}") and filename.endswith('_post_processed.csv')
                        for filename in all_files
                    )
                    if has_file:
                        print(f"[DEBUG] APS class {aps} has dedicated file")
                    else:
                        print(f"[DEBUG] APS class {aps} will use product-level file")
        
        print(f"[DEBUG] Final products: {sorted(list(products))}")
        print(f"[DEBUG] Final aps_classes: {aps_classes}")
        
        return sorted(list(products)), aps_classes
    
    def generate_template_excel(self, product_code, include_aps=False):
        """Generate a template Excel file for data upload"""
        template_path = os.path.join(self.data_dir, f"{product_code}_template.xlsx")
        
        print(f"[DEBUG] Generating template at: {template_path}")
        
        # Ensure directory exists
        os.makedirs(self.data_dir, exist_ok=True)
        
        output = pd.ExcelWriter(template_path, engine='openpyxl')
        
        # Baseline template
        baseline_df = pd.DataFrame({
            'Year': [2024, 2025],
            **{month: [0.0, 0.0] for month in MONTHS}
        })
        baseline_df.to_excel(output, sheet_name=EXCEL_SHEETS['baseline'], index=False)
        
        # Actuals template
        actuals_df = pd.DataFrame({
            'Year': [2024],
            **{month: [0.0] for month in MONTHS}
        })
        actuals_df.to_excel(output, sheet_name=EXCEL_SHEETS['actuals'], index=False)
        
        # Delivered template
        delivered_df = pd.DataFrame({
            'Year': [2025],
            **{month: [0.0] for month in MONTHS}
        })
        delivered_df.to_excel(output, sheet_name=EXCEL_SHEETS['delivered'], index=False)
        
        # Weights template (12 rows for months)
        weights_data = {col: [1.0] * 12 for col in WEIGHT_COLUMNS}
        weights_df = pd.DataFrame(weights_data)
        weights_df.to_excel(output, sheet_name=EXCEL_SHEETS['weights'], index=False)
        
        # Market Share template
        ms_df = pd.DataFrame({
            'Year': [2023, 2024],
            **{month: [25.0, 25.0] for month in MONTHS}
        })
        ms_df.to_excel(output, sheet_name=EXCEL_SHEETS['market_share'], index=False)
        
        # Metadata template
        if include_aps and product_code in PRODUCT_APS_MAPPING:
            aps_list = PRODUCT_APS_MAPPING[product_code]
        else:
            aps_list = []
        
        metadata_df = pd.DataFrame({
            'Property': ['Product', 'APS Classes', 'Created'],
            'Value': [product_code, ', '.join(aps_list), datetime.now().isoformat()]
        })
        metadata_df.to_excel(output, sheet_name=EXCEL_SHEETS['metadata'], index=False)
        
        output.close()
        
        print(f"[DEBUG] Template created at: {template_path}")
        return template_path


# Singleton instance
excel_handler = ExcelHandler()