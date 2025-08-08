/**
 * Transaction Service for Supabase Operations
 * Extracted from supabaseService.js - Transaction management operations
 * ~800 lines - Handles all transaction-related database operations
 */

const { supabase } = require('../../config/supabase');
const crypto = require('crypto');
const SharedUtilities = require('./SharedUtilities');

class TransactionService {

  // ===== TRANSACTION HASH GENERATION =====
  
  static generateTransactionHash(transaction) {
    try {
      // Extract payment date handling - exactly matching Flask version
      let payment_date;
      if (transaction.payment_date) {
        const date = new Date(transaction.payment_date);
        if (!isNaN(date.getTime())) {
          payment_date = date.toISOString().split('T')[0];
        } else {
          payment_date = "";
        }
      }

      // Create a subset of data to hash - only use the core identifying fields
      // Excluding payment_identifier AND payment_method to catch duplicates with different methods
      // This matches EXACTLY the Flask version logic
      
      // Handle amount properly, including NaN cases
      let amount = parseFloat(transaction.amount || 0);
      if (isNaN(amount) || !isFinite(amount)) {
        amount = 0; // Convert NaN/Infinity to 0 for consistent hashing
      }
      amount = Math.round(amount * 100) / 100; // Round to 2 decimal places
      
      const hashData = {
        business_name: String(transaction.business_name || "").toLowerCase().trim(),
        payment_date: String(payment_date),
        amount: amount,
        currency: String(transaction.currency || "ILS").toUpperCase().trim(),
        notes: String(transaction.notes || "").trim(),
      };

      // Convert to string and hash - exactly like Flask version
      const hashString = JSON.stringify(hashData, Object.keys(hashData).sort());
      return crypto.createHash('md5').update(hashString, 'utf8').digest('hex');
    } catch (error) {
      console.error('Error generating transaction hash:', error);
      // DO NOT use a timestamp as fallback - use a hash of what's available
      // Using a timestamp would create a unique hash and bypass duplicate detection
      const fallbackData = {
        business_name: String(transaction.business_name || ""),
        error: String(error),
      };
      const fallbackString = JSON.stringify(fallbackData, Object.keys(fallbackData).sort());
      return crypto.createHash('md5').update(fallbackString).digest('hex');
    }
  }

  // ===== TRANSACTION EXISTENCE CHECKS =====

