import { useEffect, useCallback } from 'react';

const SHORTCUTS = {
  'ctrl+s': 'save',
  'ctrl+e': 'export',
  'ctrl+r': 'reset',
  'escape': 'close',
  'ctrl+d': 'devMode',
};

export function useKeyboardShortcuts(handlers = {}) {
  const handleKeyDown = useCallback((event) => {
    // Don't trigger shortcuts when typing in inputs
    if (
      event.target.tagName === 'INPUT' ||
      event.target.tagName === 'TEXTAREA' ||
      event.target.isContentEditable
    ) {
      // Allow escape in inputs
      if (event.key !== 'Escape') {
        return;
      }
    }

    // Build shortcut key
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    parts.push(event.key.toLowerCase());
    
    const shortcut = parts.join('+');
    const action = SHORTCUTS[shortcut];

    if (action && handlers[action]) {
      event.preventDefault();
      handlers[action](event);
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Hook for single key shortcut
export function useKeyPress(targetKey, handler, options = {}) {
  const { ctrl = false, shift = false, alt = false, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event) => {
      if (
        event.key.toLowerCase() === targetKey.toLowerCase() &&
        event.ctrlKey === ctrl &&
        event.shiftKey === shift &&
        event.altKey === alt
      ) {
        // Don't trigger in inputs unless escape
        if (
          (event.target.tagName === 'INPUT' ||
           event.target.tagName === 'TEXTAREA') &&
          event.key !== 'Escape'
        ) {
          return;
        }

        event.preventDefault();
        handler(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetKey, handler, ctrl, shift, alt, enabled]);
}