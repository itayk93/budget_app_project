import React, { useState, useEffect } from 'react';
import { useDemo } from '../../contexts/DemoContext';
import LoadingSpinner from '../Common/LoadingSpinner';
import CategoryCard from '../CategoryCard/CategoryCard';
import CategoryGroupCard from '../CategoryGroupCard/CategoryGroupCard';
import DemoModeIndicator from './DemoModeIndicator';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
} from 'chart.js';
import { Bar as ChartJSBar } from 'react-chartjs-2';
import '../../pages/Dashboard/Dashboard.css'; // Reuse existing dashboard styles
import './DemoDashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement
);

const DemoDashboard = () => {
  const { fetchDemoData } = useDemo();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCashFlow, setSelectedCashFlow] = useState(null);
  const [activeTab, setActiveTab] = useState('monthly');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Fetch demo dashboard data
  useEffect(() => {
    const loadDemoData = async () => {
      try {
        setLoading(true);
        const data = await fetchDemoData('dashboard', {
          year: year,
          month: month,
          cash_flow: selectedCashFlow?.id || 'demo-cash-flow-id',
          all_time: activeTab === 'cumulative' ? '1' : '0'
        });
        
        setDashboardData(data);
        
        // Set default cash flow if not set
        if (!selectedCashFlow && data.cash_flows?.[0]) {
          setSelectedCashFlow(data.cash_flows[0]);
        }
      } catch (error) {
        console.error('Failed to load demo dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDemoData();
  }, [fetchDemoData, year, month, selectedCashFlow?.id, activeTab]);

  // Add body class for demo mode styling
  useEffect(() => {
    document.body.classList.add('demo-mode');
    return () => {
      document.body.classList.remove('demo-mode');
    };
  }, []);

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const formatCurrency = (amount, currency = 'ILS') => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      amount = 0;
    }
    
    const numericAmount = Number(amount);
    const symbol = currency === 'ILS' ? '₪' : currency;
    
    return `${numericAmount.toLocaleString('he-IL')} ${symbol}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
  };

  const getMonthName = (date) => {
    return date.toLocaleDateString('he-IL', { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  const formatMonth = (date) => {
    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return months[date.getMonth()];
  };

  const calculateSummary = () => {
    if (!dashboardData?.summary) {
      return { income: 0, expenses: 0, net: 0 };
    }

    const { total_income, total_expenses, net_balance } = dashboardData.summary;
    
    return { 
      income: total_income || 0, 
      expenses: Math.abs(total_expenses || 0), 
      net: net_balance || 0 
    };
  };

  // Group categories for display
  const groupCategories = (categories) => {
    const grouped = {};
    const standalone = [];

    categories.forEach(categoryData => {
      if (categoryData.is_shared_category) {
        standalone.push(categoryData);
        return;
      }

      if (categoryData.shared_category) {
        const parentExists = categories.find(c => 
          c.name === categoryData.shared_category && c.is_shared_category
        );
        
        if (parentExists) {
          return;
        } else {
          if (!grouped[categoryData.shared_category]) {
            grouped[categoryData.shared_category] = [];
          }
          grouped[categoryData.shared_category].push(categoryData);
        }
      } else {
        standalone.push(categoryData);
      }
    });

    return { grouped, standalone };
  };

  // Demo-specific data change handler (read-only)
  const handleDataChange = () => {
    console.log('🎭 Demo mode - data changes are read-only');
    // Show a subtle notification that this is demo mode
    // Could implement a toast notification here
  };

  if (loading) {
    return (
      <div className="loading">
        <DemoModeIndicator />
        <LoadingSpinner size="large" text="טוען נתוני דמה..." />
      </div>
    );
  }

  const summary = calculateSummary();

  return (
    <div className={`dashboard demo-dashboard ${showMonthPicker ? 'modal-open' : ''}`}>
      <DemoModeIndicator />
      
      {/* Mobile Only Controls */}
      <div className="mobile-dashboard-controls">
        <button 
          className={`mobile-control-btn month-select-btn ${showMonthPicker ? 'expanded' : ''}`} 
          onClick={() => setShowMonthPicker(!showMonthPicker)}
        >
          <div className="btn-content">
            <span className="btn-icon">📅</span>
            <span className="btn-text">{formatMonth(currentDate)} {year}</span>
            <span className={`btn-arrow ${showMonthPicker ? 'rotated' : ''}`}>▼</span>
          </div>
        </button>
      </div>

      {/* Month Selector Panel */}
      {showMonthPicker && (
        <div className="month-selector-panel show">
          <div className="mobile-flow-selector">
            <label className="flow-selector-label">תזרים דמה:</label>
            <select
              className="mobile-flow-select"
              value={selectedCashFlow?.id || ''}
              disabled
            >
              <option value="demo-cash-flow-id">תזרים אישי - דוגמה</option>
            </select>
          </div>

          <div className="mobile-month-navigation">
            <button className="mobile-nav-arrow next" onClick={() => navigateMonth(1)}>→</button>
            <div className="mobile-current-month">
              <span className="mobile-month-name">{formatMonth(currentDate)}</span>
              <span className="mobile-year-name">{currentDate.getFullYear()}</span>
            </div>
            <button className="mobile-nav-arrow prev" onClick={() => navigateMonth(-1)}>←</button>
          </div>

          <div className="mobile-view-tabs">
            <button 
              className={`mobile-tab-btn ${activeTab === 'monthly' ? 'active' : ''}`} 
              onClick={() => setActiveTab('monthly')}
            >
              חודשי
            </button>
            <button 
              className={`mobile-tab-btn ${activeTab === 'cumulative' ? 'active' : ''}`} 
              onClick={() => setActiveTab('cumulative')}
            >
              מצטבר
            </button>
          </div>
        </div>
      )}

      {/* Desktop Controls */}
      <div className="dashboard-controls">
        <select
          className="form-select"
          value={selectedCashFlow?.id || ''}
          disabled
        >
          <option value="demo-cash-flow-id">תזרים אישי - דוגמה</option>
        </select>
      </div>

      <div className="main-controls-row">
        <div className="dashboard-tabs">
          <button
            className={`tab-button ${activeTab === 'monthly' ? 'active' : ''}`}
            onClick={() => setActiveTab('monthly')}
          >
            חודשי
          </button>
          <button
            className={`tab-button ${activeTab === 'cumulative' ? 'active' : ''}`}
            onClick={() => setActiveTab('cumulative')}
          >
            מצטבר
          </button>
        </div>

        {activeTab === 'monthly' && (
          <div className="month-navigation-container">
            <div className="riseup-month-navigation">
              <button
                className="nav-arrow-button next"
                onClick={() => navigateMonth(-1)}
              >
                <span className="arrow-icon">→</span>
              </button>
              <div className="current-month-display">
                <span className="month-name">
                  {dashboardData?.hebrew_month_name || formatMonth(currentDate)}
                </span>
                <span className="year-name">{year}</span>
              </div>
              <button
                className="nav-arrow-button prev"
                onClick={() => navigateMonth(1)}
              >
                <span className="arrow-icon">←</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-content">
        {/* Monthly Balance Card */}
        <div className="balance-card-container">
          <div className="monthly-balance-card">
            <div className="balance-card-header">
              <div className="balance-question">
                כמה כסף נשאר להוציא החודש? (דמה)
              </div>
            </div>
            <div className="balance-amount">
              <span className="amount-value">{formatCurrency(summary.net)}</span>
            </div>
            <div className="balance-breakdown">
              <span className="balance-detail">
                הכנסות: {formatCurrency(summary.income)} | הוצאות: {formatCurrency(summary.expenses)}
              </span>
            </div>
          </div>
        </div>

        {/* Categories Display */}
        {dashboardData?.orderedCategories && dashboardData.orderedCategories.length > 0 && (
          <div className="dashboard-section">
            <div className="categories-container">
              {(() => {
                const { grouped, standalone } = groupCategories(dashboardData.orderedCategories);
                
                return (
                  <>
                    {/* Grouped Categories */}
                    {Object.entries(grouped).map(([groupName, categories]) => (
                      <CategoryGroupCard
                        key={groupName}
                        groupName={groupName}
                        categories={categories}
                        onCategoryClick={(categoryName) => {
                          console.log(`🎭 Demo: Category clicked: ${categoryName} (read-only)`);
                        }}
                        formatCurrency={formatCurrency}
                        formatDate={formatDate}
                        onDataChange={handleDataChange}
                        year={year}
                        month={month}
                        isDemoMode={true}
                      />
                    ))}
                    
                    {/* Standalone Categories */}
                    {standalone.map((categoryData, index) => (
                      <CategoryCard
                        key={`${categoryData.name}-${index}`}
                        categoryName={categoryData.name}
                        categoryData={categoryData}
                        formatCurrency={formatCurrency}
                        formatDate={formatDate}
                        onDataChange={handleDataChange}
                        year={year}
                        month={month}
                        isDemoMode={true}
                      />
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Demo Notice */}
        <div className="demo-notice">
          <div className="demo-notice-content">
            <h3>🎭 מצב דמה</h3>
            <p>
              זהו מסך דמה המציג את כל הפיצ'רים של BudgetLens עם נתונים סימולציה.
              במצב האמיתי תוכל לערוך, להוסיף ולמחוק עסקאות וקטגוריות.
            </p>
            <p>
              <strong>כל הנתונים כאן הם לצורך הדגמה בלבד ואינם אמיתיים.</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoDashboard;