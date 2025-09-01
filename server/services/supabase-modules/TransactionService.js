/**
 * Transaction Service for Supabase Operations
 * Extracted from supabaseService.js - Transaction management operations
 * ~800 lines - Handles all transaction-related database operations
 */

const { adminClient, createUserClient } = require('../../config/supabase');
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

  static async checkTransactionExists(userId, transactionHash, cashFlowId = null, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      let query = client
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

  static async getTransactionByHash(userId, transactionHash, cashFlowId = null, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      let query = client
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
  static async getTransactionsByHash(transactionHash, userId, cashFlowId = null, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      let query = client
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
  static async getExistingHashesBatch(userId, transactionHashes, cashFlowId = null, userClient = null) {
    try {
      if (!transactionHashes || transactionHashes.length === 0) {
        return [];
      }

      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      let query = client
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

  static async getTransactions(userId, filters = {}, page = 1, perPage = 100, userClient = null) {
    try {
      console.log('🔍 [TRANSACTION SERVICE] getTransactions called with userId:', userId);
      console.log('🔍 [TRANSACTION SERVICE] filters:', filters);
      SharedUtilities.validateUserId(userId);
      
      // Always use admin client with user filtering for RLS bypass
      const client = await SharedUtilities.createSecureClient(adminClient, userId);
      console.log('🔍 [TRANSACTION SERVICE] Using admin client for RLS bypass');

      // Load category order information first for sorting
      const categoryOrderQuery = await client
        .from('category_order')
        .select('category_name, display_order')
        .eq('user_id', userId);

      const categoryOrders = {};
      if (categoryOrderQuery.data) {
        categoryOrderQuery.data.forEach(cat => {
          categoryOrders[cat.category_name] = cat.display_order;
        });
      }

      let query = client
        .from('transactions')
        .select(`
          *,
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
      
      // Filter by category name using direct category_name field
      if (filters.category_name) {
        try {
          // Use direct category_name field filter for Hebrew support
          query = query.eq('category_name', filters.category_name);
          
          console.log(`Filtering transactions by category_name: "${filters.category_name}"`);
        } catch (error) {
          console.error('Error filtering by category name:', error);
          return SharedUtilities.handleSupabaseError(error, 'filter by category name');
        }
      }
      
      if (filters.no_category) {
        query = query.is('category_name', null);
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

      // Apply minimal sorting for consistency (we'll sort properly in code)
      query = query.order('created_at', { ascending: true });

      // NO PAGINATION at database level - we need all data to sort by custom category order

      const { data, error, count } = await query;
      
      console.log('🔍 [TRANSACTION SERVICE] Query result:');
      console.log('🔍 [TRANSACTION SERVICE] - Error:', error);
      console.log('🔍 [TRANSACTION SERVICE] - Data count:', data ? data.length : 'null');
      console.log('🔍 [TRANSACTION SERVICE] - Total count:', count);

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
          category_name: transaction.category?.name || transaction.category_name,
          category_display_order: categoryOrders[transaction.category_name] !== undefined ? categoryOrders[transaction.category_name] : 999
        };
      });

      // Sort by category display_order first, then by payment_date
      processedTransactions.sort((a, b) => {
        // First by category display order
        if (a.category_display_order !== b.category_display_order) {
          return a.category_display_order - b.category_display_order;
        }
        // Then by payment date
        const dateA = new Date(a.payment_date);
        const dateB = new Date(b.payment_date);
        if (dateA !== dateB) {
          return dateA - dateB;
        }
        // Finally by created_at
        return new Date(a.created_at) - new Date(b.created_at);
      });

      // Apply pagination AFTER sorting
      const totalCount = processedTransactions.length;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      const paginatedTransactions = processedTransactions.slice(start, end);

      return SharedUtilities.createSuccessResponse({
        data: paginatedTransactions,
        total_count: totalCount,
        transactions: paginatedTransactions, // For backward compatibility
        totalCount: totalCount // For backward compatibility
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch transactions');
    }
  }

  static async getTransactionById(transactionId, userClient = null) {
    try {
      if (!transactionId) {
        return SharedUtilities.createErrorResponse('Transaction ID is required');
      }
      const client = userClient || adminClient;
      
      console.log(`🔍 [GET BY ID] Searching for transaction ${transactionId} using ${userClient ? 'userClient' : 'adminClient'}`);

      const { data, error } = await client
        .from('transactions')
        .select(`
          *,
          cash_flows:cash_flow_id (
            name,
            currency
          )
        `)
        .eq('id', transactionId)
        .single();

      console.log(`🔍 [GET BY ID] Query result for ${transactionId}:`, {
        hasData: !!data,
        error: error?.message || null,
        errorCode: error?.code || null,
        dataUserId: data?.user_id
      });

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

  static async getLatestTransactionMonth(userId, cashFlowId = null, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      let query = client
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

  // ===== DUPLICATE CHAIN MANAGEMENT =====
  
  static async findLastDuplicateInChain(originalTransactionId, userClient = null) {
    try {
      // Find all transactions in the duplicate chain starting from the original
      const client = userClient || adminClient;
      const { data, error } = await client
        .from('transactions')
        .select('id, duplicate_parent_id, created_at')
        .or(`id.eq.${originalTransactionId},duplicate_parent_id.eq.${originalTransactionId}`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (!data || data.length === 0) return null;
      
      // Find the most recent transaction that has this original as its parent
      // or traverse the chain to find the last duplicate
      let currentId = originalTransactionId;
      let lastDuplicate = null;
      
      // Keep looking for duplicates that reference the current transaction
      while (true) {
        const duplicate = data.find(tx => tx.duplicate_parent_id === currentId);
        if (!duplicate) break;
        
        lastDuplicate = duplicate;
        currentId = duplicate.id;
      }
      
      return lastDuplicate;
    } catch (error) {
      console.error('Error finding last duplicate in chain:', error);
      return null;
    }
  }
  
  static async getNextDuplicateNumber(rootTransactionId, userClient = null) {
    try {
      // Count all duplicates in this chain by finding all transactions 
      // that have this root as their ultimate parent
      const client = userClient || adminClient;
      const { data, error } = await client
        .rpc('count_duplicate_chain', { root_transaction_id: rootTransactionId });
      
      if (error) {
        console.log('RPC function not available, using manual count');
        // Fallback: manual traversal
        const { data: allTransactions, error: fetchError } = await client
          .from('transactions')
          .select('id, duplicate_parent_id')
          .or(`id.eq.${rootTransactionId},duplicate_parent_id.eq.${rootTransactionId}`);
        
        if (fetchError) throw fetchError;
        
        // Count how many have this root as parent (directly or indirectly)
        let count = 0;
        const visited = new Set();
        const queue = [rootTransactionId];
        
        while (queue.length > 0) {
          const currentId = queue.shift();
          if (visited.has(currentId)) continue;
          visited.add(currentId);
          
          // Find all children of current transaction
          const children = allTransactions.filter(tx => tx.duplicate_parent_id === currentId);
          children.forEach(child => {
            if (!visited.has(child.id)) {
              queue.push(child.id);
              count++;
            }
          });
        }
        
        return count + 1; // Next duplicate number
      }
      
      return (data || 0) + 1; // Next duplicate number
    } catch (error) {
      console.error('Error getting next duplicate number:', error);
      return 1; // Default to first duplicate
    }
  }


  // ===== TRANSACTION CREATION =====
  
  static async createTransaction(transactionData, forceImport = false, userClient = null) {
    try {
      console.log(`[createTransaction] Received transaction with hash: ${transactionData.transaction_hash}. forceImport: ${forceImport}`);
      const client = userClient || adminClient;
      
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
        transactionData.cash_flow_id,
        client
      );

      // Check if we found an existing transaction (existingResult.success means we got data)
      if (existingResult && existingResult.success && existingResult.data) {
        if (forceImport) {
          console.log(`⚠️ Duplicate detected, but forceImport is true. Creating new duplicate with parent linkage`);
          
          // Find the most recent duplicate in the chain to link to
          const parentTransaction = await this.findLastDuplicateInChain(existingResult.data.id, client);
          const parentId = parentTransaction ? parentTransaction.id : existingResult.data.id;
          
          // Get the duplicate number for this chain
          const duplicateNumber = await this.getNextDuplicateNumber(parentId, client);
          
          console.log(`🔗 [DUPLICATE CREATE] Parent ID: ${parentId}, Duplicate number: ${duplicateNumber}`);
          
          // Add duplicate numbering to notes to ensure unique hash
          const originalNote = transactionData.notes ? `${transactionData.notes} ` : '';
          transactionData.notes = `${originalNote}כפילות ${duplicateNumber}`;
          console.log(`📝 [DUPLICATE CREATE] Added duplicate note: ${transactionData.notes}`);
          
          // Set the duplicate parent ID
          transactionData.duplicate_parent_id = parentId;
          
          // Regenerate the hash with the new note to ensure it's unique
          transactionData.transaction_hash = this.generateTransactionHash(transactionData);
          console.log(`🔑 [DUPLICATE CREATE] Generated new hash with duplicate note: ${transactionData.transaction_hash}`);

        } else {
          // It's a duplicate and we're not forcing, so return a duplicate error
          return {
            success: false,
            duplicate: true,
            existing: existingResult.data
          };
        }
      }

      // Use recipient name and notes as provided from file processing
      let finalRecipientName = transactionData.recipient_name;
      let finalNotes = transactionData.notes;
      
      // Extract recipient_name from notes if not already present
      if (!finalRecipientName && finalNotes) {
        const recipientMatch = finalNotes.match(/למי:\s*([^,\n\r]+)/);
        if (recipientMatch) {
          finalRecipientName = recipientMatch[1].trim();
          console.log(`🎯 [DB EXTRACTION] Extracted recipient_name from notes: "${finalRecipientName}"`);
        }
      }
      
      if (transactionData.recipient_name) {
        console.log(`👤 [MANUAL ENTRY] Using manually entered recipient_name: "${transactionData.recipient_name}"`);
      }

      // Prepare transaction data
      const processedData = {
        ...transactionData,
        transaction_hash: transactionData.transaction_hash,
        amount: SharedUtilities.validateAmount(transactionData.amount || 0),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Use manual or extracted recipient name
        recipient_name: finalRecipientName,
        notes: finalNotes
      };
      
      // Ensure the transaction has no manual ID - let Supabase generate it
      delete processedData.id;

      if (finalRecipientName) {
        console.log(`🎯 [TRANSACTION CREATION] Added recipient_name: "${finalRecipientName}"`);
        console.log(`🧹 [TRANSACTION CREATION] Final notes: "${finalNotes}"`);
      }

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

      // Add timeout and retry logic to prevent hanging
      const insertWithTimeout = async (retryCount = 0) => {
        const maxRetries = 3;
        const timeoutMs = 15000; // 15 seconds timeout
        
        try {
          console.log(`🔄 [DB INSERT] Attempt ${retryCount + 1}/${maxRetries + 1} for ${processedData.business_name}`);
          
          // Remove fields that don't exist in the database schema
          const cleanedData = { ...processedData };
          delete cleanedData.duplicateReason;
          delete cleanedData.hiddenBusinessName;
          delete cleanedData.id; // Ensure no null/undefined id gets through
          
          const insertPromise = client
            .from('transactions')
            .insert([cleanedData])
            .select()
            .single();
          
          // Create timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Database insert timeout')), timeoutMs);
          });
          
          // Race between insert and timeout
          return await Promise.race([insertPromise, timeoutPromise]);
          
        } catch (error) {
          console.error(`⚠️ [DB INSERT] Attempt ${retryCount + 1} failed:`, error.message);
          
          if (retryCount < maxRetries && (error.message.includes('timeout') || error.message.includes('network'))) {
            console.log(`🔄 [DB INSERT] Retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return insertWithTimeout(retryCount + 1);
          }
          
          throw error;
        }
      };

      const { data, error } = await insertWithTimeout();

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

  static async updateTransaction(transactionId, updateData, userClient = null) {
    try {
      if (!transactionId) {
        return SharedUtilities.createErrorResponse('Transaction ID is required');
      }
      const client = userClient || adminClient;

      // Use recipient name and notes as provided
      let finalRecipientName = updateData.recipient_name;
      let finalNotes = updateData.notes;
      
      // Extract recipient_name from notes if not already present
      if (!finalRecipientName && finalNotes) {
        const recipientMatch = finalNotes.match(/למי:\s*([^,\n\r]+)/);
        if (recipientMatch) {
          finalRecipientName = recipientMatch[1].trim();
          console.log(`🎯 [DB UPDATE EXTRACTION] Extracted recipient_name from notes: "${finalRecipientName}"`);
        }
      }
      
      if (updateData.recipient_name) {
        console.log(`👤 [UPDATE MANUAL] Using manually entered recipient_name: "${updateData.recipient_name}"`);
      }

      // Prepare update data
      const processedUpdateData = {
        ...updateData,
        recipient_name: finalRecipientName,
        notes: finalNotes,
        updated_at: new Date().toISOString()
      };
      
      if (finalRecipientName) {
        console.log(`🎯 [TRANSACTION UPDATE] Final recipient_name: "${finalRecipientName}"`);
      }

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

      const { data, error } = await client
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

  static async updateTransactionFlowMonth(transactionId, flowMonth, cashFlowId = null, userClient = null) {
    try {
      if (!transactionId || !flowMonth) {
        return SharedUtilities.createErrorResponse('Transaction ID and flow month are required');
      }
      const client = userClient || adminClient;

      const updateData = {
        flow_month: flowMonth,
        updated_at: new Date().toISOString()
      };

      if (cashFlowId) {
        updateData.cash_flow_id = cashFlowId;
      }

      const { data, error } = await client
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

  // Replace an existing transaction with new transaction data (for duplicate handling)
  static async replaceTransaction(originalTransactionId, newTransactionData, userClient = null) {
    try {
      if (!originalTransactionId) {
        return SharedUtilities.createErrorResponse('Original transaction ID is required');
      }
      const client = userClient || adminClient;

      // First, check if this transaction is a parent (has duplicates pointing to it)
      const { data: dependentTransactions, error: checkError } = await client
        .from('transactions')
        .select('id, duplicate_parent_id')
        .eq('duplicate_parent_id', originalTransactionId);

      if (checkError) {
        console.error('Error checking dependent transactions:', checkError);
      }

      const hasChildren = dependentTransactions && dependentTransactions.length > 0;
      
      if (hasChildren) {
        console.log(`⚠️ [REPLACE LOGIC] Transaction ${originalTransactionId} has ${dependentTransactions.length} child duplicates. Using smart replacement strategy.`);
        
        // Strategy: Find the most recent child duplicate and replace IT instead of the parent
        // This preserves the parent-child relationship structure
        const { data: childToReplace, error: childError } = await client
          .from('transactions')
          .select('*')
          .eq('duplicate_parent_id', originalTransactionId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (childError || !childToReplace) {
          console.log(`⚠️ [REPLACE FALLBACK] Could not find child to replace, will try direct update despite constraints`);
          // Fall through to original logic below
        } else {
          console.log(`🎯 [REPLACE STRATEGY] Replacing child duplicate ${childToReplace.id} instead of parent ${originalTransactionId}`);
          // Replace the child duplicate instead of the parent (recursive call)
          const recursiveResult = await this.replaceTransaction(childToReplace.id, newTransactionData, client);
          console.log(`🔄 [RECURSIVE REPLACE] Result from child replacement:`, recursiveResult);
          return recursiveResult;
        }
      }

      // Extract and prepare the new transaction data, excluding system fields
      const { tempId, originalIndex, isDuplicate, duplicateInfo, ...cleanData } = newTransactionData;
      
      // Use recipient name and notes as provided from file processing
      let finalRecipientName = cleanData.recipient_name;
      let finalNotes = cleanData.notes;
      
      // Extract recipient_name from notes if not already present
      if (!finalRecipientName && finalNotes) {
        const recipientMatch = finalNotes.match(/למי:\s*([^,\n\r]+)/);
        if (recipientMatch) {
          finalRecipientName = recipientMatch[1].trim();
          console.log(`🎯 [DB BULK UPDATE EXTRACTION] Extracted recipient_name from notes: "${finalRecipientName}"`);
        }
      }

      const updateData = {
        ...cleanData,
        recipient_name: finalRecipientName,
        notes: finalNotes,
        updated_at: new Date().toISOString()
      };

      // For replacement operations, ensure the hash is unique by regenerating it
      // This prevents unique constraint violations when replacing duplicates
      if (updateData.transaction_hash) {
        const newHash = this.generateTransactionHash(updateData);
        updateData.transaction_hash = newHash;
        console.log(`🔑 [REPLACE HASH] Generated new unique hash: ${newHash} (was: ${cleanData.transaction_hash})`);
      }

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      console.log(`🔄 [REPLACE TRANSACTION] Updating transaction ${originalTransactionId} with:`, updateData);

      const { data, error } = await client
        .from('transactions')
        .update(updateData)
        .eq('id', originalTransactionId)
        .select()
        .single();

      if (error) {
        // If we still get a foreign key constraint error, it means this is a parent that we can't modify
        if (error.code === '23503') {
          console.log(`🚫 [REPLACE ERROR] Cannot update parent transaction ${originalTransactionId} due to foreign key constraints`);
          return SharedUtilities.createErrorResponse('Cannot replace parent transaction that has duplicate children. Please try again or contact support.');
        }
        throw error;
      }
      
      console.log(`✅ [REPLACE TRANSACTION] Successfully replaced transaction ${originalTransactionId}`);
      return SharedUtilities.createSuccessResponse(data, 'Transaction replaced successfully');
    } catch (error) {
      console.error('Error replacing transaction:', error);
      return SharedUtilities.handleSupabaseError(error, 'replace transaction');
    }
  }

  // ===== TRANSACTION DELETION =====

  static async deleteTransaction(transactionId, userClient = null) {
    try {
      if (!transactionId) {
        return SharedUtilities.createErrorResponse('Transaction ID is required');
      }
      const client = userClient || adminClient;

      const { data, error } = await client
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