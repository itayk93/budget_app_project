const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get business-category mappings for management
router.get('/mappings', authenticateToken, async (req, res) => {
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

module.exports = router;