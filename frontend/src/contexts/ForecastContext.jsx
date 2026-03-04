import { createContext, useContext, useState, useCallback, useReducer } from 'react';
import { forecastService } from '../services/forecastService';
import { MONTHS, MS_MODES, EVENT_TYPES } from '../utils/constants';

const ForecastContext = createContext(null);

// Initial state for locked events
const initialLockedEvents = {
  [EVENT_TYPES.PROMO]: [],
  [EVENT_TYPES.SHORTAGE]: [],
  [EVENT_TYPES.REGULATION]: [],
  [EVENT_TYPES.CUSTOM]: [],
};

// Reducer for locked events
function lockedEventsReducer(state, action) {
  switch (action.type) {
    case 'ADD_EVENT': {
      const { eventType, event } = action.payload;
      return {
        ...state,
        [eventType]: [...state[eventType], event],
      };
    }
    case 'REMOVE_EVENT': {
      const { eventType, month } = action.payload;
      return {
        ...state,
        [eventType]: state[eventType].filter(e => e.month !== month),
      };
    }
    case 'CLEAR_TYPE': {
      const { eventType } = action.payload;
      return {
        ...state,
        [eventType]: [],
      };
    }
    case 'CLEAR_ALL':
      return initialLockedEvents;
    case 'SET_ALL':
      return action.payload;
    default:
      return state;
  }
}

