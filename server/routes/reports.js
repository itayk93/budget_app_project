const express = require('express');
const SupabaseService = require('../services/supabaseService');
const { authenticateToken } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Get monthly report
router.get('/monthly/:year/:month', authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.params;
    const { cashFlowId } = req.query;

    const filters = {
      year: parseInt(year),
      month: parseInt(month),
      show_all: true
    };

    if (cashFlowId) {
      filters.cash_flow_id = cashFlowId;
    }

    const { transactions } = await SupabaseService.getTransactions(req.user.id, filters);

    // Calculate totals by category type
    const summary = {
      totalIncome: 0,
      totalExpenses: 0,
      totalSavings: 0,
      netAmount: 0,
      categories: {}
    };

    transactions.forEach(transaction => {
      if (!transaction.category_name) return;

      const categoryType = transaction.category?.category_type || 'variable_expense';
      const amount = Math.abs(parseFloat(transaction.amount || 0));

      if (!summary.categories[categoryType]) {
        summary.categories[categoryType] = {
          total: 0,
          categories: {}
        };
      }

      if (!summary.categories[categoryType].categories[transaction.category_name]) {
        summary.categories[categoryType].categories[transaction.category_name] = {
          total: 0,
          transactions: []
        };
      }

      summary.categories[categoryType].total += amount;
      summary.categories[categoryType].categories[transaction.category_name].total += amount;
      summary.categories[categoryType].categories[transaction.category_name].transactions.push(transaction);

      // Add to main totals
      if (categoryType === 'income') {
        summary.totalIncome += amount;
      } else if (categoryType === 'variable_expense' || categoryType === 'fixed_expense') {
        summary.totalExpenses += amount;
      } else if (categoryType === 'savings') {
        summary.totalSavings += amount;
        // Count savings as expenses for cash flow calculations (savings = money going out)
        summary.totalExpenses += amount;
      }
    });

    summary.netAmount = summary.totalIncome - summary.totalExpenses; // totalSavings already included in totalExpenses

    res.json({
      summary,
      transactions: transactions.slice(0, 100) // Limit to first 100 transactions
    });
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({ error: 'Failed to generate monthly report' });
  }
});

// Get yearly report
router.get('/yearly/:year', authenticateToken, async (req, res) => {
  try {
    const { year } = req.params;
    const { cashFlowId } = req.query;

    const whereClause = {
      user_id: req.user.id,
      is_excluded: false,
      date: {
        [Op.and]: [
          require('sequelize').fn('EXTRACT', require('sequelize').literal('YEAR FROM date'), '=', year)
        ]
      }
    };

    if (cashFlowId) {
      whereClause.cash_flow_id = cashFlowId;
    }

    const transactions = await Transaction.findAll({
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'category'
        }
      ],
      order: [['date', 'DESC']]
    });

    // Group by month
    const monthlyData = {};
    for (let month = 1; month <= 12; month++) {
      monthlyData[month] = {
        income: 0,
        expenses: 0,
        savings: 0,
        net: 0
      };
    }

    transactions.forEach(transaction => {
      if (!transaction.category) return;

      const date = new Date(transaction.date);
      const month = date.getMonth() + 1;
      const categoryType = transaction.category.category_type;
      const amount = Math.abs(transaction.amount);

      if (categoryType === 'income') {
        monthlyData[month].income += amount;
      } else if (categoryType === 'variable_expense' || categoryType === 'fixed_expense') {
        monthlyData[month].expenses += amount;
      } else if (categoryType === 'savings') {
        monthlyData[month].savings += amount;
        // Count savings as expenses for cash flow calculations
        monthlyData[month].expenses += amount;
      }
    });

    // Calculate net for each month
    Object.keys(monthlyData).forEach(month => {
      monthlyData[month].net = monthlyData[month].income - monthlyData[month].expenses - monthlyData[month].savings;
    });

    res.json({ monthlyData });
  } catch (error) {
    console.error('Yearly report error:', error);
    res.status(500).json({ error: 'Failed to generate yearly report' });
  }
});

