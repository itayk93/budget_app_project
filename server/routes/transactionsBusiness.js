const express = require('express');
const SupabaseService = require('../services/supabaseService');
const mongoBusinessService = require('../services/mongoBusinessService');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ===== BUSINESS INTELLIGENCE & CATEGORIZATION =====

// Get business details for a specific transaction
router.get('/:id/business-details', authenticateToken, async (req, res) => {
  try {
    const transaction = await SupabaseService.getTransactionById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Verify ownership
    if (transaction.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get business details from MongoDB using the transaction's business name
    const businessName = transaction.business_name || transaction.description;
    
    if (!businessName) {
      return res.json({ 
        transaction_id: req.params.id,
        business_name: null,
        business_details: null,
        message: 'No business name found for this transaction'
      });
    }

    const businessResult = await mongoBusinessService.getBusinessIntelligence(req.user.id, businessName);
    
    if (businessResult.success && businessResult.businesses.length > 0) {
      const businessData = businessResult.businesses[0];
      
      return res.json({
        transaction_id: req.params.id,
        business_name: businessName,
        business_details: {
          category: businessData.perplexity_analysis.category,
          confidence: businessData.perplexity_analysis.confidence,
          business_info: businessData.perplexity_analysis.business_info,
          reasoning: businessData.perplexity_analysis.reasoning,
          analysis_date: businessData.analysis_date,
          last_updated: businessData.updated_at
        },
        found: true
      });
    } else {
      return res.json({
        transaction_id: req.params.id,
        business_name: businessName,
        business_details: null,
        found: false,
        message: 'Business details not found in database'
      });
    }

  } catch (error) {
    console.error('Error fetching business details for transaction:', error);
    res.status(500).json({ error: 'Failed to fetch business details' });
  }
});

// Get businesses with "הוצאות משתנות" category for categorization review
router.get('/businesses/variable-expenses', authenticateToken, async (req, res) => {
  try {
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    });

    // Filter transactions with "הוצאות משתנות" category
    const variableExpenseTransactions = transactions.filter(t => 
      t.category_name === 'הוצאות משתנות'
    );

    // Group by business name and count transactions
    const businessSummary = new Map();
    
    variableExpenseTransactions.forEach(transaction => {
      const businessName = transaction.business_name || 'Unknown Business';
      
      if (!businessSummary.has(businessName)) {
        businessSummary.set(businessName, {
          business_name: businessName,
          current_category: transaction.category_name,
          transaction_count: 0,
          total_amount: 0,
          currency: transaction.currency || 'ILS',
          latest_transaction_date: transaction.payment_date,
          sample_transactions: []
        });
      }
      
      const business = businessSummary.get(businessName);
      business.transaction_count++;
      business.total_amount += Math.abs(parseFloat(transaction.amount || 0));
      
      // Keep latest transaction date
      if (new Date(transaction.payment_date) > new Date(business.latest_transaction_date)) {
        business.latest_transaction_date = transaction.payment_date;
      }
      
      // Add sample transactions (max 3)
      if (business.sample_transactions.length < 3) {
        business.sample_transactions.push({
          id: transaction.id,
          amount: transaction.amount,
          payment_date: transaction.payment_date,
          notes: transaction.notes
        });
      }
    });

    // Convert map to array and sort by transaction count (descending)
    const businessesArray = Array.from(businessSummary.values())
      .sort((a, b) => b.transaction_count - a.transaction_count);

    res.json({
      success: true,
      businesses: businessesArray,
      total_businesses: businessesArray.length,
      total_transactions: variableExpenseTransactions.length
    });

  } catch (error) {
    console.error('Error fetching variable expense businesses:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch businesses with variable expenses' 
    });
  }
});

