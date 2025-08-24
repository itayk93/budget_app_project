/**
 * Demo Routes
 * API endpoints for demo mode functionality
 */

const express = require('express');
const { demoData } = require('../data/demo-data');
const demoModeMiddleware = require('../middleware/demo-mode');
const router = express.Router();

// Apply demo mode middleware to all routes
router.use(demoModeMiddleware);

// Demo Dashboard Data
router.get('/dashboard', (req, res) => {
  try {
    const { year, month, cash_flow, all_time } = req.query;
    
    // Get the requested month's data or current month
    const currentDate = new Date();
    const requestedYear = year ? parseInt(year) : currentDate.getFullYear();
    const requestedMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    const monthKey = `${requestedYear}-${requestedMonth.toString().padStart(2, '0')}`;
    
    // Find monthly stats for the requested month
    const monthStats = demoData.monthlyStats.find(stat => stat.month === monthKey) || 
                      demoData.monthlyStats[demoData.monthlyStats.length - 1]; // Fallback to latest month
    
    // Get transactions for the month
    const monthTransactions = demoData.transactions[monthKey] || [];
    
    // Group transactions by category and calculate totals
    const categoryMap = {};
    const orderedCategories = [];
    
    // Initialize all categories with zero values
    demoData.categories.forEach(category => {
      categoryMap[category.category_name] = {
        name: category.category_name,
        type: category.shared_category === "הכנסות" ? 'income' : 'expense',
        amount: 0,
        count: 0,
        transactions: [],
        monthly_target: category.monthly_target,
        shared_category: category.shared_category,
        weekly_display: category.weekly_display,
        display_order: category.display_order,
        is_shared_category: false,
        sub_categories: null,
        use_shared_target: category.use_shared_target
      };
    });
    
    // Add transaction data to categories
    monthTransactions.forEach(transaction => {
      const categoryName = transaction.category_name;
      if (categoryMap[categoryName]) {
        categoryMap[categoryName].amount += Math.abs(transaction.amount);
        categoryMap[categoryName].count += 1;
        categoryMap[categoryName].transactions.push({
          id: transaction.id,
          date: transaction.date,
          amount: transaction.amount,
          description: transaction.description
        });
      }
    });
    
    // Convert to ordered array and handle shared categories
    const sharedCategoryGroups = {};
    
    Object.values(categoryMap).forEach(category => {
      if (category.shared_category) {
        // Handle shared categories
        if (!sharedCategoryGroups[category.shared_category]) {
          sharedCategoryGroups[category.shared_category] = {
            name: category.shared_category,
            type: category.type,
            amount: 0,
            count: 0,
            transactions: [],
            is_shared_category: true,
            sub_categories: {},
            display_order: Math.min(...demoData.categories
              .filter(c => c.shared_category === category.shared_category)
              .map(c => c.display_order)
            )
          };
        }
        
        // Add to shared category group
        const sharedGroup = sharedCategoryGroups[category.shared_category];
        sharedGroup.amount += category.amount;
        sharedGroup.count += category.count;
        sharedGroup.transactions.push(...category.transactions);
        
        // Add as sub-category
        sharedGroup.sub_categories[category.name] = {
          amount: category.amount,
          count: category.count,
          type: category.type,
          transactions: category.transactions
        };
      } else {
        // Regular standalone category
        orderedCategories.push(category);
      }
    });
    
    // Add shared category groups
    Object.values(sharedCategoryGroups).forEach(group => {
      orderedCategories.push(group);
    });
    
    // Sort by display order
    orderedCategories.sort((a, b) => a.display_order - b.display_order);
    
    const response = {
      summary: {
        total_income: monthStats.total_income,
        total_expenses: -monthStats.total_expenses, // Negative for expenses
        net_balance: monthStats.net_balance
      },
      transaction_count: monthStats.transaction_count,
      flow_month: monthKey,
      current_cash_flow_id: 'demo-cash-flow-id',
      all_time: all_time === '1',
      orderedCategories: orderedCategories,
      cash_flows: [demoData.cashFlows[0]],
      hebrew_month_name: getHebrewMonthName(requestedMonth)
    };
    
    console.log('🎭 Demo Dashboard Response:', {
      month: monthKey,
      categoriesCount: orderedCategories.length,
      transactionsCount: monthTransactions.length,
      totalIncome: monthStats.total_income,
      totalExpenses: monthStats.total_expenses
    });
    
    res.json(response);
  } catch (error) {
    console.error('Demo dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch demo dashboard data' });
  }
});

// Demo Transactions
router.get('/transactions', (req, res) => {
  try {
    const { year, month, category, cash_flow } = req.query;
    
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    let transactions = demoData.transactions[monthKey] || [];
    
    // Filter by category if specified
    if (category) {
      transactions = transactions.filter(t => t.category_name === category);
    }
    
    res.json({
      data: transactions,
      total: transactions.length
    });
  } catch (error) {
    console.error('Demo transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch demo transactions' });
  }
});

// Demo Categories
router.get('/categories', (req, res) => {
  try {
    res.json(demoData.categories);
  } catch (error) {
    console.error('Demo categories error:', error);
    res.status(500).json({ error: 'Failed to fetch demo categories' });
  }
});

// Demo Cash Flows
router.get('/cash-flows', (req, res) => {
  try {
    res.json(demoData.cashFlows);
  } catch (error) {
    console.error('Demo cash flows error:', error);
    res.status(500).json({ error: 'Failed to fetch demo cash flows' });
  }
});

// Demo User Info
router.get('/user', (req, res) => {
  try {
    res.json(demoData.user);
  } catch (error) {
    console.error('Demo user error:', error);
    res.status(500).json({ error: 'Failed to fetch demo user data' });
  }
});

// Demo Monthly Stats
router.get('/stats', (req, res) => {
  try {
    res.json(demoData.monthlyStats);
  } catch (error) {
    console.error('Demo stats error:', error);
    res.status(500).json({ error: 'Failed to fetch demo stats' });
  }
});

// Helper function to get Hebrew month name
const getHebrewMonthName = (month) => {
  const hebrewMonths = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  return hebrewMonths[month - 1];
};

module.exports = router;