// Get category trends
router.get('/category-trends/:categoryId', authenticateToken, async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { months = 6, cashFlowId } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - parseInt(months));

    const whereClause = {
      user_id: req.user.id,
      category_id: categoryId,
      is_excluded: false,
      date: {
        [Op.between]: [startDate, endDate]
      }
    };

    if (cashFlowId) {
      whereClause.cash_flow_id = cashFlowId;
    }

    const transactions = await Transaction.findAll({
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'category'
        }
      ],
      order: [['date', 'ASC']]
    });

    // Group by month
    const monthlyTrends = {};
    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyTrends[monthKey]) {
        monthlyTrends[monthKey] = {
          total: 0,
          count: 0,
          transactions: []
        };
      }

      monthlyTrends[monthKey].total += Math.abs(transaction.amount);
      monthlyTrends[monthKey].count += 1;
      monthlyTrends[monthKey].transactions.push(transaction);
    });

    res.json({ categoryTrends: monthlyTrends });
  } catch (error) {
    console.error('Category trends error:', error);
    res.status(500).json({ error: 'Failed to generate category trends' });
  }
});

// Get cash flow comparison
router.get('/cash-flows-comparison/:year/:month', authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.params;

    const userCashFlows = await CashFlow.getUserCashFlows(req.user.id);
    const comparison = {};

    for (const cashFlow of userCashFlows) {
      const transactions = await Transaction.findAll({
        where: {
          user_id: req.user.id,
          cash_flow_id: cashFlow.id,
          is_excluded: false,
          date: {
            [Op.and]: [
              require('sequelize').fn('EXTRACT', require('sequelize').literal('YEAR FROM date'), '=', year),
              require('sequelize').fn('EXTRACT', require('sequelize').literal('MONTH FROM date'), '=', month)
            ]
          }
        },
        include: [
          {
            model: Category,
            as: 'category'
          }
        ]
      });

      const summary = {
        income: 0,
        expenses: 0,
        savings: 0,
        net: 0
      };

      transactions.forEach(transaction => {
        if (!transaction.category) return;

        const categoryType = transaction.category.category_type;
        const amount = Math.abs(transaction.amount);

        if (categoryType === 'income') {
          summary.income += amount;
        } else if (categoryType === 'variable_expense' || categoryType === 'fixed_expense') {
          summary.expenses += amount;
        } else if (categoryType === 'savings') {
          summary.savings += amount;
          // Count savings as expenses for cash flow calculations
          summary.expenses += amount;
        }
      });

      summary.net = summary.income - summary.expenses; // savings already included in expenses
      comparison[cashFlow.id] = {
        name: cashFlow.name,
        summary,
        transactionCount: transactions.length
      };
    }

    res.json({ comparison });
  } catch (error) {
    console.error('Cash flow comparison error:', error);
    res.status(500).json({ error: 'Failed to generate cash flow comparison' });
  }
});

// Get monthly balance data for chart
router.get('/monthly-balance', authenticateToken, async (req, res) => {
  try {
    const { cash_flow_id } = req.query;

    // Get all transactions for this user and cash flow
    const filters = { show_all: true };
    if (cash_flow_id) {
      filters.cash_flow_id = cash_flow_id;
    }

    const { transactions } = await SupabaseService.getTransactions(req.user.id, filters);
    
    console.log(`[Monthly Balance] Found ${transactions.length} transactions for user ${req.user.id}, cash_flow_id: ${cash_flow_id}`);
    
    // Debug: show unique flow_months
    const uniqueMonths = [...new Set(transactions.map(t => t.flow_month).filter(Boolean))];
    console.log(`[Monthly Balance] Unique flow_months found: ${uniqueMonths.length}`, uniqueMonths.sort());

    // Group transactions by month
    const monthlyData = {};
    
    transactions.forEach(transaction => {
      // Use flow_month instead of payment_date for grouping
      const monthKey = transaction.flow_month;
      
      if (!monthKey) {
        console.warn('Transaction without flow_month:', transaction.id);
        return;
      }
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          income: 0,
          expenses: 0,
          balance: 0,
          transactions_count: 0,
          has_transactions: false
        };
      }

      const amount = parseFloat(transaction.amount || 0);
      monthlyData[monthKey].transactions_count++;
      monthlyData[monthKey].has_transactions = true;

      if (amount > 0) {
        monthlyData[monthKey].income += amount;
      } else {
        monthlyData[monthKey].expenses += Math.abs(amount);
      }
    });

    // Calculate balance for each month
    Object.keys(monthlyData).forEach(monthKey => {
      const data = monthlyData[monthKey];
      data.balance = data.income - data.expenses;
    });

    // Convert to array and sort by date
    const monthsArray = Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month));

    console.log(`[Monthly Balance] Returning ${monthsArray.length} months:`, monthsArray.map(m => m.month));

    res.json({
      months: monthsArray,
      total_months: monthsArray.length
    });

  } catch (error) {
    console.error('Monthly balance error:', error);
    res.status(500).json({ error: 'Failed to generate monthly balance data' });
  }
});

module.exports = router;