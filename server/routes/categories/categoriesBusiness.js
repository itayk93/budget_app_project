const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const { supabase } = require('../../config/supabase');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== BUSINESS-CATEGORY MAPPING MANAGEMENT =====

// Get business-category mappings
router.get('/business-mappings', authenticateToken, async (req, res) => {
  try {
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { show_all: true });
    
    // Group by business name
    const businessMappings = new Map();
    
    transactions.forEach(transaction => {
      const businessName = transaction.business_name;
      const categoryName = transaction.category_name;
      
      if (businessName && categoryName) {
        if (!businessMappings.has(businessName)) {
          businessMappings.set(businessName, {
            business_name: businessName,
            categories: new Set(),
            transaction_count: 0,
            latest_category: categoryName
          });
        }
        
        const mapping = businessMappings.get(businessName);
        mapping.categories.add(categoryName);
        mapping.transaction_count++;
        mapping.latest_category = categoryName;
      }
    });

    // Convert to array format
    const mappingsArray = Array.from(businessMappings.values()).map(mapping => ({
      ...mapping,
      categories: Array.from(mapping.categories)
    }));

    res.json({
      success: true,
      mappings: mappingsArray,
      total_businesses: mappingsArray.length
    });
  } catch (error) {
    console.error('Get business mappings error:', error);
    res.status(500).json({ error: 'Failed to fetch business mappings' });
  }
});

// Import category mappings from CSV/bulk data
router.post('/import-mappings', authenticateToken, async (req, res) => {
  try {
    const { mappings } = req.body;
    
    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({ error: 'mappings array is required' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Process each mapping
    for (const mapping of mappings) {
      const { business_name, category_name } = mapping;
      
      if (!business_name || !category_name) {
        results.failed++;
        results.errors.push({
          business_name,
          error: 'Business name and category name are required'
        });
        continue;
      }

      try {
        // Find transactions for this business
        const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
          show_all: true 
        });
        
        const businessTransactions = transactions.filter(t => 
          t.business_name === business_name
        );

        // Update all transactions for this business
        let updatedCount = 0;
        for (const transaction of businessTransactions) {
          const success = await SupabaseService.updateTransaction(transaction.id, {
            category_name: category_name
          });
          
          if (success) {
            updatedCount++;
          }
        }

        if (updatedCount > 0) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            business_name,
            error: 'No transactions found for this business'
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          business_name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Import completed',
      results
    });
  } catch (error) {
    console.error('Import mappings error:', error);
    res.status(500).json({ error: 'Failed to import mappings' });
  }
});

module.exports = router;