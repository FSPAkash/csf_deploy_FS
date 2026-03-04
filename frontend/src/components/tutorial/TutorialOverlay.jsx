import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, CheckCircle, Circle, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import { useTutorial } from '../../contexts/TutorialContext';
import { Button } from '../common';

// Exit Warning Modal Component - uses Portal for proper centering
function ExitWarningModal({ isOpen, onConfirm, onCancel, progress }) {
  if (!isOpen) return null;

  // Use portal to render at document root level for proper centering
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 9998 }}
            onClick={onCancel}
          />

          {/* Modal - use flexbox centering instead of transforms */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
            style={{ zIndex: 9999 }}
          >
            <div className="glass rounded-xl shadow-2xl border border-amber-400/40 overflow-hidden backdrop-blur-xl w-96 max-w-full pointer-events-auto">
              {/* Header */}
              <div className="glass-strong border-b border-amber-400/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-lg text-daikin-dark">Exit Tutorial?</h3>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 py-4 bg-white/40">
                <p className="text-sm text-daikin-dark leading-relaxed mb-3">
                  You're only <span className="font-bold text-amber-600">{Math.round(progress)}%</span> through the tutorial.
                </p>
                <p className="text-sm text-surface-600 leading-relaxed">
                  Are you sure you want to exit? You can restart it anytime from the Learning Mode button in the header.
                </p>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 glass-strong border-t border-white/20 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="text-xs px-3 py-2"
                >
                  Continue Tutorial
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onConfirm}
                  className="text-xs px-3 py-2 bg-amber-500 hover:bg-amber-600"
                >
                  Exit Tutorial
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

function TutorialTooltip({
  title,
  description,
  isLastStep = false,
  canProceed = false,
  onNext,
  onPrevious,
  onSkip,
  currentStep,
  totalSteps,
  position,
}) {
  // Determine arrow based on position - arrow points TOWARD the highlighted element
  const ArrowIcon = {
    bottom: ArrowDown,  // Tooltip below element, arrow points down at it
    top: ArrowUp,       // Tooltip above element, arrow points up at it
    left: ArrowLeft,    // Tooltip to left of element, arrow points left at it
    right: ArrowRight,  // Tooltip to right of element, arrow points right at it
  }[position] || ArrowRight;

  const [showExitWarning, setShowExitWarning] = useState(false);
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleExit = () => {
    if (progress < 50) {
      setShowExitWarning(true);
    } else {
      onSkip();
    }
  };

  const confirmExit = () => {
    setShowExitWarning(false);
    onSkip();
  };

  const cancelExit = () => {
    setShowExitWarning(false);
  };

  return (
    <>
      <ExitWarningModal
        isOpen={showExitWarning}
        onConfirm={confirmExit}
        onCancel={cancelExit}
        progress={progress}
      />
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-80 max-w-[calc(100vw-2rem)]"
    >
      {/* Compact Tooltip Card */}
      <div className="glass rounded-lg shadow-2xl border border-daikin-blue/40 overflow-hidden backdrop-blur-xl">
        {/* Header */}
        <div className="glass-strong border-b border-white/20 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowIcon className="w-4 h-4 text-daikin-blue" />
            <h3 className="font-semibold text-sm text-daikin-dark">{title}</h3>
          </div>
          <button
            onClick={handleExit}
            className="text-surface-400 hover:text-daikin-dark transition-colors rounded p-1 hover:bg-white/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-3 py-3 bg-white/40">
          <p className="text-xs text-daikin-dark leading-relaxed">
            {description}
          </p>

          {!canProceed && (
            <div className="mt-2 flex items-start gap-1.5 p-2 glass rounded border border-amber-300/50">
              <Circle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-900 font-medium">
                Complete this action to continue
              </p>
            </div>
          )}

          {canProceed && !isLastStep && (
            <div className="mt-2 flex items-start gap-1.5 p-2 glass rounded border border-green-300/50">
              <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-green-900 font-medium">
                Ready! Click Next to continue
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 glass-strong border-t border-white/20 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrevious}
            disabled={currentStep === 0}
            leftIcon={<ChevronLeft className="w-3 h-3" />}
            className="text-xs px-2 py-1"
          >
            Back
          </Button>

          {!isLastStep ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onNext}
              disabled={!canProceed}
              rightIcon={<ChevronRight className="w-3 h-3" />}
              className="text-xs px-2 py-1"
            >
              Next
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onSkip}
              rightIcon={<CheckCircle className="w-3 h-3" />}
              className="text-xs px-2 py-1"
            >
              Finish
            </Button>
          )}
        </div>

        {/* Progress Bar - Percentage Only */}
        <div className="px-3 py-2 bg-surface-100/50 border-t border-white/10">
          <div className="relative h-2.5 bg-surface-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-daikin-blue to-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-bold text-daikin-dark bg-white/90 px-2 py-0.5 rounded-full shadow-sm">
                {Math.round(((currentStep + 1) / totalSteps) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
    </>
  );
}

