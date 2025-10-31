const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const { supabase } = require('../../config/supabase');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== CATEGORY ORDER MANAGEMENT =====

// Get category display order
router.get('/order', authenticateToken, async (req, res) => {
  // Disable caching completely 
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('ETag', Date.now().toString()); // Force different ETag each time
  
  try {
    const logger = require('../../utils/logger');
    logger.debug('CATEGORIES ORDER', 'CATEGORY ORDER API CALLED', { time: new Date().toISOString(), userId: req.user.id });
    
    const categories = await SupabaseService.getCategories(req.user.id);
    logger.debug('CATEGORIES ORDER', 'Found categories count', { count: categories.length });
    
    // Return categories without transaction counts to avoid 44 DB queries
    // Transaction counts can be fetched separately if needed
    logger.debug('CATEGORIES ORDER', 'About to send response', { count: categories.length, sample: categories.slice(0, 3).map(c => c.name) });
    
    res.json({
      categories: categories,
      total_count: categories.length
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

// Create new category in category_order
router.post('/order', authenticateToken, async (req, res) => {
  try {
    const { category_name, display_order, shared_category, use_shared_category, icon, weekly_display } = req.body;

    if (!category_name) {
      return res.status(400).json({ error: 'category_name is required' });
    }

    // Check if category already exists for this user
    const { data: existingCategory, error: checkError } = await supabase
      .from('category_order')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('category_name', category_name)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing category:', checkError);
      throw checkError;
    }

    if (existingCategory) {
      return res.status(200).json({ 
        error: 'Category already exists in your category list',
        existing: true,
        data: existingCategory
      });
    }

    // Get the next display_order if not provided
    let finalDisplayOrder = display_order;
    if (!finalDisplayOrder) {
      const { data: lastCategory, error: orderError } = await supabase
        .from('category_order')
        .select('display_order')
        .eq('user_id', req.user.id)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      if (orderError && orderError.code !== 'PGRST116') {
        console.error('Error getting last display order:', orderError);
        throw orderError;
      }

      finalDisplayOrder = (lastCategory?.display_order || 0) + 1;
    }

    // Create the new category in category_order
    const { data, error } = await supabase
      .from('category_order')
      .insert([{
        user_id: req.user.id,
        category_name,
        display_order: finalDisplayOrder,
        shared_category: shared_category || null,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      throw error;
    }

    console.log('✅ [NEW CATEGORY] Category created successfully:', data);
    res.status(201).json(data);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
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

    console.log('🔍 [UPDATE WEEKLY DISPLAY] Updating category:', categoryId, 'to:', showInWeeklyView);

    // Update the category_order table since that's where the data is stored
    const { data: category, error } = await supabase
      .from('category_order')
      .update({ 
        weekly_display: showInWeeklyView,
        updated_at: new Date().toISOString()
      })
      .eq('id', categoryId)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('🔍 [UPDATE WEEKLY DISPLAY] Database error:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Category not found' });
      }
      throw error;
    }

    console.log('🔍 [UPDATE WEEKLY DISPLAY] Successfully updated:', category);

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
