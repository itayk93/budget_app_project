const express = require('express');
const SupabaseService = require('../services/supabaseService');
const mongoBusinessService = require('../services/mongoBusinessService');
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

// Get business details for a specific transaction
router.get('/:id/business-details', authenticateToken, async (req, res) => {
  try {
    const transaction = await SupabaseService.getTransactionById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Verify ownership
    if (transaction.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get business details from MongoDB using the transaction's business name
    const businessName = transaction.business_name || transaction.description;
    
    if (!businessName) {
      return res.json({ 
        transaction_id: req.params.id,
        business_name: null,
        business_details: null,
        message: 'No business name found for this transaction'
      });
    }

    const businessResult = await mongoBusinessService.getBusinessIntelligence(req.user.id, businessName);
    
    if (businessResult.success && businessResult.businesses.length > 0) {
      const businessData = businessResult.businesses[0];
      
      return res.json({
        transaction_id: req.params.id,
        business_name: businessName,
        business_details: {
          category: businessData.perplexity_analysis.category,
          confidence: businessData.perplexity_analysis.confidence,
          business_info: businessData.perplexity_analysis.business_info,
          reasoning: businessData.perplexity_analysis.reasoning,
          analysis_date: businessData.analysis_date,
          last_updated: businessData.updated_at
        },
        found: true
      });
    } else {
      return res.json({
        transaction_id: req.params.id,
        business_name: businessName,
        business_details: null,
        found: false,
        message: 'Business details not found in database'
      });
    }

  } catch (error) {
    console.error('Error fetching business details for transaction:', error);
    res.status(500).json({ error: 'Failed to fetch business details' });
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

// ===== BUSINESS CATEGORY INTELLIGENCE =====

// Get businesses with "הוצאות משתנות" category for categorization review
router.get('/businesses/variable-expenses', authenticateToken, async (req, res) => {
  try {
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    });

    // Filter transactions with "הוצאות משתנות" category
    const variableExpenseTransactions = transactions.filter(t => 
      t.category_name === 'הוצאות משתנות'
    );

    // Group by business name and count transactions
    const businessSummary = new Map();
    
    variableExpenseTransactions.forEach(transaction => {
      const businessName = transaction.business_name || 'Unknown Business';
      
      if (!businessSummary.has(businessName)) {
        businessSummary.set(businessName, {
          business_name: businessName,
          current_category: transaction.category_name,
          transaction_count: 0,
          total_amount: 0,
          currency: transaction.currency || 'ILS',
          latest_transaction_date: transaction.payment_date,
          sample_transactions: []
        });
      }
      
      const business = businessSummary.get(businessName);
      business.transaction_count++;
      business.total_amount += Math.abs(parseFloat(transaction.amount || 0));
      
      // Keep latest transaction date
      if (new Date(transaction.payment_date) > new Date(business.latest_transaction_date)) {
        business.latest_transaction_date = transaction.payment_date;
      }
      
      // Add sample transactions (max 3)
      if (business.sample_transactions.length < 3) {
        business.sample_transactions.push({
          id: transaction.id,
          amount: transaction.amount,
          payment_date: transaction.payment_date,
          notes: transaction.notes
        });
      }
    });

    // Convert map to array and sort by transaction count (descending)
    const businessesArray = Array.from(businessSummary.values())
      .sort((a, b) => b.transaction_count - a.transaction_count);

    res.json({
      success: true,
      businesses: businessesArray,
      total_businesses: businessesArray.length,
      total_transactions: variableExpenseTransactions.length
    });

  } catch (error) {
    console.error('Error fetching variable expense businesses:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch businesses with variable expenses' 
    });
  }
});

// Get GPT-4o-mini category suggestions for businesses
router.post('/businesses/suggest-categories', authenticateToken, async (req, res) => {
  try {
    const { businesses, debug } = req.body;

    if (!businesses || !Array.isArray(businesses) || businesses.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'businesses array is required' 
      });
    }

    // Get all existing categories for this user
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    });
    
    const existingCategories = [...new Set(
      transactions
        .map(t => t.category_name)
        .filter(name => name && name.trim() && name !== 'הוצאות משתנות')
    )].sort();

    const categorySuggestions = [];

    // Process each business with GPT-4o-mini
    for (const businessName of businesses) {
      try {
        const suggestion = await getCategorySuggestionFromGPT(businessName, existingCategories, debug);
        const suggestionData = {
          business_name: businessName,
          suggested_category: suggestion.category,
          confidence: suggestion.confidence,
          reasoning: suggestion.reasoning
        };
        
        // Add additional business information if available
        if (suggestion.business_info) {
          suggestionData.business_info = suggestion.business_info;
        }
        
        // Add debug information if requested
        if (debug && suggestion.debug_info) {
          suggestionData.debug_info = suggestion.debug_info;
        }
        
        // Save business intelligence to MongoDB
        try {
          await mongoBusinessService.saveBusinessIntelligence(
            req.user.id, 
            businessName, 
            {
              ...suggestion,
              suggested_category: suggestion.category,
              raw_response: suggestion.debug_info ? JSON.stringify(suggestion.debug_info) : null
            }
          );
          console.log(`Saved business intelligence for: ${businessName}`);
        } catch (mongoError) {
          console.error(`Error saving to MongoDB for ${businessName}:`, mongoError);
          // Don't fail the request if MongoDB save fails
        }
        
        categorySuggestions.push(suggestionData);
      } catch (error) {
        console.error(`Error getting suggestion for ${businessName}:`, error);
        categorySuggestions.push({
          business_name: businessName,
          suggested_category: 'הוצאות משתנות',
          confidence: 0,
          reasoning: 'Error occurred during Perplexity categorization',
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      suggestions: categorySuggestions
    });

  } catch (error) {
    console.error('Error getting category suggestions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get category suggestions' 
    });
  }
});

