const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const mongoBusinessService = require('../../services/mongoBusinessService');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== BUSINESS CATEGORY INTELLIGENCE =====

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

// Helper function to get category suggestion from Perplexity
async function getCategorySuggestionFromPerplexity(businessName, existingCategories, debug = false) {
  try {
    console.log(`Getting category suggestion for: ${businessName}`);
    
    const axios = require('axios');
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!perplexityApiKey || perplexityApiKey === 'REPLACE_WITH_NEW_PERPLEXITY_KEY') {
      console.log('Perplexity API key not available, using fallback categorization');
      return getFallbackCategory(businessName);
    }

    // Create prompt based on debug mode
    let prompt;
    if (debug) {
      prompt = `You are a financial categorization expert analyzing Israeli businesses. Research the business "${businessName}" and provide:

1. Business Category: Choose from these existing categories: ${existingCategories.join(', ')}
2. Business Information: What does this business do?
3. Reasoning: Why did you choose this category?
4. Confidence: Rate 1-10 how confident you are

If none of the existing categories fit well, suggest a new appropriate category name in Hebrew.

Respond in JSON format:
{
  "category": "chosen category name",
  "confidence": 8,
  "business_info": "description of the business",
  "reasoning": "why this category was chosen",
  "new_category_suggestion": "new category name if needed"
}`;
    } else {
      prompt = `Business name: "${businessName}"
Available categories: ${existingCategories.join(', ')}

Choose the most appropriate category for this Israeli business. If none fit well, suggest a new Hebrew category name.
Respond with only the category name.`;
    }

    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: "sonar",
      messages: [{
        role: "user",
        content: prompt
      }],
      temperature: 0.3,
      max_tokens: debug ? 500 : 50
    }, {
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const aiResponse = response.data.choices[0].message.content.trim();
    
    if (debug) {
      try {
        // Try to parse JSON response
        let jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonResponse = JSON.parse(jsonMatch[0]);
          
          // Save to MongoDB for business intelligence
          try {
            await mongoBusinessService.saveBusinessIntelligence(businessName, {
              perplexity_analysis: jsonResponse,
              analysis_date: new Date(),
              api_used: 'perplexity_sonar'
            });
          } catch (mongoError) {
            console.log('MongoDB save failed:', mongoError.message);
          }
          
          return {
            category: jsonResponse.category || getFallbackCategory(businessName).category,
            confidence: jsonResponse.confidence || 5,
            business_info: jsonResponse.business_info || '',
            reasoning: jsonResponse.reasoning || '',
            source: 'perplexity_ai_debug'
          };
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.log('JSON parse failed, extracting category from text');
        const category = extractCategoryFromText(aiResponse, existingCategories);
        return {
          category: category,
          confidence: 6,
          business_info: aiResponse,
          reasoning: 'Extracted from AI text response',
          source: 'perplexity_ai_text'
        };
      }
    } else {
      // Simple mode - just return the category
      return {
        category: aiResponse,
        confidence: 7,
        source: 'perplexity_ai_simple'
      };
    }

  } catch (error) {
    console.log(`Perplexity API failed for ${businessName}:`, error.message);
    return getFallbackCategory(businessName);
  }
}

// Fallback categorization based on business name patterns
function getFallbackCategory(businessName) {
  const name = businessName.toLowerCase();
  
  // Hebrew category mappings
  const patterns = {
    'מזון': ['מזון', 'אוכל', 'מסעדה', 'קפה', 'פיצה', 'המבורגר', 'שווארמה', 'סושי', 'מקדונלדס', 'ברגר', 'דומינו'],
    'תחבורה': ['תחבורה', 'דלק', 'חניה', 'מונית', 'אוטובוס', 'רכבת', 'גט', 'אובר', 'bolt'],
    'בגדים': ['בגדים', 'אופנה', 'נעליים', 'תיק', 'זארה', 'h&m', 'castro'],
    'בריאות': ['בריאות', 'רופא', 'דוקטור', 'מרפאה', 'בית חולים', 'רוקח', 'סופר פארם'],
    'ביטוח': ['ביטוח', 'הכל', 'מגדל', 'פניקס', 'איילון'],
    'קניות': ['סופר', 'שופינג', 'קניון', 'חנות', 'רמי לוי', 'שופרסל', 'מגה'],
    'בילוי': ['בילוי', 'קולנוע', 'תיאטרון', 'בר', 'פאב', 'מועדון'],
    'טכנולוגיה': ['טכנולוגיה', 'מחשב', 'סלולר', 'אפל', 'סמסונג', 'microsoft', 'google']
  };

  for (const [category, keywords] of Object.entries(patterns)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      return {
        category: category,
        confidence: 4,
        business_info: `Categorized based on business name pattern matching`,
        reasoning: `Business name contains keywords related to ${category}`,
        source: 'fallback_pattern_matching'
      };
    }
  }

  return {
    category: 'הוצאות משתנות',
    confidence: 2,
    business_info: 'Could not determine specific category',
    reasoning: 'No matching patterns found, keeping as variable expenses',
    source: 'fallback_default'
  };
}

