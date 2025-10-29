/**
 * Cash Flow Service for Supabase Operations
 * Extracted from supabaseService.js - Cash flow management operations
 * ~200 lines - Handles all cash flow related database operations
 */

const { supabase } = require('../../config/supabase');
const SharedUtilities = require('./SharedUtilities');

class CashFlowService {

  // ===== CASH FLOW RETRIEVAL =====
  
  static async getCashFlows(userId, userClient = null) {
    try {
      // [CASHFLOW SERVICE] getCashFlows debug log disabled
      SharedUtilities.validateUserId(userId);

      // Use secure client with user context (now uses admin client)
      const client = userClient || await SharedUtilities.createSecureClient(supabase, userId);
      // [CASHFLOW SERVICE] client type log disabled
      
      // Query for user's cash flows
      const { data, error } = await client
        .from('cash_flows')
        .select('*')
        .eq('user_id', userId)  // Explicitly filter by user_id since we're using admin client
        .order('is_default', { ascending: false })
        .order('name');

      // [CASHFLOW SERVICE] verbose query result logs disabled

      if (error) throw error;
      
      const response = SharedUtilities.createSuccessResponse(data || []);
      // [CASHFLOW SERVICE] final response log disabled
      return response;
    } catch (error) {
      console.error('Error fetching cash flows:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch cash flows');
    }
  }

