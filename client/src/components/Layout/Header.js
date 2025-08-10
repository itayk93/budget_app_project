import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import TransactionSearchModal from '../TransactionSearchModal/TransactionSearchModal';
import './Header.css';

const Header = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

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
          <button 
            className="search-toggle"
            onClick={() => setIsSearchModalOpen(true)}
            aria-label="חיפוש עסקאות"
          >
            <i className="fas fa-search"></i>
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
      
      <TransactionSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
    </header>
  );
};

export default Header;