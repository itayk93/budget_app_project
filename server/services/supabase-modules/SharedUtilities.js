/**
 * Shared Utilities for Supabase Services
 * Extracted from supabaseService.js - Core utility functions
 * ~100 lines - Foundation for all other services
 */

const { supabase } = require('../../config/supabase');

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

class SharedUtilities {
  
  // ===== RLS SECURITY UTILITIES =====
  
  static async setUserContext(client, userId) {
    try {
      if (!userId) {
        console.warn('⚠️ [RLS] No userId provided for context setting');
        return false;
      }
      
      // Set user context for RLS policies
      const { error } = await client.rpc('set_config', {
        setting_name: 'app.current_user_id',
        new_value: userId,
        is_local: true
      });
      
      if (error) {
        console.error('❌ [RLS] Failed to set user context:', error);
        return false;
      }
      
      console.log('✅ [RLS] User context set for:', userId);
      return true;
    } catch (error) {
      console.error('❌ [RLS] Error setting user context:', error);
      return false;
    }
  }
  
  static async createSecureClient(client, userId) {
    if (userId) {
      await this.setUserContext(client, userId);
    }
    return client;
  }
  
  // ===== CONNECTION UTILITIES =====
  
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
  
  // ===== CURRENCY UTILITIES =====
  
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

  // ===== CATEGORY COLOR UTILITIES =====

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

  // ===== VALIDATION UTILITIES =====
  
  static validateUserId(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    return userId;
  }

  static validateAmount(amount) {
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) {
      throw new Error('Invalid amount value');
    }
    return parsed;
  }

  static validateDateString(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }
    return date;
  }

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

  // ===== ERROR HANDLING UTILITIES =====
  
  static handleSupabaseError(error, operation = 'operation') {
    console.error(`Supabase ${operation} error:`, error);
    return {
      success: false,
      error: error.message || `Failed to perform ${operation}`,
      details: error
    };
  }

  static createSuccessResponse(data, message = 'Operation successful') {
    return {
      success: true,
      data,
      message
    };
  }

  static createErrorResponse(message, details = null) {
    return {
      success: false,
      error: message,
      details
    };
  }

  // ===== EXPORT CURRENCY MAP FOR OTHER MODULES =====
  static get CURRENCY_SYMBOLS() {
    return CURRENCY_SYMBOL_MAP;
  }
}

module.exports = SharedUtilities;