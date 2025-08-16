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
    const { categoryName, category_name, monthsBack = 6, months = 6 } = req.body;
    const finalCategoryName = categoryName || category_name;
    const finalMonthsBack = months || monthsBack; // Use 'months' from frontend, fallback to 'monthsBack'
    
    if (!finalCategoryName) {
      return res.status(400).json({ error: 'categoryName or category_name is required' });
    }

    // Get ALL historical transactions for this category (increase limit)
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    }, 1, 5000); // Get up to 5000 transactions for accurate analysis
    
    const categoryTransactions = transactions.filter(t => 
      t.category_name === finalCategoryName
    );

    let suggestedTarget = 100; // Default fallback
    let message = '';
    let fallbackUsed = '';

    if (categoryTransactions.length === 0) {
      // No transactions ever - use default 100
      suggestedTarget = 100;
      message = 'לא נמצאו עסקאות בקטגוריה זו. נקבע יעד ברירת מחדל של 100 ש״ח';
      fallbackUsed = 'default';
    } else {
      // Calculate the date range for the requested months
      const currentDate = new Date();
      const startDate = new Date(currentDate);
      startDate.setMonth(currentDate.getMonth() - finalMonthsBack);
      
      
      // Filter transactions within the date range and group by month
      const monthlyTotals = new Map();
      
      categoryTransactions.forEach(transaction => {
        const transactionDate = new Date(transaction.payment_date);
        
        // Only include transactions within the requested time range
        if (transactionDate >= startDate && transactionDate <= currentDate) {
          const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyTotals.has(monthKey)) {
            monthlyTotals.set(monthKey, 0);
          }
          
          monthlyTotals.set(monthKey, monthlyTotals.get(monthKey) + Math.abs(parseFloat(transaction.amount || 0)));
        }
      });

      // Calculate average from months within the date range
      const recentMonthlyValues = Array.from(monthlyTotals.values());
      
      if (recentMonthlyValues.length > 0) {
        // Found data in requested period
        const averageMonthlySpending = recentMonthlyValues.reduce((sum, val) => sum + val, 0) / recentMonthlyValues.length;
        suggestedTarget = Math.round(averageMonthlySpending);
        message = `יעד מוצע על בסיס ממוצע ${finalMonthsBack} חודשים אחרונים (נמצאו נתונים עבור ${recentMonthlyValues.length} חודשים)`;
        fallbackUsed = 'average';
      } else {
        // No data in requested period - use default
        suggestedTarget = 100;
        message = `לא נמצאו עסקאות ב-${finalMonthsBack} החודשים האחרונים. נקבע יעד ברירת מחדל של 100 ש״ח`;
        fallbackUsed = 'default';
      }
    }

    function getHebrewMonthName(monthKey) {
      const [year, month] = monthKey.split('-');
      const monthNames = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }

    const response = {
      success: true,
      category_name: finalCategoryName,
      suggested_target: suggestedTarget,
      monthly_target: suggestedTarget, // Add this field for compatibility
      message: message,
      fallback_used: fallbackUsed,
      historical_data: {
        months_analyzed: fallbackUsed === 'average' ? finalMonthsBack : (fallbackUsed === 'latest' ? 1 : 0),
        total_transactions: categoryTransactions.length,
        fallback_used: fallbackUsed
      }
    };
    
    res.json(response);
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
    
    console.log(`[UPDATE TARGET] Updating monthly target for "${categoryName}" to ${target} for user ${req.user.id}`);
    
    // Check if this is an empty category (exists in user_empty_categories_display)
    const { data: emptyCategory, error: emptyError } = await supabase
      .from('user_empty_categories_display')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('category_name', categoryName)
      .limit(1);
    
    if (emptyError) {
      console.error('[UPDATE TARGET] Error checking empty categories:', emptyError);
    }
    
    const isEmptyCategory = emptyCategory && emptyCategory.length > 0;
    console.log(`[UPDATE TARGET] Is empty category: ${isEmptyCategory}`);
    
    // First try to update existing record in category_order
    const { data: updateData, error: updateError } = await supabase
      .from('category_order')
      .update({
        monthly_target: target,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.user.id)
      .eq('category_name', categoryName)
      .select();

    let data, error;
    
    if (updateError || !updateData || updateData.length === 0) {
      console.log(`[UPDATE TARGET] No existing record in category_order, creating new one`);
      // If update failed or no record exists, try to insert
      const { data: insertData, error: insertError } = await supabase
        .from('category_order')
        .insert({
          user_id: req.user.id,
          category_name: categoryName,
          monthly_target: target,
          display_order: 999, // Default order for new categories
          updated_at: new Date().toISOString()
        })
        .select();
      
      data = insertData;
      error = insertError;
      
      if (insertError) {
        console.error('[UPDATE TARGET] Insert error:', insertError);
      } else {
        console.log('[UPDATE TARGET] Successfully inserted new category_order record');
      }
    } else {
      console.log('[UPDATE TARGET] Successfully updated existing category_order record');
      data = updateData;
      error = updateError;
    }

    if (error) {
      throw error;
    }
    
    console.log(`[UPDATE TARGET] Monthly target update completed successfully for "${categoryName}"`);
    
    res.json({
      success: true,
      message: 'Monthly target updated successfully',
      category: data && data.length > 0 ? data[0] : null,
      is_empty_category: isEmptyCategory
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
    
    const result = await AdditionalMethods.getCategorySpendingHistory(
      userId, 
      categoryName, 
      parseInt(months)
    );
    
    if (result.success) {
      res.json({
        success: true,
        spending_history: result.data.history || []
      });
    } else {
      res.status(500).json({ error: result.error || 'Failed to get spending history' });
    }
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