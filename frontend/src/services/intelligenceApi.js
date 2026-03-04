/**
 * Intelligence API Service
 * Client for the competitive intelligence, prediction, and alerts APIs.
 * ONLY available in Beta2 dashboard.
 */

import api from './api';

// ============================================
// INTELLIGENCE ENDPOINTS
// ============================================

/**
 * Search for competitive intelligence
 * @param {Object} params - Search parameters
 * @param {string[]} params.competitors - Competitors to search
 * @param {boolean} params.include_regulatory - Include regulatory search
 * @param {boolean} params.include_industry - Include industry trends
 */
export async function searchIntelligence(params = {}) {
  // Use longer timeout for search - it makes many external API calls
  const response = await api.post('/intelligence/search', {
    competitors: params.competitors || ['Carrier', 'Trane', 'Lennox'],
    include_regulatory: params.include_regulatory ?? true,
    include_industry: params.include_industry ?? true,
  }, {
    timeout: 120000  // 2 minutes for initial search (many external requests)
  });
  return response.data;
}

/**
 * Get intelligence events with filtering
 * @param {Object} filters - Filter parameters
 */
export async function getEvents(filters = {}) {
  const params = new URLSearchParams();
  if (filters.event_type) params.append('event_type', filters.event_type);
  if (filters.company) params.append('company', filters.company);
  if (filters.product) params.append('product', filters.product);
  if (filters.min_trust) params.append('min_trust', filters.min_trust);
  if (filters.since) params.append('since', filters.since);
  if (filters.limit) params.append('limit', filters.limit);

  const response = await api.get(`/intelligence/events?${params.toString()}`);
  return response.data;
}

/**
 * Get a single event by ID
 * @param {string} eventId - Event ID
 */
export async function getEvent(eventId) {
  const response = await api.get(`/intelligence/events/${eventId}`);
  return response.data;
}

/**
 * Update event impact estimates
 * @param {string} eventId - Event ID
 * @param {Object} impact - Impact values
 */
export async function updateEventImpact(eventId, impact) {
  const response = await api.put(`/intelligence/events/${eventId}/impact`, impact);
  return response.data;
}

// ============================================
// PREDICTION ENDPOINTS
// ============================================

/**
 * Generate market share predictions
 * @param {Object} params - Prediction parameters
 */
export async function generatePrediction(params) {
  const response = await api.post('/intelligence/predict', {
    product: params.product,
    target_year: params.target_year,
    baseline_values: params.baseline_values,
    market_share_data: params.market_share_data,
    include_event_ids: params.include_event_ids || [],
    apply_trend: params.apply_trend ?? true,
    apply_seasonality: params.apply_seasonality ?? true,
    trend_strength: params.trend_strength ?? 1.0,
  });
  return response.data;
}

/**
 * Get driver attribution for a product/month
 * @param {string} product - Product code
 * @param {string} month - Month (1-12)
 */
export async function getAttribution(product, month) {
  const response = await api.get(`/intelligence/attribution/${product}/${month}`);
  return response.data;
}

// ============================================
// ALERT ENDPOINTS
// ============================================

/**
 * Get alerts with filtering
 * @param {Object} filters - Filter parameters
 */
export async function getAlerts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.severity) params.append('severity', filters.severity);
  if (filters.category) params.append('category', filters.category);
  if (filters.unread_only) params.append('unread_only', 'true');
  if (filters.limit) params.append('limit', filters.limit);

  const response = await api.get(`/intelligence/alerts?${params.toString()}`);
  return response.data;
}

/**
 * Mark an alert as read
 * @param {string} alertId - Alert ID
 */
export async function markAlertRead(alertId) {
  const response = await api.put(`/intelligence/alerts/${alertId}/read`);
  return response.data;
}

/**
 * Dismiss an alert
 * @param {string} alertId - Alert ID
 */
export async function dismissAlert(alertId) {
  const response = await api.put(`/intelligence/alerts/${alertId}/dismiss`);
  return response.data;
}

/**
 * Mark all alerts as read
 */
export async function markAllAlertsRead() {
  const response = await api.put('/intelligence/alerts/read-all');
  return response.data;
}

// ============================================
// REFERENCE DATA ENDPOINTS
// ============================================

/**
 * Get reference information about event types
 */
export async function getEventTypes() {
  const response = await api.get('/intelligence/reference/event-types');
  return response.data;
}

/**
 * Get trust scoring information
 */
export async function getTrustInfo() {
  const response = await api.get('/intelligence/reference/trust-scores');
  return response.data;
}

/**
 * Get database statistics
 */
export async function getStats() {
  const response = await api.get('/intelligence/stats');
  return response.data;
}

export default {
  searchIntelligence,
  getEvents,
  getEvent,
  updateEventImpact,
  generatePrediction,
  getAttribution,
  getAlerts,
  markAlertRead,
  dismissAlert,
  markAllAlertsRead,
  getEventTypes,
  getTrustInfo,
  getStats,
};
