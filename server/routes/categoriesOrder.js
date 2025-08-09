const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get category order
router.get('/', authenticateToken, async (req, res) => {
  // Disable caching completely 
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('ETag', Date.now().toString()); // Force different ETag each time
  try {
    console.log('🚀 CATEGORY ORDER API CALLED - TIME:', new Date().toISOString());
    console.log('Getting category order for user:', req.user.id);
    
    const userId = req.user.id || req.user.user_id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    
    // Get existing category order first
    const { data: existingOrder, error: orderError } = await supabase
      .from('category_order')
      .select('category_name, display_order, shared_category, weekly_display, monthly_target')
      .eq('user_id', userId)
      .order('display_order');

    if (orderError) {
      console.error('Error fetching category order:', orderError);
      throw orderError;
    }

    // Get all distinct category names from transactions for the current user
    const { data: transactions, error: transactionError } = await supabase
      .from('transactions')
      .select('category_name')
      .eq('user_id', userId)
      .not('category_name', 'is', null);

    if (transactionError) {
      console.error('Error fetching transactions:', transactionError);
      throw transactionError;
    }

    const transactionCategories = new Set(
      transactions
        .map(t => t.category_name)
        .filter(name => name && name.trim())
    );

    const existingOrderedCategories = new Set(
      existingOrder.map(item => item.category_name)
    );

    // Add missing categories to category_order (only those that have transactions)
    const categoriesToAdd = [];
    let currentMaxOrder = existingOrder.length > 0 
      ? Math.max(...existingOrder.map(item => item.display_order)) 
      : -1;

    for (const categoryName of transactionCategories) {
      if (!existingOrderedCategories.has(categoryName)) {
        currentMaxOrder++;
        categoriesToAdd.push({
          user_id: userId,
          category_name: categoryName,
          display_order: currentMaxOrder,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    if (categoriesToAdd.length > 0) {
      const { error: insertError } = await supabase
        .from('category_order')
        .insert(categoriesToAdd);

      if (insertError) {
        console.error('Error inserting new categories:', insertError);
        throw insertError;
      }
    }

    // Get updated category order (this time we get ALL categories in category_order)
    const { data: updatedOrder, error: updatedError } = await supabase
      .from('category_order')
      .select('category_name, display_order, shared_category, weekly_display, monthly_target')
      .eq('user_id', userId)
      .order('display_order');

    if (updatedError) {
      console.error('Error fetching updated category order:', updatedError);
      throw updatedError;
    }

    // Count transactions per category for ALL categories in category_order
    const categoryCounts = {};
    for (const orderItem of updatedOrder) {
      const { count, error: countError } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('category_name', orderItem.category_name);

      if (countError) {
        console.error('Error counting transactions:', countError);
        categoryCounts[orderItem.category_name] = 0;
      } else {
        categoryCounts[orderItem.category_name] = count || 0;
      }
    }

    // Get distinct shared categories
    const sharedCategories = new Set();
    updatedOrder.forEach(item => {
      if (item.shared_category) {
        sharedCategories.add(item.shared_category);
      }
    });

    // Prepare final response
    const categories = updatedOrder.map((item, index) => ({
      category_name: item.category_name,
      display_order: item.display_order,
      transaction_count: categoryCounts[item.category_name] || 0,
      shared_category: item.shared_category,
      weekly_display: item.weekly_display || false,
      monthly_target: item.monthly_target || null
    }));

    const response = {
      categories,
      sharedCategories: Array.from(sharedCategories).sort()
    };
    
    console.log('📊 CATEGORIES ORDER API RESPONSE:');
    console.log('Total categories found:', response.categories.length);
    console.log('Shared categories found:', response.sharedCategories.length);
    console.log('Categories:', response.categories.map(c => c.category_name));
    console.log('Shared categories:', response.sharedCategories);
    console.log('Sending response:', JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error('Get category order error:', error);
    res.status(500).json({ error: 'Failed to fetch category order' });
  }
});

// Reorder categories
router.post('/reorder', authenticateToken, async (req, res) => {
  try {
    const { categories } = req.body;
    
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({ error: 'Categories array is required' });
    }

    console.log('Reordering categories for user:', req.user.id);
    console.log('Categories:', categories);

    // First, delete all existing category order records for this user
    const { error: deleteError } = await supabase
      .from('category_order')
      .delete()
      .eq('user_id', req.user.id);

    if (deleteError) {
      console.error('Error deleting existing category order:', deleteError);
      throw deleteError;
    }

    // Then, insert new category order records
    const categoryOrderRecords = categories.map((category, index) => ({
      user_id: req.user.id,
      category_name: category.category_name,
      display_order: index,
      shared_category: category.shared_category || null,
      use_shared_target: category.shared_category ? true : false,
      weekly_display: category.weekly_display || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('category_order')
      .insert(categoryOrderRecords);

    if (insertError) {
      console.error('Error inserting new category order:', insertError);
      throw insertError;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
});

// Update shared category
router.post('/update-shared-category', authenticateToken, async (req, res) => {
  try {
    console.log('Received request body:', JSON.stringify(req.body, null, 2));
    const { category_name, shared_category } = req.body;
    
    if (!category_name) {
      console.log('ERROR: Category name is missing!');
      return res.status(400).json({ error: 'Category name is required' });
    }

    console.log('Updating shared category for user:', req.user.id);
    console.log('Category:', category_name, 'Shared category:', shared_category);

    const { data, error, count } = await supabase
      .from('category_order')
      .update({
        shared_category: shared_category || null,
        use_shared_target: shared_category ? true : false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.user.id)
      .eq('category_name', category_name)
      .select();

    console.log('Update result:', { data, error, count });
    console.log('Updated rows:', data?.length || 0);

    if (error) {
      console.error('Error updating shared category:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.error('No rows were updated! Check if category exists for this user.');
      return res.status(404).json({ error: 'Category not found for this user' });
    }

    res.json({ success: true, updated: data });
  } catch (error) {
    console.error('Update shared category error:', error);
    res.status(500).json({ error: 'Failed to update shared category' });
  }
});

module.exports = router;