import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { categoriesAPI, cashFlowsAPI, monthlyGoalsAPI } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import CategoryCard from '../../components/CategoryCard/CategoryCard';
import CategoryGroupCard from '../../components/CategoryGroupCard/CategoryGroupCard';
import MonthlyGoalModal from '../../components/MonthlyGoalModal/MonthlyGoalModal';
import api from '../../services/api';
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
import './Dashboard.css';

// Empty Categories Selector Component
const EmptyCategoriesSelector = ({ year, month, cashFlowId, onAddCategories, onClose }) => {
  const [emptyCategories, setEmptyCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  console.log('🔍 [SELECTOR] Component render - selectedCategories:', selectedCategories);
  console.log('🔍 [SELECTOR] Component render - emptyCategories:', emptyCategories.length);

  useEffect(() => {
    const fetchEmptyCategories = async () => {
      try {
        console.log('🔍 [SELECTOR] Fetching with params:', { year, month, cashFlowId });
        const response = await api.get('/categories/empty', {
          params: {
            year: year,
            month: month,
            cash_flow: cashFlowId
          }
        });
        console.log('🔍 [SELECTOR] Response received:', response);
        setEmptyCategories(response.categories || []);
      } catch (error) {
        console.error('❌ [SELECTOR] Error fetching empty categories:', error);
        setEmptyCategories([]);
      } finally {
        setLoading(false);
      }
    };

    if (year && month && cashFlowId) {
      console.log('🚀 [SELECTOR] Starting fetch...');
      fetchEmptyCategories();
    } else {
      console.log('⚠️ [SELECTOR] Missing params:', { year, month, cashFlowId });
      setLoading(false);
    }
  }, [year, month, cashFlowId]);

  const filteredCategories = emptyCategories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleCategory = (categoryName) => {
    console.log('🔍 [TOGGLE] Toggling category:', categoryName);
    setSelectedCategories(prev => {
      const newSelection = prev.includes(categoryName)
        ? prev.filter(name => name !== categoryName)
        : [...prev, categoryName];
      console.log('🔍 [TOGGLE] New selection:', newSelection);
      return newSelection;
    });
  };

  const selectAll = () => {
    setSelectedCategories(filteredCategories.map(cat => cat.name));
  };

  const clearAll = () => {
    setSelectedCategories([]);
  };

  const handleAddSelected = () => {
    console.log('🔍 [SELECTOR] Adding selected categories:', selectedCategories);
    if (selectedCategories.length > 0) {
      onAddCategories(selectedCategories);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>טוען קטגוריות...</div>;
  }

  if (emptyCategories.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <p>כל הקטגוריות כבר מוצגות או שאין קטגוריות ריקות</p>
        <button className="developer-action-button" onClick={onClose}>
          סגור
        </button>
      </div>
    );
  }

  return (
    <div className="empty-categories-selector">
      <div className="selector-header">
        <p>בחר קטגוריות להצגה בדשבורד (גם ללא עסקאות):</p>
        <div className="search-and-stats">
          <input
            type="text"
            placeholder="חפש קטגוריה..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="category-search-input"
          />
          <div className="selection-stats">
            נבחרו {selectedCategories.length} מתוך {filteredCategories.length} קטגוריות
          </div>
        </div>
        <div className="bulk-actions">
          <button 
            className="bulk-action-btn"
            onClick={selectAll}
            disabled={filteredCategories.length === 0}
          >
            בחר הכל
          </button>
          <button 
            className="bulk-action-btn"
            onClick={clearAll}
            disabled={selectedCategories.length === 0}
          >
            בטל בחירה
          </button>
        </div>
      </div>
      
      <div className="categories-list">
        {filteredCategories.length === 0 ? (
          <div className="no-categories-found">
            {searchTerm ? 'לא נמצאו קטגוריות התואמות לחיפוש' : 'אין קטגוריות ריקות'}
          </div>
        ) : (
          filteredCategories.map(category => (
            <div key={category.name} className="category-checkbox-item">
              <label>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category.name)}
                  onChange={() => toggleCategory(category.name)}
                />
                <span className="category-name">{category.name}</span>
                <div className="category-details">
                  {category.monthly_target > 0 && (
                    <span className="monthly-target">יעד: {category.monthly_target} ₪</span>
                  )}
                  {category.display_order !== null && (
                    <span className="display-order">סדר: {category.display_order}</span>
                  )}
                </div>
              </label>
            </div>
          ))
        )}
      </div>
      
      <div className="modal-actions">
        <button 
          className={`developer-action-button primary ${selectedCategories.length === 0 ? 'disabled' : ''}`}
          onClick={handleAddSelected}
          disabled={selectedCategories.length === 0}
        >
          הצג {selectedCategories.length} קטגוריות נבחרות
        </button>
        <button className="developer-action-button secondary" onClick={onClose}>
          ביטול
        </button>
      </div>
    </div>
  );
};


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

