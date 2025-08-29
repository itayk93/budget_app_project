const { supabase, adminClient } = require('../config/supabase');
const fuzz = require('fuzzball');

class HiddenBusinessService {
  
  /**
   * Map auth user_id to hidden business user_id (temporary fix for user_id mismatch)
   */
  static mapUserId(userId) {
    // Temporary mapping for specific user with foreign key constraint issue
    if (userId === 'e3f6919b-d83b-4456-8325-676550a4382d') {
      return '6fd515f1-430c-40f6-9d7d-cd6cd9df7f2e';
    }
    return userId;
  }
  
  /**
   * Get all active hidden business names for a user
   */
  static async getHiddenBusinessNames(userId) {
    const mappedUserId = this.mapUserId(userId);
    try {
      const { data, error } = await adminClient
        .from('hidden_business_names')
        .select('business_name, reason')
        .eq('user_id', mappedUserId)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching hidden business names:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getHiddenBusinessNames:', error);
      return [];
    }
  }

  /**
   * Check if a business name is in the hidden list using fuzzy matching (95% similarity)
   */
  static async isBusinessHidden(businessName, userId) {
    const mappedUserId = this.mapUserId(userId);
    try {
      if (!businessName || !userId) {
        return false;
      }

      console.log(`🔵 [HIDDEN BUSINESS CHECK] Checking: "${businessName}" (User: ${userId})`);

      const { data, error } = await adminClient
        .from('hidden_business_names')
        .select('business_name, is_active')
        .eq('user_id', mappedUserId)
        .eq('is_active', true);

      if (error) {
        console.error('❌ [HIDDEN BUSINESS] Error:', error);
        return false;
      }

      if (!data || data.length === 0) {
        console.log(`🔵 [HIDDEN BUSINESS CHECK] No hidden businesses found for user`);
        return false;
      }

      console.log(`🔵 [HIDDEN BUSINESS CHECK] Found ${data.length} hidden businesses:`);
      
      // Check each hidden business with fuzzy matching
      for (const hiddenBusiness of data) {
        const hiddenName = hiddenBusiness.business_name;
        const similarity = fuzz.ratio(businessName, hiddenName);
        
        console.log(`🔵 [HIDDEN BUSINESS CHECK]   "${businessName}" vs "${hiddenName}" = ${similarity}% similarity`);
        
        if (similarity >= 95) {
          console.log(`✅ [HIDDEN BUSINESS MATCH] "${businessName}" matches "${hiddenName}" (${similarity}%)`);
          return true;
        }
      }
      
      console.log(`🔵 [HIDDEN BUSINESS CHECK] No match found (all below 95% threshold)`);
      return false;

    } catch (error) {
      console.error('💥 [HIDDEN BUSINESS] Error:', error);
      return false;
    }
  }

  /**
   * Check multiple business names against hidden list
   * Returns an object with businessName -> boolean mapping
   */
  static async areBusinessesHidden(businessNames, userId) {
    const mappedUserId = this.mapUserId(userId);
    try {
      if (!businessNames || !Array.isArray(businessNames) || businessNames.length === 0) {
        return {};
      }

      const { data, error } = await adminClient
        .from('hidden_business_names')
        .select('business_name')
        .eq('user_id', mappedUserId)
        .eq('is_active', true)
        .in('business_name', businessNames);

      if (error) {
        console.error('Error checking multiple businesses:', error);
        return {};
      }

      const hiddenSet = new Set((data || []).map(item => item.business_name));
      const result = {};
      
      businessNames.forEach(name => {
        result[name] = hiddenSet.has(name);
      });

      return result;
    } catch (error) {
      console.error('Error in areBusinessesHidden:', error);
      return {};
    }
  }

  /**
   * Add a business name to the hidden list
   */
  static async addHiddenBusiness(userId, businessName, reason = null) {
    const mappedUserId = this.mapUserId(userId);
    try {
      const { data, error } = await adminClient
        .from('hidden_business_names')
        .insert({
          user_id: mappedUserId,
          business_name: businessName,
          reason: reason,
          is_active: true
        })
        .select();

      if (error) {
        console.error('Error adding hidden business:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data[0] };
    } catch (error) {
      console.error('Error in addHiddenBusiness:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a business name from the hidden list
   */
  static async removeHiddenBusiness(userId, businessName) {
    const mappedUserId = this.mapUserId(userId);
    try {
      const { data, error } = await adminClient
        .from('hidden_business_names')
        .delete()
        .eq('user_id', mappedUserId)
        .eq('business_name', businessName)
        .select();

      if (error) {
        console.error('Error removing hidden business:', error);
        return { success: false, error: error.message };
      }

      return { success: true, removed: data.length };
    } catch (error) {
      console.error('Error in removeHiddenBusiness:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = HiddenBusinessService;