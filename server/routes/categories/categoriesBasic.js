const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const { supabase } = require('../../config/supabase');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== BASIC CATEGORY CRUD OPERATIONS =====

// Get all categories
router.get('/', authenticateToken, async (req, res) => {
  try {
    const categories = await SupabaseService.getCategories(req.user.id);
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get categories by type
router.get('/type/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const allCategories = await SupabaseService.getCategories(req.user.id);
    const categories = allCategories.filter(cat => cat.category_type === type);
    res.json(categories);
  } catch (error) {
    console.error('Get categories by type error:', error);
    res.status(500).json({ error: 'Failed to fetch categories by type' });
  }
});

// Get default categories
router.get('/default', authenticateToken, async (req, res) => {
  try {
    const allCategories = await SupabaseService.getCategories(req.user.id);
    const categories = allCategories.filter(cat => cat.is_default === true);
    res.json(categories);
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

    const { data: category, error } = await supabase
      .from('category')
      .insert([{
        name,
        category_type: categoryType,
        color: color || '#5D7AFD',
        icon: icon || null,
        is_default: false,
        user_id: req.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(category);
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

    const { data: category, error } = await supabase
      .from('category')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Category not found' });
      }
      throw error;
    }

    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has transactions
    const { data: transactions, error: transactionError } = await supabase
      .from('transactions')
      .select('id')
      .eq('category_id', id)
      .eq('user_id', req.user.id)
      .limit(1);

    if (transactionError) throw transactionError;

    if (transactions && transactions.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with existing transactions' 
      });
    }

    const { error } = await supabase
      .from('category')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Category deleted successfully' });
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

    const result = await SupabaseService.getTransactions(
      req.user.id, 
      filters,
      1,
      1000 // Large limit for category transactions
    );

    // Get category details
    const category = await SupabaseService.getCategoryById(id);
    
    if (!category || category.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      category: category,
      transactions: result.transactions,
      total_count: result.totalCount,
      total_amount: result.transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
    });

  } catch (error) {
    console.error('Get category transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch category transactions' });
  }
});

module.exports = router;