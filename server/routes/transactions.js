const express = require('express');
const SupabaseService = require('../services/supabaseService');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ===== TRANSACTION CRUD OPERATIONS =====

// Get transactions with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      year, 
      month, 
      flow_month,
      cash_flow_id, 
      category_id, 
      page = 1, 
      per_page = 50,
      q,
      notes,
      no_category,
      show_all
    } = req.query;
    
    const filters = {};
    
    // Date filtering
    if (year && month) {
      filters.year = parseInt(year);
      filters.month = parseInt(month);
    } else if (flow_month) {
      filters.flow_month = flow_month;
    }
    
    // Other filters
    if (cash_flow_id) filters.cash_flow_id = cash_flow_id;
    if (category_id) filters.category_id = category_id;
    if (q) filters.q = q;
    if (notes) filters.notes = notes;
    if (no_category === 'true') filters.no_category = true;
    if (show_all === 'true') filters.show_all = true;

    const result = await SupabaseService.getTransactions(
      req.user.id, 
      filters,
      parseInt(page),
      parseInt(per_page)
    );

    res.json({
      transactions: result.transactions,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total_count: result.totalCount,
        total_pages: Math.ceil(result.totalCount / parseInt(per_page))
      }
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get transaction by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = await SupabaseService.getTransactionById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Verify ownership
    if (transaction.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(transaction);

  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Create new transaction
router.post('/', authenticateToken, async (req, res) => {
  try {
    const transactionData = {
      ...req.body,
      user_id: req.user.id
    };

    // Validate required fields
    if (!transactionData.business_name || !transactionData.amount || !transactionData.payment_date) {
      return res.status(400).json({ 
        error: 'Missing required fields: business_name, amount, payment_date' 
      });
    }

    // Verify cash flow belongs to user if provided
    if (transactionData.cash_flow_id) {
      const cashFlow = await SupabaseService.getCashFlow(transactionData.cash_flow_id);
      if (!cashFlow || cashFlow.user_id !== req.user.id) {
        return res.status(400).json({ error: 'Invalid cash flow' });
      }
    }

    const result = await SupabaseService.createTransaction(transactionData);

    if (result.success) {
      res.status(201).json({
        message: 'Transaction created successfully',
        transaction: result.data
      });
    } else if (result.duplicate) {
      res.status(409).json({
        error: 'Duplicate transaction detected',
        existing: result.existing
      });
    } else {
      res.status(400).json({
        error: 'Failed to create transaction',
        details: result.error
      });
    }

  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Update transaction
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const transactionId = req.params.id;
    
    // First verify the transaction exists and belongs to the user
    const existingTransaction = await SupabaseService.getTransactionById(transactionId);
    if (!existingTransaction || existingTransaction.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Verify cash flow belongs to user if being updated
    if (req.body.cash_flow_id) {
      const cashFlow = await SupabaseService.getCashFlow(req.body.cash_flow_id);
      if (!cashFlow || cashFlow.user_id !== req.user.id) {
        return res.status(400).json({ error: 'Invalid cash flow' });
      }
    }

    const updatedTransaction = await SupabaseService.updateTransaction(transactionId, req.body);

    if (updatedTransaction) {
      res.json({
        message: 'Transaction updated successfully',
        transaction: updatedTransaction
      });
    } else {
      res.status(400).json({ error: 'Failed to update transaction' });
    }

  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Delete transaction
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const transactionId = req.params.id;
    
    // Verify the transaction exists and belongs to the user
    const existingTransaction = await SupabaseService.getTransactionById(transactionId);
    if (!existingTransaction || existingTransaction.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const success = await SupabaseService.deleteTransaction(transactionId);

    if (success) {
      res.json({ message: 'Transaction deleted successfully' });
    } else {
      res.status(400).json({ error: 'Failed to delete transaction' });
    }

  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

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

// ===== ANALYTICS AND PROCESSING =====

// Get transactions processed by category
router.get('/analytics/by-category', authenticateToken, async (req, res) => {
  try {
    const { flow_month, cash_flow_id } = req.query;
    
    // Get all transactions for processing
    const filters = { show_all: true };
    if (flow_month) filters.flow_month = flow_month;
    if (cash_flow_id) filters.cash_flow_id = cash_flow_id;

    const { transactions } = await SupabaseService.getTransactions(req.user.id, filters);
    
    // Process transactions by category
    const processedData = SupabaseService.processTransactionsByCategory(
      transactions, 
      flow_month, 
      req.user.id
    );

    res.json(processedData);

  } catch (error) {
    console.error('Error processing transactions by category:', error);
    res.status(500).json({ error: 'Failed to process transactions' });
  }
});

// Get transaction statistics
router.get('/analytics/stats', authenticateToken, async (req, res) => {
  try {
    const { year, month, cash_flow_id } = req.query;
    
    const filters = { show_all: true };
    if (year && month) {
      filters.year = parseInt(year);
      filters.month = parseInt(month);
    }
    if (cash_flow_id) filters.cash_flow_id = cash_flow_id;

    const { transactions, totalCount } = await SupabaseService.getTransactions(req.user.id, filters);

    // Calculate statistics
    const stats = {
      total_transactions: totalCount,
      total_amount: transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
      income: transactions.filter(t => parseFloat(t.amount || 0) > 0).reduce((sum, t) => sum + parseFloat(t.amount), 0),
      expenses: transactions.filter(t => parseFloat(t.amount || 0) < 0).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0),
      by_category: {},
      by_payment_method: {},
      by_currency: {}
    };

    // Group by category
    transactions.forEach(transaction => {
      const category = transaction.category_name || 'Uncategorized';
      if (!stats.by_category[category]) {
        stats.by_category[category] = { count: 0, total: 0 };
      }
      stats.by_category[category].count++;
      stats.by_category[category].total += parseFloat(transaction.amount || 0);
    });

    // Group by payment method
    transactions.forEach(transaction => {
      const method = transaction.payment_method || 'Unknown';
      if (!stats.by_payment_method[method]) {
        stats.by_payment_method[method] = { count: 0, total: 0 };
      }
      stats.by_payment_method[method].count++;
      stats.by_payment_method[method].total += parseFloat(transaction.amount || 0);
    });

    // Group by currency
    transactions.forEach(transaction => {
      const currency = transaction.currency || 'ILS';
      if (!stats.by_currency[currency]) {
        stats.by_currency[currency] = { count: 0, total: 0 };
      }
      stats.by_currency[currency].count++;
      stats.by_currency[currency].total += parseFloat(transaction.amount || 0);
    });

    res.json(stats);

  } catch (error) {
    console.error('Error calculating transaction stats:', error);
    res.status(500).json({ error: 'Failed to calculate statistics' });
  }
});

// ===== DUPLICATE DETECTION =====

// Check for potential duplicates
router.get('/duplicates', authenticateToken, async (req, res) => {
  try {
    const { cash_flow_id } = req.query;
    
    const filters = { show_all: true };
    if (cash_flow_id) filters.cash_flow_id = cash_flow_id;

    const { transactions } = await SupabaseService.getTransactions(req.user.id, filters);

    // Find potential duplicates by grouping similar transactions
    const potentialDuplicates = [];
    const seen = new Map();

    transactions.forEach(transaction => {
      const key = `${transaction.business_name}_${transaction.amount}_${transaction.payment_date}`;
      
      if (seen.has(key)) {
        const existing = seen.get(key);
        potentialDuplicates.push({
          group_key: key,
          transactions: [existing, transaction]
        });
      } else {
        seen.set(key, transaction);
      }
    });

    res.json({
      potential_duplicates: potentialDuplicates,
      total_groups: potentialDuplicates.length
    });

  } catch (error) {
    console.error('Error finding duplicates:', error);
    res.status(500).json({ error: 'Failed to find duplicates' });
  }
});

// ===== API ENDPOINTS FOR FRONTEND COMPATIBILITY =====

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

    // Handle foreign currency
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

    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching unique categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint to batch categorize transactions
router.post('/api/transactions/batch_categorize', authenticateToken, async (req, res) => {
  try {
    const { transaction_ids, category_name } = req.body;

    if (!transaction_ids || !Array.isArray(transaction_ids) || !category_name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    let updatedCount = 0;
    const errors = [];

    for (const transactionId of transaction_ids) {
      try {
        // Verify ownership
        const transaction = await SupabaseService.getTransactionById(transactionId);
        if (!transaction || transaction.user_id !== req.user.id) {
          errors.push(`Transaction ${transactionId} not found or access denied`);
          continue;
        }

        // Update transaction
        const success = await SupabaseService.updateTransaction(transactionId, {
          category_name: category_name,
          updated_at: new Date().toISOString()
        });

        if (success) {
          updatedCount++;
        } else {
          errors.push(`Failed to update transaction ${transactionId}`);
        }
      } catch (error) {
        errors.push(`Error updating transaction ${transactionId}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      updated_count: updatedCount,
      total: transaction_ids.length,
      errors: errors.slice(0, 10) // Limit error details
    });

  } catch (error) {
    console.error('Error in batch categorization:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint to delete all transactions by cash flow
router.post('/api/transactions/delete_by_cash_flow', authenticateToken, async (req, res) => {
  try {
    const { cash_flow_id, confirm_linked = false } = req.body;

    if (!cash_flow_id) {
      return res.status(400).json({ success: false, error: 'Missing cash_flow_id' });
    }

    // Check ownership of the cash flow
    const cashFlow = await SupabaseService.getCashFlow(cash_flow_id);
    if (!cashFlow || cashFlow.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // Get all transactions for this cash flow
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      cash_flow_id: cash_flow_id, 
      show_all: true 
    });

    if (!transactions || transactions.length === 0) {
      return res.json({ success: true, deleted: 0, message: 'אין עסקאות למחיקה' });
    }

    // Check for linked transactions
    const linkedTransactions = [];
    const transactionsWithLinks = [];

    for (const transaction of transactions) {
      const { transactions: links } = await SupabaseService.getTransactions(req.user.id, {
        linked_transaction_id: transaction.id,
        show_all: true
      });

      if (links && links.length > 0) {
        linkedTransactions.push(...links);
        transactionsWithLinks.push({
          id: transaction.id,
          business_name: transaction.business_name || '',
          linked_count: links.length
        });
      }
    }

    // If there are linked transactions and user hasn't confirmed, ask for confirmation
    if (linkedTransactions.length > 0 && !confirm_linked) {
      return res.json({
        success: false,
        requires_confirmation: true,
        message: `נמצאו ${linkedTransactions.length} עסקאות קשורות שיימחקו גם כן`,
        transactions_with_links: transactionsWithLinks,
        linked_transactions: linkedTransactions,
        total_to_delete: transactions.length + linkedTransactions.length
      });
    }

    // Delete linked transactions first
    let deletedLinked = 0;
    for (const linkedTransaction of linkedTransactions) {
      try {
        const success = await SupabaseService.deleteTransaction(linkedTransaction.id);
        if (success) deletedLinked++;
      } catch (error) {
        console.error(`Error deleting linked transaction ${linkedTransaction.id}:`, error);
      }
    }

    // Delete main transactions
    let deleted = 0;
    const errors = [];
    for (const transaction of transactions) {
      try {
        const success = await SupabaseService.deleteTransaction(transaction.id);
        if (success) {
          deleted++;
        } else {
          errors.push(`Failed to delete transaction ${transaction.business_name || 'Unknown'}`);
        }
      } catch (error) {
        errors.push(`Error deleting transaction ${transaction.business_name || 'Unknown'}: ${error.message}`);
      }
    }

    let message = `נמחקו בהצלחה ${deleted} עסקאות`;
    if (deletedLinked > 0) {
      message += ` ו-${deletedLinked} עסקאות קשורות`;
    }

    res.json({
      success: true,
      deleted: deleted,
      deleted_linked: deletedLinked,
      total_deleted: deleted + deletedLinked,
      errors: errors,
      message: message
    });

  } catch (error) {
    console.error('Error in delete_transactions_by_cash_flow:', error);
    res.status(500).json({ success: false, error: `שגיאה במחיקת העסקאות: ${error.message}` });
  }
});

module.exports = router;