import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { BRANDING_DEFAULTS, BRANDING_STORAGE_KEY } from '../config/branding';

const BrandingContext = createContext(null);

export function BrandingProvider({ children }) {
  const [showLogo, setShowLogo] = useLocalStorage(
    BRANDING_STORAGE_KEY,
    BRANDING_DEFAULTS.showLogo
  );

  const value = useMemo(() => ({
    ...BRANDING_DEFAULTS,
    showLogo,
    setShowLogo,
  }), [showLogo, setShowLogo]);

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);

  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }

  return context;
}

