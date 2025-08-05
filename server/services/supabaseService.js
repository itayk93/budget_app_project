const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Currency utilities mapping
const CURRENCY_SYMBOL_MAP = {
  'ILS': '₪',  // Israeli Shekel
  'USD': '$',  // US Dollar
  'EUR': '€',  // Euro
  'GBP': '£',  // British Pound
  'JPY': '¥',  // Japanese Yen
  'INR': '₹',  // Indian Rupee
  'KRW': '₩',  // Korean Won
};

class SupabaseService {
  // ===== UTILITY METHODS =====

  static async testConnection() {
    try {
      // Simple test query
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      
      if (error) {
        console.error('Supabase connection test failed:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Supabase connection test error:', error);
      return false;
    }
  }
  
  static getCurrencySymbol(currencyCode) {
    if (!currencyCode) {
      return CURRENCY_SYMBOL_MAP['ILS'] || '₪';
    }
    return CURRENCY_SYMBOL_MAP[currencyCode.toUpperCase()] || currencyCode;
  }

  static formatCurrency(amount, currencyCode = 'ILS', includeCode = false) {
    if (amount === null || amount === undefined) {
      amount = 0;
    }
    
    try {
      amount = parseFloat(amount);
      const symbol = this.getCurrencySymbol(currencyCode);
      
      let formatted;
      if (currencyCode === 'ILS') {
        formatted = `${amount.toFixed(2)} ${symbol}`;
      } else if (['JPY', 'KRW'].includes(currencyCode)) {
        formatted = `${symbol}${Math.round(amount).toLocaleString()}`;
      } else {
        formatted = `${symbol}${amount.toFixed(2)}`;
      }
      
      if (includeCode && currencyCode) {
        formatted = `${formatted} (${currencyCode})`;
      }
      
      return formatted;
    } catch (error) {
      console.error('Error formatting currency:', error);
      return `${amount} ${this.getCurrencySymbol(currencyCode)}`;
    }
  }

  static getCategoryColor(categoryName) {
    const colorMap = {
      'הכנסות': '#4CAF50',      // Green for income
      'משכורת': '#4CAF50',
      'קבועות': '#9C27B0',      // Purple for fixed expenses
      'תשלומים': '#9C27B0',
      'חיסכון': '#FFEB3B',      // Yellow for savings
      'השקעות': '#FFEB3B',
      'משתנות': '#2196F3',      // Blue for variable expenses
      'default': '#2196F3'       // Default blue
    };
    
    for (const [key, color] of Object.entries(colorMap)) {
      if (categoryName.includes(key)) {
        return color;
      }
    }
    
    return colorMap.default;
  }

  // ===== USER MANAGEMENT =====
  
  static async createUser(userData) {
    try {
      const { username, email, password, firstName, lastName } = userData;
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      
      const { data, error } = await supabase
        .from('users')
        .insert([{
          username,
          email,
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  static async getUserByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error fetching user by email ${email}:`, error);
      return null;
    }
  }

  static async getUserByUsername(username) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error fetching user by username ${username}:`, error);
      return null;
    }
  }

  static async getUserById(id) {
    try {
      // Validate UUID format
      if (!id || typeof id !== 'string') {
        console.error(`❌ Invalid user ID format: ${id} (type: ${typeof id})`);
        return null;
      }
      
      // Basic UUID format check (36 characters with hyphens)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        console.error(`❌ Invalid UUID format for user ID: ${id}`);
        return null;
      }

      console.log(`🔍 Looking up user with valid UUID: ${id}`);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      console.log(`👤 User lookup result:`, data ? 'Found' : 'Not found');
      return data;
    } catch (error) {
      console.error(`❌ Error fetching user by ID ${id}:`, error);
      return null;
    }
  }

  static async updateUserLastLogin(userId) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to update last login:', error.message);
      return false;
    }
  }

  static async updateUser(userId, updateData) {
    try {
      if (updateData.password) {
        updateData.password_hash = await bcrypt.hash(updateData.password, 10);
        delete updateData.password;
      }
      
      updateData.updated_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error updating user ${userId}:`, error);
      return null;
    }
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    // Check if it's a Flask/Werkzeug scrypt hash
    if (hashedPassword.startsWith('scrypt:')) {
      return await this.verifyFlaskPassword(plainPassword, hashedPassword);
    }
    
    // Otherwise use bcrypt
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async verifyFlaskPassword(plainPassword, hashedPassword) {
    // Flask/Werkzeug uses format: scrypt:32768:8:1$salt$hash
    try {
      console.log('🔍 Verifying Flask password format');
      console.log('   Hash:', hashedPassword.substring(0, 50) + '...');
      
      const parts = hashedPassword.split('$');
      if (parts.length !== 3) {
        console.log('❌ Invalid hash format - not 3 parts');
        return false;
      }
      
      const [method, salt, expectedHash] = parts;
      const [algorithm, N, r, p] = method.split(':');
      
      console.log('   Algorithm:', algorithm);
      console.log('   N:', N, 'r:', r, 'p:', p);
      console.log('   Salt:', salt);
      
      if (algorithm !== 'scrypt') {
        console.log('❌ Not scrypt algorithm');
        return false;
      }
      
      // Use exact parameters from Flask
      const scryptParams = {
        N: parseInt(N),
        r: parseInt(r), 
        p: parseInt(p),
        maxmem: 128 * 1024 * 1024 // 128MB memory limit
      };
      
      console.log('   Using params:', scryptParams);
      
      // Generate hash with same parameters as Flask/Werkzeug
      const derivedKey = crypto.scryptSync(
        plainPassword,
        salt,
        64, // key length (Flask uses 64 bytes)
        scryptParams
      );
      
      const derivedHex = derivedKey.toString('hex');
      console.log('   Expected hash:', expectedHash.substring(0, 20) + '...');
      console.log('   Derived hash: ', derivedHex.substring(0, 20) + '...');
      console.log('   Match:', derivedHex === expectedHash ? 'YES' : 'NO');
      
      return derivedHex === expectedHash;
    } catch (error) {
      console.error('❌ Flask password verification error:', error.message);
      return false;
    }
  }

  // ===== CATEGORIES MANAGEMENT =====
  
  static async getCategories(userId = null) {
    try {
      // Initialize category order if user is provided
      if (userId) {
        await this.initializeCategoryOrder(userId);
      }

      let query = supabase
        .from('category')
        .select('*');

      if (userId) {
        // Get categories for specific user
        query = query.eq('user_id', userId);
      }

      const { data: categories, error } = await query.order('name');

      if (error) throw error;

      // Ensure each category has required fields
      const processedCategories = categories.map(category => ({
        ...category,
        category_type: category.category_type || 'variable_expense',
        color: category.color || this.getCategoryColor(category.name),
        is_default: category.is_default || false
      }));

      // Apply user's preferred category order if user_id is provided
      if (userId) {
        const preferredOrder = await this.getUserCategoryOrder(userId);
        if (preferredOrder && preferredOrder.length > 0) {
          const categoryMap = {};
          processedCategories.forEach(cat => {
            categoryMap[cat.name] = cat;
          });

          const orderedCategories = [];
          
          // Add categories in the preferred order first
          preferredOrder.forEach(orderItem => {
            if (categoryMap[orderItem.category_name]) {
              orderedCategories.push(categoryMap[orderItem.category_name]);
            }
          });
          
          // Then add any remaining categories
          processedCategories.forEach(cat => {
            if (!preferredOrder.some(item => item.category_name === cat.name)) {
              orderedCategories.push(cat);
            }
          });
          
          return orderedCategories;
        }
      }

      return processedCategories;
    } catch (error) {
      console.error('Error fetching categories:', error);
      
      // Fallback categories if database fetch fails
      return [
        { id: 'variable_expenses', name: 'הוצאות משתנות', category_type: 'variable_expense', color: '#2196F3' },
        { id: 'fixed_expenses', name: 'הוצאות קבועות', category_type: 'fixed_expense', color: '#9C27B0' },
        { id: 'income', name: 'הכנסות', category_type: 'income', color: '#4CAF50' }
      ];
    }
  }

  static async getUserCategoryOrder(userId) {
    try {
      const { data, error } = await supabase
        .from('category_order')
        .select('*')
        .eq('user_id', userId)
        .order('display_order');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting category order:', error);
      return [];
    }
  }

  static async initializeCategoryOrder(userId) {
    try {
      // Check if user already has category order
      const existingOrder = await this.getUserCategoryOrder(userId);
      if (existingOrder.length > 0) {
        return true;
      }

      // Get all available categories
      const categories = await this.getCategories();
      
      // Initialize order for each category
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        await supabase
          .from('category_order')
          .insert({
            user_id: userId,
            category_id: category.id,
            display_order: i,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      return true;
    } catch (error) {
      console.error('Error initializing category order:', error);
      return false;
    }
  }

  // ===== CASH FLOWS MANAGEMENT =====
  
  static async getCashFlows(userId) {
    try {
      const { data, error } = await supabase
        .from('cash_flows')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching cash flows:', error);
      return [];
    }
  }

  static async getCashFlow(cashFlowId) {
    try {
      const { data, error } = await supabase
        .from('cash_flows')
        .select('*')
        .eq('id', cashFlowId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching cash flow:', error);
      return null;
    }
  }

  static async createCashFlow(cashFlowData) {
    try {
      const { data, error } = await supabase
        .from('cash_flows')
        .insert([{
          ...cashFlowData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating cash flow:', error);
      return null;
    }
  }

  static async updateCashFlow(cashFlowId, cashFlowData) {
    try {
      const { data, error } = await supabase
        .from('cash_flows')
        .update({
          ...cashFlowData,
          updated_at: new Date().toISOString()
        })
        .eq('id', cashFlowId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating cash flow:', error);
      return null;
    }
  }

  static async deleteCashFlow(cashFlowId) {
    try {
      // First delete all associated transactions
      await supabase
        .from('transactions')
        .delete()
        .eq('cash_flow_id', cashFlowId);

      // Then delete the cash flow
      const { error } = await supabase
        .from('cash_flows')
        .delete()
        .eq('id', cashFlowId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting cash flow:', error);
      return false;
    }
  }

  static async getDefaultCashFlow(userId) {
    try {
      // First try to get the default cash flow
      const { data, error } = await supabase
        .from('cash_flows')
        .select('*')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

      if (data) return data;

      // If no default, get the first cash flow
      const { data: firstCashFlow, error: firstError } = await supabase
        .from('cash_flows')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (firstError && firstError.code !== 'PGRST116') throw firstError;
      return firstCashFlow;
    } catch (error) {
      console.error('Error fetching default cash flow:', error);
      return null;
    }
  }

  // ===== TRANSACTION HASH AND DUPLICATE DETECTION =====
  
  static generateTransactionHash(transaction) {
    try {
      // Format the payment date first if needed - exactly like Flask version
      let payment_date = transaction.payment_date || "";
      if (payment_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(payment_date))) {
        // Try to parse and format date properly
        const date = new Date(payment_date);
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

  static async checkTransactionExists(userId, transactionHash, cashFlowId = null) {
    try {
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
      return (data && data.length > 0) ? data[0] : null;
    } catch (error) {
      console.error('Error fetching transaction by hash:', error);
      return null;
    }
  }

  // Batch check for existing transaction hashes - much faster than individual queries
  static async getExistingHashesBatch(userId, transactionHashes, cashFlowId = null) {
    try {
      if (!transactionHashes || transactionHashes.length === 0) {
        return [];
      }

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
      console.error('Error fetching existing hashes batch:', error);
      return [];
    }
  }

  // Batch fetch full transaction details by hashes - for duplicate review
  static async getTransactionsByHashes(userId, transactionHashes, cashFlowId = null) {
    try {
      if (!transactionHashes || transactionHashes.length === 0) {
        return [];
      }

      let query = supabase
        .from('transactions')
        .select(`
          id, flow_month, business_name, payment_method, payment_identifier,
          payment_date, payment_month, payment_year, charge_date, amount, currency,
          payment_number, total_payments, category_name, excluded_from_flow, notes,
          source_type, original_amount, transaction_hash, user_id, cash_flow_id,
          created_at, updated_at
        `)
        .eq('user_id', userId)
        .in('transaction_hash', transactionHashes);

      if (cashFlowId) {
        query = query.eq('cash_flow_id', cashFlowId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching transactions by hashes:', error);
      return [];
    }
  }

  static async getTransactionsByHash(transactionHash, userId, cashFlowId = null) {
    try {
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
      
      // Process the data to include category name
      return (data || []).map(transaction => ({
        ...transaction,
        category_name: transaction.categories?.name || null
      }));
    } catch (error) {
      console.error('Error fetching transactions by hash:', error);
      return [];
    }
  }

  // ===== TRANSACTIONS MANAGEMENT =====
  
  static async getTransactions(userId, filters = {}, page = 1, perPage = 100) {
    try {
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
        const currencySymbol = this.getCurrencySymbol(currency);
        const amount = parseFloat(transaction.amount || 0);
        
        return {
          ...transaction,
          currency,
          currency_symbol: currencySymbol,
          formatted_amount: this.formatCurrency(amount, currency),
          category_name: transaction.category?.name || transaction.category_name
        };
      });

      return {
        data: processedTransactions,
        total_count: count || 0,
        transactions: processedTransactions, // For backward compatibility
        totalCount: count || 0 // For backward compatibility
      };
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return { transactions: [], totalCount: 0 };
    }
  }

  static async getTransactionById(transactionId) {
    try {
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
      
      return data;
    } catch (error) {
      console.error('Error fetching transaction by ID:', error);
      return null;
    }
  }

  static async getLatestTransactionMonth(userId, cashFlowId = null) {
    try {
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
      return data && data.length > 0 ? data[0].flow_month : null;
    } catch (error) {
      console.error('Error fetching latest transaction month:', error);
      return null;
    }
  }

  static async createTransactionsBatch(transactions, forceImport = false) {
    try {
      if (!transactions || transactions.length === 0) {
        return { success: true, imported: 0, duplicates: 0, errors: 0 };
      }

      const userId = transactions[0].user_id;
      const cashFlowId = transactions[0].cash_flow_id;

      // Batch check for duplicates
      let transactionsToInsert = transactions;
      if (!forceImport) {
        const hashes = transactions.map(t => t.transaction_hash).filter(Boolean);
        const existingHashes = await this.getExistingHashesBatch(userId, hashes, cashFlowId);
        const existingHashesSet = new Set(existingHashes);
        
        transactionsToInsert = transactions.filter(t => !existingHashesSet.has(t.transaction_hash));
      }

      if (transactionsToInsert.length === 0) {
        return { success: true, imported: 0, duplicates: transactions.length, errors: 0 };
      }

      // Prepare transactions for insertion
      const currentTimestamp = new Date().toISOString();
      const transactionsForDB = transactionsToInsert.map(transaction => {
        const { forceImport: _, ...transactionForDB } = transaction;
        transactionForDB.created_at = currentTimestamp;
        transactionForDB.updated_at = currentTimestamp;
        
        // Explicitly ensure source_category is preserved
        if (transaction.source_category !== undefined) {
          transactionForDB.source_category = transaction.source_category;
        }
        
        // Debug each transaction's source_category
        console.log(`🔍 [BATCH DEBUG] Transaction ${transactionForDB.business_name}:`, {
          original_source_category: transaction.source_category,
          final_source_category: transactionForDB.source_category,
          has_source_category: transaction.hasOwnProperty('source_category')
        });
        
        return transactionForDB;
      });

      // Log source_category debug info for first transaction in batch
      if (transactionsForDB.length > 0) {
        console.log(`📤 [BATCH INSERT] First transaction source_category: "${transactionsForDB[0].source_category}"`);
        console.log(`📤 [BATCH INSERT] All source_category values:`, transactionsForDB.map(t => ({ business_name: t.business_name, source_category: t.source_category })));
      }

      // Batch insert
      const { data, error } = await supabase
        .from('transactions')
        .insert(transactionsForDB)
        .select();

      if (error) throw error;

      return {
        success: true,
        imported: data.length,
        duplicates: transactions.length - data.length,
        errors: 0,
        data: data
      };
    } catch (error) {
      console.error('Error creating transactions batch:', error);
      return { success: false, error: error.message, imported: 0, duplicates: 0, errors: transactions.length };
    }
  }

  static async createTransaction(transactionData, forceImport = false) {
    try {
      console.log(`[createTransaction] Received transaction with hash: ${transactionData.transaction_hash}. forceImport: ${forceImport}`)
      // Generate transaction hash for duplicate detection
      if (!transactionData.transaction_hash) {
        transactionData.transaction_hash = this.generateTransactionHash(transactionData);
        console.log(`[createTransaction] Generated new hash: ${transactionData.transaction_hash}`);
      }

      // Check for duplicates using the correct function and parameter order
      console.log(`[createTransaction] Checking for existing transaction with hash: ${transactionData.transaction_hash}`);
      const existingTx = await this.getTransactionsByHash(
        transactionData.transaction_hash,
        transactionData.user_id,
        transactionData.cash_flow_id
      );

      if (existingTx && existingTx.length > 0) {
        if (forceImport) {
          console.log(`⚠️ Duplicate detected, but forceImport is true. Creating new transaction with unique hash`);
          
          // If the note doesn't already contain duplicate information, add it
          if (!transactionData.notes || !transactionData.notes.includes('כפילות של עסקה')) {
            const originalTxId = existingTx[0].id;
            console.log(`🔄 [FORCE IMPORT] Original transaction ID: ${originalTxId}, business_name: ${existingTx[0].business_name}`);
            
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
            const existingWithNewHash = await this.getTransactionsByHash(
              newHash,
              transactionData.user_id,
              transactionData.cash_flow_id
            );
            
            if (!existingWithNewHash || existingWithNewHash.length === 0) {
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
            existing: existingTx[0]
          };
        }
      }

      // Process dates
      if (transactionData.payment_date) {
        const paymentDate = new Date(transactionData.payment_date);
        transactionData.payment_month = paymentDate.getMonth() + 1;
        transactionData.payment_year = paymentDate.getFullYear();
        if (!transactionData.flow_month) {
          transactionData.flow_month = `${transactionData.payment_year}-${String(transactionData.payment_month).padStart(2, '0')}`;
        }
      }

      // Ensure amount is a number
      if (typeof transactionData.amount === 'string') {
        transactionData.amount = parseFloat(transactionData.amount.replace(/,/g, '').trim());
      }
      if (isNaN(transactionData.amount) || !isFinite(transactionData.amount)) {
        throw new Error('Invalid amount: must be a valid number');
      }

      // Generate unique ID for the transaction
      const { v4: uuidv4 } = require('uuid');
      if (!transactionData.id) {
        transactionData.id = uuidv4();
      }

      // Set default values
      transactionData.currency = transactionData.currency || 'ILS';
      transactionData.source_type = transactionData.source_type || 'manual';
      transactionData.created_at = new Date().toISOString();
      transactionData.updated_at = new Date().toISOString();

      // Remove the forceImport flag before inserting to database
      const { forceImport: _, ...dataForDB } = transactionData;
      
      // Ensure source_category is explicitly included even if undefined
      if (transactionData.source_category) {
        dataForDB.source_category = transactionData.source_category;
      } else if (!dataForDB.hasOwnProperty('source_category')) {
        dataForDB.source_category = null;
      }

      console.log(`📤 [DB INSERT] Attempting to insert transaction:`, {
        id: dataForDB.id,
        business_name: dataForDB.business_name,
        transaction_hash: dataForDB.transaction_hash,
        source_category: dataForDB.source_category,
        notes: dataForDB.notes?.substring(0, 100) + '...'
      });
      
      console.log(`🔍 [INDIVIDUAL INSERT DEBUG] Full transaction data keys:`, Object.keys(dataForDB));
      console.log(`🔍 [INDIVIDUAL INSERT DEBUG] source_category type:`, typeof dataForDB.source_category);
      console.log(`🔍 [INDIVIDUAL INSERT DEBUG] source_category value:`, dataForDB.source_category);
      
      // Additional debug for source_category
      if (dataForDB.source_category) {
        console.log(`✅ [DB INSERT] source_category found: "${dataForDB.source_category}"`);
      } else {
        console.log(`❌ [DB INSERT] source_category is missing/null`);
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert([dataForDB])
        .select()
        .single();

      if (error) {
        console.error(`❌ [DB INSERT ERROR] Failed to insert transaction:`, error);
        throw error;
      }

      console.log(`✅ [DB INSERT SUCCESS] Transaction inserted successfully:`, {
        id: data.id,
        business_name: data.business_name,
        created_at: data.created_at
      });

      console.log(`✅ [CREATE SUCCESS] Transaction created with ID: ${data.id}, business_name: ${data.business_name}, hash: ${data.transaction_hash}`);

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

  static async updateTransaction(transactionId, updateData) {
    try {
      // If category_id is being updated, ensure category_name is also set
      if (updateData.category_id) {
        const categories = await this.getCategories();
        const matchingCategory = categories.find(cat => cat.id === updateData.category_id);
        
        if (matchingCategory) {
          updateData.category_name = matchingCategory.name;
        } else {
          updateData.category_name = 'הוצאות משתנות';
        }
      }

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating transaction:', error);
      return null;
    }
  }

  static async deleteTransaction(transactionId) {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return false;
    }
  }

  static async updateTransactionFlowMonth(transactionId, flowMonth, cashFlowId = null) {
    try {
      // Validate flow_month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(flowMonth)) {
        throw new Error('Invalid flow_month format. Should be YYYY-MM');
      }

      const [year, month] = flowMonth.split('-').map(Number);
      
      const updateData = {
        flow_month: flowMonth,
        payment_month: month,
        payment_year: year,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transactionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating transaction flow month:', error);
      return false;
    }
  }

  // ===== DASHBOARD DATA METHODS =====
  
  static async getDashboardData(userId, options = {}) {
    try {
      const {
        flowMonth = null,
        cashFlowId = null,
        allTime = false,
        year = null,
        month = null
      } = options;

      let filters = { cash_flow_id: cashFlowId };
      let transactions = [];

      if (allTime) {
        // Get all transactions for the cash flow
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .eq('cash_flow_id', cashFlowId)
          .order('payment_date', { ascending: false });

        if (error) throw error;
        transactions = data || [];
      } else {
        // Get transactions for specific month with pagination
        let finalFlowMonth = flowMonth;
        if (!finalFlowMonth && year && month) {
          finalFlowMonth = `${year}-${month.toString().padStart(2, '0')}`;
        }
        if (!finalFlowMonth) {
          const now = new Date();
          finalFlowMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        }

        filters.flow_month = finalFlowMonth;

        // Get all transactions with pagination
        let allTransactions = [];
        let currentPage = 1;
        const perPage = 100;

        while (true) {
          const transactionResult = await this.getTransactions(
            userId,
            filters,
            currentPage,
            perPage
          );
          
          const pageTransactions = transactionResult.data || [];
          allTransactions.push(...pageTransactions);

          if (pageTransactions.length < perPage || 
              allTransactions.length >= (transactionResult.total_count || 0)) {
            break;
          }

          currentPage++;
        }

        transactions = allTransactions;
      }

      // Process transactions by category
      const processedData = await this.processTransactionsByCategory(
        transactions, 
        flowMonth, 
        userId
      );

      // Group categories by shared category
      const groupedData = await this.groupCategoriesByShared(processedData, userId);

      // Calculate summary
      const summary = this.calculateSummary(groupedData, 0);
      groupedData.summary = summary;

      return {
        success: true,
        data: groupedData,
        flow_month: filters.flow_month,
        cash_flow_id: cashFlowId,
        transaction_count: transactions.length
      };

    } catch (error) {
      console.error('Error getting dashboard data:', error);
      return {
        success: false,
        error: error.message,
        data: {
          categories: {},
          not_in_cashflow: { transactions: [], total: 0 },
          summary: {
            income: 0,
            expenses: 0,
            balance: 0,
            savings: 0,
            total_income: 0,
            total_expenses: 0,
            monthly_goal: 3000
          }
        }
      };
    }
  }

  // ===== BUDGET MANAGEMENT =====
  
  static async getMonthlyBudgets(userId, year, month) {
    try {
      const { data, error } = await supabase
        .from('monthly_budget')
        .select(`
          *,
          category:category_id (
            id,
            name,
            category_type,
            color
          )
        `)
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching monthly budgets:', error);
      return [];
    }
  }

  static async createMonthlyBudget(budgetData) {
    try {
      const { data, error } = await supabase
        .from('monthly_budget')
        .insert([{
          ...budgetData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating monthly budget:', error);
      return null;
    }
  }

  static async updateMonthlyBudget(budgetId, updateData) {
    try {
      const { data, error } = await supabase
        .from('monthly_budget')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', budgetId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating monthly budget:', error);
      return null;
    }
  }

  // ===== USER PREFERENCES =====
  
  static async getUserPreference(userId, preferenceKey) {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', userId)
        .eq('preference_key', preferenceKey)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? JSON.parse(data.preference_value) : null;
    } catch (error) {
      console.error('Error getting user preference:', error);
      return null;
    }
  }

  static async setUserPreference(userId, preferenceKey, preferenceValue) {
    try {
      const value = JSON.stringify(preferenceValue);
      
      const { data, error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          preference_key: preferenceKey,
          preference_value: value,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error setting user preference:', error);
      return null;
    }
  }

  // ===== CATEGORY ORDER MANAGEMENT =====
  
  static async saveCategoryOrder(userId, categoryOrder) {
    try {
      // Delete existing order
      await supabase
        .from('category_order')
        .delete()
        .eq('user_id', userId);

      // Insert new order
      const orderData = categoryOrder.map((categoryName, index) => ({
        user_id: userId,
        category_name: categoryName,
        display_order: index,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('category_order')
        .insert(orderData);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving category order:', error);
      return false;
    }
  }

  static async reorderCategory(userId, categoryId, direction) {
    try {
      const currentOrder = await this.getUserCategoryOrder(userId);
      if (!currentOrder.length) return false;

      const currentIndex = currentOrder.findIndex(item => item.category_id === categoryId);
      if (currentIndex === -1) return false;

      let newIndex;
      if (direction === 'up' && currentIndex > 0) {
        newIndex = currentIndex - 1;
      } else if (direction === 'down' && currentIndex < currentOrder.length - 1) {
        newIndex = currentIndex + 1;
      } else {
        return false;
      }

      // Swap positions
      [currentOrder[currentIndex], currentOrder[newIndex]] = [currentOrder[newIndex], currentOrder[currentIndex]];

      // Update database
      for (let i = 0; i < currentOrder.length; i++) {
        await supabase
          .from('category_order')
          .update({ 
            display_order: i,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('category_id', currentOrder[i].category_id);
      }

      return true;
    } catch (error) {
      console.error('Error reordering category:', error);
      return false;
    }
  }

  // ===== UTILITY VALIDATION =====
  
  static validateFlowMonth(flowMonth) {
    if (!flowMonth || typeof flowMonth !== 'string') {
      return false;
    }
    
    const parts = flowMonth.split('-');
    if (parts.length !== 2) {
      return false;
    }
    
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    
    if (year < 1900 || year > 2100) {
      return false;
    }
    
    if (month < 1 || month > 12) {
      return false;
    }
    
    return true;
  }

  // ===== HEBREW MONTHS =====
  
  static getHebrewMonthName(month) {
    const hebrewMonths = {
      1: 'ינואר',
      2: 'פברואר', 
      3: 'מרץ',
      4: 'אפריל',
      5: 'מאי',
      6: 'יוני',
      7: 'יולי',
      8: 'אוגוסט',
      9: 'ספטמבר',
      10: 'אוקטובר',
      11: 'נובמבר',
      12: 'דצמבר'
    };
    return hebrewMonths[month] || month.toString();
  }

  // ===== DASHBOARD CALCULATIONS =====
  
  static calculateSummary(cashflowData, monthlySavings = 0) {
    const summary = {
      income: { total: 0, spent: 0, remaining: 0, progress: 0 },
      variable_expenses: {
        total: 0,
        spent: 0,
        remaining: 0,
        progress: 0,
        budget: 0
      },
      fixed_expenses: { total: 0, spent: 0, remaining: 0, progress: 0 },
      savings: { total: 0, spent: 0, remaining: 0, progress: 0 },
      total_income: 0,
      total_expenses: 0,
      monthly_goal: 3000,
      balance: 0,
      monthly_savings: monthlySavings
    };

    // First pass: handle all categories according to the budget rules
    for (const [categoryName, category] of Object.entries(cashflowData.categories || {})) {
      const amount = category.spent || 0;
      const budget = category.budget || 0;
      const isNonCashflow = category.is_non_cashflow || categoryName.includes('לא תזרימיות');

      if (isNonCashflow) {
        continue;
      }

      // Income handling: Use actual income if it exceeds budget
      if (amount > 0 || categoryName.includes('הכנסות')) {
        // For income, use the higher of actual income or budget
        const amountForCalculation = amount > 0 ? Math.max(amount, budget) : amount;
        summary.income.spent += amount; // Keep actual spent for display
        summary.total_income += amountForCalculation; // Use calculated amount for balance
      }
      // Expense handling: Use budget amount if available, otherwise use actual spending
      else {
        const absAmount = Math.abs(amount);
        // For expenses, use budget if it exists, otherwise use actual spending
        const amountForCalculation = budget > 0 ? budget : absAmount;
        summary.total_expenses += amountForCalculation;

        // Update specific expense categories
        if (categoryName === 'הוצאות משתנות') {
          summary.variable_expenses.spent += absAmount;
          summary.variable_expenses.budget = budget;
          summary.variable_expenses.remaining = budget - absAmount;
        } else if (categoryName.includes('קבועות')) {
          summary.fixed_expenses.spent += absAmount;
        } else if (categoryName.includes('חסכון') || categoryName.includes('חסכונות') || categoryName.includes('השקעות')) {
          summary.savings.spent += absAmount;
          // Count savings as expenses for cash flow calculations (savings = money going out)
          // Note: amountForCalculation already added to total_expenses at line 1433
        }
      }
    }

    // Calculate balance using the adjusted amounts and including monthly savings
    summary.total_expenses += monthlySavings; // Add savings as virtual expense
    summary.balance = summary.total_income - summary.total_expenses;

    return summary;
  }

  // ===== UTILITY METHODS FOR PROCESSING =====
  
  static async processTransactionsByCategory(transactions, flowMonth = null, userId = null) {
    // Sort transactions by date
    transactions = transactions.sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

    const result = {
      categories: {},
      not_in_cashflow: {
        transactions: [],
        total: 0.0
      },
      summary: {
        income: 0.0,
        expenses: 0.0,
        balance: 0.0,
        savings: 0.0,
        total_income: 0.0,
        total_expenses: 0.0,
        monthly_goal: 3000.0
      }
    };

    // Filter by flow_month if specified
    if (flowMonth) {
      transactions = transactions.filter(transaction => 
        transaction.flow_month === flowMonth
      );
    }

    // Get category order if userId provided
    let categoryOrder = [];
    let orderMap = {};
    if (userId) {
      try {
        categoryOrder = await this.getUserCategoryOrder(userId);
        orderMap = {};
        categoryOrder.forEach(co => {
          orderMap[co.category_name] = parseInt(co.display_order);
        });
      } catch (error) {
        console.log('Could not get category order:', error.message);
      }
    }

    // Get all unique categories and initialize them
    const allCategories = new Set();
    transactions.forEach(transaction => {
      if (transaction.is_transfer) return;
      
      const categoryName = transaction.category_name || "לא מסווג";
      allCategories.add(categoryName);
      
      const isNonCashflow = categoryName.includes("לא תזרימיות");
      if (isNonCashflow && !transaction.excluded_from_flow) {
        transaction.excluded_from_flow = true;
      }
    });

    // Initialize all category entries
    allCategories.forEach(categoryName => {
      const isNonCashflow = categoryName.includes("לא תזרימיות");
      result.categories[categoryName] = {
        name: categoryName,
        transactions: [],
        spent: 0.0,
        budget: 0.0,
        remaining: 0.0,
        progress: 0.0,
        color: this.getCategoryColor(categoryName),
        is_non_cashflow: isNonCashflow,
        is_calculated: false
      };
    });

    // Add transactions to their categories
    transactions.forEach(transaction => {
      if (transaction.is_transfer) return;
      
      const categoryName = transaction.category_name || "לא מסווג";
      result.categories[categoryName].transactions.push(transaction);
      
      if (transaction.excluded_from_flow) {
        result.not_in_cashflow.transactions.push(transaction);
        result.not_in_cashflow.total += parseFloat(transaction.amount || 0);
      }
      
      const isNonCashflow = categoryName.includes("לא תזרימיות");
      if (!isNonCashflow && !transaction.excluded_from_flow) {
        const amount = parseFloat(transaction.amount || 0);
        result.categories[categoryName].spent += amount;
      }
    });

    // Calculate summaries
    Object.values(result.categories).forEach(category => {
      if (category.name.includes("הכנסות")) {
        result.summary.income += category.spent;
        result.summary.total_income += category.spent;
      } else if (category.name.includes("חיסכון")) {
        result.summary.savings += category.spent;
        // Count savings as expenses for cash flow calculations (savings = money going out)
        result.summary.expenses += Math.abs(category.spent);
        result.summary.total_expenses += Math.abs(category.spent);
      } else if (!category.is_non_cashflow) {
        result.summary.expenses += Math.abs(category.spent);
        result.summary.total_expenses += Math.abs(category.spent);
      }
    });

    result.summary.balance = result.summary.total_income - result.summary.total_expenses;

    // Apply category ordering if available
    if (Object.keys(orderMap).length > 0 && result.categories) {
      const orderedCategories = {};
      
      // First add categories in user's preferred order
      const orderedCategoryNames = Object.keys(orderMap).sort((a, b) => orderMap[a] - orderMap[b]);
      orderedCategoryNames.forEach(categoryName => {
        if (result.categories[categoryName]) {
          orderedCategories[categoryName] = result.categories[categoryName];
        }
      });
      
      // Then add any remaining categories not in the order
      Object.keys(result.categories).forEach(categoryName => {
        if (!orderedCategories[categoryName]) {
          orderedCategories[categoryName] = result.categories[categoryName];
        }
      });
      
      result.categories = orderedCategories;
    }

    return result;
  }

  // Group categories by shared category
  static async groupCategoriesByShared(processedData, userId) {
    try {
      console.log('Grouping categories by shared for user:', userId);
      // Get category order with shared categories
      const { data: categoryOrder, error } = await supabase
        .from('category_order')
        .select('category_name, shared_category, display_order, weekly_display, monthly_target, use_shared_target')
        .eq('user_id', userId)
        .order('display_order');

      if (error) {
        console.error('Error fetching category order:', error);
        return processedData; // Return original data if can't fetch shared categories
      }

      console.log('Found category order:', categoryOrder?.length || 0, 'items');

      const sharedCategoryMap = {};
      const categoryDisplayOrder = {};
      const categoryWeeklyDisplay = {};
      const categoryMonthlyTarget = {};
      const categoryUseSharedTarget = {};
      const categoriesWithoutShared = {};
      const groupedCategories = {};

      // Build map of category -> shared category and display order
      categoryOrder.forEach(item => {
        if (item.shared_category) {
          sharedCategoryMap[item.category_name] = item.shared_category;
        }
        categoryDisplayOrder[item.category_name] = item.display_order;
        categoryWeeklyDisplay[item.category_name] = item.weekly_display || false;
        categoryMonthlyTarget[item.category_name] = item.monthly_target || null;
        categoryUseSharedTarget[item.category_name] = item.use_shared_target !== false;
      });

      // Process each category
      Object.entries(processedData.categories).forEach(([categoryName, categoryData]) => {
        const sharedCategory = sharedCategoryMap[categoryName];

        if (sharedCategory) {
          // This category belongs to a shared category
          if (!groupedCategories[sharedCategory]) {
            groupedCategories[sharedCategory] = {
              name: sharedCategory,
              transactions: [],
              spent: 0.0,
              budget: 0.0,
              remaining: 0.0,
              progress: 0.0,
              color: this.getCategoryColor(sharedCategory),
              is_non_cashflow: false,
              is_calculated: false,
              is_shared_category: true,
              weekly_display: categoryWeeklyDisplay[categoryName] || false,
              monthly_target: categoryMonthlyTarget[categoryName] || null,
              shared_category: sharedCategory,
              use_shared_target: categoryUseSharedTarget[categoryName] !== false,
              sub_categories: {}
            };
          }

          // Add this category as a sub-category
          groupedCategories[sharedCategory].sub_categories[categoryName] = {
            ...categoryData,
            monthly_target: categoryMonthlyTarget[categoryName] || null,
            shared_category: sharedCategory,
            use_shared_target: categoryUseSharedTarget[categoryName] !== false
          };
          
          // Aggregate data
          groupedCategories[sharedCategory].transactions.push(...categoryData.transactions);
          groupedCategories[sharedCategory].spent += categoryData.spent;
          groupedCategories[sharedCategory].budget += categoryData.budget;

          // Check if any sub-category is non-cashflow
          if (categoryData.is_non_cashflow) {
            groupedCategories[sharedCategory].is_non_cashflow = true;
          }
        } else {
          // This category doesn't belong to a shared category
          categoriesWithoutShared[categoryName] = {
            ...categoryData,
            weekly_display: categoryWeeklyDisplay[categoryName] || false,
            monthly_target: categoryMonthlyTarget[categoryName] || null,
            shared_category: null,
            use_shared_target: categoryUseSharedTarget[categoryName] !== false
          };
        }
      });

      // Calculate remaining and progress for shared categories
      Object.values(groupedCategories).forEach(sharedCategory => {
        sharedCategory.remaining = sharedCategory.budget - Math.abs(sharedCategory.spent);
        sharedCategory.progress = sharedCategory.budget > 0 
          ? Math.min((Math.abs(sharedCategory.spent) / sharedCategory.budget) * 100, 100) 
          : 0;
      });

      // Combine and sort all categories by display_order
      const allCategories = { ...groupedCategories, ...categoriesWithoutShared };
      
      // Convert to array, sort by display_order, then back to object
      const sortedEntries = Object.entries(allCategories).sort(([nameA], [nameB]) => {
        const orderA = categoryDisplayOrder[nameA] ?? 999;
        const orderB = categoryDisplayOrder[nameB] ?? 999;
        return orderA - orderB;
      });
      
      const finalCategories = Object.fromEntries(sortedEntries);

      return {
        ...processedData,
        categories: finalCategories
      };

    } catch (error) {
      console.error('Error grouping categories by shared:', error);
      return processedData; // Return original data on error
    }
  }

  // ===== MONTHLY SAVINGS =====
  
  static async getMonthlySavings(userId, cashFlowId, year, month) {
    try {
      const { data, error } = await supabase
        .from('monthly_savings')
        .select('amount')
        .eq('user_id', userId)
        .eq('cash_flow_id', cashFlowId)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? parseFloat(data.amount) : 0;
    } catch (error) {
      console.error('Error getting monthly savings:', error);
      return 0;
    }
  }

  // ===== MONTHLY GOALS =====
  
  static async getMonthlyGoal(userId, cashFlowId, year, month) {
    try {
      const { data, error } = await supabase
        .from('monthly_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('cash_flow_id', cashFlowId)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error getting monthly goal:', error);
      return null;
    }
  }

  static async saveMonthlyGoal(userId, goalData) {
    try {
      const { 
        amount, 
        cash_flow_id, 
        year, 
        month, 
        include_in_next_month, 
        include_in_specific_month, 
        specific_year, 
        specific_month 
      } = goalData;

      // First check if goal already exists
      const existingGoal = await this.getMonthlyGoal(userId, cash_flow_id, year, month);

      const goalRecord = {
        user_id: userId,
        cash_flow_id,
        year,
        month,
        amount: parseFloat(amount),
        include_in_next_month: include_in_next_month || false,
        include_in_specific_month: include_in_specific_month || false,
        specific_year: specific_year || null,
        specific_month: specific_month || null,
        updated_at: new Date().toISOString()
      };

      let result;
      if (existingGoal) {
        // Update existing goal
        const { data, error } = await supabase
          .from('monthly_goals')
          .update(goalRecord)
          .eq('user_id', userId)
          .eq('cash_flow_id', cash_flow_id)
          .eq('year', year)
          .eq('month', month)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new goal
        goalRecord.created_at = new Date().toISOString();
        
        const { data, error } = await supabase
          .from('monthly_goals')
          .insert([goalRecord])
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Also handle adding the goal as an expense to current month transactions
      await this.addGoalAsExpense(userId, goalData);

      // Handle future income if specified
      if (include_in_next_month) {
        await this.addGoalAsFutureIncome(userId, goalData, true);
      } else if (include_in_specific_month && specific_year && specific_month) {
        await this.addGoalAsFutureIncome(userId, goalData, false);
      }

      return result;
    } catch (error) {
      console.error('Error saving monthly goal:', error);
      throw error;
    }
  }

  static async deleteMonthlyGoal(userId, cashFlowId, year, month) {
    try {
      // First get the goal to check if we need to clean up related transactions
      const existingGoal = await this.getMonthlyGoal(userId, cashFlowId, year, month);
      
      if (existingGoal) {
        // Remove goal expense transaction
        await this.removeGoalExpense(userId, cashFlowId, year, month);
        
        // Remove future income transactions if they exist
        if (existingGoal.include_in_next_month) {
          const nextMonth = month === 12 ? 1 : month + 1;
          const nextYear = month === 12 ? year + 1 : year;
          await this.removeGoalIncome(userId, cashFlowId, nextYear, nextMonth);
        } else if (existingGoal.include_in_specific_month && existingGoal.specific_year && existingGoal.specific_month) {
          await this.removeGoalIncome(userId, cashFlowId, existingGoal.specific_year, existingGoal.specific_month);
        }
      }

      const { error } = await supabase
        .from('monthly_goals')
        .delete()
        .eq('user_id', userId)
        .eq('cash_flow_id', cashFlowId)
        .eq('year', year)
        .eq('month', month);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting monthly goal:', error);
      throw error;
    }
  }

  static async addGoalAsExpense(userId, goalData) {
    try {
      const { amount, cash_flow_id, year, month } = goalData;
      
      // Create a special transaction for the goal as an expense
      const transactionData = {
        user_id: userId,
        cash_flow_id,
        category_name: 'חיסכון - יעד חודשי',
        business_name: 'יעד חיסכון חודשי',
        description: `יעד חיסכון לחודש ${month}/${year}`,
        amount: -Math.abs(parseFloat(amount)), // Negative for expense
        payment_date: new Date(year, month - 1, 1).toISOString().split('T')[0],
        flow_month: `${year}-${String(month).padStart(2, '0')}`,
        payment_method: 'חיסכון',
        currency: 'ILS',
        source_type: 'monthly_goal',
        notes: 'עסקה אוטומטית ליעד חיסכון חודשי',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // First, remove any existing goal expense for this month
      await this.removeGoalExpense(userId, cash_flow_id, year, month);

      // Add the new goal expense
      const { data, error } = await supabase
        .from('transactions')
        .insert([transactionData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding goal as expense:', error);
      throw error;
    }
  }

  static async removeGoalExpense(userId, cashFlowId, year, month) {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', userId)
        .eq('cash_flow_id', cashFlowId)
        .eq('source_type', 'monthly_goal')
        .eq('flow_month', `${year}-${String(month).padStart(2, '0')}`);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing goal expense:', error);
      throw error;
    }
  }

  static async addGoalAsFutureIncome(userId, goalData, isNextMonth) {
    try {
      const { amount, cash_flow_id, year, month, specific_year, specific_month } = goalData;
      
      let targetYear, targetMonth;
      if (isNextMonth) {
        targetMonth = month === 12 ? 1 : month + 1;
        targetYear = month === 12 ? year + 1 : year;
      } else {
        targetYear = specific_year;
        targetMonth = specific_month;
      }

      const transactionData = {
        user_id: userId,
        cash_flow_id,
        category_name: 'הכנסות',
        business_name: 'חיסכון מחודש קודם',
        description: `כסף שחסכתי ב-${month}/${year}`,
        amount: Math.abs(parseFloat(amount)), // Positive for income
        payment_date: new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0],
        flow_month: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
        payment_method: 'חיסכון',
        currency: 'ILS',
        source_type: 'monthly_goal_income',
        notes: `הכנסה מיעד חיסכון של חודש ${month}/${year}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // First, remove any existing goal income for this target month
      await this.removeGoalIncome(userId, cash_flow_id, targetYear, targetMonth);

      // Add the new goal income
      const { data, error } = await supabase
        .from('transactions')
        .insert([transactionData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding goal as future income:', error);
      throw error;
    }
  }

  static async removeGoalIncome(userId, cashFlowId, year, month) {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', userId)
        .eq('cash_flow_id', cashFlowId)
        .eq('source_type', 'monthly_goal_income')
        .eq('flow_month', `${year}-${String(month).padStart(2, '0')}`);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing goal income:', error);
      throw error;
    }
  }

  // ===== AUTO-CATEGORIZATION =====
  
  // Calculate similarity between two strings (Levenshtein distance based)
  static calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    const matrix = [];
    const m = s1.length;
    const n = s2.length;
    
    // Initialize matrix
    for (let i = 0; i <= m; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= n; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,      // deletion
            matrix[i][j - 1] + 1,      // insertion
            matrix[i - 1][j - 1] + 1   // substitution
          );
        }
      }
    }
    
    const maxLength = Math.max(m, n);
    const distance = matrix[m][n];
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  }
  
  static async getMostFrequentCategoryForBusiness(businessName) {
    try {
      if (!businessName || !businessName.trim()) {
        return null;
      }

      const trimmedBusinessName = businessName.trim();
      console.log(`Finding most frequent category for business: "${trimmedBusinessName}"`);

      // First try exact match
      let { data: transactions, error } = await supabase
        .from('transactions')
        .select('business_name, category_name, amount')
        .or(`business_name.eq.${trimmedBusinessName},business_name.ilike.${trimmedBusinessName.replace(/'/g, "''")}`)
        .not('category_name', 'is', null)
        .not('category_name', 'eq', '');

      if (error) {
        console.error('Error fetching transactions for business categorization:', error);
        return null;
      }

      // If no exact matches found, try similarity matching (90% threshold)
      if (!transactions || transactions.length === 0) {
        console.log(`No exact matches found for business: "${trimmedBusinessName}", trying similarity matching...`);
        
        // Get all businesses to compare similarity
        const { data: allBusinesses, error: allError } = await supabase
          .from('transactions')
          .select('business_name, category_name, amount')
          .not('business_name', 'is', null)
          .not('category_name', 'is', null)
          .not('category_name', 'eq', '');

        if (allError || !allBusinesses) {
          console.error('Error fetching all businesses for similarity matching:', allError);
          return null;
        }

        // Find businesses with 90%+ similarity
        const similarBusinesses = [];
        allBusinesses.forEach(business => {
          const similarity = this.calculateSimilarity(trimmedBusinessName, business.business_name);
          if (similarity >= 0.9) {
            similarBusinesses.push({
              ...business,
              similarity
            });
          }
        });

        if (similarBusinesses.length === 0) {
          console.log(`No similar businesses found for: "${trimmedBusinessName}"`);
          return null;
        }

        transactions = similarBusinesses;
        console.log(`Found ${similarBusinesses.length} similar businesses for: "${trimmedBusinessName}"`);
      }

      if (!transactions || transactions.length === 0) {
        console.log(`No transactions found for business: "${trimmedBusinessName}"`);
        return null;
      }

      // Count frequency of each category (weighted by similarity if applicable)
      const categoryCount = {};
      transactions.forEach(transaction => {
        const categoryName = transaction.category_name.trim();
        if (categoryName) {
          // Use similarity as weight if available, otherwise weight = 1
          const weight = transaction.similarity || 1;
          categoryCount[categoryName] = (categoryCount[categoryName] || 0) + weight;
        }
      });

      // Find the most frequent category
      let mostFrequentCategory = null;
      let maxCount = 0;
      
      Object.entries(categoryCount).forEach(([category, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostFrequentCategory = category;
        }
      });

      console.log(`Most frequent category for "${trimmedBusinessName}": "${mostFrequentCategory}" (${maxCount} transactions)`);
      return mostFrequentCategory;

    } catch (error) {
      console.error('Error getting most frequent category for business:', error);
      return null;
    }
  }

  static async getAutoCategoryForBusiness(businessName, amount, sourceType = null) {
    try {
      // First try to get the most frequent category for this business
      const mostFrequentCategory = await this.getMostFrequentCategoryForBusiness(businessName);
      
      if (mostFrequentCategory) {
        console.log(`Auto-categorizing "${businessName}" as "${mostFrequentCategory}" (most frequent)`);
        return mostFrequentCategory;
      }

      // If no history found, categorize based on income/expense and source type
      const numericAmount = parseFloat(amount || 0);
      
      // Skip auto-categorization for BudgetLens files (they should keep their original categories)
      if (sourceType && sourceType.toLowerCase().includes('budgetlens')) {
        console.log(`Skipping auto-categorization for BudgetLens file: "${businessName}"`);
        return null;
      }

      let defaultCategory;
      if (numericAmount > 0) {
        // Positive amount = income
        defaultCategory = 'הכנסות משתנות';
        console.log(`Auto-categorizing "${businessName}" as "${defaultCategory}" (income, no history)`);
      } else {
        // Negative amount = expense  
        defaultCategory = 'הוצאות משתנות';
        console.log(`Auto-categorizing "${businessName}" as "${defaultCategory}" (expense, no history)`);
      }

      return defaultCategory;

    } catch (error) {
      console.error('Error getting auto category for business:', error);
      return null;
    }
  }

  // ===== MONTHLY TARGET MANAGEMENT =====
  
  static async calculateMonthlyAverage(userId, categoryName, months = 3) {
    try {
      console.log(`Calculating monthly average for category: ${categoryName}, user: ${userId}`);
      
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      // Get category type from database
      const { data: categoryData, error: categoryError } = await supabase
        .from('category')
        .select('category_type')
        .eq('name', categoryName)
        .eq('user_id', userId)
        .single();
      
      // Determine if this is an income category (check both category_type and name for backward compatibility)
      const isIncomeCategory = 
        (categoryData?.category_type === 'income') || 
        categoryName.includes('הכנסות') || 
        categoryName.includes('משכורת');
      
      // Determine if this is a fixed income category (salary, regular income)
      const isFixedIncomeCategory = isIncomeCategory && (
        categoryName.includes('משכורת') || 
        categoryName.includes('קבועה') ||
        categoryName.includes('קבוע') ||
        categoryName.toLowerCase().includes('salary') ||
        categoryName.toLowerCase().includes('wage')
      );
      
      // For fixed income categories, use only last month's data (more accurate for salary/regular income)
      // For other categories, use the specified number of months for averaging
      const effectiveMonths = isFixedIncomeCategory ? 1 : months;
      
      console.log(`Category "${categoryName}" - Income: ${isIncomeCategory}, Fixed Income: ${isFixedIncomeCategory}, Using ${effectiveMonths} months for calculation`);
      
      // Get spending/income for the last N months (excluding current month)
      const monthlyAmounts = [];
      
      for (let i = 1; i <= effectiveMonths; i++) {
        let targetMonth = currentMonth - i;
        let targetYear = currentYear;
        
        if (targetMonth <= 0) {
          targetMonth += 12;
          targetYear -= 1;
        }
        
        let query = supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', userId)
          .eq('category_name', categoryName)
          .eq('payment_month', targetMonth)
          .eq('payment_year', targetYear);
        
        // For income categories, look for positive amounts; for expenses, negative amounts
        if (isIncomeCategory) {
          query = query.gt('amount', 0); // Only income (positive amounts)
        } else {
          query = query.lt('amount', 0); // Only expenses (negative amounts)
        }
        
        const { data: transactions, error } = await query;
        
        if (error) {
          console.error(`Error fetching transactions for ${targetMonth}/${targetYear}:`, error);
          continue;
        }
        
        const monthTotal = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        if (monthTotal > 0) {
          monthlyAmounts.push(monthTotal);
          console.log(`Month ${targetMonth}/${targetYear}: ${monthTotal}`);
        }
      }
      
      if (monthlyAmounts.length === 0) {
        console.log(`No ${isIncomeCategory ? 'income' : 'spending'} data found for category:`, categoryName);
        return 0;
      }
      
      const average = monthlyAmounts.reduce((sum, amount) => sum + amount, 0) / monthlyAmounts.length;
      console.log(`Calculated ${effectiveMonths}-month average for ${categoryName}: ${average} (based on ${monthlyAmounts.length} months)`);
      
      return Math.round(average * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      console.error('Error calculating monthly average:', error);
      return 0;
    }
  }
  
  static async updateCategoryMonthlyTarget(userId, categoryName, monthlyTarget) {
    try {
      console.log(`Updating monthly target for ${categoryName}: ${monthlyTarget}`);
      
      const { data, error } = await supabase
        .from('category_order')
        .update({
          monthly_target: monthlyTarget,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('category_name', categoryName)
        .select();
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error('Category not found for this user');
      }
      
      return data[0];
    } catch (error) {
      console.error('Error updating category monthly target:', error);
      throw error;
    }
  }

  // ===== SHARED CATEGORY TARGETS METHODS =====

  static async getSharedCategoryTarget(userId, sharedCategoryName) {
    try {
      console.log(`Getting shared category target for ${sharedCategoryName}`);
      
      const { data, error } = await supabase
        .from('shared_category_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('shared_category_name', sharedCategoryName)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }
      
      return data || null;
    } catch (error) {
      console.error('Error getting shared category target:', error);
      throw error;
    }
  }

  static async updateSharedCategoryTarget(userId, sharedCategoryName, monthlyTarget, weeklyDisplay = false) {
    try {
      console.log(`Updating shared category target for ${sharedCategoryName}: ${monthlyTarget}`);
      
      const { data, error } = await supabase
        .from('shared_category_targets')
        .upsert({
          user_id: userId,
          shared_category_name: sharedCategoryName,
          monthly_target: monthlyTarget,
          weekly_display: weeklyDisplay,
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (error) throw error;
      
      return data[0];
    } catch (error) {
      console.error('Error updating shared category target:', error);
      throw error;
    }
  }

  static async getSharedCategoryMonthlySpending(userId, sharedCategoryName, year, month) {
    try {
      console.log(`Getting shared category spending for ${sharedCategoryName} in ${year}/${month}`);
      
      // Get all categories that belong to this shared category
      const { data: categories, error: categoriesError } = await supabase
        .from('category_order')
        .select('category_name')
        .eq('user_id', userId)
        .eq('shared_category', sharedCategoryName);
      
      if (categoriesError) throw categoriesError;
      
      if (!categories || categories.length === 0) {
        return 0;
      }
      
      const categoryNames = categories.map(cat => cat.category_name);
      
      // Get transactions for all categories in this shared category
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .in('category_name', categoryNames)
        .eq('payment_month', month)
        .eq('payment_year', year);
      
      if (error) throw error;
      
      const totalSpending = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return Math.round(totalSpending * 100) / 100;
    } catch (error) {
      console.error('Error getting shared category monthly spending:', error);
      throw error;
    }
  }

  static async setUseSharedTarget(userId, categoryName, useSharedTarget) {
    try {
      console.log(`Setting use_shared_target for ${categoryName}: ${useSharedTarget}`);
      
      const { data, error } = await supabase
        .from('category_order')
        .update({
          use_shared_target: useSharedTarget,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('category_name', categoryName)
        .select();
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error('Category not found for this user');
      }
      
      return data[0];
    } catch (error) {
      console.error('Error setting use_shared_target:', error);
      throw error;
    }
  }
  
  static async getCategoryMonthlySpending(userId, categoryName, year, month) {
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('category_name', categoryName)
        .eq('payment_month', month)
        .eq('payment_year', year)
        .lt('amount', 0); // Only expenses
      
      if (error) throw error;
      
      const totalSpending = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return Math.round(totalSpending * 100) / 100;
    } catch (error) {
      console.error('Error getting category monthly spending:', error);
      return 0;
    }
  }
  
  static async getCategorySpendingHistory(userId, categoryName, months = 12) {
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      const spendingHistory = [];
      
      for (let i = 0; i < months; i++) {
        let targetMonth = currentMonth - i;
        let targetYear = currentYear;
        
        if (targetMonth <= 0) {
          targetMonth += 12;
          targetYear -= 1;
        }
        
        const spending = await this.getCategoryMonthlySpending(userId, categoryName, targetYear, targetMonth);
        
        spendingHistory.unshift({
          year: targetYear,
          month: targetMonth,
          amount: spending,
          monthName: new Date(targetYear, targetMonth - 1).toLocaleDateString('he-IL', { 
            year: 'numeric', 
            month: 'long' 
          })
        });
      }
      
      return spendingHistory;
    } catch (error) {
      console.error('Error getting category spending history:', error);
      return [];
    }
  }
  
  static async calculateWeeklyTarget(monthlyTarget, currentWeek, totalWeeksInMonth) {
    try {
      // Calculate proportional weekly target based on days in the week vs days in month
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // Get first and last day of the month
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      const totalDaysInMonth = lastDayOfMonth.getDate();
      
      // Calculate the number of days in the current week (within this month)
      const weekStart = new Date(currentWeek);
      const weekEnd = new Date(currentWeek);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      // Ensure we only count days within the current month
      const effectiveWeekStart = weekStart < firstDayOfMonth ? firstDayOfMonth : weekStart;
      const effectiveWeekEnd = weekEnd > lastDayOfMonth ? lastDayOfMonth : weekEnd;
      
      const daysInWeek = Math.ceil((effectiveWeekEnd - effectiveWeekStart) / (1000 * 60 * 60 * 24)) + 1;
      
      const weeklyTarget = (monthlyTarget * daysInWeek) / totalDaysInMonth;
      
      return Math.round(weeklyTarget * 100) / 100;
    } catch (error) {
      console.error('Error calculating weekly target:', error);
      return 0;
    }
  }
  
  static async refreshMonthlyTargetsForNewMonth(userId, forceRefresh = false) {
    try {
      console.log(`Refreshing monthly targets for user: ${userId} ${forceRefresh ? '(forced)' : ''}`);
      
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      if (!forceRefresh) {
        // Check if targets were already updated this month
        const { data: userSettings, error: settingsError } = await supabase
          .from('users')
          .select('monthly_targets_last_update')
          .eq('id', userId)
          .single();
        
        if (settingsError && settingsError.code !== 'PGRST116') {
          console.error('Error checking user settings:', settingsError);
        }
        
        const lastUpdate = userSettings?.monthly_targets_last_update;
        const currentMonthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
        
        // If already updated this month, skip
        if (lastUpdate && lastUpdate >= currentMonthKey) {
          console.log('Monthly targets already updated for this month');
          return { updated: false, message: 'Already updated this month' };
        }
      }
      
      console.log('Updating monthly targets...');
      
      // Get all categories for this user
      const { data: categories, error: categoriesError } = await supabase
        .from('category_order')
        .select('category_name')
        .eq('user_id', userId);
      
      if (categoriesError) {
        throw categoriesError;
      }
      
      let updatedCount = 0;
      const updateResults = [];
      
      // Update each category's monthly target
      for (const category of categories) {
        try {
          // Calculate new 3-month average
          const newAverage = await this.calculateMonthlyAverage(userId, category.category_name, 3);
          
          // Update the monthly target for all categories (including 0 values)
          const { data, error } = await supabase
            .from('category_order')
            .update({
              monthly_target: newAverage,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('category_name', category.category_name)
            .select();
          
          if (error) {
            console.error(`Error updating target for ${category.category_name}:`, error);
            updateResults.push({
              category: category.category_name,
              success: false,
              error: error.message
            });
          } else {
            updatedCount++;
            updateResults.push({
              category: category.category_name,
              success: true,
              oldTarget: data[0]?.monthly_target || 0,
              newTarget: newAverage
            });
            console.log(`Updated ${category.category_name}: ${newAverage}`);
          }
        } catch (categoryError) {
          console.error(`Error processing category ${category.category_name}:`, categoryError);
          updateResults.push({
            category: category.category_name,
            success: false,
            error: categoryError.message
          });
        }
      }
      
      // Update user's last update timestamp (only if not forced)
      if (!forceRefresh) {
        const currentMonthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
        const { error: updateUserError } = await supabase
          .from('users')
          .update({
            monthly_targets_last_update: currentMonthKey,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
        
        if (updateUserError) {
          console.error('Error updating user last update timestamp:', updateUserError);
        }
      }
      
      console.log(`Monthly targets refresh completed. Updated ${updatedCount} categories.`);
      
      // Also update shared category targets
      let sharedCategoryResults = null;
      try {
        sharedCategoryResults = await this.calculateAndUpdateSharedCategoryTargets(userId, forceRefresh);
        console.log('Shared category targets also updated');
      } catch (sharedError) {
        console.error('Error updating shared category targets:', sharedError);
      }
      
      return {
        updated: true,
        updatedCount,
        totalCategories: categories.length,
        results: updateResults,
        sharedCategoryResults: sharedCategoryResults,
        month: currentMonth,
        year: currentYear
      };
      
    } catch (error) {
      console.error('Error refreshing monthly targets:', error);
      throw error;
    }
  }
  
  static async shouldRefreshMonthlyTargets(userId) {
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      const currentMonthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
      
      // Check user's last update
      const { data: userSettings, error } = await supabase
        .from('users')
        .select('monthly_targets_last_update')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error checking if should refresh targets:', error);
        return false;
      }
      
      const lastUpdate = userSettings?.monthly_targets_last_update;
      
      // If never updated or last update was before current month
      return !lastUpdate || lastUpdate < currentMonthKey;
    } catch (error) {
      console.error('Error checking if should refresh targets:', error);
      return false;
    }
  }

  // ===== SHARED CATEGORY TARGET CALCULATION =====
  
  static async calculateAndUpdateSharedCategoryTargets(userId, forceRefresh = false) {
    try {
      console.log(`Calculating shared category targets for user: ${userId}`);
      
      // Get all shared categories for this user
      const { data: sharedCategories, error: sharedError } = await supabase
        .from('category_order')
        .select('shared_category, category_name')
        .eq('user_id', userId)
        .not('shared_category', 'is', null)
        .eq('use_shared_target', true);
      
      if (sharedError) {
        throw sharedError;
      }
      
      // Group categories by shared category
      const groupedCategories = {};
      for (const cat of sharedCategories) {
        if (!groupedCategories[cat.shared_category]) {
          groupedCategories[cat.shared_category] = [];
        }
        groupedCategories[cat.shared_category].push(cat.category_name);
      }
      
      console.log('Found shared categories:', Object.keys(groupedCategories));
      
      const results = [];
      
      // Calculate target for each shared category
      for (const [sharedCategoryName, categoryNames] of Object.entries(groupedCategories)) {
        try {
          let totalTarget = 0;
          
          // Calculate total target for all categories in this shared group
          for (const categoryName of categoryNames) {
            // For income categories (הכנסות), use special logic
            if (sharedCategoryName === 'הכנסות') {
              // For fixed income categories, use last month (1 month)
              // For variable income categories, use 3-month average
              const isFixedIncome = categoryName.includes('קבועות') || 
                                  categoryName.includes('קבוע') || 
                                  categoryName.includes('משכורת');
              
              const months = isFixedIncome ? 1 : 3;
              const categoryTarget = await this.calculateMonthlyAverage(userId, categoryName, months);
              totalTarget += categoryTarget;
              
              console.log(`${categoryName} (${isFixedIncome ? 'fixed' : 'variable'} income): ${categoryTarget}`);
            } else {
              // For non-income categories, use regular 3-month average
              const categoryTarget = await this.calculateMonthlyAverage(userId, categoryName, 3);
              totalTarget += categoryTarget;
              
              console.log(`${categoryName}: ${categoryTarget}`);
            }
          }
          
          console.log(`Total target for ${sharedCategoryName}: ${totalTarget}`);
          
          // Update or create shared category target
          const { data: existingTarget, error: checkError } = await supabase
            .from('shared_category_targets')
            .select('id, monthly_target')
            .eq('user_id', userId)
            .eq('shared_category_name', sharedCategoryName)
            .maybeSingle();
          
          if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
          }
          
          if (existingTarget) {
            // Update existing target
            const { data, error } = await supabase
              .from('shared_category_targets')
              .update({
                monthly_target: Math.round(totalTarget * 100) / 100,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingTarget.id)
              .select();
            
            if (error) throw error;
            
            results.push({
              sharedCategory: sharedCategoryName,
              action: 'updated',
              oldTarget: existingTarget.monthly_target,
              newTarget: Math.round(totalTarget * 100) / 100,
              categories: categoryNames
            });
          } else {
            // Create new target
            const { data, error } = await supabase
              .from('shared_category_targets')
              .insert({
                user_id: userId,
                shared_category_name: sharedCategoryName,
                monthly_target: Math.round(totalTarget * 100) / 100,
                weekly_display: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select();
            
            if (error) throw error;
            
            results.push({
              sharedCategory: sharedCategoryName,
              action: 'created',
              newTarget: Math.round(totalTarget * 100) / 100,
              categories: categoryNames
            });
          }
          
        } catch (categoryError) {
          console.error(`Error processing shared category ${sharedCategoryName}:`, categoryError);
          results.push({
            sharedCategory: sharedCategoryName,
            action: 'error',
            error: categoryError.message,
            categories: categoryNames
          });
        }
      }
      
      console.log('Shared category targets calculation completed:', results);
      
      return {
        success: true,
        results: results,
        updatedSharedCategories: Object.keys(groupedCategories).length
      };
      
    } catch (error) {
      console.error('Error calculating shared category targets:', error);
      throw error;
    }
  }

  // ===== TRANSACTION DATE QUERIES =====
  
  static async getLatestTransactionDate(cashFlowId, fileSource = null) {
    try {
      let query = supabase
        .from('transactions')
        .select('payment_date')
        .eq('cash_flow_id', cashFlowId);

      // Add file source filter if provided
      if (fileSource) {
        query = query.eq('file_source', fileSource);
      }

      const { data, error } = await query
        .order('payment_date', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // If no transactions found, return null
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }
      
      return data?.payment_date || null;
    } catch (error) {
      console.error('Error fetching latest transaction date:', error);
      return null;
    }
  }

  // ===== CONNECTION TEST =====
  
  static async testConnection() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}

module.exports = SupabaseService;