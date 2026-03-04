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

function MarketShareGuide() {
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
            Market Share Scenarios
          </h1>
          <p className="text-lg text-surface-500 mb-8">
            Detailed guide for understanding and using market share adjustments
          </p>

          {/* Introduction */}
          <GlassCard className="mb-8" padding="lg">
            <h2 className="text-xl font-semibold text-daikin-dark mb-4">
              Understanding Market Share Scenarios
            </h2>
            <div className="prose prose-sm text-surface-600">
              <p>
                This tool helps you explore "what-if" scenarios for market share changes 
                and their impact on your forecast. The forecast model has already made 
                assumptions about market share. These scenarios let you adjust those 
                assumptions based on your business intelligence.
              </p>
              <div className="mt-4 p-4 bg-daikin-blue/5 rounded-lg border border-daikin-blue/20">
                <p className="font-medium text-daikin-dark mb-2">Important Concept</p>
                <p className="text-sm">
                  <strong>Manufacturer Baseline</strong> represents the model's best prediction 
                  given all available data. When you apply a market share scenario, you're saying:
                </p>
                <blockquote className="mt-2 pl-4 border-l-2 border-daikin-blue italic">
                  "I have information the model doesn't have, and I think market share 
                  will perform differently than the model assumes."
                </blockquote>
              </div>
            </div>
          </GlassCard>

          {/* Accordions for each mode */}
          <div className="space-y-4">
            <Accordion title="MODE 1: Relative Change - Quick Adjustments" defaultOpen={true}>
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it does:</h4>
                  <p>Applies a uniform percentage adjustment across all months.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-daikin-dark">When to use:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Quick scenario testing</li>
                    <li>You believe market share will be consistently better or worse than forecast</li>
                    <li>Simple "what-if" analysis for presentations</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">How it works:</h4>
                  <div className="bg-surface-100 p-3 rounded-lg font-mono text-xs">
                    If you set +10%:<br/>
                    - January forecast: 1,000 units becomes 1,100 units<br/>
                    - February forecast: 1,200 units becomes 1,320 units<br/>
                    - And so on for all months
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Example scenarios:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>+5% to +15%:</strong> "We're launching a new sales initiative"</li>
                    <li><strong>0%:</strong> "Trust the model exactly as-is"</li>
                    <li><strong>-10% to -5%:</strong> "A major competitor is entering the market"</li>
                    <li><strong>-20% to -15%:</strong> "We're facing significant pricing pressure"</li>
                  </ul>
                </div>
              </div>
            </Accordion>

            <Accordion title="MODE 2 (BETA): Historical Trend - Data-Driven Projection">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it does:</h4>
                  <p>Analyzes your past market share performance and projects the trend forward.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">When to use:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>You have reliable historical market share data</li>
                    <li>You believe past trends will continue</li>
                    <li>You want a statistically-grounded scenario</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">How it works:</h4>
                  <ol className="list-decimal list-inside ml-2 space-y-1">
                    <li>Analyzes complete historical years (only years with all 12 months of data)</li>
                    <li>Calculates the trend (e.g., "gaining 0.5% market share per year")</li>
                    <li>Projects to current year</li>
                    <li>Applies seasonal patterns (e.g., "June is typically 8% above average")</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Controls:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>Trend Strength:</strong> 0% = Ignore trend | 100% = Full trend | 200% = 2x strength</li>
                    <li><strong>Seasonal Pattern:</strong> ON = Monthly ups and downs | OFF = Annual average</li>
                  </ul>
                </div>
              </div>
            </Accordion>

            <Accordion title="MODE 3: Competitive Intelligence - Event-Based Scenarios">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it does:</h4>
                  <p>Models specific market events you know will happen.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">When to use:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>You have intelligence about competitor actions</li>
                    <li>Known market events (regulations, contracts, etc.)</li>
                    <li>Complex scenarios with multiple phases</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-surface-50 rounded-lg">
                    <h5 className="font-medium text-daikin-dark mb-2">A) Single Event</h5>
                    <p className="mb-2">Use for one-time market shocks</p>
                    <p className="text-xs">
                      <strong>Example:</strong> "Competitor plant shutdown in June"<br/>
                      Event Month: June | MS Impact: +8% | Duration: 2 months
                    </p>
                  </div>

                  <div className="p-4 bg-surface-50 rounded-lg">
                    <h5 className="font-medium text-daikin-dark mb-2">B) Gradual Shift</h5>
                    <p className="mb-2">Use for slowly developing situations</p>
                    <p className="text-xs">
                      <strong>Example:</strong> "Competitor launching new product in Q2"<br/>
                      Shift Start: April | Shift End: September | Cumulative Impact: -12%
                    </p>
                  </div>

                  <div className="p-4 bg-surface-50 rounded-lg">
                    <h5 className="font-medium text-daikin-dark mb-2">C) Recovery Scenario</h5>
                    <p className="mb-2">Use for temporary setbacks with recovery</p>
                    <p className="text-xs">
                      <strong>Example:</strong> "Supply chain issues in Q1, recover by Q3"<br/>
                      Loss Duration: 3 months | Initial Loss: -15% | Recovery Duration: 5 months
                    </p>
                  </div>
                </div>
              </div>
            </Accordion>

            <Accordion title="MODE 4: Macro Scenario (BETA) - Market Size vs Capacity">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it does:</h4>
                  <p>Models what happens when total market size changes but your capacity doesn't.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">When to use:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Regulatory changes affecting total market</li>
                    <li>Economic booms or recessions</li>
                    <li>You have production capacity constraints</li>
                  </ul>
                </div>

                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <h5 className="font-medium text-amber-800 mb-2">Key Insight</h5>
                  <p className="text-amber-700">
                    Market share can drop even if your volume stays the same!
                    If the market grows 20% but you can only grow 5%, your market share shrinks.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">How it works:</h4>
                  <div className="bg-surface-100 p-3 rounded-lg font-mono text-xs">
                    Net Impact = Your Capacity Growth - Market Growth<br/><br/>
                    Examples:<br/>
                    1) Market +25%, You +10% = -15% market share impact<br/>
                    2) Market +5%, You +10% = +5% market share impact<br/>
                    3) Market -10%, You 0% = +10% market share impact
                  </div>
                </div>
              </div>
            </Accordion>

            <Accordion title="Which Mode Should I Use?">
              <div className="space-y-4 text-sm text-surface-600">
                <p className="font-medium text-daikin-dark">Start here and follow the decision tree:</p>

                <ol className="list-decimal list-inside space-y-3">
                  <li>
                    <strong>Do I just need a quick +/- adjustment?</strong>
                    <ul className="ml-6 mt-1">
                      <li>YES: Use <strong>Relative Change</strong></li>
                      <li>NO: Continue...</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Do I have specific intelligence about market events?</strong>
                    <ul className="ml-6 mt-1">
                      <li>YES: Use <strong>Competitive Intelligence</strong></li>
                      <li>NO: Continue...</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Do I have good historical market share data?</strong>
                    <ul className="ml-6 mt-1">
                      <li>YES: Use <strong>Historical Trend</strong></li>
                      <li>NO: Continue...</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Am I worried about market size changes vs our capacity?</strong>
                    <ul className="ml-6 mt-1">
                      <li>YES: Use <strong>Macro Scenario</strong></li>
                      <li>NO: Use <strong>Relative Change</strong> (simplest option)</li>
                    </ul>
                  </li>
                </ol>
              </div>
            </Accordion>

            <Accordion title="Combining with Events">
              <div className="space-y-4 text-sm text-surface-600">
                <p>
                  Market share scenarios work TOGETHER with promotional events, shortages, etc.
                </p>
                
                <div className="bg-surface-100 p-3 rounded-lg font-mono text-xs">
                  Final Forecast = Manufacturer Baseline x Events x Market Share Scenario<br/><br/>
                  Example:<br/>
                  Manufacturer Baseline January: 1,000 units<br/>
                  Promotion Event: +15% (multiplier: 1.15)<br/>
                  Market Share Scenario: +10% (multiplier: 1.10)<br/><br/>
                  Final Simulated = 1,000 x 1.15 x 1.10 = 1,265 units
                </div>

                <p>This separation lets you:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Model promotional lift independently from market dynamics</li>
                  <li>Understand which factors drive forecast changes</li>
                  <li>Create complex but interpretable scenarios</li>
                </ul>
              </div>
            </Accordion>

            <Accordion title="Best Practices">
              <div className="space-y-2 text-sm text-surface-600">
                <ol className="list-decimal list-inside space-y-2">
                  <li><strong>Always start with 0% / Trust Model</strong> to see the baseline</li>
                  <li><strong>Make incremental changes</strong> - don't jump to extreme scenarios</li>
                  <li><strong>Document your assumptions</strong> - use the export feature to save scenarios</li>
                  <li><strong>Cross-check with actuals</strong> - compare scenarios to what actually happened</li>
                  <li><strong>Use conservative estimates</strong> for executive presentations</li>
                  <li><strong>Use multiple scenarios</strong> - show best case, likely case, worst case</li>
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

export default MarketShareGuide;