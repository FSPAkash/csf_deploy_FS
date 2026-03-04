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

function RangeRow({ label, oldRange, newRange, evidence }) {
  return (
    <tr className="border-b border-surface-100 last:border-0">
      <td className="py-2 pr-3 text-sm font-medium text-daikin-dark whitespace-nowrap">{label}</td>
      <td className="py-2 px-3 text-sm text-surface-400 font-mono line-through whitespace-nowrap">{oldRange}</td>
      <td className="py-2 px-3 text-sm text-surface-700 font-mono font-bold whitespace-nowrap">{newRange}</td>
      <td className="py-2 pl-3 text-xs text-surface-500">{evidence}</td>
    </tr>
  );
}

function IntelligenceGuide() {
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
            Market Intelligence Impact Ranges
          </h1>
          <p className="text-lg text-surface-500 mb-8">
            Empirically-grounded reference ranges for competitive event impact modeling
          </p>

          {/* Introduction */}
          <GlassCard className="mb-8" padding="lg">
            <h2 className="text-xl font-semibold text-daikin-dark mb-4">
              How Intelligence Events Affect Your Forecast
            </h2>
            <div className="prose prose-sm text-surface-600">
              <p>
                When you select a competitive intelligence event, the system applies a
                market share impact multiplier to your baseline forecast. The impact is
                determined by the event type, trust score of the source, and a temporal
                decay model that reduces the effect over the event's duration.
              </p>
              <div className="mt-4 p-4 bg-sky-50 rounded-lg border border-sky-200">
                <p className="font-medium text-daikin-dark mb-2">Impact Calculation</p>
                <p className="text-sm mb-2">
                  Each event flows through a multi-step pipeline before affecting the forecast:
                </p>
                <div className="bg-white/60 p-3 rounded-lg font-mono text-xs">
                  1. Point Estimate (from reference range or source data)<br/>
                  2. x Trust Score (source reliability: 0.50 - 1.00)<br/>
                  3. x Uncertainty Dampening (high: 0.8, very_high: 0.6)<br/>
                  4. = Raw Impact<br/>
                  5. Apply diminishing returns (k=0.1)<br/>
                  6. Apply monthly decay over event duration<br/>
                  7. = Final Monthly Multiplier
                </div>
              </div>
              <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="font-medium text-amber-800 mb-2">Why Ranges Were Updated</p>
                <p className="text-sm text-amber-700">
                  The original ranges were based on conservative market-level estimates.
                  Empirical research from LBNL, IEA, AHRI, and HARDI data revealed that
                  brand-level competitive effects are significantly stronger than
                  market-level aggregates. A competitor's 10% price cut barely moves total
                  market demand (elasticity -0.12 to -0.45), but at the brand level, it
                  can shift 10-25% of demand between brands (cross-price elasticity ~2.0).
                  These updated ranges reflect brand-level competitive dynamics.
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Reference Range Comparison Table */}
          <GlassCard className="mb-8" padding="lg">
            <h2 className="text-xl font-semibold text-daikin-dark mb-4">
              Updated Reference Ranges
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-surface-200">
                    <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wider text-surface-400">Event Type</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-surface-400">Previous</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-surface-400">Current</th>
                    <th className="py-2 pl-3 text-xs font-bold uppercase tracking-wider text-surface-400">Primary Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  <RangeRow
                    label="Product Launch"
                    oldRange="-3% to -1%"
                    newRange="-5% to -2%"
                    evidence="LBNL brand elasticity ~2.0; major launches capture 2-5% share in year one"
                  />
                  <RangeRow
                    label="Pricing Change"
                    oldRange="-2% to +2%"
                    newRange="-10% to +10%"
                    evidence="Cross-price elasticity ~2.0 (LBNL-326E); 10% price move shifts 10-25% brand demand"
                  />
                  <RangeRow
                    label="Supply Disruption"
                    oldRange="+1% to +5%"
                    newRange="+5% to +15%"
                    evidence="COVID HARDI data: -12 to -19% industry impact; competitor disruptions yield +5-15%"
                  />
                  <RangeRow
                    label="Regulatory Change"
                    oldRange="-5% to +5%"
                    newRange="-15% to +20%"
                    evidence="IRA drove +15-30% HP demand (IEA); SEER2 +5-15% pull-forward; R-410A phase-out +10-20%"
                  />
                  <RangeRow
                    label="Capacity Expansion"
                    oldRange="-2% to 0%"
                    newRange="-5% to -1%"
                    evidence="Long-term share erosion from increased competitor manufacturing capacity"
                  />
                  <RangeRow
                    label="Market Entry"
                    oldRange="-3% to -0.5%"
                    newRange="-5% to -2%"
                    evidence="Heat pumps: 33% to 47% cooling share over 10 years (RMI); well-funded entrants 2-5% year one"
                  />
                  <RangeRow
                    label="Market Exit"
                    oldRange="+1% to +5%"
                    newRange="+3% to +10%"
                    evidence="Exiting competitor share redistributes proportionally among remaining players"
                  />
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Detailed Event Sections */}
          <div className="space-y-4">
            <Accordion title="Product Launch: -5% to -2%" defaultOpen={true}>
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it models:</h4>
                  <p>The market share impact when a competitor launches a new product line or major product refresh.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Industry evidence:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Brand-level demand elasticity is approximately -2.0 (Lawrence Berkeley National Lab, LBNL-326E)</li>
                    <li>A significant new product launch by a major competitor typically captures 2-5% market share in the first year</li>
                    <li>Disruptive product categories (heat pumps vs traditional AC) show 1-2% annual share shift, compounding over years</li>
                    <li>Minor product refreshes or line extensions: 0.5-2% demand shift</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Duration: 3-12 months</h4>
                  <p>Typical duration is 6 months. Impact peaks at launch and decays as novelty fades and competitive responses emerge.</p>
                </div>

                <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                  <h5 className="font-medium text-cyan-800 mb-1">Calibration note</h5>
                  <p className="text-xs text-cyan-700">
                    The previous range of -3% to -1% underestimated the effect of major launches. Heat pump market data from RMI shows the product category shift alone moved 14 percentage points of cooling market share over a decade. Individual product launches by Carrier, Trane, or Lennox routinely produce measurable quarterly share shifts.
                  </p>
                </div>
              </div>
            </Accordion>

            <Accordion title="Pricing Change: -10% to +10%">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it models:</h4>
                  <p>The brand-level demand shift when a competitor changes their pricing. A competitor price decrease hurts us (negative), a competitor price increase helps us (positive).</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Industry evidence:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>Market-level price elasticity: -0.12 to -0.45</strong> (Rapson, UC Davis; LBNL). Total HVAC demand barely moves with price changes.</li>
                    <li><strong>Brand-level cross-price elasticity: ~2.0</strong> (LBNL-326E). Consumers readily substitute between brands. This is the critical distinction.</li>
                    <li>A competitor's 10% price cut can shift 10-25% of brand demand</li>
                    <li>Short-run appliance price elasticity recommended default: -0.45 (LBNL)</li>
                    <li>Promotional elasticity is approximately 2.0 (10% discount yields ~20% sales lift)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Duration: 1-6 months</h4>
                  <p>Typical duration is 4 months. Price changes have fast but often temporary effects as competitors respond.</p>
                </div>

                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <h5 className="font-medium text-amber-800 mb-1">Why the old range was wrong</h5>
                  <p className="text-xs text-amber-700">
                    The previous -2% to +2% range reflected market-level elasticity, not brand-level competitive dynamics. We are modeling the impact on Manufacturer's share specifically, not total market demand. At the brand level, pricing is the single most potent competitive lever. The LBNL data clearly shows that brand-level elasticity is roughly 5x stronger than market-level elasticity for durable goods.
                  </p>
                </div>
              </div>
            </Accordion>

            <Accordion title="Supply Disruption: +5% to +15%">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it models:</h4>
                  <p>The share gain Manufacturer experiences when a competitor faces supply chain problems. The impact is positive because competitor customers shift to available alternatives.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Industry evidence:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>HARDI distributor sales dropped -19% in April 2020 vs April 2019 during COVID</li>
                    <li>US underlying HVAC sales declined -12% in 2020 (ACHR News)</li>
                    <li>Manufacturing lead times hit their longest since 1987 during 2021</li>
                    <li>90% of industry professionals expected worsening shortages in early 2021</li>
                    <li>Copper tube prices doubled during the disruption period</li>
                    <li>Competitor-specific disruptions (not industry-wide) concentrate the benefit: +5-15% share gain for unaffected manufacturers</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Duration: 2-9 months</h4>
                  <p>Typical duration is 6 months. Severe disruptions (COVID-level) can last 12+ months with annualized impacts of -10 to -15%.</p>
                </div>

                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <h5 className="font-medium text-green-800 mb-1">Severity tiers</h5>
                  <div className="text-xs text-green-700 space-y-1">
                    <p><strong>Moderate</strong> (component shortage, single supplier issue): +5% to +8%</p>
                    <p><strong>Significant</strong> (factory shutdown, major raw material constraint): +8% to +12%</p>
                    <p><strong>Severe</strong> (COVID-level, multi-month production halt): +12% to +15%</p>
                  </div>
                </div>
              </div>
            </Accordion>

            <Accordion title="Regulatory Change: -15% to +20%">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it models:</h4>
                  <p>The demand impact of efficiency standards, refrigerant rules, tax credits, and building codes. Direction depends on Manufacturer's compliance position relative to competitors.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Industry evidence:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>IRA tax credits:</strong> +15% overall heat pump sales growth, +30% in H2 2025 (IEA Global Heat Pump Commentary)</li>
                    <li><strong>SEER2 transition:</strong> +5-15% pull-forward demand in the year before the mandate, then normalization</li>
                    <li><strong>R-410A phase-out:</strong> +10-20% pre-deadline surge in 2024 before Jan 2025 enforcement (RMI)</li>
                    <li><strong>Building code changes:</strong> +3-8% demand for compliant equipment in affected regions</li>
                    <li>Heat pump sales declined -17% in 2023 when IRA rebates were enacted but delayed (IEA)</li>
                    <li>~70% of base-tier products failed to meet 2023 DOE minimum efficiency (AHRI)</li>
                    <li>250,000+ families claimed heat pump tax credits in TY 2023 (US Treasury)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Duration: 6-24 months</h4>
                  <p>Typical duration is 12 months. Regulatory impacts are the longest-lasting event type, with some effects (like refrigerant transitions) playing out over years.</p>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <h5 className="font-medium text-purple-800 mb-1">Common regulatory patterns</h5>
                  <div className="text-xs text-purple-700 space-y-1">
                    <p><strong>Pre-deadline surge:</strong> Demand spikes 6-12 months before a mandate takes effect as buyers rush to purchase under old standards</p>
                    <p><strong>Post-deadline normalization:</strong> Demand dips below baseline for 3-6 months after the surge</p>
                    <p><strong>Incentive ramp-up:</strong> Tax credit effects strengthen over 6-12 months as awareness grows and supply chains adapt</p>
                    <p><strong>Compliance advantage:</strong> Early-compliant manufacturers gain share during transitions</p>
                  </div>
                </div>
              </div>
            </Accordion>

            <Accordion title="Capacity Expansion: -5% to -1%">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it models:</h4>
                  <p>The long-term competitive pressure when a competitor expands manufacturing capacity through new factories, production lines, or acquisitions.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Industry evidence:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Capacity expansions take 12-18 months to impact market dynamics (construction + ramp-up)</li>
                    <li>Increased competitor capacity enables price competition, volume discounts, and faster delivery</li>
                    <li>The effect is always negative for incumbents (more competitor supply = more price pressure)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Duration: 6-18 months</h4>
                  <p>Typical duration is 12 months. The impact is gradual as the new capacity ramps up and begins affecting market prices and availability.</p>
                </div>

                <div className="p-3 bg-surface-100 rounded-lg">
                  <h5 className="font-medium text-surface-700 mb-1">Key change</h5>
                  <p className="text-xs text-surface-500">
                    The previous range of -2% to 0% allowed for zero impact, which meant many capacity expansion events produced no forecast effect after trust scoring. The updated range ensures that confirmed capacity expansions always produce a meaningful negative signal, reflecting the reality that more competitor supply is never neutral.
                  </p>
                </div>
              </div>
            </Accordion>

            <Accordion title="Market Entry: -5% to -2%">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it models:</h4>
                  <p>The share impact when a new competitor enters the HVAC market through direct entry, acquisition, or joint venture.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Industry evidence:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Heat pumps went from 33% to 47% of the cooling equipment market over 10 years (RMI Heat Pump Tracker)</li>
                    <li>Heat pumps outsold gas furnaces since 2021 and central ACs in late 2025 (RMI)</li>
                    <li>A well-funded new entrant with strong product can capture 2-5% market share in year one</li>
                    <li>70% of new HVAC businesses fail in the first year (ServiceTitan), but well-capitalized manufacturers are the exception</li>
                    <li>Top 5 HVAC companies hold 25-30% combined share (MarketsandMarkets), leaving room for entrants</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Duration: 12-36 months</h4>
                  <p>Typical duration is 18 months. Market entry impacts are slow to develop but persistent. The uncertainty level is "very high" because entry success is inherently unpredictable.</p>
                </div>
              </div>
            </Accordion>

            <Accordion title="Market Exit: +3% to +10%">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">What it models:</h4>
                  <p>The share gain when a competitor exits the market, discontinues a product line, or shuts down operations. Their orphaned customers and dealer networks redistribute to remaining players.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Industry evidence:</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>When a competitor with 10% market share exits, remaining players split that share roughly proportional to their existing positions</li>
                    <li>Gas furnace sales have declined -7% over 20 years as heat pump technology displaces them (RMI)</li>
                    <li>Product line discontinuations create immediate demand for alternative suppliers, especially through dealer channel relationships</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Duration: 3-12 months</h4>
                  <p>Typical duration is 9 months. The initial share gain is rapid (customers need immediate alternatives) but normalizes as the competitive landscape rebalances.</p>
                </div>
              </div>
            </Accordion>

            <Accordion title="Trust Score Pipeline">
              <div className="space-y-4 text-sm text-surface-600">
                <div>
                  <h4 className="font-semibold text-daikin-dark">How trust scores modify impact:</h4>
                  <p>Every intelligence event's raw impact is multiplied by a trust score (0.30 to 1.00) before affecting the forecast. This ensures that unverified rumors have less influence than official announcements.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Source trust tiers:</h4>
                  <div className="bg-surface-100 p-3 rounded-lg text-xs font-mono space-y-1">
                    <p>Government (SEC, EPA, DOE, FRED) ........... 1.00</p>
                    <p>Industry (AHRI, ASHRAE, Energy Star) ....... 0.88-0.90</p>
                    <p>Company Official (carrier.com, trane.com) .. 0.85</p>
                    <p>Major Business News (Reuters, Bloomberg) ... 0.76-0.80</p>
                    <p>HVAC Trade (ACHR News, Contracting Biz) .... 0.73-0.75</p>
                    <p>Press Releases (PR Newswire, BusinessWire) . 0.72</p>
                    <p>General Business (CNBC, MarketWatch) ....... 0.62-0.68</p>
                    <p>Unknown / Default .......................... 0.50</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Worked example:</h4>
                  <div className="bg-surface-100 p-3 rounded-lg font-mono text-xs">
                    Event: Carrier launches new heat pump line<br/>
                    Source: achrnews.com (trust: 0.75)<br/>
                    Event type: product_launch<br/>
                    Reference range: -5.0% to -2.0%<br/>
                    Point estimate (midpoint): -3.5%<br/><br/>
                    Raw impact: -3.5% x 0.75 = -2.625%<br/>
                    High uncertainty dampening: x 0.8 = -2.10%<br/>
                    Diminishing returns (k=0.1): -2.08%<br/>
                    Final multiplier: 0.979x (-2.1% net effect)<br/><br/>
                    Compare with old range (-3% to -1%):<br/>
                    Old point estimate: -2.0%<br/>
                    Old raw impact: -2.0% x 0.75 x 0.8 = -1.2%<br/>
                    Old final multiplier: 0.988x (-1.2% net effect)
                  </div>
                </div>
              </div>
            </Accordion>

            <Accordion title="Data Sources and Methodology">
              <div className="space-y-4 text-sm text-surface-600">
                <p>All reference ranges are grounded in empirical data from the following sources:</p>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Academic / Government</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>LBNL-326E</strong> (Lawrence Berkeley National Lab) - Appliance price elasticity of demand, brand-level vs market-level elasticity</li>
                    <li><strong>Rapson, UC Davis (2014)</strong> - Room and central AC own-price elasticity</li>
                    <li><strong>DOE Appendix 9-A</strong> - Refrigerator and clothes washer price elasticity benchmarks</li>
                    <li><strong>US Treasury / IRS</strong> - IRA clean energy tax credit claiming data</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Industry Bodies</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>AHRI</strong> (Air-Conditioning, Heating, and Refrigeration Institute) - Monthly shipment data, efficiency standard tracking</li>
                    <li><strong>HARDI</strong> (Heating, Air-conditioning & Refrigeration Distributors International) - Distributor sales data, COVID impact metrics</li>
                    <li><strong>IEA</strong> (International Energy Agency) - Global heat pump sales commentary, market growth tracking</li>
                    <li><strong>RMI</strong> (Rocky Mountain Institute) - US heat pump market tracker, technology transition data</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Market Research</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>Grand View Research</strong> - US HVAC market segmentation, new construction vs replacement share</li>
                    <li><strong>MarketsandMarkets</strong> - HVAC and heat pump market sizing, competitive landscape</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-daikin-dark">Trade / Industry</h4>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>ACHR News</strong> - HVAC production and sales reporting, monthly shipment analysis</li>
                    <li><strong>ServiceTitan</strong> - HVAC industry statistics and benchmarks</li>
                  </ul>
                </div>
              </div>
            </Accordion>

            <Accordion title="Best Practices">
              <div className="space-y-2 text-sm text-surface-600">
                <ol className="list-decimal list-inside space-y-2">
                  <li><strong>Start with high-trust sources</strong> - Government filings and official company announcements produce the most reliable forecasts</li>
                  <li><strong>Consider the compounding pipeline</strong> - A -10% raw impact becomes roughly -5 to -6% after trust scoring and uncertainty dampening. The ranges account for this.</li>
                  <li><strong>Use manual override for known events</strong> - If you have direct intelligence about the magnitude of an event, use the user-adjusted impact value instead of relying on reference ranges</li>
                  <li><strong>Layer multiple events carefully</strong> - Multiple events with similar directions compound multiplicatively. Three -5% events do not produce -15%; they produce about -14.3% (0.95^3)</li>
                  <li><strong>Check the Impact Analysis tooltip</strong> - Click the info button next to any selected event to see the full calculation breakdown</li>
                  <li><strong>Regulatory events have the widest range</strong> - These require the most judgment. A favorable regulation (where Manufacturer is ahead of compliance) and an unfavorable one produce opposite effects of similar magnitude</li>
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

export default IntelligenceGuide;
