const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const CategoryService = require('../../services/supabase-modules/CategoryService');
const TransactionService = require('../../services/supabase-modules/TransactionService');
const { createUserClient } = require('../../config/supabase');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== BASIC CATEGORY CRUD OPERATIONS =====

// Get all categories
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [CATEGORIES ROUTE] User ID:', req.user.id);
    const userClient = createUserClient(req.user.token);
    const result = await CategoryService.getCategories(req.user.id, userClient);
    console.log('🔍 [CATEGORIES ROUTE] Service result:', result);
    console.log('🔍 [CATEGORIES ROUTE] Categories count:', result.data?.length || 0);
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error || 'Failed to fetch categories' });
    }
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get categories by type
router.get('/type/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const userClient = createUserClient(req.user.token);
    const result = await CategoryService.getCategoriesByType(req.user.id, type, userClient);
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error || 'Failed to fetch categories by type' });
    }
  } catch (error) {
    console.error('Get categories by type error:', error);
    res.status(500).json({ error: 'Failed to fetch categories by type' });
  }
});

// Get default categories
router.get('/default', authenticateToken, async (req, res) => {
  try {
    const userClient = createUserClient(req.user.token);
    const result = await CategoryService.getCategories(req.user.id, userClient);
    if (result.success) {
      const categories = result.data.filter(cat => cat.is_default === true);
      res.json(categories);
    } else {
      res.status(500).json({ error: result.error || 'Failed to fetch default categories' });
    }
  } catch (error) {
    console.error('Get default categories error:', error);
    res.status(500).json({ error: 'Failed to fetch default categories' });
  }
});

// Create new category
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, categoryType, color, icon } = req.body;

    if (!name || !categoryType) {
      return res.status(400).json({ error: 'Name and category type are required' });
    }

    const userClient = createUserClient(req.user.token);
    const categoryData = {
      name,
      category_type: categoryType,
      color: color || '#5D7AFD',
      icon: icon || null,
      is_default: false
    };
    
    const result = await CategoryService.createCategory(req.user.id, categoryData, userClient);
    if (result.success) {
      res.status(201).json(result.data);
    } else {
      res.status(500).json({ error: result.error || 'Failed to create category' });
    }
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, categoryType, color, icon } = req.body;

    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (name) updateData.name = name;
    if (categoryType) updateData.category_type = categoryType;
    if (color) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;

    const userClient = createUserClient(req.user.token);
    const result = await CategoryService.updateCategory(req.user.id, id, updateData, userClient);
    
    if (result.success) {
      res.json(result.data);
    } else {
      if (result.error && result.error.includes('not found')) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.status(500).json({ error: result.error || 'Failed to update category' });
    }
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const userClient = createUserClient(req.user.token);
    
    // Check if category has transactions using TransactionService
    const transactionsResult = await TransactionService.getTransactions(
      req.user.id,
      { category_id: id },
      1,
      1,
      userClient
    );
    
    if (transactionsResult.success && transactionsResult.data.transactions.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with existing transactions' 
      });
    }

    const result = await CategoryService.deleteCategory(req.user.id, id, userClient);
    
    if (result.success) {
      res.json({ message: 'Category deleted successfully' });
    } else {
      res.status(500).json({ error: result.error || 'Failed to delete category' });
    }
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Get category with transactions
router.get('/:id/transactions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { year, month, cashFlowId } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const filters = {
      year: parseInt(year),
      month: parseInt(month),
      category_id: id
    };

    if (cashFlowId) {
      filters.cash_flow_id = cashFlowId;
    }

    const userClient = createUserClient(req.user.token);
    const result = await TransactionService.getTransactions(
      req.user.id, 
      filters,
      1,
      1000, // Large limit for category transactions
      userClient
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to fetch transactions' });
    }

    // For category details, we'll extract from transactions or make a separate call if needed
    // Since RLS is enabled, we rely on the userClient for data access
    const transactions = result.data.transactions || [];
    const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    res.json({
      category: { id: id }, // Basic category info
      transactions: transactions,
      total_count: result.data.totalCount,
      total_amount: totalAmount
    });

  } catch (error) {
    console.error('Get category transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch category transactions' });
  }
});

// Get empty categories (categories with no transactions in given period)
router.get('/empty', authenticateToken, async (req, res) => {
  try {
    const { year, month, cash_flow } = req.query;
    const userId = req.user.id;
    
    console.log('🔍 [EMPTY API] Request received:', { year, month, cash_flow, userId });

    if (!year || !month || !cash_flow) {
      console.log('❌ [EMPTY API] Missing parameters');
      return res.status(400).json({ 
        error: 'Missing required parameters: year, month, cash_flow' 
      });
    }

    // Get all categories for the user
    const { supabase } = require('../../config/supabase');
    const { data: allCategories, error: categoriesError } = await supabase
      .from('category_order')
      .select('*')
      .eq('user_id', userId)
      .order('display_order', { ascending: true });

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }

    // Get categories that have transactions in the given period
    const flowMonth = `${year}-${month.toString().padStart(2, '0')}`;
    const { data: categoriesWithTransactions, error: transactionError } = await supabase
      .from('transactions')
      .select('category_name')
      .eq('user_id', userId)
      .eq('cash_flow_id', cash_flow)
      .eq('flow_month', flowMonth)
      .eq('excluded_from_flow', false);

    if (transactionError) {
      console.error('Error fetching transactions:', transactionError);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }

    // Create set of categories with transactions
    const categoriesWithData = new Set(
      categoriesWithTransactions.map(t => t.category_name)
    );

    // Filter categories that don't have transactions
    const emptyCategories = allCategories
      .filter(category => !categoriesWithData.has(category.category_name))
      .map(category => ({
        name: category.category_name,
        display_order: category.display_order,
        shared_category: category.shared_category,
        weekly_display: category.weekly_display,
        monthly_target: category.monthly_target,
        use_shared_target: category.use_shared_target
      }));

    console.log('🔍 [EMPTY API] Found categories:', emptyCategories.length);
    console.log('🔍 [EMPTY API] Categories list:', emptyCategories.map(c => c.name));

    res.json({ 
      categories: emptyCategories,
      period: { year: parseInt(year), month: parseInt(month) },
      cash_flow_id: cash_flow
    });

  } catch (error) {
    console.error('Get empty categories error:', error);
    res.status(500).json({ error: 'Failed to fetch empty categories' });
  }
});

module.exports = router;