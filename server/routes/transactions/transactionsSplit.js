const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== TRANSACTION SPLITTING OPERATIONS =====

// Split a transaction into multiple transactions
router.post('/split', authenticateToken, async (req, res) => {
  try {
    const originalTransactionId =
      req.body.originalTransactionId ||
      req.body.original_transaction_id ||
      req.body.originalTransactionID;
    const { splits } = req.body;

    if (!originalTransactionId || !splits || !Array.isArray(splits) || splits.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid split data - need at least 2 splits' 
      });
    }

    // Get original transaction
    const originalTransaction = await SupabaseService.getTransactionById(originalTransactionId);
    if (!originalTransaction) {
      return res.status(404).json({ 
        success: false, 
        error: 'Original transaction not found' 
      });
    }

    // Check ownership
    if (originalTransaction.user_id !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Unauthorized access' 
      });
    }

    // Validate splits
    let totalSplitAmount = 0;
    for (const split of splits) {
      if (!split.amount || !split.category || !split.business_name || !split.flow_month) {
        return res.status(400).json({ 
          success: false, 
          error: 'All split fields are required (amount, category, business_name, flow_month)' 
        });
      }
      totalSplitAmount += Math.abs(parseFloat(split.amount));
    }

    const originalAmount = Math.abs(parseFloat(originalTransaction.amount));
    if (Math.abs(totalSplitAmount - originalAmount) > 0.01) {
      return res.status(400).json({ 
        success: false, 
        error: `Split amounts total (${totalSplitAmount}) must equal original amount (${originalAmount})` 
      });
    }

    // Create new transactions for each split
    const newTransactions = [];
    let allTransactionsCreated = true;
    
    console.log('Transaction splitting started for ID:', originalTransactionId);
    
    for (const [index, split] of splits.entries()) {
      try {
        const splitPositionLabel = `חלק ${index + 1} מתוך ${splits.length}`;
        const flowMonthLabel = split.flow_month ? ` | חודש תזרים: ${split.flow_month}` : '';
        const splitNotes = `[SPLIT] פוצל מעסקה מקורית: ${originalTransaction.business_name} | ${splitPositionLabel}${flowMonthLabel} | מזהה מקורי: ${originalTransactionId} | הסבר: ${split.description || 'ללא הסבר'}`;

        const newTransaction = {
          user_id: req.user.id,
          cash_flow_id: originalTransaction.cash_flow_id,
          business_name: split.business_name,
          amount: split.amount,
          payment_date: split.payment_date || originalTransaction.payment_date,
          flow_month: split.flow_month,
          currency: split.currency || originalTransaction.currency || 'ILS',
          category_name: split.category,
          payment_method: originalTransaction.payment_method || 'generic',
          payment_number: originalTransaction.payment_number || 1,
          total_payments: originalTransaction.total_payments || 1,
          notes: splitNotes
        };

        console.log('Creating split transaction for:', split.business_name);
        const result = await SupabaseService.createTransaction(newTransaction);
        
        if (result && result.success && result.data) {
          newTransactions.push(result.data);
          console.log('Split transaction created successfully:', result.data.id);
        } else {
          console.error('Failed to create split transaction. Result:', result);
          allTransactionsCreated = false;
          break;
        }
      } catch (error) {
        console.error('Error creating split transaction:', error);
        allTransactionsCreated = false;
        break;
      }
    }

    // Only proceed if ALL transactions were created successfully
    if (!allTransactionsCreated || newTransactions.length !== splits.length) {
      console.error('Not all split transactions created. Rolling back...');
      
      // Delete any transactions that were created
      for (const transaction of newTransactions) {
        try {
          const transactionId = transaction.id || transaction.transaction_id;
          await SupabaseService.deleteTransaction(transactionId);
          console.log('Rolled back transaction:', transactionId);
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError);
        }
      }
      
      return res.status(500).json({ 
        success: false, 
        error: `Failed to create all split transactions. Created ${newTransactions.length} out of ${splits.length}. Original transaction preserved.` 
      });
    }

    console.log('All split transactions created successfully. Deleting original...');

    // Only delete original transaction if ALL splits were created successfully
    try {
      // Mark original transaction as split in the notes, then delete it
      await SupabaseService.updateTransaction(originalTransactionId, {
        notes: `עסקה פוצלה ל-${splits.length} עסקאות - ${new Date().toISOString()}`
      });

      // Delete the original transaction
      await SupabaseService.deleteTransaction(originalTransactionId);
      console.log('Original transaction deleted successfully');
    } catch (deleteError) {
      console.error('Error deleting original transaction:', deleteError);
      return res.status(500).json({ 
        success: false, 
        error: 'Split transactions created but failed to delete original transaction. Please check manually.' 
      });
    }

    res.json({
      success: true,
      message: `Transaction successfully split into ${splits.length} transactions`,
      original_transaction_id: originalTransactionId,
      new_transactions: newTransactions
    });

  } catch (error) {
    console.error('Error splitting transaction:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to split transaction: ' + error.message 
    });
  }
});

// Endpoint to unsplit transactions (merge split transactions back)
router.post('/unsplit', authenticateToken, async (req, res) => {
  try {
    const { originalTransactionId } = req.body;

    if (!originalTransactionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Original transaction ID is required' 
      });
    }

    // Find all split transactions that reference this original transaction
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { show_all: true });
    const splitTransactions = transactions.filter(t => 
      t.notes && t.notes.includes(`[SPLIT]`) && t.notes.includes(`מזהה מקורי: ${originalTransactionId}`)
    );

    if (splitTransactions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No split transactions found for this original transaction ID' 
      });
    }

    // Verify ownership of all split transactions
    for (const transaction of splitTransactions) {
      if (transaction.user_id !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          error: 'Unauthorized access to split transactions' 
        });
      }
    }

    // Delete all split transactions
    let deletedCount = 0;
    const errors = [];
    
    for (const transaction of splitTransactions) {
      try {
        const success = await SupabaseService.deleteTransaction(transaction.id);
        if (success) {
          deletedCount++;
          console.log(`Deleted split transaction: ${transaction.id}`);
        } else {
          errors.push(`Failed to delete transaction ${transaction.id}`);
        }
      } catch (error) {
        console.error(`Error deleting split transaction ${transaction.id}:`, error);
        errors.push(`Error deleting transaction ${transaction.id}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} split transactions`,
      deleted_count: deletedCount,
      total_split_transactions: splitTransactions.length,
      errors: errors
    });

  } catch (error) {
    console.error('Error unspitting transactions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to unsplit transactions: ' + error.message 
    });
  }
});

// Get split transactions for a specific original transaction
router.get('/split/:originalTransactionId', authenticateToken, async (req, res) => {
  try {
    const { originalTransactionId } = req.params;

    // Find all split transactions that reference this original transaction
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { show_all: true });
    const splitTransactions = transactions.filter(t => 
      t.notes && t.notes.includes(`[SPLIT]`) && t.notes.includes(`מזהה מקורי: ${originalTransactionId}`)
    );

    // Verify ownership
    for (const transaction of splitTransactions) {
      if (transaction.user_id !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          error: 'Unauthorized access' 
        });
      }
    }

    res.json({
      success: true,
      original_transaction_id: originalTransactionId,
      split_transactions: splitTransactions,
      count: splitTransactions.length,
      total_amount: splitTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
    });

  } catch (error) {
    console.error('Error fetching split transactions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch split transactions: ' + error.message 
    });
  }
});

module.exports = router;
