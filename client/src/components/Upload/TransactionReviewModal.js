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
      setEditedTransactions(transactions.map((tx, index) => ({
        ...tx,
        tempId: `temp_${index}`,
        originalIndex: index
      })));
      setDeletedTransactionIds(new Set());
    }
  }, [isOpen, transactions]);

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
      // Prepare final transactions (excluding deleted ones)
      const finalTransactions = editedTransactions.map(tx => {
        const { tempId, originalIndex, ...cleanTx } = tx;
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
          <h2>בדיקת עסקאות לפני העלאה</h2>
          <p className="modal-subtitle">
            זוהו {transactions.length} עסקאות מקובץ {fileSource}. 
            בדוק את הפרטים ושנה לפי הצורך לפני ההעלאה הסופית.
          </p>
          <div className="filter-controls">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={showNonCashFlowOnly}
                onChange={(e) => setShowNonCashFlowOnly(e.target.checked)}
              />
              <span className="checkmark"></span>
              <span className="checkbox-label">הראה קטגוריות לא תזרימיות בלבד</span>
            </label>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
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
                <div className="summary-item">
                  <span className="label">נמחקו:</span>
                  <span className="value deleted">{deletedTransactionIds.size}</span>
                </div>
                <div className="summary-item">
                  <span className="label">יועלו:</span>
                  <span className="value active">{editedTransactions.length}</span>
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
                    {editedTransactions.map((transaction) => (
                      <tr key={transaction.tempId} className="transaction-row">
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
                    ))}
                  </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="transactions-mobile">
                  {editedTransactions.map((transaction) => (
                    <div key={transaction.tempId} className="transaction-card">
                      <div className="card-header">
                        <div className="card-title">{transaction.business_name || 'שם העסק'}</div>
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
                  ))}
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
              `אשר והעלה ${editedTransactions.length} עסקאות`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionReviewModal;