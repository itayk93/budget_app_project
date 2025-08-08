const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== LEGACY API ENDPOINTS =====
// These endpoints maintain backward compatibility with frontend applications

// API endpoint to record a transaction as income in another cash flow
router.post('/api/transactions/record-as-income', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    const {
      transaction_id,
      target_cash_flow_id,
      category_name = 'הכנסות משתנות',
      invert_amounts = false,
      foreign_currency,
      foreign_amount,
      exchange_rate,
      new_amount
    } = data;

    if (!transaction_id || !target_cash_flow_id) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Get original transaction
    const transaction = await SupabaseService.getTransactionById(transaction_id);
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // Check ownership
    if (transaction.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized access' });
    }

    // Get target cash flow
    const targetCashFlow = await SupabaseService.getCashFlow(target_cash_flow_id);
    if (!targetCashFlow) {
      return res.status(404).json({ success: false, error: 'Target cash flow not found' });
    }

    // Check target cash flow ownership
    if (targetCashFlow.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to target cash flow' });
    }

    // Calculate amount
    const amount = foreign_amount ? parseFloat(foreign_amount) : 
                  new_amount ? parseFloat(new_amount) : 
                  Math.abs(parseFloat(transaction.amount));

    // Parse payment date
    const paymentDate = new Date(transaction.payment_date);
    const flowMonth = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;

    // Create new transaction
    const newTransaction = {
      user_id: req.user.id,
      cash_flow_id: target_cash_flow_id,
      category_name: category_name,
      business_name: transaction.business_name,
      payment_date: transaction.payment_date,
      flow_month: flowMonth,
      amount: amount,
      payment_method: transaction.payment_method,
      notes: `הועתק מעסקה ${transaction.business_name} בתזרים המקורי`,
      currency: targetCashFlow.currency || 'ILS',
      source_type: 'copy',
      linked_transaction_id: transaction.id,
      is_transfer: false
    };

    // Handle foreign currency conversion
    if (foreign_currency && foreign_amount && exchange_rate) {
      // For currency conversion, foreign_currency is the source currency
      // foreign_amount is the target amount in the new currency
      // We need to store the original transaction details
      newTransaction.original_currency = foreign_currency;
      newTransaction.original_amount = Math.abs(parseFloat(transaction.amount));
      newTransaction.exchange_rate = parseFloat(exchange_rate);
      newTransaction.exchange_date = transaction.payment_date;
    }

    // Create the transaction
    const result = await SupabaseService.createTransaction(newTransaction);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Transaction recorded successfully',
        transaction: result.data
      });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Failed to create transaction' });
    }

  } catch (error) {
    console.error('Error recording transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint to get unique category names from transactions
router.get('/api/transactions/unique_categories', authenticateToken, async (req, res) => {
  try {
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { show_all: true });
    
    const categories = [...new Set(
      transactions
        .map(t => t.category_name)
        .filter(name => name && name.trim())
    )].sort();

    res.json({
      success: true,
      categories: categories,
      total_count: categories.length
    });

  } catch (error) {
    console.error('Error fetching unique categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

// API endpoint to delete all transactions in a specific cash flow
router.post('/api/transactions/delete_by_cash_flow', authenticateToken, async (req, res) => {
  try {
    const { cash_flow_id, flow_month, confirm_delete_linked = false } = req.body;

    if (!cash_flow_id) {
      return res.status(400).json({ success: false, error: 'cash_flow_id is required' });
    }

    // Verify cash flow ownership
    const cashFlow = await SupabaseService.getCashFlow(cash_flow_id);
    if (!cashFlow || cashFlow.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied to this cash flow' });
    }

    // Get transactions to delete
    const filters = { cash_flow_id, show_all: true };
    if (flow_month) filters.flow_month = flow_month;

    const { transactions } = await SupabaseService.getTransactions(req.user.id, filters);

    if (transactions.length === 0) {
      return res.json({ 
        success: true,
        message: 'No transactions found to delete',
        deleted_count: 0,
        linked_transactions_count: 0
      });
    }

    // Check for linked transactions
    const linkedTransactions = transactions.filter(t => t.linked_transaction_id);
    
    if (linkedTransactions.length > 0 && !confirm_delete_linked) {
      return res.status(400).json({
        success: false,
        error: 'Found linked transactions that require confirmation',
        linked_transactions_count: linkedTransactions.length,
        linked_transactions: linkedTransactions.map(t => ({
          id: t.id,
          business_name: t.business_name,
          amount: t.amount,
          linked_transaction_id: t.linked_transaction_id
        })),
        message: 'Set confirm_delete_linked=true to proceed with deletion of linked transactions'
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
            business_name: transaction.business_name,
            error: 'Delete operation failed'
          });
        }
      } catch (error) {
        failedCount++;
        errors.push({
          transaction_id: transaction.id,
          business_name: transaction.business_name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Bulk delete completed',
      deleted_count: deletedCount,
      failed_count: failedCount,
      total_processed: transactions.length,
      linked_transactions_deleted: linkedTransactions.length,
      errors: errors
    });

  } catch (error) {
    console.error('Error deleting transactions by cash flow:', error);
    res.status(500).json({ success: false, error: 'Failed to delete transactions' });
  }
});

module.exports = router;