  static async checkTransactionExists(userId, transactionHash, cashFlowId = null) {
    try {
      SharedUtilities.validateUserId(userId);

      let query = supabase
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('transaction_hash', transactionHash);

      if (cashFlowId) {
        query = query.eq('cash_flow_id', cashFlowId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return (data && data.length > 0);
    } catch (error) {
      console.error('Error checking transaction existence:', error);
      return false;
    }
  }

  static async getTransactionByHash(userId, transactionHash, cashFlowId = null) {
    try {
      SharedUtilities.validateUserId(userId);

      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('transaction_hash', transactionHash);

      if (cashFlowId) {
        query = query.eq('cash_flow_id', cashFlowId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return (data && data.length > 0) ? SharedUtilities.createSuccessResponse(data[0]) : null;
    } catch (error) {
      console.error('Error fetching transaction by hash:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch transaction by hash');
    }
  }

  // Batch check for existing transaction hashes - much faster than individual queries
  static async getExistingHashesBatch(userId, transactionHashes, cashFlowId = null) {
    try {
      if (!transactionHashes || transactionHashes.length === 0) {
        return [];
      }

      SharedUtilities.validateUserId(userId);

      let query = supabase
        .from('transactions')
        .select('transaction_hash')
        .eq('user_id', userId)
        .in('transaction_hash', transactionHashes);

      if (cashFlowId) {
        query = query.eq('cash_flow_id', cashFlowId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data ? data.map(row => row.transaction_hash) : [];
    } catch (error) {
      console.error('Error checking existing hashes batch:', error);
      return [];
    }
  }

  // ===== TRANSACTION RETRIEVAL =====

  static async getTransactions(userId, filters = {}, page = 1, perPage = 100) {
    try {
      SharedUtilities.validateUserId(userId);

      let query = supabase
        .from('transactions')
        .select(`
          *,
          category:category_id (
            id,
            name,
            category_type,
            color
          ),
          cash_flow:cash_flow_id (
            id,
            name,
            currency
          )
        `, { count: 'exact' })
        .eq('user_id', userId);

      // Apply filters
      if (filters.year && filters.month) {
        query = query.eq('payment_month', parseInt(filters.month))
                    .eq('payment_year', parseInt(filters.year));
      } else if (filters.flow_month) {
        query = query.eq('flow_month', filters.flow_month);
      }
      
      if (filters.cash_flow_id) {
        query = query.eq('cash_flow_id', filters.cash_flow_id);
      }
      
      if (filters.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      
      if (filters.no_category) {
        query = query.is('category_id', null).is('category_name', null);
      }
      
      if (filters.q) {
        query = query.ilike('business_name', `%${filters.q}%`);
      }

      if (filters.notes) {
        query = query.ilike('notes', `%${filters.notes}%`);
      }

      if (filters.linked_transaction_id) {
        query = query.eq('linked_transaction_id', filters.linked_transaction_id);
      }

      // Apply sorting
      query = query.order('payment_date', { ascending: false })
                   .order('created_at', { ascending: false });

      // Apply pagination
      const start = (page - 1) * perPage;
      const end = start + perPage - 1;
      query = query.range(start, end);

      const { data, error, count } = await query;

      if (error) throw error;

      // Process transactions with currency formatting
      const processedTransactions = (data || []).map(transaction => {
        const currency = transaction.cash_flow?.currency || transaction.currency || 'ILS';
        const currencySymbol = SharedUtilities.getCurrencySymbol(currency);
        const amount = parseFloat(transaction.amount || 0);
        
        return {
          ...transaction,
          currency,
          currency_symbol: currencySymbol,
          formatted_amount: SharedUtilities.formatCurrency(amount, currency),
          category_name: transaction.category?.name || transaction.category_name
        };
      });

      return SharedUtilities.createSuccessResponse({
        data: processedTransactions,
        total_count: count || 0,
        transactions: processedTransactions, // For backward compatibility
        totalCount: count || 0 // For backward compatibility
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch transactions');
    }
  }

  static async getTransactionById(transactionId) {
    try {
      if (!transactionId) {
        return SharedUtilities.createErrorResponse('Transaction ID is required');
      }

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          cash_flows:cash_flow_id (
            name,
            currency
          ),
          categories:category_id (
            name
          )
        `)
        .eq('id', transactionId)
        .single();

      if (error) throw error;
      
      // Add computed fields for easier frontend consumption
      if (data) {
        data.cash_flow_name = data.cash_flows?.name || null;
        data.category_name = data.categories?.name || data.category_name || null;
      }
      
      return SharedUtilities.createSuccessResponse(data);
    } catch (error) {
      console.error('Error fetching transaction by ID:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch transaction by ID');
    }
  }

  static async getLatestTransactionMonth(userId, cashFlowId = null) {
    try {
      SharedUtilities.validateUserId(userId);

      let query = supabase
        .from('transactions')
        .select('flow_month')
        .eq('user_id', userId)
        .eq('excluded_from_flow', false)
        .order('payment_date', { ascending: false })
        .limit(1);

      if (cashFlowId) {
        query = query.eq('cash_flow_id', cashFlowId);
      }

      const { data, error } = await query;

      if (error) throw error;
      const result = data && data.length > 0 ? data[0].flow_month : null;
      return SharedUtilities.createSuccessResponse(result);
    } catch (error) {
      console.error('Error fetching latest transaction month:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch latest transaction month');
    }
  }

  // ===== TRANSACTION CREATION =====
  
  static async createTransaction(transactionData, forceImport = false) {
    try {
      // Validate required fields
      if (!transactionData.user_id) {
        return SharedUtilities.createErrorResponse('User ID is required');
      }

      // Generate transaction hash for duplicate detection
      const transactionHash = this.generateTransactionHash(transactionData);
      
      // Check for duplicates unless forcing import
      if (!forceImport) {
        const exists = await this.checkTransactionExists(
          transactionData.user_id, 
          transactionHash, 
          transactionData.cash_flow_id
        );
        
        if (exists) {
          return SharedUtilities.createErrorResponse('Transaction already exists (duplicate detected)');
        }
      }

      // Prepare transaction data
      const processedData = {
        ...transactionData,
        transaction_hash: transactionHash,
        amount: SharedUtilities.validateAmount(transactionData.amount || 0),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Handle payment date processing
      if (processedData.payment_date) {
        const paymentDate = new Date(processedData.payment_date);
        if (!isNaN(paymentDate.getTime())) {
          processedData.payment_year = paymentDate.getFullYear();
          processedData.payment_month = paymentDate.getMonth() + 1;
        }
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert([processedData])
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Transaction created successfully');
    } catch (error) {
      console.error('Error creating transaction:', error);
      return SharedUtilities.handleSupabaseError(error, 'create transaction');
    }
  }

  // ===== TRANSACTION UPDATES =====

  static async updateTransaction(transactionId, updateData) {
    try {
      if (!transactionId) {
        return SharedUtilities.createErrorResponse('Transaction ID is required');
      }

      // Prepare update data
      const processedUpdateData = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      // Handle amount validation if provided
      if (processedUpdateData.amount !== undefined) {
        processedUpdateData.amount = SharedUtilities.validateAmount(processedUpdateData.amount);
      }

      // Handle payment date processing if provided
      if (processedUpdateData.payment_date) {
        const paymentDate = new Date(processedUpdateData.payment_date);
        if (!isNaN(paymentDate.getTime())) {
          processedUpdateData.payment_year = paymentDate.getFullYear();
          processedUpdateData.payment_month = paymentDate.getMonth() + 1;
        }
      }

      const { data, error } = await supabase
        .from('transactions')
        .update(processedUpdateData)
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Transaction updated successfully');
    } catch (error) {
      console.error('Error updating transaction:', error);
      return SharedUtilities.handleSupabaseError(error, 'update transaction');
    }
  }

  static async updateTransactionFlowMonth(transactionId, flowMonth, cashFlowId = null) {
    try {
      if (!transactionId || !flowMonth) {
        return SharedUtilities.createErrorResponse('Transaction ID and flow month are required');
      }

      const updateData = {
        flow_month: flowMonth,
        updated_at: new Date().toISOString()
      };

      if (cashFlowId) {
        updateData.cash_flow_id = cashFlowId;
      }

      const { data, error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Transaction flow month updated successfully');
    } catch (error) {
      console.error('Error updating transaction flow month:', error);
      return SharedUtilities.handleSupabaseError(error, 'update transaction flow month');
    }
  }

  // ===== TRANSACTION DELETION =====

  static async deleteTransaction(transactionId) {
    try {
      if (!transactionId) {
        return SharedUtilities.createErrorResponse('Transaction ID is required');
      }

      const { data, error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Transaction deleted successfully');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return SharedUtilities.handleSupabaseError(error, 'delete transaction');
    }
  }
}

module.exports = TransactionService;