// Update business categories in bulk
router.post('/businesses/update-categories', authenticateToken, async (req, res) => {
  try {
    const { category_updates } = req.body;

    if (!category_updates || !Array.isArray(category_updates) || category_updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'category_updates array is required' 
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [],
      updated_businesses: []
    };

    // Process each business category update
    for (const update of category_updates) {
      const { business_name, new_category, exclude_transaction_ids = [] } = update;
      
      if (!business_name || !new_category) {
        results.failed++;
        results.errors.push({
          business_name: business_name || 'Unknown',
          error: 'business_name and new_category are required'
        });
        continue;
      }

      try {
        // Get all transactions for this business with current "הוצאות משתנות" category
        const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
          show_all: true 
        });

        const businessTransactions = transactions.filter(t => 
          t.business_name === business_name && 
          t.category_name === 'הוצאות משתנות' &&
          !exclude_transaction_ids.includes(t.id)
        );

        if (businessTransactions.length === 0) {
          results.failed++;
          results.errors.push({
            business_name: business_name,
            error: 'No transactions found for this business'
          });
          continue;
        }

        // Update all transactions for this business
        let updatedCount = 0;
        for (const transaction of businessTransactions) {
          const success = await SupabaseService.updateTransaction(transaction.id, {
            category_name: new_category,
            updated_at: new Date().toISOString()
          });

          if (success) {
            updatedCount++;
          }
        }

        if (updatedCount > 0) {
          results.success++;
          results.updated_businesses.push({
            business_name: business_name,
            new_category: new_category,
            updated_transactions: updatedCount
          });
        } else {
          results.failed++;
          results.errors.push({
            business_name: business_name,
            error: 'Failed to update any transactions'
          });
        }

      } catch (error) {
        results.failed++;
        results.errors.push({
          business_name: business_name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Bulk category update completed',
      results: results
    });

  } catch (error) {
    console.error('Error in bulk category update:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update business categories' 
    });
  }
});

