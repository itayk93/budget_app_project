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

  // Original method name for backward compatibility - returns array of transactions
  static async getTransactionsByHash(transactionHash, userId, cashFlowId = null) {
    try {
      SharedUtilities.validateUserId(userId);

      let query = supabase
        .from('transactions')
        .select(`
          *,
          categories (
            id,
            name,
            category_type,
            color
          )
        `)
        .eq('user_id', userId)
        .eq('transaction_hash', transactionHash);

      if (cashFlowId) {
        query = query.eq('cash_flow_id', cashFlowId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Process the data to include category name - return as array like original
      return (data || []).map(transaction => ({
        ...transaction,
        category_name: transaction.categories?.name || null
      }));
    } catch (error) {
      console.error('Error fetching transactions by hash:', error);
      return [];
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

      // Apply filters - use flow_month instead of payment_month/year for consistency
      if (filters.year && filters.month) {
        const flowMonth = `${filters.year}-${filters.month.toString().padStart(2, '0')}`;
        query = query.eq('flow_month', flowMonth);
      } else if (filters.flow_month) {
        query = query.eq('flow_month', filters.flow_month);
      }
      
      if (filters.cash_flow_id) {
        query = query.eq('cash_flow_id', filters.cash_flow_id);
      }
      
      if (filters.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      
      // Filter by category name - lookup category_id first then filter
      if (filters.category_name) {
        try {
          // First, find the category ID by name
          const { data: categoryData, error: categoryError } = await supabase
            .from('categories')
            .select('id')
            .eq('name', filters.category_name)
            .eq('user_id', userId)
            .single();
            
          if (categoryError || !categoryData) {
            console.warn(`Category with name "${filters.category_name}" not found`);
            return SharedUtilities.createSuccessResponse({
              data: [],
              total_count: 0,
              transactions: [],
              totalCount: 0
            });
          }
          
          // Filter by the found category_id
          query = query.eq('category_id', categoryData.id);
        } catch (error) {
          console.error('Error looking up category by name:', error);
          return SharedUtilities.handleSupabaseError(error, 'lookup category by name');
        }
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
      console.log(`[createTransaction] Received transaction with hash: ${transactionData.transaction_hash}. forceImport: ${forceImport}`);
      
      // Validate required fields
      if (!transactionData.user_id) {
        return { success: false, error: 'User ID is required' };
      }

      // Generate transaction hash for duplicate detection
      if (!transactionData.transaction_hash) {
        transactionData.transaction_hash = this.generateTransactionHash(transactionData);
        console.log(`[createTransaction] Generated new hash: ${transactionData.transaction_hash}`);
      }
      const transactionHash = transactionData.transaction_hash;
      
      // Check for duplicates using getTransactionByHash method
      console.log(`[createTransaction] Checking for existing transaction with hash: ${transactionHash}`);
      const existingResult = await this.getTransactionByHash(
        transactionData.user_id,
        transactionHash,
        transactionData.cash_flow_id
      );

      // Check if we found an existing transaction (existingResult.success means we got data)
      if (existingResult && existingResult.success && existingResult.data) {
        if (forceImport) {
          console.log(`⚠️ Duplicate detected, but forceImport is true. Creating new transaction with unique hash`);
          
          // If the note doesn't already contain duplicate information, add it
          if (!transactionData.notes || !transactionData.notes.includes('כפילות של עסקה')) {
            const originalTxId = existingResult.data.id;
            console.log(`🔄 [FORCE IMPORT] Original transaction ID: ${originalTxId}, business_name: ${existingResult.data.business_name}`);
            
            // Add a note to signify this is an intentional duplicate
            const originalNote = transactionData.notes ? `${transactionData.notes}\n` : '';
            transactionData.notes = `${originalNote}כפילות של עסקה ${originalTxId}`;
            console.log(`📝 [FORCE IMPORT] Added duplicate note: ${transactionData.notes}`);
          }
          
          // Regenerate the hash with the new note to ensure it's unique.
          transactionData.transaction_hash = this.generateTransactionHash(transactionData);
          console.log(`🔑 [FORCE IMPORT] Generated new hash with note: ${transactionData.transaction_hash}`);
          
          // Check if the new hash is also a duplicate and make it unique if needed
          let attempt = 1;
          let newHash = transactionData.transaction_hash;
          while (true) {
            const existingWithNewHash = await this.getTransactionByHash(
              transactionData.user_id,
              newHash,
              transactionData.cash_flow_id
            );
            
            if (!existingWithNewHash || !existingWithNewHash.success || !existingWithNewHash.data) {
              // Hash is unique, use it
              transactionData.transaction_hash = newHash;
              console.log(`✅ [FORCE IMPORT] Found unique hash after ${attempt} attempts: ${newHash}`);
              break;
            }
            
            // Hash is still a duplicate, add attempt number to make it unique
            attempt++;
            const baseNote = transactionData.notes.replace(/ \(\d+\)$/, ''); // Remove any existing attempt number
            transactionData.notes = `${baseNote} (${attempt})`;
            newHash = this.generateTransactionHash(transactionData);
            console.log(`🔄 [FORCE IMPORT] Attempt ${attempt}, new hash: ${newHash}`);
            
            // Safety check to prevent infinite loop
            if (attempt > 10) {
              // Add timestamp to make it truly unique
              transactionData.notes = `${baseNote} (${Date.now()})`;
              transactionData.transaction_hash = this.generateTransactionHash(transactionData);
              console.log(`🛑 [FORCE IMPORT] Using timestamp fallback: ${transactionData.transaction_hash}`);
              break;
            }
          }

        } else {
          // It's a duplicate and we're not forcing, so return a duplicate error
          return {
            success: false,
            duplicate: true,
            existing: existingResult.data
          };
        }
      }

      // Prepare transaction data
      const processedData = {
        ...transactionData,
        transaction_hash: transactionData.transaction_hash,
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
          // Set flow_month if not already present
          if (!processedData.flow_month) {
            processedData.flow_month = `${processedData.payment_year}-${String(processedData.payment_month).padStart(2, '0')}`;
          }
        }
      }

      // Ensure amount is a number
      if (typeof processedData.amount === 'string') {
        processedData.amount = parseFloat(processedData.amount.replace(/,/g, '').trim());
      }
      if (isNaN(processedData.amount) || !isFinite(processedData.amount)) {
        return { success: false, error: 'Invalid amount: must be a valid number' };
      }

      // Set default values
      processedData.currency = processedData.currency || 'ILS';
      processedData.source_type = processedData.source_type || 'manual';

      console.log(`📤 [DB INSERT] Attempting to insert transaction:`, {
        id: processedData.id,
        business_name: processedData.business_name,
        transaction_hash: processedData.transaction_hash,
        amount: processedData.amount
      });

      const { data, error } = await supabase
        .from('transactions')
        .insert([processedData])
        .select()
        .single();

      if (error) {
        console.error(`❌ [DB INSERT ERROR] Failed to insert transaction:`, error);
        if (error.message.includes('unique constraint')) {
          return { success: false, duplicate: true, error: 'Duplicate transaction' };
        }
        return { success: false, error: error.message };
      }

      console.log(`✅ [DB INSERT SUCCESS] Transaction inserted successfully:`, {
        id: data.id,
        business_name: data.business_name,
        created_at: data.created_at
      });

      console.log(`✅ [CREATE SUCCESS] Transaction created with ID: ${data.id}, business_name: ${data.business_name}, hash: ${data.transaction_hash}`);

      // Return the original format expected by ExcelService
      return {
        success: true,
        transaction_id: data.id,
        data: data
      };
      
    } catch (error) {
      console.error('Error creating transaction:', error);
      if (error.message.includes('unique constraint')) {
        return { success: false, duplicate: true, error: 'Duplicate transaction' };
      }
      if (error.message.includes('Invalid amount')) {
        return { success: false, invalid_amount: true, error: 'Invalid amount data' };
      }
      return { success: false, error: error.message };
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