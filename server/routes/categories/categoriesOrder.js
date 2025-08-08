const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const { supabase } = require('../../config/supabase');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== CATEGORY ORDER MANAGEMENT =====

// Get category display order
router.get('/order', authenticateToken, async (req, res) => {
  try {
    const categories = await SupabaseService.getCategories(req.user.id);
    
    // Add transaction counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const { totalCount } = await SupabaseService.getTransactions(
          req.user.id, 
          { category_id: category.id },
          1,
          1
        );
        
        return {
          ...category,
          transaction_count: totalCount
        };
      })
    );

    res.json({
      categories: categoriesWithCounts,
      total_count: categoriesWithCounts.length
    });
  } catch (error) {
    console.error('Get category order error:', error);
    res.status(500).json({ error: 'Failed to fetch category order' });
  }
});

// Reorder categories
router.post('/reorder', authenticateToken, async (req, res) => {
  try {
    const { categoryOrders } = req.body;
    
    if (!categoryOrders || !Array.isArray(categoryOrders)) {
      return res.status(400).json({ error: 'categoryOrders array is required' });
    }

    const updatePromises = categoryOrders.map(({ id, display_order }) => {
      return supabase
        .from('category')
        .update({ 
          display_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', req.user.id);
    });

    await Promise.all(updatePromises);
    
    res.json({ message: 'Categories reordered successfully' });
  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
});

// Update shared category assignment
router.post('/update-shared-category', authenticateToken, async (req, res) => {
  try {
    const { categoryId, sharedCategoryName } = req.body;

    if (!categoryId) {
      return res.status(400).json({ error: 'categoryId is required' });
    }

    const { data: category, error } = await supabase
      .from('category')
      .update({ 
        shared_category: sharedCategoryName || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', categoryId)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Category not found' });
      }
      throw error;
    }

    res.json({
      message: 'Shared category updated successfully',
      category
    });
  } catch (error) {
    console.error('Update shared category error:', error);
    res.status(500).json({ error: 'Failed to update shared category' });
  }
});

// Update weekly display setting
router.post('/update-weekly-display', authenticateToken, async (req, res) => {
  try {
    const { categoryId, showInWeeklyView } = req.body;

    if (!categoryId || typeof showInWeeklyView !== 'boolean') {
      return res.status(400).json({ error: 'categoryId and showInWeeklyView are required' });
    }

    const { data: category, error } = await supabase
      .from('category')
      .update({ 
        show_in_weekly_view: showInWeeklyView,
        updated_at: new Date().toISOString()
      })
      .eq('id', categoryId)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Category not found' });
      }
      throw error;
    }

    res.json({
      message: 'Weekly display setting updated successfully',
      category
    });
  } catch (error) {
    console.error('Update weekly display error:', error);
    res.status(500).json({ error: 'Failed to update weekly display setting' });
  }
});

module.exports = router;