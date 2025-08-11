const express = require('express');
const SupabaseService = require('../services/supabaseService');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Helper function for Hebrew month names
function getHebrewMonthName(month) {
  const hebrewMonths = {
    1: 'ינואר',
    2: 'פברואר', 
    3: 'מרץ',
    4: 'אפריל',
    5: 'מאי',
    6: 'יוני',
    7: 'יולי',
    8: 'אוגוסט',
    9: 'ספטמבר',
    10: 'אוקטובר',
    11: 'נובמבר',
    12: 'דצמבר'
  };
  return hebrewMonths[month] || `חודש ${month}`;
}

// Main dashboard route
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let { flow_month, cash_flow, all_time, year, month, format } = req.query;
    
    // Handle null/empty values
    if (cash_flow === 'null' || cash_flow === '') {
      cash_flow = null;
    }
    
    // Validate cash flow exists if provided
    if (cash_flow) {
      const cashFlow = await SupabaseService.getCashFlow(cash_flow);
      if (!cashFlow || cashFlow.user_id !== userId) {
        return res.status(400).json({ 
          error: 'Invalid cash flow ID or you do not have access to this cash flow' 
        });
      }
    } else {
      // Get default cash flow if none provided
      const defaultCashFlow = await SupabaseService.getDefaultCashFlow(userId);
      if (!defaultCashFlow) {
        return res.status(400).json({ 
          error: 'No cash flows available. Please create a cash flow first.' 
        });
      }
      cash_flow = defaultCashFlow.id;
    }

    const allTime = all_time === '1' || all_time === 'true';
    let finalYear = null, finalMonth = null;

    // Parse and validate date parameters
    if (!allTime) {
      if (!flow_month || !SupabaseService.validateFlowMonth(flow_month)) {
        if (year && month) {
          finalYear = parseInt(year);
          finalMonth = parseInt(month);
          
          // Validate year and month ranges
          if (finalYear < 1900 || finalYear > 2100) {
            return res.status(400).json({ 
              error: `Year ${finalYear} is out of valid range (1900-2100)` 
            });
          }
          if (finalMonth < 1 || finalMonth > 12) {
            return res.status(400).json({ 
              error: `Month ${finalMonth} is out of valid range (1-12)` 
            });
          }
          
          flow_month = `${finalYear}-${finalMonth.toString().padStart(2, '0')}`;
        } else {
          // Default to the latest month with data
          const latestMonth = await SupabaseService.getLatestTransactionMonth(userId, cash_flow);
          if (latestMonth) {
            const [y, m] = latestMonth.split('-');
            finalYear = parseInt(y);
            finalMonth = parseInt(m);
            flow_month = latestMonth;
          } else {
            // Fallback to current month if no data
            const now = new Date();
            finalYear = now.getFullYear();
            finalMonth = now.getMonth() + 1;
            flow_month = `${finalYear}-${finalMonth.toString().padStart(2, '0')}`;
          }
        }
      } else {
        const [y, m] = flow_month.split('-');
        finalYear = parseInt(y);
        finalMonth = parseInt(m);
      }
    }

    // Get monthly savings if not all time
    let monthlySavings = 0;
    if (!allTime && finalYear && finalMonth) {
      monthlySavings = await SupabaseService.getMonthlySavings(
        userId, 
        cash_flow, 
        finalYear, 
        finalMonth
      );
    }

    // Get dashboard data - use AdditionalMethods for proper shared categories
    const AdditionalMethods = require('../services/supabase-modules/AdditionalMethods');
    const dashboardResult = await AdditionalMethods.getDashboardData(userId, {
      flowMonth: flow_month,
      cashFlowId: cash_flow,
      allTime: allTime,
      year: finalYear,
      month: finalMonth
    });
    
    // Extract data from result wrapper
    const actualData = dashboardResult.success ? dashboardResult.data : dashboardResult;

    // Check result
    if (!actualData) {
      return res.status(500).json({ 
        error: 'Failed to fetch dashboard data',
        details: 'No data returned' 
      });
    }

    // Get cash flows for selector
    const cashFlows = await SupabaseService.getCashFlows(userId);
    
    // Keep categories as ordered array (maintains display_order from database)
    const categories = {};
    const orderedCategories = [];
    if (actualData.category_breakdown && Array.isArray(actualData.category_breakdown)) {
      console.log('📋 Dashboard categories before processing (with shared categories):', actualData.category_breakdown.map(c => ({ 
        name: c.name, 
        display_order: c.display_order, 
        shared_category: c.shared_category,
        is_shared_category: c.is_shared_category,
        sub_categories: c.sub_categories ? Object.keys(c.sub_categories).length : 0
      })));
      
      actualData.category_breakdown.forEach(category => {
        const categoryData = {
          name: category.name,
          spent: category.type === 'income' ? category.amount : -category.amount,
          amount: category.amount,
          count: category.count,
          type: category.type,
          transactions: category.transactions || [], // Include transactions
          category_type: category.type,
          display_order: category.display_order, // Add display_order for debugging
          shared_category: category.shared_category || null, // Add shared_category from DB
          weekly_display: category.weekly_display || false,
          monthly_target: category.monthly_target || null,
          use_shared_target: category.use_shared_target || false,
          // CRITICAL: Add the shared category data that was missing
          is_shared_category: category.is_shared_category || false,
          sub_categories: category.sub_categories || null
        };
        
        // Keep both object format (for backward compatibility) and array format (for proper ordering)
        categories[category.name] = categoryData;
        orderedCategories.push(categoryData);
      });
      
      console.log('✅ Final ordered categories (with shared category data):', orderedCategories.map(c => ({ 
        name: c.name, 
        display_order: c.display_order, 
        shared_category: c.shared_category,
        is_shared_category: c.is_shared_category,
        sub_categories: c.sub_categories ? Object.keys(c.sub_categories).length : 0
      })));
    }
    
    // Prepare response data
    const responseData = {
      ...actualData,
      categories, // Add categories object for frontend compatibility
      orderedCategories, // Add ordered array that maintains display_order
      cash_flows: cashFlows,
      current_cash_flow_id: cash_flow,
      flow_month: flow_month,
      year: finalYear,
      month: finalMonth,
      all_time: allTime,
      hebrew_month_name: finalMonth ? getHebrewMonthName(finalMonth) : null,
      monthly_savings: 0, // Default value
      transaction_count: actualData.transaction_count || 0
    };

    // Return JSON for API requests
    if (format === 'json' || req.headers.accept?.includes('application/json')) {
      return res.json(responseData);
    }

    // For HTML requests, you would render a template here
    res.json(responseData);

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// API endpoint to change transaction flow month
router.post('/api/change_flow_month', authenticateToken, async (req, res) => {
  try {
    const { transaction_id, flow_month } = req.body;

    if (!transaction_id || !flow_month) {
      return res.status(400).json({
        success: false,
        message: 'Missing transaction_id or flow_month'
      });
    }

    // Verify flow_month format (YYYY-MM)
    if (!SupabaseService.validateFlowMonth(flow_month)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid flow_month format. Should be YYYY-MM'
      });
    }

    // Verify transaction belongs to user
    const transaction = await SupabaseService.getTransactionById(transaction_id);
    if (!transaction || transaction.user_id !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or access denied'
      });
    }

    // Update the transaction's flow_month
    const success = await SupabaseService.updateTransactionFlowMonth(
      transaction_id, 
      flow_month
    );

    if (success) {
      return res.json({
        success: true,
        message: 'Transaction flow month updated successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to update transaction'
      });
    }

  } catch (error) {
    console.error('Change flow month error:', error);
    res.status(500).json({
      success: false,
      message: `Unexpected error: ${error.message}`
    });
  }
});

// Get dashboard data by month navigation
router.get('/month/:year/:month', authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.params;
    const { cash_flow } = req.query;
    
    // Redirect to main dashboard with proper parameters
    const queryParams = new URLSearchParams({
      year: year,
      month: month,
      cash_flow: cash_flow || ''
    });
    
    res.redirect(`/api/dashboard?${queryParams.toString()}`);
    
  } catch (error) {
    console.error('Month navigation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;