// Get AI category suggestions for businesses using Perplexity API
router.post('/businesses/suggest-categories', authenticateToken, async (req, res) => {
  try {
    const { businesses, debug } = req.body;

    if (!businesses || !Array.isArray(businesses) || businesses.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'businesses array is required' 
      });
    }

    // Get all existing categories for this user
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    });
    
    const existingCategories = [...new Set(
      transactions
        .map(t => t.category_name)
        .filter(name => name && name.trim() && name !== 'הוצאות משתנות')
    )].sort();

    const categorySuggestions = [];

    // Process each business with Perplexity API
    for (const businessName of businesses) {
      try {
        const suggestion = await getCategorySuggestionFromPerplexity(businessName, existingCategories, debug);
        const suggestionData = {
          business_name: businessName,
          suggested_category: suggestion.category,
          confidence: suggestion.confidence,
          reasoning: suggestion.reasoning
        };
        
        // Add additional business information if available
        if (suggestion.business_info) {
          suggestionData.business_info = suggestion.business_info;
        }
        
        // Add debug information if requested
        if (debug && suggestion.debug_info) {
          suggestionData.debug_info = suggestion.debug_info;
        }
        
        // Save business intelligence to MongoDB
        try {
          await mongoBusinessService.saveBusinessIntelligence(
            req.user.id, 
            businessName, 
            {
              ...suggestion,
              suggested_category: suggestion.category,
              raw_response: suggestion.debug_info ? JSON.stringify(suggestion.debug_info) : null
            }
          );
          console.log(`Saved business intelligence for: ${businessName}`);
        } catch (mongoError) {
          console.error(`Error saving to MongoDB for ${businessName}:`, mongoError);
          // Don't fail the request if MongoDB save fails
        }
        
        categorySuggestions.push(suggestionData);
      } catch (error) {
        console.error(`Error getting suggestion for ${businessName}:`, error);
        categorySuggestions.push({
          business_name: businessName,
          suggested_category: 'הוצאות משתנות',
          confidence: 0,
          reasoning: 'Error occurred during Perplexity categorization',
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      suggestions: categorySuggestions
    });

  } catch (error) {
    console.error('Error getting category suggestions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get category suggestions' 
    });
  }
});

// Update business categories in bulk
router.post('/businesses/update-categories', authenticateToken, async (req, res) => {
  try {
    const { category_updates } = req.body;

    if (!category_updates || !Array.isArray(category_updates) || category_updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'category_updates array is required' 
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [],
      updated_businesses: []
    };

    // Process each business category update
    for (const update of category_updates) {
      const { business_name, new_category, exclude_transaction_ids = [] } = update;
      
      if (!business_name || !new_category) {
        results.failed++;
        results.errors.push({
          business_name: business_name || 'Unknown',
          error: 'business_name and new_category are required'
        });
        continue;
      }

      try {
        // Get all transactions for this business with current "הוצאות משתנות" category
        const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
          show_all: true 
        });

        const businessTransactions = transactions.filter(t => 
          t.business_name === business_name && 
          t.category_name === 'הוצאות משתנות' &&
          !exclude_transaction_ids.includes(t.id)
        );

        if (businessTransactions.length === 0) {
          results.failed++;
          results.errors.push({
            business_name: business_name,
            error: 'No transactions found for this business'
          });
          continue;
        }

        // Update all transactions for this business
        let updatedCount = 0;
        for (const transaction of businessTransactions) {
          const success = await SupabaseService.updateTransaction(transaction.id, {
            category_name: new_category,
            updated_at: new Date().toISOString()
          });

          if (success) {
            updatedCount++;
          }
        }

        if (updatedCount > 0) {
          results.success++;
          results.updated_businesses.push({
            business_name: business_name,
            new_category: new_category,
            updated_transactions: updatedCount
          });
        } else {
          results.failed++;
          results.errors.push({
            business_name: business_name,
            error: 'Failed to update any transactions'
          });
        }

      } catch (error) {
        results.failed++;
        results.errors.push({
          business_name: business_name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Bulk category update completed',
      results: results
    });

  } catch (error) {
    console.error('Error in bulk category update:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update business categories' 
    });
  }
});

// Get transactions for a specific business name
router.get('/businesses/:businessName/transactions', authenticateToken, async (req, res) => {
  try {
    const businessName = decodeURIComponent(req.params.businessName);
    const { category_name } = req.query;

    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    });

    let businessTransactions = transactions.filter(t => 
      t.business_name === businessName
    );

    // Filter by category if specified
    if (category_name) {
      businessTransactions = businessTransactions.filter(t => 
        t.category_name === category_name
      );
    }

    // Sort by payment date (newest first)
    businessTransactions.sort((a, b) => 
      new Date(b.payment_date) - new Date(a.payment_date)
    );

    res.json({
      success: true,
      transactions: businessTransactions,
      total_count: businessTransactions.length,
      business_name: businessName
    });

  } catch (error) {
    console.error('Error fetching business transactions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch business transactions' 
    });
  }
});

// Get all available categories for dropdown
router.get('/categories/available', authenticateToken, async (req, res) => {
  try {
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    });
    
    const existingCategories = [...new Set(
      transactions
        .map(t => t.category_name)
        .filter(name => name && name.trim())
    )].sort();

    res.json({
      success: true,
      categories: existingCategories
    });

  } catch (error) {
    console.error('Error fetching available categories:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch available categories' 
    });
  }
});

