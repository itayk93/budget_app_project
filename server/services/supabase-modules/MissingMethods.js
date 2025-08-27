/**
 * Missing Methods from Original SupabaseService
 * These methods need to be added to the appropriate modules
 */

const { supabase } = require('../../config/supabase');
const SharedUtilities = require('./SharedUtilities');

class MissingMethods {
  
  // ===== METHODS TO ADD TO EXISTING MODULES =====
  
  // Should be added to TransactionService.js:
  static async createTransactionsBatch(transactions, forceImport = false) {
    try {
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return SharedUtilities.createErrorResponse('Transactions array is required');
      }

      const results = [];
      for (const transaction of transactions) {
        try {
          // Generate hash for each transaction - import TransactionService for proper hash generation
          const TransactionService = require('./TransactionService');
          const transactionHash = transaction.transaction_hash || 
            TransactionService.generateTransactionHash(transaction);
            
          const processedTransaction = {
            ...transaction,
            transaction_hash: transactionHash,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data, error } = await supabase
            .from('transactions')
            .insert([processedTransaction])
            .select()
            .single();

          if (error && !forceImport) {
            results.push({ success: false, error: error.message, transaction });
          } else if (error && forceImport) {
            console.warn('Forced import, ignoring error:', error.message);
            results.push({ success: true, data: processedTransaction, forced: true });
          } else {
            results.push({ success: true, data });
          }
        } catch (err) {
          results.push({ success: false, error: err.message, transaction });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      // Return in the original format expected by Excel services
      return {
        success: true,
        imported: successful,
        duplicates: 0, // Will be calculated elsewhere for duplicate detection
        errors: failed,
        results: results,
        summary: { successful, failed, total: transactions.length }
      };
    } catch (error) {
      console.error('Error creating transactions batch:', error);
      return SharedUtilities.handleSupabaseError(error, 'create transactions batch');
    }
  }

  static async getTransactionsByHashes(userId, transactionHashes, cashFlowId = null) {
    try {
      if (!transactionHashes || transactionHashes.length === 0) {
        return SharedUtilities.createSuccessResponse([]);
      }

      SharedUtilities.validateUserId(userId);

      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .in('transaction_hash', transactionHashes);

      if (cashFlowId) {
        query = query.eq('cash_flow_id', cashFlowId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data || []);
    } catch (error) {
      console.error('Error fetching transactions by hashes:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch transactions by hashes');
    }
  }

  static async getTransactionsByHash(transactionHash, userId, cashFlowId = null) {
    try {
      if (!transactionHash || !userId) {
        return SharedUtilities.createErrorResponse('Transaction hash and user ID are required');
      }

      SharedUtilities.validateUserId(userId);

      console.log(`🔍 [DUPLICATE CHECK] Looking for duplicates:`);
      console.log(`🔍 [DUPLICATE CHECK] - Hash: ${transactionHash}`);
      console.log(`🔍 [DUPLICATE CHECK] - UserId: ${userId}`);
      console.log(`🔍 [DUPLICATE CHECK] - CashFlowId: ${cashFlowId}`);

      let query = supabase
        .from('transactions')
        .select('*')
        .eq('transaction_hash', transactionHash)
        .eq('user_id', userId);

      if (cashFlowId) {
        // Look for transactions with matching cash_flow_id OR null cash_flow_id (for legacy transactions)
        console.log(`🔍 [DUPLICATE CHECK] Using OR query: cash_flow_id.eq.${cashFlowId},cash_flow_id.is.null`);
        query = query.or(`cash_flow_id.eq.${cashFlowId},cash_flow_id.is.null`);
      } else {
        console.log(`🔍 [DUPLICATE CHECK] No cashFlowId provided, searching all transactions`);
      }

      const { data, error } = await query;

      console.log(`🔍 [DUPLICATE CHECK] Query result:`);
      console.log(`🔍 [DUPLICATE CHECK] - Error: ${error ? error.message : 'null'}`);
      console.log(`🔍 [DUPLICATE CHECK] - Found ${data ? data.length : 0} transactions`);
      if (data && data.length > 0) {
        data.forEach((tx, index) => {
          console.log(`🔍 [DUPLICATE CHECK] - Transaction ${index + 1}: ID=${tx.id}, cash_flow_id=${tx.cash_flow_id}`);
        });
      }
      
      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data || []);
    } catch (error) {
      console.error('Error fetching transactions by hash:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch transactions by hash');
    }
  }

  // Should be added to CategoryService.js or new AdvancedCategoryService.js:
  static async processTransactionsByCategory(transactions, flowMonth = null, userId = null) {
    try {
      if (!Array.isArray(transactions)) {
        return SharedUtilities.createErrorResponse('Transactions must be an array');
      }

      const processedData = {};

      for (const transaction of transactions) {
        const categoryKey = transaction.category_name || 'Uncategorized';
        const amount = parseFloat(transaction.amount) || 0;

        if (!processedData[categoryKey]) {
          processedData[categoryKey] = {
            category_name: categoryKey,
            transactions: [],
            total_amount: 0,
            count: 0
          };
        }

        processedData[categoryKey].transactions.push(transaction);
        processedData[categoryKey].total_amount += Math.abs(amount);
        processedData[categoryKey].count += 1;
      }

      // Convert to array and sort by total amount
      const categoriesArray = Object.values(processedData)
        .sort((a, b) => b.total_amount - a.total_amount);

      return SharedUtilities.createSuccessResponse({
        categories: categoriesArray,
        total_categories: categoriesArray.length,
        total_transactions: transactions.length,
        flow_month: flowMonth
      });
    } catch (error) {
      console.error('Error processing transactions by category:', error);
      return SharedUtilities.handleSupabaseError(error, 'process transactions by category');
    }
  }

  static async groupCategoriesByShared(processedData, userId) {
    try {
      SharedUtilities.validateUserId(userId);

      if (!processedData || !Array.isArray(processedData.categories)) {
        return SharedUtilities.createErrorResponse('Processed data with categories array is required');
      }

      // Group categories by shared category names
      const sharedGroups = {};
      const individualCategories = [];

      for (const categoryData of processedData.categories) {
        const categoryName = categoryData.category_name;
        
        // Check if this category belongs to a shared group
        // This is a simplified version - you might want to have a mapping table
        const sharedName = this.getSharedCategoryName(categoryName);
        
        if (sharedName) {
          if (!sharedGroups[sharedName]) {
            sharedGroups[sharedName] = {
              shared_category_name: sharedName,
              categories: [],
              total_amount: 0,
              total_count: 0
            };
          }
          
          sharedGroups[sharedName].categories.push(categoryData);
          sharedGroups[sharedName].total_amount += categoryData.total_amount;
          sharedGroups[sharedName].total_count += categoryData.count;
        } else {
          individualCategories.push(categoryData);
        }
      }

      return SharedUtilities.createSuccessResponse({
        shared_groups: Object.values(sharedGroups),
        individual_categories: individualCategories,
        total_shared_groups: Object.keys(sharedGroups).length,
        total_individual: individualCategories.length
      });
    } catch (error) {
      console.error('Error grouping categories by shared:', error);
      return SharedUtilities.handleSupabaseError(error, 'group categories by shared');
    }
  }

  // Helper method for shared category grouping
  static getSharedCategoryName(categoryName) {
    // Define shared category mappings
    const sharedMappings = {
      'קבועות': ['חשמל', 'מים', 'גז', 'ארנונה', 'ביטוח', 'טלפון', 'אינטרנט'],
      'משתנות': ['מזון', 'קניות', 'בילויים', 'תחבורה'],
      'הכנסות': ['משכורת', 'פרילנס', 'השקעות', 'מתנות']
    };

    for (const [sharedName, keywords] of Object.entries(sharedMappings)) {
      if (keywords.some(keyword => categoryName.includes(keyword))) {
        return sharedName;
      }
    }

    return null; // Not a shared category
  }

  // Should be added to BudgetService.js:
  static async calculateMonthlyAverage(userId, categoryName, months = 3) {
    try {
      SharedUtilities.validateUserId(userId);
      
      if (!categoryName) {
        return SharedUtilities.createErrorResponse('Category name is required');
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, payment_month, payment_year')
        .eq('user_id', userId)
        .eq('category_name', categoryName)
        .gte('payment_date', startDate.toISOString().split('T')[0])
        .lte('payment_date', endDate.toISOString().split('T')[0])
        .eq('excluded_from_flow', false);

      if (error) throw error;

      if (!data || data.length === 0) {
        return SharedUtilities.createSuccessResponse({
          average: 0,
          total_amount: 0,
          months_analyzed: 0,
          category_name: categoryName
        });
      }

      const totalAmount = data.reduce((sum, transaction) => {
        return sum + Math.abs(parseFloat(transaction.amount) || 0);
      }, 0);

      const monthsAnalyzed = Math.min(months, data.length > 0 ? months : 0);
      const average = monthsAnalyzed > 0 ? totalAmount / monthsAnalyzed : 0;

      return SharedUtilities.createSuccessResponse({
        average: Math.round(average * 100) / 100,
        total_amount: totalAmount,
        months_analyzed: monthsAnalyzed,
        transaction_count: data.length,
        category_name: categoryName
      });
    } catch (error) {
      console.error('Error calculating monthly average:', error);
      return SharedUtilities.handleSupabaseError(error, 'calculate monthly average');
    }
  }

  // Should be added to BudgetService.js:
  static async getSharedCategoryMonthlySpending(userId, sharedCategoryName, year, month) {
    try {
      SharedUtilities.validateUserId(userId);

      if (!sharedCategoryName || !year || !month) {
        return SharedUtilities.createErrorResponse('Shared category name, year, and month are required');
      }

      // Get all categories that belong to this shared category
      const relatedCategories = this.getCategoriesForSharedName(sharedCategoryName);

      let query = supabase
        .from('transactions')
        .select('amount, category_name')
        .eq('user_id', userId)
        .eq('payment_year', year)
        .eq('payment_month', month)
        .eq('excluded_from_flow', false);

      if (relatedCategories.length > 0) {
        query = query.in('category_name', relatedCategories);
      } else {
        query = query.eq('category_name', sharedCategoryName);
      }

      const { data, error } = await query;

      if (error) throw error;

      const totalSpending = (data || []).reduce((sum, transaction) => {
        return sum + Math.abs(parseFloat(transaction.amount) || 0);
      }, 0);

      return SharedUtilities.createSuccessResponse({
        shared_category_name: sharedCategoryName,
        total_spending: totalSpending,
        transaction_count: data ? data.length : 0,
        year,
        month,
        categories_included: relatedCategories.length > 0 ? relatedCategories : [sharedCategoryName]
      });
    } catch (error) {
      console.error('Error getting shared category monthly spending:', error);
      return SharedUtilities.handleSupabaseError(error, 'get shared category monthly spending');
    }
  }

  // Helper method
  static getCategoriesForSharedName(sharedCategoryName) {
    const mappings = {
      'קבועות': ['חשמל', 'מים', 'גז', 'ארנונה', 'ביטוח', 'טלפון', 'אינטרנט', 'הוצאות קבועות'],
      'משתנות': ['מזון', 'קניות', 'בילויים', 'תחבורה', 'הוצאות משתנות'],
      'הכנסות': ['משכורת', 'פרילנס', 'השקעות', 'מתנות', 'הכנסות']
    };

    return mappings[sharedCategoryName] || [];
  }

  // Should be added to TransactionService.js:
  static async getLatestTransactionDate(cashFlowId, fileSource = null) {
    try {
      if (!cashFlowId) {
        return SharedUtilities.createErrorResponse('Cash flow ID is required');
      }

      let query = supabase
        .from('transactions')
        .select('payment_date, created_at')
        .eq('cash_flow_id', cashFlowId)
        .order('payment_date', { ascending: false })
        .limit(1);

      if (fileSource) {
        query = query.eq('file_source', fileSource);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        return SharedUtilities.createSuccessResponse(null);
      }

      return SharedUtilities.createSuccessResponse({
        latest_date: data[0].payment_date,
        created_at: data[0].created_at,
        file_source: fileSource
      });
    } catch (error) {
      console.error('Error getting latest transaction date:', error);
      return SharedUtilities.handleSupabaseError(error, 'get latest transaction date');
    }
  }
}

module.exports = MissingMethods;