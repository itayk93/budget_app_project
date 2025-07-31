const express = require('express');
const SupabaseService = require('../services/supabaseService');
const { supabase } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

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
      category_id: id,
      year: parseInt(year),
      month: parseInt(month),
      show_all: true
    };
    
    if (cashFlowId) {
      filters.cash_flow_id = cashFlowId;
    }

    const { transactions } = await SupabaseService.getTransactions(req.user.id, filters);
    res.json(transactions);
  } catch (error) {
    console.error('Get category transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch category transactions' });
  }
});

// Get category order
router.get('/order', authenticateToken, async (req, res) => {
  try {
    console.log('Getting category order for user:', req.user.id);
    
    const userId = req.user.id || req.user.user_id;
    if (!userId) {
      throw new Error('User ID not found in request');
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

    // Get existing category order
    const { data: existingOrder, error: orderError } = await supabase
      .from('category_order')
      .select('category_name, display_order, shared_category')
      .eq('user_id', userId)
      .order('display_order');

    if (orderError) {
      console.error('Error fetching category order:', orderError);
      throw orderError;
    }

    const existingOrderedCategories = new Set(
      existingOrder.map(item => item.category_name)
    );

    // Add missing categories to category_order
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

    // Get updated category order
    const { data: updatedOrder, error: updatedError } = await supabase
      .from('category_order')
      .select('category_name, display_order, shared_category, weekly_display, monthly_target')
      .eq('user_id', userId)
      .order('display_order');

    if (updatedError) {
      console.error('Error fetching updated category order:', updatedError);
      throw updatedError;
    }

    // Count transactions per category
    const categoryCounts = {};
    for (const categoryName of transactionCategories) {
      const { count, error: countError } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('category_name', categoryName);

      if (countError) {
        console.error('Error counting transactions:', countError);
        categoryCounts[categoryName] = 0;
      } else {
        categoryCounts[categoryName] = count || 0;
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

// Get business-category mappings for management
router.get('/business-mappings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { cash_flow_id } = req.query;
    console.log('Getting business-category mappings for user:', userId, 'cash flow:', cash_flow_id);

    // Build query - get all unique business-category-country combinations for this user
    let query = supabase
      .from('transactions')
      .select('business_name, category_name, business_country, cash_flow_id, user_id')
      .eq('user_id', userId)
      .not('business_name', 'is', null)
      .not('category_name', 'is', null);

    // Add cash flow filter if provided
    if (cash_flow_id) {
      query = query.eq('cash_flow_id', cash_flow_id);
    }

    const { data: businessMappings, error } = await query.order('business_name');

    if (error) {
      console.error('Error fetching business mappings:', error);
      throw error;
    }

    // Remove duplicates and create unique business-category-country-cashflow combinations
    const uniqueMappings = [];
    const seen = new Set();

    businessMappings.forEach(mapping => {
      const key = `${mapping.business_name}|${mapping.category_name}|${mapping.business_country || ''}|${mapping.cash_flow_id || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMappings.push({
          business_name: mapping.business_name,
          category_name: mapping.category_name,
          business_country: mapping.business_country || null,
          cash_flow_id: mapping.cash_flow_id
        });
      }
    });

    console.log(`Found ${uniqueMappings.length} unique business-category mappings`);
    res.json({
      success: true,
      mappings: uniqueMappings
    });

  } catch (error) {
    console.error('Error getting business mappings:', error);
    res.status(500).json({ error: 'Failed to get business mappings' });
  }
});

// Import categories from CSV
router.post('/import-mappings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { csvData, cash_flow_id } = req.body;

    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({ 
        success: false, 
        message: 'No CSV data provided' 
      });
    }

    console.log('Starting import process for user:', userId);
    console.log('CSV data rows:', csvData.length);

    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const row of csvData) {
      try {
        const businessName = row['שם עסק']?.trim();
        const newCategory = row['קטגוריה']?.trim();
        const businessCountry = row['מדינה']?.trim() || null;
        const rowCashFlowId = row['תזרים']?.trim();

        if (!businessName || !newCategory) {
          console.warn(`Missing required fields: business=${businessName}, category=${newCategory}`);
          errorCount++;
          errors.push(`Missing data for business: ${businessName || 'Unknown'}`);
          continue;
        }

        // Build update data
        const updateData = {
          category_name: newCategory,
          updated_at: new Date().toISOString()
        };

        // Add business_country if provided
        if (businessCountry !== undefined) {
          updateData.business_country = businessCountry;
        }

        // Try exact match first
        let updateQuery = supabase
          .from('transactions')
          .update(updateData)
          .eq('user_id', userId)
          .eq('business_name', businessName);

        // Add cash flow filter - use the cash_flow_id from request, or from row if provided
        const targetCashFlowId = cash_flow_id || rowCashFlowId;
        if (targetCashFlowId) {
          updateQuery = updateQuery.eq('cash_flow_id', targetCashFlowId);
        }

        let { data: updatedTransactions, error: updateError } = await updateQuery.select('id');

        // If no exact match, try with trimmed business names (fallback strategy)
        if (!updateError && (!updatedTransactions || updatedTransactions.length === 0)) {
          console.log(`No exact match for '${businessName}', trying with trimmed matching...`);
          
          // Get all transactions for this user and cash flow
          let allTransactionsQuery = supabase
            .from('transactions')
            .select('id, business_name')
            .eq('user_id', userId);

          if (targetCashFlowId) {
            allTransactionsQuery = allTransactionsQuery.eq('cash_flow_id', targetCashFlowId);
          }

          const { data: allTransactions, error: allTransactionsError } = await allTransactionsQuery;

          if (!allTransactionsError && allTransactions) {
            // Find transactions where trimmed business names match
            const matchingTransactionIds = allTransactions
              .filter(t => t.business_name && t.business_name.trim() === businessName.trim())
              .map(t => t.id);

            if (matchingTransactionIds.length > 0) {
              console.log(`Found ${matchingTransactionIds.length} transactions after trimming for '${businessName}'`);
              
              // Update the matching transactions by ID
              const { data: trimmedUpdatedTransactions, error: trimmedUpdateError } = await supabase
                .from('transactions')
                .update(updateData)
                .in('id', matchingTransactionIds)
                .select('id');

              updatedTransactions = trimmedUpdatedTransactions;
              updateError = trimmedUpdateError;
            }
          }
        }

        if (updateError) {
          console.error(`Error updating transactions for ${businessName}:`, updateError);
          errorCount++;
          errors.push(`Failed to update ${businessName}: ${updateError.message}`);
          continue;
        }

        if (updatedTransactions && updatedTransactions.length > 0) {
          updatedCount += updatedTransactions.length;
          console.log(`Updated ${updatedTransactions.length} transactions for business: ${businessName} -> ${newCategory}`);
        } else {
          console.warn(`No transactions found for business: ${businessName}`);
        }

      } catch (rowError) {
        console.error('Error processing row:', rowError);
        errorCount++;
        errors.push(`Error processing row: ${rowError.message}`);
      }
    }

    const flowText = cash_flow_id ? ' בתזרים הנבחר' : '';
    const message = `עודכנו ${updatedCount} עסקאות${flowText}. ${errorCount > 0 ? `${errorCount} שגיאות.` : ''}`;
    
    res.json({
      success: true,
      message,
      updated_count: updatedCount,
      error_count: errorCount,
      errors: errors.slice(0, 10) // Return first 10 errors only
    });

  } catch (error) {
    console.error('Error in import mappings:', error);
    res.status(500).json({
      success: false,
      message: `שגיאה בעדכון הקטגוריות: ${error.message}`
    });
  }
});

// Update weekly display setting
router.post('/update-weekly-display', authenticateToken, async (req, res) => {
  try {
    console.log('Received weekly display request body:', JSON.stringify(req.body, null, 2));
    const { category_name, weekly_display } = req.body;
    
    if (!category_name) {
      console.log('ERROR: Category name is missing!');
      return res.status(400).json({ error: 'Category name is required' });
    }

    if (typeof weekly_display !== 'boolean') {
      console.log('ERROR: Weekly display must be a boolean!');
      return res.status(400).json({ error: 'Weekly display must be a boolean' });
    }

    console.log('Updating weekly display for user:', req.user.id);
    console.log('Category:', category_name, 'Weekly display:', weekly_display);

    const { data, error, count } = await supabase
      .from('category_order')
      .update({
        weekly_display: weekly_display,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.user.id)
      .eq('category_name', category_name)
      .select();

    console.log('Update result:', { data, error, count });
    console.log('Updated rows:', data?.length || 0);

    if (error) {
      console.error('Error updating weekly display:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.error('No rows were updated! Check if category exists for this user.');
      return res.status(404).json({ error: 'Category not found for this user' });
    }

    res.json({ success: true, updated: data });
  } catch (error) {
    console.error('Update weekly display error:', error);
    res.status(500).json({ error: 'Failed to update weekly display' });
  }
});

// Calculate and update monthly target based on historical average
router.post('/calculate-monthly-target', authenticateToken, async (req, res) => {
  try {
    const { category_name, months = 3 } = req.body;
    
    if (!category_name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    const userId = req.user.id;
    const average = await SupabaseService.calculateMonthlyAverage(userId, category_name, months);
    const updatedCategory = await SupabaseService.updateCategoryMonthlyTarget(userId, category_name, average);
    
    res.json({
      success: true,
      monthly_target: average,
      category: updatedCategory
    });
  } catch (error) {
    console.error('Calculate monthly target error:', error);
    res.status(500).json({ error: 'Failed to calculate monthly target' });
  }
});

// Update monthly target manually
router.post('/update-monthly-target', authenticateToken, async (req, res) => {
  try {
    const { category_name, monthly_target } = req.body;
    
    if (!category_name || monthly_target === undefined) {
      return res.status(400).json({ error: 'Category name and monthly target are required' });
    }
    
    const userId = req.user.id;
    const updatedCategory = await SupabaseService.updateCategoryMonthlyTarget(userId, category_name, monthly_target);
    
    res.json({
      success: true,
      category: updatedCategory
    });
  } catch (error) {
    console.error('Update monthly target error:', error);
    res.status(500).json({ error: 'Failed to update monthly target' });
  }
});

// Get category spending data for current month
router.get('/monthly-spending/:categoryName', authenticateToken, async (req, res) => {
  try {
    const { categoryName } = req.params;
    const userId = req.user.id;
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const currentSpending = await SupabaseService.getCategoryMonthlySpending(
      userId, 
      categoryName, 
      currentYear, 
      currentMonth
    );
    
    res.json({
      success: true,
      current_spending: currentSpending,
      month: currentMonth,
      year: currentYear
    });
  } catch (error) {
    console.error('Get monthly spending error:', error);
    res.status(500).json({ error: 'Failed to get monthly spending' });
  }
});

// Get category spending history for histogram
router.get('/spending-history/:categoryName', authenticateToken, async (req, res) => {
  try {
    const { categoryName } = req.params;
    const { months = 12 } = req.query;
    const userId = req.user.id;
    
    const spendingHistory = await SupabaseService.getCategorySpendingHistory(
      userId, 
      categoryName, 
      parseInt(months)
    );
    
    res.json({
      success: true,
      spending_history: spendingHistory
    });
  } catch (error) {
    console.error('Get spending history error:', error);
    res.status(500).json({ error: 'Failed to get spending history' });
  }
});

// Check if monthly targets should be refreshed for new month
router.get('/should-refresh-targets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const shouldRefresh = await SupabaseService.shouldRefreshMonthlyTargets(userId);
    
    res.json({
      success: true,
      should_refresh: shouldRefresh
    });
  } catch (error) {
    console.error('Check should refresh targets error:', error);
    res.status(500).json({ error: 'Failed to check refresh status' });
  }
});

// Refresh monthly targets for new month
router.post('/refresh-monthly-targets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { force = false } = req.body;
    const result = await SupabaseService.refreshMonthlyTargetsForNewMonth(userId, force);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Refresh monthly targets error:', error);
    res.status(500).json({ error: 'Failed to refresh monthly targets' });
  }
});

// ===== SHARED CATEGORY TARGETS ENDPOINTS =====

// Get shared category target
router.get('/shared-target/:sharedCategoryName', authenticateToken, async (req, res) => {
  try {
    const { sharedCategoryName } = req.params;
    const userId = req.user.id;
    
    const target = await SupabaseService.getSharedCategoryTarget(userId, sharedCategoryName);
    
    res.json({
      success: true,
      target: target
    });
  } catch (error) {
    console.error('Get shared category target error:', error);
    res.status(500).json({ error: 'Failed to get shared category target' });
  }
});

// Update shared category target
router.post('/update-shared-target', authenticateToken, async (req, res) => {
  try {
    const { shared_category_name, monthly_target, weekly_display } = req.body;
    const userId = req.user.id;

    if (!shared_category_name || monthly_target === undefined) {
      return res.status(400).json({ error: 'Shared category name and monthly target are required' });
    }

    const updatedTarget = await SupabaseService.updateSharedCategoryTarget(
      userId, 
      shared_category_name, 
      monthly_target, 
      weekly_display
    );

    res.json({
      success: true,
      target: updatedTarget
    });
  } catch (error) {
    console.error('Update shared category target error:', error);
    res.status(500).json({ error: 'Failed to update shared category target' });
  }
});

// Get shared category spending data for current month
router.get('/shared-spending/:sharedCategoryName', authenticateToken, async (req, res) => {
  try {
    const { sharedCategoryName } = req.params;
    const userId = req.user.id;
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const currentSpending = await SupabaseService.getSharedCategoryMonthlySpending(
      userId, 
      sharedCategoryName, 
      currentYear, 
      currentMonth
    );
    
    res.json({
      success: true,
      currentSpending: currentSpending
    });
  } catch (error) {
    console.error('Get shared category spending error:', error);
    res.status(500).json({ error: 'Failed to get shared category spending' });
  }
});

// Set category to use shared target
router.post('/set-use-shared-target', authenticateToken, async (req, res) => {
  try {
    const { category_name, use_shared_target } = req.body;
    const userId = req.user.id;

    if (!category_name || use_shared_target === undefined) {
      return res.status(400).json({ error: 'Category name and use_shared_target are required' });
    }

    const updatedCategory = await SupabaseService.setUseSharedTarget(
      userId, 
      category_name, 
      use_shared_target
    );

    res.json({
      success: true,
      category: updatedCategory
    });
  } catch (error) {
    console.error('Set use shared target error:', error);
    res.status(500).json({ error: 'Failed to set use shared target' });
  }
});

// Calculate and update shared category targets
router.post('/calculate-shared-targets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { force = false } = req.body;
    
    const result = await SupabaseService.calculateAndUpdateSharedCategoryTargets(userId, force);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Calculate shared category targets error:', error);
    res.status(500).json({ error: 'Failed to calculate shared category targets' });
  }
});

// TEMP: Initialize shared targets manually
router.post('/init-shared-targets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Create shared target for income manually
    const result = await SupabaseService.calculateAndUpdateSharedCategoryTargets(userId, true);
    
    res.json({
      success: true,
      message: 'Shared targets initialized',
      ...result
    });
  } catch (error) {
    console.error('Initialize shared targets error:', error);
    res.status(500).json({ error: 'Failed to initialize shared targets' });
  }
});

module.exports = router;