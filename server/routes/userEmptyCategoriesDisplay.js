const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// Get user's selected empty categories for display
router.get('/', async (req, res) => {
  try {
    const { year, month, cash_flow_id } = req.query;
    const userId = req.user.id;

    console.log('🔍 [USER EMPTY CATEGORIES] GET request:', { userId, year, month, cash_flow_id });

    if (!year || !month || !cash_flow_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters: year, month, cash_flow_id' 
      });
    }

    // First check if table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_empty_categories_display')
      .select('*')
      .limit(1);

    console.log('🔍 [USER EMPTY CATEGORIES] Table check data:', tableCheck);
    console.log('🔍 [USER EMPTY CATEGORIES] Table check error:', tableError);

    if (tableError) {
      console.error('🚨 [USER EMPTY CATEGORIES] Table does not exist or no access:', tableError);
      return res.status(500).json({ 
        success: false, 
        message: 'Table user_empty_categories_display does not exist', 
        error: tableError.message 
      });
    }

    const { data, error } = await supabase
      .from('user_empty_categories_display')
      .select('category_name')
      .eq('user_id', userId)
      .eq('cash_flow_id', cash_flow_id)
      .eq('year', parseInt(year))
      .eq('month', parseInt(month));

    console.log('🔍 [USER EMPTY CATEGORIES] Query filters:', {
      user_id: userId,
      cash_flow_id: cash_flow_id,
      year: parseInt(year),
      month: parseInt(month)
    });

    if (error) {
      console.error('🚨 [USER EMPTY CATEGORIES] Database error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Database error', 
        error: error.message 
      });
    }

    const categories = data.map(row => row.category_name);
    console.log('✅ [USER EMPTY CATEGORIES] Retrieved categories:', categories);
    console.log('✅ [USER EMPTY CATEGORIES] Raw data:', data);

    res.json({
      success: true,
      categories,
      period: { year: parseInt(year), month: parseInt(month) },
      cash_flow_id
    });

  } catch (error) {
    console.error('🚨 [USER EMPTY CATEGORIES] Unexpected error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
});

// Add categories to user's display selection
router.post('/add', async (req, res) => {
  try {
    const { categories, year, month, cash_flow_id } = req.body;
    const userId = req.user.id;

    console.log('🔍 [USER EMPTY CATEGORIES] POST add request:', { userId, categories, year, month, cash_flow_id });

    if (!categories || !Array.isArray(categories) || !year || !month || !cash_flow_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters: categories (array), year, month, cash_flow_id' 
      });
    }

    // Prepare data for insertion
    const insertData = categories.map(categoryName => ({
      user_id: userId,
      cash_flow_id,
      category_name: categoryName,
      year: parseInt(year),
      month: parseInt(month)
    }));

    console.log('🔍 [USER EMPTY CATEGORIES] Preparing to insert:', insertData);

    // Insert with upsert (ignore conflicts)
    const { data, error } = await supabase
      .from('user_empty_categories_display')
      .upsert(insertData, { 
        onConflict: 'user_id,cash_flow_id,category_name,year,month',
        ignoreDuplicates: true 
      })
      .select();

    console.log('🔍 [USER EMPTY CATEGORIES] Insert result data:', data);
    console.log('🔍 [USER EMPTY CATEGORIES] Insert result error:', error);

    if (error) {
      console.error('🚨 [USER EMPTY CATEGORIES] Insert error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Database error', 
        error: error.message 
      });
    }

    console.log('✅ [USER EMPTY CATEGORIES] Categories added:', data?.length || 0);

    res.json({
      success: true,
      message: `Added ${categories.length} categories to display`,
      categories,
      inserted: data?.length || 0
    });

  } catch (error) {
    console.error('🚨 [USER EMPTY CATEGORIES] Unexpected error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
});

// Remove categories from user's display selection
router.post('/remove', async (req, res) => {
  try {
    const { categories, year, month, cash_flow_id } = req.body;
    const userId = req.user.id;

    console.log('🔍 [USER EMPTY CATEGORIES] POST remove request:', { userId, categories, year, month, cash_flow_id });

    if (!categories || !Array.isArray(categories) || !year || !month || !cash_flow_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters: categories (array), year, month, cash_flow_id' 
      });
    }

    const { data, error } = await supabase
      .from('user_empty_categories_display')
      .delete()
      .eq('user_id', userId)
      .eq('cash_flow_id', cash_flow_id)
      .eq('year', parseInt(year))
      .eq('month', parseInt(month))
      .in('category_name', categories)
      .select();

    if (error) {
      console.error('🚨 [USER EMPTY CATEGORIES] Delete error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Database error', 
        error: error.message 
      });
    }

    console.log('✅ [USER EMPTY CATEGORIES] Categories removed:', data?.length || 0);

    res.json({
      success: true,
      message: `Removed ${categories.length} categories from display`,
      categories,
      removed: data?.length || 0
    });

  } catch (error) {
    console.error('🚨 [USER EMPTY CATEGORIES] Unexpected error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
});

// Clear all empty categories for a specific period
router.delete('/', async (req, res) => {
  try {
    const { year, month, cash_flow_id } = req.query;
    const userId = req.user.id;

    console.log('🔍 [USER EMPTY CATEGORIES] DELETE request:', { userId, year, month, cash_flow_id });

    if (!year || !month || !cash_flow_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters: year, month, cash_flow_id' 
      });
    }

    const { data, error } = await supabase
      .from('user_empty_categories_display')
      .delete()
      .eq('user_id', userId)
      .eq('cash_flow_id', cash_flow_id)
      .eq('year', parseInt(year))
      .eq('month', parseInt(month))
      .select();

    if (error) {
      console.error('🚨 [USER EMPTY CATEGORIES] Clear error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Database error', 
        error: error.message 
      });
    }

    console.log('✅ [USER EMPTY CATEGORIES] All categories cleared:', data?.length || 0);

    res.json({
      success: true,
      message: 'All empty categories cleared from display',
      removed: data?.length || 0
    });

  } catch (error) {
    console.error('🚨 [USER EMPTY CATEGORIES] Unexpected error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
});

module.exports = router;