import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import './CashFlowDashboard.css';
import { Line, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const CashFlowDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [cashFlows, setCashFlows] = useState([]);
  const [selectedCashFlow, setSelectedCashFlow] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [chartData, setChartData] = useState({
    monthlyFlow: null,
    categoryBreakdown: null,
    incomeVsExpenses: null,
    flowTrend: null
  });
  const [timeRange, setTimeRange] = useState('6months');
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchCashFlows = async () => {
    try {
      const response = await api.get('/cashflows');
      setCashFlows(response);
      
      if (response.length > 0) {
        const defaultFlow = response.find(cf => cf.is_default) || response[0];
        setSelectedCashFlow(defaultFlow);
      }
    } catch (error) {
      console.error('Error fetching cash flows:', error);
      setError('Failed to fetch cash flows');
    }
  };

  const fetchCashFlowData = useCallback(async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '3months':
          startDate.setMonth(endDate.getMonth() - 3);
          break;
        case '6months':
          startDate.setMonth(endDate.getMonth() - 6);
          break;
        case '1year':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setMonth(endDate.getMonth() - 6);
      }

      // Use the same dashboard endpoint for consistency
      console.log('Fetching dashboard data with params:', {
        cash_flow: selectedCashFlow.id,
        all_time: '1' // Get all time data for chart processing
      });

      const dashboardResponse = await api.get('/dashboard', {
        params: {
          cash_flow: selectedCashFlow.id,
          all_time: '1',
          format: 'json'
        }
      });

      console.log('Dashboard API Response:', dashboardResponse);
      
      // Get transactions from the dashboard data or fetch separately if needed
      const response = await api.get('/transactions', {
        params: {
          cash_flow_id: selectedCashFlow.id,
          show_all: 'true',
          per_page: 1000
        }
      });

      console.log('Transactions API Response:', response);
      const allTransactions = response.transactions || response.data || response || [];
      console.log('Total transactions found:', allTransactions.length);
      
      // Filter transactions by date range and use same exclusion logic as dashboard
      const filteredTransactions = allTransactions.filter(transaction => {
        const dateField = transaction.payment_date || transaction.date;
        if (!dateField) return false;
        const transactionDate = new Date(dateField);
        
        // Date range filter
        const inRange = transactionDate >= startDate && transactionDate <= endDate;
        if (!inRange) return false;
        
        // Use same non-cash-flow exclusion logic as dashboard
        const isNonCashflow = (
          transaction.excluded_from_flow === true ||
          (transaction.category_name && transaction.category_name.includes('לא תזרימיות')) ||
          (transaction.category && transaction.category.includes('לא תזרימיות'))
        );
        
        return !isNonCashflow;
      });
      
      console.log('Filtered transactions:', filteredTransactions.length);
      console.log('Date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
      
      setTransactions(filteredTransactions);
      generateChartData(filteredTransactions);
    } catch (error) {
      console.error('Error fetching cash flow data:', error);
      setError('Failed to fetch cash flow data');
    } finally {
      setLoading(false);
    }
  }, [selectedCashFlow, timeRange]);

  useEffect(() => {
    fetchCashFlows();
  }, []);

  useEffect(() => {
    if (selectedCashFlow) {
      fetchCashFlowData();
    }
  }, [selectedCashFlow, timeRange, fetchCashFlowData]);

  const generateChartData = (transactionData) => {
    console.log('Transaction data received:', transactionData);
    
    // Monthly cash flow trend
    const monthlyData = {};
    const categoryData = {};
    let totalIncome = 0;
    let totalExpenses = 0;

    if (!transactionData || transactionData.length === 0) {
      console.log('No transaction data available');
      setChartData({
        monthlyFlow: null,
        categoryBreakdown: null,
        incomeVsExpenses: null,
        flowTrend: null
      });
      return;
    }

    transactionData.forEach(transaction => {
      console.log('Processing transaction:', transaction);
      
      // Non-cash-flow transactions are already filtered out in fetchCashFlowData
      // This ensures consistency with dashboard calculations
      
      // Handle different date formats
      let date;
      const dateField = transaction.payment_date || transaction.date;
      if (dateField) {
        // Try to parse the date in different formats
        if (typeof dateField === 'string') {
          date = new Date(dateField);
        } else {
          date = new Date(dateField);
        }
      } else {
        console.warn('Transaction missing date:', transaction);
        return;
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date for transaction:', transaction);
        return;
      }

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Handle different amount field names and formats
      let amount = 0;
      if (transaction.amount !== undefined && transaction.amount !== null) {
        amount = parseFloat(transaction.amount);
      } else if (transaction.Amount !== undefined && transaction.Amount !== null) {
        amount = parseFloat(transaction.Amount);
      } else if (transaction.sum !== undefined && transaction.sum !== null) {
        amount = parseFloat(transaction.sum);
      } else if (transaction.Sum !== undefined && transaction.Sum !== null) {
        amount = parseFloat(transaction.Sum);
      }
      
      if (isNaN(amount)) {
        console.warn('Invalid amount for transaction:', transaction);
        return;
      }
      
      // Check for transaction type field to determine income vs expense
      let isIncome = false;
      
      // First check if there's a category with type
      if (transaction.category && transaction.category.category_type) {
        isIncome = transaction.category.category_type.toLowerCase() === 'income' || 
                   transaction.category.category_type.toLowerCase() === 'הכנסה';
      } else if (transaction.category_type) {
        isIncome = transaction.category_type.toLowerCase() === 'income' || 
                   transaction.category_type.toLowerCase() === 'הכנסה';
      } else if (transaction.type) {
        isIncome = transaction.type.toLowerCase() === 'income' || 
                   transaction.type.toLowerCase() === 'הכנסה';
      } else if (transaction.transaction_type) {
        isIncome = transaction.transaction_type.toLowerCase() === 'income' || 
                   transaction.transaction_type.toLowerCase() === 'הכנסה';
      } else {
        // If no type field, use amount sign (positive = income, negative = expense)
        isIncome = amount > 0;
      }
      
      // For absolute calculations
      const absoluteAmount = Math.abs(amount);
      
      console.log(`Transaction: amount=${amount}, absoluteAmount=${absoluteAmount}, isIncome=${isIncome}, monthKey=${monthKey}`);
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenses: 0, net: 0 };
      }

      // Update totals based on transaction type
      if (isIncome) {
        totalIncome += absoluteAmount;
        monthlyData[monthKey].income += absoluteAmount;
        monthlyData[monthKey].net += absoluteAmount;
      } else {
        totalExpenses += absoluteAmount;
        monthlyData[monthKey].expenses += absoluteAmount;
        monthlyData[monthKey].net -= absoluteAmount;
      }

      // Category breakdown
      const category = transaction.category_name || transaction.category || 'אחר';
      if (!categoryData[category]) {
        categoryData[category] = { income: 0, expenses: 0 };
      }
      
      if (isIncome) {
        categoryData[category].income += absoluteAmount;
      } else {
        categoryData[category].expenses += absoluteAmount;
      }
    });

    // Sort months
    const sortedMonths = Object.keys(monthlyData).sort();
    
    console.log('Sorted months:', sortedMonths);
    console.log('Monthly data:', monthlyData);
    
    // Create fallback data if no transactions
    let chartLabels = [];
    let incomeData = [];
    let expensesData = [];
    let netData = [];
    
    if (sortedMonths.length === 0) {
      // Create empty data for the last 6 months
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthNames = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
        chartLabels.push(`${monthNames[monthDate.getMonth()]} ${monthDate.getFullYear()}`);
        incomeData.push(0);
        expensesData.push(0);
        netData.push(0);
      }
    } else {
      chartLabels = sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
        
        // Fallback for Hebrew month names
        const monthNames = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
        return `${monthNames[date.getMonth()]} ${year}`;
      });
      
      incomeData = sortedMonths.map(month => monthlyData[month].income);
      expensesData = sortedMonths.map(month => monthlyData[month].expenses);
      netData = sortedMonths.map(month => monthlyData[month].net);
      
      console.log('Net data for cumulative:', netData);
    }
    
    // Monthly flow chart
    const monthlyFlowData = {
      labels: chartLabels,
      datasets: [
        {
          label: 'הכנסות',
          data: incomeData,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        },
        {
          label: 'הוצאות',
          data: expensesData,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.1
        },
        {
          label: 'תזרים נטו',
          data: netData,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.1
        }
      ]
    };

    // Category breakdown (expenses only)
    const expenseCategories = Object.entries(categoryData)
      .filter(([_, data]) => data.expenses > 0)
      .sort(([_, a], [__, b]) => b.expenses - a.expenses)
      .slice(0, 10);

    const categoryBreakdownData = expenseCategories.length > 0 ? {
      labels: expenseCategories.map(([category]) => category),
      datasets: [{
        data: expenseCategories.map(([_, data]) => data.expenses),
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
          '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    } : {
      labels: ['אין נתונים'],
      datasets: [{
        data: [1],
        backgroundColor: ['#E0E0E0'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    };

    // Income vs Expenses comparison
    const incomeVsExpensesData = (totalIncome > 0 || totalExpenses > 0) ? {
      labels: ['הכנסות', 'הוצאות'],
      datasets: [{
        data: [totalIncome, totalExpenses],
        backgroundColor: ['#4BC0C0', '#FF6384'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    } : {
      labels: ['אין נתונים'],
      datasets: [{
        data: [1],
        backgroundColor: ['#E0E0E0'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    };

    // Flow trend (cumulative) - should accumulate monthly net flows
    let cumulative = 0;
    const cumulativeData = netData.map((monthlyNet, index) => {
      cumulative += monthlyNet;
      console.log(`Month ${chartLabels[index]}: Monthly Net = ${monthlyNet}, Cumulative = ${cumulative}`);
      return cumulative;
    });
    
    console.log('Final cumulative data:', cumulativeData);
    
    const flowTrendData = {
      labels: chartLabels,
      datasets: [{
        label: 'תזרים מצטבר',
        data: cumulativeData,
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        fill: true,
        tension: 0.1
      }]
    };

    setChartData({
      monthlyFlow: monthlyFlowData,
      categoryBreakdown: categoryBreakdownData,
      incomeVsExpenses: incomeVsExpensesData,
      flowTrend: flowTrendData
    });
  };

  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        position: isMobile ? 'bottom' : 'top',
        labels: {
          font: {
            family: 'Arial, sans-serif',
            size: isMobile ? 11 : 12
          },
          padding: isMobile ? 15 : 20,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      title: {
        display: true,
        font: {
          family: 'Arial, sans-serif',
          size: isMobile ? 12 : 14
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        cornerRadius: 6,
        displayColors: true,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${new Intl.NumberFormat('he-IL', {
              style: 'currency',
              currency: selectedCashFlow?.currency || 'ILS'
            }).format(context.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: !isMobile
        },
        ticks: {
          font: {
            size: isMobile ? 10 : 11
          },
          maxRotation: isMobile ? 45 : 0
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          font: {
            size: isMobile ? 10 : 11
          },
          callback: function(value) {
            const formatter = new Intl.NumberFormat('he-IL', {
              style: 'currency',
              currency: selectedCashFlow?.currency || 'ILS',
              notation: isMobile && Math.abs(value) >= 1000 ? 'compact' : 'standard'
            });
            return formatter.format(value);
          }
        }
      }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false
    },
    plugins: {
      legend: {
        position: isMobile ? 'bottom' : 'right',
        labels: {
          font: {
            family: 'Arial, sans-serif',
            size: isMobile ? 10 : 12
          },
          padding: isMobile ? 10 : 15,
          usePointStyle: true,
          pointStyle: 'circle',
          generateLabels: function(chart) {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                
                return {
                  text: isMobile ? `${label} (${percentage}%)` : label,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].borderColor || '#fff',
                  lineWidth: 2,
                  index: i
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        cornerRadius: 6,
        displayColors: true,
        callbacks: {
          label: function(context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((context.parsed / total) * 100).toFixed(1);
            const amount = new Intl.NumberFormat('he-IL', {
              style: 'currency',
              currency: selectedCashFlow?.currency || 'ILS',
              notation: isMobile && Math.abs(context.parsed) >= 1000 ? 'compact' : 'standard'
            }).format(context.parsed);
            return `${context.label}: ${amount} (${percentage}%)`;
          }
        }
      }
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="cash-flow-dashboard">
        <div className="error-message">
          <h3>שגיאה</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cash-flow-dashboard">
      <div className="dashboard-header">
        <h1>דשבורד תזרים מזומנים</h1>
        
        <div className="dashboard-controls">
          <div className="control-group">
            <label>תזרים:</label>
            <select 
              value={selectedCashFlow?.id || ''} 
              onChange={(e) => {
                const flow = cashFlows.find(cf => cf.id === e.target.value);
                setSelectedCashFlow(flow);
              }}
            >
              {cashFlows.map(flow => (
                <option key={flow.id} value={flow.id}>
                  {flow.name} {flow.is_default ? '(ברירת מחדל)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>תקופה:</label>
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
              <option value="3months">3 חודשים</option>
              <option value="6months">6 חודשים</option>
              <option value="1year">שנה</option>
            </select>
          </div>
        </div>
      </div>

      {selectedCashFlow && (
        <div className="dashboard-content">
          <div className="cash-flow-summary">
            <h2>סיכום תזרים: {selectedCashFlow.name}</h2>
            <p>{selectedCashFlow.description}</p>
          </div>

          <div className="charts-grid">
            {/* Monthly Cash Flow Chart */}
            <div className="chart-container large">
              <h3>תזרים חודשי</h3>
              {chartData.monthlyFlow ? (
                <Line data={chartData.monthlyFlow} options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    title: {
                      ...chartOptions.plugins.title,
                      text: 'הכנסות והוצאות לפי חודשים'
                    }
                  }
                }} />
              ) : (
                <div className="empty-state">
                  <h3>אין נתוני תנועות</h3>
                  <p>טען קובץ תנועות כדי לראות את הגרפים</p>
                </div>
              )}
            </div>

            {/* Category Breakdown */}
            <div className="chart-container medium">
              <h3>פילוח לפי קטגוריות</h3>
              {chartData.categoryBreakdown ? (
                <Doughnut data={chartData.categoryBreakdown} options={pieOptions} />
              ) : (
                <div className="empty-state">
                  <h3>אין נתוני קטגוריות</h3>
                  <p>טען תנועות עם קטגוריות</p>
                </div>
              )}
            </div>

            {/* Income vs Expenses */}
            <div className="chart-container medium">
              <h3>הכנסות מול הוצאות</h3>
              {chartData.incomeVsExpenses ? (
                <Pie data={chartData.incomeVsExpenses} options={pieOptions} />
              ) : (
                <div className="empty-state">
                  <h3>אין נתוני הכנסות/הוצאות</h3>
                  <p>טען תנועות כדי לראות השוואה</p>
                </div>
              )}
            </div>

            {/* Cumulative Flow Trend */}
            <div className="chart-container large">
              <h3>מגמת תזרים מצטבר</h3>
              {chartData.flowTrend ? (
                <Line data={chartData.flowTrend} options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    title: {
                      ...chartOptions.plugins.title,
                      text: 'תזרים מזומנים מצטבר לאורך זמן'
                    }
                  }
                }} />
              ) : (
                <div className="empty-state">
                  <h3>אין נתוני מגמה</h3>
                  <p>טען תנועות כדי לראות מגמת תזרים</p>
                </div>
              )}
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="stats-grid">
            <div className="stat-card income">
              <h4>סה"כ הכנסות</h4>
              <p>{new Intl.NumberFormat('he-IL', {
                style: 'currency',
                currency: selectedCashFlow.currency || 'ILS',
                notation: isMobile ? 'compact' : 'standard'
              }).format(
                transactions
                  .filter(t => {
                    // Use same income detection logic as generateChartData
                    const amount = parseFloat(t.amount || t.Amount || t.sum || t.Sum || 0);
                    let isIncome = false;
                    
                    if (t.category && t.category.category_type) {
                      isIncome = t.category.category_type.toLowerCase() === 'income' || 
                                 t.category.category_type.toLowerCase() === 'הכנסה';
                    } else if (t.category_type) {
                      isIncome = t.category_type.toLowerCase() === 'income' || 
                                 t.category_type.toLowerCase() === 'הכנסה';
                    } else if (t.type) {
                      isIncome = t.type.toLowerCase() === 'income' || 
                                 t.type.toLowerCase() === 'הכנסה';
                    } else if (t.transaction_type) {
                      isIncome = t.transaction_type.toLowerCase() === 'income' || 
                                 t.transaction_type.toLowerCase() === 'הכנסה';
                    } else {
                      isIncome = amount > 0;
                    }
                    
                    return isIncome;
                  })
                  .reduce((sum, t) => {
                    const amount = parseFloat(t.amount || t.Amount || t.sum || t.Sum || 0);
                    return sum + Math.abs(amount);
                  }, 0)
              )}</p>
            </div>

            <div className="stat-card expenses">
              <h4>סה"כ הוצאות</h4>
              <p>{new Intl.NumberFormat('he-IL', {
                style: 'currency',
                currency: selectedCashFlow.currency || 'ILS',
                notation: isMobile ? 'compact' : 'standard'
              }).format(
                transactions
                  .filter(t => {
                    // Use same expense detection logic as generateChartData
                    const amount = parseFloat(t.amount || t.Amount || t.sum || t.Sum || 0);
                    let isIncome = false;
                    
                    if (t.category && t.category.category_type) {
                      isIncome = t.category.category_type.toLowerCase() === 'income' || 
                                 t.category.category_type.toLowerCase() === 'הכנסה';
                    } else if (t.category_type) {
                      isIncome = t.category_type.toLowerCase() === 'income' || 
                                 t.category_type.toLowerCase() === 'הכנסה';
                    } else if (t.type) {
                      isIncome = t.type.toLowerCase() === 'income' || 
                                 t.type.toLowerCase() === 'הכנסה';
                    } else if (t.transaction_type) {
                      isIncome = t.transaction_type.toLowerCase() === 'income' || 
                                 t.transaction_type.toLowerCase() === 'הכנסה';
                    } else {
                      isIncome = amount > 0;
                    }
                    
                    return !isIncome;
                  })
                  .reduce((sum, t) => {
                    const amount = parseFloat(t.amount || t.Amount || t.sum || t.Sum || 0);
                    return sum + Math.abs(amount);
                  }, 0)
              )}</p>
            </div>

            <div className="stat-card net">
              <h4>תזרים נטו</h4>
              <p>{new Intl.NumberFormat('he-IL', {
                style: 'currency',
                currency: selectedCashFlow.currency || 'ILS',
                notation: isMobile ? 'compact' : 'standard'
              }).format(
                transactions.reduce((sum, t) => {
                  const amount = parseFloat(t.amount || t.Amount || t.sum || t.Sum || 0);
                  let isIncome = false;
                  
                  if (t.category && t.category.category_type) {
                    isIncome = t.category.category_type.toLowerCase() === 'income' || 
                               t.category.category_type.toLowerCase() === 'הכנסה';
                  } else if (t.category_type) {
                    isIncome = t.category_type.toLowerCase() === 'income' || 
                               t.category_type.toLowerCase() === 'הכנסה';
                  } else if (t.type) {
                    isIncome = t.type.toLowerCase() === 'income' || 
                               t.type.toLowerCase() === 'הכנסה';
                  } else if (t.transaction_type) {
                    isIncome = t.transaction_type.toLowerCase() === 'income' || 
                               t.transaction_type.toLowerCase() === 'הכנסה';
                  } else {
                    isIncome = amount > 0;
                  }
                  
                  const absAmount = Math.abs(amount);
                  return isIncome ? sum + absAmount : sum - absAmount;
                }, 0)
              )}</p>
            </div>

            <div className="stat-card transactions">
              <h4>מספר תנועות</h4>
              <p>{new Intl.NumberFormat('he-IL').format(transactions.length)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashFlowDashboard;