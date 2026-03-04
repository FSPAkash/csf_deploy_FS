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

function PromotionGuide() {
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
            Promotion Events
          </h1>
          <p className="text-lg text-surface-500 mb-8">
            Detailed guide for understanding and using promotional event adjustments
          </p>

          {/* Introduction */}
          <GlassCard className="mb-8" padding="lg">
            <h2 className="text-xl font-semibold text-daikin-dark mb-4">
              Understanding Promotion Events
            </h2>
            <div className="prose prose-sm text-surface-600">
              <p>
                Promotion events allow you to model the impact of sales promotions,
                marketing campaigns, and seasonal incentive programs on your forecast.
                These events typically create demand spikes in the promoted month with
                potential spillover effects on adjacent months.
              </p>
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="font-medium text-daikin-dark mb-2">Key Concept</p>
                <p className="text-sm">
                  <strong>Base Weight</strong> represents the historical promotional
                  pattern already embedded in the model for each month. When you add
                  a promotion boost, it multiplies against this base weight:
                </p>
                <blockquote className="mt-2 pl-4 border-l-2 border-green-500 italic">
                  Final Multiplier = Base Weight x (1 + Boost %)
                </blockquote>
              </div>
            </div>
          </GlassCard>

          {/* Accordions */}
          <div className="space-y-4">
            <Accordion title="March Madness" defaultOpen={true}>
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it is:</h4>
                  <p>March historically shows elevated demand patterns, often referred to as "March Madness" in the HVAC industry. This represents the seasonal surge as customers prepare for the cooling season.</p>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <h5 className="font-medium text-amber-800 mb-1">Remove Historical March Madness</h5>
                    <p className="text-xs text-amber-700">
                      Enable this toggle to see what the forecast would look like WITHOUT the historical March spike. Useful for scenario planning if you expect this pattern to change.
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <h5 className="font-medium text-blue-800 mb-1">Lock March Madness</h5>
                    <p className="text-xs text-blue-700">
                      Enable this to "lock in" the historical March pattern so it won't be affected by other adjustments. Use this when you're confident March will follow historical trends.
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Note:</h4>
                  <p>March is excluded from the month selector for promotional events since it has its own dedicated controls.</p>
                </div>
              </div>
            </Accordion>

            <Accordion title="Boost Effect">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it does:</h4>
                  <p>The Boost Effect slider adds a percentage increase on top of the base promotional weight for the selected month.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">How it works:</h4>
                  <div className="bg-surface-100 p-3 rounded-lg font-mono text-xs">
                    Example for April with base weight 1.05:<br/><br/>
                    - 0% boost: 1.05 x 1.00 = 1.050 (no change)<br/>
                    - 10% boost: 1.05 x 1.10 = 1.155 (+15.5% total)<br/>
                    - 25% boost: 1.05 x 1.25 = 1.313 (+31.3% total)<br/>
                    - 50% boost: 1.05 x 1.50 = 1.575 (+57.5% total)
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Typical values:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>5-15%:</strong> Minor promotional campaigns, dealer incentives</li>
                    <li><strong>15-30%:</strong> Significant seasonal promotions, rebate programs</li>
                    <li><strong>30-50%:</strong> Major sales events, product launches, aggressive clearance</li>
                  </ul>
                </div>
              </div>
            </Accordion>

            <Accordion title="Spillover Effect">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it is:</h4>
                  <p>When a promotion drives demand in one month, it often "pulls forward" demand from adjacent months. This creates a reduction in the following month(s) as customers who would have purchased later bought during the promotion instead.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">How it works:</h4>
                  <div className="bg-surface-100 p-3 rounded-lg font-mono text-xs">
                    Example: May promotion with 10% spillover:<br/><br/>
                    - May: Gets the full promotional boost<br/>
                    - June: Reduced by 10% (pulled forward to May)<br/><br/>
                    If your May boost is +20% and spillover is 10%:<br/>
                    - May: +20% increase<br/>
                    - June: -10% decrease (0.90 multiplier)
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Controls:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>Enable checkbox:</strong> Turn spillover on/off</li>
                    <li><strong>Spillover %:</strong> How much demand shifts from the following month (0-50%)</li>
                  </ul>
                </div>

                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <h5 className="font-medium text-amber-800 mb-1">When to disable spillover</h5>
                  <p className="text-xs text-amber-700">
                    Disable spillover if the promotion is expected to generate NEW demand rather than shifting existing demand (e.g., entering a new market segment, first-time buyer incentives).
                  </p>
                </div>
              </div>
            </Accordion>

            <Accordion title="June Cap">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it is:</h4>
                  <p>June promotional multipliers are automatically capped at 1.06 (6% increase maximum). This reflects the reality that June already sees peak seasonal demand, limiting the additional lift promotions can achieve.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Why this exists:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>June is typically at or near capacity utilization</li>
                    <li>Customers are already buying for the cooling season</li>
                    <li>Additional promotional spending has diminishing returns</li>
                    <li>Historical data shows limited incremental lift in June promotions</li>
                  </ul>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700">
                    If you set a June promotion that would exceed 1.06, the system will automatically cap it and display a warning. This ensures realistic forecasting.
                  </p>
                </div>
              </div>
            </Accordion>

            <Accordion title="Locking Events">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it does:</h4>
                  <p>Locking an event "freezes" the promotional multiplier for that month, allowing you to build up multiple promotional events across different months.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">How to use:</h4>
                  <ol className="list-decimal list-inside ml-2 space-y-1">
                    <li>Select a month from the dropdown</li>
                    <li>Set the boost percentage</li>
                    <li>Configure spillover if desired</li>
                    <li>Click "Lock in [Month] Promo"</li>
                    <li>The month moves to "Locked Events" and you can add another</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Limits:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Maximum 3 locked promotional events at a time</li>
                    <li>Each month can only be used once</li>
                    <li>Click the X to remove a locked event</li>
                  </ul>
                </div>
              </div>
            </Accordion>

            <Accordion title="Best Practices">
              <div className="space-y-2 text-sm text-surface-600">
                <ol className="list-decimal list-inside space-y-2">
                  <li><strong>Check the base weight first</strong> - understand what's already built into the model</li>
                  <li><strong>Start with modest boosts</strong> - 10-15% is often realistic for standard promotions</li>
                  <li><strong>Consider spillover carefully</strong> - most promotions shift demand, not create it</li>
                  <li><strong>Use March Madness toggles</strong> - don't manually adjust March; use the dedicated controls</li>
                  <li><strong>Lock events to build scenarios</strong> - compare multiple promotional strategies</li>
                  <li><strong>Document your assumptions</strong> - export results with the CSV to track what was assumed</li>
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

export default PromotionGuide;