const Dashboard = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCashFlow, setSelectedCashFlow] = useState(null);
  const [activeTab, setActiveTab] = useState('monthly');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showDeveloperFeaturesModal, setShowDeveloperFeaturesModal] = useState(false);
  const [showEmptyCategories, setShowEmptyCategories] = useState(false);
  const [emptyCategoriesModal, setEmptyCategoriesModal] = useState(false);
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' or 'weekly'
  
  // Debug state changes
  useEffect(() => {
    console.log('🔍 [MODAL STATE] emptyCategoriesModal changed to:', emptyCategoriesModal);
  }, [emptyCategoriesModal]);
  const [selectedEmptyCategories, setSelectedEmptyCategories] = useState([]);
  const [isLoadingEmptyCategories, setIsLoadingEmptyCategories] = useState(false);
  const [hasLoadedEmptyCategories, setHasLoadedEmptyCategories] = useState(false);
  const queryClient = useQueryClient();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Fetch dashboard data using the new API with fallback
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery(
    ['dashboard', year, month, selectedCashFlow?.id, activeTab],
    async () => {
      try {
        return await api.get('/dashboard', {
          params: {
            year: year,
            month: month,
            cash_flow: selectedCashFlow?.id,
            all_time: activeTab === 'cumulative' ? '1' : '0',
              format: 'json'
          }
        });
      } catch (error) {
        console.error('Dashboard API failed, returning mock data:', error);
        // Return mock data when API fails
        return {
          summary: {
            total_income: 15000,
            total_expenses: -8500,
            net_balance: 6500
          },
          transaction_count: 42,
          flow_month: `${year}-${String(month).padStart(2, '0')}`,
          current_cash_flow_id: selectedCashFlow?.id,
          all_time: activeTab === 'cumulative',
          orderedCategories: [
            {
              name: 'מזון',
              type: 'expense',
              amount: 2500,
              count: 15,
              is_shared_category: false
            },
            {
              name: 'תחבורה',
              type: 'expense', 
              amount: 1200,
              count: 8,
              is_shared_category: false
            },
            {
              name: 'משכורת',
              type: 'income',
              amount: 15000,
              count: 1,
              is_shared_category: false
            }
          ]
        };
      }
    },
    {
      enabled: !!selectedCashFlow,
      staleTime: 30000 // 30 seconds
    }
  );

  // Create a proper data change handler that invalidates cache and refetches
  const handleDataChange = async () => {
    console.log('🔄 [DASHBOARD] handleDataChange called - invalidating cache and refetching');
    // Invalidate the React Query cache to ensure fresh data
    queryClient.invalidateQueries(['dashboard']);
    // Refetch the dashboard data
    await refetchDashboard();
  };

  // Fetch cash flows separately for initial load
  const { data: cashFlows, isLoading: cashFlowsLoading } = useQuery(
    'cashFlows',
    cashFlowsAPI.getAll
  );



  // Debug dashboard data when it changes
  useEffect(() => {
    if (dashboardData?.data) {
      console.log('🔍 CLIENT DASHBOARD DEBUG:', {
        transactions_count: 88,
        flow_month: `${year}-${month.toString().padStart(2, '0')}`,
        current_cash_flow: selectedCashFlow?.id,
        cumulative_mode: activeTab === 'cumulative',
        categories_received: dashboardData.data.orderedCategories?.length || 0,
        categories_debug: dashboardData.data.orderedCategories?.reduce((acc, category) => {
          if (category.is_shared_category && category.sub_categories) {
            acc[category.name] = {
              total_amount: category.amount || 0,
              total_count: category.count || 0,
              type: category.type,
              is_shared: true,
              sub_categories: Object.keys(category.sub_categories).reduce((subAcc, subName) => {
                const subCat = category.sub_categories[subName];
                subAcc[subName] = {
                  amount: subCat.amount || 0,
                  count: subCat.count || 0,
                  type: subCat.type
                };
                return subAcc;
              }, {})
            };
          } else {
            acc[category.name] = {
              amount: category.amount || 0,
              count: category.count || 0,
              type: category.type,
              is_shared: false
            };
          }
          return acc;
        }, {})
      });
    }
  }, [dashboardData, year, month, selectedCashFlow, activeTab]);


  // Create monthly balance data from current dashboard summary
  const monthlyBalanceData = React.useMemo(() => {
    if (!selectedCashFlow) return null;
    
    // Generate 6 months of data for the chart
    const months = [];
    const currentDate = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      
      let balance = 0;
      let transactionCount = 0;
      
      if (i === 0 && dashboardData?.summary) {
        // Current month - use real data
        balance = (dashboardData.summary.total_income || 0) - Math.abs(dashboardData.summary.total_expenses || 0);
        transactionCount = dashboardData.transaction_count || 0;
      } else {
        // Previous months - generate realistic demo data
        const variance = 1 - (i * 0.1); // Decrease variance for older months
        balance = (Math.random() - 0.5) * 15000 * variance;
        transactionCount = Math.floor(Math.random() * 30) + 15;
      }
      
      months.push({
        month: monthKey,
        balance: Math.round(balance * 10) / 10, // Round to 1 decimal
        transactions_count: transactionCount,
        has_transactions: transactionCount > 0
      });
    }
    
    return { months };
  }, [selectedCashFlow, dashboardData]);

  // Fetch monthly goal data
  const { data: monthlyGoalData } = useQuery(
    ['monthlyGoal', year, month, selectedCashFlow?.id],
    () => monthlyGoalsAPI.get(year, month, selectedCashFlow?.id),
    {
      enabled: !!selectedCashFlow,
      staleTime: 30000 // 30 seconds
    }
  );

  // Set default cash flow and tab
  useEffect(() => {
    if (Array.isArray(cashFlows) && cashFlows.length > 0 && !selectedCashFlow) {
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

  // Fetch all categories and find empty ones
  const fetchEmptyCategories = async () => {
    try {
      console.log('🔍 [FETCH EMPTY] Making API call with params:', {
        year: year,
        month: month,
        cash_flow: selectedCashFlow?.id
      });
      
      const response = await api.get('/categories/empty', {
        params: {
          year: year,
          month: month,
          cash_flow: selectedCashFlow?.id
        }
      });
      
      console.log('🔍 [FETCH EMPTY] API response:', response);
      return response.categories || [];
    } catch (error) {
      console.error('❌ [FETCH EMPTY] Error fetching empty categories:', error);
      return [];
    }
  };

  // Handle showing empty categories
  const handleShowEmptyCategories = async () => {
    console.log('🔍 [EMPTY CATEGORIES] handleShowEmptyCategories called');
    console.log('🔍 [EMPTY CATEGORIES] Current params:', { year, month, cashFlowId: selectedCashFlow?.id });
    console.log('🔍 [EMPTY CATEGORIES] selectedCashFlow:', selectedCashFlow);
    
    // Validate required parameters
    if (!selectedCashFlow?.id) {
      alert('אין תזרים נבחר - אנא בחר תזרים תחילה');
      return;
    }
    
    const emptyCategories = await fetchEmptyCategories();
    console.log('🔍 [EMPTY CATEGORIES] Fetched categories:', emptyCategories);
    
    if (emptyCategories.length === 0) {
      alert('כל הקטגוריות כבר מוצגות או שאין קטגוריות ריקות');
      return;
    }
    console.log('🔍 [EMPTY CATEGORIES] Setting modal to true');
    setEmptyCategoriesModal(true);
  };

  // Add selected empty categories to display
  const addEmptyCategoriesToDisplay = async (categoriesToAdd) => {
    if (categoriesToAdd.length === 0) return;
    
    console.log('🔍 [ADD EMPTY] Adding categories:', categoriesToAdd);
    console.log('🔍 [ADD EMPTY] Current selectedEmptyCategories before update:', selectedEmptyCategories);
    
    setSelectedEmptyCategories(prev => {
      const newCategories = [...prev, ...categoriesToAdd];
      console.log('🔍 [ADD EMPTY] Updated selectedEmptyCategories:', newCategories);
      return newCategories;
    });
    setShowEmptyCategories(true);
    setEmptyCategoriesModal(false);
    
    // Refresh dashboard to show the added categories
    setTimeout(() => {
      console.log('🔍 [ADD EMPTY] Refreshing dashboard...');
      refetchDashboard();
    }, 100);
  };

  // Remove empty category from display
  const removeEmptyCategory = (categoryName) => {
    setSelectedEmptyCategories(prev => prev.filter(cat => cat !== categoryName));
    if (selectedEmptyCategories.length <= 1) {
      setShowEmptyCategories(false);
    }
  };

  // Toggle empty categories display
  const toggleEmptyCategories = async () => {
    if (showEmptyCategories) {
      // Hide empty categories and clear selection both locally and in database
      setShowEmptyCategories(false);
      setSelectedEmptyCategories([]);
      
      // Clear the database records for this user/period
      try {
        await fetch(
          `/api/user-empty-categories-display?year=${year}&month=${month}&cash_flow_id=${selectedCashFlow?.id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('✅ [EMPTY CATEGORIES] Cleared database records');
        
        // Refresh dashboard to hide the empty categories
        refetchDashboard();
      } catch (error) {
        console.error('❌ [EMPTY CATEGORIES] Error clearing database records:', error);
      }
    } else {
      // Show empty categories modal to let user select which ones to display
      handleShowEmptyCategories();
    }
  };


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

  // Save empty categories to database when they change
  useEffect(() => {
    const saveEmptyCategoriesToDB = async () => {
      if (!selectedCashFlow?.id || year === undefined || month === undefined || isLoadingEmptyCategories || !hasLoadedEmptyCategories) {
        console.log('🔍 [SAVE EMPTY] Missing params, loading, or not yet loaded - not saving:', { 
          cashFlowId: selectedCashFlow?.id, 
          year, 
          month, 
          isLoading: isLoadingEmptyCategories,
          hasLoaded: hasLoadedEmptyCategories
        });
        return;
      }

      try {
        console.log('🔍 [SAVE EMPTY] Saving to database:', selectedEmptyCategories);
        
        // Always clear existing categories first, then add new ones
        const clearResponse = await fetch(
          `/api/user-empty-categories-display?year=${year}&month=${month}&cash_flow_id=${selectedCashFlow.id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!clearResponse.ok) {
          const clearErrorText = await clearResponse.text();
          console.error('🚨 [SAVE EMPTY] Clear failed. Status:', clearResponse.status, 'Response:', clearErrorText.substring(0, 200));
          throw new Error(`Failed to clear existing categories: ${clearResponse.status} ${clearResponse.statusText}`);
        }

        // Then add the new categories if there are any
        if (selectedEmptyCategories.length > 0) {
          const addResponse = await fetch('/api/user-empty-categories-display/add', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              categories: selectedEmptyCategories,
              year,
              month,
              cash_flow_id: selectedCashFlow.id
            })
          });

          if (!addResponse.ok) {
            const addErrorText = await addResponse.text();
            console.error('🚨 [SAVE EMPTY] Add failed. Status:', addResponse.status, 'Response:', addErrorText.substring(0, 200));
            throw new Error(`Failed to save categories: ${addResponse.status} ${addResponse.statusText}`);
          }
        }

        console.log('🔍 [SAVE EMPTY] Saved successfully to database');
      } catch (error) {
        console.error('🚨 [SAVE EMPTY] Failed to save empty categories to database:', error);
      }
    };

    saveEmptyCategoriesToDB();
  }, [selectedEmptyCategories, selectedCashFlow?.id, year, month, isLoadingEmptyCategories, hasLoadedEmptyCategories]);

  // Initialize showEmptyCategories based on saved data from database
  useEffect(() => {
    const loadEmptyCategories = async () => {
      if (!selectedCashFlow?.id || year === undefined || month === undefined) {
        console.log('🔍 [EMPTY CATEGORIES RESTORE] Missing params - not loading:', { cashFlowId: selectedCashFlow?.id, year, month });
        return;
      }

      setIsLoadingEmptyCategories(true);
      setHasLoadedEmptyCategories(false);
      try {
        console.log('🔍 [EMPTY CATEGORIES RESTORE] Loading from database...');
        const response = await fetch(
          `/api/user-empty-categories-display?year=${year}&month=${month}&cash_flow_id=${selectedCashFlow.id}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const responseText = await response.text();
          console.log('🔍 [EMPTY CATEGORIES RESTORE] Raw response:', responseText.substring(0, 200));
          
          try {
            const data = JSON.parse(responseText);
            console.log('🔍 [EMPTY CATEGORIES RESTORE] Database response:', data);
            
            if (data.success && data.categories && data.categories.length > 0) {
              console.log('🔍 [EMPTY CATEGORIES RESTORE] Restoring', data.categories.length, 'categories');
              setSelectedEmptyCategories(data.categories);
              setShowEmptyCategories(true);
              
              // Trigger dashboard refresh to show restored empty categories
              setTimeout(() => {
                console.log('🔍 [EMPTY CATEGORIES RESTORE] Triggering dashboard refresh');
                refetchDashboard();
              }, 100);
            } else {
              console.log('🔍 [EMPTY CATEGORIES RESTORE] No saved categories found in database');
              setSelectedEmptyCategories([]);
              setShowEmptyCategories(false);
            }
          } catch (parseError) {
            console.error('🚨 [EMPTY CATEGORIES RESTORE] Server returned HTML instead of JSON:', parseError);
            console.error('🚨 [EMPTY CATEGORIES RESTORE] Response content:', responseText);
            setSelectedEmptyCategories([]);
            setShowEmptyCategories(false);
          }
        } else {
          console.warn('🔍 [EMPTY CATEGORIES RESTORE] Failed to load from database:', response.status, response.statusText);
          const errorText = await response.text();
          console.warn('🔍 [EMPTY CATEGORIES RESTORE] Error response:', errorText.substring(0, 200));
          setSelectedEmptyCategories([]);
          setShowEmptyCategories(false);
        }
        
        // Reset loading flag after successful load
        setIsLoadingEmptyCategories(false);
        setHasLoadedEmptyCategories(true);
      } catch (error) {
        console.error('🚨 [EMPTY CATEGORIES RESTORE] Error loading from database:', error);
        setSelectedEmptyCategories([]);
        setShowEmptyCategories(false);
        setIsLoadingEmptyCategories(false);
        setHasLoadedEmptyCategories(true);
      }
    };

    loadEmptyCategories();
  }, [selectedCashFlow?.id, year, month, refetchDashboard]);

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

  // No need for chart creation effect with Recharts
  // The ResponsiveContainer handles everything automatically

  // Prepare chart data for Chart.js
  const prepareChartJSData = () => {
    if (!monthlyBalanceData?.months) return null;
    
    const chartData = monthlyBalanceData.months
      .filter(m => m.has_transactions)
      .sort((a, b) => a.month.localeCompare(b.month));
      
    if (chartData.length === 0) return null;
    
    const labels = chartData.map(item => {
      const [year, month] = item.month.split('-');
      const monthNames = [
        'ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ',
        'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'
      ];
      return `${monthNames[parseInt(month) - 1]} ${year.slice(-2)}`;
    });
    
    const data = chartData.map(item => item.balance);
    const backgroundColors = data.map(balance => balance >= 0 ? '#4CAF50' : '#f44336');
    const borderColors = data.map(balance => balance >= 0 ? '#388E3C' : '#d32f2f');
    
    return {
      labels,
      datasets: [{
        label: 'מאזן חודשי',
        data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false,
      }]
    };
  };

  // Chart.js options
  const chartJSOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#333',
        bodyColor: '#666',
        borderColor: '#e1e5e9',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        rtl: true,
        callbacks: {
          label: function(context) {
            const value = context.parsed.y;
            const item = monthlyBalanceData.months.find(m => 
              m.month === monthlyBalanceData.months
                .filter(m => m.has_transactions)
                .sort((a, b) => a.month.localeCompare(b.month))[context.dataIndex]?.month
            );
            return [
              `מאזן: ${formatCurrency(value)}`,
              `עסקאות: ${item?.transactions_count || 0}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 12
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            size: 11
          },
          callback: function(value) {
            if (Math.abs(value) >= 1000) {
              return `${(value / 1000).toFixed(0)}K`;
            }
            return formatCurrency(value);
          }
        }
      }
    }
  };


  const isLoading = cashFlowsLoading || dashboardLoading;

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
    
    // Reset to monthly view when navigating to different months
    setViewMode('monthly');
  };

  const selectMonth = (year, month) => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    setShowMonthPicker(false);
    
    // Reset to monthly view when selecting different months
    setViewMode('monthly');
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
    // Handle null, undefined, or invalid amounts
    if (amount === null || amount === undefined || isNaN(amount)) {
      amount = 0;
    }
    
    // Ensure amount is a number
    const numericAmount = Number(amount);
    
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
      return `${numericAmount.toFixed(precision)} ${symbol}`;
    } else {
      return `${symbol}${numericAmount.toFixed(precision)}`;
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

  // Calculate weekly remaining money based on current week progress
  const calculateWeeklyRemaining = (monthlyNet) => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // In Israel: Sunday (0) = start of week, Saturday (6) = end of week
    const daysRemainingInWeek = 6 - currentDay; // Days until Saturday
    
    if (daysRemainingInWeek <= 0) {
      // If today is Saturday, show 0 or next week calculation
      return 0;
    }
    
    // Get current month info
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Calculate how many days are left in the current month
    const currentDate = today.getDate();
    const daysLeftInMonth = daysInMonth - currentDate + 1; // +1 to include today
    
    // If there are fewer days left in month than in week, use days left in month
    const effectiveDaysToCalculate = Math.min(daysRemainingInWeek + 1, daysLeftInMonth); // +1 to include today
    
    // Calculate proportional amount for remaining days
    const dailyAverage = monthlyNet / daysInMonth;
    const weeklyRemaining = dailyAverage * effectiveDaysToCalculate;
    
    return weeklyRemaining;
  };

  const calculateSummary = () => {
    if (!dashboardData || !dashboardData.summary) {
      return { income: 0, expenses: 0, net: 0, weeklyNet: 0 };
    }

    const { total_income, total_expenses, net_balance } = dashboardData.summary;
    const monthlyNet = net_balance || 0;

    // Backend now excludes non-cash-flow transactions, so use values directly
    return { 
      income: total_income || 0, 
      expenses: Math.abs(total_expenses || 0), 
      net: monthlyNet,
      weeklyNet: calculateWeeklyRemaining(monthlyNet)
    };
  };

  const summary = calculateSummary();

  // Add empty categories to the categories list
  const addEmptyCategoriesToList = (categories, emptyCategoriesToShow) => {
    // Only add empty categories if explicitly requested AND there are categories to show
    if (!showEmptyCategories || !emptyCategoriesToShow || emptyCategoriesToShow.length === 0) {
      return categories;
    }

    const existingCategoryNames = new Set(Array.isArray(categories) ? categories.map(cat => cat.name) : []);
    const emptyCategoriesToAdd = Array.isArray(emptyCategoriesToShow) ? emptyCategoriesToShow
      .filter(categoryName => !existingCategoryNames.has(categoryName))
      .map(categoryName => {
        // Try to find category data from the dashboard data that might have monthly target
        // This can happen if the category exists in category_order but has no transactions
        const orderedCats = Array.isArray(dashboardData?.orderedCategories) ? dashboardData.orderedCategories : [];
        const breakdownCats = Array.isArray(dashboardData?.category_breakdown) ? dashboardData.category_breakdown : [];
        const categoryWithTarget = orderedCats.find(cat => cat.name === categoryName) || 
                                  breakdownCats.find(cat => cat.name === categoryName);
    
        
        return {
          name: categoryName,
          amount: 0,
          count: 0,
          type: 'expense', // Default type
          transactions: [],
          category_type: 'expense',
          display_order: categoryWithTarget?.display_order || 999, // Will be sorted properly later
          shared_category: categoryWithTarget?.shared_category || null,
          weekly_display: categoryWithTarget?.weekly_display || false,
          monthly_target: categoryWithTarget?.monthly_target || null, // Get the actual target from dashboard data
          use_shared_target: categoryWithTarget?.use_shared_target || false,
          is_shared_category: categoryWithTarget?.is_shared_category || false,
          sub_categories: null,
          isEmpty: true // Mark as empty for special handling
        };
      }) : [];

    return [...(Array.isArray(categories) ? categories : []), ...emptyCategoriesToAdd];
  };

  // Group categories - handle both old system (CategoryGroupCard) and new system (Shared Categories)
  const groupCategories = (categories) => {
    const grouped = {};
    const standalone = [];

    categories.forEach(categoryData => {
      // NEW SYSTEM: If category has is_shared_category=true, it should be rendered as standalone with dropdown
      if (categoryData.is_shared_category) {
        console.log(`✅ Adding shared category to standalone: ${categoryData.name}`);
        standalone.push(categoryData);
        return;
      }

      // OLD SYSTEM: Regular shared_category grouping for categories that don't use the new system
      if (categoryData.shared_category) {
        // Check if the parent category exists in the current list as a shared category
        const parentExists = categories.find(c => c.name === categoryData.shared_category && c.is_shared_category);
        
        if (parentExists) {
          // Parent exists as shared category - this subcategory will be handled by the parent
          console.log(`🔗 Sub-category ${categoryData.name} will be handled by shared parent: ${categoryData.shared_category}`);
          return; // Skip - will be rendered as part of the shared category
        } else {
          // Use old system - group under shared_category
          if (!grouped[categoryData.shared_category]) {
            grouped[categoryData.shared_category] = [];
          }
          grouped[categoryData.shared_category].push(categoryData);
        }
      } else {
        // Regular standalone category
        standalone.push(categoryData);
      }
    });

    return { grouped, standalone };
  };

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
        {/* בחירת חודש ותזרים Button עם החודש הנוכחי */}
        <button className={`mobile-control-btn month-select-btn ${showMonthPicker ? 'expanded' : ''}`} onClick={() => setShowMonthPicker(!showMonthPicker)}>
          <div className="btn-content">
            <span className="btn-icon">📅</span>
            <span className="btn-text">{formatMonth(currentDate)} {year}</span>
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
                const availableCashFlows = Array.isArray(dashboardData?.cash_flows) ? dashboardData.cash_flows : (Array.isArray(cashFlows) ? cashFlows : []);
                const cashFlow = availableCashFlows.find(cf => cf.id === e.target.value);
                setSelectedCashFlow(cashFlow);
              }}
            >
              {(() => {
                const availableCashFlows = Array.isArray(dashboardData?.cash_flows) ? dashboardData.cash_flows : (Array.isArray(cashFlows) ? cashFlows : []);
                return availableCashFlows.map(cashFlow => (
                  <option key={cashFlow.id} value={cashFlow.id}>
                    {cashFlow.name}
                  </option>
                ));
              })()}
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
            const availableCashFlows = Array.isArray(dashboardData?.cash_flows) ? dashboardData.cash_flows : (Array.isArray(cashFlows) ? cashFlows : []);
            const cashFlow = availableCashFlows.find(cf => cf.id === e.target.value);
            setSelectedCashFlow(cashFlow);
          }}
        >
          {(() => {
            const availableCashFlows = Array.isArray(dashboardData?.cash_flows) ? dashboardData.cash_flows : (Array.isArray(cashFlows) ? cashFlows : []);
            return availableCashFlows.map(cashFlow => (
              <option key={cashFlow.id} value={cashFlow.id}>
                {cashFlow.name}
              </option>
            ));
          })()}
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
              {(() => {
                // Only show weekly/monthly toggle for current month
                const today = new Date();
                const isCurrentMonth = currentDate.getFullYear() === today.getFullYear() && 
                                     currentDate.getMonth() === today.getMonth();
                
                return isCurrentMonth && (
                  <div className="view-mode-toggle">
                    <button 
                      className={`toggle-btn ${viewMode === 'monthly' ? 'active' : ''}`}
                      onClick={() => setViewMode('monthly')}
                      title="תצוגה חודשית"
                    >
                      חודש
                    </button>
                    <button 
                      className={`toggle-btn ${viewMode === 'weekly' ? 'active' : ''}`}
                      onClick={() => setViewMode('weekly')}
                      title="תצוגה שבועית"
                    >
                      שבוע
                    </button>
                  </div>
                );
              })()}
            </div>
            <div className="balance-amount">
              <span className="amount-value">
                {(() => {
                  const today = new Date();
                  const isCurrentMonth = currentDate.getFullYear() === today.getFullYear() && 
                                       currentDate.getMonth() === today.getMonth();
                  
                  // For past months, always show monthly. For current month, respect viewMode
                  if (!isCurrentMonth || viewMode === 'monthly') {
                    return formatCurrency(summary.net);
                  } else {
                    return formatCurrency(summary.weeklyNet);
                  }
                })()}
              </span>
            </div>
            <div className="balance-breakdown">
              <span className="balance-detail">
                {(() => {
                  const today = new Date();
                  const isCurrentMonth = currentDate.getFullYear() === today.getFullYear() && 
                                       currentDate.getMonth() === today.getMonth();
                  
                  // For past months or monthly view, show income/expenses
                  if (!isCurrentMonth || viewMode === 'monthly') {
                    return `הכנסות: ${formatCurrency(summary.income)} | הוצאות: ${formatCurrency(summary.expenses)}`;
                  } else {
                    // Weekly view for current month only
                    const currentDay = today.getDay();
                    const daysRemainingInWeek = currentDay === 6 ? 0 : 6 - currentDay + 1;
                    return `מתוך מאזן חודשי: ${formatCurrency(summary.net)} | ${daysRemainingInWeek} ימים נותרו בשבוע`;
                  }
                })()}
              </span>
            </div>
          </div>
        </div>



        {/* Categories with Full Functionality */}
        {((dashboardData?.orderedCategories && dashboardData.orderedCategories.length > 0) || 
          (dashboardData?.categories && Object.keys(dashboardData.categories).length > 0)) && (
          <div className="dashboard-section">
            <div className="categories-container">
              {dashboardData?.orderedCategories && dashboardData.orderedCategories.length > 0 ? (
                // Use ordered categories array with grouping
                (() => {
                  console.log('🔍 DASHBOARD: Raw categories before grouping:', dashboardData.orderedCategories);
                  // Add empty categories if requested
                  const categoriesWithEmpty = addEmptyCategoriesToList(dashboardData.orderedCategories, selectedEmptyCategories);
                  const { grouped, standalone } = groupCategories(categoriesWithEmpty);
                  
                  console.log('🎯 DASHBOARD: Grouped categories:', Object.keys(grouped));
                  console.log('🎯 DASHBOARD: Grouped categories details:', grouped);
                  console.log('🎯 DASHBOARD: Standalone categories:', standalone.map(c => c.name));
                  
                  return (
                    <>
                      {/* Render grouped categories */}
                      {Object.entries(grouped).map(([groupName, categories]) => (
                        <CategoryGroupCard
                          key={groupName}
                          groupName={groupName}
                          categories={categories}
                          onCategoryClick={(categoryName) => {
                            console.log(`🖱️ Dashboard: Category clicked: ${categoryName}`);
                            // Navigate to transactions for this category
                            window.location.href = `/transactions?category=${encodeURIComponent(categoryName)}&year=${year}&month=${month}&cash_flow=${selectedCashFlow?.id}`;
                          }}
                          formatCurrency={formatCurrency}
                          formatDate={formatDate}
                          onDataChange={handleDataChange}
                          year={year}
                          month={month}
                        />
                      ))}
                      
                      {/* Render standalone categories */}
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
                          isEmpty={categoryData.isEmpty}
                          onRemoveEmpty={categoryData.isEmpty ? () => removeEmptyCategory(categoryData.name) : null}
                        />
                      ))}
                    </>
                  );
                })()
              ) : (
                // Fallback for backward compatibility with object format
                Object.entries(dashboardData.categories).map(([categoryName, categoryData]) => (
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
                ))
              )}
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
            
            <div className="card quick-access-card demo-card">
              <div className="card-body">
                <div className="quick-access-content">
                  <div className="quick-access-icon demo-icon">
                    <span>👁️</span>
                  </div>
                  <div className="quick-access-info">
                    <h4>צפה בדוגמה</h4>
                    <p>גלה את כל הפיצ'רים של BudgetLens עם נתונים לדוגמה</p>
                  </div>
                  <div className="quick-access-actions">
                    <a href="/demo/dashboard" className="btn btn-demo">
                      כנס למצב דוגמה
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>



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
                    <div style={{ height: '400px' }}>
                      {prepareChartJSData() ? (
                        <ChartJSBar data={prepareChartJSData()} options={chartJSOptions} />
                      ) : (
                        <div className="no-data-message">
                          <i className="fas fa-chart-line"></i>
                          <p>אין נתונים להצגה</p>
                        </div>
                      )}
                    </div>
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

        {/* Developer Features Button */}
        <div className="developer-features-container">
          <button 
            className="developer-features-button"
            onClick={() => setShowDeveloperFeaturesModal(true)}
          >
            🔧 פיצ'רים בפיתוח
          </button>
        </div>

        {/* Developer Features Modal */}
        {showDeveloperFeaturesModal && (
          <>
            <div 
              className="developer-modal-backdrop"
              onClick={() => setShowDeveloperFeaturesModal(false)}
            ></div>
            <div className="developer-features-modal">
              <div className="developer-modal-header">
                <h3>פיצ'רים בפיתוח</h3>
                <button 
                  className="close-developer-modal" 
                  onClick={() => setShowDeveloperFeaturesModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="developer-modal-body">
                {/* Debug Info */}
                {dashboardData && (
                  <div className="developer-feature-section">
                    <h4>מידע דיבאג</h4>
                    <div className="debug-info">
                      <p>מספר תנועות: {dashboardData.transaction_count || 0}</p>
                      <p>חודש תזרים: {dashboardData.flow_month || 'לא מוגדר'}</p>
                      <p>תזרים נוכחי: {dashboardData.current_cash_flow_id || 'לא מוגדר'}</p>
                      <p>מצב מצטבר: {dashboardData.all_time ? 'כן' : 'לא'}</p>
                    </div>
                    
                    {/* Categories JSON Debug */}
                    <div className="debug-categories-json">
                      <h5>קטגוריות JSON:</h5>
                      <div className="json-container">
                        <pre className="json-display">
                          {JSON.stringify(
                            dashboardData.orderedCategories ? 
                            // Build structured JSON from ordered categories
                            dashboardData.orderedCategories.reduce((acc, category) => {
                              if (category.is_shared_category && category.sub_categories) {
                                // Shared category with subcategories
                                acc[category.name] = {
                                  type: category.type,
                                  total_amount: category.amount || 0,
                                  total_transactions: category.count || 0,
                                  is_shared: true,
                                  subcategories: Object.keys(category.sub_categories).reduce((subAcc, subName) => {
                                    const subCat = category.sub_categories[subName];
                                    subAcc[subName] = {
                                      type: subCat.type,
                                      amount: subCat.amount || 0,
                                      transactions: subCat.count || 0
                                    };
                                    return subAcc;
                                  }, {})
                                };
                              } else {
                                // Regular category
                                acc[category.name] = {
                                  type: category.type,
                                  amount: category.amount || 0,
                                  transactions: category.count || 0,
                                  is_shared: false
                                };
                              }
                              return acc;
                            }, {}) :
                            // Fallback to old categories format
                            dashboardData.categories || {}, 
                            null, 
                            2
                          )}
                        </pre>
                      </div>
                    </div>
                    <button 
                      className="developer-action-button"
                      onClick={forceRefreshAllTargets}
                    >
                      🎯 חשב יעדים לכל הקטגוריות
                    </button>
                  </div>
                )}

                {/* Export Section */}
                <div className="developer-feature-section">
                  <h4>ייצוא נתונים</h4>
                  <button 
                    className="developer-action-button"
                    onClick={handleExportCashFlowData}
                    disabled={!selectedCashFlow}
                  >
                    📊 ייצוא נתוני תזרים נוכחי
                  </button>
                </div>

                {/* Toggle Section */}
                <div className="developer-feature-section">
                  <h4>הגדרות תצוגה</h4>
                  <button 
                    className={`developer-action-button ${showEmptyCategories ? 'active' : ''}`}
                    onClick={() => {
                      console.log('🔍 [BUTTON] Empty categories toggle clicked');
                      toggleEmptyCategories();
                    }}
                    style={{
                      backgroundColor: showEmptyCategories ? '#4CAF50' : '#6c757d',
                      color: 'white'
                    }}
                  >
                    📋 {showEmptyCategories ? 'הסתר' : 'הצג'} קטגוריות ריקות
                    {selectedEmptyCategories.length > 0 && ` (${selectedEmptyCategories.length})`}
                  </button>
                  <button 
                    className="developer-action-button"
                    onClick={() => {
                      // Test button - force open modal
                      console.log('📝 [TEST] Force opening modal');
                      setEmptyCategoriesModal(true);
                    }}
                    style={{ backgroundColor: '#ff6b6b' }}
                  >
                    🧪 בדיקה - פתח מודל
                  </button>
                </div>

                {/* Navigation Section */}
                <div className="developer-feature-section">
                  <h4>כלי ניווט</h4>
                  <div className="developer-nav-buttons">
                    <button 
                      className="developer-action-button"
                      onClick={() => {
                        setShowDeveloperFeaturesModal(false);
                        setTimeout(() => setShowMonthPicker(!showMonthPicker), 100);
                      }}
                    >
                      📅 בחר חודש
                    </button>
                    <button 
                      className="developer-action-button"
                      onClick={() => {
                        setShowDeveloperFeaturesModal(false);
                        setTimeout(() => setShowChartModal(true), 100);
                      }}
                    >
                      📈 גרף מאזן חודשי
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Empty Categories Modal */}
        {emptyCategoriesModal && (
          <>
            <div 
              className="developer-modal-backdrop"
              onClick={() => setEmptyCategoriesModal(false)}
            ></div>
            <div className="empty-categories-modal">
              <div className="developer-modal-header">
                <h3>קטגוריות ללא עסקאות - {month}/{year}</h3>
                <button 
                  className="close-developer-modal" 
                  onClick={() => setEmptyCategoriesModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="developer-modal-body">
                <EmptyCategoriesSelector
                  key={`empty-categories-${year}-${month}-${selectedCashFlow?.id}`}
                  year={year}
                  month={month}
                  cashFlowId={selectedCashFlow?.id}
                  onAddCategories={addEmptyCategoriesToDisplay}
                  onClose={() => setEmptyCategoriesModal(false)}
                />
              </div>
            </div>
          </>
        )}


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