// Comprehensive tutorial steps for the Manufacturer Forecast Simulator
export const TUTORIAL_STEPS = [
  // Step 1: Welcome
  {
    id: 'welcome',
    targetSelector: '[data-tutorial="header"]',
    title: 'Welcome!',
    description: 'Learn to use the Forecast Simulator: select products, adjust market share, add events, and export results. Let\'s start!',
    position: 'bottom',
    arrowDirection: 'down',
    requiresAction: false,
    padding: 12,
  },

  // Step 2: Product Selection
  {
    id: 'product-selector',
    targetSelector: '[data-tutorial="product-selector"]',
    title: 'Select Product',
    description: 'Click to choose a product line (AH, CL, CN, FN, or HP).',
    position: 'right',
    requiresAction: true,
    validationKey: 'productSelected',
    padding: 8,
  },

  // Step 3: APS Class Selection
  {
    id: 'aps-selector',
    targetSelector: '[data-tutorial="aps-selector"]',
    title: 'Choose APS Class',
    description: 'Select a product category or "All Classes" for product level data.',
    position: 'right',
    requiresAction: true,
    validationKey: 'apsSelected',
    padding: 8,
  },

  // Step 4: Year Selection
  {
    id: 'year-selector',
    targetSelector: '[data-tutorial="year-selector"]',
    title: 'Select Year',
    description: 'Pick the year to analyze. Historical years show actuals, future years show forecasts.',
    position: 'right',
    requiresAction: false,
    padding: 8,
  },

  // Step 5: Understanding the Chart
  {
    id: 'forecast-chart',
    targetSelector: '[data-tutorial="forecast-chart"]',
    title: 'Forecast Chart',
    description: 'This chart displays multiple data series. The red "Simulated" line updates in real-time as you make changes in the control panels below.',
    position: 'bottom',
    requiresAction: false,
    padding: 12,
  },

  // Step 6: Chart Toggles
  {
    id: 'chart-toggles',
    targetSelector: '[data-tutorial="chart-toggles"]',
    title: 'Toggle Series',
    description: 'Click to show or hide data series. Try toggling one now.',
    position: 'bottom',
    requiresAction: true,
    validationKey: 'chartToggled',
    padding: 8,
  },

  // Step 7: Warning System
  {
    id: 'warning-checkbox',
    targetSelector: '[data-tutorial="warning-checkbox"]',
    title: 'Enable Warnings',
    description: 'Get amber badges when simulated forecast exceeds baseline significantly.',
    position: 'top',
    requiresAction: false,
    padding: 8,
  },

  // Step 8: Market Share - Select Relative Change Mode
  {
    id: 'market-share-mode-relative',
    targetSelector: '[data-tutorial="market-share-panel"]',
    title: 'Market Share',
    description: 'Select "Relative Change" mode to adjust market share. Other modes are disabled during this tutorial.',
    position: 'top',
    requiresAction: true,
    validationKey: 'marketShareModeSelected',
    padding: 12,
  },

  // Step 9: Market Share Adjustment
  {
    id: 'market-share-slider',
    targetSelector: '[data-tutorial="market-share-slider"]',
    title: 'Adjust Market Share',
    description: 'Move the slider to adjust your market share delta. Watch the chart update!',
    position: 'top',
    requiresAction: true,
    validationKey: 'marketShareAdjusted',
    padding: 8,
  },

  // Step 10: Promotion Panel
  {
    id: 'promotion-panel',
    targetSelector: '[data-tutorial="promotion-panel"]',
    title: 'Promotions',
    description: 'Add promotional events to model demand spikes for specific months.',
    position: 'top',
    requiresAction: false,
    padding: 12,
  },

  // Step 11: Apply Promotion
  {
    id: 'promotion-month',
    targetSelector: '[data-tutorial="promotion-month"]',
    title: 'Select Month',
    description: 'Choose which month to apply the promotion.',
    position: 'top',
    requiresAction: true,
    validationKey: 'promotionMonthSelected',
    padding: 8,
  },

  // Step 12: Promotion Impact
  {
    id: 'promotion-impact',
    targetSelector: '[data-tutorial="promotion-impact"]',
    title: 'Set Impact',
    description: 'Adjust impact percentage. Typical range: 10-30%.',
    position: 'top',
    requiresAction: true,
    validationKey: 'promotionImpactSet',
    padding: 8,
  },

  // Step 13: Lock Promotion
  {
    id: 'lock-promotion',
    targetSelector: '[data-tutorial="lock-promotion"]',
    title: 'Lock Event',
    description: 'Click "Lock Event" to save it. Locked events persist even when you adjust other parameters.',
    position: 'top',
    requiresAction: true,
    validationKey: 'promotionLocked',
    padding: 8,
  },

  // Step 14: Shortage Panel
  {
    id: 'shortage-panel',
    targetSelector: '[data-tutorial="shortage-panel"]',
    title: 'Shortages',
    description: 'Model supply chain disruptions that reduce forecast.',
    position: 'top',
    requiresAction: false,
    padding: 12,
  },

  // Step 15: Regulation Panel
  {
    id: 'regulation-panel',
    targetSelector: '[data-tutorial="regulation-panel"]',
    title: 'Regulations',
    description: 'Account for regulatory changes affecting demand.',
    position: 'top',
    requiresAction: false,
    padding: 12,
  },

  // Step 16: Custom Event Panel
  {
    id: 'custom-event-panel',
    targetSelector: '[data-tutorial="custom-event-panel"]',
    title: 'Custom Events',
    description: 'Create custom events for unique scenarios with flexible impact settings.',
    position: 'top',
    requiresAction: false,
    padding: 12,
  },

  // Step 17: Effect Toggles
  {
    id: 'effect-toggles',
    targetSelector: '[data-tutorial="effect-toggles"]',
    title: 'Advanced Toggles',
    description: 'Control advanced effects like seasonal patterns, trends, and position impacts.',
    position: 'top',
    requiresAction: false,
    padding: 12,
  },

  // Step 18: Try a Toggle
  {
    id: 'toggle-march-madness',
    targetSelector: '[data-tutorial="toggle-march-madness"]',
    title: 'Try Toggling',
    description: 'Toggle "March Madness" on or off. Watch how the line changes.',
    position: 'top',
    requiresAction: true,
    validationKey: 'effectToggled',
    padding: 8,
  },

  // Step 19: Summary Metrics
  {
    id: 'summary-metrics',
    targetSelector: '[data-tutorial="summary-metrics"]',
    title: 'Summary Stats',
    description: 'View key metrics: total units, % change from baseline, and peak month.',
    position: 'top',
    requiresAction: false,
    padding: 12,
  },

  // Step 20: Export Results
  {
    id: 'export-button',
    targetSelector: '[data-tutorial="export-button"]',
    title: 'Export Data',
    description: 'Click "Export CSV" to download your simulation with all parameters and values.',
    position: 'top',
    requiresAction: false,
    padding: 12,
  },

  // Step 21: Complete
  {
    id: 'tutorial-complete',
    targetSelector: '[data-tutorial="header"]',
    title: 'Done!',
    description: 'You now know how to use the Forecast Simulator. Restart this tutorial anytime from the header.',
    position: 'center', // Special position for centered modal
    requiresAction: false,
    padding: 12,
  },
];

// Helper function to get step by ID
export function getStepById(id) {
  return TUTORIAL_STEPS.find(step => step.id === id);
}

// Helper function to get step index by ID
export function getStepIndexById(id) {
  return TUTORIAL_STEPS.findIndex(step => step.id === id);
}
