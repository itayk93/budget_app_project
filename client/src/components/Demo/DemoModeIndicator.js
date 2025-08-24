import React from 'react';
import { useDemo } from '../../contexts/DemoContext';
import './DemoModeIndicator.css';

const DemoModeIndicator = () => {
  const { isDemoMode, exitDemoMode } = useDemo();

  if (!isDemoMode) return null;

  return (
    <div className="demo-mode-indicator">
      <div className="demo-banner">
        <div className="demo-content">
          <div className="demo-info">
            <span className="demo-icon">👁️</span>
            <span className="demo-text">
              מצב דוגמה - הנתונים אינם אמיתיים
            </span>
          </div>
          <button 
            className="demo-exit-button"
            onClick={exitDemoMode}
            title="חזור למשתמש רגיל"
          >
            יציאה ממצב דוגמה
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoModeIndicator;