const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const { supabase } = require('../../config/supabase');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== SHARED CATEGORY TARGETS MANAGEMENT =====

// Get shared category target
router.get('/shared-target/:sharedCategoryName', authenticateToken, async (req, res) => {
  try {
    const { sharedCategoryName } = req.params;
    
    // Get shared target from database
    const { data, error } = await supabase
      .from('shared_category_targets')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('shared_category_name', sharedCategoryName)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({
      success: true,
      shared_category_name: sharedCategoryName,
      target: data ? data.monthly_target : null,
      created_at: data ? data.created_at : null,
      updated_at: data ? data.updated_at : null
    });
  } catch (error) {
    console.error('Get shared target error:', error);
    res.status(500).json({ error: 'Failed to get shared target' });
  }
});

// Update shared category target
router.post('/update-shared-target', authenticateToken, async (req, res) => {
  try {
    const { sharedCategoryName, target } = req.body;
    
    if (!sharedCategoryName || typeof target !== 'number') {
      return res.status(400).json({ error: 'sharedCategoryName and target are required' });
    }

    const { data, error } = await supabase
      .from('shared_category_targets')
      .upsert({
        user_id: req.user.id,
        shared_category_name: sharedCategoryName,
        monthly_target: target,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Shared target updated successfully',
      target: data
    });
  } catch (error) {
    console.error('Update shared target error:', error);
    res.status(500).json({ error: 'Failed to update shared target' });
  }
});

// Get shared category spending
router.get('/shared-spending/:sharedCategoryName', authenticateToken, async (req, res) => {
  try {
    const { sharedCategoryName } = req.params;
    
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    // Get all categories that belong to this shared category
    const { data: categories, error: categoryError } = await supabase
      .from('category_order')
      .select('category_name')
      .eq('user_id', req.user.id)
      .eq('shared_category', sharedCategoryName);

    if (categoryError) throw categoryError;

    if (!categories || categories.length === 0) {
      return res.json({
        success: true,
        shared_category_name: sharedCategoryName,
        total_spending: 0,
        transaction_count: 0,
        categories: []
      });
    }

    const categoryNames = categories.map(c => c.category_name);
    
    // Get transactions for all categories in this shared category
    const { transactions } = await SupabaseService.getTransactions(req.user.id, {
      year,
      month,
      show_all: true
    });

    const sharedCategoryTransactions = transactions.filter(t => 
      categoryNames.includes(t.category_name)
    );

    const totalSpending = sharedCategoryTransactions.reduce((sum, t) => 
      sum + Math.abs(parseFloat(t.amount || 0)), 0
    );

    res.json({
      success: true,
      shared_category_name: sharedCategoryName,
      current_month: `${year}-${String(month).padStart(2, '0')}`,
      total_spending: totalSpending,
      transaction_count: sharedCategoryTransactions.length,
      categories: categoryNames
    });
  } catch (error) {
    console.error('Get shared spending error:', error);
    res.status(500).json({ error: 'Failed to get shared spending' });
  }
});

// Set category to use shared target
router.post('/set-use-shared-target', authenticateToken, async (req, res) => {
  try {
    const { categoryName, useSharedTarget, sharedCategoryName } = req.body;
    
    if (!categoryName || typeof useSharedTarget !== 'boolean') {
      return res.status(400).json({ error: 'categoryName and useSharedTarget are required' });
    }

    const updateData = {
      use_shared_target: useSharedTarget,
      updated_at: new Date().toISOString()
    };

    if (useSharedTarget && sharedCategoryName) {
      updateData.shared_category = sharedCategoryName;
    } else if (!useSharedTarget) {
      updateData.shared_category = null;
    }

    const { data, error } = await supabase
      .from('category_order')
      .update(updateData)
      .eq('user_id', req.user.id)
      .eq('category_name', categoryName)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Shared target setting updated successfully',
      category: data
    });
  } catch (error) {
    console.error('Set use shared target error:', error);
    res.status(500).json({ error: 'Failed to update shared target setting' });
  }
});

module.exports = router;