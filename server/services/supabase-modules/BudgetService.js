/**
 * Budget Service for Supabase Operations
 * Extracted from supabaseService.js - Budget and goal management operations
 * ~400 lines - Handles budgets, monthly goals, and financial targets
 */

const { adminClient, createUserClient } = require('../../config/supabase');
const SharedUtilities = require('./SharedUtilities');

class BudgetService {

  // ===== MONTHLY BUDGET MANAGEMENT =====
  
  static async getMonthlyBudgets(userId, year, month, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      const { data, error } = await client
        .from('budgets')
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
      return SharedUtilities.createSuccessResponse(data || []);
    } catch (error) {
      console.error('Error fetching monthly budgets:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch monthly budgets');
    }
  }

  static async createMonthlyBudget(budgetData, userClient = null) {
    try {
      const { user_id, category_id, year, month, budget_amount } = budgetData;

      if (!user_id || !year || !month || budget_amount === undefined) {
        return SharedUtilities.createErrorResponse('User ID, year, month, and budget amount are required');
      }

      SharedUtilities.validateUserId(user_id);
      SharedUtilities.validateAmount(budget_amount);
      const client = userClient || adminClient;

      const budgetToInsert = {
        ...budgetData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from('budgets')
        .insert([budgetToInsert])
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Monthly budget created successfully');
    } catch (error) {
      console.error('Error creating monthly budget:', error);
      return SharedUtilities.handleSupabaseError(error, 'create monthly budget');
    }
  }

  static async updateMonthlyBudget(budgetId, updateData, userClient = null) {
    try {
      if (!budgetId) {
        return SharedUtilities.createErrorResponse('Budget ID is required');
      }

      if (updateData.budget_amount !== undefined) {
        SharedUtilities.validateAmount(updateData.budget_amount);
      }
      const client = userClient || adminClient;

      const processedUpdateData = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from('budgets')
        .update(processedUpdateData)
        .eq('id', budgetId)
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Monthly budget updated successfully');
    } catch (error) {
      console.error('Error updating monthly budget:', error);
      return SharedUtilities.handleSupabaseError(error, 'update monthly budget');
    }
  }

  static async deleteMonthlyBudget(budgetId, userClient = null) {
    try {
      if (!budgetId) {
        return SharedUtilities.createErrorResponse('Budget ID is required');
      }
      const client = userClient || adminClient;

      const { data, error } = await client
        .from('budgets')
        .delete()
        .eq('id', budgetId)
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Monthly budget deleted successfully');
    } catch (error) {
      console.error('Error deleting monthly budget:', error);
      return SharedUtilities.handleSupabaseError(error, 'delete monthly budget');
    }
  }

  // ===== MONTHLY GOALS MANAGEMENT =====

  static async getMonthlySavings(userId, cashFlowId, year, month, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      const { data, error } = await client
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('cash_flow_id', cashFlowId)
        .eq('flow_month', `${year}-${month.toString().padStart(2, '0')}`)
        .eq('category_name', 'חיסכון')
        .eq('excluded_from_flow', false);

      if (error) throw error;

      const totalSavings = (data || []).reduce((sum, transaction) => {
        return sum + (parseFloat(transaction.amount) || 0);
      }, 0);

      return SharedUtilities.createSuccessResponse(Math.abs(totalSavings));
    } catch (error) {
      console.error('Error calculating monthly savings:', error);
      return SharedUtilities.handleSupabaseError(error, 'calculate monthly savings');
    }
  }

  static async getMonthlyGoal(userId, cashFlowId, year, month, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      const { data, error } = await client
        .from('monthly_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('cash_flow_id', cashFlowId)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return SharedUtilities.createSuccessResponse(null); // No goal found
        }
        throw error;
      }

      return SharedUtilities.createSuccessResponse(data);
    } catch (error) {
      console.error('Error fetching monthly goal:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch monthly goal');
    }
  }

  static async saveMonthlyGoal(userId, goalData, userClient = null) {
    try {
      const { cash_flow_id, year, month, goal_amount, description } = goalData;

      if (!userId || !cash_flow_id || !year || !month || goal_amount === undefined) {
        return SharedUtilities.createErrorResponse('All goal fields are required');
      }

      SharedUtilities.validateUserId(userId);
      SharedUtilities.validateAmount(goal_amount);
      const client = userClient || adminClient;

      const goalToSave = {
        user_id: userId,
        cash_flow_id,
        year: parseInt(year),
        month: parseInt(month),
        goal_amount: parseFloat(goal_amount),
        description: description || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Use upsert to handle both create and update
      const { data, error } = await client
        .from('monthly_goals')
        .upsert(goalToSave, {
          onConflict: 'user_id,cash_flow_id,year,month'
        })
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Monthly goal saved successfully');
    } catch (error) {
      console.error('Error saving monthly goal:', error);
      return SharedUtilities.handleSupabaseError(error, 'save monthly goal');
    }
  }

  static async deleteMonthlyGoal(userId, cashFlowId, year, month, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      if (!cashFlowId || !year || !month) {
        return SharedUtilities.createErrorResponse('Cash flow ID, year, and month are required');
      }

      const { data, error } = await client
        .from('monthly_goals')
        .delete()
        .eq('user_id', userId)
        .eq('cash_flow_id', cashFlowId)
        .eq('year', year)
        .eq('month', month)
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Monthly goal deleted successfully');
    } catch (error) {
      console.error('Error deleting monthly goal:', error);
      return SharedUtilities.handleSupabaseError(error, 'delete monthly goal');
    }
  }

  // ===== GOAL TO TRANSACTION CONVERSION =====

  static async addGoalAsExpense(userId, goalData, userClient = null) {
    try {
      const { cash_flow_id, year, month, description } = goalData;

      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      // Get the goal first
      const goalResult = await this.getMonthlyGoal(userId, cash_flow_id, year, month, client);
      if (!goalResult.success || !goalResult.data) {
        return SharedUtilities.createErrorResponse('Monthly goal not found');
      }

      const goal = goalResult.data;

      // Create expense transaction
      const expenseData = {
        user_id: userId,
        cash_flow_id,
        business_name: description || 'Monthly Goal Expense',
        amount: -Math.abs(parseFloat(goal.goal_amount)), // Negative for expense
        payment_date: new Date(year, month - 1, 1).toISOString().split('T')[0],
        payment_year: year,
        payment_month: month,
        flow_month: `${year}-${month.toString().padStart(2, '0')}`,
        category_name: 'חיסכון',
        notes: `Goal converted to expense: ${goal.description}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from('transactions')
        .insert([expenseData])
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Goal added as expense successfully');
    } catch (error) {
      console.error('Error adding goal as expense:', error);
      return SharedUtilities.handleSupabaseError(error, 'add goal as expense');
    }
  }

  static async removeGoalExpense(userId, cashFlowId, year, month, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      const { data, error } = await client
        .from('transactions')
        .delete()
        .eq('user_id', userId)
        .eq('cash_flow_id', cashFlowId)
        .eq('flow_month', `${year}-${month.toString().padStart(2, '0')}`)
        .eq('category_name', 'חיסכון')
        .like('notes', '%Goal converted to expense%')
        .select();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Goal expenses removed successfully');
    } catch (error) {
      console.error('Error removing goal expense:', error);
      return SharedUtilities.handleSupabaseError(error, 'remove goal expense');
    }
  }

  static async addGoalAsFutureIncome(userId, goalData, isNextMonth = true, userClient = null) {
    try {
      const { cash_flow_id, year, month, description } = goalData;

      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      // Get the goal first
      const goalResult = await this.getMonthlyGoal(userId, cash_flow_id, year, month, client);
      if (!goalResult.success || !goalResult.data) {
        return SharedUtilities.createErrorResponse('Monthly goal not found');
      }

      const goal = goalResult.data;

      // Calculate target date (next month if isNextMonth is true)
      let targetYear = year;
      let targetMonth = month;
      
      if (isNextMonth) {
        targetMonth += 1;
        if (targetMonth > 12) {
          targetMonth = 1;
          targetYear += 1;
        }
      }

      // Create income transaction
      const incomeData = {
        user_id: userId,
        cash_flow_id,
        business_name: description || 'Monthly Goal Income',
        amount: Math.abs(parseFloat(goal.goal_amount)), // Positive for income
        payment_date: new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0],
        payment_year: targetYear,
        payment_month: targetMonth,
        flow_month: `${targetYear}-${targetMonth.toString().padStart(2, '0')}`,
        category_name: 'הכנסות',
        notes: `Goal converted to future income: ${goal.description}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from('transactions')
        .insert([incomeData])
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Goal added as future income successfully');
    } catch (error) {
      console.error('Error adding goal as future income:', error);
      return SharedUtilities.handleSupabaseError(error, 'add goal as future income');
    }
  }

  static async removeGoalIncome(userId, cashFlowId, year, month, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      const { data, error } = await client
        .from('transactions')
        .delete()
        .eq('user_id', userId)
        .eq('cash_flow_id', cashFlowId)
        .eq('flow_month', `${year}-${month.toString().padStart(2, '0')}`)
        .eq('category_name', 'הכנסות')
        .like('notes', '%Goal converted to future income%')
        .select();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Goal income removed successfully');
    } catch (error) {
      console.error('Error removing goal income:', error);
      return SharedUtilities.handleSupabaseError(error, 'remove goal income');
    }
  }

  // ===== CATEGORY MONTHLY TARGETS =====

  static async updateCategoryMonthlyTarget(userId, categoryName, monthlyTarget, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      if (!categoryName) {
        return SharedUtilities.createErrorResponse('Category name is required');
      }

      if (monthlyTarget !== null && monthlyTarget !== undefined) {
        SharedUtilities.validateAmount(monthlyTarget);
      }

      const { data, error } = await client
        .from('category_targets')
        .upsert({
          user_id: userId,
          category_name: categoryName,
          monthly_target: monthlyTarget,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,category_name'
        })
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Category monthly target updated successfully');
    } catch (error) {
      console.error('Error updating category monthly target:', error);
      return SharedUtilities.handleSupabaseError(error, 'update category monthly target');
    }
  }

  static async getCategoryMonthlyTarget(userId, categoryName, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      if (!categoryName) {
        return SharedUtilities.createErrorResponse('Category name is required');
      }

      const { data, error } = await client
        .from('category_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('category_name', categoryName)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return SharedUtilities.createSuccessResponse(null); // No target found
        }
        throw error;
      }

      return SharedUtilities.createSuccessResponse(data);
    } catch (error) {
      console.error('Error fetching category monthly target:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch category monthly target');
    }
  }

  // ===== BUDGET ANALYSIS =====

  static async getBudgetAnalysis(userId, cashFlowId, year, month, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      // Get monthly budgets
      const budgetsResult = await this.getMonthlyBudgets(userId, year, month, client);
      if (!budgetsResult.success) {
        return budgetsResult;
      }

      // Get actual spending for the month
      const { data: transactions, error: transactionError } = await client
        .from('transactions')
        .select('amount, category_name, category_id')
        .eq('user_id', userId)
        .eq('cash_flow_id', cashFlowId)
        .eq('flow_month', `${year}-${month.toString().padStart(2, '0')}`)
        .eq('excluded_from_flow', false);

      if (transactionError) throw transactionError;

      // Calculate spending by category
      const spendingByCategory = {};
      (transactions || []).forEach(transaction => {
        const categoryKey = transaction.category_id || transaction.category_name || 'Uncategorized';
        const amount = Math.abs(parseFloat(transaction.amount) || 0);
        
        if (!spendingByCategory[categoryKey]) {
          spendingByCategory[categoryKey] = 0;
        }
        spendingByCategory[categoryKey] += amount;
      });

      // Compare budgets with actual spending
      const analysis = budgetsResult.data.map(budget => {
        const categoryKey = budget.category_id || budget.category?.name || 'Uncategorized';
        const actualSpending = spendingByCategory[categoryKey] || 0;
        const budgetAmount = parseFloat(budget.budget_amount) || 0;
        
        return {
          ...budget,
          actual_spending: actualSpending,
          remaining_budget: budgetAmount - actualSpending,
          percentage_used: budgetAmount > 0 ? (actualSpending / budgetAmount) * 100 : 0,
          is_over_budget: actualSpending > budgetAmount
        };
      });

      return SharedUtilities.createSuccessResponse({
        budgets: analysis,
        total_budgeted: analysis.reduce((sum, item) => sum + (parseFloat(item.budget_amount) || 0), 0),
        total_spent: analysis.reduce((sum, item) => sum + item.actual_spending, 0)
      });
    } catch (error) {
      console.error('Error analyzing budget:', error);
      return SharedUtilities.handleSupabaseError(error, 'analyze budget');
    }
  }
}

module.exports = BudgetService;