import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { transactionsAPI, categoriesAPI, cashFlowsAPI } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import Modal from '../../components/Common/Modal';
import './Transactions.css';

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
          className="btn btn-secondary"
          onClick={onSkip}
          style={{padding: '10px 20px', minHeight: '40px'}}
        >
          דלג (השתמש בסכום המקורי)
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!targetAmount || isNaN(targetAmount) || parseFloat(targetAmount) <= 0}
          style={{padding: '10px 20px', minHeight: '40px'}}
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
    category_id: '',
    description: '',
    payment_method: 'credit_card',
    currency: 'ILS'
  });

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
      flow_month: showAll ? undefined : `${year}-${String(month).padStart(2, '0')}`,
      cash_flow_id: selectedCashFlow?.id,
      category_id: selectedCategory || undefined,
      q: searchQuery || undefined,
      notes: notesQuery || undefined,
      page: page,
      per_page: 50,
      show_all: showAll
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
      category_id: '',
      description: '',
      payment_method: 'credit_card',
      currency: 'ILS'
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const transactionData = {
      ...formData,
      cash_flow_id: selectedCashFlow?.id,
      amount: parseFloat(formData.amount)
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
      amount: Math.abs(transaction.amount).toString(),
      payment_date: transaction.payment_date?.split('T')[0] || '',
      category_id: transaction.category_id || '',
      description: transaction.description || '',
      payment_method: transaction.payment_method || 'credit_card',
      currency: transaction.currency || 'ILS'
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק את התנועה?')) {
      deleteTransactionMutation.mutate(id);
    }
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
      updates: { category_id: categoryId }
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

    const targetCashFlow = cashFlows.find(cf => cf.id === bulkTargetCashFlowId);
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
    <div className="transactions-page">
      <div className="page-header">
        <div className="page-title">
          <h1>תנועות</h1>
          <p className="text-muted">ניהול כל התנועות הכספיות שלכם</p>
        </div>

        <div className="page-controls">
          <button
            className="btn btn-primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            הוספת תנועה
          </button>
          <button
            className="btn btn-info"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'הצג לפי חודש' : 'הצג הכל'}
          </button>
          {transactions?.transactions?.length > 0 && (
            <button
              className="btn btn-success"
              onClick={handleBulkCopy}
              disabled={isProcessingBulkCopy}
            >
              {isProcessingBulkCopy ? 'מעתיק...' : 'העתק הכל לתזרים אחר'}
            </button>
          )}
          {selectedCashFlow && (
            <button
              className="btn btn-danger"
              onClick={() => handleDeleteAllTransactions()}
            >
              מחק את כל התנועות בתזרים
            </button>
          )}
        </div>
      </div>

      <div className="transactions-filters">
        <div className="month-navigation">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigateMonth(-1)}
          >
            ←
          </button>
          <span className="current-month">
            {getMonthName(currentDate)}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigateMonth(1)}
          >
            →
          </button>
        </div>

        <div className="filters-row">
          {cashFlows && cashFlows.length > 1 && (
            <select
              className="form-select"
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
            className="form-select"
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
            className="form-input"
            placeholder="חיפוש..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <input
            type="text"
            className="form-input"
            placeholder="חיפוש בהערות..."
            value={notesQuery}
            onChange={(e) => setNotesQuery(e.target.value)}
          />
        </div>

        {selectedTransactions.length > 0 && (
          <div className="batch-actions">
            <span className="selected-count">
              {selectedTransactions.length} תנועות נבחרו
            </span>
            <select
              className="form-select"
              onChange={(e) => {
                if (e.target.value) {
                  handleBatchCategorize(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="">הגדרת קטגוריה</option>
              {categories?.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="transactions-content">
        {transactions?.transactions?.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>
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
                  <th>תאריך</th>
                  <th>עסק</th>
                  <th>סכום</th>
                  <th>קטגוריה</th>
                  <th>הערות</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {transactions.transactions.map(transaction => (
                  <tr key={transaction.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedTransactions.includes(transaction.id)}
                        onChange={() => handleSelectTransaction(transaction.id)}
                      />
                    </td>
                    <td>{formatDate(transaction.payment_date)}</td>
                    <td>{transaction.business_name}</td>
                    <td className={`currency ${parseFloat(transaction.amount) >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(Math.abs(parseFloat(transaction.amount)), transaction.currency)}
                    </td>
                    <td>
                      <span className="category-badge">
                        {transaction.category_name || 'לא מסווג'}
                      </span>
                    </td>
                    <td>{transaction.description || '-'}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => window.location.href = `/transaction/${transaction.id}`}
                        >
                          פרטים
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleEdit(transaction)}
                        >
                          עריכה
                        </button>
                        <button
                          className="btn btn-sm btn-info"
                          onClick={() => handleCopy(transaction)}
                        >
                          העתקה
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
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
                            className="btn btn-sm btn-success"
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
          <div className="empty-state">
            <p>לא נמצאו תנועות לחודש זה</p>
          </div>
        )}

        {transactions?.pagination && (
          <div className="pagination">
            <button
              className="btn btn-secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              הקודם
            </button>
            <span className="page-info">
              עמוד {page} מתוך {transactions.pagination.total_pages}
            </span>
            <button
              className="btn btn-secondary"
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
      >
        <form onSubmit={handleSubmit}>
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
              className="form-input"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              required
            />
          </div>

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
              value={formData.category_id}
              onChange={(e) => setFormData({...formData, category_id: e.target.value})}
            >
              <option value="">בחר קטגוריה</option>
              {categories?.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
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
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows="3"
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              ביטול
            </button>
            <button
              type="submit"
              className="btn btn-primary"
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
      >
        <form onSubmit={handleSubmit}>
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
              className="form-input"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              required
            />
          </div>

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
              value={formData.category_id}
              onChange={(e) => setFormData({...formData, category_id: e.target.value})}
            >
              <option value="">בחר קטגוריה</option>
              {categories?.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
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
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows="3"
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditModalOpen(false)}
            >
              ביטול
            </button>
            <button
              type="submit"
              className="btn btn-primary"
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
                className="btn btn-secondary"
                onClick={() => {
                  setIsCopyModalOpen(false);
                  setTransactionToCopy(null);
                  setTargetCashFlowId('');
                  setIsForeignCurrency(false);
                  setForeignAmount('');
                  setExchangeRate('');
                }}
                style={{padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px'}}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCopySubmit}
                disabled={!targetCashFlowId || copyTransactionMutation.isLoading || (isForeignCurrency && (!foreignAmount || !exchangeRate))}
                style={{
                  padding: '8px 16px', 
                  backgroundColor: targetCashFlowId && (!isForeignCurrency || (foreignAmount && exchangeRate)) ? '#007bff' : '#ccc', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: targetCashFlowId && (!isForeignCurrency || (foreignAmount && exchangeRate)) ? 'pointer' : 'not-allowed'
                }}
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
                className="btn btn-secondary"
                onClick={() => setIsBulkCopyModalOpen(false)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-primary"
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
                className="btn btn-secondary"
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
                className="btn btn-primary"
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