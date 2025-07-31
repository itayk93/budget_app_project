import React, { useState, useEffect } from 'react';
import { groupTransactionsByWeeks, formatHebrewAmount } from '../../utils/hebrewCalendar';
import './WeeklyBreakdown.css';

const WeeklyBreakdown = ({ 
  categoryName, 
  year, 
  month, 
  transactions = [], 
  isExpanded = false, 
  onToggleExpanded,
  formatDate,
  onCategoryTransfer,
  onCopyTransaction,
  onChangeMonth,
  onEditTransaction,
  onDeleteTransaction,
  onShowTransactionActions
}) => {
  const [weeklyData, setWeeklyData] = useState({});
  const [expandedWeeks, setExpandedWeeks] = useState({});

  useEffect(() => {
    if (transactions.length > 0) {
      const grouped = groupTransactionsByWeeks(transactions, year, month);
      setWeeklyData(grouped);
    }
  }, [transactions, year, month]);

  const toggleWeekExpanded = (weekNumber) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [weekNumber]: !prev[weekNumber]
    }));
  };

  const calculateTotalAmount = () => {
    return Object.values(weeklyData).reduce((total, week) => total + week.totalAmount, 0);
  };

  const weekNumbers = Object.keys(weeklyData).sort((a, b) => parseInt(a) - parseInt(b));

  if (weekNumbers.length === 0) {
    return (
      <div className="weekly-breakdown">
        <div className="no-data">אין נתונים להצגה שבועית</div>
      </div>
    );
  }

  return (
    <div className="weekly-breakdown">
      <div className="weekly-breakdown-header">
        <div 
          className="weekly-breakdown-title"
          onClick={onToggleExpanded}
          role="button"
          tabIndex={0}
        >
          <div className="header-text">
            פירוט שבועי
            <span className="update-indicator">●</span>
          </div>
          <div className="header-controls">
            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} expand-arrow`}></i>
          </div>
        </div>
        
        {isExpanded && (
          <div className="weekly-breakdown-summary">
            <div className="summary-header">
              <div className="actuals-title">יצא</div>
              <div className="recommended-title">צפוי לצאת</div>
            </div>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="weekly-breakdown-content">
          {weekNumbers.map(weekNumber => {
            const week = weeklyData[weekNumber];
            const isWeekExpanded = expandedWeeks[weekNumber];
            
            return (
              <div key={weekNumber} className="week-section">
                <div className="separator"></div>
                
                <div className="week-summary">
                  <div 
                    className="week-summary-header"
                    onClick={() => toggleWeekExpanded(weekNumber)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="week-summary-row">
                      <div className="week-label-wrapper">
                        <div className="week-label">
                          <span className="week-label-text">{week.label}</span>
                          <div className="week-date-range">{week.startDay}-{week.endDay}</div>
                        </div>
                      </div>
                      
                      <div className="week-actuals">
                        <div className="amount-display">
                          {formatHebrewAmount(week.totalAmount)}
                        </div>
                      </div>
                      
                      <div className="week-recommended">
                        <span className="recommended-amount">
                          {formatHebrewAmount(week.totalAmount)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="week-controls">
                      <i className={`fas fa-chevron-${isWeekExpanded ? 'up' : 'down'} expand-arrow`}></i>
                      <span className="update-indicator">●</span>
                    </div>
                  </div>

                  {isWeekExpanded && week.transactions.length > 0 && (
                    <div className="week-transactions">
                      <div 
                        className="transactions-container transactions-scrollable-container"
                        data-category={`${categoryName}-week-${week.weekNumber}`}
                        data-page="1"
                        data-per-page={week.transactions.length}
                        data-total={week.transactions.length}
                      >
                        {week.transactions.map((transaction) => {
                          const isIncome = parseFloat(transaction.amount) > 0;
                          
                          return (
                            <div 
                              key={transaction.id}
                              className="transaction-item"
                              data-transaction-id={transaction.id}
                              data-currency={transaction.currency || 'ILS'}
                            >
                              <div className="transaction-actions">
                                <button 
                                  className="transaction-menu-btn" 
                                  title="פעולות"
                                  onClick={() => onShowTransactionActions && onShowTransactionActions(transaction)}
                                >
                                  <i className="fas fa-ellipsis-v"></i>
                                </button>
                              </div>
                              <div className="transaction-info-section">
                                <div className="ri-body">
                                  <a 
                                    href={`/transactions/details/${transaction.id}`}
                                    style={{ color: 'inherit', textDecoration: 'none' }}
                                  >
                                    {transaction.business_name || transaction.description || 'תנועה ללא שם'}
                                  </a>
                                </div>
                                
                                <div className="transaction-date">
                                  {formatDate ? formatDate(transaction.payment_date) : 
                                    new Date(transaction.transaction_date || transaction.payment_date).toLocaleDateString('he-IL')}
                                  {transaction.payment_number && transaction.total_payments && (
                                    <span className="transaction-payment-info">
                                      תשלום {transaction.payment_number}/{transaction.total_payments}
                                    </span>
                                  )}
                                  {transaction.currency && transaction.currency !== 'ILS' && (
                                    <span className="transaction-currency-info">
                                      {transaction.currency}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className={`transaction-amount ${isIncome ? 'income' : 'expense'}`}>
                                {formatHebrewAmount(Math.abs(parseFloat(transaction.amount || 0)))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {week.transactions.length > 0 && (
                        <div className="transaction-pagination-info">
                          מציג 1-{week.transactions.length} מתוך {week.transactions.length} עסקאות
                        </div>
                      )}
                    </div>
                  )}

                  {isWeekExpanded && week.transactions.length === 0 && (
                    <div className="no-transactions">
                      אין עסקאות בשבוע זה
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WeeklyBreakdown;