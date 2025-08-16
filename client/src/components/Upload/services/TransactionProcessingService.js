export class TransactionProcessingService {

  initializeTransactions(transactions, skipDuplicates) {
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
        return this.extractPayboxRecipient(tx, notesToProcess);
      }
      return tx;
    });

    return transactionsWithRecipients;
  }

  extractPayboxRecipient(transaction, notesToProcess) {
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
        ...transaction,
        recipient_name: recipientName,
        notes: cleanedNotes || null
      };
    }
    
    return transaction;
  }

  async autoSuggestCategories(transactionsToProcess, setEditedTransactions) {
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
  }

  handleTransactionChange(editedTransactions, setEditedTransactions, tempId, field, value) {
    setEditedTransactions(prev => 
      prev.map(tx => 
        tx.tempId === tempId 
          ? { ...tx, [field]: value }
          : tx
      )
    );
  }

  handleCategoryChange(tempId, categoryData, handleTransactionChange) {
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
  }

  isFromDifferentCashFlow(transaction, selectedSourceCashFlowId) {
    return transaction.cash_flow_id && transaction.cash_flow_id !== selectedSourceCashFlowId;
  }

  getTargetCashFlowName(transaction, cashFlows) {
    if (!transaction.cash_flow_id) return null;
    const targetFlow = cashFlows.find(cf => cf.id === transaction.cash_flow_id);
    return targetFlow?.name || 'תזרים לא ידוע';
  }

  prepareFinalTransactions(editedTransactions, deletedTransactionIds) {
    // Prepare final transactions (excluding deleted ones)
    const finalTransactions = editedTransactions
      .map(tx => {
        const { tempId, originalIndex, isDuplicate, duplicateInfo, ...cleanTx } = tx;
        return cleanTx;
      });

    return {
      transactions: finalTransactions,
      deletedIndices: Array.from(deletedTransactionIds)
    };
  }
}

const transactionProcessingServiceInstance = new TransactionProcessingService();
export default transactionProcessingServiceInstance;