// Get transactions for a specific business name
router.get('/businesses/:businessName/transactions', authenticateToken, async (req, res) => {
  try {
    const businessName = decodeURIComponent(req.params.businessName);
    const { category_name } = req.query;

    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    });

    let businessTransactions = transactions.filter(t => 
      t.business_name === businessName
    );

    // Filter by category if specified
    if (category_name) {
      businessTransactions = businessTransactions.filter(t => 
        t.category_name === category_name
      );
    }

    // Sort by payment date (newest first)
    businessTransactions.sort((a, b) => 
      new Date(b.payment_date) - new Date(a.payment_date)
    );

    res.json({
      success: true,
      transactions: businessTransactions,
      total_count: businessTransactions.length,
      business_name: businessName
    });

  } catch (error) {
    console.error('Error fetching business transactions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch business transactions' 
    });
  }
});

// Helper function to get category suggestion from Perplexity API
async function getCategorySuggestionFromGPT(businessName, existingCategories, debug = false) {
  const axios = require('axios');
  
  // Check if Perplexity API is configured
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('Perplexity API key not configured');
  }

  console.log('Using Perplexity API key:', process.env.PERPLEXITY_API_KEY ? 'Available' : 'Missing');
  console.log('Trying to categorize business:', businessName, 'with model: sonar');
  console.log('Available categories:', existingCategories.filter(cat => cat && cat.trim() && cat !== 'הוצאות משתנות').slice(0, 15));


  try {
    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: debug ? 
            'You are a business research expert. Use web search to find detailed information about businesses. Return your response as JSON with category, business details, and reasoning.' :
            'You are a business categorization expert. Use web search to find information about businesses and categorize them accurately. Always respond with only the Hebrew category name.'
        },
        {
          role: 'user',  
          content: debug ? 
            `Research the business "${businessName}" online and provide comprehensive information. Search for the most recent and accurate details. Return a JSON response with this structure:
{
  "category": "Hebrew category name from the list",
  "business_info": {
    "name": "Full official business name",
    "type": "Detailed business type/industry",
    "location": "City/Area/Neighborhood",
    "country": "Country",
    "address": "Complete street address",
    "phone": "Phone numbers (multiple if available)",
    "email": "Email address if found",
    "website": "Official website URL",
    "opening_hours": "Detailed opening hours",
    "social_links": ["Facebook, Instagram, LinkedIn URLs"],
    "branch_info": "Chain/franchise/parent company info",
    "services": "Main products/services offered",
    "payment_methods": "Accepted payment methods",
    "parking": "Parking availability info",
    "accessibility": "Accessibility features",
    "rating": "Customer rating/reviews if available",
    "year_established": "Year founded if available",
    "employee_count": "Approximate number of employees",
    "business_id": "Company registration number if found",
    "description": "Comprehensive business description"
  },
  "reasoning": "Detailed explanation for the categorization with sources"
}

Available categories: ${existingCategories.filter(cat => cat && cat.trim() && cat !== 'הוצאות משתנות').slice(0, 15).join(', ')}

Rules:
- If it's flowers/plants: "פנאי ובילויים" 
- If it's food/restaurant: "אוכל בחוץ"
- If it's supermarket: "סופר"
- If it's gas/fuel: "רכב ותחבורה ציבורית"
- If it's pharmacy: "פארמה"
- If it's coffee shop: "בתי קפה"
- If it's clothing: "ביגוד והנעלה"
- If it's general shopping: "כללי"` :
            `What type of business is "${businessName}"? Search online to understand what this business does. Then categorize it into ONE of these categories: ${existingCategories.filter(cat => cat && cat.trim() && cat !== 'הוצאות משתנות').slice(0, 15).join(', ')}. 

Rules:
- If it's flowers/plants: "פנאי ובילויים" 
- If it's food/restaurant: "אוכל בחוץ"
- If it's supermarket: "סופר"
- If it's gas/fuel: "רכב ותחבורה ציבורית"
- If it's pharmacy: "פארמה"
- If it's coffee shop: "בתי קפה"
- If it's clothing: "ביגוד והנעלה"
- If it's general shopping: "כללי"

Return ONLY the Hebrew category name, nothing else.`
        }
      ],
      temperature: 0.1,
      max_tokens: debug ? 2000 : 20
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Perplexity');
    }

    const result = {
      confidence: 0.8, // Fixed confidence for Perplexity
      reasoning: 'Perplexity AI categorization'
    };

    // Add debug information if requested
    if (debug) {
      result.debug_info = {
        raw_response: response.data,
        perplexity_content: content
      };
    }

    if (debug) {
      try {
        // נבדוק אם ה-JSON לא מלא (נחתך באמצע)
        let jsonContent = content.trim();
        
        // נתקן בעיות של גרשיים כפולים בתוך מחרוזות
        // נתקן את הגרשיים הכפולים ב-"name" שמכילים "מ.ע. אחזקות בע"מ"
        jsonContent = jsonContent.replace(/"([^"]*)(בע"מ)([^"]*)"/g, '"$1בע\\"מ$3"');
        jsonContent = jsonContent.replace(/"([^"]*)(מ\.ע\.)([^"]*)"/g, '"$1מ\\.ע\\.$3"');
        
        // אם ה-JSON נחתך, ננסה לסגור אותו
        if (!jsonContent.endsWith('}') && jsonContent.includes('{')) {
          // נספר כמה סוגריים פתוחים ונוסיף סגירות
          const openBraces = (jsonContent.match(/{/g) || []).length;
          const closeBraces = (jsonContent.match(/}/g) || []).length;
          const missingBraces = openBraces - closeBraces;
          
          if (missingBraces > 0) {
            // נסגור מחרוזות לא סגורות
            if (jsonContent.includes('"description": "') && !jsonContent.match(/"description": "[^"]*"[,}]/)) {
              jsonContent += '"';
            }
            if (jsonContent.includes('"reasoning": "') && !jsonContent.match(/"reasoning": "[^"]*"[}]/)) {
              jsonContent += '"';
            }
            // נוסיף סוגריים חסרים
            jsonContent += '}'.repeat(missingBraces);
          }
        }
        
        console.log('Attempting to parse JSON:', jsonContent.substring(0, 200) + '...');
        const jsonResponse = JSON.parse(jsonContent);
        
        result.category = jsonResponse.category || 'הוצאות משתנות';
        result.business_info = jsonResponse.business_info || {};
        result.reasoning = jsonResponse.reasoning || 'Perplexity AI categorization with detailed research';
        
        console.log('Successfully parsed JSON. Category:', result.category);
        
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError.message);
        console.log('Raw content:', content.substring(0, 300) + '...');
        
        // חילוץ הקטגוריה ידנית מה-JSON הפגום
        const categoryMatch = content.match(/"category":\s*"([^"]+)"/);
        if (categoryMatch) {
          result.category = categoryMatch[1];
          console.log('Extracted category manually:', result.category);
        } else {
          result.category = 'הוצאות משתנות';
        }
        
        // ננסה לחלץ מידע עסקי בסיסי
        const nameMatch = content.match(/"name":\s*"([^"]+)"/);
        const typeMatch = content.match(/"type":\s*"([^"]+)"/);
        const locationMatch = content.match(/"location":\s*"([^"]+)"/);
        
        result.business_info = {
          name: nameMatch ? nameMatch[1] : businessName,
          type: typeMatch ? typeMatch[1] : '',
          location: locationMatch ? locationMatch[1] : '',
          country: 'ישראל',
          address: '',
          phone: '',
          website: '',
          opening_hours: '',
          social_links: [],
          branch_info: '',
          description: 'מידע חלקי עקב חיתוך התגובה'
        };
        
        result.reasoning = 'Perplexity AI categorization (parsed from truncated response)';
      }
    } else {
      // Simple mode - just clean up the category name
      const cleanCategory = content.trim()
        .replace(/[.,!?'"]/g, '')
        .replace(/^\d+\.?\s*/, '') // Remove number prefixes
        .trim();
      result.category = cleanCategory || 'הוצאות משתנות';
    }

    return result;

  } catch (error) {
    console.error('Error calling Perplexity API:', error);
    
    // Log the full error response for debugging
    if (error.response) {
      console.error('Perplexity API response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    // Return a smart categorization based on business name as fallback
    let fallbackCategory = 'הוצאות משתנות';
    const businessLower = businessName.toLowerCase();
    
    // Food and drinks
    if (businessLower.includes('מזון') || businessLower.includes('מסעדה') || businessLower.includes('קפה') || 
        businessLower.includes('בורגר') || businessLower.includes('פיצה') || businessLower.includes('אוכל') ||
        businessLower.includes('מקדונלד') || businessLower.includes('ברגר') || businessLower.includes('דומינו') ||
        businessLower.includes('סושי') || businessLower.includes('שווארמה') || businessLower.includes('פלאפל')) {
      fallbackCategory = 'אוכל בחוץ';
    }
    // Shopping and retail
    else if (businessLower.includes('קניון') || businessLower.includes('קניות') || businessLower.includes('חנות') ||
             businessLower.includes('רמי לוי') || businessLower.includes('שופרסל') || businessLower.includes('סופר') ||
             businessLower.includes('טיב טעם') || businessLower.includes('מגה') || businessLower.includes('יינות ביתן')) {
      fallbackCategory = 'סופר';
    }
    // Transport and fuel
    else if (businessLower.includes('דלק') || businessLower.includes('רכב') || businessLower.includes('תחבורה') ||
             businessLower.includes('פז') || businessLower.includes('דור אלון') || businessLower.includes('סונול') ||
             businessLower.includes('חניה') || businessLower.includes('אוטובוס') || businessLower.includes('רכבת')) {
      fallbackCategory = 'רכב ותחבורה ציבורית';
    }
    // Entertainment
    else if (businessLower.includes('בילוי') || businessLower.includes('קולנוע') || businessLower.includes('משחק') ||
             businessLower.includes('סינמה') || businessLower.includes('תיאטרון') || businessLower.includes('הופעה')) {
      fallbackCategory = 'פנאי ובילויים';
    }
    // Coffee shops
    else if (businessLower.includes('קפה') || businessLower.includes('אספרסו') || businessLower.includes('נספרסו') ||
             businessLower.includes('ארומה') || businessLower.includes('קפה גרג') || businessLower.includes('לנדוור')) {
      fallbackCategory = 'בתי קפה';
    }
    // Flowers (from the example)
    else if (businessLower.includes('פרח') || businessLower.includes('זר') || businessLower.includes('עציצ') || businessLower.includes('נוי')) {
      fallbackCategory = 'פנאי ובילויים';
    }
    // Pharmacy
    else if (businessLower.includes('פארמה') || businessLower.includes('בית מרקחת') || businessLower.includes('סופר פארם')) {
      fallbackCategory = 'פארמה';
    }
    // General
    else if (businessLower.includes('כללי') || businessLower.includes('שונות') || businessLower.includes('מעורב')) {
      fallbackCategory = 'כללי';
    }
    
    console.log(`Using fallback categorization for ${businessName}: ${fallbackCategory}`);
    
    return {
      category: fallbackCategory,
      confidence: 0.5,
      reasoning: 'Fallback categorization - Perplexity API unavailable'
    };
  }
}

// Get all available categories for dropdown
router.get('/categories/available', authenticateToken, async (req, res) => {
  try {
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    });
    
    const existingCategories = [...new Set(
      transactions
        .map(t => t.category_name)
        .filter(name => name && name.trim())
    )].sort();

    res.json({
      success: true,
      categories: existingCategories
    });

  } catch (error) {
    console.error('Error fetching available categories:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch available categories' 
    });
  }
});

