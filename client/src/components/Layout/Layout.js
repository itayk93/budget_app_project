import React, { useState, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import './Layout.css';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const stockActionsRef = useRef({});

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const handleStockAction = (action) => {
    // Only handle stock actions when we're on the stocks page
    if (location.pathname === '/stocks' && stockActionsRef.current[action]) {
      stockActionsRef.current[action]();
    }
  };

  const registerStockActions = (actions) => {
    stockActionsRef.current = actions;
  };

  return (
    <div className="layout">
      <Header onToggleSidebar={toggleSidebar} />
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={closeSidebar} 
        onStockAction={handleStockAction}
      />
      
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={closeSidebar}
        />
      )}
      
      <main className="main-content">
        <div className="container">
          <Outlet context={{ onAction: registerStockActions }} />
        </div>
      </main>
    </div>
  );
};

export default Layout;