export function ForecastProvider({ children }) {
  // Product and data state
  const [products, setProducts] = useState([]);
  const [apsClasses, setApsClasses] = useState({});
  const [selectedProduct, setSelectedProductState] = useState(null);
  const [selectedAps, setSelectedAps] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);

  // Data state
  const [baselineData, setBaselineData] = useState({});
  const [actualsData, setActualsData] = useState({});
  const [deliveredData, setDeliveredData] = useState({});
  const [weights, setWeights] = useState({});
  const [marketShareData, setMarketShareData] = useState({});

  // Data metadata (upload dates, etc.)
  const [dataMetadata, setDataMetadata] = useState({});

  // Simulation state
  const [simulationResult, setSimulationResult] = useState(null);
  const [lockedEvents, dispatchLockedEvents] = useReducer(lockedEventsReducer, initialLockedEvents);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Custom setter for selected product - resets APS and Year when product changes
  const setSelectedProduct = useCallback((product) => {
    setSelectedProductState((prevProduct) => {
      // Only reset if actually changing to a different product
      if (prevProduct !== product) {
        setSelectedAps(null); // Reset to "All Classes"
        setSelectedYear(null); // Reset year
        setSimulationResult(null); // Clear simulation
        setBaselineData({}); // Clear data
        setActualsData({});
        setDeliveredData({});
        setAvailableYears([]);
      }
      return product;
    });
  }, []);

  // Load data metadata
  const loadDataMetadata = useCallback(async () => {
    try {
      const response = await forecastService.getDataMetadata();
      if (response.success) {
        setDataMetadata(response.metadata || {});
      }
    } catch (err) {
      console.log('[DEBUG] Failed to load data metadata:', err);
      // Don't set error - metadata is optional
    }
  }, []);

  // Load products
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await forecastService.getProducts();
      setProducts(response.products);
      setApsClasses(response.aps_classes);

      // Also load data metadata
      loadDataMetadata();

      // Select first product by default
      if (response.products.length > 0) {
        // Use the state setter directly here to avoid the reset logic on initial load
        setSelectedProductState((current) => current || response.products[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [loadDataMetadata]);

  // Load product data
  const loadProductData = useCallback(async (product, apsClass = null) => {
    if (!product) return;
    
    setIsLoading(true);
    setError(null);
    
    // Clean apsClass - treat empty string or 'null' string as null
    const cleanApsClass = (apsClass === '' || apsClass === 'null' || apsClass === 'undefined') 
      ? null 
      : apsClass;
    
    console.log('[DEBUG] loadProductData called:', { product, apsClass, cleanApsClass });
    
    try {
      const response = await forecastService.getProductData(product, cleanApsClass);
      
      console.log('[DEBUG] getProductData response:', response);
      
      setBaselineData(response.baseline || {});
      setActualsData(response.actuals || {});
      setDeliveredData(response.delivered || {});
      setWeights(response.weights || {});
      setMarketShareData(response.market_share || {});
      setAvailableYears(response.available_years || []);
      
      // Select most recent year by default
      if (response.available_years?.length > 0) {
        setSelectedYear(response.available_years[0]);
        console.log('[DEBUG] Set selectedYear to:', response.available_years[0]);
      } else {
        console.log('[DEBUG] No available years in response');
        setSelectedYear(null);
      }
    } catch (err) {
      console.error('[DEBUG] loadProductData error:', err);
      setError(err.response?.data?.message || 'Failed to load product data');
      // Reset data on error
      setBaselineData({});
      setActualsData({});
      setDeliveredData({});
      setAvailableYears([]);
      setSelectedYear(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Run simulation
  const runSimulation = useCallback(async (params) => {
    if (!selectedProduct || !selectedYear) {
      console.log('[DEBUG] runSimulation skipped - no product or year:', { selectedProduct, selectedYear });
      return null;
    }
    
    const baselineVals = baselineData[selectedYear] || [];
    
    // Don't run simulation if no baseline data
    if (baselineVals.length === 0) {
      console.log('[DEBUG] runSimulation skipped - no baseline data');
      return null;
    }
    
    setIsLoading(true);
    try {
      console.log('[DEBUG] Running simulation:', { 
        selectedProduct, 
        selectedYear, 
        baselineVals: baselineVals.slice(0, 3),
        params 
      });
      
      const response = await forecastService.simulate({
        baseline_vals: baselineVals,
        weights,
        market_share_data: marketShareData,
        selected_year: selectedYear,
        locked_events: lockedEvents,
        ...params,
      });
      
      console.log('[DEBUG] Simulation response:', response);
      setSimulationResult(response);
      return response;
    } catch (err) {
      console.error('[DEBUG] Simulation error:', err);
      setError(err.response?.data?.message || 'Simulation failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [selectedProduct, selectedYear, baselineData, weights, marketShareData, lockedEvents]);

  // Locked events actions
  const addLockedEvent = useCallback((eventType, event) => {
    dispatchLockedEvents({
      type: 'ADD_EVENT',
      payload: { eventType, event },
    });
  }, []);

  const removeLockedEvent = useCallback((eventType, month) => {
    dispatchLockedEvents({
      type: 'REMOVE_EVENT',
      payload: { eventType, month },
    });
  }, []);

  const clearLockedEvents = useCallback((eventType = null) => {
    if (eventType) {
      dispatchLockedEvents({ type: 'CLEAR_TYPE', payload: { eventType } });
    } else {
      dispatchLockedEvents({ type: 'CLEAR_ALL' });
    }
  }, []);

  // Get current baseline values for selected year
  const currentBaseline = baselineData[selectedYear] || [];
  const currentActuals = actualsData[selectedYear] || null;
  const currentDelivered = deliveredData[selectedYear] || null;

  // Get data date for current product
  const getDataDate = useCallback(() => {
    if (!selectedProduct) return null;

    // Check product-specific date first
    const productMeta = dataMetadata?.products?.[selectedProduct];
    if (productMeta?.baseline_data_date) {
      return productMeta.baseline_data_date;
    }

    // Fall back to global baseline date
    return dataMetadata?.baseline_data_date || null;
  }, [selectedProduct, dataMetadata]);

  const currentDataDate = getDataDate();

  // Get analysis month from metadata (set by admin in DevMode)
  const analysisMonth = dataMetadata?.analysis_month ?? null; // 0-11
  const analysisYear = dataMetadata?.analysis_year ?? null;

  const value = {
    // Product state
    products,
    apsClasses,
    selectedProduct,
    selectedAps,
    selectedYear,
    availableYears,

    // Data
    baselineData,
    actualsData,
    deliveredData,
    weights,
    marketShareData,
    currentBaseline,
    currentActuals,
    currentDelivered,

    // Data metadata
    dataMetadata,
    currentDataDate,
    analysisMonth,
    analysisYear,

    // Simulation
    simulationResult,
    lockedEvents,

    // UI state
    isLoading,
    error,

    // Actions
    setSelectedProduct,
    setSelectedAps,
    setSelectedYear,
    loadProducts,
    loadProductData,
    loadDataMetadata,
    runSimulation,
    addLockedEvent,
    removeLockedEvent,
    clearLockedEvents,
    clearError: () => setError(null),
  };

  return (
    <ForecastContext.Provider value={value}>
      {children}
    </ForecastContext.Provider>
  );
}

export function useForecast() {
  const context = useContext(ForecastContext);
  if (!context) {
    throw new Error('useForecast must be used within a ForecastProvider');
  }
  return context;
}