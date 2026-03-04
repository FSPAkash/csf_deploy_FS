// Beta2 Dashboard - light glass interface

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Download, TrendingUp, TrendingDown,
  ChevronDown, ChevronRight, Activity, Zap, Target, Layers,
  BarChart3, AlertTriangle, Clock,
  RefreshCw, Brain, Check, X,
  Sliders, Calendar, Shield, Wrench, ToggleLeft, PieChart, Shuffle,
  Sparkles, Minimize2, Maximize2, Bell, Cpu, Filter, Search,
  Info, ExternalLink, Lock, MessageSquare, Star, ChevronLeft, Send
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useForecast } from '../contexts/ForecastContext';
import { IntelligenceProvider, useIntelligence } from '../contexts/IntelligenceContext';
import ForecastChart from '../components/chart/ForecastChart';
import PromotionPanel from '../components/controls/PromotionPanel';
import ShortagePanel from '../components/controls/ShortagePanel';
import RegulationPanel from '../components/controls/RegulationPanel';
import CustomEventPanel from '../components/controls/CustomEventPanel';
import EffectToggles from '../components/controls/EffectToggles';
import BetaMarketSharePanel from '../components/controls/BetaMarketSharePanel';
import CannibalizationPanel from '../components/controls/CannibalizationPanel';
// PredictionPanel available if needed: import { PredictionPanel } from '../components/prediction';
import { generateCSV, downloadFile } from '../utils/calculations';
import { formatNumber } from '../utils/formatters';
import betaApi from '../services/betaApi';
import Select from '../components/common/Select';
import { Modal } from '../components/common';

// ============================================
// CONSTANTS
// ============================================

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'pricing_change', label: 'Pricing' },
  { value: 'supply_disruption', label: 'Supply' },
  { value: 'regulatory_change', label: 'Regulatory' },
  { value: 'market_entry', label: 'Market Entry' },
  { value: 'market_exit', label: 'Market Exit' },
];

const COMPETITOR_OPTIONS = ['Carrier', 'Trane', 'Lennox', 'Johnson Controls', 'Rheem', 'Mitsubishi'];

const INTEL_EVENT_IMPACT_RANGES = {
  product_launch: { range: [-5.0, -2.0], duration: 6 },
  pricing_change: { range: [-10.0, 10.0], duration: 4 },
  supply_disruption: { range: [5.0, 15.0], duration: 6 },
  regulatory_change: { range: [-15.0, 20.0], duration: 12 },
  capacity_expansion: { range: [-5.0, -1.0], duration: 12 },
  market_entry: { range: [-5.0, -2.0], duration: 18 },
  market_exit: { range: [3.0, 10.0], duration: 9 },
  competitor_news: { range: [-3.0, 3.0], duration: 3 },
};

// For bidirectional ranges that cross zero, midpoint = 0% which is meaningless.
// Use a directional default (position within range: -1=low, 0=mid, 1=high)
const BIDIRECTIONAL_DEFAULT_SIDE = {
  pricing_change: -0.33,       // Default: competitor price cut hurts us (lower third)
  regulatory_change: 0.25,     // Default: slight positive (Manufacturer ahead on compliance)
  competitor_news: -0.33,      // Default: competitor action likely negative for us
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EVENT_TYPE_CONFIG = {
  product_launch: { label: 'LAUNCH', color: 'cyan' },
  pricing_change: { label: 'PRICE', color: 'amber' },
  supply_disruption: { label: 'SUPPLY', color: 'emerald' },
  regulatory_change: { label: 'REG', color: 'violet' },
  capacity_expansion: { label: 'CAP', color: 'orange' },
  market_entry: { label: 'ENTRY', color: 'rose' },
  market_exit: { label: 'EXIT', color: 'teal' },
  competitor_news: { label: 'NEWS', color: 'gray' },
};

// Helper to normalize event type and get config
function getEventTypeConfig(eventType) {
  if (!eventType) return { label: 'EVENT', color: 'gray' };

  // Try direct lookup first
  if (EVENT_TYPE_CONFIG[eventType]) {
    return EVENT_TYPE_CONFIG[eventType];
  }

  // Try lowercase with underscores
  const normalized = eventType.toLowerCase().replace(/\s+/g, '_');
  if (EVENT_TYPE_CONFIG[normalized]) {
    return EVENT_TYPE_CONFIG[normalized];
  }

  // Fallback: create label from event type string
  return {
    label: eventType.toUpperCase().substring(0, 8),
    color: 'gray'
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function parseEventDate(event) {
  const dateStr = event.event_date || event.date_extracted;
  if (!dateStr) return null;
  const formats = [
    { regex: /^(\d{4})-(\d{2})/, extract: (m) => ({ year: parseInt(m[1]), month: parseInt(m[2]) - 1 }) },
    { regex: /^(\w+)\s+(\d{4})/, extract: (m) => {
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const shortNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthStr = m[1].toLowerCase();
      let monthIdx = monthNames.indexOf(monthStr);
      if (monthIdx === -1) monthIdx = shortNames.indexOf(monthStr);
      if (monthIdx === -1) return null;
      return { year: parseInt(m[2]), month: monthIdx };
    }},
    { regex: /^Q(\d)\s+(\d{4})/, extract: (m) => {
      const quarter = parseInt(m[1]);
      const startMonth = (quarter - 1) * 3;
      return { year: parseInt(m[2]), month: startMonth };
    }},
  ];
  for (const fmt of formats) {
    const match = dateStr.match(fmt.regex);
    if (match) {
      const result = fmt.extract(match);
      if (result) return result;
    }
  }
  return null;
}

function calculateAffectedPeriod(event, selectedYear) {
  const ref = INTEL_EVENT_IMPACT_RANGES[event.event_type || 'competitor_news'] || { duration: 6 };
  const duration = ref.duration;
  const parsedDate = parseEventDate(event);
  let startYear = selectedYear || new Date().getFullYear();
  let startMonth = 0;
  if (parsedDate) {
    startYear = parsedDate.year;
    startMonth = parsedDate.month;
  }
  const affectedMonths = [];
  const affectedYears = new Set();
  for (let i = 0; i < duration; i++) {
    const monthIdx = (startMonth + i) % 12;
    const yearOffset = Math.floor((startMonth + i) / 12);
    const year = startYear + yearOffset;
    const lambdaDecay = -Math.log(0.1) / duration;
    const decayFactor = Math.exp(-lambdaDecay * i);
    if (decayFactor > 0.1) {
      affectedMonths.push({ month: MONTH_NAMES[monthIdx], year, decayPct: Math.round(decayFactor * 100) });
      affectedYears.add(year);
    }
  }
  return {
    startMonth: MONTH_NAMES[startMonth], startYear, duration, affectedMonths,
    affectedYears: Array.from(affectedYears).sort(),
    eventYear: parsedDate?.year || null,
    eventMonth: parsedDate ? MONTH_NAMES[parsedDate.month] : null,
  };
}

function calculateEventMath(event, selectedYear) {
  const eventType = event.event_type || 'competitor_news';
  const trustScore = event.trust_score ?? 0.5;
  const ref = INTEL_EVENT_IMPACT_RANGES[eventType] || { range: [-1.0, 1.0], duration: 6 };
  const [rangeLow, rangeHigh] = ref.range;
  const duration = ref.duration;
  let pointEstimate, impactSource;
  if (event.user_adjusted_impact != null) {
    pointEstimate = event.user_adjusted_impact;
    impactSource = 'User adjusted';
  } else if (event.impact_estimate_low != null && event.impact_estimate_high != null) {
    pointEstimate = (event.impact_estimate_low + event.impact_estimate_high) / 2;
    impactSource = 'Estimate midpoint';
  } else if (eventType in BIDIRECTIONAL_DEFAULT_SIDE) {
    // For ranges crossing zero, use directional default instead of midpoint (which would be 0%)
    const side = BIDIRECTIONAL_DEFAULT_SIDE[eventType];
    const mid = (rangeLow + rangeHigh) / 2;
    const halfSpan = (rangeHigh - rangeLow) / 2;
    pointEstimate = mid + side * halfSpan;
    impactSource = 'Reference range';
  } else {
    pointEstimate = (rangeLow + rangeHigh) / 2;
    impactSource = 'Reference range';
  }
  const immediateImpact = pointEstimate * trustScore;
  const k = 0.1;
  const effectiveImpact = immediateImpact / (1 + k * Math.abs(immediateImpact));
  let multiplier = 1.0 + (effectiveImpact / 100);
  multiplier = Math.max(0.80, Math.min(1.20, multiplier));
  const period = calculateAffectedPeriod(event, selectedYear);
  const hasYearMismatch = selectedYear && period.affectedYears.length > 0 && !period.affectedYears.includes(Number(selectedYear));
  return { eventType, trustScore, rangeLow, rangeHigh, duration, pointEstimate, impactSource, immediateImpact, effectiveImpact, multiplier, period, hasYearMismatch, selectedYear };
}

// ============================================
// ANIMATED DATA READOUT
// ============================================

function DataReadout({ value, previousValue, label, unit = '', size = 'md', trend, className = '' }) {
  const spring = useSpring(previousValue || value, { stiffness: 100, damping: 20 });
  const display = useTransform(spring, (v) => formatNumber(Math.round(v)));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  const trendColor = trend === 'up' ? 'text-ind-lime' : trend === 'down' ? 'text-ind-rose' : 'text-surface-500';

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <span className="text-[9px] font-medium uppercase tracking-widest text-surface-400 mb-0.5">
          {label}
        </span>
      )}
      <div className="flex items-baseline gap-1.5">
        <motion.span
          className={`font-mono font-bold tracking-tight ${sizeClasses[size]} ${trendColor}`}
        >
          {display}
        </motion.span>
        {unit && <span className="text-xs font-medium text-surface-400">{unit}</span>}
        {trend && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${trendColor}`}
          >
            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ============================================
// STATUS INDICATOR LIGHT
// ============================================

function StatusLight({ status, label, size = 'md', pulse = false }) {
  const statusConfig = {
    running: { color: 'bg-ind-run', glow: 'shadow-console-glow-green', label: 'RUNNING' },
    ready: { color: 'bg-emerald-500', glow: 'shadow-console-glow-green ring-2 ring-emerald-500/30', label: 'READY' },
    idle: { color: 'bg-ind-stop', glow: '', label: 'IDLE' },
    processing: { color: 'bg-daikin-blue', glow: 'shadow-console-glow-cyan', label: 'PROCESSING' },
    warning: { color: 'bg-ind-warn', glow: 'shadow-console-glow-amber', label: 'WARNING' },
    error: { color: 'bg-ind-fault', glow: 'shadow-console-glow-red', label: 'FAULT' },
  };

  const config = statusConfig[status] || statusConfig.idle;
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <motion.div
          className={`${sizeClasses[size]} rounded-full ${config.color} ${config.glow}`}
          animate={pulse ? { opacity: [1, 0.4, 1] } : {}}
          transition={pulse ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
        />
        {pulse && (
          <motion.div
            className={`absolute inset-0 ${sizeClasses[size]} rounded-full ${config.color}`}
            animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </div>
      <span className="text-[9px] font-mono font-semibold tracking-wider text-surface-500">
        {label || config.label}
      </span>
    </div>
  );
}

// ============================================
// INSTRUMENT PANEL
// ============================================

function InstrumentPanel({ children, title, className = '', headerActions }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-white/70 backdrop-blur-2xl rounded-2xl border border-white/70 overflow-hidden ring-1 ring-black/5 ${className}`}
      style={{
        boxShadow: '0 16px 36px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.75)'
      }}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-white/60 backdrop-blur-xl border-b border-white/60">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-surface-500">
            {title}
          </span>
          {headerActions}
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </motion.div>
  );
}

// ============================================
// CONSOLE BUTTON
// ============================================

function ConsoleButton({ children, onClick, variant = 'default', active = false, disabled = false, icon: Icon, size = 'md', className = '' }) {
  const variants = {
    default: active
      ? 'bg-white/85 text-daikin-dark border-white/70'
      : 'bg-white/60 text-surface-600 border-white/50 hover:bg-white/80 hover:border-white/70',
    primary: 'bg-daikin-blue text-white border-daikin-blue/80 hover:bg-daikin-blue/90',
    ghost: 'bg-transparent text-surface-500 border-transparent hover:bg-white/60 hover:text-surface-700',
    danger: 'bg-ind-fault/10 text-ind-fault border-ind-fault/30 hover:bg-ind-fault/20',
  };

  const sizes = {
    sm: 'px-2.5 py-1.5 text-[10px] gap-1.5',
    md: 'px-3 py-2 text-[11px] gap-2',
    lg: 'px-4 py-2.5 text-xs gap-2',
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.98 }}
      className={`
        inline-flex items-center justify-center font-semibold rounded-lg border
        transition-all duration-150 ease-out
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${active ? 'shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]' : 'shadow-[0_6px_16px_rgba(15,23,42,0.12)]'}
        ${className}
      `}
      style={{
        textShadow: variant === 'primary' ? '0 1px 1px rgba(0,0,0,0.2)' : 'none',
      }}
    >
      {Icon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      {children}
    </motion.button>
  );
}

// ============================================
// GAUGE METER
// ============================================

function GaugeMeter({ value, max, label, color = 'cyan', size = 'md' }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const colors = {
    cyan: 'bg-ind-cyan',
    amber: 'bg-ind-amber',
    lime: 'bg-ind-lime',
    rose: 'bg-ind-rose',
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-medium uppercase tracking-wider text-surface-400">{label}</span>
          <span className="text-[10px] font-mono font-bold text-surface-600">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="h-2 bg-surface-100 rounded-full overflow-hidden" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          className={`h-full rounded-full ${colors[color]}`}
          style={{ boxShadow: '0 0 8px currentColor' }}
        />
      </div>
    </div>
  );
}

// ============================================
// HEADER
// ============================================

function ConsoleHeader({ user, onLogout, onExport, canExport, selectedProduct, selectedAps, selectedYear, products, apsClasses, availableYears, setSelectedProduct, setSelectedAps, setSelectedYear, status, lastUpdated, betaLoading, cannibalizationActive = false, onFeedback }) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="h-[70px] md:h-[74px] bg-gradient-to-b from-white/85 via-white/70 to-white/60 backdrop-blur-2xl border-b border-white/60 flex items-center px-4 gap-4 relative z-50 ring-1 ring-black/5"
      style={{ boxShadow: '0 10px 30px rgba(15,23,42,0.12)' }}
    >
      {/* Airflow Dots Animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`airflow-${i}`}
            className="absolute rounded-full bg-daikin-blue"
            style={{
              left: 120,
              top: `${28 + (i % 4) * 14}%`,
              width: 4 - (i % 3),
              height: 4 - (i % 3),
            }}
            animate={{
              x: [0, 100 + i * 18, 250 + i * 22, 420 + i * 18],
              y: [
                0,
                (i % 4 === 0 ? -16 : i % 4 === 1 ? 16 : i % 4 === 2 ? -8 : 8),
                (i % 4 === 0 ? -8 : i % 4 === 1 ? 8 : i % 4 === 2 ? -4 : 4),
                0,
              ],
              opacity: [0.15, 0.8, 0.6, 0],
              scale: [0.6, 1, 0.9, 0.4],
            }}
            transition={{
              duration: 3.5 + (i % 4) * 0.5,
              delay: i * 0.28,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        ))}
      </div>

      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <img src="/FSSML.png" alt="Manufacturer" className="h-9 w-auto" />
          <div className="flex flex-col">
            <span className="text-sm font-extrabold text-daikin-dark tracking-tight leading-none">FORECAST</span>
            <span className="text-[9px] font-semibold text-surface-400 tracking-[0.2em] leading-none mt-0.5">SIMULATOR</span>
          </div>
        </div>
      </div>

      {/* Center: Context Selectors */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-0.5 p-1 bg-white/70 backdrop-blur-xl rounded-xl border border-white/60">
          <div className={cannibalizationActive ? 'opacity-40 pointer-events-none blur-[1px]' : ''}>
            <ContextPill
              value={selectedProduct}
              options={products}
              onChange={setSelectedProduct}
              icon={Layers}
              placeholder="Product"
              attention={!cannibalizationActive}
            />
          </div>
          <div className="w-px h-5 bg-surface-200 mx-1" />
          <div className={cannibalizationActive ? 'opacity-40 pointer-events-none blur-[1px]' : ''}>
            <ContextPill
              value={selectedAps}
              options={[{ value: null, label: 'ALL' }, ...(apsClasses[selectedProduct] || []).map(a => ({ value: a, label: a }))]}
              onChange={setSelectedAps}
              icon={Target}
              placeholder="Class"
            />
          </div>
          <div className="w-px h-5 bg-surface-200 mx-1" />
          <ContextPill
            value={selectedYear}
            options={availableYears}
            onChange={setSelectedYear}
            icon={Calendar}
            prefix="CY"
          />
        </div>
        {cannibalizationActive && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-daikin-blue/5 border border-daikin-blue/20 rounded-full ml-3">
            <Shuffle className="w-3 h-3 text-daikin-blue" />
            <span className="text-[9px] font-bold text-daikin-blue tracking-[0.1em] uppercase">Cannibalization Simulator</span>
            <span className="px-1 py-0.5 rounded text-[7px] font-black bg-daikin-blue/10 text-daikin-blue leading-none">BETA</span>
          </div>
        )}
      </div>

      {/* Right: Status & Actions */}
      <div className="flex items-center gap-4">
        <ConsoleButton onClick={onFeedback} icon={MessageSquare} size="sm" variant="ghost">
          Feedback
        </ConsoleButton>

        <div className="w-px h-6 bg-surface-200" />

        <StatusLight
          status={betaLoading ? 'processing' : status === 'active' ? 'ready' : 'idle'}
          pulse={betaLoading}
        />

        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-surface-400">
            <Clock className="w-3 h-3" />
            <span className="text-[9px] font-mono">
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        )}

        <div className="w-px h-6 bg-surface-200" />

        <div className={cannibalizationActive ? 'opacity-40 pointer-events-none blur-[1px]' : ''}>
          <ConsoleButton onClick={onExport} disabled={!canExport} icon={Download} size="sm">
            Export
          </ConsoleButton>
        </div>

        <div className="flex items-center gap-2 pl-3 border-l border-surface-200">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-daikin-blue to-daikin-light flex items-center justify-center">
            <span className="text-[11px] font-bold text-white">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="text-[10px] font-medium text-surface-400 hover:text-surface-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-6 -bottom-px h-px bg-gradient-to-r from-transparent via-daikin-blue/35 to-transparent -z-10" />
    </motion.header>
  );
}

// ============================================
// CONTEXT PILL SELECTOR
// ============================================

