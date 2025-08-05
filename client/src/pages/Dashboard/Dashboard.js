import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { transactionsAPI, budgetsAPI, categoriesAPI, cashFlowsAPI, monthlyGoalsAPI } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import CategoryCard from '../../components/CategoryCard/CategoryCard';
import MonthlyGoalModal from '../../components/MonthlyGoalModal/MonthlyGoalModal';
import api from '../../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCashFlow, setSelectedCashFlow] = useState(null);
  const [activeTab, setActiveTab] = useState('monthly');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const queryClient = useQueryClient();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Fetch dashboard data using the new API
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery(
    ['dashboard', year, month, selectedCashFlow?.id, activeTab],
    () => api.get('/dashboard', {
      params: {
        year: year,
        month: month,
        cash_flow: selectedCashFlow?.id,
        all_time: activeTab === 'cumulative' ? '1' : '0',
        format: 'json'
      }
    }),
    {
      enabled: !!selectedCashFlow,
      staleTime: 30000 // 30 seconds
    }
  );

  // Fetch cash flows separately for initial load
  const { data: cashFlows, isLoading: cashFlowsLoading } = useQuery(
    'cashFlows',
    cashFlowsAPI.getAll
  );

  // Fetch monthly balance data for chart and month picker
  const { data: monthlyBalanceData, isLoading: monthlyBalanceLoading } = useQuery(
    ['monthlyBalance', selectedCashFlow?.id],
    () => api.get('/reports/monthly-balance', {
      params: {
        cash_flow_id: selectedCashFlow?.id
      }
    }),
    {
      enabled: !!selectedCashFlow,
      staleTime: 60000 // 1 minute
    }
  );

  // Fetch monthly goal data
  const { data: monthlyGoalData, isLoading: monthlyGoalLoading } = useQuery(
    ['monthlyGoal', year, month, selectedCashFlow?.id],
    () => monthlyGoalsAPI.get(year, month, selectedCashFlow?.id),
    {
      enabled: !!selectedCashFlow,
      staleTime: 30000 // 30 seconds
    }
  );

  // Set default cash flow and tab
  useEffect(() => {
    if (cashFlows && !selectedCashFlow) {
      const defaultCashFlow = cashFlows.find(cf => cf.is_default) || cashFlows[0];
      setSelectedCashFlow(defaultCashFlow);
      
      // Set initial tab based on is_monthly field
      if (defaultCashFlow) {
        setActiveTab(defaultCashFlow.is_monthly ? 'monthly' : 'cumulative');
      }
    }
  }, [cashFlows, selectedCashFlow]);

  // Update tab when cash flow changes
  useEffect(() => {
    if (selectedCashFlow) {
      setActiveTab(selectedCashFlow.is_monthly ? 'monthly' : 'cumulative');
    }
  }, [selectedCashFlow]);

  // Force refresh all monthly targets (initial setup)
  const forceRefreshAllTargets = async () => {
    try {
      console.log('Force refreshing all monthly targets...');
      const refreshResponse = await api.post('/categories/refresh-monthly-targets', { force: true });
      
      if (refreshResponse.updated) {
        console.log(`Monthly targets updated: ${refreshResponse.updatedCount}/${refreshResponse.totalCategories} categories`);
        
        // Refresh dashboard data to show updated targets
        setTimeout(() => {
          refetchDashboard();
          // Also invalidate the query cache to ensure fresh data
          queryClient.invalidateQueries(['dashboard']);
          queryClient.invalidateQueries(['monthlyBalance']);
          // Force refetch all cached data
          queryClient.refetchQueries();
        }, 1000);
        
        alert(`עודכנו יעדים חודשיים עבור ${refreshResponse.updatedCount} קטגוריות!`);
      } else {
        alert('היעדים כבר עדכניים או שאין נתונים מספיקים');
      }
    } catch (error) {
      console.error('Error force refreshing monthly targets:', error);
      alert('שגיאה בעדכון היעדים החודשיים');
    }
  };

  // Check and refresh monthly targets on first visit of new month
  useEffect(() => {
    const checkAndRefreshTargets = async () => {
      try {
        console.log('Checking if monthly targets should be refreshed...');
        const shouldRefreshResponse = await categoriesAPI.shouldRefreshTargets();
        
        if (shouldRefreshResponse.should_refresh) {
          console.log('Refreshing monthly targets for new month...');
          const refreshResponse = await categoriesAPI.refreshMonthlyTargets();
          
          if (refreshResponse.updated) {
            console.log(`Monthly targets updated: ${refreshResponse.updatedCount}/${refreshResponse.totalCategories} categories`);
            
            // Optionally show a subtle notification to the user
            // You could add a toast notification here if you have a toast system
            
            // Refresh dashboard data to show updated targets
            setTimeout(() => {
              refetchDashboard();
            }, 1000);
          }
        } else {
          console.log('Monthly targets are up to date');
        }
      } catch (error) {
        console.error('Error checking/refreshing monthly targets:', error);
        // Fail silently to not disrupt user experience
      }
    };

    // Only check when we have a selected cash flow (i.e., user is logged in and data is loaded)
    if (selectedCashFlow) {
      checkAndRefreshTargets();
    }
  }, [selectedCashFlow, refetchDashboard]);

  // Close modals when pressing escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (showMonthPicker) {
          setShowMonthPicker(false);
        }
        if (showChartModal) {
          setShowChartModal(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showMonthPicker, showChartModal]);

  // Create chart when modal opens
  useEffect(() => {
    if (showChartModal && monthlyBalanceData?.months) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        createBalanceChart();
      }, 100);
    }
    
    // Cleanup when modal closes
    return () => {
      if (window.balanceChart) {
        window.balanceChart.destroy();
        window.balanceChart = null;
      }
    };
  }, [showChartModal, monthlyBalanceData]);

  const createBalanceChart = () => {
    const canvas = document.getElementById('monthlyBalanceChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    if (window.balanceChart) {
      window.balanceChart.destroy();
    }

    const chartData = monthlyBalanceData.months
      .filter(m => m.has_transactions)
      .sort((a, b) => a.month.localeCompare(b.month));

    console.log('Chart data:', chartData); // Debug log

    const labels = chartData.map(item => {
      const [year, month] = item.month.split('-');
      const monthNames = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    });

    const balanceData = chartData.map(item => item.balance);
    const colors = balanceData.map(balance => balance >= 0 ? '#4CAF50' : '#f44336');
    const borderColors = balanceData.map(balance => balance >= 0 ? '#388E3C' : '#d32f2f');

    // Create chart using basic canvas drawing (since Chart.js might not be available)
    const drawChart = () => {
      const padding = 60;
      const chartWidth = canvas.width - (padding * 2);
      const chartHeight = canvas.height - (padding * 2);
      
      // Clear canvas
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      if (chartData.length === 0) {
        // Draw "no data" message
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('אין נתונים להצגה', canvas.width / 2, canvas.height / 2);
        return;
      }
      
      // Draw title
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`מאזן חודשי - ${chartData.length} חודשים`, canvas.width / 2, 25);
      
      // Find min and max values
      const maxValue = Math.max(...balanceData, 0);
      const minValue = Math.min(...balanceData, 0);
      const range = maxValue - minValue || 1;
      
      // Draw grid lines
      ctx.strokeStyle = '#e1e5e9';
      ctx.lineWidth = 1;
      
      // Horizontal grid lines
      for (let i = 0; i <= 5; i++) {
        const y = padding + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + chartWidth, y);
        ctx.stroke();
      }
      
      // Vertical grid lines (only for significant points)
      const gridStep = Math.max(1, Math.floor(chartData.length / 6));
      for (let i = 0; i < chartData.length; i += gridStep) {
        const x = padding + (chartWidth / chartData.length) * (i + 0.5);
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, padding + chartHeight);
        ctx.stroke();
      }
      
      // Draw zero line
      const zeroY = padding + chartHeight - ((0 - minValue) / range) * chartHeight;
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, zeroY);
      ctx.lineTo(padding + chartWidth, zeroY);
      ctx.stroke();
      
      // Draw bars
      const barWidth = Math.max(8, chartWidth / chartData.length * 0.7);
      chartData.forEach((item, index) => {
        const x = padding + (chartWidth / chartData.length) * index + (chartWidth / chartData.length - barWidth) / 2;
        const barHeight = Math.abs(item.balance) / range * chartHeight;
        const y = item.balance >= 0 ? zeroY - barHeight : zeroY;
        
        ctx.fillStyle = item.balance >= 0 ? '#4CAF50' : '#f44336';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Draw value on top of bar (only if space allows)
        if (chartData.length <= 12) {
          ctx.fillStyle = '#333';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          const valueY = item.balance >= 0 ? y - 5 : y + barHeight + 15;
          ctx.fillText(formatCurrency(item.balance), x + barWidth / 2, valueY);
        }
      });
      
      // Draw labels (show every nth label to avoid overlap)
      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      const labelStep = Math.max(1, Math.floor(chartData.length / 8));
      chartData.forEach((item, index) => {
        if (index % labelStep === 0 || index === chartData.length - 1) {
          const x = padding + (chartWidth / chartData.length) * index + (chartWidth / chartData.length) / 2;
          const [year, month] = item.month.split('-');
          const monthNames = ['ינ', 'פב', 'מר', 'אפ', 'מא', 'יו', 'יל', 'אג', 'ספ', 'אק', 'נו', 'דצ'];
          ctx.fillText(`${monthNames[parseInt(month) - 1]} ${year.slice(-2)}`, x, padding + chartHeight + 20);
        }
      });
      
      // Draw y-axis labels
      ctx.textAlign = 'right';
      ctx.font = '10px Arial';
      for (let i = 0; i <= 5; i++) {
        const value = maxValue - (range / 5) * i;
        const y = padding + (chartHeight / 5) * i + 3;
        ctx.fillText(formatCurrency(value), padding - 10, y);
      }
    };
    
    drawChart();
  };

  const isLoading = cashFlowsLoading || dashboardLoading;

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const selectMonth = (year, month) => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    setShowMonthPicker(false);
  };

  const generateMonthOptions = () => {
    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    
    if (!monthlyBalanceData || !monthlyBalanceData.months) {
      console.log('No monthly balance data available');
      return [];
    }
    
    console.log('Monthly balance data:', monthlyBalanceData);
    console.log('All months:', monthlyBalanceData.months);
    
    // Filter months with transactions and up to current date
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    return monthlyBalanceData.months
      // Show all months from the data
      .map(monthData => {
        const [monthYear, monthNum] = monthData.month.split('-');
        const monthName = months[parseInt(monthNum) - 1];
        
        return {
          year: parseInt(monthYear),
          month: parseInt(monthNum),
          name: `${monthName} ${monthYear}`,
          key: monthData.month,
          balance: monthData.balance,
          transactions_count: monthData.transactions_count
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
  };

  const formatCurrency = (amount, currency = null) => {
    // Use selected cash flow currency if no currency specified
    const currencyToUse = currency || selectedCashFlow?.currency || 'ILS';
    
    const symbols = {
      'ILS': '₪',
      'USD': '$',
      'EUR': '€'
    };
    
    const symbol = symbols[currencyToUse] || currencyToUse;
    const precision = currencyToUse === 'ILS' ? 1 : 2;
    
    if (currencyToUse === 'ILS') {
      return `${amount.toFixed(precision)} ${symbol}`;
    } else {
      return `${symbol}${amount.toFixed(precision)}`;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getMonthName = (date) => {
    return date.toLocaleDateString('he-IL', { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  // Format month for mobile display (Hebrew month name only)
  const formatMonth = (date) => {
    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return months[date.getMonth()];
  };

  const calculateSummary = () => {
    if (!dashboardData || !dashboardData.summary) {
      return { income: 0, expenses: 0, net: 0 };
    }

    const { total_income, total_expenses } = dashboardData.summary;

    const nonCashflowIncome = dashboardData.categories['הכנסות לא תזרימיות']?.spent || 0;
    // 'spent' for expenses is negative, so take its absolute value.
    const nonCashflowExpenses = Math.abs(dashboardData.categories['הוצאות לא תזרימיות']?.spent || 0);

    const adjustedIncome = total_income - nonCashflowIncome;
    // 'total_expenses' is negative, take its absolute value.
    const adjustedExpenses = Math.abs(total_expenses) - nonCashflowExpenses;
    
    // Net is income minus expenses
    const adjustedNet = adjustedIncome - adjustedExpenses;

    return { income: adjustedIncome, expenses: adjustedExpenses, net: adjustedNet };
  };

  const summary = calculateSummary();

  const handleSaveGoal = async (goalData) => {
    try {
      await monthlyGoalsAPI.save(goalData);
      // Refetch dashboard data and monthly goal data
      refetchDashboard();
      queryClient.invalidateQueries(['monthlyGoal', year, month, selectedCashFlow?.id]);
    } catch (error) {
      console.error('Error saving monthly goal:', error);
      throw error;
    }
  };

  const handleExportCashFlowData = async () => {
    console.log('🔄 Starting export process...');
    if (!selectedCashFlow) {
      alert('לא נבחר תזרים מזומנים');
      return;
    }

    console.log('📊 Exporting data for cash flow:', selectedCashFlow);

    try {
      // The API interceptor returns response.data directly, so 'response' is actually the blob data
      const blobData = await api.get('/upload/export/cash-flow-data', {
        params: {
          cash_flow_id: selectedCashFlow.id
        },
        responseType: 'blob'
      });

      console.log('📊 Blob data type:', typeof blobData);
      console.log('📊 Blob data size:', blobData ? blobData.size : 'undefined');

      // Ensure we have valid data
      if (!blobData) {
        throw new Error('No data received from server');
      }

      // Create blob link to download - blobData is already the blob
      const blob = blobData instanceof Blob ? blobData : new Blob([blobData], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      console.log('📊 Final blob size:', blob.size);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename since we can't access headers due to API interceptor
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `נתוני_תזרים_${selectedCashFlow.name}_${currentDate}.xlsx`;
      
      link.setAttribute('download', filename);
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
      
      console.log('Export completed successfully');
    } catch (error) {
      console.error('Error exporting cash flow data:', error);
      alert('שגיאה בייצוא הנתונים. אנא נסה שוב.');
    }
  };

  const currentGoal = monthlyGoalData?.data || null;
  const goalAmount = currentGoal?.amount || 1000; // Default to 1000 if no goal set

  if (isLoading) {
    return (
      <div className="loading">
        <LoadingSpinner size="large" text="טוען נתונים..." />
      </div>
    );
  }

  const closeAllModals = () => {
    setShowMonthPicker(false);
    setShowChartModal(false);
  };

  return (
    <div className={`dashboard ${(showMonthPicker || showChartModal) ? 'modal-open' : ''}`}>
      {/* Emergency close button for stuck modals */}
      <button 
        className="emergency-close-btn" 
        onClick={closeAllModals}
        title="סגור הכל"
      >
        ✕
      </button>
      {/* Mobile Only Controls */}
      <div className="mobile-dashboard-controls">
        {/* בחירת חודש ותזרים Button */}
        <button className={`mobile-control-btn month-select-btn ${showMonthPicker ? 'expanded' : ''}`} onClick={() => setShowMonthPicker(!showMonthPicker)}>
          <div className="btn-content">
            <span className="btn-icon">📅</span>
            <span className="btn-text">בחירת חודש ותזרים</span>
            <span className={`btn-arrow ${showMonthPicker ? 'rotated' : ''}`}>▼</span>
          </div>
        </button>
      </div>

      {/* Mobile Month & Flow Selector Panel */}
      {showMonthPicker && (
        <div className="month-selector-panel show">
          {/* Cash Flow Selection */}
          <div className="mobile-flow-selector">
            <label className="flow-selector-label">בחירת תזרים:</label>
            <select
              className="mobile-flow-select"
              value={selectedCashFlow?.id || ''}
              onChange={(e) => {
                const cashFlow = (dashboardData?.cash_flows || cashFlows)?.find(cf => cf.id === e.target.value);
                setSelectedCashFlow(cashFlow);
              }}
            >
              {(dashboardData?.cash_flows || cashFlows || []).map(cashFlow => (
                <option key={cashFlow.id} value={cashFlow.id}>
                  {cashFlow.name}
                </option>
              ))}
            </select>
          </div>

          {/* Month Navigation */}
          <div className="mobile-month-navigation">
            <button className="mobile-nav-arrow next" onClick={() => navigateMonth(1)}>→</button>
            <div className="mobile-current-month">
              <span className="mobile-month-name">{formatMonth(currentDate)}</span>
              <span className="mobile-year-name">{currentDate.getFullYear()}</span>
            </div>
            <button className="mobile-nav-arrow prev" onClick={() => navigateMonth(-1)}>←</button>
          </div>

          {/* View Type Selection */}
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

          {/* Monthly Goal Display */}
          {dashboardData?.monthly_goal && (
            <div className="mobile-goal-display" onClick={() => setShowGoalModal(true)}>
              <span className="goal-label">יעד חודשי:</span>
              <span className="goal-value">{formatCurrency(dashboardData.monthly_goal.amount || 0)} ₪</span>
            </div>
          )}
        </div>
      )}

      <div className="dashboard-controls">
        <select
          className="form-select"
          value={selectedCashFlow?.id || ''}
          onChange={(e) => {
            const cashFlow = (dashboardData?.cash_flows || cashFlows)?.find(cf => cf.id === e.target.value);
            setSelectedCashFlow(cashFlow);
          }}
        >
          {(dashboardData?.cash_flows || cashFlows || []).map(cashFlow => (
            <option key={cashFlow.id} value={cashFlow.id}>
              {cashFlow.name}
            </option>
          ))}
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
                  {dashboardData?.hebrew_month_name ? 
                    dashboardData.hebrew_month_name : 
                    getMonthName(currentDate).split(' ')[0]
                  }
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
            {showMonthPicker && (
              <>
                <div 
                  className="month-picker-backdrop"
                  onClick={() => setShowMonthPicker(false)}
                ></div>
                <div className="month-picker-dropdown">
                  <div className="month-picker-header">
                    <h4>בחר חודש</h4>
                    <button 
                      className="close-picker" 
                      onClick={() => setShowMonthPicker(false)}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                  <div className="month-picker-grid">
                    {generateMonthOptions().map((option) => (
                      <button
                        key={option.key}
                        className={`month-option ${
                          option.year === year && option.month === month ? 'current' : ''
                        } ${option.balance > 0 ? 'positive' : option.balance < 0 ? 'negative' : 'neutral'}`}
                        onClick={() => selectMonth(option.year, option.month)}
                      >
                        <div className="month-option-name">{option.name}</div>
                        <div className="month-option-balance">{formatCurrency(option.balance)}</div>
                        <div className="month-option-count">{option.transactions_count} עסקאות</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <button 
          className="monthly-goal-button"
          onClick={() => setShowGoalModal(true)}
        >
          <div className="goal-info">
            <span className="goal-label">יעד חודשי:</span>
            <span className="goal-amount-display">
              {formatCurrency(goalAmount)}
            </span>
          </div>
          <div className="goal-icon">
            <span>💰</span>
            <span className="edit-arrow">→</span>
          </div>
        </button>
      </div>

      <div className="dashboard-content">
        {/* Monthly Balance Card Centered */}
        <div className="balance-card-container">
          <div className="monthly-balance-card">
            <div className="balance-card-header">
              <div className="balance-question">
                כמה כסף נשאר להוציא החודש?
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



        {/* Categories with Full Functionality */}
        {dashboardData?.categories && Object.keys(dashboardData.categories).length > 0 && (
          <div className="dashboard-section">
            <div className="categories-container">
              {Object.entries(dashboardData.categories).map(([categoryName, categoryData]) => (
                <CategoryCard
                  key={categoryName}
                  categoryName={categoryName}
                  categoryData={categoryData}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  onDataChange={refetchDashboard}
                  year={year}
                  month={month}
                />
              ))}
            </div>
          </div>
        )}

        {/* Quick Access Cards */}
        <div className="dashboard-section">
          <div className="quick-access-cards">
            <div className="card quick-access-card">
              <div className="card-body">
                <div className="quick-access-content">
                  <div className="quick-access-icon">
                    <i className="fas fa-chart-line"></i>
                  </div>
                  <div className="quick-access-info">
                    <h4>תיק מניות</h4>
                    <p>נהל את תיק המניות שלך, עקוב אחר מחירים ועסקאות</p>
                  </div>
                  <div className="quick-access-actions">
                    <a href="/stocks" className="btn btn-primary">
                      כנס לתיק המניות
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && dashboardData && (
          <div className="dashboard-section">
            <div className="card debug-card">
              <div className="card-header">
                <h3>מידע דיבאג</h3>
              </div>
              <div className="card-body">
                <p>מספר תנועות: {dashboardData.transaction_count || 0}</p>
                <p>חודש תזרים: {dashboardData.flow_month || 'לא מוגדר'}</p>
                <p>תזרים נוכחי: {dashboardData.current_cash_flow_id || 'לא מוגדר'}</p>
                <p>מצב מצטבר: {dashboardData.all_time ? 'כן' : 'לא'}</p>
              </div>
            </div>
            {/* Temporary button to force refresh all monthly targets */}
            <button 
              onClick={forceRefreshAllTargets}
              style={{
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                marginTop: '10px',
                display: 'block',
                margin: '10px auto 0'
              }}
            >
              🎯 חשב יעדים לכל הקטגוריות
            </button>
            
            {/* Action buttons moved from dashboard controls */}
            <div 
              className="action-buttons" 
              style={{ 
                display: 'flex', 
                gap: '8px', 
                justifyContent: 'center', 
                marginTop: '10px' 
              }}
            >
              <button 
                className="calendar-button"
                onClick={() => setShowMonthPicker(!showMonthPicker)}
                title="בחר חודש"
              >
                <i className="fas fa-calendar-alt"></i>
              </button>
              <button 
                className="chart-button"
                onClick={() => setShowChartModal(true)}
                title="גרף מאזן חודשי"
              >
                <i className="fas fa-chart-line"></i>
              </button>
            </div>
          </div>
        )}

        {/* Monthly Balance Chart Modal */}
        {showChartModal && (
          <>
            <div 
              className="chart-modal-backdrop"
              onClick={() => setShowChartModal(false)}
            ></div>
            <div className="chart-modal">
              <div className="chart-modal-header">
                <h3>גרף מאזן חודשי</h3>
                <button 
                  className="close-chart-modal" 
                  onClick={() => setShowChartModal(false)}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="chart-modal-body">
                {monthlyBalanceData?.months ? (
                  <div className="chart-container">
                    <canvas id="monthlyBalanceChart" width="1000" height="500"></canvas>
                  </div>
                ) : (
                  <div className="no-data-message">
                    <i className="fas fa-chart-line"></i>
                    <p>אין נתונים להצגה</p>
                  </div>
                )}
              </div>
              <div className="chart-modal-footer">
                <div className="chart-stats">
                  {monthlyBalanceData?.months && (() => {
                    const data = monthlyBalanceData.months.filter(m => m.has_transactions);
                    const positiveMonths = data.filter(m => m.balance > 0).length;
                    const negativeMonths = data.filter(m => m.balance < 0).length;
                    const avgBalance = data.reduce((sum, m) => sum + m.balance, 0) / data.length;
                    const maxBalance = Math.max(...data.map(m => m.balance));
                    const minBalance = Math.min(...data.map(m => m.balance));
                    
                    return (
                      <div className="stats-row">
                        <div className="stat-item">
                          <span className="stat-label">סה"כ חודשים:</span>
                          <span className="stat-value">{data.length}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">חודשים חיוביים:</span>
                          <span className="stat-value positive">{positiveMonths}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">חודשים שליליים:</span>
                          <span className="stat-value negative">{negativeMonths}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">מאזן ממוצע:</span>
                          <span className={`stat-value ${avgBalance >= 0 ? 'positive' : 'negative'}`}>
                            {formatCurrency(avgBalance)}
                          </span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">מאזן מקסימלי:</span>
                          <span className="stat-value positive">{formatCurrency(maxBalance)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">מאזן מינימלי:</span>
                          <span className="stat-value negative">{formatCurrency(minBalance)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="chart-legend">
                  <div className="legend-item positive">
                    <div className="legend-color"></div>
                    <span>מאזן חיובי</span>
                  </div>
                  <div className="legend-item negative">
                    <div className="legend-color"></div>
                    <span>מאזן שלילי</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Export Current Cash Flow Data Section */}
        <div className="dashboard-section">
          <div className="export-cash-flow-container">
            <button 
              className="export-cash-flow-button"
              onClick={handleExportCashFlowData}
              disabled={!selectedCashFlow}
            >
              <div className="export-icon">
                <i className="fas fa-download"></i>
              </div>
              <div className="export-info">
                <span className="export-label">ייצוא נתוני תזרים נוכחי</span>
                <span className="export-description">
                  ייצוא כל הנתונים של {selectedCashFlow?.name} לקובץ Excel
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Monthly Goal Modal */}
        <MonthlyGoalModal
          isOpen={showGoalModal}
          onClose={() => setShowGoalModal(false)}
          onSave={handleSaveGoal}
          currentGoal={currentGoal}
          cashFlowId={selectedCashFlow?.id}
          year={year}
          month={month}
        />
      </div>
    </div>
  );
};

export default Dashboard;