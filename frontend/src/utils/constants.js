export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MONTH_TO_IDX = Object.fromEntries(MONTHS.map((m, i) => [m, i + 1]));
export const IDX_TO_MONTH = Object.fromEntries(MONTHS.map((m, i) => [i + 1, m]));

export const PRODUCT_APS_MAPPING = {
  'AH': ['ACNF', 'AH_FIT', 'AH_R', 'AWUF', 'MB'],
  'CL': ['CL', 'CL_FIT'],
  'CN': ['CN_1PH', 'CN_3PH', 'CN_FIT'],
  'FN': ['FN_80_MULTI', 'FN_80_VAR', 'FN_90_MULTI', 'FN_90_VAR'],
  'HP': ['HP_1PH', 'HP_3PH', 'HP_FIT'],
  'CL': ['CL', 'CL_FIT'],
  'TT': ['TEST','TEST1']
};

export const CHART_COLORS = {
  baseline: '#2E5C8A',
  simulated: '#f8b091',
  delivered: '#7B68A6',
  actuals: '#FF8C42',
  predicted: '#81B1D5',
  cannibSource: '#DC2626',
  cannibTarget: '#16A34A',
  cannibSourceBase: '#F87171',
  cannibTargetBase: '#4ADE80',
};

export const MS_MODES = {
  RELATIVE: 'relative',
  HISTORICAL: 'historical',
  COMPETITIVE: 'competitive',
  MACRO: 'macro',
};

export const EVENT_TYPES = {
  PROMO: 'Promo',
  SHORTAGE: 'Shortage',
  REGULATION: 'Regulation',
  CUSTOM: 'Custom',
};

export const EXCEL_SHEETS = {
  baseline: 'Baseline',
  actuals: 'Actuals',
  delivered: 'Delivered',
  weights: 'Weights',
  market_share: 'MarketShare',
  metadata: 'Metadata',
};

