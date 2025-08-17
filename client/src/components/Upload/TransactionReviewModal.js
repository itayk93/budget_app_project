import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'react-query';
import { categoriesAPI, cashFlowsAPI } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';
import CategoryDropdown from './CategoryDropdown';
import Modal from '../Common/Modal';
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
  const [showNonCashFlowOnly] = useState(false);
  
  // Duplicate handling state
  const [duplicateTransactionIds, setDuplicateTransactionIds] = useState(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(false); // Default to show duplicates in yellow for review
  const [replaceDuplicates, setReplaceDuplicates] = useState(new Map()); // Map of tempId -> boolean (true = replace, false = create new)
  
  // Source cash flow selection state
  const [selectedSourceCashFlowId, setSelectedSourceCashFlowId] = useState(cashFlowId || '');
  
  // Foreign currency copy state
  const [isForeignCopyModalOpen, setIsForeignCopyModalOpen] = useState(false);
  const [selectedTransactionForCopy, setSelectedTransactionForCopy] = useState(null);
  const [targetCashFlowId, setTargetCashFlowId] = useState('');
  const [foreignCurrency, setForeignCurrency] = useState('');
  const [foreignAmount, setForeignAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');

  // Simplified categories loading - directly manage loading state
  const [categoriesData, setCategoriesData] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);

  // Load categories when modal opens
  useEffect(() => {
    if (isOpen && categoriesData.length === 0) {
      setCategoriesLoading(true);
      setCategoriesError(null);
      
      console.log('🔍 [CATEGORIES] Starting to load categories...');
      console.log('🔍 [CATEGORIES] Token exists:', !!localStorage.getItem('token'));
      console.log('🔍 [CATEGORIES] Token preview:', localStorage.getItem('token')?.substring(0, 20) + '...');
      
      categoriesAPI.getAll()
        .then(result => {
          console.log('🔍 [CATEGORIES] Raw API response:', result);
          console.log('🔍 [CATEGORIES] Is array?', Array.isArray(result));
          console.log('🔍 [CATEGORIES] Length:', result?.length || 'N/A');
          if (result && result.length > 0) {
            console.log('🔍 [CATEGORIES] First category structure:', result[0]);
          }
          setCategoriesData(result || []);
          setCategoriesLoading(false);
        })
        .catch(error => {
          console.error('❌ [CATEGORIES] Error loading categories:', error);
          console.error('❌ [CATEGORIES] Error status:', error.response?.status);
          console.error('❌ [CATEGORIES] Error message:', error.response?.data);
          console.error('❌ [CATEGORIES] Error headers:', error.response?.headers);
          setCategoriesError(error);
          setCategoriesLoading(false);
          // Set empty array as fallback
          setCategoriesData([]);
        });
    }
  }, [isOpen, categoriesData.length]);

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

  // Build category hierarchy from database categories
  const buildCategoryHierarchy = (categories) => {
    console.log('🔍 [HIERARCHY] Building hierarchy from categories:', categories);
    
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      console.log('⚠️ [HIERARCHY] No categories provided');
      return [];
    }
    
    const hierarchicalCategories = [];
    const processedCategories = new Set();
    
    // First, group categories by shared_category
    const sharedGroups = {};
    const standaloneCategories = [];
    
    categories.forEach(category => {
      const sharedCategory = typeof category === 'object' ? category.shared_category : null;
      const useSharedTarget = typeof category === 'object' ? category.use_shared_target : false;
      
      if (sharedCategory && useSharedTarget) {
        if (!sharedGroups[sharedCategory]) {
          sharedGroups[sharedCategory] = [];
        }
        sharedGroups[sharedCategory].push(category);
      } else {
        standaloneCategories.push(category);
      }
    });
    
    // Add shared category groups first
    Object.entries(sharedGroups).forEach(([sharedCategoryName, groupCategories]) => {
      // Add the shared category as parent
      hierarchicalCategories.push({
        name: sharedCategoryName,
        isParent: true,
        level: 0
      });
      
      // Add children categories
      groupCategories.forEach(category => {
        const categoryName = typeof category === 'string' ? category : (category.name || category.category_name || '');
        hierarchicalCategories.push({
          name: categoryName,
          isChild: true,
          level: 1,
          parent: sharedCategoryName
        });
        processedCategories.add(categoryName);
      });
    });
    
    // Add standalone categories
    standaloneCategories.forEach(category => {
      const categoryName = typeof category === 'string' ? category : (category.name || category.category_name || '');
      if (!processedCategories.has(categoryName)) {
        hierarchicalCategories.push({
          name: categoryName,
          isStandalone: true,
          level: 0
        });
      }
    });
    
    console.log('✅ [HIERARCHY] Built hierarchy:', hierarchicalCategories);
    return hierarchicalCategories;
  };

  // Memoize the hierarchical categories to prevent infinite loops
  const hierarchicalCategories = useMemo(() => {
    console.log('🔍 [MODAL DEBUG] Categories useMemo triggered - categoriesData:', categoriesData);
    console.log('🔍 [MODAL DEBUG] categoriesLoading:', categoriesLoading);
    console.log('🔍 [MODAL DEBUG] Number of categories:', categoriesData.length);
    console.log('🔍 [MODAL DEBUG] categoriesError:', categoriesError);
    console.log('🔍 [MODAL DEBUG] Type of categoriesData:', typeof categoriesData);
    console.log('🔍 [MODAL DEBUG] Array check:', Array.isArray(categoriesData));
    
    if (categoriesData && Array.isArray(categoriesData) && categoriesData.length > 0) {
      console.log('🔍 [MODAL DEBUG] Building hierarchy from API data:', categoriesData);
      if (categoriesData.length > 0) {
        console.log('🔍 [MODAL DEBUG] First 5 categories:', categoriesData.slice(0, 5).map(cat => ({
          name: cat.name,
          category_name: cat.category_name,
          display_order: cat.display_order,
          shared_category: cat.shared_category,
          use_shared_category: cat.use_shared_category
        })));
      }
      // Build hierarchy from database categories
      const hierarchy = buildCategoryHierarchy(categoriesData);
      console.log('🔍 [MODAL DEBUG] Built hierarchical categories:', hierarchy);
      return hierarchy;
    } else if (categoriesData && !Array.isArray(categoriesData)) {
      console.log('⚠️ [MODAL DEBUG] categoriesData is not an array:', typeof categoriesData, categoriesData);
      return [];
    } else {
      console.log('🔄 [MODAL DEBUG] No categories or error - returning empty array');
      console.log('🔄 [MODAL DEBUG] categoriesError:', categoriesError);
      console.log('🔄 [MODAL DEBUG] categoriesLoading:', categoriesLoading);
      console.log('🔄 [MODAL DEBUG] categoriesData.length:', categoriesData?.length || 0);
      // Return empty array - no fallback categories, use only database data
      return [];
    }
  }, [categoriesData]);

  // Filter categories based on non-cash flow checkbox using hierarchical categories directly
  const filteredCategories = useMemo(() => {
    if (showNonCashFlowOnly) {
      return hierarchicalCategories.filter(category => {
        const categoryName = typeof category === 'string' ? category : (category.name || category.category_name || '');
        return categoryName.includes('לא תזרימיות');
      });
    } else {
      return hierarchicalCategories;
    }
  }, [hierarchicalCategories, showNonCashFlowOnly]);

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

      // Prepare duplicate handling data - include ALL duplicates, not just ones with explicit actions
      const duplicateActions = {};
      
      // Process all duplicate transactions
      editedTransactions.forEach(transaction => {
        if (transaction.isDuplicate && transaction.duplicateInfo) {
          const tempId = transaction.tempId;
          const shouldReplace = replaceDuplicates.get(tempId) || false; // Default to false (create duplicate)
          
          duplicateActions[tempId] = {
            shouldReplace,
            originalTransactionId: transaction.duplicateInfo.original_id,
            duplicateHash: transaction.transaction_hash
          };
          
          console.log(`🔄 [DUPLICATE ACTION] ${tempId}: ${shouldReplace ? 'REPLACE' : 'CREATE_NEW'}`);
        }
      });

      // Call parent's confirm handler
      await onConfirm({
        transactions: finalTransactions,
        deletedIndices: Array.from(deletedTransactionIds),
        duplicateActions,
        cashFlowId: selectedSourceCashFlowId
      });
    } catch (error) {
      console.error('Error confirming transactions:', error);
    } finally {
      setIsSubmitting(false);
    }
  };


  // Bulk duplicate handling functions


  const formatAmount = (amount, currency = 'ILS') => {
    const currencySymbols = {
      'ILS': '₪',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'CHF': 'CHF',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr'
    };
    
    const symbol = currencySymbols[currency] || currency;
    return `${symbol} ${Math.abs(amount).toFixed(2)}`;
  };

  // Check if transaction belongs to a different cash flow
  const isFromDifferentCashFlow = (transaction) => {
    return transaction.cash_flow_id && transaction.cash_flow_id !== selectedSourceCashFlowId;
  };

  // Get cash flow name for different cash flow transactions
  const getTargetCashFlowName = (transaction) => {
    if (!transaction.cash_flow_id) return null;
    const targetFlow = cashFlows.find(cf => cf.id === transaction.cash_flow_id);
    return targetFlow?.name || 'תזרים לא ידוע';
  };

  // Detect foreign currency in business name
  const detectForeignCurrency = (businessName) => {
    if (!businessName) return null;
    
    const currencies = {
      'USD': ['USD', 'DOLLAR', 'דולר'],
      'EUR': ['EUR', 'EURO', 'יורו', 'אירו'],
      'GBP': ['GBP', 'POUND', 'פאונד'],
      'CHF': ['CHF', 'FRANC', 'פרנק'],
      'JPY': ['JPY', 'YEN', 'ין יפני'],
      'CAD': ['CAD', 'קנדי'],
      'AUD': ['AUD', 'אוסטרלי'],
      'SEK': ['SEK', 'קרונה'],
      'NOK': ['NOK', 'נורבגי'],
      'DKK': ['DKK', 'דני']
    };
    
    const upperName = businessName.toUpperCase();
    
    for (const [currency, keywords] of Object.entries(currencies)) {
      for (const keyword of keywords) {
        if (upperName.includes(keyword.toUpperCase())) {
          return currency;
        }
      }
    }
    
    return null;
  };

  // Handle foreign currency copy
  const handleForeignCopy = (transaction) => {
    const detectedCurrency = detectForeignCurrency(transaction.business_name);
    console.log('🔄 [FOREIGN COPY] Detected currency:', detectedCurrency);
    console.log('🔄 [FOREIGN COPY] Available cash flows:', cashFlows);
    console.log('🔄 [FOREIGN COPY] Current cash flow ID:', cashFlowId);
    
    setSelectedTransactionForCopy(transaction);
    setForeignCurrency(detectedCurrency || 'USD');
    setForeignAmount('');
    setExchangeRate('');
    setTargetCashFlowId('');
    setIsForeignCopyModalOpen(true);
  };

  // Handle foreign amount change and calculate exchange rate
  const handleForeignAmountChange = (value) => {
    setForeignAmount(value);
    if (value && selectedTransactionForCopy) {
      const originalAmount = Math.abs(parseFloat(selectedTransactionForCopy.amount));
      const foreignAmountNum = parseFloat(value);
      
      if (foreignAmountNum > 0) {
        const rate = originalAmount / foreignAmountNum;
        setExchangeRate(rate.toFixed(4));
      }
    }
  };

  // Submit foreign currency copy
  const handleForeignCopySubmit = () => {
    if (!selectedTransactionForCopy || !targetCashFlowId || !foreignAmount || !exchangeRate) {
      alert('אנא מלא את כל השדות הנדרשים');
      return;
    }

    console.log('🔄 [FOREIGN COPY] Creating new transaction for target cash flow');
    
    // Find the target cash flow to get its details
    const targetCashFlow = cashFlows.find(cf => cf.id === targetCashFlowId);
    if (!targetCashFlow) {
      alert('שגיאה: לא נמצא תזרים יעד');
      return;
    }

    // Create a new transaction based on the original one but for the target cash flow
    const newTransaction = {
      tempId: `foreign_copy_${Date.now()}`,
      user_id: selectedTransactionForCopy.user_id,
      business_name: selectedTransactionForCopy.business_name,
      payment_date: selectedTransactionForCopy.payment_date,
      amount: parseFloat(foreignAmount), // Positive amount for income
      currency: foreignCurrency,
      payment_method: selectedTransactionForCopy.payment_method,
      category_name: 'הכנסות משתנות',
      notes: `העתקה מעסקת מטבע זר - שער חליפין: 1 ${foreignCurrency} = ${exchangeRate} ₪ - העתקה מתזרים ${cashFlows.find(cf => cf.id === selectedSourceCashFlowId)?.name || 'לא ידוע'}`,
      recipient_name: '',
      cash_flow_id: targetCashFlowId,
      is_income: true
    };

    // Add the new transaction to the edited transactions list
    setEditedTransactions(prev => [...prev, newTransaction]);

    console.log('✅ [FOREIGN COPY] Added new transaction:', newTransaction);
    alert(`✅ נוספה עסקה חדשה לתזרים "${targetCashFlow.name}" עבור ${foreignAmount} ${foreignCurrency}\nהעסקה תיווסף לרשימת העסקאות לאישור.`);
    
    // Close the modal and reset state
    setIsForeignCopyModalOpen(false);
    setSelectedTransactionForCopy(null);
    setTargetCashFlowId('');
    setForeignCurrency('');
    setForeignAmount('');
    setExchangeRate('');
  };


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
          {categoriesLoading && categoriesData.length === 0 && editedTransactions.length === 0 ? (
            <div className="loading-container">
              <div className="d-flex flex-column align-center justify-center gap-md">
                <div className="spinner w-8 h-8"></div>
                <span className="text-muted text-sm">טוען קטגוריות...</span>
                <span className="text-muted text-xs">categoriesLoading: {String(categoriesLoading)}</span>
              </div>
            </div>
          ) : categoriesError ? (
            <div className="error-container">
              <p>שגיאה בטעינת קטגוריות: {categoriesError.message}</p>
              <p>ממשיך עם רשימת קטגוריות מוגבלת</p>
            </div>
          ) : null}
          
          {/* Show transactions even if categories are still loading */}
          {(editedTransactions.length > 0 || !categoriesLoading) && (
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
                      const isDifferentCashFlow = isFromDifferentCashFlow(transaction);
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
                          {(isDifferentCashFlow || detectForeignCurrency(transaction.business_name)) && (
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
                                  → {getTargetCashFlowName(transaction)}
                                </span>
                              )}
                              {detectForeignCurrency(transaction.business_name) && (
                                <button
                                  type="button"
                                  className="foreign-currency-btn"
                                  onClick={() => handleForeignCopy(transaction)}
                                  title={`זוהה מטבע זר: ${detectForeignCurrency(transaction.business_name)} - לחץ להעתקה לתזרים אחר`}
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
                                  {detectForeignCurrency(transaction.business_name)} 🔄
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
                              {formatAmount(transaction.amount || 0, transaction.currency || 'ILS')}
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
                    const isDifferentCashFlow = isFromDifferentCashFlow(transaction);
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
                              → {getTargetCashFlowName(transaction)}
                            </span>
                          )}
                        </div>
                        <div className={`card-amount ${transaction.amount >= 0 ? 'positive' : 'negative'}`}>
                          {formatAmount(transaction.amount || 0, transaction.currency || 'ILS')}
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
          
          {/* End of transaction section */}
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
        isOpen={isForeignCopyModalOpen}
        onClose={() => {
          setIsForeignCopyModalOpen(false);
          setSelectedTransactionForCopy(null);
          setTargetCashFlowId('');
          setForeignCurrency('');
          setForeignAmount('');
          setExchangeRate('');
        }}
        title="העתקת עסקה עם מטבע זר לתזרים אחר"
      >
        {selectedTransactionForCopy && (
          <div>
            <p style={{marginBottom: '1rem'}}>
              זוהה מטבע זר בשם העסק. העתק את העסקה לתזרים המתאים:
            </p>
            
            <div className="form-group" style={{marginBottom: '1rem'}}>
              <label className="form-label">תזרים יעד:</label>
              <select 
                className="form-select" 
                value={targetCashFlowId}
                onChange={(e) => setTargetCashFlowId(e.target.value)}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
              >
                <option value="">בחר תזרים יעד...</option>
                {(() => {
                  const filteredFlows = cashFlows?.filter(cf => 
                    cf.id !== selectedSourceCashFlowId && 
                    cf.currency === foreignCurrency
                  ) || [];
                  console.log('🔄 [FOREIGN COPY] Filtered flows for currency', foreignCurrency, ':', filteredFlows);
                  return filteredFlows.map(cashFlow => (
                    <option key={cashFlow.id} value={cashFlow.id}>
                      {cashFlow.name} ({cashFlow.currency || 'ILS'})
                    </option>
                  ));
                })()}
              </select>
            </div>

            <div className="form-group" style={{marginBottom: '1rem'}}>
              <label className="form-label">מטבע זר:</label>
              <select
                className="form-select"
                value={foreignCurrency}
                onChange={(e) => {
                  console.log('🔄 [FOREIGN COPY] Currency changed to:', e.target.value);
                  setForeignCurrency(e.target.value);
                  setTargetCashFlowId(''); // Reset target flow when currency changes
                }}
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
              <label className="form-label">סכום במטבע זר ({foreignCurrency}):</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={foreignAmount}
                onChange={(e) => handleForeignAmountChange(e.target.value)}
                placeholder={`כמה ${foreignCurrency} קנית?`}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
              />
            </div>

            {exchangeRate && (
              <div className="form-group" style={{marginBottom: '1rem'}}>
                <label className="form-label">שער חליפין (חושב אוטומטית):</label>
                <input
                  type="number"
                  step="0.0001"
                  className="form-input"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
                />
                <small style={{color: '#666', fontSize: '12px'}}>
                  1 {foreignCurrency} = {exchangeRate} ₪
                </small>
              </div>
            )}

            <div style={{margin: '1rem 0', padding: '12px', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px'}}>
              <div><strong>עסקה:</strong> {selectedTransactionForCopy.business_name}</div>
              <div><strong>סכום מקורי:</strong> {Math.abs(parseFloat(selectedTransactionForCopy.amount)).toLocaleString()} ₪</div>
              <div><strong>העסקה תועתק כ:</strong> הכנסה של {foreignAmount} {foreignCurrency} בתזרים היעד</div>
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
                onClick={() => setIsForeignCopyModalOpen(false)}
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
                disabled={!targetCashFlowId || !foreignAmount || !exchangeRate}
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