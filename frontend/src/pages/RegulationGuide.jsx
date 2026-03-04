import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { GlassCard, Button } from '../components/common';
import clsx from 'clsx';

function Accordion({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-surface-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-surface-50 hover:bg-surface-100 transition-colors"
      >
        <span className="font-semibold text-daikin-dark">{title}</span>
        <ChevronDown
          className={clsx(
            'h-5 w-5 text-surface-400 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="p-4 border-t border-surface-200"
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}

function RegulationGuide() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="sticky top-0 z-[var(--z-sticky)] glass-subtle border-b border-surface-200/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold text-daikin-dark mb-2">
            EPA Regulation Events
          </h1>
          <p className="text-lg text-surface-500 mb-8">
            Detailed guide for understanding and using EPA regulatory impact adjustments
          </p>

          {/* Introduction */}
          <GlassCard className="mb-8" padding="lg">
            <h2 className="text-xl font-semibold text-daikin-dark mb-4">
              Understanding EPA Regulation Events
            </h2>
            <div className="prose prose-sm text-surface-600">
              <p>
                Regulation events model the impact of EPA efficiency standards and
                compliance requirements on your forecast. These events typically cause
                demand shifts as the market adapts to new efficiency requirements.
              </p>
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="font-medium text-daikin-dark mb-2">Key Concept</p>
                <p className="text-sm">
                  <strong>Regulation events are capped at 1.0</strong> - they can reduce demand
                  (multiplier &lt; 1.0) or stay neutral, but cannot increase demand beyond baseline.
                  This reflects the reality that regulations typically constrain rather than boost demand.
                </p>
                <blockquote className="mt-2 pl-4 border-l-2 border-purple-500 italic">
                  Final Multiplier = min(Adjustment, 1.0)
                </blockquote>
              </div>
            </div>
          </GlassCard>

          {/* Accordions */}
          <div className="space-y-4">
            <Accordion title="Impact Adjustment" defaultOpen={true}>
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it does:</h4>
                  <p>The Impact Adjust slider lets you modify the EPA regulatory impact for the selected month. Unlike promotions, this can go both positive and negative.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Slider range:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>-50% to 0%:</strong> Increase the regulatory constraint (more negative impact)</li>
                    <li><strong>0%:</strong> No adjustment</li>
                    <li><strong>0% to +50%:</strong> Reduce the regulatory constraint (less negative impact)</li>
                  </ul>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <h5 className="font-medium text-purple-800 mb-1">The 1.0 Cap</h5>
                  <p className="text-xs text-purple-700">
                    The final multiplier is always capped at 1.0. EPA regulations don't increase demand - at best, they have no impact (1.0). Use positive adjustments to reduce expected regulatory drag, not to boost demand.
                  </p>
                </div>
              </div>
            </Accordion>

            <Accordion title="Locking Events">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it does:</h4>
                  <p>Locking a regulation event "freezes" the multiplier for that month, allowing you to build up multiple regulatory impacts across different months.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">How to use:</h4>
                  <ol className="list-decimal list-inside ml-2 space-y-1">
                    <li>Select a month from the dropdown</li>
                    <li>Set the impact adjustment percentage</li>
                    <li>Review the final multiplier preview</li>
                    <li>Click "Lock in [Month] Regulation"</li>
                    <li>The month moves to "Locked Events" and you can add another</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Limits:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Maximum 3 locked regulation events at a time</li>
                    <li>Each month can only have one regulation event</li>
                    <li>Click the X to remove a locked event</li>
                  </ul>
                </div>
              </div>
            </Accordion>

            <Accordion title="Combining with Other Events">
              <div className="space-y-4 text-sm text-surface-600">
                <p>
                  Regulation events work alongside other event types. The final forecast multiplier combines all effects:
                </p>

                <div className="bg-surface-100 p-3 rounded-lg font-mono text-xs">
                  Final = Baseline x Promotion x Shortage x Regulation x Market Share<br/><br/>
                  Example:<br/>
                  Baseline January: 1,000 units<br/>
                  Promotion: 1.15 (+15%)<br/>
                  Shortage: 1.00 (none)<br/>
                  Regulation: 0.90 (-10%)<br/>
                  Market Share: 1.05 (+5%)<br/><br/>
                  Final = 1,000 x 1.15 x 1.00 x 0.90 x 1.05 = 1,087 units
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h5 className="font-medium text-blue-800 mb-1">Tip</h5>
                  <p className="text-xs text-blue-700">
                    EPA regulatory changes often create "push-pull" dynamics with promotions. Pre-regulation deadlines can drive promotion-like surges, followed by post-regulation demand adjustments. Model both effects for realistic forecasts.
                  </p>
                </div>
              </div>
            </Accordion>

            <Accordion title="Best Practices">
              <div className="space-y-2 text-sm text-surface-600">
                <ol className="list-decimal list-inside space-y-2">
                  <li><strong>Know your EPA regulatory calendar</strong> - track efficiency standard deadlines and compliance dates</li>
                  <li><strong>Model the full impact</strong> - EPA regulations often have multi-month effects (pre-buy, transition, steady-state)</li>
                  <li><strong>Use conservative estimates</strong> - regulatory impacts are often uncertain; start modest</li>
                  <li><strong>Combine with other panels</strong> - EPA changes often trigger promotional responses</li>
                  <li><strong>Document assumptions</strong> - note which regulations you're modeling in your exports</li>
                  <li><strong>Update as rules clarify</strong> - revisit your assumptions as EPA implementation details emerge</li>
                </ol>
              </div>
            </Accordion>
          </div>

          {/* Back button at bottom */}
          <div className="mt-8 text-center">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/')}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Back to Dashboard
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default RegulationGuide;
