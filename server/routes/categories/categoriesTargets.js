const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const AdditionalMethods = require('../../services/supabase-modules/AdditionalMethods');
const { supabase } = require('../../config/supabase');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== CATEGORY MONTHLY TARGETS MANAGEMENT =====

// Calculate monthly target based on historical average
router.post('/calculate-monthly-target', authenticateToken, async (req, res) => {
  try {
    const { categoryName, monthsBack = 6 } = req.body;
    
    if (!categoryName) {
      return res.status(400).json({ error: 'categoryName is required' });
    }

    // Get historical transactions for this category
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    });
    
    const categoryTransactions = transactions.filter(t => 
      t.category_name === categoryName
    );

    if (categoryTransactions.length === 0) {
      return res.status(400).json({ error: 'No historical transactions found for this category' });
    }

    // Group by month and calculate averages
    const monthlyTotals = new Map();
    
    categoryTransactions.forEach(transaction => {
      const date = new Date(transaction.payment_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyTotals.has(monthKey)) {
        monthlyTotals.set(monthKey, 0);
      }
      
      monthlyTotals.set(monthKey, monthlyTotals.get(monthKey) + Math.abs(parseFloat(transaction.amount || 0)));
    });

    // Calculate average from recent months
    const monthlyValues = Array.from(monthlyTotals.values()).slice(-monthsBack);
    const averageMonthlySpending = monthlyValues.length > 0 
      ? monthlyValues.reduce((sum, val) => sum + val, 0) / monthlyValues.length
      : 0;

    const suggestedTarget = Math.round(averageMonthlySpending);

    res.json({
      success: true,
      category_name: categoryName,
      suggested_target: suggestedTarget,
      historical_data: {
        months_analyzed: monthlyValues.length,
        monthly_totals: Array.from(monthlyTotals.entries()).slice(-monthsBack)
      }
    });
  } catch (error) {
    console.error('Calculate monthly target error:', error);
    res.status(500).json({ error: 'Failed to calculate monthly target' });
  }
});

// Update monthly target manually
router.post('/update-monthly-target', authenticateToken, async (req, res) => {
  try {
    const { categoryName, target } = req.body;
    
    if (!categoryName || typeof target !== 'number') {
      return res.status(400).json({ error: 'categoryName and target are required' });
    }

    // Update or insert category target
    const { data, error } = await supabase
      .from('category_order')
      .upsert({
        user_id: req.user.id,
        category_name: categoryName,
        monthly_target: target,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Monthly target updated successfully',
      category: data
    });
  } catch (error) {
    console.error('Update monthly target error:', error);
    res.status(500).json({ error: 'Failed to update monthly target' });
  }
});

// Get current month spending for category
router.get('/monthly-spending/:categoryName', authenticateToken, async (req, res) => {
  try {
    const { categoryName } = req.params;
    const { year: queryYear, month: queryMonth } = req.query;
    
    const currentDate = new Date();
    const year = queryYear ? parseInt(queryYear) : currentDate.getFullYear();
    const month = queryMonth ? parseInt(queryMonth) : currentDate.getMonth() + 1;

    const filters = {
      year,
      month,
      category_name: categoryName
    };

    const { transactions } = await SupabaseService.getTransactions(req.user.id, filters);
    
    const totalSpending = transactions.reduce((sum, t) => 
      sum + Math.abs(parseFloat(t.amount || 0)), 0
    );

    res.json({
      success: true,
      category_name: categoryName,
      current_month: `${year}-${String(month).padStart(2, '0')}`,
      total_spending: totalSpending,
      transaction_count: transactions.length
    });
  } catch (error) {
    console.error('Get monthly spending error:', error);
    res.status(500).json({ error: 'Failed to get monthly spending' });
  }
});

// Get category spending history for histogram
router.get('/spending-history/:categoryName', authenticateToken, async (req, res) => {
  try {
    const { categoryName } = req.params;
    const { months = 12 } = req.query;
    const userId = req.user.id;
    
    const spendingHistory = await SupabaseService.getCategorySpendingHistory(
      userId, 
      categoryName, 
      parseInt(months)
    );
    
    res.json({
      success: true,
      spending_history: spendingHistory
    });
  } catch (error) {
    console.error('Get spending history error:', error);
    res.status(500).json({ error: 'Failed to get spending history' });
  }
});

// Check if monthly targets should be refreshed for new month
router.get('/should-refresh-targets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await AdditionalMethods.shouldRefreshMonthlyTargets(userId);
    
    res.json({
      success: true,
      should_refresh: result.success ? result.data : false
    });
  } catch (error) {
    console.error('Check should refresh targets error:', error);
    res.status(500).json({ error: 'Failed to check refresh status' });
  }
});

// Refresh monthly targets for new month
router.post('/refresh-monthly-targets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { force = false } = req.body;
    const result = await AdditionalMethods.refreshMonthlyTargetsForNewMonth(userId, force);
    
    if (result.success) {
      res.json({
        success: true,
        updated: result.data.refreshed !== false,
        updatedCount: result.data.refreshedCount || 0,
        totalCategories: result.data.totalCategories || 0,
        ...result.data
      });
    } else {
      res.status(500).json({ error: result.error || 'Failed to refresh monthly targets' });
    }
  } catch (error) {
    console.error('Refresh monthly targets error:', error);
    res.status(500).json({ error: 'Failed to refresh monthly targets' });
  }
});

module.exports = router;