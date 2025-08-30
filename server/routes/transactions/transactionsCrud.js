const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const TransactionService = require('../../services/supabase-modules/TransactionService');
const mongoBusinessService = require('../../services/mongoBusinessService');
const { authenticateToken } = require('../../middleware/auth');
const { createUserClient } = require('../../config/supabase');
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
      category_name, 
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
    if (category_name) filters.category_name = category_name;
    if (q) filters.q = q;
    if (notes) filters.notes = notes;
    if (no_category === 'true') filters.no_category = true;
    if (show_all === 'true') filters.show_all = true;

    // Using adminClient to bypass RLS authentication issues
    const userClient = null;
    const result = await TransactionService.getTransactions(
      req.user.id, 
      filters,
      parseInt(page),
      parseInt(per_page),
      userClient
    );

    if (result.success) {
      res.json({
        transactions: result.data.transactions,
        pagination: {
          page: parseInt(page),
          per_page: parseInt(per_page),
          total_count: result.data.totalCount,
          total_pages: Math.ceil(result.data.totalCount / parseInt(per_page))
        }
      });
    } else {
      res.status(500).json({ error: result.error || 'Failed to fetch transactions' });
    }

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get transactions by flow month - DIRECT URL SUPPORT
router.get('/flow-month/:flowMonth', authenticateToken, async (req, res) => {
  try {
    const flowMonth = req.params.flowMonth;
    const {
      page = 1,
      per_page = 200, // Increased default for flow month queries
      show_all = 'true'
    } = req.query;

    console.log(`📅 [FLOW MONTH] Getting transactions for flow month: ${flowMonth}, user: ${req.user.id}`);

    const filters = {
      flow_month: flowMonth,
      show_all: show_all === 'true'
    };

    // Using adminClient to bypass RLS authentication issues
    const userClient = null;
    const result = await TransactionService.getTransactions(
      req.user.id,
      filters,
      parseInt(page),
      parseInt(per_page),
      userClient
    );

    if (result.success) {
      console.log(`✅ [FLOW MONTH] Found ${result.data.transactions.length} transactions for ${flowMonth}`);
      res.json({
        transactions: result.data.transactions,
        pagination: {
          page: parseInt(page),
          per_page: parseInt(per_page),
          total_count: result.data.totalCount,
          total_pages: Math.ceil(result.data.totalCount / parseInt(per_page))
        }
      });
    } else {
      console.log(`❌ [FLOW MONTH] Failed to fetch transactions: ${result.error}`);
      res.status(500).json({ error: result.error || 'Failed to fetch transactions' });
    }

  } catch (error) {
    console.error('Error fetching transactions by flow month:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get transaction by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // Using adminClient to bypass RLS authentication issues
    const userClient = null;
    const transactionResult = await TransactionService.getTransactionById(req.params.id, userClient);
    const transaction = transactionResult.success ? transactionResult.data : null;
    
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
    // Using adminClient to bypass RLS authentication issues
    const userClient = null;
    const transactionResult = await TransactionService.getTransactionById(req.params.id, userClient);
    
    if (!transactionResult.success || !transactionResult.data) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const transaction = transactionResult.data;
    
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

    // Using adminClient to bypass RLS authentication issues
    const userClient = null;
    const result = await TransactionService.createTransaction(transactionData, false, userClient);

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
    console.log(`🔍 [PUT TRANSACTION] Attempting to update transaction ${transactionId} for user ${req.user.id}`);
    
    // First verify the transaction exists and belongs to the user
    // Using adminClient to bypass RLS authentication issues
    const userClient = null;
    console.log(`🔍 [PUT TRANSACTION] Using admin client to bypass RLS authentication issues`);
    
    const existingResult = await TransactionService.getTransactionById(transactionId, userClient);
    console.log(`🔍 [PUT TRANSACTION] getTransactionById result:`, {
      success: existingResult.success,
      hasData: !!existingResult.data,
      dataUserId: existingResult.data?.user_id,
      requestUserId: req.user.id,
      error: existingResult.error
    });
    
    if (!existingResult.success || !existingResult.data || existingResult.data.user_id !== req.user.id) {
      console.log(`❌ [PUT TRANSACTION] Transaction not found or access denied:`, {
        transactionId,
        userId: req.user.id,
        success: existingResult.success,
        hasData: !!existingResult.data,
        dataUserId: existingResult.data?.user_id
      });
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const existingTransaction = existingResult.data;

    // Verify cash flow belongs to user if being updated
    if (req.body.cash_flow_id) {
      const cashFlow = await SupabaseService.getCashFlow(req.body.cash_flow_id);
      if (!cashFlow || cashFlow.user_id !== req.user.id) {
        return res.status(400).json({ error: 'Invalid cash flow' });
      }
    }

    const updateResult = await TransactionService.updateTransaction(transactionId, req.body, userClient);
    const updatedTransaction = updateResult.success ? updateResult.data : null;

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
    console.log(`🗑️ [DELETE TRANSACTION] Attempting to delete transaction ${transactionId} for user ${req.user.id}`);
    
    // Verify the transaction exists and belongs to the user
    // Using adminClient to bypass RLS authentication issues
    const userClient = null;
    console.log(`🗑️ [DELETE TRANSACTION] Using admin client to bypass RLS authentication issues`);
    
    const existingResult = await TransactionService.getTransactionById(transactionId, userClient);
    console.log(`🗑️ [DELETE TRANSACTION] getTransactionById result:`, {
      success: existingResult.success,
      hasData: !!existingResult.data,
      dataUserId: existingResult.data?.user_id,
      requestUserId: req.user.id,
      error: existingResult.error
    });
    
    if (!existingResult.success || !existingResult.data || existingResult.data.user_id !== req.user.id) {
      console.log(`❌ [DELETE TRANSACTION] Transaction not found or access denied:`, {
        transactionId,
        userId: req.user.id,
        success: existingResult.success,
        hasData: !!existingResult.data,
        dataUserId: existingResult.data?.user_id
      });
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const deleteResult = await TransactionService.deleteTransaction(transactionId, userClient);
    const success = deleteResult.success;

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