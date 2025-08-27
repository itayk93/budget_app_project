const express = require('express');
const SupabaseService = require('../../services/supabaseService');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// ===== ANALYTICS AND PROCESSING =====

// Get transactions processed by category
router.get('/analytics/by-category', authenticateToken, async (req, res) => {
  try {
    const { flow_month, cash_flow_id } = req.query;
    
    // Get all transactions for processing
    const filters = { show_all: true };
    if (flow_month) filters.flow_month = flow_month;
    if (cash_flow_id) filters.cash_flow_id = cash_flow_id;

    const { transactions } = await SupabaseService.getTransactions(req.user.id, filters);
    
    // Process transactions by category
    const processedData = SupabaseService.processTransactionsByCategory(
      transactions, 
      flow_month, 
      req.user.id
    );

    res.json(processedData);

  } catch (error) {
    console.error('Error processing transactions by category:', error);
    res.status(500).json({ error: 'Failed to process transactions' });
  }
});

// Get transaction statistics
router.get('/analytics/stats', authenticateToken, async (req, res) => {
  try {
    const { year, month, cash_flow_id } = req.query;
    
    const filters = { show_all: true };
    if (year && month) {
      filters.year = parseInt(year);
      filters.month = parseInt(month);
    }
    if (cash_flow_id) filters.cash_flow_id = cash_flow_id;

    const { transactions, totalCount } = await SupabaseService.getTransactions(req.user.id, filters);

    // Calculate statistics
    const stats = {
      total_transactions: totalCount,
      total_amount: transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
      income: transactions.filter(t => parseFloat(t.amount || 0) > 0).reduce((sum, t) => sum + parseFloat(t.amount), 0),
      expenses: transactions.filter(t => parseFloat(t.amount || 0) < 0).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0),
      by_category: {},
      by_payment_method: {},
      by_currency: {}
    };

    // Group by category
    transactions.forEach(transaction => {
      const category = transaction.category_name || 'Uncategorized';
      if (!stats.by_category[category]) {
        stats.by_category[category] = { count: 0, total: 0 };
      }
      stats.by_category[category].count++;
      stats.by_category[category].total += parseFloat(transaction.amount || 0);
    });

    // Group by payment method
    transactions.forEach(transaction => {
      const method = transaction.payment_method || 'Unknown';
      if (!stats.by_payment_method[method]) {
        stats.by_payment_method[method] = { count: 0, total: 0 };
      }
      stats.by_payment_method[method].count++;
      stats.by_payment_method[method].total += parseFloat(transaction.amount || 0);
    });

    // Group by currency
    transactions.forEach(transaction => {
      const currency = transaction.currency || 'ILS';
      if (!stats.by_currency[currency]) {
        stats.by_currency[currency] = { count: 0, total: 0 };
      }
      stats.by_currency[currency].count++;
      stats.by_currency[currency].total += parseFloat(transaction.amount || 0);
    });

    res.json(stats);

  } catch (error) {
    console.error('Error calculating transaction stats:', error);
    res.status(500).json({ error: 'Failed to calculate statistics' });
  }
});

// ===== DUPLICATE DETECTION =====

// Check for potential duplicates
router.get('/duplicates', authenticateToken, async (req, res) => {
  try {
    const { cash_flow_id } = req.query;
    
    const filters = { show_all: true };
    if (cash_flow_id) filters.cash_flow_id = cash_flow_id;

    const { transactions } = await SupabaseService.getTransactions(req.user.id, filters);

    // Find potential duplicates by grouping similar transactions
    const potentialDuplicates = [];
    const seen = new Map();

    transactions.forEach(transaction => {
      const key = `${transaction.business_name}_${transaction.amount}_${transaction.payment_date}`;
      
      if (seen.has(key)) {
        const existing = seen.get(key);
        potentialDuplicates.push({
          group_key: key,
          transactions: [existing, transaction]
        });
      } else {
        seen.set(key, transaction);
      }
    });

    res.json({
      potential_duplicates: potentialDuplicates,
      total_groups: potentialDuplicates.length
    });

  } catch (error) {
    console.error('Error finding duplicates:', error);
    res.status(500).json({ error: 'Failed to find duplicates' });
  }
});

