import React, { createContext, useContext, useEffect, useState } from 'react';

type DesignVersion = 'legacy' | 'v2';

interface DesignVersionContextType {
  currentVersion: DesignVersion;
  setVersion: (version: DesignVersion) => void;
  isV2: boolean;
}

const DesignVersionContext = createContext<DesignVersionContextType | undefined>(undefined);

interface DesignVersionProviderProps {
  children: React.ReactNode;
}

export function DesignVersionProvider({ children }: DesignVersionProviderProps) {
  const [currentVersion, setCurrentVersion] = useState<DesignVersion>('legacy');

  useEffect(() => {
    // Order of precedence: URL params > localStorage > env var
    const urlParams = new URLSearchParams(window.location.search);
    const urlVersion = urlParams.get('design') as DesignVersion;
    const localStorageVersion = localStorage.getItem('design-version') as DesignVersion;
    const envVersion = (import.meta.env.VITE_DESIGN_VERSION || 'legacy') as DesignVersion;

    const version = urlVersion || localStorageVersion || envVersion;
    setCurrentVersion(version);

    // Set data attribute on html element for CSS targeting
    document.documentElement.setAttribute('data-design', version);
  }, []);

  const setVersion = (version: DesignVersion) => {
    setCurrentVersion(version);
    localStorage.setItem('design-version', version);
    document.documentElement.setAttribute('data-design', version);
    
    // Update URL if different from current
    const urlParams = new URLSearchParams(window.location.search);
    const currentUrlVersion = urlParams.get('design');
    
    if (currentUrlVersion !== version) {
      if (version === 'legacy') {
        urlParams.delete('design');
      } else {
        urlParams.set('design', version);
      }
      
      const newUrl = urlParams.toString() 
        ? `${window.location.pathname}?${urlParams.toString()}`
        : window.location.pathname;
      
      window.history.replaceState({}, '', newUrl);
    }
  };

  const value = {
    currentVersion,
    setVersion,
    isV2: currentVersion === 'v2'
  };

  return (
    <DesignVersionContext.Provider value={value}>
      {children}
    </DesignVersionContext.Provider>
  );
}

export function useDesignVersion() {
  const context = useContext(DesignVersionContext);
  if (context === undefined) {
    throw new Error('useDesignVersion must be used within a DesignVersionProvider');
  }
  return context;
}