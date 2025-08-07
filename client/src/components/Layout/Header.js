import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Header.css';

const Header = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-right">
          <button 
            className="sidebar-toggle"
            onClick={onToggleSidebar}
            aria-label="פתח תפריט"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>

        <div className="header-left">
          <div className="user-menu">
            <button 
              className="logout-btn"
              onClick={logout}
              title="התנתק"
            >
              יציאה
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;