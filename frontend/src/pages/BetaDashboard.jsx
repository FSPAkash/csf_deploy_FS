
import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Info, ArrowLeft, TrendingUp, TrendingDown,
  ChevronDown, Download, AlertTriangle,
  CheckCircle, Pin, PinOff, Plus, X,
  BarChart2, Percent, Package, AlertCircle, Sliders, Settings, Crosshair
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useForecast } from '../contexts/ForecastContext';
import {
  GlassCard,
  Button,
  Spinner,
  Alert
} from '../components/common';
import Header from '../components/dashboard/Header';
import ForecastChart from '../components/chart/ForecastChart';
import BetaMarketSharePanel from '../components/controls/BetaMarketSharePanel';
import PromotionPanel from '../components/controls/PromotionPanel';
import ShortagePanel from '../components/controls/ShortagePanel';
import RegulationPanel from '../components/controls/RegulationPanel';
import CustomEventPanel from '../components/controls/CustomEventPanel';
import EffectToggles from '../components/controls/EffectToggles';
import { calculateSummaryStats, generateCSV, downloadFile } from '../utils/calculations';
import { formatNumber } from '../utils/formatters';
import { MONTHS } from '../utils/constants';
import betaApi from '../services/betaApi';

// Control definitions with metadata
const CONTROL_DEFINITIONS = {
  'market-share': {
    id: 'market-share',
    title: 'Market Share',
    icon: BarChart2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  'promotion': {
    id: 'promotion',
    title: 'Promotion',
    icon: Percent,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  'shortage': {
    id: 'shortage',
    title: 'Shortage',
    icon: Package,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  'regulation': {
    id: 'regulation',
    title: 'Regulation',
    icon: AlertCircle,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  'custom': {
    id: 'custom',
    title: 'Custom Event',
    icon: Sliders,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  'toggles': {
    id: 'toggles',
    title: 'Effect Toggles',
    icon: Settings,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
};

// Compact inline selector
function CompactSelector({ label, value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt =>
    (typeof opt === 'object' ? opt.value : opt) === value
  );

  const displayValue = selectedOption
    ? (typeof selectedOption === 'object' ? selectedOption.label : selectedOption)
    : '—';

  return (
    <div ref={containerRef} className="relative z-10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          text-center min-w-[70px] px-2 py-1 rounded-lg
          transition-all duration-150
          hover:bg-white/50
          ${isOpen ? 'bg-white/50' : ''}
        `}
      >
        <span className="block text-[8px] uppercase tracking-wider text-surface-400 font-medium leading-none mb-0.5">
          {label}
        </span>
        <span className="block text-[11px] font-semibold text-daikin-dark leading-none">
          {displayValue}
        </span>
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.1 }}
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 min-w-[100px] z-50
                     bg-white rounded-lg shadow-lg border border-surface-200
                     py-1 max-h-40 overflow-auto"
        >
          {options.map((option, index) => {
            const optValue = typeof option === 'object' ? option.value : option;
            const optLabel = typeof option === 'object' ? option.label : option;
            const isSelected = optValue === value;

            return (
              <button
                key={optValue ?? index}
                onClick={() => {
                  onChange(optValue);
                  setIsOpen(false);
                }}
                className={`
                  w-full px-2 py-1 text-left text-[11px]
                  transition-colors duration-100
                  ${isSelected
                    ? 'bg-daikin-blue/10 text-daikin-blue font-medium'
                    : 'text-daikin-dark hover:bg-surface-50'
                  }
                `}
              >
                {optLabel}
              </button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

// Breathing selector animation
function BreathingSelector({ children, ...props }) {
  const glowColor = { r: 0, g: 160, b: 228 };

  const intensity = {
    glowOpacity: 0.25,
    borderOpacity: 0.5,
    shadowOpacity: 0.9,
    shadowBlur: 100,
    maxOpacity: 0.6,
    scaleAmount: 1.5,
  };

  return (
    <div className="relative flex items-center justify-center gap-3 px-3 py-1.5 rounded-xl bg-surface-50/50 border border-surface-200/50 overflow-visible" {...props}>
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        animate={{
          opacity: [0, intensity.maxOpacity, 0],
          scale: [0.98, intensity.scaleAmount, 0.98],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: [0.8, 0, 0.4, 1],
        }}
        style={{
          background: `radial-gradient(ellipse at center, rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${intensity.glowOpacity}) 0%, transparent 70%)`,
        }}
      />

      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        animate={{ opacity: [0, 1, 0] }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: [0.4, 0, 0.2, 1],
        }}
        style={{
          boxShadow: `inset 0 0 0 1px rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${intensity.borderOpacity}), 0 0 ${intensity.shadowBlur}px -5px rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${intensity.shadowOpacity})`,
        }}
      />

      {children}
    </div>
  );
}

// Focus Month Button
function FocusMonthButton({
  analysisMonth,
  analysisYear,
  focusMonth,
  selectedYear,
  availableYears,
  onToggle,
  setSelectedYear
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const isActive = focusMonth === analysisMonth && Number(selectedYear) === Number(analysisYear);

  const handleClick = () => {
    if (isActive) {
      onToggle(null);
    } else {
      const yearMatch = availableYears.find(y => Number(y) === Number(analysisYear));
      if (yearMatch !== undefined) {
        setSelectedYear(yearMatch);
      }
      onToggle(analysisMonth);
    }
  };

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <AnimatePresence>
        {showTooltip && !isActive && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -2, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 right-0 flex justify-center mt-2 z-50 pointer-events-none"
          >
            <div className="relative px-3 py-1.5 rounded-lg bg-white/25 backdrop-blur-md shadow-lg border border-surface-200/60 whitespace-nowrap">
              <p className="text-[11px] text-surface-600 text-center leading-tight">
                Center the chart on T+4 month <span className="font-semibold text-daikin-blue">{MONTHS[analysisMonth]} {analysisYear}</span>
              </p>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2">
                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-white/95" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleClick}
        className={`
          group relative flex items-center gap-2 px-3 py-2 rounded-xl
          transition-all duration-200 ease-out
          border
          ${isActive
            ? 'bg-daikin-blue/80 text-white border-surface-200/80 shadow-md shadow-daikin-blue/25'
            : 'bg-white/25 text-daikin-dark border-surface-200/80 hover:border-daikin-blue/40 hover:bg-daikin-blue/5'
          }
        `}
      >
        <div className="relative">
          <Crosshair
            className={`w-4 h-4 transition-colors duration-200 ${
              isActive ? 'text-white' : 'text-daikin-blue'
            }`}
            strokeWidth={2.5}
          />
          {!isActive && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-daikin-blue/40"
              animate={{
                scale: [1, 1.8, 1.8],
                opacity: [0.6, 0, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          )}
        </div>

        <span className={`text-xs font-semibold transition-colors duration-200 ${
          isActive ? 'text-white' : 'text-daikin-dark'
        }`}>
          Focus
        </span>

        <AnimatePresence>
          {isActive && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="text-xs font-semibold text-white overflow-hidden whitespace-nowrap"
            >
              {MONTHS[analysisMonth]} {analysisYear}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}

// Data Quality Badge
function DataQualityBadge({ quality, rSquared }) {
  const config = {
    good: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle, label: 'Good' },
    moderate: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle, label: 'Moderate' },
    limited: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: AlertTriangle, label: 'Limited' },
    insufficient: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertTriangle, label: 'Low' },
  };

  const cfg = config[quality] || config.limited;
  const Icon = cfg.icon;

  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <Icon className="h-3 w-3" />
      <span className="text-[9px] font-medium">{cfg.label}</span>
      {rSquared && (
        <span className="text-[9px] opacity-75">R²={rSquared}</span>
      )}
    </div>
  );
}

// Pinned Control Card with glass effect
function PinnedControlCard({ controlId, onUnpin, children, badge }) {
  const def = CONTROL_DEFINITIONS[controlId];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-50/30 border-b border-surface-200/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-daikin-dark">{def.title}</span>
          {badge}
        </div>
        <button
          onClick={() => onUnpin(controlId)}
          className="p-1 rounded hover:bg-surface-100 transition-colors group"
          title="Unpin control"
        >
          <PinOff className="h-3.5 w-3.5 text-surface-400 group-hover:text-surface-600" />
        </button>
      </div>
      {/* Content */}
      <div className="p-4">
        {children}
      </div>
    </motion.div>
  );
}

// Add Control Button (for unpinned controls)
function AddControlButton({ unpinnedControls, onPin }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, openAbove: false });
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = Math.min(300, unpinnedControls.length * 40 + 40); // Estimate height
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      const shouldPositionAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      // For fixed positioning, use viewport-relative coordinates directly
      // getBoundingClientRect() already returns viewport-relative values
      setDropdownPosition({
        top: shouldPositionAbove
          ? rect.top - dropdownHeight - 4
          : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        openAbove: shouldPositionAbove,
      });
    }
  }, [isOpen, unpinnedControls.length]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      const clickedInsideContainer = containerRef.current && containerRef.current.contains(event.target);
      const clickedInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);

      if (!clickedInsideContainer && !clickedInsideDropdown) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on scroll (but not inside dropdown)
  useEffect(() => {
    if (!isOpen) return;

    function handleScroll(event) {
      if (dropdownRef.current && dropdownRef.current.contains(event.target)) {
        return;
      }
      setIsOpen(false);
    }

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  if (unpinnedControls.length === 0) return null;

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: dropdownPosition.openAbove ? 8 : -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: dropdownPosition.openAbove ? 8 : -8, scale: 0.96 }}
          transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed z-[9999] glass-modal p-3"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          <p className="text-[10px] text-surface-400 uppercase tracking-wider font-medium px-2 pb-2">
            Pin a control
          </p>
          <div className="space-y-1">
            {unpinnedControls.map(controlId => {
              const def = CONTROL_DEFINITIONS[controlId];
              const Icon = def.icon;
              return (
                <button
                  key={controlId}
                  onClick={() => {
                    onPin(controlId);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-daikin-blue/5 transition-colors"
                >
                  <div className={`p-1 rounded ${def.bgColor}`}>
                    <Icon className={`h-3.5 w-3.5 ${def.color}`} />
                  </div>
                  <span className="text-xs font-medium text-daikin-dark">{def.title}</span>
                  <Pin className="h-3 w-3 text-surface-400 ml-auto" />
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl
                   glass-subtle border border-dashed border-surface-300/50
                   hover:border-daikin-blue/50 hover:bg-daikin-blue/5 transition-all text-surface-500 hover:text-daikin-blue"
      >
        <Plus className="h-4 w-4" />
        <span className="text-xs font-medium">Add Control</span>
        <span className="text-[10px] text-surface-400">({unpinnedControls.length} available)</span>
      </button>

      {createPortal(dropdownContent, document.body)}
    </div>
  );
}

// Stats display with glass effect
function StatsDisplay({ baseline, simulated, variance, variancePercent, isLoading }) {
  return (
    <div className="glass-card p-3 rounded-xl">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-surface-50/50 rounded-lg">
          <p className="text-[9px] uppercase text-surface-400 font-medium">Baseline</p>
          {isLoading ? (
            <div className="h-4 w-12 mx-auto bg-surface-100 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-sm font-bold text-daikin-dark">{formatNumber(baseline)}</p>
          )}
        </div>
        <div className="p-2 bg-daikin-blue/5 rounded-lg">
          <p className="text-[9px] uppercase text-surface-400 font-medium">Simulated</p>
          {isLoading ? (
            <div className="h-4 w-12 mx-auto bg-surface-100 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-sm font-bold text-daikin-blue">{formatNumber(simulated)}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${variance >= 0 ? 'bg-emerald-50/50' : 'bg-red-50/50'}`}>
          <p className="text-[9px] uppercase text-surface-400 font-medium">Variance</p>
          {isLoading ? (
            <div className="h-4 w-12 mx-auto bg-surface-100 rounded animate-pulse mt-1" />
          ) : (
            <p className={`text-sm font-bold flex items-center justify-center gap-0.5 ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {variance >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {variance >= 0 ? '+' : ''}{variancePercent}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Local storage key for pinned controls
const PINNED_CONTROLS_KEY = 'beta_dashboard_pinned_controls';

function BetaDashboard() {
  const navigate = useNavigate();
  const { user, logout, isAdmin, isBeta } = useAuth();

  // Redirect if not beta user
  useEffect(() => {
    if (!isBeta) {
      navigate('/');
    }
  }, [isBeta, navigate]);

  const {
    products,
    apsClasses,
    selectedProduct,
    selectedAps,
    selectedYear,
    availableYears,
    currentBaseline,
    currentActuals,
    currentDelivered,
    weights,
    marketShareData,
    lockedEvents,
    isLoading,
    error,
    analysisMonth,
    analysisYear,
    setSelectedProduct,
    setSelectedAps,
    setSelectedYear,
    loadProducts,
    loadProductData,
    clearError,
  } = useForecast();

  // Pinned controls state (persisted to localStorage)
  const [pinnedControls, setPinnedControls] = useState(() => {
    try {
      const saved = localStorage.getItem(PINNED_CONTROLS_KEY);
      return saved ? JSON.parse(saved) : ['market-share', 'promotion'];
    } catch {
      return ['market-share', 'promotion'];
    }
  });

  // Save pinned controls to localStorage
  useEffect(() => {
    localStorage.setItem(PINNED_CONTROLS_KEY, JSON.stringify(pinnedControls));
  }, [pinnedControls]);

  // Beta-specific state
  const [simulationResult, setSimulationResult] = useState(null);
  const [msMetadata, setMsMetadata] = useState(null);
  const [dataSummary, setDataSummary] = useState(null);
  const [confidenceBands, setConfidenceBands] = useState(null);
  const [betaLoading, setBetaLoading] = useState(false);

  // Chart visibility state
  const [showBaseline, setShowBaseline] = useState(true);
  const [showDelivered, setShowDelivered] = useState(true);
  const [showActuals, setShowActuals] = useState(true);
  const [showConfidenceBands, setShowConfidenceBands] = useState(true);
  const [focusMonth, setFocusMonth] = useState(null);

  // Simulation parameters state
  const [simParams, setSimParams] = useState({
    ms_mode: 'relative',
    ms_params: { delta: 0 },
    promo_settings: { month: null, pct: 0, spill_enabled: true, spill_pct: 10 },
    shortage_settings: { month: null, pct: 0 },
    regulation_settings: { month: null, pct: 0 },
    custom_settings: { month: null, weight: 1.0, pct: 0 },
    toggle_settings: {
      march_madness: false,
      lock_march: false,
      trend: false,
      trans: false,
      pf_pos: false,
      pf_neg: false,
    },
    damp_k: 0.5,
  });

  const simulationTimeoutRef = useRef(null);

  // Pin/Unpin handlers
  const handlePin = useCallback((controlId) => {
    setPinnedControls(prev => [...prev, controlId]);
  }, []);

  const handleUnpin = useCallback((controlId) => {
    setPinnedControls(prev => prev.filter(id => id !== controlId));
  }, []);

  // Get unpinned controls
  const allControlIds = Object.keys(CONTROL_DEFINITIONS);
  const unpinnedControls = allControlIds.filter(id => !pinnedControls.includes(id));

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Load product data when selection changes
  useEffect(() => {
    if (selectedProduct) {
      loadProductData(selectedProduct, selectedAps);
    }
  }, [selectedProduct, selectedAps, loadProductData]);

  // Fetch data summary when market share data changes
  useEffect(() => {
    const fetchDataSummary = async () => {
      if (marketShareData && Object.keys(marketShareData).length > 0) {
        try {
          const response = await betaApi.getDataSummary(marketShareData, selectedYear);
          if (response.success) {
            setDataSummary(response.summary);
          }
        } catch (err) {
          console.error('Failed to fetch data summary:', err);
        }
      }
    };
    fetchDataSummary();
  }, [marketShareData, selectedYear]);

  // Run beta simulation
  const runBetaSimulation = useCallback(async () => {
    if (!selectedProduct || !selectedYear || currentBaseline.length === 0) {
      return;
    }

    setBetaLoading(true);
    try {
      const response = await betaApi.simulate({
        baselineVals: currentBaseline,
        weights: weights,
        marketShareData: marketShareData,
        selectedYear: selectedYear,
        msMode: simParams.ms_mode,
        msParams: simParams.ms_params,
        promoSettings: simParams.promo_settings,
        shortageSettings: simParams.shortage_settings,
        regulationSettings: simParams.regulation_settings,
        customSettings: simParams.custom_settings,
        toggleSettings: simParams.toggle_settings,
        lockedEvents: lockedEvents,
        dampK: simParams.damp_k
      });

      if (response.success) {
        setSimulationResult({
          simulated: response.simulated,
          final_multipliers: response.final_multipliers,
          applied_details: response.applied_details,
          ms_adjustments: response.ms_adjustments,
          exceeded_months: response.exceeded_months
        });
        setMsMetadata(response.ms_metadata);
        setConfidenceBands(response.confidence_bands);
      }
    } catch (err) {
      console.error('Beta simulation failed:', err);
    } finally {
      setBetaLoading(false);
    }
  }, [selectedProduct, selectedYear, currentBaseline, weights, marketShareData, simParams, lockedEvents]);

  // Debounced simulation
  useEffect(() => {
    if (simulationTimeoutRef.current) {
      clearTimeout(simulationTimeoutRef.current);
    }

    simulationTimeoutRef.current = setTimeout(() => {
      runBetaSimulation();
    }, 200);

    return () => {
      if (simulationTimeoutRef.current) {
        clearTimeout(simulationTimeoutRef.current);
      }
    };
  }, [runBetaSimulation]);

  // Update sim params
  const updateSimParams = useCallback((updates) => {
    setSimParams(prev => ({ ...prev, ...updates }));
  }, []);

  // Export handler
  const handleExport = useCallback(() => {
    if (!simulationResult) return;

    const csv = generateCSV({
      product: selectedProduct,
      apsClass: selectedAps,
      year: selectedYear,
      baseline: currentBaseline,
      simulated: simulationResult.simulated,
      multipliers: simulationResult.final_multipliers,
      msAdjustments: simulationResult.ms_adjustments,
      msMode: simParams.ms_mode,
      appliedDetails: simulationResult.applied_details,
    });

    const filename = `beta_simulation_${selectedProduct}_${selectedAps || 'total'}_${selectedYear}.csv`;
    downloadFile(csv, filename);
  }, [simulationResult, selectedProduct, selectedAps, selectedYear, currentBaseline, simParams.ms_mode]);

  // Navigation handlers
  const handleNavigateToMSGuide = useCallback(() => navigate('/market-share-guide'), [navigate]);
  const handleNavigateToPromoGuide = useCallback(() => navigate('/promotion-guide'), [navigate]);
  const handleNavigateToRegulationGuide = useCallback(() => navigate('/regulation-guide'), [navigate]);
  const handleBackToDashboard = useCallback(() => navigate('/'), [navigate]);

  // Effect toggle handler
  const handleEffectToggle = useCallback((key, value) => {
    updateSimParams({
      toggle_settings: {
        ...simParams.toggle_settings,
        [key]: value,
      },
    });
  }, [simParams.toggle_settings, updateSimParams]);

  // Build APS options
  const apsOptions = [
    { value: null, label: 'All Classes' },
    ...(apsClasses[selectedProduct] || []).map(aps => ({ value: aps, label: aps })),
  ];

  // Calculate totals
  const baselineTotal = currentBaseline.reduce((sum, val) => sum + val, 0);
  const simulatedTotal = simulationResult?.simulated?.reduce((sum, val) => sum + val, 0) || 0;
  const variance = simulatedTotal - baselineTotal;
  const variancePercent = baselineTotal > 0 ? ((variance / baselineTotal) * 100).toFixed(1) : 0;

  // Render control content by ID
  const renderControlContent = (controlId) => {
    switch (controlId) {
      case 'market-share':
        return (
          <BetaMarketSharePanel
            marketShareData={marketShareData}
            selectedYear={selectedYear}
            mode={simParams.ms_mode}
            params={simParams.ms_params}
            metadata={msMetadata}
            dataSummary={dataSummary}
            onModeChange={(mode) => updateSimParams({ ms_mode: mode, ms_params: {} })}
            onParamsChange={(params) => updateSimParams({ ms_params: params })}
            onInfoClick={handleNavigateToMSGuide}
          />
        );
      case 'promotion':
        return (
          <PromotionPanel
            weights={weights}
            settings={simParams.promo_settings}
            toggleSettings={simParams.toggle_settings}
            lockedEvents={lockedEvents.Promo || []}
            onChange={(settings) => updateSimParams({ promo_settings: settings })}
            onToggleChange={(key, value) => {
              updateSimParams({
                toggle_settings: { ...simParams.toggle_settings, [key]: value },
              });
            }}
            onInfoClick={handleNavigateToPromoGuide}
          />
        );
      case 'shortage':
        return (
          <ShortagePanel
            weights={weights}
            settings={simParams.shortage_settings}
            lockedEvents={lockedEvents.Shortage || []}
            onChange={(settings) => updateSimParams({ shortage_settings: settings })}
          />
        );
      case 'regulation':
        return (
          <RegulationPanel
            weights={weights}
            settings={simParams.regulation_settings}
            lockedEvents={lockedEvents.Regulation || []}
            onChange={(settings) => updateSimParams({ regulation_settings: settings })}
            onInfoClick={handleNavigateToRegulationGuide}
          />
        );
      case 'custom':
        return (
          <CustomEventPanel
            settings={simParams.custom_settings}
            lockedEvents={lockedEvents.Custom || []}
            onChange={(settings) => updateSimParams({ custom_settings: settings })}
          />
        );
      case 'toggles':
        return (
          <EffectToggles
            toggles={simParams.toggle_settings}
            onToggle={handleEffectToggle}
          />
        );
      default:
        return null;
    }
  };

  // Get badge for control
  const getControlBadge = (controlId) => {
    if (controlId === 'market-share' && msMetadata?.data_driven) {
      return (
        <span className="ml-1 px-1 py-0.5 text-[8px] font-medium bg-daikin-blue/10 text-daikin-blue rounded">
          DATA-DRIVEN
        </span>
      );
    }
    return null;
  };

  if (!isBeta) {
    return null;
  }

  if (isLoading && !selectedProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <Header
        user={user}
        isAdmin={isAdmin}
        isBeta={isBeta}
        onLogout={logout}
        onDevMode={() => navigate('/dev')}
        onBetaDashboard={() => {}}
        onBeta2Dashboard={() => navigate('/beta2')}
        onStartTutorial={() => {}}
      />

      {/* Error Alert */}
      {error && (
        <div className="px-4 pt-2 flex-shrink-0">
          <Alert type="error" onClose={clearError}>
            {error}
          </Alert>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
        {/* LEFT: Chart Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <GlassCard className="flex-1 flex flex-col min-h-0 overflow-hidden" padding="md">
            {/* Chart Header */}
                            <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToDashboard}
                    leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}
                    className="text-xs"
                  >
                    Standard
                  </Button>
                  <span className="px-2 py-0.5 text-[9px] font-semibold bg-gradient-to-r from-daikin-blue to-daikin-light text-white rounded-full">
                    BETA
                  </span>
                </div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-surface-200/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <BreathingSelector>
                  <CompactSelector
                    label="Product"
                    value={selectedProduct}
                    options={products}
                    onChange={setSelectedProduct}
                  />
                  <div className="w-px h-5 bg-surface-200" />
                  <CompactSelector
                    label="APS Class"
                    value={selectedAps}
                    options={apsOptions}
                    onChange={setSelectedAps}
                  />
                  <div className="w-px h-5 bg-surface-200" />
                  <CompactSelector
                    label="Year"
                    value={selectedYear}
                    options={availableYears}
                    onChange={setSelectedYear}
                  />
                </BreathingSelector>

                {analysisMonth !== null && analysisYear !== null && (
                  <FocusMonthButton
                    analysisMonth={analysisMonth}
                    analysisYear={analysisYear}
                    focusMonth={focusMonth}
                    selectedYear={selectedYear}
                    availableYears={availableYears}
                    onToggle={setFocusMonth}
                    setSelectedYear={setSelectedYear}
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                {msMetadata?.data_quality && (
                  <DataQualityBadge
                    quality={msMetadata.data_quality}
                    rSquared={msMetadata.regression_stats?.r_squared}
                  />
                )}
                {betaLoading && <Spinner size="sm" />}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExport}
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                  disabled={!simulationResult}
                  className="text-xs"
                >
                  Export
                </Button>
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 min-h-0">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Spinner size="lg" />
                </div>
              ) : (
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
                  focusMonth={focusMonth}
                  appliedDetails={simulationResult?.applied_details || {}}
                />
              )}
            </div>

            {/* Chart Footer */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-200/50 flex-shrink-0">
              <div className="flex items-center gap-4">
                {confidenceBands && (
                  <label className="flex items-center gap-1.5 text-xs text-surface-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showConfidenceBands}
                      onChange={(e) => setShowConfidenceBands(e.target.checked)}
                      style={{ accentColor: '#00A0E4' }}
                      className="w-3.5 h-3.5 rounded"
                    />
                    95% Confidence
                  </label>
                )}
              </div>
              <p className="text-[10px] text-surface-400">
                {selectedProduct} · {selectedAps || 'All'} · {selectedYear}
              </p>
            </div>
          </GlassCard>
        </div>

        {/* RIGHT: Pinnable Controls Panel */}
        <div className="w-[360px] flex-shrink-0 flex flex-col min-h-0 overflow-hidden">
          {/* Stats */}
          <div className="mb-3 flex-shrink-0">
            <StatsDisplay
              baseline={baselineTotal}
              simulated={simulatedTotal}
              variance={variance}
              variancePercent={variancePercent}
              isLoading={betaLoading || isLoading}
            />
          </div>

          {/* Pinned Controls */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <AnimatePresence mode="popLayout">
              {pinnedControls.map(controlId => (
                <PinnedControlCard
                  key={controlId}
                  controlId={controlId}
                  onUnpin={handleUnpin}
                  badge={getControlBadge(controlId)}
                >
                  {renderControlContent(controlId)}
                </PinnedControlCard>
              ))}
            </AnimatePresence>

            {/* Add Control Button */}
            <AddControlButton
              unpinnedControls={unpinnedControls}
              onPin={handlePin}
            />
          </div>

          {/* Tip */}
          {pinnedControls.length === 0 && (
            <div className="glass-card text-center py-8 text-surface-400">
              <Pin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Pin controls you use frequently</p>
              <p className="text-[10px]">They'll stay visible while you adjust the simulation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BetaDashboard;
