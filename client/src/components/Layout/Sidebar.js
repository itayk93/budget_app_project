import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

const menuItems = [
  {
    path: '/dashboard',
    label: 'דשבורד',
    icon: '📊'
  },
  {
    path: '/stocks',
    label: 'תיק מניות',
    icon: '📈',
    hasSubmenu: true,
    submenu: [
      {
        path: '/stocks',
        label: 'דשבורד תיק',
        icon: '💼'
      },
      {
        action: 'update-prices',
        label: 'עדכן נתוני מניות',
        icon: '🔄'
      },
      {
        action: 'monthly-chart',
        label: 'גרף ביצועים חודשי',
        icon: '📊'
      },
      {
        action: 'upload-screenshot',
        label: 'העלאת צילום מסך Blink',
        icon: '📸'
      },
      {
        action: 'manual-entry',
        label: 'רשומה ידנית',
        icon: '✏️'
      }
    ]
  },
  {
    path: '/cash-flow',
    label: 'דשבורד תזרים',
    icon: '💰'
  },
  {
    path: '/transactions',
    label: 'תנועות',
    icon: '💳'
  },
  {
    path: '/upload',
    label: 'העלאת קבצים',
    icon: '📁'
  },
  {
    path: '/reports',
    label: 'דוחות',
    icon: '📋'
  },
  {
    path: '/categories',
    label: 'קטגוריות',
    icon: '📂',
    hasSubmenu: true,
    submenu: [
      {
        path: '/category-order',
        label: 'סדר קטגוריות',
        icon: '🔧'
      },
      {
        path: '/category-mappings',
        label: 'ניהול קטגוריות חברות',
        icon: '🏢'
      },
      {
        path: '/business-category-intelligence',
        label: 'אינטליגנציה לקטגוריות',
        icon: '🧠'
      }
    ]
  },
  {
    path: '/subscriptions',
    label: 'מנויים',
    icon: '🔄'
  },
  {
    path: '/budgetlens-comparison',
    label: 'השוואת BudgetLens',
    icon: '🔍'
  },
  {
    path: '/profile',
    label: 'פרופיל',
    icon: '👤'
  }
];

const Sidebar = ({ isOpen, onClose, onStockAction }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState({});

  const toggleSubmenu = (itemPath, e) => {
    e.preventDefault();
    setExpandedMenus(prev => ({
      ...prev,
      [itemPath]: !prev[itemPath]
    }));
  };

  const handleActionClick = (action, e) => {
    e.preventDefault();
    if (onStockAction) {
      onStockAction(action);
    }
  };

  // Check if current path is under stocks or categories
  const isStocksSection = location.pathname.startsWith('/stocks');
  const isCategoriesSection = location.pathname.startsWith('/category');

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-top">
          </div>
          
          {/* Logo - only visible on mobile */}
          <div className="sidebar-logo">
            <img 
              src="/logo.svg" 
              alt="BudgetLens" 
              className="sidebar-logo-image"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <span className="sidebar-logo-text" style={{ display: 'none' }}>
              BudgetLens
            </span>
          </div>
          
          <div className="user-info">
            <div className="user-avatar">
              {user?.firstName?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </div>
            <div className="user-details">
              <div className="user-name">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="user-email">
                <span>{user?.email}</span>
                <button className="sidebar-close" onClick={onClose} aria-label="סגור תפריט">
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <ul className="nav-list">
            {menuItems.map((item) => (
              <li key={item.path || item.label}>
                {item.hasSubmenu ? (
                  <>
                    <div
                      className={`nav-link nav-link-with-submenu ${
                        (item.path === '/stocks' && isStocksSection) || 
                        (item.path === '/categories' && isCategoriesSection) 
                          ? 'nav-link-active' : ''
                      }`}
                      onClick={(e) => toggleSubmenu(item.path, e)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-label">{item.label}</span>
                      <span className={`submenu-arrow ${
                        expandedMenus[item.path] || 
                        (item.path === '/stocks' && isStocksSection) || 
                        (item.path === '/categories' && isCategoriesSection) 
                          ? 'expanded' : ''
                      }`}>
                        ▼
                      </span>
                    </div>
                    <ul className={`submenu ${
                      expandedMenus[item.path] || 
                      (item.path === '/stocks' && isStocksSection) || 
                      (item.path === '/categories' && isCategoriesSection) 
                        ? 'submenu-open' : ''
                    }`}>
                      {item.submenu.map((subItem) => (
                        <li key={subItem.path || subItem.action}>
                          {subItem.path ? (
                            <NavLink
                              to={subItem.path}
                              className={({ isActive }) => 
                                `nav-link nav-sublink ${isActive ? 'nav-link-active' : ''}`
                              }
                              onClick={onClose}
                            >
                              <span className="nav-icon">{subItem.icon}</span>
                              <span className="nav-label">{subItem.label}</span>
                            </NavLink>
                          ) : (
                            <button
                              className="nav-link nav-sublink nav-action"
                              onClick={(e) => handleActionClick(subItem.action, e)}
                            >
                              <span className="nav-icon">{subItem.icon}</span>
                              <span className="nav-label">{subItem.label}</span>
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => 
                      `nav-link ${isActive ? 'nav-link-active' : ''}`
                    }
                    onClick={onClose}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="logo">
            <img 
              src="/logo.svg" 
              alt="BudgetLens" 
              className="logo-image"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <span className="logo-text" style={{ display: 'none' }}>
              BudgetLens
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;