function calculateTooltipPosition(targetRect, position, tooltipWidth = 320, tooltipHeight = 300) {
  const margin = 16;
  const gap = 20; // Increased gap to avoid blocking dropdowns
  const headerHeight = 80; // Reserve space for header
  const dropdownBuffer = 300; // Extra buffer for dropdown menus below target

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = 0;
  let top = 0;
  let finalPosition = position;

  // Handle center position for final tutorial step
  if (position === 'center') {
    left = (viewportWidth - tooltipWidth) / 2;
    top = (viewportHeight - tooltipHeight) / 2;
    return { left, top, finalPosition: 'center' };
  }

  // Calculate based on position
  if (position === 'right') {
    left = targetRect.right + gap;
    top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;

    // Check if it goes off right edge
    if (left + tooltipWidth > viewportWidth - margin) {
      // Try left instead
      finalPosition = 'left';
      left = targetRect.left - tooltipWidth - gap;
    }

    // If still off screen, try bottom
    if (left < margin) {
      finalPosition = 'bottom';
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      top = targetRect.bottom + gap + 50; // Extra buffer for dropdowns
    }
  } else if (position === 'left') {
    left = targetRect.left - tooltipWidth - gap;
    top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;

    // Check if it goes off left edge
    if (left < margin) {
      // Try right instead
      finalPosition = 'right';
      left = targetRect.right + gap;
    }
  } else if (position === 'bottom') {
    left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    top = targetRect.bottom + gap + 50; // Extra buffer to avoid blocking dropdowns

    // Check if it goes off bottom
    if (top + tooltipHeight > viewportHeight - margin) {
      // Try positioning to the side instead
      finalPosition = 'right';
      left = targetRect.right + gap;
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;

      // If right doesn't work, try left
      if (left + tooltipWidth > viewportWidth - margin) {
        finalPosition = 'left';
        left = targetRect.left - tooltipWidth - gap;
      }
    }
  } else if (position === 'top') {
    // For top position, prefer side placement to avoid blocking dropdowns
    // First try right side
    left = targetRect.right + gap;
    top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
    finalPosition = 'right';

    // If right doesn't fit, try left
    if (left + tooltipWidth > viewportWidth - margin) {
      finalPosition = 'left';
      left = targetRect.left - tooltipWidth - gap;
    }

    // Only use top position if sides don't work
    if (left < margin) {
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      top = targetRect.top - tooltipHeight - gap;
      finalPosition = 'top';

      // Check if it goes off top or would be hidden by header
      if (top < headerHeight) {
        // Last resort: position to the side with adjusted boundaries
        left = viewportWidth - tooltipWidth - margin;
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        finalPosition = 'right';
      }
    }
  }

  // Final boundary checks - ensure tooltip is never cut off
  if (left < margin) left = margin;
  if (left + tooltipWidth > viewportWidth - margin) {
    left = viewportWidth - tooltipWidth - margin;
  }

  // Ensure tooltip is below header
  if (top < headerHeight) top = headerHeight;

  if (top + tooltipHeight > viewportHeight - margin) {
    top = viewportHeight - tooltipHeight - margin;
  }

  return { left, top, finalPosition };
}