// Get most common category for a business name
router.get('/businesses/:businessName/most-common-category', authenticateToken, async (req, res) => {
  try {
    const businessName = decodeURIComponent(req.params.businessName);
    
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    });

    // Filter transactions for this business name
    const businessTransactions = transactions.filter(t => 
      t.business_name && t.business_name.toLowerCase() === businessName.toLowerCase()
    );

    if (businessTransactions.length === 0) {
      return res.json({
        success: true,
        business_name: businessName,
        most_common_category: null,
        message: 'No transactions found for this business'
      });
    }

    // Count categories for this business
    const categoryCount = {};
    businessTransactions.forEach(transaction => {
      const categoryName = transaction.category_name;
      if (categoryName && categoryName.trim()) {
        categoryCount[categoryName] = (categoryCount[categoryName] || 0) + 1;
      }
    });

    // Find the most common category
    let mostCommonCategory = null;
    let maxCount = 0;
    
    Object.entries(categoryCount).forEach(([category, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonCategory = category;
      }
    });

    res.json({
      success: true,
      business_name: businessName,
      most_common_category: mostCommonCategory,
      category_counts: categoryCount,
      total_transactions: businessTransactions.length
    });

  } catch (error) {
    console.error('Error fetching most common category for business:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch most common category' 
    });
  }
});

// ===== MONGODB BUSINESS INTELLIGENCE ENDPOINTS =====

// Get business intelligence from MongoDB
router.get('/businesses/intelligence', authenticateToken, async (req, res) => {
  try {
    const { business_name } = req.query;
    
    const result = await mongoBusinessService.getBusinessIntelligence(
      req.user.id, 
      business_name
    );

    res.json(result);

  } catch (error) {
    console.error('Error fetching business intelligence:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch business intelligence' 
    });
  }
});

// Update business information in MongoDB (separate from category updates)
router.post('/businesses/update-intelligence', authenticateToken, async (req, res) => {
  try {
    const { business_name, update_data } = req.body;

    if (!business_name || !update_data) {
      return res.status(400).json({ 
        success: false, 
        error: 'business_name and update_data are required' 
      });
    }

    const result = await mongoBusinessService.updateBusinessIntelligence(
      req.user.id,
      business_name,
      update_data
    );

    res.json(result);

  } catch (error) {
    console.error('Error updating business intelligence:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update business intelligence' 
    });
  }
});

// Get business statistics from MongoDB
router.get('/businesses/stats', authenticateToken, async (req, res) => {
  try {
    const result = await mongoBusinessService.getBusinessStats(req.user.id);
    res.json(result);

  } catch (error) {
    console.error('Error fetching business stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch business stats' 
    });
  }
});

// ===== AI CATEGORIZATION HELPER FUNCTIONS =====

/**
 * Helper function to get category suggestion from Perplexity API
 * @param {string} businessName - The name of the business to categorize
 * @param {Array<string>} existingCategories - List of existing categories to choose from
 * @param {boolean} debug - Whether to return debug information
 * @returns {Promise<Object>} Category suggestion with confidence and reasoning
 */
