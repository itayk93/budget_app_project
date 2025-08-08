const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== FLOW MONTH OPERATIONS =====

// Update transaction flow month
router.patch('/:id/flow-month', authenticateToken, async (req, res) => {
  try {
    const { flow_month, cash_flow_id } = req.body;
    const transactionId = req.params.id;

    if (!flow_month) {
      return res.status(400).json({ error: 'flow_month is required' });
    }

    // Verify transaction ownership
    const existingTransaction = await SupabaseService.getTransactionById(transactionId);
    if (!existingTransaction || existingTransaction.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const success = await SupabaseService.updateTransactionFlowMonth(
      transactionId, 
      flow_month, 
      cash_flow_id || existingTransaction.cash_flow_id
    );

    if (success) {
      res.json({ message: 'Flow month updated successfully' });
    } else {
      res.status(400).json({ error: 'Failed to update flow month' });
    }

  } catch (error) {
    console.error('Error updating flow month:', error);
    res.status(500).json({ error: 'Failed to update flow month' });
  }
});

// Delete transactions by cash flow
router.post('/api/transactions/delete_by_cash_flow', authenticateToken, async (req, res) => {
  try {
    const { cash_flow_id, flow_month } = req.body;

    if (!cash_flow_id) {
      return res.status(400).json({ error: 'cash_flow_id is required' });
    }

    // Verify cash flow belongs to user
    const cashFlow = await SupabaseService.getCashFlow(cash_flow_id);
    if (!cashFlow || cashFlow.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to this cash flow' });
    }

    // Get transactions to delete
    const filters = { cash_flow_id, show_all: true };
    if (flow_month) filters.flow_month = flow_month;

    const { transactions } = await SupabaseService.getTransactions(req.user.id, filters);

    if (transactions.length === 0) {
      return res.json({ 
        message: 'No transactions found to delete',
        deleted_count: 0 
      });
    }

    let deletedCount = 0;
    let failedCount = 0;
    const errors = [];

    // Delete each transaction
    for (const transaction of transactions) {
      try {
        const success = await SupabaseService.deleteTransaction(transaction.id);
        if (success) {
          deletedCount++;
        } else {
          failedCount++;
          errors.push({
            transaction_id: transaction.id,
            error: 'Delete operation failed'
          });
        }
      } catch (error) {
        failedCount++;
        errors.push({
          transaction_id: transaction.id,
          error: error.message
        });
      }
    }

    res.json({
      message: 'Bulk delete completed',
      deleted_count: deletedCount,
      failed_count: failedCount,
      total_processed: transactions.length,
      errors: errors
    });

  } catch (error) {
    console.error('Error deleting transactions by cash flow:', error);
    res.status(500).json({ error: 'Failed to delete transactions' });
  }
});

module.exports = router;