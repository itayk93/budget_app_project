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
  const [skipDuplicates, setSkipDuplicates] = useState(false); // Default to show duplicates in yellow for review
  const [replaceDuplicates, setReplaceDuplicates] = useState(new Map()); // Map of tempId -> boolean (true = replace, false = create new)

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
      
      // Extract recipient names from PAYBOX transactions before setting state
      const transactionsWithRecipients = processedTransactions.map(tx => {
        // For duplicate transactions, prioritize original file data over existing database data
        let notesToProcess = tx.notes;
        let currentRecipientName = tx.recipient_name;
        
        // If this is a duplicate transaction, check if we have original file notes
        if (tx.isDuplicate && tx.duplicateInfo && tx.duplicateInfo.original_notes !== undefined) {
          // Use original notes from the file, not the existing database notes
          notesToProcess = tx.duplicateInfo.original_notes;
          console.log(`🔄 [DUPLICATE FIX] Using original notes for duplicate: "${notesToProcess}" instead of: "${tx.notes}"`);
          
          // If original file notes are null/empty, don't extract recipient
          if (!notesToProcess) {
            console.log(`⚠️ [DUPLICATE FIX] Original file has no notes - skipping recipient extraction`);
            // Keep existing recipient_name if user has manually entered it, or clear if it was auto-extracted
            return {
              ...tx,
              recipient_name: tx.recipient_name || null, // Preserve manual entry or clear auto-extracted
              notes: notesToProcess // Use original file notes (null/empty)
            };
          }
        }
        
        if (tx.business_name && tx.business_name.includes('PAYBOX') && notesToProcess) {
          // Try multiple patterns for recipient extraction
          let recipientMatch = null;
          let pattern = null;
          let recipientName = null;
          
          // Pattern 1: "למי: [name]"
          recipientMatch = notesToProcess.match(/למי:\s*(.+?)(?:\s+(?:some|additional|notes|info|details|comment|remark)|$)/);
          if (recipientMatch) {
            recipientName = recipientMatch[1].trim();
            pattern = new RegExp(`למי:\\s*${recipientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'g');
            console.log(`🎯 [FRONTEND EXTRACTION] Found recipient with "למי:" pattern: "${recipientName}"`);
          } else {
            // Pattern 2: "שובר ל-[name]" or "שוברים ל-[name]" or "שוברים לקניה ב-[name]"
            recipientMatch = notesToProcess.match(/שוברי?ם?\s+ל(?:קניה\s+ב)?-(.+?)(?:\s+|$)/);
            if (recipientMatch) {
              recipientName = recipientMatch[1].trim();
              pattern = new RegExp(`שוברי?ם?\\s+ל(?:קניה\\s+ב)?-${recipientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'g');
              console.log(`🎯 [FRONTEND EXTRACTION] Found recipient with "שובר/שוברים" pattern: "${recipientName}"`);
            }
          }
          
          if (recipientName) {
            // Clean the notes by removing the recipient pattern
            const cleanedNotes = notesToProcess.replace(pattern, '').trim();
            
            return {
              ...tx,
              recipient_name: recipientName,
              notes: cleanedNotes || null
            };
          }
        }
        return tx;
      });

      setEditedTransactions(transactionsWithRecipients);
      setDeletedTransactionIds(new Set());
      
      // Identify duplicate transactions
      const duplicateIds = new Set();
      transactionsWithRecipients.forEach(tx => {
        if (tx.isDuplicate) {
          duplicateIds.add(tx.tempId);
        }
      });
      setDuplicateTransactionIds(duplicateIds);
      
      console.log('🔍 [MODAL DEBUG] Found duplicates:', duplicateIds.size);
      
      // Duplicates are now handled directly with delete button

      // Auto-suggest categories for business names
      autoSuggestCategories(transactionsWithRecipients);
    }
  }, [isOpen, transactions, skipDuplicates]);

  // Auto-suggest categories for business names
  const autoSuggestCategories = async (transactionsToProcess) => {
    try {
      // Get unique business names that don't already have categories
      const businessNamesNeedingCategories = [...new Set(
        transactionsToProcess
          .filter(tx => tx.business_name && !tx.category_name)
          .map(tx => tx.business_name)
      )];

      if (businessNamesNeedingCategories.length === 0) {
        console.log('🔍 [AUTO-CATEGORY] No business names need categories');
        return;
      }

      console.log('🔍 [AUTO-CATEGORY] Processing business names:', businessNamesNeedingCategories);

      // Fetch most common categories for each business
      const categoryPromises = businessNamesNeedingCategories.map(async (businessName) => {
        try {
          const response = await fetch(`/api/transactions-business/businesses/${encodeURIComponent(businessName)}/most-common-category`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            return {
              business_name: businessName,
              most_common_category: data.most_common_category
            };
          }
        } catch (error) {
          console.error(`Error fetching category for ${businessName}:`, error);
        }
        return null;
      });

      const categoryResults = await Promise.all(categoryPromises);
      
      // Update transactions with suggested categories
      setEditedTransactions(prev => 
        prev.map(tx => {
          if (tx.business_name && !tx.category_name) {
            const categoryData = categoryResults.find(result => 
              result && result.business_name === tx.business_name
            );
            
            if (categoryData && categoryData.most_common_category) {
              console.log(`🔍 [AUTO-CATEGORY] Setting ${tx.business_name} to ${categoryData.most_common_category}`);
              return {
                ...tx,
                category_name: categoryData.most_common_category,
                category_id: null
              };
            }
          }
          return tx;
        })
      );

    } catch (error) {
      console.error('Error in auto-suggest categories:', error);
    }
  };

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
      
      // Check if this transaction has duplicate siblings before removing it
      const transactionHash = transaction.transaction_hash;
      const duplicateSiblings = editedTransactions.filter(tx => 
        tx.transaction_hash === transactionHash && tx.tempId !== tempId
      );
      
      console.log(`🗑️ [DELETE] Deleting transaction ${tempId}, hash: ${transactionHash}, siblings: ${duplicateSiblings.length}`);
      
      // Remove the transaction from editedTransactions
      setEditedTransactions(prev => {
        const updated = prev.filter(tx => tx.tempId !== tempId);
        
        // If this transaction had duplicate siblings and now there's only one left,
        // remove the isDuplicate flag from the remaining sibling
        if (transaction.isDuplicate && duplicateSiblings.length === 1) {
          const remainingSibling = duplicateSiblings[0];
          console.log(`✅ [DELETE] Removing duplicate flag from remaining sibling ${remainingSibling.tempId}`);
          return updated.map(tx => 
            tx.tempId === remainingSibling.tempId 
              ? { ...tx, isDuplicate: false, duplicateInfo: null }
              : tx
          );
        }
        
        return updated;
      });
      
      // If it was a duplicate, update duplicate tracking
      if (transaction.isDuplicate) {
        setDuplicateTransactionIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(tempId);
          
          // If only one duplicate sibling remains, remove it from duplicates too
          if (duplicateSiblings.length === 1) {
            newSet.delete(duplicateSiblings[0].tempId);
          }
          
          return newSet;
        });
        
        // Recalculate remaining duplicates after the update
        setTimeout(() => {
          setEditedTransactions(currentTransactions => {
            const remainingDuplicateCount = currentTransactions.filter(tx => tx.isDuplicate).length;
            
            if (remainingDuplicateCount === 0) {
              setSkipDuplicates(false);
            }
            
            return currentTransactions;
          });
        }, 0);
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
      // Prepare final transactions (excluding deleted ones)
      const finalTransactions = editedTransactions
        .map(tx => {
          const { tempId, originalIndex, isDuplicate, duplicateInfo, ...cleanTx } = tx;
          return cleanTx;
        });

      // Prepare duplicate handling data
      const duplicateActions = {};
      replaceDuplicates.forEach((shouldReplace, tempId) => {
        const transaction = editedTransactions.find(tx => tx.tempId === tempId);
        if (transaction && transaction.isDuplicate && transaction.duplicateInfo) {
          duplicateActions[tempId] = {
            shouldReplace,
            originalTransactionId: transaction.duplicateInfo.original_id,
            duplicateHash: transaction.transaction_hash
          };
        }
      });

      // Call parent's confirm handler
      await onConfirm({
        transactions: finalTransactions,
        deletedIndices: Array.from(deletedTransactionIds),
        duplicateActions
      });
    } catch (error) {
      console.error('Error confirming transactions:', error);
    } finally {
      setIsSubmitting(false);
    }
  };


  // Bulk duplicate handling functions
  const handleDeleteAllDuplicatesDirectly = () => {
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
          <div className="header-content-centered">
            <h2>בדיקת עסקאות לפני העלאה</h2>
            
            <div className="controls-inline">
              <button 
                className={`toggle-button compact ${showNonCashFlowOnly ? 'active' : ''}`}
                onClick={() => setShowNonCashFlowOnly(!showNonCashFlowOnly)}
              >
                <svg className="icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                הראה קטגוריות לא תזרימיות בלבד
              </button>

              {duplicateTransactionIds.size > 0 && (
                <>
                  <button 
                    className="action-button compact delete-duplicates"
                    onClick={handleDeleteAllDuplicatesDirectly}
                  >
                    <svg className="icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    מחק כפילויות ({duplicateTransactionIds.size})
                  </button>
                </>
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
                    {editedTransactions.length}
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
                      <th>מקבל</th>
                      <th>הערות</th>
                      <th>עדכן</th>
                      <th>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedTransactions.map((transaction) => {
                      const isDuplicate = transaction.isDuplicate;
                      const rowClass = `transaction-row ${isDuplicate ? 'duplicate-row' : ''}`;
                      
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
                            value={transaction.recipient_name || ''}
                            onChange={(e) => handleTransactionChange(
                              transaction.tempId, 
                              'recipient_name', 
                              e.target.value
                            )}
                            className="notes-input"
                            placeholder="שם המקבל..."
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
                                checked={replaceDuplicates.get(transaction.tempId) || false}
                                onChange={(e) => {
                                  const newMap = new Map(replaceDuplicates);
                                  newMap.set(transaction.tempId, e.target.checked);
                                  setReplaceDuplicates(newMap);
                                }}
                                className="duplicate-checkbox"
                              />
                              <label htmlFor={`replace-${transaction.tempId}`} className="checkbox-label">
                                {replaceDuplicates.get(transaction.tempId) ? 'החלף' : 'כפל'}
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
                    const cardClass = `transaction-card ${isDuplicate ? 'duplicate-card' : ''}`;
                    
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
                        </div>
                        <div className={`card-amount ${transaction.amount >= 0 ? 'positive' : 'negative'}`}>
                          {formatAmount(transaction.amount || 0)}
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
                              checked={replaceDuplicates.get(transaction.tempId) || false}
                              onChange={(e) => {
                                const newMap = new Map(replaceDuplicates);
                                newMap.set(transaction.tempId, e.target.checked);
                                setReplaceDuplicates(newMap);
                              }}
                              className="duplicate-checkbox"
                            />
                            <label htmlFor={`replace-mobile-${transaction.tempId}`} className="checkbox-label">
                              {replaceDuplicates.get(transaction.tempId) 
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