import { useState, useCallback, useMemo } from 'react';
import { useForecast } from '../contexts/ForecastContext';
import { MONTHS, MS_MODES } from '../utils/constants';

const DEFAULT_SIM_PARAMS = {
  ms_mode: MS_MODES.RELATIVE,
  ms_params: { delta: 0 },
  promo_settings: { 
    month: null, 
    pct: 0, 
    spill_enabled: true, 
    spill_pct: 10 
  },
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
};

export function useSimulation() {
  const {
    selectedProduct,
    selectedYear,
    currentBaseline,
    weights,
    marketShareData,
    lockedEvents,
    runSimulation,
    simulationResult,
    isLoading,
  } = useForecast();

  const [params, setParams] = useState(DEFAULT_SIM_PARAMS);
  const [lastRunParams, setLastRunParams] = useState(null);

  // Check if simulation needs to run
  const needsUpdate = useMemo(() => {
    if (!lastRunParams) return true;
    return JSON.stringify(params) !== JSON.stringify(lastRunParams);
  }, [params, lastRunParams]);

  // Update single param category
  const updateParams = useCallback((category, updates) => {
    setParams(prev => ({
      ...prev,
      [category]: typeof updates === 'function' 
        ? updates(prev[category]) 
        : { ...prev[category], ...updates },
    }));
  }, []);

  // Update toggle
  const updateToggle = useCallback((key, value) => {
    setParams(prev => ({
      ...prev,
      toggle_settings: {
        ...prev.toggle_settings,
        [key]: value,
      },
    }));
  }, []);

  // Reset to defaults
  const resetParams = useCallback(() => {
    setParams(DEFAULT_SIM_PARAMS);
  }, []);

  // Run simulation
  const simulate = useCallback(async () => {
    if (!selectedProduct || !selectedYear || currentBaseline.length === 0) {
      return null;
    }

    const result = await runSimulation(params);
    setLastRunParams({ ...params });
    return result;
  }, [selectedProduct, selectedYear, currentBaseline, params, runSimulation]);

  // Computed values
  const simulated = simulationResult?.simulated || [];
  const multipliers = simulationResult?.final_multipliers || {};
  const appliedDetails = simulationResult?.applied_details || {};
  const msAdjustments = simulationResult?.ms_adjustments || {};
  const exceededMonths = simulationResult?.exceeded_months || [];

  return {
    params,
    setParams,
    updateParams,
    updateToggle,
    resetParams,
    simulate,
    needsUpdate,
    isLoading,
    // Results
    simulated,
    multipliers,
    appliedDetails,
    msAdjustments,
    exceededMonths,
    // Raw result
    simulationResult,
  };
}