function SpotlightOverlay({ targetRect, children }) {
  const [dropdownRect, setDropdownRect] = useState(null);
  // Use a stable mask ID
  const maskIdRef = useRef(`spotlight-mask-${Math.random().toString(36).substr(2, 9)}`);

  // Watch for open dropdowns within the highlighted area
  useEffect(() => {
    if (!targetRect) return;

    const checkForDropdowns = () => {
      // Look for open dropdown menus (common patterns)
      const dropdownSelectors = [
        '[class*="absolute"][class*="z-"]', // Common dropdown patterns
        '.glass-strong[class*="shadow"]', // Our Select dropdown
        '[role="listbox"]',
        '[role="menu"]',
      ];

      let foundDropdown = null;

      for (const selector of dropdownSelectors) {
        const dropdowns = document.querySelectorAll(selector);
        for (const dropdown of dropdowns) {
          const rect = dropdown.getBoundingClientRect();
          // Check if dropdown is visible and near our target
          if (rect.width > 0 && rect.height > 0) {
            // Check if dropdown appears to be related to our target (within reasonable distance)
            const isNearTarget =
              rect.top >= targetRect.top - 20 &&
              rect.top <= targetRect.bottom + 300 &&
              rect.left >= targetRect.left - 50 &&
              rect.left <= targetRect.right + 50;

            if (isNearTarget && rect.height > 30) {
              foundDropdown = rect;
              break;
            }
          }
        }
        if (foundDropdown) break;
      }

      setDropdownRect(foundDropdown);
    };

    // Check frequently for dropdown changes
    const interval = setInterval(checkForDropdowns, 100);
    checkForDropdowns();

    return () => clearInterval(interval);
  }, [targetRect]);

  if (!targetRect) return null;

  const padding = 8;
  const borderRadius = 12;

  // Calculate spotlight area - expand to include dropdown if open
  let spotX = targetRect.left - padding;
  let spotY = targetRect.top - padding;
  let spotWidth = targetRect.width + padding * 2;
  let spotHeight = targetRect.height + padding * 2;

  // If dropdown is open, expand the spotlight to include it
  if (dropdownRect) {
    const combinedLeft = Math.min(spotX, dropdownRect.left - padding);
    const combinedTop = Math.min(spotY, dropdownRect.top - padding);
    const combinedRight = Math.max(spotX + spotWidth, dropdownRect.right + padding);
    const combinedBottom = Math.max(spotY + spotHeight, dropdownRect.bottom + padding);

    spotX = combinedLeft;
    spotY = combinedTop;
    spotWidth = combinedRight - combinedLeft;
    spotHeight = combinedBottom - combinedTop;
  }

  const maskId = maskIdRef.current;

  return (
    <>
      {/* SVG Overlay with cutout - pointer-events none so clicks pass through */}
      <svg
        className="fixed inset-0 pointer-events-none z-[50]"
        width="100%"
        height="100%"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id={maskId}>
            {/* White background - this will be visible (dimmed) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cutout - this will be transparent (clear) */}
            <rect
              x={spotX}
              y={spotY}
              width={spotWidth}
              height={spotHeight}
              rx={borderRadius}
              ry={borderRadius}
              fill="black"
            />
            {/* Additional cutout for dropdown if it extends beyond main area */}
            {dropdownRect && (
              <rect
                x={dropdownRect.left - padding}
                y={dropdownRect.top - padding}
                width={dropdownRect.width + padding * 2}
                height={dropdownRect.height + padding * 2}
                rx={borderRadius}
                ry={borderRadius}
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Dark overlay with mask applied */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask={`url(#${maskId})`}
        />
      </svg>

      {/* Highlight border with glow - only around main target */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed pointer-events-none z-[55]"
        style={{
          left: targetRect.left - padding,
          top: targetRect.top - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
          pointerEvents: 'none',
        }}
      >
        <motion.div
          className="absolute inset-0 rounded-xl border-3 border-daikin-blue"
          style={{
            boxShadow: '0 0 0 2px rgba(0, 160, 228, 0.3), 0 0 20px rgba(0, 160, 228, 0.4)',
            pointerEvents: 'none',
          }}
          animate={{
            boxShadow: [
              '0 0 0 2px rgba(0, 160, 228, 0.3), 0 0 20px rgba(0, 160, 228, 0.4)',
              '0 0 0 2px rgba(0, 160, 228, 0.5), 0 0 30px rgba(0, 160, 228, 0.6)',
              '0 0 0 2px rgba(0, 160, 228, 0.3), 0 0 20px rgba(0, 160, 228, 0.4)',
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>

      {/* Highlight border for dropdown if visible */}
      {dropdownRect && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed pointer-events-none z-[55]"
          style={{
            left: dropdownRect.left - padding,
            top: dropdownRect.top - padding,
            width: dropdownRect.width + padding * 2,
            height: dropdownRect.height + padding * 2,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-lg border-2 border-daikin-blue/60"
            style={{
              boxShadow: '0 0 15px rgba(0, 160, 228, 0.3)',
              pointerEvents: 'none',
            }}
          />
        </motion.div>
      )}

      {/* Tooltip - this has pointer-events auto */}
      {children}
    </>
  );
}

function TutorialHighlight({ targetSelector, children, position = 'right' }) {
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const tooltipRef = useRef(null);
  const updateIntervalRef = useRef(null);

  const updatePosition = useCallback(() => {
    const element = document.querySelector(targetSelector);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);

      // Calculate tooltip position
      const tooltipHeight = tooltipRef.current?.offsetHeight || 300;
      const tooltipWidth = 320;
      const pos = calculateTooltipPosition(rect, position, tooltipWidth, tooltipHeight);
      setTooltipPos(pos);
    }
  }, [targetSelector, position]);

  useEffect(() => {
    // Scroll element into view on mount
    const element = document.querySelector(targetSelector);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });

      // Wait for scroll to complete, then update position
      setTimeout(() => {
        updatePosition();
      }, 600);
    }

    // Update position periodically for dynamic content
    updateIntervalRef.current = setInterval(updatePosition, 100);

    // Handle window resize
    window.addEventListener('resize', updatePosition);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      window.removeEventListener('resize', updatePosition);
    };
  }, [targetSelector, updatePosition]);

  if (!targetRect || !tooltipPos) return null;

  return (
    <SpotlightOverlay targetRect={targetRect}>
      <div
        ref={tooltipRef}
        className="fixed z-[60] pointer-events-auto"
        style={{
          left: `${tooltipPos.left}px`,
          top: `${tooltipPos.top}px`,
        }}
      >
        {children}
      </div>
    </SpotlightOverlay>
  );
}

export default function TutorialOverlay({ steps }) {
  const { isActive, currentStep, endTutorial, nextStep, previousStep, stepValidation } = useTutorial();

  // Prevent background scrolling during tutorial
  useEffect(() => {
    if (isActive) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isActive]);

  if (!isActive || !steps || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const canProceed = !step.requiresAction || stepValidation[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <AnimatePresence>
      {isActive && (
        <TutorialHighlight
          key={`tutorial-step-${currentStep}`}
          targetSelector={step.targetSelector}
          position={step.position}
        >
          <TutorialTooltip
            title={step.title}
            description={step.description}
            position={step.position}
            isLastStep={isLastStep}
            canProceed={canProceed}
            onNext={nextStep}
            onPrevious={previousStep}
            onSkip={endTutorial}
            currentStep={currentStep}
            totalSteps={steps.length}
          />
        </TutorialHighlight>
      )}
    </AnimatePresence>
  );
}

export { TutorialHighlight, TutorialTooltip };