// Advanced duplicate detection with similarity scoring
router.get('/duplicates/advanced', authenticateToken, async (req, res) => {
  try {
    const { 
      cash_flow_id, 
      similarity_threshold = 0.8,
      date_range_days = 7,
      amount_tolerance = 0.01
    } = req.query;
    
    const filters = { show_all: true };
    if (cash_flow_id) filters.cash_flow_id = cash_flow_id;

    const { transactions } = await SupabaseService.getTransactions(req.user.id, filters);

    const potentialDuplicates = [];

    // Compare each transaction with others
    for (let i = 0; i < transactions.length; i++) {
      const transaction1 = transactions[i];
      
      for (let j = i + 1; j < transactions.length; j++) {
        const transaction2 = transactions[j];
        
        // Calculate similarity score
        const similarity = calculateTransactionSimilarity(
          transaction1, 
          transaction2,
          {
            dateRangeDays: parseInt(date_range_days),
            amountTolerance: parseFloat(amount_tolerance)
          }
        );
        
        if (similarity >= parseFloat(similarity_threshold)) {
          potentialDuplicates.push({
            similarity_score: similarity,
            transactions: [transaction1, transaction2],
            matched_fields: getMatchedFields(transaction1, transaction2)
          });
        }
      }
    }

    // Sort by similarity score (highest first)
    potentialDuplicates.sort((a, b) => b.similarity_score - a.similarity_score);

    res.json({
      potential_duplicates: potentialDuplicates,
      total_groups: potentialDuplicates.length,
      threshold_used: parseFloat(similarity_threshold)
    });

  } catch (error) {
    console.error('Error in advanced duplicate detection:', error);
    res.status(500).json({ error: 'Failed to find duplicates' });
  }
});

// Helper function to calculate transaction similarity
function calculateTransactionSimilarity(t1, t2, options = {}) {
  const { dateRangeDays = 7, amountTolerance = 0.01 } = options;
  let score = 0;
  let maxScore = 0;

  // Business name similarity (40% weight)
  maxScore += 0.4;
  if (t1.business_name && t2.business_name) {
    const nameSimilarity = stringSimilarity(t1.business_name.toLowerCase(), t2.business_name.toLowerCase());
    score += nameSimilarity * 0.4;
  }

  // Amount similarity (30% weight)
  maxScore += 0.3;
  if (t1.amount && t2.amount) {
    const amount1 = Math.abs(parseFloat(t1.amount));
    const amount2 = Math.abs(parseFloat(t2.amount));
    const amountDiff = Math.abs(amount1 - amount2);
    const avgAmount = (amount1 + amount2) / 2;
    
    if (amountDiff / avgAmount <= amountTolerance) {
      score += 0.3;
    } else {
      // Partial score based on how close amounts are
      const amountSimilarity = Math.max(0, 1 - (amountDiff / avgAmount));
      score += amountSimilarity * 0.3;
    }
  }

  // Date proximity (20% weight)
  maxScore += 0.2;
  if (t1.payment_date && t2.payment_date) {
    const date1 = new Date(t1.payment_date);
    const date2 = new Date(t2.payment_date);
    const daysDiff = Math.abs((date1 - date2) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= dateRangeDays) {
      const dateSimilarity = Math.max(0, 1 - (daysDiff / dateRangeDays));
      score += dateSimilarity * 0.2;
    }
  }

  // Payment method (10% weight)
  maxScore += 0.1;
  if (t1.payment_method && t2.payment_method && t1.payment_method === t2.payment_method) {
    score += 0.1;
  }

  return maxScore > 0 ? score / maxScore : 0;
}

// Helper function to calculate string similarity (Levenshtein distance)
function stringSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  if (str1.length === 0) return str2.length === 0 ? 1 : 0;
  if (str2.length === 0) return 0;

  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : (maxLength - matrix[str2.length][str1.length]) / maxLength;
}

// Helper function to get matched fields between transactions
function getMatchedFields(t1, t2) {
  const matched = [];
  
  if (t1.business_name === t2.business_name) matched.push('business_name');
  if (t1.amount === t2.amount) matched.push('amount');
  if (t1.payment_date === t2.payment_date) matched.push('payment_date');
  if (t1.payment_method === t2.payment_method) matched.push('payment_method');
  if (t1.currency === t2.currency) matched.push('currency');
  if (t1.category_name === t2.category_name) matched.push('category');
  
  return matched;
}

module.exports = router;