const express = require('express');
const SupabaseService = require('../services/supabaseService');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get user cash flows
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [CASHFLOWS API] Request from user:', req.user.id);
    console.log('🔍 [CASHFLOWS API] User object:', { id: req.user.id, email: req.user.email, username: req.user.username });
    
    const cashFlows = await SupabaseService.getCashFlows(req.user.id);
    
    console.log('🔍 [CASHFLOWS API] Raw result from SupabaseService:', cashFlows);
    console.log('🔍 [CASHFLOWS API] Cash flows count:', Array.isArray(cashFlows) ? cashFlows.length : 'Not an array');
    
    if (Array.isArray(cashFlows)) {
      cashFlows.forEach((flow, index) => {
        console.log(`🔍 [CASHFLOWS API] Flow ${index + 1}:`, {
          id: flow.id,
          name: flow.name,
          user_id: flow.user_id,
          currency: flow.currency
        });
      });
    }
    
    res.json(cashFlows);
  } catch (error) {
    console.error('Get cash flows error:', error);
    res.status(500).json({ error: 'Failed to fetch cash flows' });
  }
});

// Get default cash flow
router.get('/default', authenticateToken, async (req, res) => {
  try {
    const defaultCashFlow = await SupabaseService.getDefaultCashFlow(req.user.id);
    
    if (!defaultCashFlow) {
      return res.status(404).json({ error: 'No default cash flow found' });
    }

    res.json(defaultCashFlow);
  } catch (error) {
    console.error('Get default cash flow error:', error);
    res.status(500).json({ error: 'Failed to fetch default cash flow' });
  }
});

// Create new cash flow
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      is_default = false, 
      currency = 'ILS',
      is_monthly = true,
      is_investment_account = false
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const cashFlowData = {
      user_id: req.user.id,
      name,
      description,
      is_default,
      currency,
      is_monthly,
      is_investment_account
    };

    const cashFlow = await SupabaseService.createCashFlow(cashFlowData);
    
    if (!cashFlow) {
      return res.status(500).json({ error: 'Failed to create cash flow' });
    }

    res.status(201).json(cashFlow);
  } catch (error) {
    console.error('Create cash flow error:', error);
    res.status(500).json({ error: 'Failed to create cash flow' });
  }
});

// Update cash flow
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      is_default, 
      currency,
      is_monthly,
      is_investment_account
    } = req.body;

    // Verify cash flow exists and belongs to user
    const existingCashFlow = await SupabaseService.getCashFlow(id);
    if (!existingCashFlow || existingCashFlow.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Cash flow not found' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (currency) updateData.currency = currency;
    if (is_monthly !== undefined) updateData.is_monthly = is_monthly;
    if (is_investment_account !== undefined) updateData.is_investment_account = is_investment_account;

    const updatedCashFlow = await SupabaseService.updateCashFlow(id, updateData);
    
    if (!updatedCashFlow) {
      return res.status(500).json({ error: 'Failed to update cash flow' });
    }

    res.json(updatedCashFlow);
  } catch (error) {
    console.error('Update cash flow error:', error);
    res.status(500).json({ error: 'Failed to update cash flow' });
  }
});

// Get latest transaction date for cash flow
router.get('/:id/latest-transaction-date', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { file_source } = req.query;
    
    // Verify cash flow exists and belongs to user
    const existingCashFlow = await SupabaseService.getCashFlow(id);
    if (!existingCashFlow || existingCashFlow.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Cash flow not found' });
    }

    const latestDate = await SupabaseService.getLatestTransactionDate(id, file_source);
    
    res.json({ 
      cashFlowId: id,
      cashFlowName: existingCashFlow.name,
      latestTransactionDate: latestDate,
      fileSource: file_source
    });
  } catch (error) {
    console.error('Get latest transaction date error:', error);
    res.status(500).json({ error: 'Failed to fetch latest transaction date' });
  }
});

// Set default cash flow
router.put('/:id/set-default', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify cash flow exists and belongs to user
    const existingCashFlow = await SupabaseService.getCashFlow(id);
    if (!existingCashFlow || existingCashFlow.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Cash flow not found' });
    }

    // Set this as default and remove default from others
    const updatedCashFlow = await SupabaseService.updateCashFlow(id, { is_default: true });
    
    if (!updatedCashFlow) {
      return res.status(500).json({ error: 'Failed to set default cash flow' });
    }

    res.json(updatedCashFlow);
  } catch (error) {
    console.error('Set default cash flow error:', error);
    res.status(500).json({ error: 'Failed to set default cash flow' });
  }
});

// Get cash flow analytics
router.get('/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;
    
    // Verify cash flow exists and belongs to user
    const existingCashFlow = await SupabaseService.getCashFlow(id);
    if (!existingCashFlow || existingCashFlow.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Cash flow not found' });
    }

    // Get transactions for the specified period
    const transactions = await SupabaseService.getTransactionsByCashFlow(
      id, 
      start_date, 
      end_date,
      1000 // limit
    );

    // Calculate analytics
    const analytics = {
      totalTransactions: transactions.length,
      totalIncome: 0,
      totalExpenses: 0,
      netFlow: 0,
      monthlyBreakdown: {},
      categoryBreakdown: {},
      averageMonthlyFlow: 0
    };

    // Process transactions
    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount);
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const category = transaction.category_name || 'אחר';

      // Update totals
      analytics.netFlow += amount;
      if (amount > 0) {
        analytics.totalIncome += amount;
      } else {
        analytics.totalExpenses += Math.abs(amount);
      }

      // Monthly breakdown
      if (!analytics.monthlyBreakdown[monthKey]) {
        analytics.monthlyBreakdown[monthKey] = {
          income: 0,
          expenses: 0,
          net: 0,
          transactions: 0
        };
      }
      
      analytics.monthlyBreakdown[monthKey].transactions++;
      analytics.monthlyBreakdown[monthKey].net += amount;
      
      if (amount > 0) {
        analytics.monthlyBreakdown[monthKey].income += amount;
      } else {
        analytics.monthlyBreakdown[monthKey].expenses += Math.abs(amount);
      }

      // Category breakdown
      if (!analytics.categoryBreakdown[category]) {
        analytics.categoryBreakdown[category] = {
          income: 0,
          expenses: 0,
          transactions: 0
        };
      }
      
      analytics.categoryBreakdown[category].transactions++;
      
      if (amount > 0) {
        analytics.categoryBreakdown[category].income += amount;
      } else {
        analytics.categoryBreakdown[category].expenses += Math.abs(amount);
      }
    });

    // Calculate average monthly flow
    const monthCount = Object.keys(analytics.monthlyBreakdown).length;
    if (monthCount > 0) {
      analytics.averageMonthlyFlow = analytics.netFlow / monthCount;
    }

    res.json({
      cashFlow: existingCashFlow,
      analytics,
      period: {
        start_date,
        end_date
      }
    });
  } catch (error) {
    console.error('Get cash flow analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch cash flow analytics' });
  }
});

// Delete cash flow
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ [DELETE CASHFLOW] Attempting to delete cash flow:', id, 'for user:', req.user.id);
    
    // Verify cash flow exists and belongs to user
    const existingCashFlow = await SupabaseService.getCashFlow(id);
    console.log('🗑️ [DELETE CASHFLOW] Existing cash flow found:', existingCashFlow);
    
    if (!existingCashFlow || existingCashFlow.user_id !== req.user.id) {
      console.log('🗑️ [DELETE CASHFLOW] Cash flow not found or access denied');
      return res.status(404).json({ error: 'Cash flow not found' });
    }

    console.log('🗑️ [DELETE CASHFLOW] Calling SupabaseService.deleteCashFlow...');
    const success = await SupabaseService.deleteCashFlow(id);
    console.log('🗑️ [DELETE CASHFLOW] Delete result:', success);
    
    if (!success) {
      console.log('🗑️ [DELETE CASHFLOW] Delete failed');
      return res.status(500).json({ error: 'Failed to delete cash flow' });
    }

    console.log('🗑️ [DELETE CASHFLOW] Delete successful');
    res.json({ message: 'Cash flow deleted successfully' });
  } catch (error) {
    console.error('🗑️ [DELETE CASHFLOW] Error:', error);
    res.status(500).json({ error: 'Failed to delete cash flow' });
  }
});

module.exports = router;