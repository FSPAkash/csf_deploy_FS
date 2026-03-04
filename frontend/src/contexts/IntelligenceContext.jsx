/**
 * Intelligence Context
 * State management for competitive intelligence, predictions, and alerts.
 * ONLY used in Beta2 dashboard.
 *
 * COST OPTIMIZATION:
 * - Request deduplication: prevents duplicate API calls while one is in progress
 * - Conditional alert refresh: only refreshes alerts when new ones are generated
 * - Local filtering: filters are applied client-side to avoid unnecessary API calls
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import * as intelligenceApi from '../services/intelligenceApi';

const IntelligenceContext = createContext(null);

// LocalStorage key for persisting high-trust events
const ARCHIVED_EVENTS_KEY = 'daikin_archived_intelligence_events';

// Helper to load archived events from localStorage
function loadArchivedEventsFromStorage() {
  try {
    const stored = localStorage.getItem(ARCHIVED_EVENTS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        console.log(`[IntelligenceContext] Loaded ${parsed.length} archived events from localStorage`);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[IntelligenceContext] Failed to load archived events from localStorage:', err);
  }
  return [];
}

// Helper to save archived events to localStorage
function saveArchivedEventsToStorage(events) {
  try {
    localStorage.setItem(ARCHIVED_EVENTS_KEY, JSON.stringify(events));
    console.log(`[IntelligenceContext] Saved ${events.length} archived events to localStorage`);
  } catch (err) {
    console.warn('[IntelligenceContext] Failed to save archived events to localStorage:', err);
  }
}

export function IntelligenceProvider({ children }) {
  // High-trust events archive (70%+ trust score) - persists across searches AND page refreshes
  // Initialize from localStorage
  const [archivedHighTrustEvents, setArchivedHighTrustEvents] = useState(() => loadArchivedEventsFromStorage());

  // Threshold for archiving events
  const HIGH_TRUST_THRESHOLD = 0.7;

  // Intelligence state - initialize events from archived if available
  const [events, setEvents] = useState(() => {
    const archived = loadArchivedEventsFromStorage();
    return archived.length > 0 ? archived : [];
  });
  const [predictions, setPredictions] = useState([]);
  const [attributions, setAttributions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertSummary, setAlertSummary] = useState({
    total_active: 0,
    unread: 0,
    by_severity: { high: 0, medium: 0, low: 0 }
  });

  // Loading states
  const [isSearching, setIsSearching] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);

  // Error states
  const [error, setError] = useState(null);

  // Request deduplication refs - prevent duplicate API calls
  const searchInProgressRef = useRef(false);
  const loadEventsInProgressRef = useRef(false);
  const alertsInProgressRef = useRef(false);

  // Cache for avoiding duplicate requests
  const searchCacheRef = useRef({});
  const lastSearchRef = useRef(null);

  // Persist archived events to localStorage whenever they change
  useEffect(() => {
    if (archivedHighTrustEvents.length > 0) {
      saveArchivedEventsToStorage(archivedHighTrustEvents);
    }
  }, [archivedHighTrustEvents]);

  // ============================================
  // INTELLIGENCE ACTIONS
  // ============================================

  const searchIntelligence = useCallback(async (params = {}) => {
    // COST OPTIMIZATION: Prevent duplicate searches while one is in progress
    if (searchInProgressRef.current) {
      console.log('[IntelligenceContext] Search already in progress, skipping duplicate call');
      return { success: false, error: 'Search already in progress', skipped: true };
    }

    searchInProgressRef.current = true;
    setIsSearching(true);
    setError(null);

    try {
      const result = await intelligenceApi.searchIntelligence(params);

      if (result.success) {
        const newEvents = result.events || [];

        // Get high-trust events from new search results
        const newHighTrustEvents = newEvents.filter(e => (e.trust_score || 0) >= HIGH_TRUST_THRESHOLD);

        // Archive current high-trust events + new high-trust events
        setArchivedHighTrustEvents(prev => {
          // Get high-trust events from current events list
          const currentHighTrust = events.filter(e => (e.trust_score || 0) >= HIGH_TRUST_THRESHOLD);

          // Merge: existing archive + current high-trust + new high-trust
          const allHighTrust = [...prev, ...currentHighTrust, ...newHighTrustEvents];

          // Remove duplicates by ID, keeping the newest version
          const eventMap = new Map();
          allHighTrust.forEach(e => {
            const id = e.id || e.event_id;
            if (id) {
              eventMap.set(id, e); // Later entries overwrite earlier ones (newer data)
            }
          });

          const dedupedArchive = Array.from(eventMap.values());
          console.log(`[IntelligenceContext] Updated archive: ${dedupedArchive.length} high-trust events`);

          // Save to localStorage immediately
          saveArchivedEventsToStorage(dedupedArchive);

          return dedupedArchive;
        });

        // Merge new events with archived high-trust events
        // New events take priority (updated data), then add archived ones not in new results
        const newEventIds = new Set(newEvents.map(e => e.id || e.event_id));
        const archivedNotInNew = archivedHighTrustEvents.filter(e => {
          const id = e.id || e.event_id;
          return !newEventIds.has(id);
        });

        // Also check current high-trust events that might not be archived yet
        const currentHighTrust = events.filter(e => {
          const id = e.id || e.event_id;
          return (e.trust_score || 0) >= HIGH_TRUST_THRESHOLD && !newEventIds.has(id);
        });
        const archivedIds = new Set(archivedNotInNew.map(e => e.id || e.event_id));
        const additionalHighTrust = currentHighTrust.filter(e => {
          const id = e.id || e.event_id;
          return !archivedIds.has(id);
        });

        // Combine: new events first, then archived high-trust events
        const mergedEvents = [...newEvents, ...archivedNotInNew, ...additionalHighTrust];

        // Remove duplicates (in case of any edge cases)
        const seenIds = new Set();
        const uniqueEvents = mergedEvents.filter(e => {
          const id = e.id || e.event_id;
          if (!id || seenIds.has(id)) return false;
          seenIds.add(id);
          return true;
        });

        setEvents(uniqueEvents);
        lastSearchRef.current = new Date();

        // COST OPTIMIZATION: Only refresh alerts if new ones were generated
        // The search endpoint returns alerts_generated count
        if (result.alerts_generated > 0) {
          await refreshAlerts();
        }

        return { ...result, events: uniqueEvents };
      } else {
        setError(result.error || 'Search failed');
        return result;
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to search intelligence';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      searchInProgressRef.current = false;
      setIsSearching(false);
    }
  }, [events, archivedHighTrustEvents]);

  const loadEvents = useCallback(async (filters = {}) => {
    // COST OPTIMIZATION: Prevent duplicate event loads while one is in progress
    if (loadEventsInProgressRef.current) {
      console.log('[IntelligenceContext] loadEvents already in progress, skipping duplicate call');
      return { success: false, error: 'Load already in progress', skipped: true };
    }

    loadEventsInProgressRef.current = true;

    try {
      const result = await intelligenceApi.getEvents(filters);

      if (result.success) {
        const newEvents = result.events || [];

        // Get high-trust events from API results to archive them
        const apiHighTrustEvents = newEvents.filter(e => (e.trust_score || 0) >= HIGH_TRUST_THRESHOLD);

        // Merge with archived high-trust events (from both state and localStorage)
        const localArchive = loadArchivedEventsFromStorage();
        const allHighTrust = [...archivedHighTrustEvents, ...localArchive, ...apiHighTrustEvents];

        // Dedupe archived events - keep newest version
        const archivedMap = new Map();
        allHighTrust.forEach(e => {
          const id = e.id || e.event_id;
          if (id) archivedMap.set(id, e);
        });
        const dedupedArchived = Array.from(archivedMap.values());

        // Save updated archive to localStorage (this captures API high-trust events!)
        if (dedupedArchived.length > 0) {
          saveArchivedEventsToStorage(dedupedArchived);
          setArchivedHighTrustEvents(dedupedArchived);
          console.log(`[IntelligenceContext] Archived ${dedupedArchived.length} high-trust events to localStorage`);
        }

        // Merge with new events from API
        const newEventIds = new Set(newEvents.map(e => e.id || e.event_id));
        const archivedNotInNew = dedupedArchived.filter(e => {
          const id = e.id || e.event_id;
          return !newEventIds.has(id);
        });

        // Combine: new events first, then archived high-trust events
        const mergedEvents = [...newEvents, ...archivedNotInNew];

        // Remove duplicates
        const seenIds = new Set();
        const uniqueEvents = mergedEvents.filter(e => {
          const id = e.id || e.event_id;
          if (!id || seenIds.has(id)) return false;
          seenIds.add(id);
          return true;
        });

        console.log(`[IntelligenceContext] loadEvents: ${newEvents.length} from API + ${archivedNotInNew.length} archived = ${uniqueEvents.length} total`);

        setEvents(uniqueEvents);

        return { ...result, events: uniqueEvents };
      }
      return result;
    } catch (err) {
      // On API error, still show archived events from localStorage
      const localArchive = loadArchivedEventsFromStorage();
      if (localArchive.length > 0) {
        console.log(`[IntelligenceContext] API error but showing ${localArchive.length} archived events`);
        setEvents(localArchive);
        return { success: true, events: localArchive, fromCache: true };
      }

      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      loadEventsInProgressRef.current = false;
    }
  }, [archivedHighTrustEvents]);

  const updateEventImpact = useCallback(async (eventId, impact) => {
    try {
      const result = await intelligenceApi.updateEventImpact(eventId, impact);

      if (result.success) {
        // Update local state
        setEvents(prev => prev.map(e =>
          e.id === eventId
            ? { ...e, user_adjusted_impact: impact.user_adjusted, impact_estimate_low: impact.impact_low, impact_estimate_high: impact.impact_high }
            : e
        ));
      }
      return result;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // ============================================
  // PREDICTION ACTIONS
  // ============================================

  const generatePrediction = useCallback(async (params) => {
    setIsPredicting(true);
    setError(null);

    try {
      const result = await intelligenceApi.generatePrediction(params);

      if (result.success) {
        setPredictions(result.predictions || []);
        setAttributions(result.attributions || []);

        // COST OPTIMIZATION: Only refresh alerts if new ones were generated
        // The prediction endpoint returns alerts array
        if (result.alerts && result.alerts.length > 0) {
          await refreshAlerts();
        }

        return result;
      } else {
        setError(result.error || 'Prediction failed');
        return result;
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to generate prediction';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsPredicting(false);
    }
  }, []);

  const getAttribution = useCallback(async (product, month) => {
    try {
      return await intelligenceApi.getAttribution(product, month);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // ============================================
  // ALERT ACTIONS
  // ============================================

  const refreshAlerts = useCallback(async (filters = {}) => {
    // COST OPTIMIZATION: Prevent duplicate alert refreshes while one is in progress
    if (alertsInProgressRef.current) {
      console.log('[IntelligenceContext] Alert refresh already in progress, skipping duplicate call');
      return { success: false, error: 'Refresh already in progress', skipped: true };
    }

    alertsInProgressRef.current = true;
    setIsLoadingAlerts(true);

    try {
      const result = await intelligenceApi.getAlerts(filters);

      if (result.success) {
        setAlerts(result.alerts || []);
        setAlertSummary(result.summary || {
          total_active: 0,
          unread: 0,
          by_severity: { high: 0, medium: 0, low: 0 }
        });
      }
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      alertsInProgressRef.current = false;
      setIsLoadingAlerts(false);
    }
  }, []);

  const markAlertRead = useCallback(async (alertId) => {
    try {
      const result = await intelligenceApi.markAlertRead(alertId);

      if (result.success) {
        setAlerts(prev => prev.map(a =>
          a.id === alertId ? { ...a, is_read: true } : a
        ));

        // Update summary
        setAlertSummary(prev => prev ? {
          ...prev,
          unread: Math.max(0, (prev.unread || 0) - 1)
        } : null);
      }
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const dismissAlert = useCallback(async (alertId) => {
    try {
      const result = await intelligenceApi.dismissAlert(alertId);

      if (result.success) {
        setAlerts(prev => prev.filter(a => a.id !== alertId));

        // Update summary
        setAlertSummary(prev => prev ? {
          ...prev,
          total_active: Math.max(0, (prev.total_active || 0) - 1)
        } : null);
      }
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const markAllAlertsRead = useCallback(async () => {
    try {
      const result = await intelligenceApi.markAllAlertsRead();

      if (result.success) {
        setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
        setAlertSummary(prev => prev ? { ...prev, unread: 0 } : null);
      }
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getEventById = useCallback((eventId) => {
    return events.find(e => e.id === eventId);
  }, [events]);

  const getHighPriorityAlerts = useCallback(() => {
    return alerts.filter(a => a.severity === 'high' && !a.is_dismissed);
  }, [alerts]);

  const getUnreadAlertCount = useCallback(() => {
    return alertSummary?.unread || alerts.filter(a => !a.is_read).length;
  }, [alerts, alertSummary]);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value = {
    // State
    events,
    predictions,
    attributions,
    alerts,
    alertSummary,

    // Loading states
    isSearching,
    isPredicting,
    isLoadingAlerts,

    // Error
    error,
    clearError,

    // Intelligence actions
    searchIntelligence,
    loadEvents,
    updateEventImpact,

    // Prediction actions
    generatePrediction,
    getAttribution,

    // Alert actions
    refreshAlerts,
    markAlertRead,
    dismissAlert,
    markAllAlertsRead,

    // Utilities
    getEventById,
    getHighPriorityAlerts,
    getUnreadAlertCount,
    lastSearchTime: lastSearchRef.current,
  };

  return (
    <IntelligenceContext.Provider value={value}>
      {children}
    </IntelligenceContext.Provider>
  );
}

export function useIntelligence() {
  const context = useContext(IntelligenceContext);
  if (!context) {
    throw new Error('useIntelligence must be used within an IntelligenceProvider');
  }
  return context;
}

export default IntelligenceContext;