// Get business intelligence from MongoDB
router.get('/businesses/intelligence', authenticateToken, async (req, res) => {
  try {
    const { business_name } = req.query;
    
    const result = await mongoBusinessService.getBusinessIntelligence(
      req.user.id, 
      business_name
    );

    res.json(result);

  } catch (error) {
    console.error('Error fetching business intelligence:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch business intelligence' 
    });
  }
});

// Update business information in MongoDB (separate from category updates)
router.post('/businesses/update-intelligence', authenticateToken, async (req, res) => {
  try {
    const { business_name, update_data } = req.body;

    if (!business_name || !update_data) {
      return res.status(400).json({ 
        success: false, 
        error: 'business_name and update_data are required' 
      });
    }

    const result = await mongoBusinessService.updateBusinessIntelligence(
      req.user.id,
      business_name,
      update_data
    );

    res.json(result);

  } catch (error) {
    console.error('Error updating business intelligence:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update business intelligence' 
    });
  }
});

// Get business statistics from MongoDB
router.get('/businesses/stats', authenticateToken, async (req, res) => {
  try {
    const result = await mongoBusinessService.getBusinessStats(req.user.id);
    res.json(result);

  } catch (error) {
    console.error('Error fetching business stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch business stats' 
    });
  }
});

// ===== SPLIT TRANSACTION =====

