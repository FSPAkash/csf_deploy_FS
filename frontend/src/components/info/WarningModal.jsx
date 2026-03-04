import { Modal, Button } from '../common';

function WarningModal({ isOpen, onClose, isAdmin }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Understanding 'Review Recommended' Warnings"
      size="md"
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4 text-sm text-surface-600">
        <div>
          <h4 className="font-semibold text-daikin-dark mb-1">
            What triggers a warning?
          </h4>
          <p className="text-xs">
            The system flags months where your simulated forecast differs significantly 
            from the expected baseline pattern.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-daikin-dark mb-1">
            Why am I seeing this?
          </h4>
          <p className="text-xs">
            Warnings appear when simulation settings create results that fall outside 
            normal ranges for this product and month.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-daikin-dark mb-1">
            Is this an error?
          </h4>
          <p className="text-xs">
            No. This is simply a prompt to double-check your inputs. Large deviations 
            may be intentional or may indicate settings that need adjustment.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-daikin-dark mb-1">
            What should I do?
          </h4>
          <ul className="list-disc list-inside space-y-0.5 ml-2 text-xs">
            <li>Review your event settings</li>
            <li>Verify market share assumptions</li>
            <li>Consider if a major event justifies the change</li>
            <li>Adjust if the result seems unrealistic</li>
          </ul>
        </div>

        <p className="text-xs text-surface-400 italic">
          Note: Thresholds adapt to each product's volatility.
        </p>

        {isAdmin && (
          <div className="p-3 bg-surface-100 rounded-lg border border-surface-200">
            <h4 className="font-semibold text-daikin-dark mb-1 text-xs">
              Admin: Technical Details
            </h4>
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              Algorithm: Adaptive CV Threshold<br/>
              SENSITIVITY = 1.5<br/>
              MIN_THRESHOLD = 8%<br/>
              Window: 3-month rolling
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default WarningModal;