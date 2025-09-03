import React, { useState, useEffect } from 'react';
import { groupTransactionsByWeeks, formatHebrewAmount } from '../../utils/hebrewCalendar';

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
  }, [transactions, year, month, categoryName]);

  const toggleWeekExpanded = (weekNumber, event) => {
    if (event) {
      event.stopPropagation();
    }
    setExpandedWeeks(prev => ({
      ...prev,
      [weekNumber]: !prev[weekNumber]
    }));
  };

  const weekNumbers = Object.keys(weeklyData).sort((a, b) => parseInt(a) - parseInt(b));

  if (weekNumbers.length === 0) {
    return (
      <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="text-center py-16 text-gray-500 bg-gray-50/50">
          <i className="fas fa-calendar-times text-4xl mb-4 text-gray-400"></i>
          <div className="text-sm font-medium">אין נתונים להצגה שבועית</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
        <div 
          className="flex justify-between items-center cursor-pointer p-4 hover:bg-gray-200/50 transition-all duration-200 rounded-t-xl"
          onClick={onToggleExpanded}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse flex-shrink-0"></div>
            <h3 className="text-sm font-semibold text-gray-800 leading-none">פירוט שבועי</h3>
          </div>
          <div className="flex items-center">
            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-gray-600 text-sm transition-transform duration-200`}></i>
          </div>
        </div>
        
      </div>

      {isExpanded && (
        <div className="bg-white">
          {weekNumbers.map((weekNumber, index) => {
            const week = weeklyData[weekNumber];
            const isWeekExpanded = expandedWeeks[weekNumber];
            
            return (
              <div key={weekNumber} className={`${index !== 0 ? 'border-t border-gray-100' : ''}`}>
                <div className="p-4 hover:bg-gray-50/50 transition-colors duration-200">
                  <div 
                    className="flex items-center justify-between cursor-pointer group"
                    onClick={(event) => toggleWeekExpanded(weekNumber, event)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between flex-1">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 text-xs font-bold rounded-full flex-shrink-0">
                          {weekNumber}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-gray-900 truncate">{week.label}</span>
                          <div className="text-xs text-gray-500 mt-1">{week.startDay}-{week.endDay}</div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl px-3 py-2 sm:px-4 sm:py-2 shadow-sm border border-gray-200">
                        <div className="font-bold text-gray-900 text-sm whitespace-nowrap">
                          {formatHebrewAmount(week.totalAmount)}
                        </div>
                        <div className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium whitespace-nowrap mt-1">
                          {week.transactions.length} עסקאות
                        </div>
                      </div>
                      
                      <div className="w-8"></div>
                    </div>
                    
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 group-hover:bg-gray-200 transition-colors duration-200">
                      <i className={`fas fa-chevron-${isWeekExpanded ? 'up' : 'down'} text-gray-600 text-xs transition-transform duration-200`}></i>
                    </div>
                  </div>

                  {isWeekExpanded && week.transactions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="space-y-2">
                        {week.transactions.map((transaction) => {
                          const isIncome = parseFloat(transaction.amount) > 0;
                          
                          return (
                            <div 
                              key={transaction.id}
                              className="flex items-center gap-2 sm:gap-3 p-3 bg-gradient-to-r from-white to-gray-50/50 rounded-lg hover:from-gray-50 hover:to-gray-100/50 transition-all duration-200 group border border-gray-100 hover:border-gray-200 hover:shadow-sm"
                              data-transaction-id={transaction.id}
                              data-currency={transaction.currency || 'ILS'}
                            >
                              <button 
                                className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-200 hover:bg-gray-300 transition-all duration-200 opacity-0 group-hover:opacity-100 sm:opacity-100 flex-shrink-0" 
                                title="פעולות"
                                onClick={() => onShowTransactionActions && onShowTransactionActions(transaction)}
                              >
                                <i className="fas fa-ellipsis-v text-gray-600 text-xs"></i>
                              </button>
                              
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate text-sm sm:text-base">
                                  <a 
                                    href={`/transaction/${transaction.id}`}
                                    className="hover:text-blue-600 transition-colors duration-200"
                                  >
                                    {transaction.business_name || transaction.description || 'תנועה ללא שם'}
                                  </a>
                                </div>
                                
                                <div className="flex items-center gap-1 sm:gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                                  <span className="whitespace-nowrap">
                                    {formatDate ? formatDate(transaction.payment_date) : 
                                      new Date(transaction.transaction_date || transaction.payment_date).toLocaleDateString('he-IL')}
                                  </span>
                                  {transaction.payment_number && transaction.total_payments && (
                                    <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                                      תשלום {transaction.payment_number}/{transaction.total_payments}
                                    </span>
                                  )}
                                  {transaction.currency && transaction.currency !== 'ILS' && (
                                    <span className="bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full">
                                      {transaction.currency}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className={`font-bold text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                                isIncome 
                                  ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' 
                                  : 'text-red-600 bg-red-50 border border-red-100'
                              }`}>
                                {formatHebrewAmount(Math.abs(parseFloat(transaction.amount || 0)))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="mt-3 text-center text-xs text-gray-500 bg-gray-50/80 py-2 px-3 rounded-lg">
                        מציג 1-{week.transactions.length} מתוך {week.transactions.length} עסקאות
                      </div>
                    </div>
                  )}

                  {isWeekExpanded && week.transactions.length === 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="text-center py-8 text-gray-500 bg-gray-50/50 rounded-lg">
                        <i className="fas fa-inbox text-2xl mb-2 text-gray-400"></i>
                        <div className="text-sm">אין עסקאות בשבוע זה</div>
                      </div>
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