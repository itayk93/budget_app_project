import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { cashFlowsAPI } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';
import CategoryDropdown from './CategoryDropdown';
import Modal from '../Common/Modal';
import './TransactionReviewModal.css';

// Import services
import categoryService from './services/CategoryService';
import duplicateService from './services/DuplicateService';
import foreignCurrencyService from './services/ForeignCurrencyService';
import transactionProcessingService from './services/TransactionProcessingService';

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
  const [showNonCashFlowOnly] = useState(false);
  
  // Source cash flow selection state
  const [selectedSourceCashFlowId, setSelectedSourceCashFlowId] = useState(cashFlowId || '');

  // Load categories when modal opens
  useEffect(() => {
    if (isOpen && categoryService.getCategories().length === 0) {
      categoryService.loadCategories().then(result => {
        if (result && Array.isArray(result) && result.length > 0) {
          console.log('🔍 [MODAL DEBUG] Setting categories from API:', result);
          // Build hierarchy from database categories
          const hierarchicalCategories = categoryService.buildCategoryHierarchy(result);
          console.log('🔍 [MODAL DEBUG] Setting hierarchical categories:', hierarchicalCategories);
          setCategories(hierarchicalCategories);
        } else {
          console.log('🔄 [MODAL DEBUG] No categories - setting empty array');
          setCategories([]);
        }
      });
    }
  }, [isOpen]);

  // Fetch cash flows for transfer modal
  const { data: cashFlows = [] } = useQuery(
    ['cashFlows'],
    cashFlowsAPI.getAll,
    {
      enabled: isOpen,
      refetchOnWindowFocus: false,
      staleTime: 0, // Always fetch fresh data
      cacheTime: 0  // Don't cache the data
    }
  );

  // Debug cash flows data when received
  useEffect(() => {
    if (cashFlows && cashFlows.length > 0) {
      console.log('🔍 [CASH FLOWS DEBUG] Received cash flows:', cashFlows);
      console.log('🔍 [CASH FLOWS DEBUG] Cash flows count:', cashFlows.length);
      cashFlows.forEach((flow, index) => {
        console.log(`🔍 [CASH FLOWS DEBUG] Flow ${index + 1}:`, {
          id: flow.id,
          name: flow.name,
          user_id: flow.user_id,
          currency: flow.currency
        });
      });
    }
  }, [cashFlows]);

  // Filter categories based on non-cash flow checkbox
  useEffect(() => {
    const filtered = categoryService.filterCategories(categories, showNonCashFlowOnly);
    setFilteredCategories(filtered);
  }, [categories, showNonCashFlowOnly]);

  // Initialize edited transactions when modal opens
  useEffect(() => {
    if (isOpen && transactions.length > 0) {
      const transactionsWithRecipients = transactionProcessingService.initializeTransactions(
        transactions, 
        duplicateService.getSkipDuplicates()
      );

      setEditedTransactions(transactionsWithRecipients);
      setDeletedTransactionIds(new Set());
      
      // Initialize duplicate service
      duplicateService.initializeDuplicates(transactionsWithRecipients);

      // Auto-suggest categories for business names
      transactionProcessingService.autoSuggestCategories(transactionsWithRecipients, setEditedTransactions);
    }
  }, [isOpen, transactions]);

  const handleTransactionChange = (tempId, field, value) => {
    transactionProcessingService.handleTransactionChange(
      editedTransactions, 
      setEditedTransactions, 
      tempId, 
      field, 
      value
    );
  };

  const handleDeleteTransaction = (tempId) => {
    duplicateService.handleDeleteTransaction(
      tempId,
      editedTransactions,
      deletedTransactionIds,
      setEditedTransactions,
      setDeletedTransactionIds
    );
  };

  const handleCategoryChange = (tempId, categoryData) => {
    transactionProcessingService.handleCategoryChange(
      tempId, 
      categoryData, 
      (field, value) => handleTransactionChange(tempId, field, value)
    );
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const { transactions: finalTransactions, deletedIndices } = 
        transactionProcessingService.prepareFinalTransactions(editedTransactions, deletedTransactionIds);

      // Prepare duplicate handling data
      const duplicateActions = duplicateService.prepareDuplicateActions(editedTransactions);

      // Call parent's confirm handler
      await onConfirm({
        transactions: finalTransactions,
        deletedIndices,
        duplicateActions,
        cashFlowId: selectedSourceCashFlowId
      });
    } catch (error) {
      console.error('Error confirming transactions:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle foreign currency copy
  const handleForeignCopy = (transaction) => {
    foreignCurrencyService.openForeignCopyModal(transaction, cashFlows, cashFlowId);
  };

  // Handle foreign currency submit
  const handleForeignCopySubmit = () => {
    try {
      const { transaction: newTransaction, message } = foreignCurrencyService.createForeignCopyTransaction(
        cashFlows, 
        selectedSourceCashFlowId
      );

      // Add the new transaction to the edited transactions list
      setEditedTransactions(prev => [...prev, newTransaction]);

      console.log('✅ [FOREIGN COPY] Added new transaction:', newTransaction);
      alert(message);
      
      // Close the modal and reset state
      foreignCurrencyService.closeModal();
    } catch (error) {
      alert(error.message);
    }
  };

  // Get foreign currency modal state
  const foreignModalState = foreignCurrencyService.getModalState();

  if (!isOpen) return null;

  return (
    <div className="transaction-review-modal-overlay">
      <div className="transaction-review-modal">
        <div className="modal-header">
          <div className="header-content-centered">
            <h2>בדיקת עסקאות לפני העלאה</h2>
          </div>
        </div>

        <div className="modal-body">
          {categoryService.getLoadingState() && categoryService.getCategories().length === 0 && editedTransactions.length === 0 ? (
            <div className="loading-container">
              <div className="d-flex flex-column align-center justify-center gap-md">
                <div className="spinner w-8 h-8"></div>
                <span className="text-muted text-sm">טוען קטגוריות...</span>
                <span className="text-muted text-xs">categoriesLoading: {String(categoryService.getLoadingState())}</span>
              </div>
            </div>
          ) : categoryService.getError() ? (
            <div className="error-container">
              <p>שגיאה בטעינת קטגוריות: {categoryService.getError().message}</p>
              <p>ממשיך עם רשימת קטגוריות מוגבלת</p>
            </div>
          ) : null}
          
          {/* Show transactions even if categories are still loading */}
          {(editedTransactions.length > 0 || !categoryService.getLoadingState()) && (
            <>
              {/* Combined Summary and Cash Flow Selection */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0px',
                gap: '16px'
              }} className="summary-cashflow-row">
                {/* Left Side - Summary */}
                <div className="transactions-summary" style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  flex: '1',
                  minWidth: '0'
                }}>
                <div className="summary-item">
                  <span className="label">סה״כ עסקאות:</span>
                  <span className="value">{editedTransactions.length}</span>
                </div>
                {duplicateService.getDuplicateTransactionIds().size > 0 && (
                  <div className="summary-item">
                    <span className="label">כפילויות:</span>
                    <span className="value warning">{duplicateService.getDuplicateTransactionIds().size}</span>
                  </div>
                )}
                <div className="summary-item">
                  <span className="label">נמחקו:</span>
                  <span className="value deleted">{deletedTransactionIds.size}</span>
                </div>
                <div className="summary-item">
                  <span className="label">יועלו:</span>
                  <span className="value active">
                    {editedTransactions.length}
                  </span>
                </div>
                </div>

                {/* Right Side - Cash Flow Selection */}
                <div className="cash-flow-selection" style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e0e0e0',
                  flexShrink: 0
                }}>
                  <label style={{ fontSize: '14px', fontWeight: '500', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                    תזרים יעד:
                  </label>
                  <select
                    value={selectedSourceCashFlowId}
                    onChange={(e) => setSelectedSourceCashFlowId(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      fontSize: '14px',
                      minWidth: '180px'
                    }}
                  >
                    <option value="">בחר תזרים...</option>
                    {cashFlows?.map(cashFlow => (
                      <option key={cashFlow.id} value={cashFlow.id}>
                        {cashFlow.name} ({cashFlow.currency || 'ILS'})
                      </option>
                    ))}
                  </select>
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
                      <th>עדכן</th>
                      <th>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedTransactions.map((transaction) => {
                      const isDuplicate = transaction.isDuplicate;
                      const isDifferentCashFlow = transactionProcessingService.isFromDifferentCashFlow(
                        transaction, 
                        selectedSourceCashFlowId
                      );
                      const rowClass = `transaction-row ${isDuplicate ? 'duplicate-row' : ''} ${isDifferentCashFlow ? 'different-cash-flow' : ''}`;
                      
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
                              <span className="duplicate-badge">
                                כפול
                              </span>
                            )}
                          </div>
                          {(isDifferentCashFlow || foreignCurrencyService.detectForeignCurrency(transaction.business_name)) && (
                            <div className="buttons-container" style={{
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: '8px',
                              marginTop: '4px',
                              flexWrap: 'wrap'
                            }}>
                              {isDifferentCashFlow && (
                                <span className="cash-flow-badge" style={{
                                  background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                                  color: 'white',
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontWeight: '500'
                                }}>
                                  → {transactionProcessingService.getTargetCashFlowName(transaction, cashFlows)}
                                </span>
                              )}
                              {foreignCurrencyService.detectForeignCurrency(transaction.business_name) && (
                                <button
                                  type="button"
                                  className="foreign-currency-btn"
                                  onClick={() => handleForeignCopy(transaction)}
                                  title={`זוהה מטבע זר: ${foreignCurrencyService.detectForeignCurrency(transaction.business_name)} - לחץ להעתקה לתזרים אחר`}
                                  style={{
                                    background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: 'white',
                                    fontSize: '12px',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                  }}
                                >
                                  {foreignCurrencyService.detectForeignCurrency(transaction.business_name)} 🔄
                                </button>
                              )}
                            </div>
                          )}
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
                              {foreignCurrencyService.formatAmount(transaction.amount || 0, transaction.currency || 'ILS')}
                            </span>
                          </div>
                        </td>
                        <td>
                          <CategoryDropdown
                            value={transaction.category_name || ''}
                            onChange={(categoryData) => handleCategoryChange(transaction.tempId, categoryData)}
                            categories={filteredCategories}
                            placeholder="בחר קטגוריה..."
                            preserveOrder={true}
                            useHierarchy={true}
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
                          {isDuplicate ? (
                            <div className="duplicate-action-checkbox">
                              <input
                                type="checkbox"
                                id={`replace-${transaction.tempId}`}
                                checked={duplicateService.getReplaceAction(transaction.tempId)}
                                onChange={(e) => {
                                  duplicateService.setReplaceAction(transaction.tempId, e.target.checked);
                                }}
                                className="duplicate-checkbox"
                              />
                              <label htmlFor={`replace-${transaction.tempId}`} className="checkbox-label">
                                {duplicateService.getReplaceAction(transaction.tempId) ? 'החלף' : 'כפל'}
                              </label>
                            </div>
                          ) : (
                            <span className="no-action">-</span>
                          )}
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
                    const isDifferentCashFlow = transactionProcessingService.isFromDifferentCashFlow(
                      transaction, 
                      selectedSourceCashFlowId
                    );
                    const cardClass = `transaction-card ${isDuplicate ? 'duplicate-card' : ''} ${isDifferentCashFlow ? 'different-cash-flow' : ''}`;
                    
                    return (
                    <div key={transaction.tempId} className={cardClass}>
                      <div className="card-header">
                        <div className="card-title">
                          {transaction.business_name || 'שם העסק'}
                          {isDuplicate && (
                            <span className="duplicate-badge mobile">
                              כפול
                            </span>
                          )}
                          {isDifferentCashFlow && (
                            <span className="cash-flow-badge mobile" style={{
                              background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                              color: 'white',
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              marginLeft: '6px',
                              fontWeight: '500'
                            }}>
                              → {transactionProcessingService.getTargetCashFlowName(transaction, cashFlows)}
                            </span>
                          )}
                        </div>
                        <div className={`card-amount ${transaction.amount >= 0 ? 'positive' : 'negative'}`}>
                          {foreignCurrencyService.formatAmount(transaction.amount || 0, transaction.currency || 'ILS')}
                        </div>
                      </div>

                      <div className="card-field date-delete-row">
                        <input
                          type="date"
                          value={transaction.payment_date?.split('T')[0] || transaction.transaction_date?.split('T')[0] || ''}
                          onChange={(e) => handleTransactionChange(
                            transaction.tempId, 
                            'payment_date', 
                            e.target.value
                          )}
                        />
                        <button
                          onClick={() => handleDeleteTransaction(transaction.tempId)}
                          className="delete-button"
                          title="מחק עסקה"
                        >
                          מחק
                        </button>
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
                          preserveOrder={true}
                          useHierarchy={true}
                        />
                      </div>

                      <div className="card-field">
                        <label>מקבל</label>
                        <input
                          type="text"
                          value={transaction.recipient_name || ''}
                          onChange={(e) => handleTransactionChange(
                            transaction.tempId, 
                            'recipient_name', 
                            e.target.value
                          )}
                          placeholder="שם המקבל..."
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

                      {isDuplicate && (
                        <div className="card-field duplicate-action-mobile">
                          <label>פעולה עבור כפילות</label>
                          <div className="duplicate-action-checkbox mobile">
                            <input
                              type="checkbox"
                              id={`replace-mobile-${transaction.tempId}`}
                              checked={duplicateService.getReplaceAction(transaction.tempId)}
                              onChange={(e) => {
                                duplicateService.setReplaceAction(transaction.tempId, e.target.checked);
                              }}
                              className="duplicate-checkbox"
                            />
                            <label htmlFor={`replace-mobile-${transaction.tempId}`} className="checkbox-label">
                              {duplicateService.getReplaceAction(transaction.tempId) 
                                ? 'החלף את הרשומה הקיימת' 
                                : 'צור רשומה חדשה כפולה'
                              }
                            </label>
                          </div>
                        </div>
                      )}
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

        <div className="modal-footer" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '15px 30px',
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#fafafa'
        }}>
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              fontSize: '13px',
              padding: '6px 12px',
              minHeight: '32px'
            }}
          >
            ביטול
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleConfirm}
            disabled={isSubmitting || editedTransactions.length === 0 || !selectedSourceCashFlowId}
            style={{
              fontSize: '13px',
              padding: '6px 12px',
              minHeight: '32px'
            }}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="small" />
                מעלה...
              </>
            ) : (
              `אשר והעלה ${editedTransactions.length} עסקאות`
            )}
          </button>
        </div>
      </div>

      {/* Foreign Currency Copy Modal */}
      <Modal
        isOpen={foreignModalState.isOpen}
        onClose={() => foreignCurrencyService.closeModal()}
        title="העתקת עסקה עם מטבע זר לתזרים אחר"
      >
        {foreignModalState.selectedTransaction && (
          <div>
            <p style={{marginBottom: '1rem'}}>
              זוהה מטבע זר בשם העסק. העתק את העסקה לתזרים המתאים:
            </p>
            
            <div className="form-group" style={{marginBottom: '1rem'}}>
              <label className="form-label">תזרים יעד:</label>
              <select 
                className="form-select" 
                value={foreignModalState.targetCashFlowId}
                onChange={(e) => foreignCurrencyService.setTargetCashFlowId(e.target.value)}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
              >
                <option value="">בחר תזרים יעד...</option>
                {foreignCurrencyService.getFilteredCashFlows(cashFlows, selectedSourceCashFlowId).map(cashFlow => (
                  <option key={cashFlow.id} value={cashFlow.id}>
                    {cashFlow.name} ({cashFlow.currency || 'ILS'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{marginBottom: '1rem'}}>
              <label className="form-label">מטבע זר:</label>
              <select
                className="form-select"
                value={foreignModalState.foreignCurrency}
                onChange={(e) => foreignCurrencyService.setForeignCurrency(e.target.value)}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
              >
                <option value="USD">דולר אמריקאי (USD)</option>
                <option value="EUR">יורו (EUR)</option>
                <option value="GBP">פאונד (GBP)</option>
                <option value="CHF">פרנק שוויצרי (CHF)</option>
                <option value="JPY">ין יפני (JPY)</option>
                <option value="CAD">דולר קנדי (CAD)</option>
                <option value="AUD">דולר אוסטרלי (AUD)</option>
                <option value="SEK">קרונה שוודית (SEK)</option>
                <option value="NOK">קרונה נורבגית (NOK)</option>
                <option value="DKK">קרונה דנית (DKK)</option>
              </select>
            </div>

            <div className="form-group" style={{marginBottom: '1rem'}}>
              <label className="form-label">סכום במטבע זר ({foreignModalState.foreignCurrency}):</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={foreignModalState.foreignAmount}
                onChange={(e) => foreignCurrencyService.handleForeignAmountChange(e.target.value)}
                placeholder={`כמה ${foreignModalState.foreignCurrency} קנית?`}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
              />
            </div>

            {foreignModalState.exchangeRate && (
              <div className="form-group" style={{marginBottom: '1rem'}}>
                <label className="form-label">שער חליפין (חושב אוטומטית):</label>
                <input
                  type="number"
                  step="0.0001"
                  className="form-input"
                  value={foreignModalState.exchangeRate}
                  onChange={(e) => foreignCurrencyService.setExchangeRate(e.target.value)}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
                />
                <small style={{color: '#666', fontSize: '12px'}}>
                  1 {foreignModalState.foreignCurrency} = {foreignModalState.exchangeRate} ₪
                </small>
              </div>
            )}

            <div style={{margin: '1rem 0', padding: '12px', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px'}}>
              <div><strong>עסקה:</strong> {foreignModalState.selectedTransaction.business_name}</div>
              <div><strong>סכום מקורי:</strong> {Math.abs(parseFloat(foreignModalState.selectedTransaction.amount)).toLocaleString()} ₪</div>
              <div><strong>העסקה תועתק כ:</strong> הכנסה של {foreignModalState.foreignAmount} {foreignModalState.foreignCurrency} בתזרים היעד</div>
            </div>

            <div className="alert alert-info" style={{padding: '12px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb', borderRadius: '4px', marginBottom: '1rem'}}>
              <strong>💡 הסבר:</strong> העסקה תועתק לתזרים היעד כהכנסה במטבע זר. 
              זה מתאים כאשר קנית מטבע זר (למשל: שילמת 198.6 ₪ וקנית 50 יורו).
            </div>

            <div className="modal-footer" style={{
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '8px', 
              paddingTop: '8px', 
              borderTop: '1px solid #e9ecef'
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => foreignCurrencyService.closeModal()}
                style={{
                  fontSize: '13px',
                  padding: '6px 12px',
                  minHeight: '32px'
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleForeignCopySubmit}
                disabled={!foreignModalState.targetCashFlowId || !foreignModalState.foreignAmount || !foreignModalState.exchangeRate}
                style={{
                  fontSize: '13px',
                  padding: '6px 12px',
                  minHeight: '32px'
                }}
              >
                העתק לתזרים
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransactionReviewModal;