const express = require('express');
const SupabaseService = require('../services/supabaseService');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Calculate and update monthly target based on historical average
router.post('/calculate-monthly-target', authenticateToken, async (req, res) => {
  try {
    const { category_name, months = 3 } = req.body;
    
    if (!category_name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    const userId = req.user.id;
    const average = await SupabaseService.calculateMonthlyAverage(userId, category_name, months);
    const updatedCategory = await SupabaseService.updateCategoryMonthlyTarget(userId, category_name, average);
    
    res.json({
      success: true,
      monthly_target: average,
      category: updatedCategory
    });
  } catch (error) {
    console.error('Calculate monthly target error:', error);
    res.status(500).json({ error: 'Failed to calculate monthly target' });
  }
});

// Update monthly target manually
router.post('/update-monthly-target', authenticateToken, async (req, res) => {
  try {
    const { category_name, monthly_target } = req.body;
    
    if (!category_name || monthly_target === undefined) {
      return res.status(400).json({ error: 'Category name and monthly target are required' });
    }
    
    const userId = req.user.id;
    const updatedCategory = await SupabaseService.updateCategoryMonthlyTarget(userId, category_name, monthly_target);
    
    res.json({
      success: true,
      category: updatedCategory
    });
  } catch (error) {
    console.error('Update monthly target error:', error);
    res.status(500).json({ error: 'Failed to update monthly target' });
  }
});

// Get category spending data for current month
router.get('/monthly-spending/:categoryName', authenticateToken, async (req, res) => {
  try {
    const { categoryName } = req.params;
    const userId = req.user.id;
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const currentSpending = await SupabaseService.getCategoryMonthlySpending(
      userId, 
      categoryName, 
      currentYear, 
      currentMonth
    );
    
    res.json({
      success: true,
      current_spending: currentSpending,
      month: currentMonth,
      year: currentYear
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
    const shouldRefresh = await SupabaseService.shouldRefreshMonthlyTargets(userId);
    
    res.json({
      success: true,
      should_refresh: shouldRefresh
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
    const result = await SupabaseService.refreshMonthlyTargetsForNewMonth(userId, force);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Refresh monthly targets error:', error);
    res.status(500).json({ error: 'Failed to refresh monthly targets' });
  }
});

module.exports = router;