import React, { createContext, useContext, useState, useEffect } from 'react';

const DemoContext = createContext();

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};

export const DemoProvider = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoData, setDemoData] = useState(null);

  // Check URL params or localStorage for demo mode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const demoParam = urlParams.get('demo');
    const demoModeFromStorage = localStorage.getItem('budgetlens-demo-mode');
    
    if (demoParam === 'true' || demoModeFromStorage === 'true') {
      setIsDemoMode(true);
    }
  }, []);

  // Save demo mode to localStorage
  useEffect(() => {
    if (isDemoMode) {
      localStorage.setItem('budgetlens-demo-mode', 'true');
      // Add demo mode to all API requests
      window.demoMode = true;
    } else {
      localStorage.removeItem('budgetlens-demo-mode');
      window.demoMode = false;
    }
  }, [isDemoMode]);

  const enterDemoMode = () => {
    console.log('🎭 Entering demo mode');
    setIsDemoMode(true);
    // Redirect to demo dashboard
    window.location.href = '/demo/dashboard';
  };

  const exitDemoMode = () => {
    console.log('🎭 Exiting demo mode');
    setIsDemoMode(false);
    localStorage.removeItem('budgetlens-demo-mode');
    window.demoMode = false;
    // Redirect to login or regular dashboard
    window.location.href = '/dashboard';
  };

  const fetchDemoData = async (endpoint, params = {}) => {
    try {
      const queryString = new URLSearchParams({
        ...params,
        demo: 'true'
      }).toString();
      
      const response = await fetch(`/api/demo/${endpoint}?${queryString}`, {
        headers: {
          'X-Demo-Mode': 'true'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Demo API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch demo data from ${endpoint}:`, error);
      throw error;
    }
  };

  const value = {
    isDemoMode,
    demoData,
    enterDemoMode,
    exitDemoMode,
    fetchDemoData,
    setDemoData
  };

  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
};

export default DemoContext;