// Split a transaction into multiple transactions
router.post('/split', authenticateToken, async (req, res) => {
  try {
    const { originalTransactionId, splits } = req.body;

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
    
    console.log('🔄 Starting to create split transactions...');
    
    for (const split of splits) {
      try {
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
          notes: `[SPLIT] פוצל מעסקה מקורית: ${originalTransaction.business_name} | מזהה מקורי: ${originalTransactionId} | הסבר: ${split.description || 'ללא הסבר'}`
        };

        console.log('🔄 Creating transaction:', newTransaction);
        const result = await SupabaseService.createTransaction(newTransaction);
        
        if (result && result.success && result.data) {
          newTransactions.push(result.data);
          console.log('✅ Transaction created successfully:', result.data.id);
        } else {
          console.error('❌ Failed to create transaction. Result:', result);
          allTransactionsCreated = false;
          break;
        }
      } catch (error) {
        console.error('❌ Error creating transaction:', error);
        allTransactionsCreated = false;
        break;
      }
    }

    // Only proceed if ALL transactions were created successfully
    if (!allTransactionsCreated || newTransactions.length !== splits.length) {
      console.error('❌ Not all transactions created. Rolling back...');
      
      // Delete any transactions that were created
      for (const transaction of newTransactions) {
        try {
          const transactionId = transaction.id || transaction.transaction_id;
          await SupabaseService.deleteTransaction(transactionId);
          console.log('🔄 Rolled back transaction:', transactionId);
        } catch (rollbackError) {
          console.error('❌ Error rolling back transaction:', rollbackError);
        }
      }
      
      return res.status(500).json({ 
        success: false, 
        error: `Failed to create all split transactions. Created ${newTransactions.length} out of ${splits.length}. Original transaction preserved.` 
      });
    }

    console.log('✅ All split transactions created successfully. Deleting original...');

    // Only delete original transaction if ALL splits were created successfully
    try {
      // Mark original transaction as split in the notes, then delete it
      await SupabaseService.updateTransaction(originalTransactionId, {
        notes: `עסקה פוצלה ל-${splits.length} עסקאות - ${new Date().toISOString()}`
      });

      // Delete the original transaction
      await SupabaseService.deleteTransaction(originalTransactionId);
      console.log('✅ Original transaction deleted successfully');
    } catch (deleteError) {
      console.error('❌ Error deleting original transaction:', deleteError);
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
          console.log(`✅ Deleted split transaction: ${transaction.id}`);
        } else {
          errors.push(`Failed to delete transaction ${transaction.id}`);
        }
      } catch (error) {
        console.error(`❌ Error deleting split transaction ${transaction.id}:`, error);
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

module.exports = router;