const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== BATCH OPERATIONS =====

// Batch update transactions (for categorization, flow month changes, etc.)
router.patch('/batch', authenticateToken, async (req, res) => {
  try {
    const { transaction_ids, updates } = req.body;

    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({ error: 'transaction_ids array is required' });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates object is required' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Process each transaction
    for (const transactionId of transaction_ids) {
      try {
        // Verify ownership
        const existingTransaction = await SupabaseService.getTransactionById(transactionId);
        if (!existingTransaction || existingTransaction.user_id !== req.user.id) {
          results.failed++;
          results.errors.push({
            transaction_id: transactionId,
            error: 'Transaction not found or access denied'
          });
          continue;
        }

        const success = await SupabaseService.updateTransaction(transactionId, updates);
        
        if (success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            transaction_id: transactionId,
            error: 'Update failed'
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          transaction_id: transactionId,
          error: error.message
        });
      }
    }

    res.json({
      message: 'Batch update completed',
      results: results
    });

  } catch (error) {
    console.error('Error in batch update:', error);
    res.status(500).json({ error: 'Batch update failed' });
  }
});

// Batch delete transactions
router.delete('/batch', authenticateToken, async (req, res) => {
  try {
    const { transaction_ids } = req.body;

    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({ error: 'transaction_ids array is required' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Process each transaction
    for (const transactionId of transaction_ids) {
      try {
        // Verify ownership
        const existingTransaction = await SupabaseService.getTransactionById(transactionId);
        if (!existingTransaction || existingTransaction.user_id !== req.user.id) {
          results.failed++;
          results.errors.push({
            transaction_id: transactionId,
            error: 'Transaction not found or access denied'
          });
          continue;
        }

        const success = await SupabaseService.deleteTransaction(transactionId);
        
        if (success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            transaction_id: transactionId,
            error: 'Delete failed'
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          transaction_id: transactionId,
          error: error.message
        });
      }
    }

    res.json({
      message: 'Batch delete completed',
      results: results
    });

  } catch (error) {
    console.error('Error in batch delete:', error);
    res.status(500).json({ error: 'Batch delete failed' });
  }
});

// Batch categorize transactions
router.post('/api/transactions/batch_categorize', authenticateToken, async (req, res) => {
  try {
    const { transaction_ids, category_name } = req.body;

    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({ error: 'transaction_ids array is required' });
    }

    if (!category_name) {
      return res.status(400).json({ error: 'category_name is required' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Process each transaction
    for (const transactionId of transaction_ids) {
      try {
        // Verify ownership
        const existingTransaction = await SupabaseService.getTransactionById(transactionId);
        if (!existingTransaction || existingTransaction.user_id !== req.user.id) {
          results.failed++;
          results.errors.push({
            transaction_id: transactionId,
            error: 'Transaction not found or access denied'
          });
          continue;
        }

        const success = await SupabaseService.updateTransaction(transactionId, { category_name });
        
        if (success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            transaction_id: transactionId,
            error: 'Category update failed'
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          transaction_id: transactionId,
          error: error.message
        });
      }
    }

    res.json({
      message: 'Batch categorization completed',
      results: results
    });

  } catch (error) {
    console.error('Error in batch categorization:', error);
    res.status(500).json({ error: 'Batch categorization failed' });
  }
});

module.exports = router;