function ContextPill({ value, options, onChange, icon: Icon, placeholder, prefix, attention = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  const shouldPulse = attention && !isOpen;

  useEffect(() => {
    const handleClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => (typeof opt === 'object' ? opt.value : opt) === value);
  const displayValue = selectedOption
    ? (typeof selectedOption === 'object' ? selectedOption.label : selectedOption)
    : placeholder;

  return (
    <div ref={ref} className="relative">
      {shouldPulse && (
        <motion.span
          className="absolute -inset-1 rounded-xl bg-gradient-to-r from-daikin-blue/35 via-daikin-light/10 to-transparent blur-lg pointer-events-none"
          animate={{ opacity: [0.25, 0.6, 0.25], scale: [0.98, 1.03, 0.98] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.98 }}
        animate={shouldPulse ? { y: [0, -1.5, 0] } : undefined}
        transition={shouldPulse ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' } : undefined}
        className={`
          relative overflow-hidden flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold
          transition-all duration-150
          ${isOpen
            ? 'bg-white/85 backdrop-blur-xl text-daikin-blue border border-daikin-blue/20 shadow-[0_8px_20px_rgba(0,160,228,0.15)]'
            : attention
              ? 'text-daikin-blue bg-white/80 border border-daikin-blue/30 shadow-[0_14px_30px_rgba(0,160,228,0.22)]'
              : 'text-surface-600 hover:bg-white/60 border border-transparent'
          }
        `}
      >
        {shouldPulse && (
          <motion.span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-70"
            animate={{ x: ['-120%', '120%'] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
          />
        )}
        {Icon && (
          <Icon className={`w-3.5 h-3.5 ${attention ? 'text-daikin-blue' : 'text-surface-400'}`} />
        )}
        <span className="tracking-wide">
          {prefix && value ? `${prefix}` : ''}{displayValue}
        </span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3 h-3 text-surface-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-full left-0 mt-2 min-w-[160px] bg-white/90 backdrop-blur-xl rounded-2xl border border-white/70 py-1.5 z-[200] max-h-64 overflow-auto"
            style={{ boxShadow: '0 16px 40px rgba(15,23,42,0.14)' }}
          >
            {options.map((option, index) => {
              const optValue = typeof option === 'object' ? option.value : option;
              const optLabel = typeof option === 'object' ? option.label : option;
              const isSelected = optValue === value;

              return (
                <motion.button
                  key={optValue ?? index}
                  onClick={() => { onChange(optValue); setIsOpen(false); }}
                  whileHover={{ x: 2 }}
                  className={`
                    w-full px-3 py-2 text-left text-[11px] font-semibold tracking-wide
                    flex items-center gap-2 transition-colors
                    ${isSelected
                      ? 'bg-daikin-blue/5 text-daikin-blue'
                      : 'text-surface-600 hover:bg-surface-50'
                    }
                  `}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-daikin-blue' : 'bg-transparent'}`} />
                  {prefix && optValue ? `${prefix}` : ''}{optLabel}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// METRICS DISPLAY BAR
// ============================================

function MetricsDisplayBar({ baselineTotal, simulatedTotal, variance, variancePercent, alerts, alertSummary, onMarkAllRead, onDismiss, isLoadingAlerts, cannibalizationActive = false, cannibalizationResult = null }) {
  const [showAlerts, setShowAlerts] = useState(false);
  const alertRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => { if (alertRef.current && !alertRef.current.contains(e.target)) setShowAlerts(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = alertSummary?.unread || 0;
  const trend = variance >= 0 ? 'up' : 'down';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="relative z-40 h-16 sm:h-15 flex-shrink-0 bg-white/60 backdrop-blur-2xl border-b border-white/70 flex items-center px-4 ring-1 ring-black/5"
      style={{ boxShadow: '0 12px 30px rgba(42, 15, 17, 0.12)' }}
    >
      {/* Metrics Readouts */}
      {cannibalizationActive && cannibalizationResult ? (
        <div className="flex items-stretch gap-6">
          {/* Source callout */}
          <div className="flex flex-col justify-center py-2">
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-red-400 mb-0.5">
              Source (loses)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-bold text-red-500">
                {cannibalizationResult.sourceLabel}
              </span>
              <span className="text-[10px] font-mono text-surface-400">
                {formatNumber(cannibalizationResult.sourceAnnualTotal || 0)} /yr
              </span>
            </div>
          </div>
          <div className="w-px bg-surface-200" />
          {/* Transfer ratio */}
          <div className="flex flex-col justify-center py-2 items-center">
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-surface-400 mb-0.5">
              Transfer Ratio
            </span>
            <div className="flex items-baseline gap-1">
              <motion.span
                key={cannibalizationResult.transferRatio}
                initial={{ opacity: 0.5, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg font-mono font-black text-daikin-blue"
              >
                {cannibalizationResult.transferRatio != null
                  ? `${(cannibalizationResult.transferRatio * 100).toFixed(1)}%`
                  : '--'}
              </motion.span>
            </div>
          </div>
          <div className="w-px bg-surface-200" />
          {/* Target callout */}
          <div className="flex flex-col justify-center py-2">
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-emerald-400 mb-0.5">
              Target (gains)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-bold text-emerald-600">
                {cannibalizationResult.targetLabel}
              </span>
              <span className="text-[10px] font-mono text-surface-400">
                {formatNumber(cannibalizationResult.targetAnnualTotal || 0)} /yr
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-stretch gap-8">
          <InstrumentReadout label="Baseline" value={baselineTotal} />
          <div className="w-px bg-surface-200" />
          <InstrumentReadout label="Simulated" value={simulatedTotal} highlight />
          <div className="w-px bg-surface-200" />
          <InstrumentReadout
            label="Variance"
            value={Math.abs(variance)}
            prefix={variance >= 0 ? '+' : '-'}
            suffix={`${variance >= 0 ? '+' : ''}${variancePercent}%`}
            trend={trend}
          />
        </div>
      )}

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Alerts Panel */}
        <div ref={alertRef} className="relative z-[1200]">
          <ConsoleButton
            onClick={() => setShowAlerts(!showAlerts)}
            active={showAlerts}
            icon={Bell}
            size="md"
          >
            Alerts
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-ind-fault text-white text-[10px] font-bold flex items-center justify-center"
              >
                {unreadCount}
              </motion.span>
            )}
          </ConsoleButton>

          <AnimatePresence>
            {showAlerts && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-2 w-80 bg-gradient-to-br from-sky-50 to-white rounded-2xl border border-sky-100 overflow-hidden z-[1200]"
                style={{ boxShadow: '0 20px 50px rgba(15,23,42,0.15), 0 8px 24px rgba(0, 160, 228, 0.1)' }}
              >
                <div className="flex items-center justify-between px-4 py-3 bg-sky-50/50 border-b border-sky-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500">Alerts</span>
                  {unreadCount > 0 && (
                    <button onClick={onMarkAllRead} className="text-[9px] font-semibold text-daikin-blue hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-auto">
                  {isLoadingAlerts ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-5 h-5 text-surface-300 animate-spin" />
                    </div>
                  ) : alerts?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-surface-400">
                      <Bell className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-xs font-medium">No alerts</p>
                    </div>
                  ) : (
                    alerts?.map((alert) => (
                      <AlertItem key={alert.id} alert={alert} onDismiss={onDismiss} />
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function InstrumentReadout({ label, value, prefix = '', suffix, trend, highlight = false }) {
  const trendColors = {
    up: 'text-ind-lime',
    down: 'text-ind-rose',
  };

  return (
    <div className="flex flex-col justify-center py-2">
      <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-surface-400 mb-0.5">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <motion.span
          key={value}
          initial={{ opacity: 0.5, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`
            text-lg font-mono font-bold tracking-tight
            ${trend ? trendColors[trend] : highlight ? 'text-daikin-blue' : 'text-surface-700'}
          `}
        >
          {prefix}{formatNumber(value)}
        </motion.span>
        {suffix && (
          <span className={`text-[11px] font-mono font-semibold ${trend ? trendColors[trend] : 'text-surface-400'}`}>
            {suffix}
          </span>
        )}
        {trend && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className={trendColors[trend]}
          >
            {trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function AlertItem({ alert, onDismiss }) {
  const priorityColors = {
    high: 'bg-ind-fault',
    medium: 'bg-ind-warn',
    low: 'bg-surface-300',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className={`px-4 py-3 border-b border-surface-100 hover:bg-surface-50 transition-colors ${!alert.read ? 'bg-daikin-blue/5' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priorityColors[alert.priority] || priorityColors.low}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-surface-700">{alert.title}</p>
          <p className="text-[9px] text-surface-500 mt-0.5 line-clamp-2">{alert.message}</p>
        </div>
        <button onClick={() => onDismiss(alert.id)} className="text-surface-300 hover:text-surface-500 p-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ============================================
// SIMULATION CANVAS
// ============================================

function SimulationCanvas({ isLoading, currentBaseline, simulationResult, currentDelivered, currentActuals, selectedProduct, selectedAps, selectedYear, showBaseline, showDelivered, showActuals, setShowBaseline, setShowDelivered, setShowActuals, showConfidenceBands, setShowConfidenceBands, confidenceBands, currentDataDate, focusMonth, onFocusToggle, analysisMonth, analysisYear, availableYears, setSelectedYear, onReset, betaLoading, cannibalizationResult, onExitCannibalization, cannibalizationActive = false, baselineData, showStdDev, setShowStdDev }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="flex-1 flex flex-col min-w-0 min-h-0"
    >
      {/* Canvas Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-white/65 backdrop-blur-2xl border-b border-white/70 ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          {cannibalizationActive ? (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.97 }}
              onClick={onExitCannibalization}
              className="flex items-center gap-2 px-2 py-2 rounded-xl bg-rose-200 text-rose-600 hover:bg-rose-300 transition-all text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg"
            >
              <X className="w-3.5 h-3.5" />
              Exit
            </motion.button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-daikin-blue/10 to-daikin-light/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-daikin-blue" />
              </div>
              <div>
                <h2 className="text-[13px] font-bold text-surface-700 leading-tight">
                  {selectedProduct}{selectedAps ? ` / ${selectedAps}` : ''}
                </h2>
                <p className="text-[9px] text-surface-400 font-medium tracking-wide">Calendar Year {selectedYear}</p>
              </div>
            </div>
          )}

          {betaLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1.5 bg-daikin-blue/5 border border-daikin-blue/20 rounded-full"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Cpu className="w-3.5 h-3.5 text-daikin-blue" />
              </motion.div>
              <span className="text-[9px] font-bold text-daikin-blue tracking-wider">COMPUTING</span>
            </motion.div>
          )}
        </div>

        <div />
      </div>

      {/* Chart Area */}
      <div className="flex-1 min-h-0 p-4 bg-white/45">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-surface-400 bg-white/75 backdrop-blur-2xl rounded-2xl border border-white/70 ring-1 ring-black/5">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="w-8 h-8 mb-3 opacity-30" />
            </motion.div>
            <p className="text-xs font-medium">Loading simulation data...</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="h-full min-h-0 bg-white/78 backdrop-blur-2xl rounded-2xl border border-white/70 overflow-hidden ring-1 ring-black/5"
            style={{ boxShadow: '0 20px 50px rgba(15,23,42,0.12)' }}
          >
            <div className="relative h-full">
              <div className="h-full p-4">
                <ForecastChart
                  baseline={currentBaseline}
                  simulated={simulationResult?.simulated || []}
                  delivered={currentDelivered}
                  actuals={currentActuals}
                  exceededMonths={simulationResult?.exceeded_months || []}
                  product={selectedProduct}
                  apsClass={selectedAps}
                  year={selectedYear}
                  showBaseline={showBaseline}
                  showDelivered={showDelivered}
                  showActuals={showActuals}
                  onToggleBaseline={setShowBaseline}
                  onToggleDelivered={setShowDelivered}
                  onToggleActuals={setShowActuals}
                  confidenceBands={showConfidenceBands ? confidenceBands : null}
                  dataDate={currentDataDate}
                  focusMonth={focusMonth}
                  onFocusToggle={onFocusToggle}
                  analysisMonth={analysisMonth}
                  analysisYear={analysisYear}
                  availableYears={availableYears}
                  setSelectedYear={setSelectedYear}
                  onReset={onReset}
                  appliedDetails={simulationResult?.applied_details || {}}
                  height="100%"
                  cannibalizationResult={cannibalizationResult}
                  baselineData={baselineData}
                  showStdDev={showStdDev}
                  onToggleStdDev={setShowStdDev}
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// IMPACT MATH TOOLTIP
// ============================================

function ImpactMathTooltip({ anchorRect, event, selectedYear, onMouseEnter, onMouseLeave }) {
  const tooltipRef = useRef(null);
  const [position, setPosition] = useState(null);
  const math = calculateEventMath(event, selectedYear);
  const config = getEventTypeConfig(math.eventType);

  useEffect(() => {
    if (!anchorRect || !tooltipRef.current) return;
    const updatePosition = () => {
      const tooltipEl = tooltipRef.current;
      if (!tooltipEl) return;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 14;
      const maxWidth = Math.min(320, viewportWidth - padding * 2);
      const tooltipRect = tooltipEl.getBoundingClientRect();
      const tooltipWidth = Math.min(tooltipRect.width || maxWidth, maxWidth);
      const naturalHeight = tooltipEl.scrollHeight || tooltipRect.height || 360;

      const spaceBelow = viewportHeight - anchorRect.bottom - padding;
      const spaceAbove = anchorRect.top - padding;
      const placeBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;
      const availableSpace = Math.max(160, placeBelow ? spaceBelow : spaceAbove);
      const maxHeight = Math.min(520, availableSpace);

      let left = anchorRect.left + (anchorRect.width / 2) - (tooltipWidth / 2);
      if (anchorRect.right > viewportWidth - 260) {
        left = anchorRect.right - tooltipWidth;
      }
      if (left < padding) left = padding;
      if (left + tooltipWidth > viewportWidth - padding) {
        left = viewportWidth - tooltipWidth - padding;
      }

      let top = placeBelow ? anchorRect.bottom + 10 : anchorRect.top - Math.min(naturalHeight, maxHeight) - 10;
      if (top + maxHeight > viewportHeight - padding) top = viewportHeight - maxHeight - padding;
      if (top < padding) top = padding;

      setPosition({ top, left, width: tooltipWidth, maxHeight });
    };

    const raf = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(raf);
  }, [anchorRect]);

  return createPortal(
    <motion.div
      ref={tooltipRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      className="fixed z-[9999] w-[300px] max-w-[calc(100vw-28px)] bg-white/92 backdrop-blur-2xl rounded-2xl border border-white/80 overflow-x-hidden overflow-y-auto"
      style={{
        top: position ? `${position.top}px` : '-9999px',
        left: position ? `${position.left}px` : '-9999px',
        width: position?.width ? `${position.width}px` : undefined,
        maxHeight: position?.maxHeight ? `${position.maxHeight}px` : undefined,
        overscrollBehavior: 'contain',
        visibility: position ? 'visible' : 'hidden',
        boxShadow: '0 16px 40px rgba(15,23,42,0.14)'
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-white/60 border-b border-white/60">
        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-sky-500">Impact Analysis</div>
      </div>

      <div className="p-4 space-y-3">
        {math.hasYearMismatch && (
          <div className="p-3 bg-ind-warn/10 border border-ind-warn/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-ind-warn flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-ind-warn">Year Mismatch</p>
              <p className="text-[10px] text-ind-warn/80 mt-0.5">
                This event affects CY{math.period.affectedYears.join(', CY')} but you're viewing CY{selectedYear}.
                Switch to CY{math.period.affectedYears[0]} to see the impact.
              </p>
            </div>
          </div>
        )}

        <div className="pb-2 border-b border-surface-200/60">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-surface-400 mb-2">
            Affected Period
          </div>
          {math.period.eventMonth && math.period.startYear && (
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-surface-500">Event Start</span>
              <span className="font-semibold text-surface-700">{math.period.eventMonth} {math.period.startYear}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 text-[11px] mt-1">
            <span className="text-surface-500">Affected Years</span>
            <span className="font-semibold text-surface-700">
              {math.period.affectedYears.length > 0
                ? math.period.affectedYears.map(y => `CY${y}`).join(', ')
                : 'Current year'}
            </span>
          </div>
          <div className="mt-2">
            <span className="text-[10px] text-surface-500 block mb-1">Monthly Impact Decay</span>
            <div className="flex flex-wrap gap-1">
              {math.period.affectedMonths.slice(0, 6).map((m, i) => (
                <span key={i} className="px-2 py-1 rounded bg-daikin-blue/10 text-[9px] font-mono font-bold text-daikin-blue">
                  {m.month}'{String(m.year).slice(-2)}: {m.decayPct}%
                </span>
              ))}
              {math.period.affectedMonths.length > 6 && (
                <span className="px-2 py-1 rounded bg-surface-100 text-[9px] font-mono text-surface-500">
                  +{math.period.affectedMonths.length - 6}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="pb-2 border-b border-surface-200/60 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-surface-500">Event Type</span>
            <span className="font-semibold text-surface-700">{config.label}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-surface-500">Reference Range</span>
            <span className="font-semibold text-surface-700">
              {math.rangeLow > 0 ? '+' : ''}{math.rangeLow}% to {math.rangeHigh > 0 ? '+' : ''}{math.rangeHigh}%
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-surface-500">Effect Duration</span>
            <span className="font-semibold text-surface-700">{math.duration} months</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-surface-500">Point Estimate ({math.impactSource})</span>
            <span className="font-mono font-bold text-surface-700">
              {math.pointEstimate > 0 ? '+' : ''}{math.pointEstimate.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-surface-500">Trust Score</span>
            <span className="font-mono font-bold text-surface-700">{(math.trustScore * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div className="pt-2 border-t border-surface-200/60 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-surface-500">Raw Impact</span>
            <span className="font-mono font-semibold text-surface-600">
              {math.pointEstimate.toFixed(1)} x {(math.trustScore * 100).toFixed(0)}% = {math.immediateImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-surface-500">Diminishing Returns (k=0.1)</span>
            <span className="font-mono font-semibold text-surface-600">{math.effectiveImpact.toFixed(2)}%</span>
          </div>
        </div>

        <div className="pt-2 border-t border-surface-200/60">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-daikin-blue">Final Multiplier</span>
            <span className={`text-base font-mono font-black ${math.multiplier >= 1 ? 'text-ind-lime' : 'text-ind-rose'}`}>
              {math.multiplier.toFixed(3)}x
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] mt-1">
            <span className="font-semibold text-daikin-blue">Net Effect (at start)</span>
            <span className={`font-mono font-bold ${math.multiplier >= 1 ? 'text-ind-lime' : 'text-ind-rose'}`}>
              {((math.multiplier - 1) * 100) > 0 ? '+' : ''}{((math.multiplier - 1) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>,
    document.body
  );
}

function MiniReadout({ label, value }) {
  return (
    <div className="p-2.5 bg-white/60 rounded-lg border border-white/60">
      <div className="text-[7px] font-bold uppercase tracking-[0.12em] text-surface-400 mb-0.5">{label}</div>
      <div className="text-[10px] font-mono font-bold text-surface-700">{value}</div>
    </div>
  );
}

// ============================================
// PINNED SELECTED EVENT CHIP (Summary)
// ============================================

function PinnedEventChip({ event, onRemove, onExpand, onShowInfo, isExpanded, selectedYear }) {
  const infoButtonRef = useRef(null);
  const math = calculateEventMath(event, selectedYear);
  const config = getEventTypeConfig(event.event_type);
  const impactValue = ((math.multiplier - 1) * 100);
  const hasYearMismatch = math.hasYearMismatch;

  const handleInfoClick = (e) => {
    e.stopPropagation();
    if (infoButtonRef.current) {
      onShowInfo(event, infoButtonRef.current.getBoundingClientRect());
    }
  };

  // Type indicator dot colors - muted tones
  const typeColors = {
    cyan: { dot: 'bg-sky-400/80' },
    amber: { dot: 'bg-amber-400/80' },
    emerald: { dot: 'bg-emerald-400/80' },
    violet: { dot: 'bg-violet-400/80' },
    orange: { dot: 'bg-orange-400/80' },
    rose: { dot: 'bg-rose-400/80' },
    teal: { dot: 'bg-teal-400/80' },
    gray: { dot: 'bg-surface-300' },
  };

  const colors = typeColors[config.color] || typeColors.gray;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      className="relative overflow-hidden rounded-xl border border-surface-200 bg-gradient-to-br from-sky-50 to-white shadow-pond-card"
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {/* Type indicator dot */}
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />

        {/* Company & headline preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {event.company && (
              <span className="text-[10px] font-bold text-sky-600">{event.company}</span>
            )}
            <span className="text-[8px] text-surface-300">|</span>
            <span className="text-[9px] font-medium text-surface-600 truncate">{event.headline}</span>
          </div>
        </div>

        {/* Impact */}
        <div className={`text-[11px] font-mono font-black flex-shrink-0 ${impactValue >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
          {impactValue >= 0 ? '+' : ''}{impactValue.toFixed(1)}%
        </div>

        {/* Action buttons: Info, Expand, Remove */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <motion.button
            ref={infoButtonRef}
            onClick={handleInfoClick}
            whileTap={{ scale: 0.9 }}
            className={`p-1.5 rounded-lg border transition-colors ${
              hasYearMismatch
                ? 'text-amber-600 border-amber-200 hover:bg-amber-50'
                : 'text-surface-500 border-surface-200 hover:text-daikin-blue hover:border-daikin-blue/30 hover:bg-daikin-blue/5'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            whileTap={{ scale: 0.9 }}
            className="p-1.5 rounded-lg border border-surface-200 text-surface-500 hover:text-daikin-blue hover:border-daikin-blue/30 hover:bg-daikin-blue/5 transition-colors"
          >
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ChevronDown className="w-3.5 h-3.5" />
            </motion.div>
          </motion.button>
          <motion.button
            onClick={(e) => { e.stopPropagation(); onRemove(event); }}
            whileTap={{ scale: 0.9 }}
            className="p-1.5 rounded-lg border border-surface-200 text-surface-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 pt-2 space-y-2 border-t border-surface-200 bg-surface-50">
              {event.description && (
                <p className="text-[10px] text-surface-600 leading-relaxed">{event.description}</p>
              )}
              <div className="flex items-center gap-4 text-[9px]">
                <span className="text-surface-500">
                  Trust: <span className="font-bold text-surface-700">{(math.trustScore * 100).toFixed(0)}%</span>
                </span>
                <span className="text-surface-500">
                  Duration: <span className="font-bold text-surface-700">{math.duration}mo</span>
                </span>
                {event.event_date && (
                  <span className="text-surface-500">
                    Date: <span className="font-bold text-surface-700">{event.event_date}</span>
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================
// PINNED SELECTED EVENTS PANEL
// ============================================

function PinnedEventsPanel({ selectedEvents, onDeselectEvent, selectedYear }) {
  const [expandedId, setExpandedId] = useState(null);
  const [tooltipEvent, setTooltipEvent] = useState(null);
  const [tooltipAnchor, setTooltipAnchor] = useState(null);

  if (selectedEvents.length === 0) return null;

  const totalImpact = selectedEvents.reduce((sum, event) => {
    const math = calculateEventMath(event, selectedYear);
    return sum + ((math.multiplier - 1) * 100);
  }, 0);

  const handleShowInfo = (event, buttonRect) => {
    if (tooltipEvent?.id === event.id) {
      setTooltipEvent(null);
      setTooltipAnchor(null);
    } else {
      setTooltipAnchor(buttonRect);
      setTooltipEvent(event);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex-shrink-0 border-b border-surface-200"
    >
      <div
        className="p-3"
        style={{
          background: 'linear-gradient(180deg, rgba(207, 207, 209, 0.5) 0%, rgba(255,255,255,0.7) 30%, rgba(255,255,255,0.2) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(16, 86, 102, 0.08)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center w-6 h-6 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(0,160,228,0.15) 0%, rgba(68,200,245,0.1) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)'
              }}
            >
              <Check className="w-3.5 h-3.5 text-daikin-blue" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-700">
              Active Events
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #00A0E4 0%, #44C8F5 100%)' }}
            >
              {selectedEvents.length}
            </span>
          </div>
          <div
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-black ${
              totalImpact >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
            }`}
          >
            Net: {totalImpact >= 0 ? '+' : ''}{totalImpact.toFixed(1)}%
          </div>
        </div>

        {/* Pinned chips */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {selectedEvents.map((event) => (
              <PinnedEventChip
                key={event.id}
                event={event}
                onRemove={onDeselectEvent}
                onExpand={() => setExpandedId(prev => prev === event.id ? null : event.id)}
                onShowInfo={handleShowInfo}
                isExpanded={expandedId === event.id}
                selectedYear={selectedYear}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Tooltip for info */}
      {tooltipEvent && tooltipAnchor && (
        <ImpactMathTooltip
          anchorRect={tooltipAnchor}
          event={tooltipEvent}
          selectedYear={selectedYear}
          onMouseEnter={() => {}}
          onMouseLeave={() => { setTooltipEvent(null); setTooltipAnchor(null); }}
        />
      )}
    </motion.div>
  );
}

// ============================================
// INTELLIGENCE EVENT CARD (GLASS TILE)
// ============================================

function IntelligenceEventCard({ event, isSelected, onToggleSelect, selectedYear, isExpanded, onToggleExpand }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const infoRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const isHoveringTooltipRef = useRef(false);

  const math = calculateEventMath(event, selectedYear);
  const config = getEventTypeConfig(event.event_type);
  const hasYearMismatch = math.hasYearMismatch;
  const impactValue = ((math.multiplier - 1) * 100);
  const impactDisplay = `${impactValue >= 0 ? '+' : ''}${impactValue.toFixed(1)}%`;

  const handleMouseEnterInfo = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (infoRef.current) setAnchorRect(infoRef.current.getBoundingClientRect());
    setShowTooltip(true);
  }, []);

  const handleMouseLeaveInfo = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isHoveringTooltipRef.current) { setShowTooltip(false); setAnchorRect(null); }
    }, 150);
  }, []);

  const handleMouseEnterTooltip = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    isHoveringTooltipRef.current = true;
  }, []);

  const handleMouseLeaveTooltip = useCallback(() => {
    isHoveringTooltipRef.current = false;
    hoverTimeoutRef.current = setTimeout(() => { setShowTooltip(false); setAnchorRect(null); }, 150);
  }, []);

  useEffect(() => { return () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }; }, []);

  // Event type colors - muted, soft tones for a refined look
  // Using pastel backgrounds with darker text for readability
  const typeColors = {
    cyan: {
      accent: 'bg-sky-300/70',
      badge: 'bg-sky-100 text-sky-700 border border-sky-200',
      glow: 'shadow-pond-card'
    },
    amber: {
      accent: 'bg-amber-300/70',
      badge: 'bg-amber-50 text-amber-700 border border-amber-200',
      glow: 'shadow-pond-card'
    },
    emerald: {
      accent: 'bg-emerald-300/70',
      badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      glow: 'shadow-pond-card'
    },
    violet: {
      accent: 'bg-violet-300/70',
      badge: 'bg-violet-50 text-violet-700 border border-violet-200',
      glow: 'shadow-pond-card'
    },
    orange: {
      accent: 'bg-orange-300/70',
      badge: 'bg-orange-50 text-orange-700 border border-orange-200',
      glow: 'shadow-pond-card'
    },
    rose: {
      accent: 'bg-rose-300/70',
      badge: 'bg-rose-50 text-rose-700 border border-rose-200',
      glow: 'shadow-pond-card'
    },
    teal: {
      accent: 'bg-teal-300/70',
      badge: 'bg-teal-50 text-teal-700 border border-teal-200',
      glow: 'shadow-pond-card'
    },
    gray: {
      accent: 'bg-surface-300/70',
      badge: 'bg-surface-100 text-surface-600 border border-surface-200',
      glow: ''
    },
  };

  const colors = typeColors[config.color] || typeColors.gray;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      onClick={() => onToggleSelect(event)}
      className={`
        relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200
        bg-gradient-to-br from-sky-50 to-white border
        ${isSelected
          ? 'border-daikin-blue shadow-pond-selected ring-1 ring-daikin-blue/20'
          : 'border-surface-200 shadow-pond-card hover:shadow-pond-card-hover hover:border-surface-300'
        }
      `}
    >
      {/* Accent bar */}
      <div className={`h-1.5 w-full ${colors.accent}`} />

      {/* Card content */}
      <div className="relative p-3">
        {/* Header: Badge + Impact */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wide ${colors.badge}`}>
              {config.label}
            </span>
            {hasYearMismatch && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-600 border border-amber-200 flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                CY
              </span>
            )}
          </div>

          {/* Impact badge */}
          <div
            className={`px-2 py-1 rounded-lg ${
              impactValue >= 0 ? 'bg-emerald-50/70' : 'bg-rose-50/70'
            }`}
          >
            <div className={`text-xs font-mono font-black leading-none ${impactValue >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
              {impactDisplay}
            </div>
          </div>
        </div>

        {/* Company */}
        {event.company && (
          <div className="text-[10px] font-bold text-sky-600 mb-1">{event.company}</div>
        )}

        {/* Headline */}
        <p className="text-[10px] font-medium text-surface-700 leading-snug line-clamp-2 mb-3">
          {event.headline}
        </p>

        {/* Trust meter */}
        <div className="mb-2.5">
          <div className="flex items-center justify-between text-[9px] mb-1.5">
            <span className="font-semibold uppercase tracking-wide text-surface-500">Trust Score</span>
            <span className="font-mono font-bold text-surface-700">{(math.trustScore * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${math.trustScore * 100}%` }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              className={`h-full rounded-full ${
                math.trustScore >= 0.85 ? 'bg-emerald-400/80' :
                math.trustScore >= 0.7 ? 'bg-sky-400/80' :
                'bg-amber-400/80'
              }`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-200">
          <div className="flex items-center gap-1.5 text-[9px] text-surface-500">
            <Clock className="w-3.5 h-3.5 text-surface-400" />
            <span className="font-medium">{math.duration}mo</span>
            {event.event_date && (
              <>
                <span className="text-surface-300">|</span>
                <span className="text-surface-500">{event.event_date}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              ref={infoRef}
              onMouseEnter={handleMouseEnterInfo}
              onMouseLeave={handleMouseLeaveInfo}
              onClick={(e) => e.stopPropagation()}
              className={`p-1.5 rounded-lg border transition-colors ${
                hasYearMismatch
                  ? 'text-amber-500 border-amber-200 hover:bg-amber-50/50'
                  : 'text-surface-400 border-surface-200 hover:text-sky-500 hover:border-sky-200 hover:bg-sky-50/50'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            <motion.button
              onClick={(e) => { e.stopPropagation(); onToggleExpand(event.id); }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-lg border border-surface-200 text-surface-500 hover:text-daikin-blue hover:border-daikin-blue/30 hover:bg-daikin-blue/5 transition-colors"
            >
              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.div>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Selection indicator */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-daikin-blue flex items-center justify-center"
            style={{ boxShadow: '0 2px 8px rgba(0, 160, 228, 0.4)' }}
          >
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2 border-t border-surface-200 bg-surface-50">
              {event.description && (
                <p className="text-[10px] text-surface-600 leading-relaxed">{event.description}</p>
              )}
              {event.supporting_quote && (
                <div className="pl-2 border-l-2 border-daikin-blue/40 py-1">
                  <p className="text-[9px] text-surface-500 italic">"{event.supporting_quote}"</p>
                </div>
              )}
              {event.products_affected && event.products_affected.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-surface-400">Products:</span>
                  {event.products_affected.map(p => (
                    <span key={p} className="px-1.5 py-0.5 rounded bg-surface-200 text-surface-600 text-[8px] font-medium">{p}</span>
                  ))}
                </div>
              )}
              {event.source_url && (
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[9px] font-semibold text-daikin-blue hover:underline"
                >
                  <ExternalLink className="w-2.5 h-2.5" />{event.source_name || 'View Source'}
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showTooltip && anchorRect && (
        <ImpactMathTooltip
          anchorRect={anchorRect}
          event={event}
          selectedYear={selectedYear}
          onMouseEnter={handleMouseEnterTooltip}
          onMouseLeave={handleMouseLeaveTooltip}
        />
      )}
    </motion.div>
  );
}

// ============================================
// INTELLIGENCE GRID VIEW
// ============================================

function IntelligenceFeedView({ events, selectedEvents, onSelectEvent, onDeselectEvent, selectedYear }) {
  const [expandedId, setExpandedId] = useState(null);

  const isEventSelected = (eventId) => selectedEvents.some(e => e.id === eventId);

  const handleToggleSelect = (event) => {
    if (isEventSelected(event.id)) onDeselectEvent(event);
    else onSelectEvent(event);
  };

  const handleToggleExpand = (eventId) => {
    setExpandedId(prev => prev === eventId ? null : eventId);
  };

  // Filter out selected events from the main grid
  const unselectedEvents = events.filter(e => !isEventSelected(e.id));

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{
            background: 'linear-gradient(135deg, rgba(16,86,102,0.1) 0%, rgba(131,153,88,0.1) 100%)',
            boxShadow: 'inset 0 1px 2px rgba(16, 86, 102, 0.1)'
          }}
        >
          <Brain className="w-8 h-8 text-surface-300" />
        </div>
        <p className="text-[11px] font-semibold text-surface-500 text-center">No intelligence data</p>
        <p className="text-[9px] text-surface-400 text-center mt-1">Click Search to scan for market events</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Pinned selected events */}
      <AnimatePresence>
        {selectedEvents.length > 0 && (
          <PinnedEventsPanel
            selectedEvents={selectedEvents}
            onDeselectEvent={onDeselectEvent}
            selectedYear={selectedYear}
          />
        )}
      </AnimatePresence>

      {/* Grid content */}
      <div className="flex-1 min-h-0 overflow-auto p-3">
        {/* Grid header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-surface-500">
            {unselectedEvents.length} Available Event{unselectedEvents.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Card grid */}
        {unselectedEvents.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5">
            {unselectedEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02, duration: 0.3 }}
                layout
              >
                <IntelligenceEventCard
                  event={event}
                  isSelected={false}
                  onToggleSelect={handleToggleSelect}
                  selectedYear={selectedYear}
                  isExpanded={expandedId === event.id}
                  onToggleExpand={handleToggleExpand}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-surface-400">
            <Check className="w-8 h-8 text-daikin-blue/30 mb-2" />
            <p className="text-[9px] font-medium text-center">All events selected</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// CONTROL PANEL
// ============================================

function ControlPanel({ isCollapsed, onToggleCollapse, openPanels, togglePanel, selectedProduct, selectedEvents, onSelectEvent, onDeselectEvent, onClearEvents, selectedYear, msMetadata, marketShareData, simParams, updateSimParams, weights, lockedEvents, handleNavigateToMSGuide, handleNavigateToPromoGuide, handleNavigateToRegulationGuide, handleNavigateToIntelGuide, handleEffectToggle, onCannibalizationResult, cannibalizationResult }) {
  const [activeSection, setActiveSection] = useState('intelligence');
  const cannibActive = cannibalizationResult != null;
  const [cannibUnlocked, setCannibUnlocked] = useState(false);
  const [showCannibPasscode, setShowCannibPasscode] = useState(false);
  const [passcodeValue, setPasscodeValue] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const passcodeInputRef = useRef(null);

  // Re-lock cannibalization when exited (result cleared)
  const prevCannibResult = useRef(cannibalizationResult);
  useEffect(() => {
    if (prevCannibResult.current != null && cannibalizationResult == null) {
      setCannibUnlocked(false);
      setActiveSection('scenarios');
    }
    prevCannibResult.current = cannibalizationResult;
  }, [cannibalizationResult]);

  const handleCannibTabClick = useCallback(() => {
    if (cannibUnlocked || cannibActive) {
      setActiveSection('cannibalization');
    } else {
      setPasscodeValue('');
      setPasscodeError(false);
      setShowCannibPasscode(true);
      setTimeout(() => passcodeInputRef.current?.focus(), 100);
    }
  }, [cannibUnlocked, cannibActive]);

  const handlePasscodeSubmit = useCallback(() => {
    if (passcodeValue === '1738') {
      setCannibUnlocked(true);
      setShowCannibPasscode(false);
      setActiveSection('cannibalization');
    } else {
      setPasscodeError(true);
      setPasscodeValue('');
      setTimeout(() => passcodeInputRef.current?.focus(), 50);
    }
  }, [passcodeValue]);

  return (
    <>
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className={`flex flex-col min-h-0 bg-white/70 backdrop-blur-2xl border-l border-white/70 ring-1 ring-black/5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] transition-all duration-300 ${isCollapsed ? 'w-14' : 'w-[380px]'}`}
    >
      {/* Panel Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-white/60 bg-white/60 backdrop-blur-xl">
        {!isCollapsed && (
          <div className="flex gap-1 p-1 bg-white/70 backdrop-blur-xl rounded-lg border border-white/60">
            <TabButton
              active={activeSection === 'intelligence'}
              onClick={() => !cannibActive && setActiveSection('intelligence')}
              icon={Brain}
              label="Intel"
              disabled={cannibActive}
            />
            <TabButton
              active={activeSection === 'scenarios'}
              onClick={() => !cannibActive && setActiveSection('scenarios')}
              icon={Sliders}
              label="Scenarios"
              disabled={cannibActive}
            />
            <TabButton
              active={activeSection === 'cannibalization'}
              onClick={handleCannibTabClick}
              icon={cannibUnlocked || cannibActive ? Shuffle : Lock}
              label="Cannib"
            />
          </div>
        )}
        <motion.button
          onClick={onToggleCollapse}
          whileTap={{ scale: 0.95 }}
          className="p-2 rounded-lg hover:bg-white/70 text-surface-400 hover:text-surface-600 transition-colors ml-auto"
        >
          <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }}>
            {isCollapsed ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </motion.div>
        </motion.button>
      </div>

      {/* Panel Content */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeSection === 'intelligence' && (
              <motion.div
                key="intelligence"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full min-h-0"
              >
                <IntelligenceTab
                  selectedProduct={selectedProduct}
                  selectedEvents={selectedEvents}
                  onSelectEvent={onSelectEvent}
                  onDeselectEvent={onDeselectEvent}
                  onClearEvents={onClearEvents}
                  selectedYear={selectedYear}
                  onInfoClick={handleNavigateToIntelGuide}
                />
              </motion.div>
            )}
            {activeSection === 'scenarios' && (
              <motion.div
                key="scenarios"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full min-h-0"
              >
                <ScenariosTab
                  openPanels={openPanels}
                  togglePanel={togglePanel}
                  msMetadata={msMetadata}
                  marketShareData={marketShareData}
                  selectedYear={selectedYear}
                  simParams={simParams}
                  updateSimParams={updateSimParams}
                  weights={weights}
                  lockedEvents={lockedEvents}
                  handleNavigateToMSGuide={handleNavigateToMSGuide}
                  handleNavigateToPromoGuide={handleNavigateToPromoGuide}
                  handleNavigateToRegulationGuide={handleNavigateToRegulationGuide}
                  handleEffectToggle={handleEffectToggle}
                />
              </motion.div>
            )}
            {activeSection === 'cannibalization' && (
              <motion.div
                key="cannibalization"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full min-h-0 overflow-auto"
              >
                <div className="p-3">
                  <InstrumentPanel>
                    <CannibalizationPanel
                      selectedYear={selectedYear}
                      onResult={onCannibalizationResult}
                    />
                  </InstrumentPanel>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Collapsed Icons */}
      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center py-4 gap-2">
          <CollapsedTabButton
            onClick={() => { onToggleCollapse(); setActiveSection('intelligence'); }}
            icon={Brain}
            title="Intelligence"
          />
          <CollapsedTabButton
            onClick={() => { onToggleCollapse(); setActiveSection('scenarios'); }}
            icon={Sliders}
            title="Scenarios"
          />
          <CollapsedTabButton
            onClick={() => {
              if (cannibUnlocked || cannibActive) {
                onToggleCollapse();
                setActiveSection('cannibalization');
              } else {
                onToggleCollapse();
                setPasscodeValue('');
                setPasscodeError(false);
                setShowCannibPasscode(true);
                setTimeout(() => passcodeInputRef.current?.focus(), 100);
              }
            }}
            icon={cannibUnlocked || cannibActive ? Shuffle : Lock}
            title="Cannibalization"
          />
        </div>
      )}
    </motion.div>

    {/* Cannibalization Passcode Modal */}
    <AnimatePresence>
      {showCannibPasscode && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCannibPasscode(false)}
            className="fixed inset-0 bg-black/10 backdrop-blur-sm z-[9998]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
          >
            <div
              className="w-[340px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] bg-white/92 backdrop-blur-2xl rounded-2xl border border-white/80 overflow-hidden pointer-events-auto"
              style={{ boxShadow: '0 16px 40px rgba(15,23,42,0.14)' }}
            >
              <div className="px-4 py-3 bg-white/60 border-b border-white/60">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-daikin-blue/10 to-daikin-light/10 flex items-center justify-center">
                    <Lock className="w-3.5 h-3.5 text-daikin-blue" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-surface-700">
                    Cannibalization Access
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <p className="text-[11px] font-medium text-surface-600 leading-relaxed">
                  Enter the 4-digit passcode to access cannibalization mode.
                </p>
                <div className="flex justify-center">
                  <input
                    ref={passcodeInputRef}
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={passcodeValue}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPasscodeValue(v);
                      setPasscodeError(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && passcodeValue.length === 4) handlePasscodeSubmit();
                    }}
                    className={`w-36 text-center text-lg font-mono tracking-[0.4em] py-2 px-3 rounded-xl border bg-white transition-all outline-none ${
                      passcodeError
                        ? 'border-red-300 ring-2 ring-red-100 text-red-600'
                        : 'border-white/70 focus:border-daikin-blue/40 focus:ring-2 focus:ring-daikin-blue/10 text-surface-700'
                    }`}
                    placeholder="----"
                  />
                </div>
                {passcodeError && (
                  <p className="text-[10px] text-red-500 text-center font-medium">
                    Incorrect passcode. Try again.
                  </p>
                )}
              </div>

              <div className="px-4 py-3 bg-sky/60 border-t border-sky/60 flex items-center justify-end gap-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCannibPasscode(false)}
                  className="px-3 py-1.5 text-[11px] font-semibold text-surface-500 hover:text-surface-700 transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePasscodeSubmit}
                  disabled={passcodeValue.length < 4}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all shadow-[0_6px_16px_rgba(0,160,228,0.3)] ${
                    passcodeValue.length === 4
                      ? 'bg-daikin-blue text-white hover:bg-daikin-blue/90'
                      : 'bg-daikin-blue/40 text-white/70 cursor-not-allowed'
                  }`}
                  style={{ textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}
                >
                  Unlock
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

function TabButton({ active, onClick, icon: Icon, label, disabled = false }) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      whileTap={disabled ? {} : { scale: 0.98 }}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider
        transition-all
        ${disabled
          ? 'text-surface-300 cursor-not-allowed opacity-50'
          : active
            ? 'bg-white/85 text-surface-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]'
            : 'text-surface-400 hover:text-surface-600'
        }
      `}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </motion.button>
  );
}

function CollapsedTabButton({ onClick, icon: Icon, title }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="p-2.5 rounded-xl hover:bg-white/70 text-surface-400 hover:text-daikin-blue transition-colors"
      title={title}
    >
      <Icon className="w-5 h-5" />
    </motion.button>
  );
}

// ============================================
// INTELLIGENCE TAB
// ============================================

function IntelligenceTab({ selectedProduct, selectedEvents, onSelectEvent, onDeselectEvent, onClearEvents, selectedYear, onInfoClick }) {
  const { events, isSearching, searchIntelligence, loadEvents } = useIntelligence();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ event_type: '', min_trust: 0, competitors: ['Carrier', 'Trane', 'Lennox'] });

  useEffect(() => {
    loadEvents({ limit: 50 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async () => {
    if (selectedProduct) {
      setShowFilters(false);
      await searchIntelligence({ competitors: filters.competitors, include_regulatory: true, include_industry: true });
    }
  }, [selectedProduct, searchIntelligence, filters.competitors]);

  const toggleCompetitor = (comp) => {
    setFilters(prev => ({ ...prev, competitors: prev.competitors.includes(comp) ? prev.competitors.filter(c => c !== comp) : [...prev.competitors, comp] }));
  };

  const filteredEvents = events.filter(event => {
    // Filter out events with no valid event type (null/undefined/empty/string "null"/"NULL")
    if (!event.event_type || event.event_type.toLowerCase() === 'null') return false;
    if (filters.event_type && event.event_type !== filters.event_type) return false;
    if (filters.min_trust && (event.trust_score || 0) < filters.min_trust) return false;
    return true;
  });

  const activeFiltersCount = (filters.event_type ? 1 : 0) + (filters.min_trust > 0 ? 1 : 0);

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Search Bar */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-white/60 bg-white/60 backdrop-blur-xl relative z-40">
        <div className="flex items-center gap-2">
          <ConsoleButton
            onClick={handleSearch}
            disabled={isSearching || !selectedProduct}
            variant="primary"
            icon={isSearching ? RefreshCw : Search}
            size="sm"
            className={isSearching ? 'animate-pulse' : ''}
          >
            {isSearching ? 'Searching' : 'Search'}
          </ConsoleButton>

          {/* Filters Dropdown */}
          <div className="relative flex-1 z-50">
            <ConsoleButton
              onClick={() => setShowFilters(!showFilters)}
              active={showFilters}
              icon={Filter}
              size="sm"
              className="w-full justify-between"
            >
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-daikin-blue text-white text-[9px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </ConsoleButton>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute top-full left-0 right-0 mt-2 p-3 bg-white/90 backdrop-blur-2xl rounded-2xl border border-sky-100 shadow-pond-glass space-y-3"
                  style={{ boxShadow: '0 16px 48px rgba(0, 160, 228, 0.15), 0 8px 24px rgba(15,23,42,0.1)' }}
                >
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-sky-600 mb-2 block">
                      Competitors
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {COMPETITOR_OPTIONS.map(comp => (
                        <motion.button
                          key={comp}
                          onClick={() => toggleCompetitor(comp)}
                          whileTap={{ scale: 0.95 }}
                          className={`
                            px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all
                            ${filters.competitors.includes(comp)
                              ? 'bg-daikin-blue text-white'
                              : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                            }
                          `}
                        >
                          {comp}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-sky-600 mb-1 block">Type</label>
                      <Select
                        value={filters.event_type}
                        onChange={(val) => setFilters(prev => ({ ...prev, event_type: val }))}
                        options={EVENT_TYPE_OPTIONS}
                        placeholder="All Types"
                        size="sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-sky-600 mb-1 block">Trust</label>
                      <Select
                        value={filters.min_trust}
                        onChange={(val) => setFilters(prev => ({ ...prev, min_trust: parseFloat(val) }))}
                        options={[
                          { value: 0, label: 'All' },
                          { value: 0.7, label: '70%+' },
                          { value: 0.85, label: '85%+' },
                        ]}
                        placeholder="All"
                        size="sm"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Selected Count */}
          {selectedEvents.length > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-daikin-blue/10 border border-daikin-blue/20 rounded-lg"
            >
              <Check className="w-3 h-3 text-daikin-blue" />
              <span className="text-[10px] font-bold text-daikin-blue">{selectedEvents.length}</span>
              <button onClick={onClearEvents} className="text-daikin-blue/60 hover:text-daikin-blue ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}

          {/* Impact Ranges Guide */}
          {onInfoClick && (
            <button
              onClick={onInfoClick}
              className="p-1.5 rounded-lg text-surface-400 hover:text-daikin-blue hover:bg-daikin-blue/10 transition-colors"
              title="Impact ranges methodology"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 min-h-0 overflow-auto">
        <IntelligenceFeedView
          events={filteredEvents}
          selectedEvents={selectedEvents}
          onSelectEvent={onSelectEvent}
          onDeselectEvent={onDeselectEvent}
          selectedYear={selectedYear}
        />
      </div>
    </div>
  );
}

// ============================================
// SCENARIOS TAB
// ============================================

function ScenariosTab({ openPanels, togglePanel, msMetadata, marketShareData, selectedYear, simParams, updateSimParams, weights, lockedEvents, handleNavigateToMSGuide, handleNavigateToPromoGuide, handleNavigateToRegulationGuide, handleEffectToggle }) {
  const scenarios = [
    { key: 'marketShare', title: 'Market Share', icon: PieChart, badge: msMetadata?.data_driven ? 'AI' : null },
    { key: 'promotion', title: 'Promotion', icon: Calendar },
    { key: 'shortage', title: 'Supply Shortage', icon: AlertTriangle },
    { key: 'regulation', title: 'Regulation', icon: Shield },
    { key: 'custom', title: 'Custom Event', icon: Wrench },
    { key: 'toggles', title: 'Effect Toggles', icon: ToggleLeft },
  ];

  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="p-3 space-y-2">
        {scenarios.map(({ key, title, icon: Icon, badge }, index) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <motion.button
              onClick={() => togglePanel(key)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all
                ${openPanels[key]
                  ? 'bg-white/80 border-white/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]'
                  : 'bg-white/60 border-white/50 hover:border-white/70 shadow-[0_8px_20px_rgba(15,23,42,0.08)]'
                }
              `}
            >
              <div className={`
                w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                ${openPanels[key] ? 'bg-daikin-blue/10' : 'bg-white/70'}
              `}>
                <Icon className={`w-4.5 h-4.5 ${openPanels[key] ? 'text-daikin-blue' : 'text-surface-500'}`} />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold ${openPanels[key] ? 'text-daikin-dark' : 'text-surface-600'}`}>
                    {title}
                  </span>
                  {badge && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-daikin-blue/10 text-daikin-blue">
                      {badge}
                    </span>
                  )}
                </div>
              </div>
              <motion.div animate={{ rotate: openPanels[key] ? 180 : 0 }}>
                <ChevronDown className="w-4 h-4 text-surface-400" />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {openPanels[key] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2 pb-1">
                    <InstrumentPanel>
                      {key === 'marketShare' && <BetaMarketSharePanel marketShareData={marketShareData} selectedYear={selectedYear} mode={simParams.ms_mode} params={simParams.ms_params} metadata={msMetadata} onModeChange={(mode) => updateSimParams({ ms_mode: mode, ms_params: {} })} onParamsChange={(params) => updateSimParams({ ms_params: params })} onInfoClick={handleNavigateToMSGuide} />}
                      {key === 'promotion' && <PromotionPanel weights={weights} settings={simParams.promo_settings} toggleSettings={simParams.toggle_settings} lockedEvents={lockedEvents.Promo || []} onChange={(settings) => updateSimParams({ promo_settings: settings })} onToggleChange={(k, v) => updateSimParams({ toggle_settings: { ...simParams.toggle_settings, [k]: v } })} onInfoClick={handleNavigateToPromoGuide} />}
                      {key === 'shortage' && <ShortagePanel weights={weights} settings={simParams.shortage_settings} lockedEvents={lockedEvents.Shortage || []} onChange={(settings) => updateSimParams({ shortage_settings: settings })} />}
                      {key === 'regulation' && <RegulationPanel weights={weights} settings={simParams.regulation_settings} lockedEvents={lockedEvents.Regulation || []} onChange={(settings) => updateSimParams({ regulation_settings: settings })} onInfoClick={handleNavigateToRegulationGuide} />}
                      {key === 'custom' && <CustomEventPanel settings={simParams.custom_settings} lockedEvents={lockedEvents.Custom || []} onChange={(settings) => updateSimParams({ custom_settings: settings })} />}
                      {key === 'toggles' && <EffectToggles toggles={simParams.toggle_settings} onToggle={handleEffectToggle} />}
                    </InstrumentPanel>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

function Beta2DashboardInner() {
  const navigate = useNavigate();
  const { user, logout, isBeta } = useAuth();
  const { alerts, alertSummary, isLoadingAlerts, markAlertRead, dismissAlert, markAllAlertsRead } = useIntelligence();

  useEffect(() => { if (!isBeta) navigate('/'); }, [isBeta, navigate]);

  const { products, apsClasses, selectedProduct, selectedAps, selectedYear, availableYears, currentBaseline, currentActuals, currentDelivered, currentDataDate, baselineData, weights, marketShareData, lockedEvents, isLoading, error, analysisMonth, analysisYear, setSelectedProduct, setSelectedAps, setSelectedYear, loadProducts, loadProductData, clearError, clearLockedEvents } = useForecast();

  const [simulationResult, setSimulationResult] = useState(null);
  const [msMetadata, setMsMetadata] = useState(null);
  const [confidenceBands, setConfidenceBands] = useState(null);
  const [betaLoading, setBetaLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showBaseline, setShowBaseline] = useState(true);
  const [showDelivered, setShowDelivered] = useState(true);
  const [showActuals, setShowActuals] = useState(true);
  const [showConfidenceBands, setShowConfidenceBands] = useState(true);
  const [showStdDev, setShowStdDev] = useState(false);
  const [focusMonth, setFocusMonth] = useState(null);
  const [selectedIntelEvents, setSelectedIntelEvents] = useState([]);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  const [openPanels, setOpenPanels] = useState({ marketShare: false, promotion: false, shortage: false, regulation: false, custom: false, toggles: false });
  const [cannibalizationResult, setCannibalizationResult] = useState(null);
  const [showCannibExitModal, setShowCannibExitModal] = useState(false);

  // Feedback modal state
  const [feedbackStep, setFeedbackStep] = useState('closed'); // 'closed' | 'categories' | 'input' | 'success'
  const [feedbackCategory, setFeedbackCategory] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const feedbackCommentRef = useRef(null);

  const [simParams, setSimParams] = useState({
    ms_mode: 'relative', ms_params: { delta: 0 },
    promo_settings: { month: null, pct: 0, spill_enabled: true, spill_pct: 10 },
    shortage_settings: { month: null, pct: 0 },
    regulation_settings: { month: null, pct: 0 },
    custom_settings: { month: null, weight: 1.0, pct: 0 },
    toggle_settings: { march_madness: false, lock_march: false, trend: false, trans: false, pf_pos: false, pf_neg: false },
    damp_k: 0.5,
  });

  const simulationTimeoutRef = useRef(null);

  const togglePanel = useCallback((panel) => { setOpenPanels(prev => ({ ...prev, [panel]: !prev[panel] })); }, []);
  const handleSelectEvent = useCallback((event) => { setSelectedIntelEvents(prev => prev.some(e => e.id === event.id) ? prev : [...prev, event]); }, []);
  const handleDeselectEvent = useCallback((event) => { setSelectedIntelEvents(prev => prev.filter(e => e.id !== event.id)); }, []);
  const handleClearEvents = useCallback(() => { setSelectedIntelEvents([]); }, []);
  const handleExitCannibalization = useCallback(() => {
    setShowCannibExitModal(true);
  }, []);

  const handleCannibExitConfirm = useCallback((shouldDownload) => {
    if (shouldDownload && cannibalizationResult) {
      const header = 'Month,Source Baseline,Source Adjusted,Target Baseline,Target Adjusted';
      const rows = MONTH_NAMES.map((month, i) => {
        const srcBase = cannibalizationResult.source?.original_baseline?.[i] ?? '';
        const srcAdj = cannibalizationResult.source?.adjusted_baseline?.[i] ?? '';
        const tgtBase = cannibalizationResult.target?.original_baseline?.[i] ?? '';
        const tgtAdj = cannibalizationResult.target?.adjusted_baseline?.[i] ?? '';
        return `${month},${srcBase},${srcAdj},${tgtBase},${tgtAdj}`;
      });
      const csv = [header, ...rows].join('\n');
      downloadFile(csv, `cannibalization_${cannibalizationResult.sourceLabel}_to_${cannibalizationResult.targetLabel}_CY${selectedYear}.csv`);
    }
    setCannibalizationResult(null);
    setShowCannibExitModal(false);
  }, [cannibalizationResult, selectedYear]);

  // Feedback handlers
  const handleOpenFeedback = useCallback(() => {
    setFeedbackStep('categories');
  }, []);

  const handleFeedbackCategorySelect = useCallback((cat) => {
    setFeedbackCategory(cat);
    setFeedbackRating(0);
    setFeedbackComment('');
    setFeedbackStep('input');
    setTimeout(() => feedbackCommentRef.current?.focus(), 150);
  }, []);

  const handleFeedbackSubmit = useCallback(async () => {
    if (!feedbackCategory || feedbackRating === 0) return;
    setFeedbackSubmitting(true);
    try {
      await betaApi.submitFeedback({
        category: feedbackCategory,
        rating: feedbackRating,
        comment: feedbackComment,
      });
      setFeedbackStep('success');
      setTimeout(() => {
        setFeedbackStep('categories');
        setFeedbackCategory(null);
        setFeedbackRating(0);
        setFeedbackComment('');
      }, 1800);
    } catch (err) {
      console.error('Feedback submit failed:', err);
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [feedbackCategory, feedbackRating, feedbackComment]);

  const handleCloseFeedback = useCallback(() => {
    setFeedbackStep('closed');
    setFeedbackUnlocked(false);
    setFeedbackCategory(null);
    setFeedbackRating(0);
    setFeedbackComment('');
  }, []);

  const handleResetSimulations = useCallback(() => {
    setSimParams({
      ms_mode: 'relative', ms_params: { delta: 0 },
      promo_settings: { month: null, pct: 0, spill_enabled: true, spill_pct: 10 },
      shortage_settings: { month: null, pct: 0 },
      regulation_settings: { month: null, pct: 0 },
      custom_settings: { month: null, weight: 1.0, pct: 0 },
      toggle_settings: { march_madness: false, lock_march: false, trend: false, trans: false, pf_pos: false, pf_neg: false },
      damp_k: 0.5,
    });
    clearLockedEvents();
    setSelectedIntelEvents([]);
    setFocusMonth(null);
  }, [clearLockedEvents]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { if (selectedProduct) loadProductData(selectedProduct, selectedAps); }, [selectedProduct, selectedAps, loadProductData]);

  const runBetaSimulation = useCallback(async () => {
    if (!selectedProduct || !selectedYear || currentBaseline.length === 0) return;
    setBetaLoading(true);
    try {
      const response = await betaApi.simulate({
          baselineVals: currentBaseline, weights, marketShareData, selectedYear,
          msMode: simParams.ms_mode, msParams: simParams.ms_params,
          promoSettings: simParams.promo_settings, shortageSettings: simParams.shortage_settings,
          regulationSettings: simParams.regulation_settings, customSettings: simParams.custom_settings,
          toggleSettings: simParams.toggle_settings, lockedEvents, dampK: simParams.damp_k,
          selectedIntelEvents: selectedIntelEvents.map(e => e.id),
          selectedIntelEventObjects: selectedIntelEvents,
      });
      if (response.success) {
        setSimulationResult({ simulated: response.simulated, final_multipliers: response.final_multipliers, applied_details: response.applied_details, ms_adjustments: response.ms_adjustments, exceeded_months: response.exceeded_months });
        setMsMetadata(response.ms_metadata);
        setConfidenceBands(response.confidence_bands);
        setLastUpdated(new Date());
      }
    } catch (err) { console.error('Beta simulation error:', err); }
    finally { setBetaLoading(false); }
  }, [selectedProduct, selectedYear, currentBaseline, weights, marketShareData, simParams, lockedEvents, selectedIntelEvents]);

  useEffect(() => {
    if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
    simulationTimeoutRef.current = setTimeout(runBetaSimulation, 180);
    return () => { if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current); };
  }, [runBetaSimulation]);

  const updateSimParams = useCallback((updates) => { setSimParams(prev => ({ ...prev, ...updates })); }, []);

  const handleExport = useCallback(() => {
    if (!simulationResult) return;
    const csv = generateCSV({ product: selectedProduct, apsClass: selectedAps, year: selectedYear, baseline: currentBaseline, simulated: simulationResult.simulated, multipliers: simulationResult.final_multipliers, msAdjustments: simulationResult.ms_adjustments, msMode: simParams.ms_mode, appliedDetails: simulationResult.applied_details });
    downloadFile(csv, `forecast_${selectedProduct}_${selectedAps || 'all'}_CY${selectedYear}.csv`);
  }, [simulationResult, selectedProduct, selectedAps, selectedYear, currentBaseline, simParams.ms_mode]);

  const handleNavigateToMSGuide = useCallback(() => navigate('/market-share-guide'), [navigate]);
  const handleNavigateToPromoGuide = useCallback(() => navigate('/promotion-guide'), [navigate]);
  const handleNavigateToRegulationGuide = useCallback(() => navigate('/regulation-guide'), [navigate]);
  const handleNavigateToIntelGuide = useCallback(() => navigate('/intelligence-guide'), [navigate]);
  const handleEffectToggle = useCallback((key, value) => { updateSimParams({ toggle_settings: { ...simParams.toggle_settings, [key]: value } }); }, [simParams.toggle_settings, updateSimParams]);

  const baselineTotal = currentBaseline.reduce((sum, v) => sum + v, 0);
  const simulatedTotal = simulationResult?.simulated?.reduce((sum, v) => sum + v, 0) || 0;
  const variance = simulatedTotal - baselineTotal;
  const variancePercent = baselineTotal > 0 ? ((variance / baselineTotal) * 100).toFixed(1) : 0;

  const getSimStatus = () => {
    if (betaLoading) return 'processing';
    if (error) return 'error';
    if (simulationResult) return 'active';
    return 'idle';
  };

  if (!isBeta) return null;

  return (
    <div
      className="h-[100dvh] min-h-[100dvh] flex flex-col bg-gradient-to-br from-white via-surface-50 to-daikin-light/15 overflow-hidden relative text-surface-700"
      style={{ fontFamily: '"SF Pro Text","SF Pro Display",-apple-system,"BlinkMacSystemFont","Segoe UI","Inter",sans-serif' }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute -top-32 right-[-10%] h-[360px] w-[360px] rounded-full bg-daikin-blue/18 blur-3xl"
          animate={{ y: [0, 18, 0], x: [0, -12, 0], scale: [1, 1.04, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 left-[-15%] h-[420px] w-[420px] rounded-full bg-daikin-light/25 blur-3xl"
          animate={{ y: [0, -22, 0], x: [0, 14, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[-20%] right-1/4 h-[480px] w-[480px] rounded-full bg-surface-900/10 blur-3xl"
          animate={{ y: [0, 24, 0], x: [0, -8, 0], scale: [1, 1.03, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/65 via-white/30 to-surface-900/10" />
      </div>
      <div className="relative z-10 flex flex-col h-full min-h-0">
        <ConsoleHeader
          user={user}
          onLogout={logout}

          onExport={handleExport}
          canExport={!!simulationResult}
          selectedProduct={selectedProduct}
          selectedAps={selectedAps}
          selectedYear={selectedYear}
          products={products}
          apsClasses={apsClasses}
          availableYears={availableYears}
          setSelectedProduct={setSelectedProduct}
          setSelectedAps={setSelectedAps}
          setSelectedYear={setSelectedYear}
          status={getSimStatus()}
          lastUpdated={lastUpdated}
          betaLoading={betaLoading}
          cannibalizationActive={cannibalizationResult != null}
          onFeedback={handleOpenFeedback}
        />

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-6 py-2 bg-white/70 backdrop-blur-xl border-b border-ind-fault/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-ind-fault animate-pulse" />
                <span className="text-[11px] font-semibold text-ind-fault">{error}</span>
              </div>
              <button onClick={clearError} className="text-ind-fault/60 hover:text-ind-fault">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MetricsDisplayBar
        baselineTotal={baselineTotal}
        simulatedTotal={simulatedTotal}
        variance={variance}
        variancePercent={variancePercent}
        alerts={alerts}
        alertSummary={alertSummary}
        onMarkAllRead={markAllAlertsRead}
        onDismiss={dismissAlert}
        isLoadingAlerts={isLoadingAlerts}
        cannibalizationActive={cannibalizationResult != null}
        cannibalizationResult={cannibalizationResult}
      />

        <main className="flex-1 min-h-0 flex overflow-hidden">
          <SimulationCanvas
            isLoading={isLoading}
            betaLoading={betaLoading}
            currentBaseline={currentBaseline}
            simulationResult={simulationResult}
            currentDelivered={currentDelivered}
            currentActuals={currentActuals}
            selectedProduct={selectedProduct}
            selectedAps={selectedAps}
            selectedYear={selectedYear}
            showBaseline={showBaseline}
            showDelivered={showDelivered}
            showActuals={showActuals}
            setShowBaseline={setShowBaseline}
            setShowDelivered={setShowDelivered}
            setShowActuals={setShowActuals}
            showConfidenceBands={showConfidenceBands}
            setShowConfidenceBands={setShowConfidenceBands}
            confidenceBands={confidenceBands}
            currentDataDate={currentDataDate}
            focusMonth={focusMonth}
            onFocusToggle={setFocusMonth}
            analysisMonth={analysisMonth}
            analysisYear={analysisYear}
            availableYears={availableYears}
            setSelectedYear={setSelectedYear}
            onReset={handleResetSimulations}
            cannibalizationResult={cannibalizationResult}
            onExitCannibalization={handleExitCannibalization}
            cannibalizationActive={cannibalizationResult != null}
            baselineData={baselineData}
            showStdDev={showStdDev}
            setShowStdDev={setShowStdDev}
          />

          <ControlPanel
            isCollapsed={controlsCollapsed}
            onToggleCollapse={() => setControlsCollapsed(!controlsCollapsed)}
            openPanels={openPanels}
            togglePanel={togglePanel}
            selectedProduct={selectedProduct}
            selectedEvents={selectedIntelEvents}
            onSelectEvent={handleSelectEvent}
            onDeselectEvent={handleDeselectEvent}
            onClearEvents={handleClearEvents}
            selectedYear={selectedYear}
            msMetadata={msMetadata}
            marketShareData={marketShareData}
            simParams={simParams}
            updateSimParams={updateSimParams}
            weights={weights}
            lockedEvents={lockedEvents}
            handleNavigateToMSGuide={handleNavigateToMSGuide}
            handleNavigateToPromoGuide={handleNavigateToPromoGuide}
            handleNavigateToRegulationGuide={handleNavigateToRegulationGuide}
            handleNavigateToIntelGuide={handleNavigateToIntelGuide}
            handleEffectToggle={handleEffectToggle}
            onCannibalizationResult={setCannibalizationResult}
            cannibalizationResult={cannibalizationResult}
          />
        </main>

        {/* Cannibalization Exit Modal */}
        <AnimatePresence>
          {showCannibExitModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCannibExitModal(false)}
                className="fixed inset-0 bg-black/10 backdrop-blur-sm z-[9998]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
              >
                <div
                  className="w-[340px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] bg-white/92 backdrop-blur-2xl rounded-2xl border border-white/80 overflow-hidden pointer-events-auto"
                  style={{ boxShadow: '0 16px 40px rgba(15,23,42,0.14)' }}
                >
                  <div className="px-4 py-3 bg-white/60 border-b border-white/60">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-daikin-blue/10 to-daikin-light/10 flex items-center justify-center">
                        <Shuffle className="w-3.5 h-3.5 text-daikin-blue" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-surface-700">
                        Exit Cannibalization
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <p className="text-[11px] font-medium text-surface-600 leading-relaxed">
                      Would you like to download the cannibalization scenario data before exiting?
                    </p>
                    <div className="p-3 bg-white rounded-xl border border-white-100">
                      <p className="text-[10px] text-surface-500 leading-relaxed">
                        The CSV will include monthly source/target baseline and adjusted values.
                      </p>
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-sky/60 border-t border-sky/60 flex items-center justify-end gap-2">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowCannibExitModal(false)}
                      className="px-3 py-1.5 text-[11px] font-semibold text-surface-500 hover:text-surface-700 transition-colors"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleCannibExitConfirm(false)}
                      className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-white/85 border border-white/70 text-surface-600 hover:bg-white/95 transition-all shadow-[0_6px_16px_rgba(15,23,42,0.12)]"
                    >
                      Exit
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleCannibExitConfirm(true)}
                      className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-daikin-blue text-white hover:bg-daikin-blue/90 transition-all shadow-[0_6px_16px_rgba(0,160,228,0.3)]"
                      style={{ textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}
                    >
                      Download & Exit
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Feedback Modal */}
        <AnimatePresence>
          {feedbackStep !== 'closed' && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseFeedback}
                className="fixed inset-0 bg-black/10 backdrop-blur-sm z-[9998]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
              >
                <div
                  className={`max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] bg-white/92 backdrop-blur-2xl rounded-2xl border border-white/80 overflow-hidden pointer-events-auto transition-all duration-200 ${
                    feedbackStep === 'categories' ? 'w-[420px]' : 'w-[380px]'
                  }`}
                  style={{ boxShadow: '0 16px 40px rgba(15,23,42,0.14)' }}
                >
                  {/* --- Category selection step --- */}
                  {feedbackStep === 'categories' && (
                    <>
                      <div className="px-4 py-3 bg-white/60 border-b border-white/60">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-daikin-blue/10 to-daikin-light/10 flex items-center justify-center">
                            <MessageSquare className="w-3.5 h-3.5 text-daikin-blue" />
                          </div>
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-surface-700">
                            Share Your Feedback
                          </span>
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <p className="text-[11px] font-medium text-surface-500 mb-3">
                          Select an area to provide feedback on:
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: 'data_accuracy', label: 'Data Accuracy', desc: 'Forecast reliability & data quality' },
                            { key: 'usability', label: 'Usability', desc: 'Ease of use & navigation' },
                            { key: 'visualizations', label: 'Visualizations', desc: 'Charts, graphs & data display' },
                            { key: 'performance', label: 'Performance', desc: 'Speed & responsiveness' },
                            { key: 'features', label: 'Features', desc: 'Missing or desired functionality' },
                            { key: 'overall', label: 'Overall', desc: 'General satisfaction & suggestions' },
                          ].map(({ key, label, desc }) => (
                            <motion.button
                              key={key}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleFeedbackCategorySelect(key)}
                              className="flex flex-col items-start gap-1.5 p-3 rounded-xl bg-white/80 border border-white/70 hover:border-daikin-blue/30 hover:bg-daikin-blue/5 transition-all text-left group"
                              style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.06)' }}
                            >
                              <span className="text-[11px] font-semibold text-surface-700">{label}</span>
                              <span className="text-[9px] text-surface-400 leading-snug">{desc}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                      <div className="px-4 py-3 bg-sky/60 border-t border-sky/60 flex items-center justify-end">
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={handleCloseFeedback}
                          className="px-3 py-1.5 text-[11px] font-semibold text-surface-500 hover:text-surface-700 transition-colors"
                        >
                          Close
                        </motion.button>
                      </div>
                    </>
                  )}

                  {/* --- Input step --- */}
                  {feedbackStep === 'input' && (
                    <>
                      <div className="px-4 py-3 bg-white/60 border-b border-white/60">
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setFeedbackStep('categories')}
                            className="p-1 rounded-lg hover:bg-white/70 text-surface-400 hover:text-surface-600 transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </motion.button>
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-daikin-blue/10 to-daikin-light/10 flex items-center justify-center">
                            <MessageSquare className="w-3.5 h-3.5 text-daikin-blue" />
                          </div>
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-surface-700">
                            {feedbackCategory?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        {/* Star rating */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-2">Rating</p>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <motion.button
                                key={s}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setFeedbackRating(s)}
                                className="p-0.5"
                              >
                                <Star
                                  className={`w-6 h-6 transition-colors ${
                                    s <= feedbackRating
                                      ? 'text-daikin-blue fill-daikin-blue'
                                      : 'text-daikin-blue/30'
                                  }`}
                                />
                              </motion.button>
                            ))}
                            {feedbackRating > 0 && (
                              <span className="ml-2 text-[10px] text-surface-400 font-medium">
                                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][feedbackRating]}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Comment */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-2">Comments</p>
                          <textarea
                            ref={feedbackCommentRef}
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                            placeholder="Tell us more about your experience..."
                            rows={4}
                            className="w-full px-3 py-2 text-[11px] text-surface-700 bg-white rounded-xl border border-white/70 focus:border-daikin-blue/40 focus:ring-2 focus:ring-daikin-blue/10 outline-none resize-none transition-all placeholder:text-surface-300"
                          />
                        </div>
                      </div>
                      <div className="px-4 py-3 bg-sky/60 border-t border-sky/60 flex items-center justify-end gap-2">
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setFeedbackStep('categories')}
                          className="px-3 py-1.5 text-[11px] font-semibold text-surface-500 hover:text-surface-700 transition-colors"
                        >
                          Back
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={handleFeedbackSubmit}
                          disabled={feedbackRating === 0 || feedbackSubmitting}
                          className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-[0_6px_16px_rgba(0,160,228,0.3)] ${
                            feedbackRating > 0 && !feedbackSubmitting
                              ? 'bg-daikin-blue text-white hover:bg-daikin-blue/90'
                              : 'bg-daikin-blue/40 text-white/70 cursor-not-allowed'
                          }`}
                          style={{ textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}
                        >
                          <Send className="w-3 h-3" />
                          {feedbackSubmitting ? 'Sending...' : 'Submit'}
                        </motion.button>
                      </div>
                    </>
                  )}

                  {/* --- Success step --- */}
                  {feedbackStep === 'success' && (
                    <div className="p-6 flex flex-col items-center justify-center gap-3">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center"
                      >
                        <Check className="w-6 h-6 text-emerald-600" />
                      </motion.div>
                      <p className="text-[13px] font-semibold text-surface-700">Thank you!</p>
                      <p className="text-[11px] text-surface-400 text-center">Your feedback has been recorded.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Beta2Dashboard() {
  return (
    <IntelligenceProvider>
      <Beta2DashboardInner />
    </IntelligenceProvider>
  );
}

export default Beta2Dashboard;