// Extract category from AI text response
function extractCategoryFromText(text, existingCategories) {
  const lowerText = text.toLowerCase();
  
  // Look for existing categories in the response
  for (const category of existingCategories) {
    if (lowerText.includes(category.toLowerCase())) {
      return category;
    }
  }
  
  // If no existing category found, try to extract a reasonable category
  const categoryKeywords = ['קטגוריה', 'category', 'סיווג'];
  for (const keyword of categoryKeywords) {
    const index = lowerText.indexOf(keyword);
    if (index !== -1) {
      // Extract text after the keyword
      const afterKeyword = text.substring(index + keyword.length);
      const match = afterKeyword.match(/[:\-]?\s*([^\n\r\.,]{2,30})/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  
  return 'הוצאות משתנות'; // Default fallback
}

// AI category suggestions endpoint
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

    // Process each business
    for (const businessName of businesses) {
      try {
        const suggestion = await getCategorySuggestionFromPerplexity(
          businessName, 
          existingCategories, 
          debug
        );
        
        categorySuggestions.push({
          business_name: businessName,
          suggested_category: suggestion.category,
          confidence: suggestion.confidence || 5,
          business_info: suggestion.business_info || '',
          reasoning: suggestion.reasoning || '',
          source: suggestion.source || 'unknown'
        });

        console.log(`✅ Categorized ${businessName} as: ${suggestion.category}`);
        
      } catch (error) {
        console.error(`Error processing ${businessName}:`, error);
        categorySuggestions.push({
          business_name: businessName,
          suggested_category: 'הוצאות משתנות',
          confidence: 1,
          error: error.message,
          source: 'error_fallback'
        });
      }
    }

    res.json({
      success: true,
      suggestions: categorySuggestions,
      total_processed: businesses.length,
      existing_categories: existingCategories,
      debug_mode: debug || false
    });

  } catch (error) {
    console.error('Error in suggest-categories:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get category suggestions' 
    });
  }
});

// Bulk update business categories
router.post('/businesses/update-categories', authenticateToken, async (req, res) => {
  try {
    const { category_updates, exclude_transaction_ids = [] } = req.body;

    if (!category_updates || !Array.isArray(category_updates) || category_updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'category_updates array is required' 
      });
    }

    // Validate category updates format
    for (const update of category_updates) {
      if (!update.business_name || !update.new_category) {
        return res.status(400).json({ 
          success: false, 
          error: 'Each category update must have business_name and new_category' 
        });
      }
    }

    // Get all user transactions
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    });

    const results = {
      success: 0,
      failed: 0,
      updated_businesses: [],
      errors: []
    };

    // Process each business category update
    for (const { business_name, new_category } of category_updates) {
      try {
        // Find transactions for this business with "הוצאות משתנות" category
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

// Get available categories from user's transaction history
router.get('/categories/available', authenticateToken, async (req, res) => {
  try {
    const { transactions } = await SupabaseService.getTransactions(req.user.id, { 
      show_all: true 
    });

    // Extract unique categories, excluding empty and "הוצאות משתנות"
    const categories = [...new Set(
      transactions
        .map(t => t.category_name)
        .filter(name => name && name.trim() && name !== 'הוצאות משתנות')
    )].sort();

    res.json({
      success: true,
      categories: categories,
      total_count: categories.length
    });

  } catch (error) {
    console.error('Error fetching available categories:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch available categories' 
    });
  }
});

module.exports = router;