import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * TooltipPortal - Renders tooltip content in a portal at the body level
 * to avoid overflow clipping issues from parent containers.
 * Automatically positions above the anchor element.
 */
function TooltipPortal({ children, anchorRef, isVisible, offsetY = 8 }) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!isVisible || !anchorRef?.current) return;

    const updatePosition = () => {
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const tooltipEl = tooltipRef.current;

      if (!tooltipEl) return;

      const tooltipRect = tooltipEl.getBoundingClientRect();

      // Position above the anchor, centered horizontally
      let left = anchorRect.left + (anchorRect.width / 2) - (tooltipRect.width / 2);
      let top = anchorRect.top - tooltipRect.height - offsetY;

      // Keep within viewport bounds
      const padding = 8;

      // Prevent going off the left edge
      if (left < padding) {
        left = padding;
      }

      // Prevent going off the right edge
      if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
      }

      // If would go off top, show below instead
      if (top < padding) {
        top = anchorRect.bottom + offsetY;
      }

      setPosition({ top, left });
    };

    // Initial position
    updatePosition();

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isVisible, anchorRef, offsetY]);

  if (!isVisible) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>,
    document.body
  );
}

export default TooltipPortal;