async function getCategorySuggestionFromPerplexity(businessName, existingCategories, debug = false) {
  const axios = require('axios');
  
  // Check if Perplexity API is configured
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('Perplexity API key not configured');
  }

  console.log('Using Perplexity API key:', process.env.PERPLEXITY_API_KEY ? 'Available' : 'Missing');
  console.log('Trying to categorize business:', businessName, 'with model: sonar');
  console.log('Available categories:', existingCategories.filter(cat => cat && cat.trim() && cat !== 'הוצאות משתנות').slice(0, 15));

  try {
    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: debug ? 
            'You are a business research expert. Use web search to find detailed information about businesses. Return your response as JSON with category, business details, and reasoning.' :
            'You are a business categorization expert. Use web search to find information about businesses and categorize them accurately. Always respond with only the Hebrew category name.'
        },
        {
          role: 'user',  
          content: debug ? 
            `Research the business "${businessName}" online and provide comprehensive information. Search for the most recent and accurate details. Return a JSON response with this structure:
{
  "category": "Hebrew category name from the list",
  "business_info": {
    "name": "Full official business name",
    "type": "Detailed business type/industry",
    "location": "City/Area/Neighborhood",
    "country": "Country",
    "address": "Complete street address",
    "phone": "Phone numbers (multiple if available)",
    "email": "Email address if found",
    "website": "Official website URL",
    "opening_hours": "Detailed opening hours",
    "social_links": ["Facebook, Instagram, LinkedIn URLs"],
    "branch_info": "Chain/franchise/parent company info",
    "services": "Main products/services offered",
    "payment_methods": "Accepted payment methods",
    "parking": "Parking availability info",
    "accessibility": "Accessibility features",
    "rating": "Customer rating/reviews if available",
    "year_established": "Year founded if available",
    "employee_count": "Approximate number of employees",
    "business_id": "Company registration number if found",
    "description": "Comprehensive business description"
  },
  "reasoning": "Detailed explanation for the categorization with sources"
}

Available categories: ${existingCategories.filter(cat => cat && cat.trim() && cat !== 'הוצאות משתנות').slice(0, 15).join(', ')}

Rules:
- If it's flowers/plants: "פנאי ובילויים" 
- If it's food/restaurant: "אוכל בחוץ"
- If it's supermarket: "סופר"
- If it's gas/fuel: "רכב ותחבורה ציבורית"
- If it's pharmacy: "פארמה"
- If it's coffee shop: "בתי קפה"
- If it's clothing: "ביגוד והנעלה"
- If it's general shopping: "כללי"` :
            `What type of business is "${businessName}"? Search online to understand what this business does. Then categorize it into ONE of these categories: ${existingCategories.filter(cat => cat && cat.trim() && cat !== 'הוצאות משתנות').slice(0, 15).join(', ')}. 

Rules:
- If it's flowers/plants: "פנאי ובילויים" 
- If it's food/restaurant: "אוכל בחוץ"
- If it's supermarket: "סופר"
- If it's gas/fuel: "רכב ותחבורה ציבורית"
- If it's pharmacy: "פארמה"
- If it's coffee shop: "בתי קפה"
- If it's clothing: "ביגוד והנעלה"
- If it's general shopping: "כללי"

Return ONLY the Hebrew category name, nothing else.`
        }
      ],
      temperature: 0.1,
      max_tokens: debug ? 2000 : 20
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Perplexity');
    }

    const result = {
      confidence: 0.8, // Fixed confidence for Perplexity
      reasoning: 'Perplexity AI categorization'
    };

    // Add debug information if requested
    if (debug) {
      result.debug_info = {
        raw_response: response.data,
        perplexity_content: content
      };
    }

    if (debug) {
      try {
        // Check if JSON is incomplete (truncated)
        let jsonContent = content.trim();
        
        // Fix issues with double quotes inside strings
        // Fix double quotes in "name" that contain "בע"מ"
        jsonContent = jsonContent.replace(/"([^"]*)(בע"מ)([^"]*)"/g, '"$1בע\\"מ$3"');
        jsonContent = jsonContent.replace(/"([^"]*)(מ\.ע\.)([^"]*)"/g, '"$1מ\\.ע\\.$3"');
        
        // If JSON is truncated, try to close it
        if (!jsonContent.endsWith('}') && jsonContent.includes('{')) {
          // Count open braces and add closing ones
          const openBraces = (jsonContent.match(/{/g) || []).length;
          const closeBraces = (jsonContent.match(/}/g) || []).length;
          const missingBraces = openBraces - closeBraces;
          
          if (missingBraces > 0) {
            // Close unclosed strings
            if (jsonContent.includes('"description": "') && !jsonContent.match(/"description": "[^"]*"[,}]/)) {
              jsonContent += '"';
            }
            if (jsonContent.includes('"reasoning": "') && !jsonContent.match(/"reasoning": "[^"]*"[}]/)) {
              jsonContent += '"';
            }
            // Add missing braces
            jsonContent += '}'.repeat(missingBraces);
          }
        }
        
        console.log('Attempting to parse JSON:', jsonContent.substring(0, 200) + '...');
        const jsonResponse = JSON.parse(jsonContent);
        
        result.category = jsonResponse.category || 'הוצאות משתנות';
        result.business_info = jsonResponse.business_info || {};
        result.reasoning = jsonResponse.reasoning || 'Perplexity AI categorization with detailed research';
        
        console.log('Successfully parsed JSON. Category:', result.category);
        
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError.message);
        console.log('Raw content:', content.substring(0, 300) + '...');
        
        // Manual extraction of category from malformed JSON
        const categoryMatch = content.match(/"category":\s*"([^"]+)"/);
        if (categoryMatch) {
          result.category = categoryMatch[1];
          console.log('Extracted category manually:', result.category);
        } else {
          result.category = 'הוצאות משתנות';
        }
        
        // Try to extract basic business info
        const nameMatch = content.match(/"name":\s*"([^"]+)"/);
        const typeMatch = content.match(/"type":\s*"([^"]+)"/);
        const locationMatch = content.match(/"location":\s*"([^"]+)"/);
        
        result.business_info = {
          name: nameMatch ? nameMatch[1] : businessName,
          type: typeMatch ? typeMatch[1] : '',
          location: locationMatch ? locationMatch[1] : '',
          country: 'ישראל',
          address: '',
          phone: '',
          website: '',
          opening_hours: '',
          social_links: [],
          branch_info: '',
          description: 'מידע חלקי עקב חיתוך התגובה'
        };
        
        result.reasoning = 'Perplexity AI categorization (parsed from truncated response)';
      }
    } else {
      // Simple mode - just clean up the category name
      const cleanCategory = content.trim()
        .replace(/[.,!?'"]/g, '')
        .replace(/^\d+\.?\s*/, '') // Remove number prefixes
        .trim();
      result.category = cleanCategory || 'הוצאות משתנות';
    }

    return result;

  } catch (error) {
    console.error('Error calling Perplexity API:', error);
    
    // Log the full error response for debugging
    if (error.response) {
      console.error('Perplexity API response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    // Return a smart categorization based on business name as fallback
    let fallbackCategory = 'הוצאות משתנות';
    const businessLower = businessName.toLowerCase();
    
    // Food and drinks
    if (businessLower.includes('מזון') || businessLower.includes('מסעדה') || businessLower.includes('קפה') || 
        businessLower.includes('בורגר') || businessLower.includes('פיצה') || businessLower.includes('אוכל') ||
        businessLower.includes('מקדונלד') || businessLower.includes('ברגר') || businessLower.includes('דומינו') ||
        businessLower.includes('סושי') || businessLower.includes('שווארמה') || businessLower.includes('פלאפל')) {
      fallbackCategory = 'אוכל בחוץ';
    }
    // Shopping and retail
    else if (businessLower.includes('קניון') || businessLower.includes('קניות') || businessLower.includes('חנות') ||
             businessLower.includes('רמי לוי') || businessLower.includes('שופרסל') || businessLower.includes('סופר') ||
             businessLower.includes('טיב טעם') || businessLower.includes('מגה') || businessLower.includes('יינות ביתן')) {
      fallbackCategory = 'סופר';
    }
    // Transport and fuel
    else if (businessLower.includes('דלק') || businessLower.includes('רכב') || businessLower.includes('תחבורה') ||
             businessLower.includes('פז') || businessLower.includes('דור אלון') || businessLower.includes('סונול') ||
             businessLower.includes('חניה') || businessLower.includes('אוטובוס') || businessLower.includes('רכבת')) {
      fallbackCategory = 'רכב ותחבורה ציבורית';
    }
    // Entertainment
    else if (businessLower.includes('בילוי') || businessLower.includes('קולנוע') || businessLower.includes('משחק') ||
             businessLower.includes('סינמה') || businessLower.includes('תיאטרון') || businessLower.includes('הופעה')) {
      fallbackCategory = 'פנאי ובילויים';
    }
    // Coffee shops
    else if (businessLower.includes('קפה') || businessLower.includes('אספרסו') || businessLower.includes('נספרסו') ||
             businessLower.includes('ארומה') || businessLower.includes('קפה גרג') || businessLower.includes('לנדוור')) {
      fallbackCategory = 'בתי קפה';
    }
    // Flowers (from the example)
    else if (businessLower.includes('פרח') || businessLower.includes('זר') || businessLower.includes('עציצ') || businessLower.includes('נוי')) {
      fallbackCategory = 'פנאי ובילויים';
    }
    // Pharmacy
    else if (businessLower.includes('פארמה') || businessLower.includes('בית מרקחת') || businessLower.includes('סופר פארם')) {
      fallbackCategory = 'פארמה';
    }
    // General
    else if (businessLower.includes('כללי') || businessLower.includes('שונות') || businessLower.includes('מעורב')) {
      fallbackCategory = 'כללי';
    }
    
    console.log(`Using fallback categorization for ${businessName}: ${fallbackCategory}`);
    
    return {
      category: fallbackCategory,
      confidence: 0.5,
      reasoning: 'Fallback categorization - Perplexity API unavailable'
    };
  }
}

module.exports = router;