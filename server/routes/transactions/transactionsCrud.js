const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const mongoBusinessService = require('../../services/mongoBusinessService');
const { authenticateToken } = require('../../middleware/auth');
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

module.exports = router;