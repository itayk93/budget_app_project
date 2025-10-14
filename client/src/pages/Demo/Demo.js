import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { categoriesAPI, cashFlowsAPI, monthlyGoalsAPI } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import CategoryCard from '../../components/CategoryCard/CategoryCard';
import CategoryGroupCard from '../../components/CategoryGroupCard/CategoryGroupCard';
import MonthlyGoalModal from '../../components/MonthlyGoalModal/MonthlyGoalModal';
import { generateDemoData } from '../../utils/demoData';
import './Demo.css';

const Demo = () => {
  const navigate = useNavigate();
  const [demoData, setDemoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCashFlow, setSelectedCashFlow] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  // Load demo data on component mount
  useEffect(() => {
    const loadDemoData = async () => {
      try {
        const data = await generateDemoData();
        setDemoData(data);
        
        // Set default cash flow
        if (data.accounts?.length > 0) {
          setSelectedCashFlow({
            id: data.accounts[0].id.toString(),
            name: data.accounts[0].name,
            currency: 'ILS'
          });
        }
      } catch (error) {
        console.error('Error loading demo data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDemoData();
  }, []);

  const handleExitDemo = () => {
    navigate('/login');
  };

  const formatCurrency = (amount, currency = 'ILS') => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      amount = 0;
    }
    
    const numericAmount = Number(amount);
    const symbols = {
      'ILS': '₪',
      'USD': '$',
      'EUR': '€'
    };
    
    const symbol = symbols[currency] || currency;
    const precision = currency === 'ILS' ? 1 : 2;
    
    if (currency === 'ILS') {
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

  // Convert demo data to dashboard format
  const getDashboardData = () => {
    if (!demoData) return null;

    const categories = {};
    demoData.categories.forEach(category => {
      const categoryTransactions = demoData.transactions.filter(t => t.category_name === category.name);
      categories[category.name] = {
        name: category.name,
        budget: category.budget,
        spent: category.spent,
        transactions: categoryTransactions,
        category_type: 'variable_expense',
        monthly_target: null,
        percentage: category.percentage,
        count: category.transactions_count
      };
    });

    return { categories };
  };

  const dashboardData = getDashboardData();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  if (!demoData || !dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">שגיאה בטעינת נתוני הדמו</p>
          <button 
            onClick={handleExitDemo}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            חזרה להתחברות
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Demo Notice Header */}
      <div className="demo-notice">
        <div className="demo-notice-content">
          <div className="demo-indicator">
            <div className="demo-pulse"></div>
            <div>
              <h3>מצב דמו</h3>
              <p>אתם צופים בגרסת דמו עם נתונים לדוגמה. השינויים לא נשמרים.</p>
            </div>
          </div>
          <button
            onClick={handleExitDemo}
            className="demo-exit-btn"
          >
            יציאה מהדמו
          </button>
        </div>
      </div>

      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>דשבורד תקציבים</h1>
          <div className="dashboard-subtitle">
            {new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })} • גרסת דמו
          </div>
        </div>
        
        <div className="dashboard-stats">
          <div className="stat-card income">
            <div className="stat-label">הכנסות החודש</div>
            <div className="stat-value">{formatCurrency(demoData.monthlyIncome)}</div>
          </div>
          <div className="stat-card expenses">
            <div className="stat-label">הוצאות החודש</div>
            <div className="stat-value">{formatCurrency(demoData.monthlyExpenses)}</div>
          </div>
          <div className="stat-card balance">
            <div className="stat-label">יתרה כוללת</div>
            <div className="stat-value">{formatCurrency(demoData.totalBalance)}</div>
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2>קטגוריות</h2>
          <div className="section-subtitle">
            מעקב אחר הוצאות לפי קטגוריות
          </div>
        </div>
        
        <div className="categories-grid">
          {Object.entries(dashboardData.categories).map(([categoryName, categoryData]) => (
            <CategoryCard
              key={categoryName}
              categoryName={categoryName}
              categoryData={categoryData}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              onDataChange={() => {}} // No-op for demo
              year={year}
              month={month}
              isDemoMode={true}
            />
          ))}
        </div>
      </div>

      {/* Demo Info Section */}
      <div className="demo-info-section">
        <h3>אודות הדמו</h3>
        <div className="demo-features-grid">
          <div className="demo-feature">
            <h4>מה תוכלו לראות:</h4>
            <ul>
              <li>ממשק ניהול עסקאות מתקדם</li>
              <li>מעקב אחר קטגוריות הוצאות</li>
              <li>גרפים ודוחות חודשיים</li>
              <li>יתרות בזמן אמת</li>
              <li>ממשק ידידותי בעברית</li>
            </ul>
          </div>
          <div className="demo-feature">
            <h4>הגבלות הדמו:</h4>
            <ul>
              <li>נתונים לדוגמה בלבד</li>
              <li>לא ניתן לשמור שינויים</li>
              <li>אין גישה למערכת הבנקאות</li>
              <li>אין יצוא נתונים</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Demo;