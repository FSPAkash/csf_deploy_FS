# Product to APS Class mapping
PRODUCT_APS_MAPPING = {
    'AH': ['ACNF', 'AH_FIT', 'AH_R', 'AWUF', 'MB'],
    'CL': ['CL', 'CL_FIT'],
    'CN': ['CN_1PH', 'CN_3PH', 'CN_FIT'],
    'FN': ['FN_80_MULTI', 'FN_80_VAR', 'FN_90_MULTI', 'FN_90_VAR'],
    'HP': ['HP_1PH', 'HP_3PH', 'HP_FIT'],
    'CL': ['CL', 'CL_FIT'],
    'TT': ['TEST','TEST1']
}

# Reverse mapping for quick lookup
APS_TO_PRODUCT = {}
for product, aps_list in PRODUCT_APS_MAPPING.items():
    for aps in aps_list:
        APS_TO_PRODUCT[aps] = product

MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

MONTH_TO_IDX = {m: i + 1 for i, m in enumerate(MONTHS)}
IDX_TO_MONTH = {i + 1: m for i, m in enumerate(MONTHS)}

# Excel sheet names for unified upload
EXCEL_SHEETS = {
    'baseline': 'Baseline',
    'actuals': 'Actuals',
    'delivered': 'Delivered',
    'weights': 'Weights',
    'market_share': 'MarketShare',
    'metadata': 'Metadata'
}

# Default weights columns
WEIGHT_COLUMNS = [
    'UpromoUp', 'UPromoDwn', 'DPromoUp', 'DPromoDwn',
    'Shortage', 'Regulation', 'Trend', 'Trans', 'PF_Pos', 'PF_Neg'
]