  static async getCashFlow(cashFlowId) {
    try {
      if (!cashFlowId) {
        return SharedUtilities.createErrorResponse('Cash flow ID is required');
      }

      const { data, error } = await supabase
        .from('cash_flows')
        .select('*')
        .eq('id', cashFlowId)
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data);
    } catch (error) {
      console.error('Error fetching cash flow:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch cash flow');
    }
  }

  static async getDefaultCashFlow(userId) {
    try {
      SharedUtilities.validateUserId(userId);
      
      // Use admin client for consistent access
      const client = await SharedUtilities.createSecureClient(supabase, userId);
      // [CASHFLOW SERVICE] getDefaultCashFlow debug log disabled

      // First try to get the default cash flow
      const { data: defaultFlow, error: defaultError } = await client
        .from('cash_flows')
        .select('*')
        .eq('user_id', userId)
        .eq('is_default', true)
        .maybeSingle();

      if (defaultError) throw defaultError;

      if (defaultFlow) {
        // [CASHFLOW SERVICE] default cash flow log disabled
        return SharedUtilities.createSuccessResponse(defaultFlow);
      }

      // If no default found, get the first cash flow for the user
      const { data: firstFlow, error: firstError } = await client
        .from('cash_flows')
        .select('*')
        .eq('user_id', userId)
        .order('created_at')
        .limit(1)
        .maybeSingle();

      if (firstError) throw firstError;

      if (firstFlow) {
        // [CASHFLOW SERVICE] found first cash flow log disabled
        // Set this as default
        await this.updateCashFlow(firstFlow.id, { is_default: true });
        return SharedUtilities.createSuccessResponse(firstFlow);
      }

      // No cash flows found - create a default one
      // [CASHFLOW SERVICE] creating default cash flow log disabled
      const defaultCashFlow = await this.createCashFlow({
        user_id: userId,
        name: 'Default Cash Flow',
        currency: 'ILS',
        is_default: true,
        description: 'Default cash flow created automatically'
      });

      return defaultCashFlow;
    } catch (error) {
      console.error('Error getting default cash flow:', error);
      return SharedUtilities.handleSupabaseError(error, 'get default cash flow');
    }
  }

  // ===== CASH FLOW CREATION =====

  static async createCashFlow(cashFlowData) {
    try {
      const { user_id, name, currency = 'ILS', is_default = false, description = '' } = cashFlowData;

      if (!user_id || !name) {
        return SharedUtilities.createErrorResponse('User ID and cash flow name are required');
      }

      SharedUtilities.validateUserId(user_id);

      // If this is being set as default, unset other defaults first
      if (is_default) {
        await supabase
          .from('cash_flows')
          .update({ is_default: false })
          .eq('user_id', user_id);
      }

      const cashFlowToInsert = {
        user_id,
        name: name.trim(),
        currency: currency.toUpperCase(),
        is_default,
        description: description.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('cash_flows')
        .insert([cashFlowToInsert])
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Cash flow created successfully');
    } catch (error) {
      console.error('Error creating cash flow:', error);
      return SharedUtilities.handleSupabaseError(error, 'create cash flow');
    }
  }

  // ===== CASH FLOW UPDATES =====

  static async updateCashFlow(cashFlowId, cashFlowData) {
    try {
      if (!cashFlowId) {
        return SharedUtilities.createErrorResponse('Cash flow ID is required');
      }

      // Get the current cash flow to get user_id for default logic
      const currentCashFlow = await this.getCashFlow(cashFlowId);
      if (!currentCashFlow.success) {
        return currentCashFlow;
      }

      // If setting as default, unset other defaults first
      if (cashFlowData.is_default === true) {
        await supabase
          .from('cash_flows')
          .update({ is_default: false })
          .eq('user_id', currentCashFlow.data.user_id);
      }

      const updateData = {
        ...cashFlowData,
        updated_at: new Date().toISOString()
      };

      // Validate currency if provided
      if (updateData.currency) {
        updateData.currency = updateData.currency.toUpperCase();
      }

      // Trim name if provided
      if (updateData.name) {
        updateData.name = updateData.name.trim();
      }

      const { data, error } = await supabase
        .from('cash_flows')
        .update(updateData)
        .eq('id', cashFlowId)
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Cash flow updated successfully');
    } catch (error) {
      console.error('Error updating cash flow:', error);
      return SharedUtilities.handleSupabaseError(error, 'update cash flow');
    }
  }

  static async setDefaultCashFlow(userId, cashFlowId) {
    try {
      SharedUtilities.validateUserId(userId);

      if (!cashFlowId) {
        return SharedUtilities.createErrorResponse('Cash flow ID is required');
      }

      // Verify the cash flow belongs to the user
      const cashFlowResult = await this.getCashFlow(cashFlowId);
      if (!cashFlowResult.success) {
        return cashFlowResult;
      }

      if (cashFlowResult.data.user_id !== userId) {
        return SharedUtilities.createErrorResponse('Cash flow does not belong to user');
      }

      // Unset all defaults for the user
      await supabase
        .from('cash_flows')
        .update({ is_default: false })
        .eq('user_id', userId);

      // Set the new default
      return await this.updateCashFlow(cashFlowId, { is_default: true });
    } catch (error) {
      console.error('Error setting default cash flow:', error);
      return SharedUtilities.handleSupabaseError(error, 'set default cash flow');
    }
  }

  // ===== CASH FLOW DELETION =====

  static async deleteCashFlow(cashFlowId) {
    try {
      console.log('🗑️ [CASHFLOW SERVICE] deleteCashFlow called with ID:', cashFlowId);
      
      if (!cashFlowId) {
        console.log('🗑️ [CASHFLOW SERVICE] No cash flow ID provided');
        return SharedUtilities.createErrorResponse('Cash flow ID is required');
      }

      // Get cash flow info first (using direct service call to get success wrapper)
      console.log('🗑️ [CASHFLOW SERVICE] Getting cash flow info...');
      const cashFlowResult = await CashFlowService.getCashFlow(cashFlowId);
      console.log('🗑️ [CASHFLOW SERVICE] Cash flow result:', cashFlowResult);
      console.log('🗑️ [CASHFLOW SERVICE] Cash flow result type:', typeof cashFlowResult);
      console.log('🗑️ [CASHFLOW SERVICE] Cash flow result.success:', cashFlowResult.success);
      
      if (!cashFlowResult.success) {
        console.log('🗑️ [CASHFLOW SERVICE] Cash flow not found');
        return cashFlowResult;
      }

      const cashFlow = cashFlowResult.data;
      console.log('🗑️ [CASHFLOW SERVICE] Cash flow to delete:', cashFlow);

      // Check if this is the only cash flow for the user
      console.log('🗑️ [CASHFLOW SERVICE] Checking user cash flows...');
      const userCashFlows = await this.getCashFlows(cashFlow.user_id);
      console.log('🗑️ [CASHFLOW SERVICE] User cash flows:', userCashFlows);
      
      if (userCashFlows.success && userCashFlows.data.length <= 1) {
        console.log('🗑️ [CASHFLOW SERVICE] Cannot delete - only cash flow for user');
        return SharedUtilities.createErrorResponse('Cannot delete the only cash flow. Create another cash flow first.');
      }

      // First delete all associated transactions
      console.log('🗑️ [CASHFLOW SERVICE] Deleting associated transactions...');
      const { error: transactionError } = await supabase
        .from('transactions')
        .delete()
        .eq('cash_flow_id', cashFlowId);

      if (transactionError) {
        console.log('🗑️ [CASHFLOW SERVICE] Transaction deletion error:', transactionError);
        throw transactionError;
      }

      // Delete associated monthly goals
      console.log('🗑️ [CASHFLOW SERVICE] Deleting associated monthly goals...');
      const { error: goalsError } = await supabase
        .from('monthly_goals')
        .delete()
        .eq('cash_flow_id', cashFlowId);

      if (goalsError) {
        console.log('🗑️ [CASHFLOW SERVICE] Goals deletion error:', goalsError);
        throw goalsError;
      }

      // Then delete the cash flow
      console.log('🗑️ [CASHFLOW SERVICE] Deleting cash flow...');
      const { data, error } = await supabase
        .from('cash_flows')
        .delete()
        .eq('id', cashFlowId)
        .select()
        .single();

      if (error) {
        console.log('🗑️ [CASHFLOW SERVICE] Cash flow deletion error:', error);
        throw error;
      }

      console.log('🗑️ [CASHFLOW SERVICE] Cash flow deleted successfully:', data);

      // If the deleted cash flow was default, set another one as default
      if (cashFlow.is_default) {
        console.log('🗑️ [CASHFLOW SERVICE] Deleted cash flow was default, setting new default...');
        const remainingFlows = await this.getCashFlows(cashFlow.user_id);
        if (remainingFlows.success && remainingFlows.data.length > 0) {
          await this.setDefaultCashFlow(cashFlow.user_id, remainingFlows.data[0].id);
        }
      }

      console.log('🗑️ [CASHFLOW SERVICE] Delete operation completed successfully');
      return SharedUtilities.createSuccessResponse(data, 'Cash flow deleted successfully');
    } catch (error) {
      console.error('🗑️ [CASHFLOW SERVICE] Error deleting cash flow:', error);
      return SharedUtilities.handleSupabaseError(error, 'delete cash flow');
    }
  }

  // ===== CASH FLOW VALIDATION =====

  static async validateCashFlowAccess(userId, cashFlowId) {
    try {
      SharedUtilities.validateUserId(userId);

      if (!cashFlowId) {
        return SharedUtilities.createErrorResponse('Cash flow ID is required');
      }

      const { data, error } = await supabase
        .from('cash_flows')
        .select('id, user_id')
        .eq('id', cashFlowId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return SharedUtilities.createErrorResponse('Cash flow not found or access denied');
        }
        throw error;
      }

      return SharedUtilities.createSuccessResponse(true, 'Access validated');
    } catch (error) {
      console.error('Error validating cash flow access:', error);
      return SharedUtilities.handleSupabaseError(error, 'validate cash flow access');
    }
  }

  // ===== CASH FLOW STATISTICS =====

  static async getCashFlowStatistics(cashFlowId) {
    try {
      if (!cashFlowId) {
        return SharedUtilities.createErrorResponse('Cash flow ID is required');
      }

      // Get transaction count
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select('id')
        .eq('cash_flow_id', cashFlowId);

      if (transactionError) throw transactionError;

      // Get total amounts by category type
      const { data: amountData, error: amountError } = await supabase
        .from('transactions')
        .select('amount, category_name')
        .eq('cash_flow_id', cashFlowId)
        .not('amount', 'is', null);

      if (amountError) throw amountError;

      const statistics = {
        transaction_count: transactionData?.length || 0,
        total_amount: amountData?.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) || 0,
        categories_used: [...new Set(amountData?.map(t => t.category_name).filter(Boolean))] || []
      };

      return SharedUtilities.createSuccessResponse(statistics);
    } catch (error) {
      console.error('Error getting cash flow statistics:', error);
      return SharedUtilities.handleSupabaseError(error, 'get cash flow statistics');
    }
  }
}

module.exports = CashFlowService;
