const express = require('express');
const SupabaseService = require('../services/supabaseService');
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get user budgets
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get all monthly budgets for user
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const budgets = await SupabaseService.getMonthlyBudgets(req.user.id, currentYear, currentMonth);
    res.json(budgets);
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// Get monthly budgets
router.get('/monthly/:year/:month', authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.params;
    const monthlyBudgets = await SupabaseService.getMonthlyBudgets(
      req.user.id, 
      parseInt(year), 
      parseInt(month)
    );
    res.json(monthlyBudgets);
  } catch (error) {
    console.error('Get monthly budgets error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly budgets' });
  }
});

// Create or update budget
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { categoryId, amount, year, month } = req.body;

    if (!categoryId || amount === undefined) {
      return res.status(400).json({ error: 'Category ID and amount are required' });
    }

    // Use current year/month if not provided
    const budgetYear = year || new Date().getFullYear();
    const budgetMonth = month || new Date().getMonth() + 1;

    const budgetData = {
      user_id: req.user.id,
      category_id: categoryId,
      year: budgetYear,
      month: budgetMonth,
      amount: amount
    };

    const budget = await SupabaseService.createMonthlyBudget(budgetData);
    res.json(budget);
  } catch (error) {
    console.error('Create/update budget error:', error);
    res.status(500).json({ error: 'Failed to create/update budget' });
  }
});

// Create or update monthly budget
router.post('/monthly', authenticateToken, async (req, res) => {
  try {
    const { categoryId, year, month, amount } = req.body;

    if (!categoryId || !year || !month || amount === undefined) {
      return res.status(400).json({ error: 'Category ID, year, month, and amount are required' });
    }

    const budgetData = {
      user_id: req.user.id,
      category_id: categoryId,
      year: parseInt(year),
      month: parseInt(month),
      amount: parseFloat(amount)
    };

    const budget = await SupabaseService.createMonthlyBudget(budgetData);
    res.json(budget);
  } catch (error) {
    console.error('Create/update monthly budget error:', error);
    res.status(500).json({ error: 'Failed to create/update monthly budget' });
  }
});

// Get budget by category
router.get('/category/:categoryId', authenticateToken, async (req, res) => {
  try {
    const { categoryId } = req.params;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    const budgets = await SupabaseService.getMonthlyBudgets(req.user.id, currentYear, currentMonth);
    const budget = budgets.find(b => b.category_id === categoryId);
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json(budget);
  } catch (error) {
    console.error('Get budget by category error:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

// Get monthly budget by category
router.get('/monthly/:year/:month/:categoryId', authenticateToken, async (req, res) => {
  try {
    const { year, month, categoryId } = req.params;
    const budgets = await SupabaseService.getMonthlyBudgets(
      req.user.id, 
      parseInt(year), 
      parseInt(month)
    );
    
    const monthlyBudget = budgets.find(b => b.category_id === categoryId);

    if (!monthlyBudget) {
      return res.status(404).json({ error: 'Monthly budget not found' });
    }

    res.json(monthlyBudget);
  } catch (error) {
    console.error('Get monthly budget by category error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly budget' });
  }
});

// Delete budget
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use direct Supabase query to delete budget
    const { error } = await supabase
      .from('monthly_budget')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Delete budget error:', error);
      return res.status(500).json({ error: 'Failed to delete budget' });
    }

    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

// Delete monthly budget
router.delete('/monthly/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use direct Supabase query to delete monthly budget
    const { error } = await supabase
      .from('monthly_budget')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Delete monthly budget error:', error);
      return res.status(500).json({ error: 'Failed to delete monthly budget' });
    }

    res.json({ message: 'Monthly budget deleted successfully' });
  } catch (error) {
    console.error('Delete monthly budget error:', error);
    res.status(500).json({ error: 'Failed to delete monthly budget' });
  }
});

// Get average spending for category
router.get('/category/:categoryId/average/:year/:month', authenticateToken, async (req, res) => {
  try {
    const { categoryId, year, month } = req.params;
    
    // Get transactions for the last 3 months to calculate average
    const { transactions } = await SupabaseService.getTransactions(
      req.user.id,
      { 
        category_id: categoryId,
        show_all: true
      }
    );
    
    // Calculate average spending for this category
    const categoryTransactions = transactions.filter(t => t.category_id === categoryId);
    const totalAmount = categoryTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);
    const average = categoryTransactions.length > 0 ? totalAmount / categoryTransactions.length : 0;

    res.json({ average });
  } catch (error) {
    console.error('Get average spending error:', error);
    res.status(500).json({ error: 'Failed to calculate average spending' });
  }
});

module.exports = router;