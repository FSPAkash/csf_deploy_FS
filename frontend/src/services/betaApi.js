/**
 * Beta API Service - Handles communication with beta endpoints
 */

import api from './api';

export const betaApi = {
  /**
   * Get data summary and capabilities
   */
  getDataSummary: async (marketShareData, selectedYear) => {
    const response = await api.post('/beta/data-summary', {
      market_share_data: marketShareData,
      selected_year: selectedYear
    });
    return response.data;
  },

  /**
   * Run simulation with enhanced metadata
   */
  simulate: async (params) => {
    const response = await api.post('/beta/simulate', {
      baseline_vals: params.baselineVals,
      weights: params.weights,
      market_share_data: params.marketShareData,
      selected_year: params.selectedYear,
      ms_mode: params.msMode,
      ms_params: params.msParams,
      promo_settings: params.promoSettings,
      shortage_settings: params.shortageSettings,
      regulation_settings: params.regulationSettings,
      custom_settings: params.customSettings,
      toggle_settings: params.toggleSettings,
      locked_events: params.lockedEvents,
      damp_k: params.dampK || 0.5,
      selected_intel_events: params.selectedIntelEvents || [],
      selected_intel_event_objects: params.selectedIntelEventObjects || []
    });
    return response.data;
  },

  /**
   * Validate user input against historical data
   */
  validateInput: async (value, type, marketShareData) => {
    const response = await api.post('/beta/validate-input', {
      value,
      type,
      market_share_data: marketShareData
    });
    return response.data;
  },

  /**
   * Analyze cannibalization potential between source and target products.
   * Returns data-derived defaults, transfer ratios, trend analysis.
   */
  analyzeCannibalization: async (params) => {
    const response = await api.post('/beta/cannibalization/analyze', {
      source_product: params.sourceProduct,
      source_aps_classes: params.sourceApsClasses,
      target_product: params.targetProduct,
      target_aps_class: params.targetApsClass,
      selected_year: params.selectedYear,
    });
    return response.data;
  },

  /**
   * Run cannibalization simulation (naive or intelligent mode).
   * Returns adjusted baselines with full breakdown and justification.
   */
  simulateCannibalization: async (params) => {
    const response = await api.post('/beta/cannibalization/simulate', {
      source_product: params.sourceProduct,
      source_aps_classes: params.sourceApsClasses,
      target_product: params.targetProduct,
      target_aps_class: params.targetApsClass,
      selected_year: params.selectedYear,
      mode: params.mode,
      params: params.simulationParams,
    });
    return response.data;
  },

  /**
   * Submit user feedback. Appended to a persistent Excel file on the backend.
   */
  submitFeedback: async ({ category, rating, comment }) => {
    const response = await api.post('/beta/feedback', {
      category,
      rating,
      comment,
    });
    return response.data;
  },
};

export default betaApi;
