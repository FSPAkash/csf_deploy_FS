import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Crosshair } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useForecast } from '../contexts/ForecastContext';
import { useTutorial } from '../contexts/TutorialContext';
import {
  GlassCard,
  Button,
  Spinner,
  Alert
} from '../components/common';
import Header from '../components/dashboard/Header';
import ForecastChart from '../components/chart/ForecastChart';
import ControlsPanel from '../components/controls/ControlsPanel';
import EffectToggles from '../components/controls/EffectToggles';
import SummaryMetrics from '../components/dashboard/SummaryMetrics';
import WarningModal from '../components/info/WarningModal';
import TutorialOverlay from '../components/tutorial/TutorialOverlay';
import ChatBot from '../components/chat/ChatBot';
import { TUTORIAL_STEPS } from '../config/tutorialSteps';
import { calculateSummaryStats, generateCSV, downloadFile } from '../utils/calculations';
import { MONTHS } from '../utils/constants';

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
          text-center min-w-[80px] px-3 py-1.5 rounded-lg
          transition-all duration-150
          hover:bg-white/50
          ${isOpen ? 'bg-white/50' : ''}
        `}
      >
        <span className="block text-[9px] uppercase tracking-wider text-surface-400 font-medium leading-none mb-1">
          {label}
        </span>
        <span className="block text-xs font-semibold text-daikin-dark leading-none">
          {displayValue}
        </span>
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.1 }}
          className="absolute top-full right-1/1 -translate-x-1/2 mt-2 min-w-[120px] z-50 
                     bg-white rounded-lg shadow-lg border border-surface-200
                     py-1 max-h-48 overflow-auto"
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
                  w-full px-3 py-1.5 text-left text-xs
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
              <p className="text-[12px] text-surface-600 text-center leading-tight">
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

function BreathingSelector({ children }) {
  const glowColor = {
    r: 0,
    g: 160,
    b: 228,
  };
  
  const intensity = {
    glowOpacity: 0.25,
    borderOpacity: 0.5,
    shadowOpacity: 0.9,
    shadowBlur: 100,
    maxOpacity: 0.6,
    scaleAmount: 1.5,
  };

  return (
    <div className="relative flex items-center justify-center gap-4 w-full px-4 py-2 rounded-xl bg-surface-50/50 border border-surface-200/50 overflow-visible">
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
        animate={{
          opacity: [0, 1, 0],
        }}
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

function Dashboard() {
  const navigate = useNavigate();
  const { user, logout, isAdmin, isBeta } = useAuth();
  const { startTutorial, validateStep, isActive: isTutorialActive, currentStep: tutorialStep } = useTutorial();
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
    currentDataDate,
    analysisMonth,
    analysisYear,
    weights,
    marketShareData,
    simulationResult,
    lockedEvents,
    isLoading,
    error,
    setSelectedProduct,
    setSelectedAps,
    setSelectedYear,
    loadProducts,
    loadProductData,
    runSimulation,
    clearError,
  } = useForecast();

  const [showBaseline, setShowBaseline] = useState(true);
  const [showDelivered, setShowDelivered] = useState(true);
  const [showActuals, setShowActuals] = useState(true);

  const [focusMonth, setFocusMonth] = useState(null);

  const [warningsEnabled, setWarningsEnabled] = useState(true);
  const [warningsDismissed, setWarningsDismissed] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);

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

  useEffect(() => {
    if (isTutorialActive && selectedProduct) {
      validateStep(1, true);
    }
  }, [selectedProduct, isTutorialActive, validateStep]);

  useEffect(() => {
    if (isTutorialActive && selectedAps !== undefined) {
      validateStep(2, true);
    }
  }, [selectedAps, isTutorialActive, validateStep]);

  useEffect(() => {
    if (isTutorialActive && lockedEvents.Promo && lockedEvents.Promo.length > 0) {
      validateStep(12, true);
    }
  }, [lockedEvents, isTutorialActive, validateStep]);

  useEffect(() => {
    if (isTutorialActive && tutorialStep === 7 && simParams.ms_mode === 'relative') {
      const timeout = setTimeout(() => {
        validateStep(7, true);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isTutorialActive, tutorialStep, simParams.ms_mode, validateStep]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (selectedProduct) {
      loadProductData(selectedProduct, selectedAps);
    }
  }, [selectedProduct, selectedAps, loadProductData]);

  useEffect(() => {
    if (!selectedProduct || !selectedYear || currentBaseline.length === 0) {
      return;
    }

    if (simulationTimeoutRef.current) {
      clearTimeout(simulationTimeoutRef.current);
    }

    simulationTimeoutRef.current = setTimeout(() => {
      runSimulation(simParams);
      setWarningsDismissed(false);
    }, 150);

    return () => {
      if (simulationTimeoutRef.current) {
        clearTimeout(simulationTimeoutRef.current);
      }
    };
  }, [selectedProduct, selectedYear, currentBaseline, simParams, lockedEvents, runSimulation]);

  const updateSimParams = useCallback((updates) => {
    setSimParams(prev => {
      const newParams = {
        ...prev,
        ...updates,
      };

      if (isTutorialActive) {
        if (updates.ms_mode) {
          validateStep(7, true);
        }
        if (updates.ms_params && updates.ms_params.delta !== undefined) {
          validateStep(8, true);
        }
        if (updates.promo_settings) {
          if (updates.promo_settings.month) {
            validateStep(10, true);
          }
          if (updates.promo_settings.pct !== undefined && updates.promo_settings.pct !== 0) {
            validateStep(11, true);
          }
        }
      }

      return newParams;
    });
  }, [isTutorialActive, validateStep]);

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

    const filename = `simulation_${selectedProduct}_${selectedAps || 'total'}_${selectedYear}.csv`;
    downloadFile(csv, filename);
  }, [simulationResult, selectedProduct, selectedAps, selectedYear, currentBaseline, simParams.ms_mode]);

  const handleToggleBaseline = useCallback((val) => {
    setShowBaseline(val);
    if (isTutorialActive) validateStep(5, true);
  }, [isTutorialActive, validateStep]);

  const handleToggleDelivered = useCallback((val) => {
    setShowDelivered(val);
    if (isTutorialActive) validateStep(5, true);
  }, [isTutorialActive, validateStep]);

  const handleToggleActuals = useCallback((val) => {
    setShowActuals(val);
    if (isTutorialActive) validateStep(5, true);
  }, [isTutorialActive, validateStep]);
  const handleWarningsChange = useCallback((e) => setWarningsEnabled(e.target.checked), []);
  const handleShowWarningModal = useCallback(() => setShowWarningModal(true), []);
  const handleCloseWarningModal = useCallback(() => setShowWarningModal(false), []);
  const handleDismissWarnings = useCallback(() => setWarningsDismissed(true), []);
  const handleNavigateToMSGuide = useCallback(() => navigate('/market-share-guide'), [navigate]);
  const handleNavigateToPromoGuide = useCallback(() => navigate('/promotion-guide'), [navigate]);
  const handleNavigateToRegulationGuide = useCallback(() => navigate('/regulation-guide'), [navigate]);
  const handleNavigateToDev = useCallback(() => navigate('/dev'), [navigate]);

  const handleEffectToggle = useCallback((key, value) => {
    updateSimParams({
      toggle_settings: {
        ...simParams.toggle_settings,
        [key]: value,
      },
    });
    if (isTutorialActive && key === 'trans') {
      validateStep(17, true);
    }
  }, [simParams.toggle_settings, updateSimParams, isTutorialActive, validateStep]);

  const scrollToPanel = useCallback((selector) => {
    const panel = document.querySelector(selector);
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      panel.classList.add('ring-2', 'ring-daikin-blue', 'ring-offset-2');
      setTimeout(() => {
        panel.classList.remove('ring-2', 'ring-daikin-blue', 'ring-offset-2');
      }, 2000);
    }
  }, []);

  const handleChatAction = useCallback((action) => {
    if (!action) return;

    switch (action.type) {
      case 'export':
        handleExport();
        break;
      case 'navigate':
        scrollToPanel(`[data-tutorial="${action.target}"]`);
        break;
      case 'start_tutorial':
        startTutorial();
        break;
      case 'adjust_market_share':
        if (action.value !== undefined) {
          updateSimParams({
            ms_mode: 'relative',
            ms_params: { delta: action.value },
          });
          scrollToPanel('[data-tutorial="market-share-panel"]');
        }
        break;
      case 'set_competitive_event':
        if (action.month && action.impact !== undefined) {
          updateSimParams({
            ms_mode: 'competitive',
            ms_params: {
              type: 'single',
              month: action.month,
              impact: action.impact,
              duration: action.duration || 1,
            },
          });
          scrollToPanel('[data-tutorial="market-share-panel"]');
        }
        break;
      case 'set_competitive_gradual':
        if (action.start_month && action.end_month && action.impact !== undefined) {
          updateSimParams({
            ms_mode: 'competitive',
            ms_params: {
              type: 'gradual',
              start_month: action.start_month,
              end_month: action.end_month,
              impact: action.impact,
            },
          });
          scrollToPanel('[data-tutorial="market-share-panel"]');
        }
        break;
      case 'set_competitive_recovery':
        if (action.start_month && action.initial_impact !== undefined) {
          updateSimParams({
            ms_mode: 'competitive',
            ms_params: {
              type: 'recovery',
              start_month: action.start_month,
              initial_impact: action.initial_impact,
              recovery_months: action.recovery_months || 3,
            },
          });
          scrollToPanel('[data-tutorial="market-share-panel"]');
        }
        break;
      default:
        console.log('Unknown chat action:', action);
    }
  }, [handleExport, startTutorial, updateSimParams, scrollToPanel]);

  const summaryStats = simulationResult
    ? calculateSummaryStats(simulationResult.simulated, currentBaseline)
    : null;

  const exceededMonths = simulationResult?.exceeded_months || [];
  const showWarnings = warningsEnabled && !warningsDismissed && exceededMonths.length > 0;

  const apsOptions = [
    { value: null, label: 'All Classes' },
    ...(apsClasses[selectedProduct] || []).map(aps => ({ value: aps, label: aps })),
  ];

  if (isLoading && !selectedProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      <Header
        user={user}
        isAdmin={isAdmin}
        isBeta={isBeta}
        onLogout={logout}
        onDevMode={handleNavigateToDev}
        onBetaDashboard={() => navigate('/beta')}
        onBeta2Dashboard={() => navigate('/beta2')}
        onStartTutorial={startTutorial}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <Alert type="error" onClose={clearError}>
              {error}
            </Alert>
          </motion.div>
        )}

        <div className="relative z-10">
          <GlassCard className="mb-6" padding="lg" style={{ minHeight: 520 }}>

            <div className="flex items-start justify-between mb-4 pb-4 border-b border-surface-200/50">

              <div className="flex flex-col items-start gap-2">
                <span className="text-[12px] uppercase tracking-wider text-black font-medium">
                  Make Product and Class Selection
                </span>

                <div className="flex items-center gap-4">
                  <BreathingSelector data-tutorial="product-selector">
                    <div data-tutorial="product-selector">
                      <CompactSelector
                        label="Product"
                        value={selectedProduct}
                        options={products}
                        onChange={setSelectedProduct}
                      />
                    </div>

                    <div className="w-px h-6 bg-surface-200 relative z-10" />

                    <div data-tutorial="aps-selector">
                      <CompactSelector
                        label="APS Class"
                        value={selectedAps}
                        options={apsOptions}
                        onChange={setSelectedAps}
                      />
                    </div>

                    <div className="w-px h-6 bg-surface-200 relative z-10" />

                    <div data-tutorial="year-selector">
                      <CompactSelector
                        label="Year"
                        value={selectedYear}
                        options={availableYears}
                        onChange={setSelectedYear}
                      />
                    </div>
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
              </div>
            </div>
            {isLoading ? (
              <div className="h-[380px] flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : (
              <div data-tutorial="forecast-chart">
                <ForecastChart
                  baseline={currentBaseline}
                  simulated={simulationResult?.simulated || []}
                  delivered={currentDelivered}
                  actuals={currentActuals}
                  exceededMonths={showWarnings ? exceededMonths : []}
                  product={selectedProduct}
                  apsClass={selectedAps}
                  year={selectedYear}
                  showBaseline={showBaseline}
                  showDelivered={showDelivered}
                  showActuals={showActuals}
                  onToggleBaseline={handleToggleBaseline}
                  onToggleDelivered={handleToggleDelivered}
                  onToggleActuals={handleToggleActuals}
                  dataDate={currentDataDate}
                  focusMonth={focusMonth}
                  appliedDetails={simulationResult?.applied_details || {}}
                />
              </div>
            )}

            <div className="h-12 flex items-center justify-between mt-4 pt-4 border-t border-surface-200/50">
              <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer" data-tutorial="warning-checkbox">
                <input
                  type="checkbox"
                  checked={warningsEnabled}
                  onChange={handleWarningsChange}
                  style={{ accentColor: '#00A0E4' }}
                  className="w-4 h-4 rounded"
                />
                Enable Warnings
              </label>

              {showWarnings ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShowWarningModal}
                    leftIcon={<Info className="h-4 w-4" />}
                  >
                    About
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismissWarnings}
                  >
                    Dismiss
                  </Button>
                </div>
              ) : (
                <div className="invisible flex items-center gap-2">
                  <Button variant="ghost" size="sm" leftIcon={<Info className="h-4 w-4" />}>
                    About
                  </Button>
                  <Button variant="ghost" size="sm">
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        <div className="relative z-20" style={{ minHeight: 280 }}>
          <ControlsPanel
            weights={weights}
            marketShareData={marketShareData}
            selectedYear={selectedYear}
            lockedEvents={lockedEvents}
            simParams={simParams}
            onUpdateParams={updateSimParams}
            onNavigateToMSGuide={handleNavigateToMSGuide}
            onNavigateToPromoGuide={handleNavigateToPromoGuide}
            onNavigateToRegulationGuide={handleNavigateToRegulationGuide}
          />
        </div>

        <div className="relative z-10 mt-6" style={{ minHeight: 80 }} data-tutorial="effect-toggles">
          <EffectToggles
            toggles={simParams.toggle_settings}
            onToggle={handleEffectToggle}
          />
        </div>

        <div className="relative z-0 mt-6" style={{ minHeight: 100 }} data-tutorial="summary-metrics">
          <SummaryMetrics
            stats={summaryStats}
            onExport={handleExport}
            isLoading={isLoading}
          />
        </div>
      </main>

      <WarningModal
        isOpen={showWarningModal}
        onClose={handleCloseWarningModal}
        isAdmin={isAdmin}
      />

      <TutorialOverlay steps={TUTORIAL_STEPS} />

      {!isTutorialActive && <ChatBot onAction={handleChatAction} />}
    </div>
  );
}

export default Dashboard;