import { useCallback } from 'react';
import { useForecast } from '../contexts/ForecastContext';
import { EVENT_TYPES, MONTHS } from '../utils/constants';

export function useLockedEvents(eventType) {
  const { lockedEvents, addLockedEvent, removeLockedEvent } = useForecast();

  const events = lockedEvents[eventType] || [];
  const lockedMonths = events.map(e => e.month);
  const availableMonths = MONTHS.filter(m => !lockedMonths.includes(m));
  const canAddMore = events.length < 3;

  const lockEvent = useCallback((eventData) => {
    if (!canAddMore || !eventData.month) return false;
    addLockedEvent(eventType, eventData);
    return true;
  }, [eventType, canAddMore, addLockedEvent]);

  const unlockEvent = useCallback((month) => {
    removeLockedEvent(eventType, month);
  }, [eventType, removeLockedEvent]);

  const getEventByMonth = useCallback((month) => {
    return events.find(e => e.month === month);
  }, [events]);

  return {
    events,
    lockedMonths,
    availableMonths,
    canAddMore,
    lockEvent,
    unlockEvent,
    getEventByMonth,
  };
}