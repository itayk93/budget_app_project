export class DuplicateService {
  constructor() {
    this.duplicateTransactionIds = new Set();
    this.replaceDuplicates = new Map();
    this.skipDuplicates = false;
  }

  initializeDuplicates(transactions) {
    // Identify duplicate transactions
    const duplicateIds = new Set();
    transactions.forEach(tx => {
      if (tx.isDuplicate) {
        duplicateIds.add(tx.tempId);
      }
    });
    
    this.duplicateTransactionIds = duplicateIds;
    console.log('🔍 [DUPLICATE SERVICE] Found duplicates:', duplicateIds.size);
  }

  handleDeleteTransaction(tempId, editedTransactions, deletedTransactionIds, setEditedTransactions, setDeletedTransactionIds) {
    const transaction = editedTransactions.find(tx => tx.tempId === tempId);
    if (!transaction) return;

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
      this.duplicateTransactionIds.delete(tempId);
      
      // If only one duplicate sibling remains, remove it from duplicates too
      if (duplicateSiblings.length === 1) {
        this.duplicateTransactionIds.delete(duplicateSiblings[0].tempId);
      }
      
      // Recalculate remaining duplicates after the update
      setTimeout(() => {
        setEditedTransactions(currentTransactions => {
          const remainingDuplicateCount = currentTransactions.filter(tx => tx.isDuplicate).length;
          
          if (remainingDuplicateCount === 0) {
            this.skipDuplicates = false;
          }
          
          return currentTransactions;
        });
      }, 0);
    }
  }

  setReplaceAction(tempId, shouldReplace) {
    this.replaceDuplicates.set(tempId, shouldReplace);
  }

  getReplaceAction(tempId) {
    return this.replaceDuplicates.get(tempId) || false;
  }

  prepareDuplicateActions(editedTransactions) {
    const duplicateActions = {};
    
    // Process all duplicate transactions
    editedTransactions.forEach(transaction => {
      if (transaction.isDuplicate && transaction.duplicateInfo) {
        const tempId = transaction.tempId;
        const shouldReplace = this.replaceDuplicates.get(tempId) || false; // Default to false (create duplicate)
        
        duplicateActions[tempId] = {
          shouldReplace,
          originalTransactionId: transaction.duplicateInfo.original_id,
          duplicateHash: transaction.transaction_hash
        };
        
        console.log(`🔄 [DUPLICATE ACTION] ${tempId}: ${shouldReplace ? 'REPLACE' : 'CREATE_NEW'}`);
      }
    });

    return duplicateActions;
  }

  getDuplicateTransactionIds() {
    return this.duplicateTransactionIds;
  }

  getSkipDuplicates() {
    return this.skipDuplicates;
  }

  setSkipDuplicates(value) {
    this.skipDuplicates = value;
  }

  reset() {
    this.duplicateTransactionIds = new Set();
    this.replaceDuplicates = new Map();
    this.skipDuplicates = false;
  }
}

const duplicateServiceInstance = new DuplicateService();
export default duplicateServiceInstance;