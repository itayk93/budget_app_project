import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { transactionsAPI, categoriesAPI, cashFlowsAPI } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import Modal from '../../components/Common/Modal';
import './Transactions.css';
import CategoryDropdown from '../../components/Upload/CategoryDropdown';

// Editable Category Badge Component
const EditableCategoryBadge = ({ value, onSave, categories }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value || 'לא מסווג');
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const allCategories = [
    "דיגיטל", "חטיפים ואבקות חלבון", "עמלות", "גז", "ארנונה", "קפסולות נספרסו", "תזה 🤓",
    "סופר", "הוצאות לא תזרימיות", "פארמה", "יין", "אוכל בחוץ", "תקשורת", "מים", "טיסות לחו״ל",
    "פנאי ובילויים", "טיסה לגרמניה 🇩🇪", "שיעורי איטלקית", "רכב ותחבורה ציבורית", "הכנסות קבועות",
    "דיור", "ביטוח רכב", "כושר", "כללי", "חסכון חד פעמי", "חסכון קבוע", "אחר", "ירח דבש",
    "חשמל", "חדר כושר", "הכנסות", "הוצאות משתנות", "RiseUp", "חופשה בסיציליה", "ביטוח",
    "ענייני חתונה", "הוצאות תזרימיות", "שכר דירה סאבלט", "בתי קפה", "ביגוד והנעלה",
    "תשלומים", "הכנסות לא תזרימיות", "מכונות אוטומטיות במשרד", "הכנסות משתנות"
  ];

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setSelectedSuggestionIndex(-1);
    
    if (value.trim()) {
      const filtered = allCategories.filter(cat => 
        cat.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 8);
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
      setFilteredSuggestions([]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
        handleSave(filteredSuggestions[selectedSuggestionIndex]);
      } else {
        handleSave(inputValue);
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue(value || 'לא מסווג');
      setShowSuggestions(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    }
  };

  const handleSave = (newValue) => {
    const finalValue = newValue.trim() || 'לא מסווג';
    setInputValue(finalValue);
    setIsEditing(false);
    setShowSuggestions(false);
    if (finalValue !== (value || 'לא מסווג')) {
      onSave(finalValue);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSave(suggestion);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setInputValue(value || '');
    setTimeout(() => {
      const input = document.getElementById(`category-input-${value}`);
      if (input) input.focus();
    }, 0);
  };

  const handleBlur = () => {
    // Delay to allow suggestion clicks
    setTimeout(() => {
      setIsEditing(false);
      setShowSuggestions(false);
      setInputValue(value || 'לא מסווג');
    }, 150);
  };

  if (isEditing) {
    return (
      <div className="relative">
        <input
          id={`category-input-${value}`}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="inline-block px-2 py-1 bg-white border border-blue-500 text-gray-900 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[80px]"
          style={{ minWidth: Math.max(80, inputValue.length * 8 + 16) }}
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 z-50 bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                  index === selectedSuggestionIndex ? 'bg-blue-100' : ''
                }`}
                onMouseDown={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <span
      className="inline-block px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium whitespace-nowrap cursor-pointer hover:bg-gray-300 transition-colors"
      onClick={handleEdit}
      title="לחץ לעריכה"
    >
      {value || 'לא מסווג'}
    </span>
  );
};

// Currency Conversion Component
const CurrencyConversionPopup = ({ transaction, sourceCurrency, targetCurrency, onSubmit, onSkip }) => {
  const originalAmount = Math.abs(parseFloat(transaction.amount));
  
  // Initialize with the original amount as default
  const [targetAmount, setTargetAmount] = useState(originalAmount.toString());
  const [calculatedRate, setCalculatedRate] = useState('1.0000');

  // Calculate initial rate on mount
  React.useEffect(() => {
    if (originalAmount > 0 && targetAmount && !isNaN(targetAmount)) {
      const rate = originalAmount / parseFloat(targetAmount);
      setCalculatedRate(rate.toFixed(4));
    }
  }, [originalAmount, targetAmount]);

  const handleAmountChange = (value) => {
    setTargetAmount(value);
  };

  const handleSubmit = () => {
    if (!targetAmount || isNaN(targetAmount) || parseFloat(targetAmount) <= 0) {
      alert('יש להזין סכום תקין');
      return;
    }
    onSubmit(parseFloat(targetAmount));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div style={{padding: '10px 0'}}>
      <div className="form-group" style={{marginBottom: '1.5rem'}}>
        <label className="form-label" style={{marginBottom: '10px', fontSize: '16px'}}>
          כמה שווה {originalAmount.toLocaleString()} {sourceCurrency} ב{targetCurrency}?
        </label>
        <div style={{display: 'flex', alignItems: 'stretch'}}>
          <input 
            type="number" 
            step="0.01" 
            min="0"
            value={targetAmount}
            onChange={(e) => handleAmountChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="הקלד סכום"
            style={{
              flex: 1, 
              padding: '12px', 
              border: '1px solid #ced4da', 
              borderRadius: '4px 0 0 4px', 
              fontSize: '16px',
              minHeight: '44px'
            }}
            autoFocus
          />
          <span style={{
            backgroundColor: '#f8f9fa', 
            border: '1px solid #ced4da', 
            borderLeft: 'none', 
            borderRadius: '0 4px 4px 0', 
            padding: '12px 16px', 
            fontSize: '16px', 
            color: '#495057',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center'
          }}>
            {targetCurrency}
          </span>
        </div>
      </div>

      {calculatedRate && (
        <div style={{marginBottom: '2rem', fontSize: '14px', color: '#6c757d', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
          שער חליפין מחושב: 1 {targetCurrency} = {calculatedRate} {sourceCurrency}
        </div>
      )}

      <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #e9ecef'}}>
        <button
          type="button"
          className="px-5 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium min-h-[40px]"
          onClick={onSkip}
        >
          דלג (השתמש בסכום המקורי)
        </button>
        <button
          type="button"
          className="px-5 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSubmit}
          disabled={!targetAmount || isNaN(targetAmount) || parseFloat(targetAmount) <= 0}
        >
          המשך
        </button>
      </div>
    </div>
  );
};

const Transactions = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCashFlow, setSelectedCashFlow] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [notesQuery, setNotesQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [transactionToCopy, setTransactionToCopy] = useState(null);
  const [targetCashFlowId, setTargetCashFlowId] = useState('');
  const [isForeignCurrency, setIsForeignCurrency] = useState(false);
  const [foreignCurrency, setForeignCurrency] = useState('USD');
  const [foreignAmount, setForeignAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  
  // Bulk copy states
  const [isBulkCopyModalOpen, setIsBulkCopyModalOpen] = useState(false);
  const [bulkTargetCashFlowId, setBulkTargetCashFlowId] = useState('');
  const [currentBulkTransactionIndex, setCurrentBulkTransactionIndex] = useState(0);
  const [bulkConversionData, setBulkConversionData] = useState([]);
  const [isProcessingBulkCopy, setIsProcessingBulkCopy] = useState(false);
  const [bulkCopyProgress, setBulkCopyProgress] = useState({ current: 0, total: 0 });
  
  // Deposit linking states
  const [isLinkDepositModalOpen, setIsLinkDepositModalOpen] = useState(false);
  const [depositToLink, setDepositToLink] = useState(null);
  const [linkingCashFlowId, setLinkingCashFlowId] = useState('');
  const [potentialExpenses, setPotentialExpenses] = useState([]);
  const [selectedExpense, setSelectedExpense] = useState(null);

  const queryClient = useQueryClient();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Form state
  const [formData, setFormData] = useState({
    business_name: '',
    amount: '',
    payment_date: '',
    category_name: '',
    notes: '',
    payment_method: 'credit_card',
    currency: 'ILS'
  });
  // Income/Expense toggle: true = expense (negative), false = income (positive)
  const [isExpense, setIsExpense] = useState(true);

  // Fetch data
  const { data: cashFlows, isLoading: cashFlowsLoading } = useQuery(
    'cashFlows',
    cashFlowsAPI.getAll
  );

  const { data: categories, isLoading: categoriesLoading } = useQuery(
    'categories',
    categoriesAPI.getAll
  );

  const { data: transactions, isLoading: transactionsLoading } = useQuery(
    ['transactions', year, month, selectedCashFlow?.id, selectedCategory, searchQuery, notesQuery, page, showAll],
    () => transactionsAPI.getAll({
      flow_month: (showAll || searchQuery || notesQuery) ? undefined : `${year}-${String(month).padStart(2, '0')}`,
      cash_flow_id: selectedCashFlow?.id,
      category_name: selectedCategory || undefined,
      q: searchQuery || undefined,
      notes: notesQuery || undefined,
      page: page,
      per_page: 50,
      show_all: showAll || searchQuery || notesQuery
    }),
    {
      enabled: !!selectedCashFlow,
      keepPreviousData: true
    }
  );

  // Mutations
  const createTransactionMutation = useMutation(transactionsAPI.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('transactions');
      setIsAddModalOpen(false);
      resetForm();
    }
  });

  const updateTransactionMutation = useMutation(
    ({ id, data }) => transactionsAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('transactions');
        setIsEditModalOpen(false);
        setSelectedTransaction(null);
        resetForm();
      }
    }
  );

  const deleteTransactionMutation = useMutation(transactionsAPI.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('transactions');
    },
    onError: (error) => {
      console.error('Error deleting transaction:', error);
      
      if (error.response?.status === 404) {
        console.error('❌ [DATA SYNC ISSUE] Phantom transaction detected during deletion');
        
        const shouldRefresh = window.confirm(
          '🔄 בעיית סינכרון נתונים!\n\n' +
          'העסקה מוצגת במערכת אבל לא קיימת במסד הנתונים.\n' +
          'זה יכול לקרות בגלל נתונים cached ישנים.\n\n' +
          'האם תרצה לרענן את הנתונים כדי לתקן את הבעיה?'
        );
        
        if (shouldRefresh) {
          console.log('🔄 [DATA REFRESH] User chose to refresh data');
          queryClient.invalidateQueries('transactions');
          queryClient.clear(); // Clear all cached queries
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
        return;
      }
      
      // For other errors, show a generic error message
      alert('שגיאה במחיקת העסקה: ' + (error.response?.data?.error || error.message));
    }
  });

  const batchUpdateMutation = useMutation(transactionsAPI.batchUpdate, {
    onSuccess: () => {
      queryClient.invalidateQueries('transactions');
      setSelectedTransactions([]);
    }
  });

  // Set default cash flow
  useEffect(() => {
    if (cashFlows && !selectedCashFlow) {
      const defaultCashFlow = cashFlows.find(cf => cf.is_default) || cashFlows[0];
      setSelectedCashFlow(defaultCashFlow);
    }
  }, [cashFlows, selectedCashFlow]);

  const isLoading = cashFlowsLoading || categoriesLoading || transactionsLoading;

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
    setPage(1);
  };

  const formatCurrency = (amount, currency = 'ILS') => {
    // Handle null, undefined, or invalid amounts
    if (amount === null || amount === undefined || isNaN(amount)) {
      amount = 0;
    }
    
    // Ensure amount is a number
    const numericAmount = Number(amount);
    
    if (currency === 'ILS') {
      return `${Math.round(numericAmount)} ₪`;
    }
    return `${numericAmount.toFixed(2)} ${currency}`;
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

  const resetForm = () => {
    setFormData({
      business_name: '',
      amount: '',
      payment_date: '',
      category_name: '',
      notes: '',
      payment_method: 'credit_card',
      currency: 'ILS'
    });
    setIsExpense(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const rawAmount = Math.abs(parseFloat(formData.amount));
    const amount = isExpense ? -Math.abs(rawAmount || 0) : Math.abs(rawAmount || 0);

    const transactionData = {
      ...formData,
      cash_flow_id: selectedCashFlow?.id,
      amount
    };

    if (selectedTransaction) {
      updateTransactionMutation.mutate({ id: selectedTransaction.id, data: transactionData });
    } else {
      createTransactionMutation.mutate(transactionData);
    }
  };

  const handleEdit = (transaction) => {
    setSelectedTransaction(transaction);
    setFormData({
      business_name: transaction.business_name || '',
      amount: Math.abs(transaction.amount ?? 0).toString(),
      payment_date: transaction.payment_date?.split('T')[0] || '',
      category_name: transaction.category_name || '',
      notes: transaction.notes || '',
      payment_method: transaction.payment_method || 'credit_card',
      currency: transaction.currency || 'ILS'
    });
    setIsExpense((transaction.amount ?? 0) < 0);
    setIsEditModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק את התנועה?')) {
      deleteTransactionMutation.mutate(id);
    }
  };

  const handleCategoryUpdate = (transactionId, newCategory) => {
    updateTransactionMutation.mutate({
      id: transactionId,
      data: { category_name: newCategory }
    });
  };

  const handleSelectTransaction = (id) => {
    setSelectedTransactions(prev => 
      prev.includes(id) 
        ? prev.filter(tid => tid !== id)
        : [...prev, id]
    );
  };

  const handleBatchCategorize = (categoryId) => {
    if (selectedTransactions.length === 0) return;
    
    batchUpdateMutation.mutate({
      transaction_ids: selectedTransactions,
      updates: { category_name: categoryId }
    });
  };

  const handleCopy = (transaction) => {
    setTransactionToCopy(transaction);
    setTargetCashFlowId('');
    setIsForeignCurrency(false);
    setForeignCurrency('USD');
    setForeignAmount('');
    setExchangeRate('');
    setIsCopyModalOpen(true);
  };

  const deleteAllTransactionsMutation = useMutation(transactionsAPI.deleteAllByCashFlow, {
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries('transactions');
        alert(data.message || 'נמחקו בהצלחה');
      } else {
        alert('שגיאה: ' + (data.error || 'לא ניתן למחוק'));
      }
    },
    onError: (error) => {
      alert('שגיאה: ' + error.message);
    }
  });

  const copyTransactionMutation = useMutation(transactionsAPI.recordAsIncome, {
    onSuccess: () => {
      queryClient.invalidateQueries('transactions');
      setIsCopyModalOpen(false);
      setTransactionToCopy(null);
      alert('העסקה הועתקה בהצלחה');
    },
    onError: (error) => {
      alert('שגיאה בהעתקת העסקה: ' + error.message);
    }
  });

  const bulkCopyMutation = useMutation(transactionsAPI.recordAsIncome, {
    onSuccess: () => {
      queryClient.invalidateQueries('transactions');
    },
    onError: (error) => {
      console.error('Error in bulk copy:', error);
    }
  });

  // Handle deposit linking
  const handleLinkDeposit = async (deposit) => {
    setDepositToLink(deposit);
    setLinkingCashFlowId('');
    setSelectedExpense(null);
    setPotentialExpenses([]);
    setIsLinkDepositModalOpen(true);
  };

  // Fetch potential expenses from selected cash flow
  const fetchPotentialExpenses = async (cashFlowId) => {
    if (!cashFlowId) {
      setPotentialExpenses([]);
      return;
    }
    
    try {
      const response = await transactionsAPI.getTransactions({
        cashFlowId,
        page: 1,
        limit: 100,
        year: depositToLink?.payment_year,
        month: depositToLink?.payment_month
      });
      
      // Filter for positive amounts (expenses) in the same month or nearby dates
      const expenses = response.transactions.filter(t => 
        parseFloat(t.amount) > 0 && !t.original_currency // Not already linked
      );
      
      setPotentialExpenses(expenses);
      setSelectedExpense(null); // Reset selection when changing cash flow
    } catch (error) {
      console.error('Error fetching potential expenses:', error);
      alert('שגיאה בטעינת הוצאות אפשריות');
      setPotentialExpenses([]);
    }
  };

  // Handle linking deposit to expense
  const linkDepositMutation = useMutation(transactionsAPI.updateTransaction, {
    onSuccess: () => {
      queryClient.invalidateQueries('transactions');
      setIsLinkDepositModalOpen(false);
      setDepositToLink(null);
      setSelectedExpense(null);
      alert('הקישור נוצר בהצלחה');
    },
    onError: (error) => {
      alert('שגיאה ביצירת הקישור: ' + error.message);
    }
  });

  const handleConfirmLink = () => {
    if (!selectedExpense || !depositToLink) return;

    const depositAmountUSD = Math.abs(parseFloat(depositToLink.amount));
    const expenseAmount = parseFloat(selectedExpense.amount);
    const exchangeRate = expenseAmount / depositAmountUSD;

    // Update the deposit with linking information
    linkDepositMutation.mutate({
      id: depositToLink.id,
      original_currency: selectedExpense.currency || 'ILS',
      exchange_rate: exchangeRate,
      exchange_date: depositToLink.payment_date,
      linked_transaction_id: selectedExpense.id
    });
  };

  const handleFixFlowMonth = async () => {
    if (!selectedCashFlow) return;
    
    if (!window.confirm('האם תרצה לתקן את תאריכי התזרים של כל העסקאות? פעולה זו תעדכן את חודש התזרים בהתבסס על תאריך התשלום של כל עסקה.')) {
      return;
    }

    try {
      const response = await fetch('/api/transactions/fix-flow-month', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          cash_flow_id: selectedCashFlow.id
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        let message = `תיקון הושלם בהצלחה!\n\n`;
        message += `סך הכל עסקאות: ${result.total_transactions}\n`;
        message += `עסקאות שתוקנו: ${result.fixed_count}\n`;
        message += `עסקאות שדולגו (כבר נכונות): ${result.skipped_count}\n`;
        
        if (result.error_count > 0) {
          message += `שגיאות: ${result.error_count}\n`;
        }
        
        alert(message);
        
        // Refresh transactions
        queryClient.invalidateQueries('transactions');
      } else {
        alert('שגיאה בתיקון תאריכי התזרים: ' + result.error);
      }
    } catch (error) {
      console.error('Error fixing flow months:', error);
      alert('שגיאה בתיקון תאריכי התזרים: ' + error.message);
    }
  };

  const handleDeleteAllTransactions = async () => {
    if (!selectedCashFlow) return;
    
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את כל התנועות בתזרים זה? פעולה זו לא ניתנת לביטול.')) {
      return;
    }

    try {
      // First check for linked transactions
      const result = await transactionsAPI.deleteAllByCashFlow({
        cash_flow_id: selectedCashFlow.id,
        confirm_linked: false
      });
      
      if (result.requires_confirmation) {
        let message = `זהירות! פעולה זו תמחק את כל התנועות בתזרים הנוכחי.\n\n`;
        message += `נמצאו ${result.linked_transactions.length} עסקאות קשורות בתזרימים אחרים שיימחקו גם כן:\n\n`;
        
        result.transactions_with_links.forEach(t => {
          message += `• ${t.business_name} (${t.linked_count} עותקים)\n`;
        });
        
        message += `\nסה"כ יימחקו ${result.total_to_delete} עסקאות.\n\nהאם אתה בטוח שתרצה להמשיך?`;
        
        if (window.confirm(message)) {
          deleteAllTransactionsMutation.mutate({
            cash_flow_id: selectedCashFlow.id,
            confirm_linked: true
          });
        }
      } else {
        deleteAllTransactionsMutation.mutate({
          cash_flow_id: selectedCashFlow.id,
          confirm_linked: false
        });
      }
    } catch (error) {
      alert('שגיאה בבדיקת התנועות: ' + error.message);
    }
  };


  const handleForeignAmountChange = (value) => {
    setForeignAmount(value);
    if (value && transactionToCopy) {
      const originalAmount = Math.abs(parseFloat(transactionToCopy.amount));
      const foreignAmountNum = parseFloat(value);
      
      if (foreignAmountNum > 0) {
        const rate = originalAmount / foreignAmountNum;
        setExchangeRate(rate.toFixed(4));
      }
    }
  };

  const handleCopySubmit = () => {
    if (!transactionToCopy || !targetCashFlowId) return;

    const copyData = {
      transaction_id: transactionToCopy.id,
      target_cash_flow_id: targetCashFlowId,
      category_name: 'הכנסות משתנות'
    };

    if (isForeignCurrency && foreignAmount && exchangeRate) {
      copyData.foreign_currency = foreignCurrency;
      copyData.foreign_amount = parseFloat(foreignAmount);
      copyData.exchange_rate = parseFloat(exchangeRate);
    } else {
      copyData.new_amount = Math.abs(parseFloat(transactionToCopy.amount));
    }

    copyTransactionMutation.mutate(copyData);
  };

  // Bulk copy functions
  const handleBulkCopy = () => {
    if (!transactions?.transactions?.length) {
      alert('אין עסקאות להעתקה');
      return;
    }
    
    setBulkTargetCashFlowId('');
    setCurrentBulkTransactionIndex(0);
    setBulkConversionData([]);
    setIsProcessingBulkCopy(false);
    setBulkCopyProgress({ current: 0, total: 0 });
    setIsBulkCopyModalOpen(true);
  };

  const startBulkCopyProcess = () => {
    if (!bulkTargetCashFlowId) {
      alert('יש לבחור תזרים יעד');
      return;
    }

    const targetCashFlow = cashFlows.find(cf => cf.id === bulkTargetCashFlowId);
    const sourceCashFlow = selectedCashFlow;

    if (targetCashFlow.currency === sourceCashFlow.currency) {
      // Same currency - process all transactions at once
      processBulkCopySameCurrency();
    } else {
      // Different currency - start conversion process
      setCurrentBulkTransactionIndex(0);
      setBulkConversionData(new Array(transactions.transactions.length).fill(null));
      setIsProcessingBulkCopy(true);
    }
  };

  const processBulkCopySameCurrency = async () => {
    setIsProcessingBulkCopy(true);
    setCurrentBulkTransactionIndex(-1); // Signal processing mode
    let successCount = 0;
    let errorCount = 0;
    const totalTransactions = transactions.transactions.length;

    setBulkCopyProgress({ current: 0, total: totalTransactions });

    for (let i = 0; i < totalTransactions; i++) {
      const transaction = transactions.transactions[i];
      setBulkCopyProgress({ current: i + 1, total: totalTransactions });

      try {
        await bulkCopyMutation.mutateAsync({
          transaction_id: transaction.id,
          target_cash_flow_id: bulkTargetCashFlowId,
          category_name: 'הכנסות משתנות'
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error('Error copying transaction:', error);
      }
    }

    setIsProcessingBulkCopy(false);
    setIsBulkCopyModalOpen(false);
    alert(`הועתקו בהצלחה ${successCount} עסקאות. ${errorCount > 0 ? `${errorCount} עסקאות נכשלו.` : ''}`);
  };

  const handleCurrencyConversionSubmit = (targetAmount) => {
    const transaction = transactions.transactions[currentBulkTransactionIndex];
    const originalAmount = Math.abs(parseFloat(transaction.amount));
    const exchangeRate = originalAmount / targetAmount;
    
    const newConversionData = [...bulkConversionData];
    newConversionData[currentBulkTransactionIndex] = {
      targetAmount,
      exchangeRate,
      originalAmount
    };
    setBulkConversionData(newConversionData);

    if (currentBulkTransactionIndex < transactions.transactions.length - 1) {
      setCurrentBulkTransactionIndex(currentBulkTransactionIndex + 1);
    } else {
      // All conversions done, show processing state and process the bulk copy
      setIsProcessingBulkCopy(true);
      setCurrentBulkTransactionIndex(-1); // Signal that we're in processing mode
      processBulkCopyWithConversion(newConversionData);
    }
  };

  const processBulkCopyWithConversion = async (conversionData) => {
    let successCount = 0;
    let errorCount = 0;

    const sourceCashFlow = selectedCashFlow;
    const totalTransactions = transactions.transactions.length;

    setBulkCopyProgress({ current: 0, total: totalTransactions });

    for (let i = 0; i < totalTransactions; i++) {
      const transaction = transactions.transactions[i];
      const conversion = conversionData[i];

      setBulkCopyProgress({ current: i + 1, total: totalTransactions });

      try {
        await bulkCopyMutation.mutateAsync({
          transaction_id: transaction.id,
          target_cash_flow_id: bulkTargetCashFlowId,
          category_name: 'הכנסות משתנות',
          foreign_currency: sourceCashFlow.currency,
          foreign_amount: conversion.targetAmount,
          exchange_rate: conversion.exchangeRate
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error('Error copying transaction with conversion:', error);
      }
    }

    setIsProcessingBulkCopy(false);
    setIsBulkCopyModalOpen(false);
    alert(`הועתקו בהצלחה ${successCount} עסקאות עם המרת מטבע. ${errorCount > 0 ? `${errorCount} עסקאות נכשלו.` : ''}`);
  };

  if (isLoading) {
    return (
      <div className="loading">
        <LoadingSpinner size="large" text="טוען תנועות..." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-start mb-4 gap-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">תנועות</h1>
          <p className="text-gray-600">ניהול כל התנועות הכספיות שלכם</p>
        </div>

        <div className="flex gap-4 flex-shrink-0">
          <button
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            onClick={() => setIsAddModalOpen(true)}
          >
            הוספת תנועה
          </button>
          <button
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'הצג לפי חודש' : 'הצג הכל'}
          </button>
          {transactions?.transactions?.length > 0 && (
            <button
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-black transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleBulkCopy}
              disabled={isProcessingBulkCopy}
            >
              {isProcessingBulkCopy ? 'מעתיק...' : 'העתק הכל לתזרים אחר'}
            </button>
          )}
          {selectedCashFlow && (
            <>
              <button
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                onClick={() => handleFixFlowMonth()}
              >
                תקן תאריכי תזרים
              </button>
              <button
                className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors font-medium"
                onClick={() => handleDeleteAllTransactions()}
              >
                מחק את כל התנועות בתזרים
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-md border border-gray-300 w-fit">
          <button
            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm font-medium"
            onClick={() => navigateMonth(-1)}
          >
            ←
          </button>
          <span className="font-semibold text-gray-900 min-w-[120px] text-center text-sm">
            {getMonthName(currentDate)}
          </span>
          <button
            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm font-medium"
            onClick={() => navigateMonth(1)}
          >
            →
          </button>
        </div>

        <div className="flex gap-4 items-center flex-wrap">
          {cashFlows && cashFlows.length > 1 && (
            <select
              className="min-w-[150px] flex-1 max-w-[250px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={selectedCashFlow?.id || ''}
              onChange={(e) => {
                const cashFlow = cashFlows.find(cf => cf.id === e.target.value);
                setSelectedCashFlow(cashFlow);
              }}
            >
              {cashFlows.map(cashFlow => (
                <option key={cashFlow.id} value={cashFlow.id}>
                  {cashFlow.name}
                </option>
              ))}
            </select>
          )}

          <select
            className="min-w-[150px] flex-1 max-w-[250px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">כל הקטגוריות</option>
            {categories?.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            className="min-w-[150px] flex-1 max-w-[250px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="חיפוש..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <input
            type="text"
            className="min-w-[150px] flex-1 max-w-[250px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="חיפוש בהערות..."
            value={notesQuery}
            onChange={(e) => setNotesQuery(e.target.value)}
          />
        </div>

        {selectedTransactions.length > 0 && (
          <div className="flex items-center gap-4 p-4 bg-blue-600 text-white rounded-md">
            <span className="font-semibold">
              {selectedTransactions.length} תנועות נבחרו
            </span>
            <select
              className="bg-white text-gray-900 border-0 min-w-[200px] px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              onChange={(e) => {
                if (e.target.value) {
                  handleBatchCategorize(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="">הגדרת קטגוריה</option>
              {categories?.map(category => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {transactions?.transactions?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-gray-50 font-semibold text-gray-700 p-4 text-right border-b-2 border-gray-200 whitespace-nowrap">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTransactions(transactions.transactions.map(t => t.id));
                        } else {
                          setSelectedTransactions([]);
                        }
                      }}
                    />
                  </th>
                  <th className="bg-gray-50 font-semibold text-gray-700 p-4 text-right border-b-2 border-gray-200 whitespace-nowrap">תאריך</th>
                  <th className="bg-gray-50 font-semibold text-gray-700 p-4 text-right border-b-2 border-gray-200 whitespace-nowrap">עסק</th>
                  <th className="bg-gray-50 font-semibold text-gray-700 p-4 text-right border-b-2 border-gray-200 whitespace-nowrap">סכום</th>
                  <th className="bg-gray-50 font-semibold text-gray-700 p-4 text-right border-b-2 border-gray-200 whitespace-nowrap">קטגוריה</th>
                  <th className="bg-gray-50 font-semibold text-gray-700 p-4 text-right border-b-2 border-gray-200 whitespace-nowrap">הערות</th>
                  <th className="bg-gray-50 font-semibold text-gray-700 p-4 text-right border-b-2 border-gray-200 whitespace-nowrap">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {transactions.transactions.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="p-4 text-right border-b border-gray-200 align-middle">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.includes(transaction.id)}
                        onChange={() => handleSelectTransaction(transaction.id)}
                      />
                    </td>
                    <td className="p-4 text-right border-b border-gray-200 align-middle">{formatDate(transaction.payment_date)}</td>
                    <td className="p-4 text-right border-b border-gray-200 align-middle">{transaction.business_name}</td>
                    <td className={`p-4 text-right border-b border-gray-200 align-middle font-semibold font-mono ${parseFloat(transaction.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(parseFloat(transaction.amount)), transaction.currency)}
                    </td>
                    <td className="p-4 text-right border-b border-gray-200 align-middle">
                      <EditableCategoryBadge
                        value={transaction.category_name}
                        onSave={(newCategory) => handleCategoryUpdate(transaction.id, newCategory)}
                      />
                    </td>
                    <td className="p-4 text-right border-b border-gray-200 align-middle">{transaction.description || '-'}</td>
                    <td className="p-4 text-right border-b border-gray-200 align-middle">
                      <div className="flex gap-2 justify-end">
                        <button
                          className="px-3 py-1 bg-black text-white rounded hover:bg-gray-800 transition-colors text-sm font-medium"
                          onClick={() => window.location.href = `/transaction/${transaction.id}`}
                        >
                          פרטים
                        </button>
                        <button
                          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm font-medium"
                          onClick={() => handleEdit(transaction)}
                        >
                          עריכה
                        </button>
                        <button
                          className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors text-sm font-medium"
                          onClick={() => handleCopy(transaction)}
                        >
                          העתקה
                        </button>
                        <button
                          className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors text-sm font-medium"
                          onClick={() => handleDelete(transaction.id)}
                        >
                          מחיקה
                        </button>
                        {/* Show Link Deposit button only for investment deposits (USD negative amounts) */}
                        {selectedCashFlow === 'bbdb9129-5d88-4d36-b2d8-4345aa3fcd54' && 
                         transaction.currency === 'USD' && 
                         parseFloat(transaction.amount) < 0 &&
                         transaction.business_name === 'הפקדה לחשבון השקעות' && (
                          <button
                            className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-black transition-colors text-sm font-medium"
                            onClick={() => handleLinkDeposit(transaction)}
                          >
                            קישור הוצאה
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <p className="text-base">לא נמצאו תנועות לחודש זה</p>
          </div>
        )}

        {transactions?.pagination && (
          <div className="flex justify-center items-center gap-4 p-6 border-t border-gray-200">
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              הקודם
            </button>
            <span className="text-sm text-gray-600 font-medium">
              עמוד {page} מתוך {transactions.pagination.total_pages}
            </span>
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={page >= transactions.pagination.total_pages}
              onClick={() => setPage(page + 1)}
            >
              הבא
            </button>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="הוספת תנועה חדשה"
        className="transactions-modal"
      >
        <form onSubmit={handleSubmit}>
          {/* Type Toggle */}
          <div className="form-group">
            <label className="form-label">סוג תנועה</label>
            <div className="type-toggle">
              <button type="button" className={`toggle-btn ${isExpense ? 'active' : ''}`} onClick={() => setIsExpense(true)}>הוצאה</button>
              <button type="button" className={`toggle-btn ${!isExpense ? 'active' : ''}`} onClick={() => setIsExpense(false)}>הכנסה</button>
            </div>
          </div>
          {/* Row: Business + Amount */}
          <div className="form-row two-cols">
            <div className="form-group">
              <label className="form-label">שם העסק</label>
              <input
                type="text"
                className="form-input"
                value={formData.business_name}
                onChange={(e) => setFormData({...formData, business_name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">סכום</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value.replace(/-/g, '')})}
                onKeyDown={(e) => { if (e.key === '-' || e.key === 'Subtract') e.preventDefault(); }}
                required
              />
            </div>
          </div>

          {/* Row: Date + Category */}
          <div className="form-row two-cols">
            <div className="form-group">
              <label className="form-label">תאריך</label>
              <input
                type="date"
                className="form-input"
                value={formData.payment_date}
                onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">קטגוריה</label>
              <select
                className="form-select"
                value={formData.category_name}
                onChange={(e) => setFormData({...formData, category_name: e.target.value})}
              >
                <option value="">בחר קטגוריה</option>
                {categories?.map(category => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">אמצעי תשלום</label>
            <select
              className="form-select"
              value={formData.payment_method}
              onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
            >
              <option value="credit_card">כרטיס אשראי</option>
              <option value="debit_card">כרטיס חיוב</option>
              <option value="cash">מזומן</option>
              <option value="bank_transfer">העברה בנקאית</option>
              <option value="check">צ'ק</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">תיאור</label>
            <textarea
              className="form-textarea"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows="3"
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              onClick={() => setIsAddModalOpen(false)}
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={createTransactionMutation.isLoading}
            >
              {createTransactionMutation.isLoading ? 'שומר...' : 'שמירה'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="עריכת תנועה"
        className="transactions-modal"
      >
        <form onSubmit={handleSubmit}>
          {/* Type Toggle */}
          <div className="form-group">
            <label className="form-label">סוג תנועה</label>
            <div className="type-toggle">
              <button type="button" className={`toggle-btn ${isExpense ? 'active' : ''}`} onClick={() => setIsExpense(true)}>הוצאה</button>
              <button type="button" className={`toggle-btn ${!isExpense ? 'active' : ''}`} onClick={() => setIsExpense(false)}>הכנסה</button>
            </div>
          </div>
          {/* Row: Business + Amount */}
          <div className="form-row two-cols">
            <div className="form-group">
              <label className="form-label">שם העסק</label>
              <input
                type="text"
                className="form-input"
                value={formData.business_name}
                onChange={(e) => setFormData({...formData, business_name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">סכום</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value.replace(/-/g, '')})}
                onKeyDown={(e) => { if (e.key === '-' || e.key === 'Subtract') e.preventDefault(); }}
                required
              />
            </div>
          </div>

          {/* Row: Date + Category */}
          <div className="form-row two-cols">
            <div className="form-group">
              <label className="form-label">תאריך</label>
              <input
                type="date"
                className="form-input"
                value={formData.payment_date}
                onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">קטגוריה</label>
              <CategoryDropdown
                value={formData.category_name}
                onChange={(categoryName) => setFormData({...formData, category_name: categoryName})}
                placeholder="בחר קטגוריה..."
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">אמצעי תשלום</label>
            <select
              className="form-select"
              value={formData.payment_method}
              onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
            >
              <option value="credit_card">כרטיס אשראי</option>
              <option value="debit_card">כרטיס חיוב</option>
              <option value="cash">מזומן</option>
              <option value="bank_transfer">העברה בנקאית</option>
              <option value="check">צ'ק</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">תיאור</label>
            <textarea
              className="form-textarea"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows="3"
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              onClick={() => setIsEditModalOpen(false)}
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={updateTransactionMutation.isLoading}
            >
              {updateTransactionMutation.isLoading ? 'שומר...' : 'שמירה'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Copy Transaction Modal */}
      <Modal
        isOpen={isCopyModalOpen}
        onClose={() => {
          setIsCopyModalOpen(false);
          setTransactionToCopy(null);
          setTargetCashFlowId('');
          setIsForeignCurrency(false);
          setForeignAmount('');
          setExchangeRate('');
        }}
        title="העתקת עסקה לתזרים אחר"
      >
        {transactionToCopy && (
          <div>
            <p style={{marginBottom: '1rem'}}>בחר את התזרים שאליו תרצה להעתיק את העסקה:</p>
            
            <div className="form-group" style={{marginBottom: '1rem'}}>
              <label className="form-label">תזרים יעד:</label>
              <select 
                className="form-select" 
                value={targetCashFlowId}
                onChange={(e) => setTargetCashFlowId(e.target.value)}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
              >
                <option value="">-- בחר תזרים יעד --</option>
                {cashFlows?.filter(cf => cf.id !== selectedCashFlow?.id).map(cashFlow => (
                  <option key={cashFlow.id} value={cashFlow.id}>
                    {cashFlow.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Foreign Currency Checkbox and Fields */}
            <div className="form-group" style={{marginBottom: '1rem'}}>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <input 
                  type="checkbox" 
                  checked={isForeignCurrency}
                  onChange={(e) => {
                    setIsForeignCurrency(e.target.checked);
                    if (!e.target.checked) {
                      setForeignAmount('');
                      setExchangeRate('');
                    }
                  }}
                />
                עסקה במטבע זר
              </label>
            </div>

            {isForeignCurrency && (
              <div>
                <div className="form-group" style={{marginBottom: '1rem'}}>
                  <label className="form-label">מטבע זר:</label>
                  <select 
                    value={foreignCurrency}
                    onChange={(e) => setForeignCurrency(e.target.value)}
                    className="form-select"
                    style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>

                <div className="form-group" style={{marginBottom: '1rem'}}>
                  <label className="form-label">סכום במטבע זר:</label>
                  <div style={{display: 'flex', alignItems: 'stretch'}}>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      value={foreignAmount}
                      onChange={(e) => handleForeignAmountChange(e.target.value)}
                      placeholder="הקלד סכום"
                      style={{flex: 1, padding: '8px', border: '1px solid #ced4da', borderRadius: '4px 0 0 4px', fontSize: '16px'}}
                    />
                    <span style={{backgroundColor: '#f8f9fa', border: '1px solid #ced4da', borderLeft: 'none', borderRadius: '0 4px 4px 0', padding: '8px 12px', fontSize: '16px', color: '#495057'}}>
                      {foreignCurrency}
                    </span>
                  </div>
                </div>

                <div className="form-group" style={{marginBottom: '1rem'}}>
                  <label className="form-label">שער חליפין:</label>
                  <div style={{display: 'flex', alignItems: 'stretch'}}>
                    <input 
                      type="number" 
                      step="0.0001" 
                      value={exchangeRate}
                      readOnly
                      placeholder="שער מחושב אוטומטית"
                      style={{flex: 1, padding: '8px', border: '1px solid #ced4da', borderRadius: '4px 0 0 4px', fontSize: '16px', backgroundColor: '#f8f9fa'}}
                    />
                    <span style={{backgroundColor: '#f8f9fa', border: '1px solid #ced4da', borderLeft: 'none', borderRadius: '0 4px 4px 0', padding: '8px 12px', fontSize: '16px', color: '#495057'}}>
                      ₪/{foreignCurrency}
                    </span>
                  </div>
                  {exchangeRate && (
                    <small style={{color: '#6c757d', marginTop: '4px', display: 'block'}}>
                      שער מחושב אוטומטית: 1 {foreignCurrency} = {exchangeRate} ₪
                    </small>
                  )}
                </div>
              </div>
            )}

            <div style={{margin: '1rem 0', padding: '12px', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px'}}>
              <div><strong>עסקה:</strong> {transactionToCopy.business_name}</div>
              <div><strong>סכום מקורי:</strong> {Math.abs(parseFloat(transactionToCopy.amount)).toLocaleString()} ₪</div>
              <div><strong>העסקה תועתק כ:</strong> {
                parseFloat(transactionToCopy.amount) < 0 
                  ? 'הכנסה בתזרים היעד' 
                  : 'הוצאה בתזרים היעד'
              }</div>
            </div>

            <div className="alert alert-info" style={{padding: '12px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb', borderRadius: '4px', marginBottom: '1rem'}}>
              <strong>💡 הסבר:</strong> {
                parseFloat(transactionToCopy.amount) < 0 
                  ? 'הוצאה זו תועתק כהכנסה בתזרים היעד. כך תוכל לרשום העברה פנימית בין תזרימים.'
                  : 'הכנסה זו תועתק כהוצאה בתזרים היעד. כך תוכל לרשום העברה פנימית בין תזרימים.'
              }
            </div>

            <div className="modal-footer" style={{display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '1rem', borderTop: '1px solid #e9ecef'}}>
              <button
                type="button"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                onClick={() => {
                  setIsCopyModalOpen(false);
                  setTransactionToCopy(null);
                  setTargetCashFlowId('');
                  setIsForeignCurrency(false);
                  setForeignAmount('');
                  setExchangeRate('');
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCopySubmit}
                disabled={!targetCashFlowId || copyTransactionMutation.isLoading || (isForeignCurrency && (!foreignAmount || !exchangeRate))}
              >
                {copyTransactionMutation.isLoading ? 'מעתיק...' : 'העתק'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Copy Modal */}
      <Modal
        isOpen={isBulkCopyModalOpen}
        onClose={() => {
          setIsBulkCopyModalOpen(false);
          setBulkTargetCashFlowId('');
          setCurrentBulkTransactionIndex(0);
          setBulkConversionData([]);
          setIsProcessingBulkCopy(false);
          setBulkCopyProgress({ current: 0, total: 0 });
        }}
        title={isProcessingBulkCopy ? 'המרת מטבע' : 'העתקה בכמות גדולה לתזרים אחר'}
      >
        {!isProcessingBulkCopy ? (
          // Initial selection screen
          <div>
            <p style={{marginBottom: '1rem'}}>
              אתה עומד להעתיק {transactions?.transactions?.length} עסקאות לתזרים אחר.
            </p>
            
            <div className="form-group" style={{marginBottom: '1rem'}}>
              <label className="form-label">בחר תזרים יעד:</label>
              <select 
                className="form-select" 
                value={bulkTargetCashFlowId}
                onChange={(e) => setBulkTargetCashFlowId(e.target.value)}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
              >
                <option value="">-- בחר תזרים יעד --</option>
                {cashFlows?.filter(cf => cf.id !== selectedCashFlow?.id).map(cashFlow => (
                  <option key={cashFlow.id} value={cashFlow.id}>
                    {cashFlow.name} ({cashFlow.currency})
                  </option>
                ))}
              </select>
            </div>

            {bulkTargetCashFlowId && (
              <div className="alert alert-info" style={{padding: '12px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb', borderRadius: '4px', marginBottom: '1rem'}}>
                <strong>💡 הסבר:</strong>
                <br />
                • כל העסקאות יועתקו לקטגוריה "הכנסות משתנות" בתזרים היעד
                <br />
                • הוצאות יהפכו להכנסות (והפוך)
                <br />
                {(() => {
                  const targetCashFlow = cashFlows?.find(cf => cf.id === bulkTargetCashFlowId);
                  const sourceCashFlow = selectedCashFlow;
                  return targetCashFlow?.currency !== sourceCashFlow?.currency ? 
                    `• המטבע שונה (${sourceCashFlow?.currency} → ${targetCashFlow?.currency}), תתבקש להמיר כל עסקה בנפרד` :
                    `• המטבע זהה (${sourceCashFlow?.currency}), ההעתקה תהיה ישירה`;
                })()}
              </div>
            )}

            <div className="modal-footer" style={{display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '1rem', borderTop: '1px solid #e9ecef'}}>
              <button
                type="button"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                onClick={() => setIsBulkCopyModalOpen(false)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={startBulkCopyProcess}
                disabled={!bulkTargetCashFlowId || isProcessingBulkCopy}
              >
                {isProcessingBulkCopy ? 'מתחיל...' : 'התחל העתקה'}
              </button>
            </div>
          </div>
        ) : (
          // Currency conversion screen or processing screen
          (() => {
            // If currentBulkTransactionIndex is -1, we're in processing mode
            if (currentBulkTransactionIndex === -1) {
              return (
                <div style={{minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                  <LoadingSpinner size="large" />
                  <div style={{marginTop: '20px', textAlign: 'center'}}>
                    <h3>מעבד העתקת עסקאות...</h3>
                    <p style={{color: '#6c757d', marginTop: '10px', marginBottom: '15px'}}>
                      אנא המתן בזמן שהמערכת מעתיקה את כל העסקאות
                    </p>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e9ecef',
                      borderRadius: '8px',
                      padding: '15px',
                      display: 'inline-block'
                    }}>
                      <div style={{fontSize: '18px', fontWeight: 'bold', color: '#495057'}}>
                        {bulkCopyProgress.current} מתוך {bulkCopyProgress.total}
                      </div>
                      <div style={{fontSize: '14px', color: '#6c757d', marginTop: '5px'}}>
                        עסקאות הועתקו
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const currentTransaction = transactions?.transactions?.[currentBulkTransactionIndex];
            const targetCashFlow = cashFlows?.find(cf => cf.id === bulkTargetCashFlowId);
            const sourceCashFlow = selectedCashFlow;
            
            return currentTransaction ? (
              <div style={{minHeight: '300px', display: 'flex', flexDirection: 'column'}}>
                <div style={{marginBottom: '1rem', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
                  <strong>עסקה {currentBulkTransactionIndex + 1} מתוך {transactions.transactions.length}</strong>
                  <br />
                  <strong>עסק:</strong> {currentTransaction.business_name}
                  <br />
                  <strong>סכום מקורי:</strong> {Math.abs(parseFloat(currentTransaction.amount)).toLocaleString()} {sourceCashFlow.currency}
                </div>

                <div style={{flex: 1}}>
                  <CurrencyConversionPopup
                    transaction={currentTransaction}
                    sourceCurrency={sourceCashFlow.currency}
                    targetCurrency={targetCashFlow.currency}
                    onSubmit={handleCurrencyConversionSubmit}
                    onSkip={() => handleCurrencyConversionSubmit(Math.abs(parseFloat(currentTransaction.amount)))}
                  />
                </div>
              </div>
            ) : null;
          })()
        )}
      </Modal>

      {/* Link Deposit Modal */}
      <Modal
        isOpen={isLinkDepositModalOpen}
        onClose={() => {
          setIsLinkDepositModalOpen(false);
          setDepositToLink(null);
          setLinkingCashFlowId('');
          setSelectedExpense(null);
          setPotentialExpenses([]);
        }}
        title="קישור הפקדה להוצאה"
      >
        {depositToLink && (
          <div>
            <div style={{marginBottom: '1.5rem', padding: '12px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb', borderRadius: '4px'}}>
              <h5>הפקדה לקישור:</h5>
              <div><strong>תאריך:</strong> {new Date(depositToLink.payment_date).toLocaleDateString('he-IL')}</div>
              <div><strong>סכום:</strong> {Math.abs(parseFloat(depositToLink.amount)).toLocaleString()} USD</div>
              <div><strong>עסק:</strong> {depositToLink.business_name}</div>
            </div>

            <div className="form-group" style={{marginBottom: '1rem'}}>
              <label className="form-label">בחר תזרים למציאת הוצאות:</label>
              <select
                className="form-control"
                value={linkingCashFlowId}
                onChange={(e) => {
                  setLinkingCashFlowId(e.target.value);
                  fetchPotentialExpenses(e.target.value);
                }}
              >
                <option value="">-- בחר תזרים --</option>
                {cashFlows?.cashFlows?.filter(cf => cf.id !== 'bbdb9129-5d88-4d36-b2d8-4345aa3fcd54').map(cashFlow => (
                  <option key={cashFlow.id} value={cashFlow.id}>
                    {cashFlow.name} ({cashFlow.currency})
                  </option>
                ))}
              </select>
            </div>

            {potentialExpenses.length > 0 && (
              <div className="form-group" style={{marginBottom: '1rem'}}>
                <label className="form-label">בחר הוצאה לקישור:</label>
                <div style={{maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px'}}>
                  {potentialExpenses.map(expense => (
                    <div
                      key={expense.id}
                      className={`expense-item ${selectedExpense?.id === expense.id ? 'selected' : ''}`}
                      style={{
                        padding: '10px',
                        borderBottom: '1px solid #eee',
                        cursor: 'pointer',
                        backgroundColor: selectedExpense?.id === expense.id ? '#e3f2fd' : 'white'
                      }}
                      onClick={() => setSelectedExpense(expense)}
                    >
                      <div><strong>{expense.business_name}</strong></div>
                      <div>{new Date(expense.payment_date).toLocaleDateString('he-IL')} - {parseFloat(expense.amount).toLocaleString()} {expense.currency || 'ILS'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedExpense && depositToLink && (
              <div style={{marginTop: '1rem', padding: '12px', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px'}}>
                <h6>חישוב שער חליפין:</h6>
                <div>
                  {parseFloat(selectedExpense.amount).toLocaleString()} {selectedExpense.currency || 'ILS'} = {Math.abs(parseFloat(depositToLink.amount)).toLocaleString()} USD
                </div>
                <div>
                  <strong>שער החליפין: </strong>
                  {(parseFloat(selectedExpense.amount) / Math.abs(parseFloat(depositToLink.amount))).toFixed(4)} {selectedExpense.currency || 'ILS'} ל-USD
                </div>
              </div>
            )}

            <div className="modal-footer" style={{display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '1rem', borderTop: '1px solid #e9ecef', marginTop: '1.5rem'}}>
              <button
                type="button"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                onClick={() => {
                  setIsLinkDepositModalOpen(false);
                  setDepositToLink(null);
                  setLinkingCashFlowId('');
                  setSelectedExpense(null);
                  setPotentialExpenses([]);
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleConfirmLink}
                disabled={!selectedExpense || linkDepositMutation.isLoading}
              >
                {linkDepositMutation.isLoading ? 'יוצר קישור...' : 'צור קישור'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Transactions;
