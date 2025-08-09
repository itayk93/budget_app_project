import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { categoriesAPI, transactionsAPI } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';
import CategoryDropdown from './CategoryDropdown';
import './TransactionReviewModal.css';

const TransactionReviewModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  transactions = [], 
  fileSource,
  cashFlowId
}) => {
  const [editedTransactions, setEditedTransactions] = useState([]);
  const [deletedTransactionIds, setDeletedTransactionIds] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [showNonCashFlowOnly, setShowNonCashFlowOnly] = useState(false);
  
  // Duplicate handling state
  const [duplicateTransactionIds, setDuplicateTransactionIds] = useState(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true); // Default to skip duplicates
  const [showDeleteDuplicatesButton, setShowDeleteDuplicatesButton] = useState(false);

  // Fetch categories for dropdown - using regular categories API for now
  const { data: categoriesData = [], isLoading: categoriesLoading, error: categoriesError } = useQuery(
    ['categories'],
    () => {
      console.log('🔍 [React Query] Executing categories query...');
      return categoriesAPI.getAll();
    },
    {
      enabled: isOpen,
      onSuccess: (data) => {
        console.log('🔍 [React Query] Categories query success:', data);
      },
      onError: (error) => {
        console.error('❌ [React Query] Categories query error:', error);
      }
    }
  );

  // Handle categories data when received
  useEffect(() => {
    if (categoriesData && Array.isArray(categoriesData) && categoriesData.length > 0) {
      console.log('🔍 [MODAL DEBUG] Setting categories from API:', categoriesData);
      // For regular categories API, just extract category names
      const categoryNames = categoriesData
        .map(cat => cat.category_name || cat.name)
        .filter(name => name !== null && name !== undefined && name !== '');
      console.log('🔍 [MODAL DEBUG] Extracted category names:', categoryNames);
      setCategories(categoryNames);
    }
  }, [categoriesData]);

  // Filter categories based on non-cash flow checkbox
  useEffect(() => {
    if (showNonCashFlowOnly) {
      const nonCashFlowCategories = categories.filter(categoryName => 
        categoryName.includes('לא תזרימיות')
      );
      setFilteredCategories(nonCashFlowCategories);
    } else {
      setFilteredCategories(categories);
    }
  }, [categories, showNonCashFlowOnly]);

  // Initialize edited transactions when modal opens
  useEffect(() => {
    if (isOpen && transactions.length > 0) {
      console.log('🔍 [MODAL DEBUG] Received transactions:', transactions);
      console.log('🔍 [MODAL DEBUG] First transaction sample:', transactions[0]);
      
      // Initialize transactions with proper IDs
      const processedTransactions = transactions.map((tx, index) => ({
        ...tx,
        tempId: tx.tempId || `temp_${index}`,
        originalIndex: tx.originalIndex !== undefined ? tx.originalIndex : index
      }));
      
      setEditedTransactions(processedTransactions);
      setDeletedTransactionIds(new Set());
      
      // Identify duplicate transactions
      const duplicateIds = new Set();
      processedTransactions.forEach(tx => {
        if (tx.isDuplicate) {
          duplicateIds.add(tx.tempId);
        }
      });
      setDuplicateTransactionIds(duplicateIds);
      
      console.log('🔍 [MODAL DEBUG] Found duplicates:', duplicateIds.size);
      
      // Initialize the delete button state - show only if skipping duplicates and there are duplicates
      if (duplicateIds.size > 0 && skipDuplicates) {
        setShowDeleteDuplicatesButton(true);
      }
    }
  }, [isOpen, transactions, skipDuplicates]);

  const handleTransactionChange = (tempId, field, value) => {
    setEditedTransactions(prev => 
      prev.map(tx => 
        tx.tempId === tempId 
          ? { ...tx, [field]: value }
          : tx
      )
    );
  };

  const handleDeleteTransaction = (tempId) => {
    const transaction = editedTransactions.find(tx => tx.tempId === tempId);
    if (transaction) {
      setDeletedTransactionIds(prev => new Set([...prev, transaction.originalIndex]));
      setEditedTransactions(prev => prev.filter(tx => tx.tempId !== tempId));
      
      // If it was a duplicate, update duplicate tracking
      if (transaction.isDuplicate) {
        setDuplicateTransactionIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempId);
          return newSet;
        });
        
        // Check if we should show delete duplicates button
        const remainingDuplicates = editedTransactions.filter(tx => 
          tx.isDuplicate && tx.tempId !== tempId
        ).length;
        
        if (remainingDuplicates === 0) {
          setShowDeleteDuplicatesButton(false);
          setSkipDuplicates(false);
        } else if (skipDuplicates) {
          setShowDeleteDuplicatesButton(true);
        }
      }
    }
  };

  const handleCategoryChange = (tempId, categoryData) => {
    console.log('🔍 [TransactionReviewModal] Category change:', categoryData);
    
    // Since we're now using unique categories from transactions (just names),
    // we only store the category name and set category_id to null
    if (categoryData && typeof categoryData === 'string' && categoryData !== '__new_category__') {
      handleTransactionChange(tempId, 'category_name', categoryData);
      handleTransactionChange(tempId, 'category_id', null); // No ID needed since we use existing category names
      console.log('✅ [TransactionReviewModal] Set category name:', categoryData);
    } else {
      console.warn('⚠️ Invalid category data:', categoryData);
    }
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // Prepare final transactions (excluding deleted ones and skipped duplicates)
      const finalTransactions = editedTransactions
        .filter(tx => !shouldSkipTransaction(tx))
        .map(tx => {
          const { tempId, originalIndex, isDuplicate, duplicateInfo, ...cleanTx } = tx;
          return cleanTx;
        });

      // Call parent's confirm handler
      await onConfirm({
        transactions: finalTransactions,
        deletedIndices: Array.from(deletedTransactionIds)
      });
    } catch (error) {
      console.error('Error confirming transactions:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to determine if transaction should be skipped
  const shouldSkipTransaction = (tx) => {
    // Skip if duplicate and skipDuplicates is enabled
    return tx.isDuplicate && skipDuplicates;
  };

  // Bulk duplicate handling functions
  const handleToggleAllDuplicates = () => {
    const newSkipValue = !skipDuplicates;
    setSkipDuplicates(newSkipValue);
    
    // Show delete button when skipping duplicates
    if (newSkipValue && duplicateTransactionIds.size > 0) {
      setShowDeleteDuplicatesButton(true);
    } else {
      setShowDeleteDuplicatesButton(false);
    }
  };

  // Delete all duplicate transactions
  const handleDeleteAllDuplicates = () => {
    const duplicateOriginalIndices = new Set();
    editedTransactions.forEach(tx => {
      if (tx.isDuplicate) {
        duplicateOriginalIndices.add(tx.originalIndex);
      }
    });
    
    // Add to deleted set and remove from edited transactions
    setDeletedTransactionIds(prev => new Set([...prev, ...duplicateOriginalIndices]));
    setEditedTransactions(prev => prev.filter(tx => !tx.isDuplicate));
    setDuplicateTransactionIds(new Set());
    setShowDeleteDuplicatesButton(false);
    setSkipDuplicates(false);
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS'
    }).format(Math.abs(amount));
  };


  if (!isOpen) return null;

  return (
    <div className="transaction-review-modal-overlay">
      <div className="transaction-review-modal">
        <div className="modal-header">
          <div className="header-content">
            <div className="header-text">
              <h2>בדיקת עסקאות לפני העלאה</h2>
              <p className="modal-subtitle">
                בדוק את הפרטים ושנה לפי הצורך לפני ההעלאה הסופית.
              </p>
            </div>
            <button className="close-button" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          
          <div className="controls-section">
            <div className="filter-controls">
              <div className="control-group">
                <button 
                  className={`toggle-button ${showNonCashFlowOnly ? 'active' : ''}`}
                  onClick={() => setShowNonCashFlowOnly(!showNonCashFlowOnly)}
                >
                  <svg className="icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  הראה קטגוריות לא תזרימיות בלבד
                </button>
              </div>

              {duplicateTransactionIds.size > 0 && (
                <div className="control-group duplicate-controls">
                  <button 
                    className={`toggle-button duplicate-toggle ${skipDuplicates ? 'active warning' : ''}`}
                    onClick={handleToggleAllDuplicates}
                  >
                    <svg className="icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    דלג על כל הכפילויות ({duplicateTransactionIds.size})
                  </button>
                  
                  {showDeleteDuplicatesButton && (
                    <button 
                      className="action-button delete-duplicates"
                      onClick={handleDeleteAllDuplicates}
                      title="מחק את כל הכפילויות לצמיתות"
                    >
                      <svg className="icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                        <path fillRule="evenodd" d="M10 5a2 2 0 00-2 2v6a2 2 0 004 0V7a2 2 0 00-2-2zM8 7a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2H10a2 2 0 01-2-2V7zM5 4a1 1 0 011-1h8a1 1 0 110 2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V5a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                      מחק כפילויות ({duplicateTransactionIds.size})
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-body">
          {categoriesLoading ? (
            <div className="loading-container">
              <LoadingSpinner size="medium" text="טוען קטגוריות..." />
            </div>
          ) : (
            <>
              <div className="transactions-summary">
                <div className="summary-item">
                  <span className="label">סה״כ עסקאות:</span>
                  <span className="value">{editedTransactions.length}</span>
                </div>
                {duplicateTransactionIds.size > 0 && (
                  <div className="summary-item">
                    <span className="label">כפילויות:</span>
                    <span className="value warning">{duplicateTransactionIds.size}</span>
                  </div>
                )}
                <div className="summary-item">
                  <span className="label">נמחקו:</span>
                  <span className="value deleted">{deletedTransactionIds.size}</span>
                </div>
                <div className="summary-item">
                  <span className="label">יועלו:</span>
                  <span className="value active">
                    {editedTransactions.filter(tx => !shouldSkipTransaction(tx)).length}
                  </span>
                </div>
              </div>

              <div className="transactions-table-container">
                {/* Desktop Table View */}
                <table className="transactions-table">
                  <thead>
                    <tr>
                      <th>תאריך</th>
                      <th>שם העסק</th>
                      <th>סכום</th>
                      <th>קטגוריה</th>
                      <th>הערות</th>
                      <th>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedTransactions.map((transaction) => {
                      const isDuplicate = transaction.isDuplicate;
                      const willBeSkipped = shouldSkipTransaction(transaction);
                      const rowClass = `transaction-row ${isDuplicate ? 'duplicate-row' : ''} ${willBeSkipped ? 'skipped' : ''}`;
                      
                      return (
                      <tr key={transaction.tempId} className={rowClass}>
                        <td>
                          <input
                            type="date"
                            value={transaction.payment_date?.split('T')[0] || transaction.transaction_date?.split('T')[0] || ''}
                            onChange={(e) => handleTransactionChange(
                              transaction.tempId, 
                              'payment_date', 
                              e.target.value
                            )}
                            className="date-input"
                          />
                        </td>
                        <td>
                          <div className="business-name-container">
                            <input
                              type="text"
                              value={transaction.business_name || ''}
                              onChange={(e) => handleTransactionChange(
                                transaction.tempId, 
                                'business_name', 
                                e.target.value
                              )}
                              className="business-input"
                              placeholder="שם העסק"
                            />
                            {isDuplicate && (
                              <span className={`duplicate-badge ${willBeSkipped ? 'skipped' : ''}`}>
                                {willBeSkipped ? 'ידלג' : 'כפול'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="amount-container">
                            <input
                              type="number"
                              step="0.01"
                              value={Math.abs(transaction.amount || 0)}
                              onChange={(e) => handleTransactionChange(
                                transaction.tempId, 
                                'amount', 
                                parseFloat(e.target.value) || 0
                              )}
                              className={`amount-input ${transaction.amount >= 0 ? 'positive' : 'negative'}`}
                            />
                            <span className="amount-display">
                              {formatAmount(transaction.amount || 0)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <CategoryDropdown
                            value={transaction.category_name || ''}
                            onChange={(categoryData) => handleCategoryChange(transaction.tempId, categoryData)}
                            categories={filteredCategories}
                            placeholder="בחר קטגוריה..."
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={transaction.notes || ''}
                            onChange={(e) => handleTransactionChange(
                              transaction.tempId, 
                              'notes', 
                              e.target.value
                            )}
                            className="notes-input"
                            placeholder="הערות..."
                          />
                        </td>
                        <td>
                          <button
                            onClick={() => handleDeleteTransaction(transaction.tempId)}
                            className="delete-button"
                            title="מחק עסקה"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="transactions-mobile">
                  {editedTransactions.map((transaction) => {
                    const isDuplicate = transaction.isDuplicate;
                    const willBeSkipped = shouldSkipTransaction(transaction);
                    const cardClass = `transaction-card ${isDuplicate ? 'duplicate-card' : ''} ${willBeSkipped ? 'skipped' : ''}`;
                    
                    return (
                    <div key={transaction.tempId} className={cardClass}>
                      <div className="card-header">
                        <div className="card-title">
                          {transaction.business_name || 'שם העסק'}
                          {isDuplicate && (
                            <span className={`duplicate-badge mobile ${willBeSkipped ? 'skipped' : ''}`}>
                              {willBeSkipped ? 'ידלג' : 'כפול'}
                            </span>
                          )}
                        </div>
                        <div className={`card-amount ${transaction.amount >= 0 ? 'positive' : 'negative'}`}>
                          {formatAmount(transaction.amount || 0)}
                        </div>
                        <button
                          onClick={() => handleDeleteTransaction(transaction.tempId)}
                          className="delete-button"
                          title="מחק עסקה"
                        >
                          🗑️
                        </button>
                      </div>

                      <div className="card-field">
                        <label>תאריך</label>
                        <input
                          type="date"
                          value={transaction.payment_date?.split('T')[0] || transaction.transaction_date?.split('T')[0] || ''}
                          onChange={(e) => handleTransactionChange(
                            transaction.tempId, 
                            'payment_date', 
                            e.target.value
                          )}
                        />
                      </div>

                      <div className="card-field">
                        <label>שם העסק</label>
                        <input
                          type="text"
                          value={transaction.business_name || ''}
                          onChange={(e) => handleTransactionChange(
                            transaction.tempId, 
                            'business_name', 
                            e.target.value
                          )}
                          placeholder="שם העסק"
                        />
                      </div>

                      <div className="card-field">
                        <label>סכום</label>
                        <input
                          type="number"
                          step="0.01"
                          value={Math.abs(transaction.amount || 0)}
                          onChange={(e) => handleTransactionChange(
                            transaction.tempId, 
                            'amount', 
                            parseFloat(e.target.value) || 0
                          )}
                        />
                      </div>

                      <div className="card-field">
                        <label>קטגוריה</label>
                        <CategoryDropdown
                          value={transaction.category_name || ''}
                          onChange={(categoryData) => handleCategoryChange(transaction.tempId, categoryData)}
                          categories={filteredCategories}
                          placeholder="בחר קטגוריה..."
                        />
                      </div>

                      <div className="card-field">
                        <label>הערות</label>
                        <input
                          type="text"
                          value={transaction.notes || ''}
                          onChange={(e) => handleTransactionChange(
                            transaction.tempId, 
                            'notes', 
                            e.target.value
                          )}
                          placeholder="הערות..."
                        />
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              {editedTransactions.length === 0 && (
                <div className="empty-state">
                  <p>כל העסקאות נמחקו. לא יועלו עסקאות חדשות.</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            ביטול
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleConfirm}
            disabled={isSubmitting || editedTransactions.length === 0}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="small" />
                מעלה עסקאות...
              </>
            ) : (
`אשר והעלה ${editedTransactions.filter(tx => !shouldSkipTransaction(tx)).length} עסקאות`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionReviewModal;