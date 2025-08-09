/**
 * Additional Missing Methods from Original SupabaseService
 * Critical methods for dashboard, preferences, and advanced category features
 */

const { supabase } = require('../../config/supabase');
const SharedUtilities = require('./SharedUtilities');

class AdditionalMethods {

  // ===== DASHBOARD DATA =====
  static async getDashboardData(userId, options = {}) {
    try {
      SharedUtilities.validateUserId(userId);

      const { 
        cashFlowId = null, 
        year = new Date().getFullYear(), 
        month = new Date().getMonth() + 1 
      } = options;

      // Get category order settings for the user
      const { data: categoryOrderData, error: categoryOrderError } = await supabase
        .from('category_order')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true });

      if (categoryOrderError) {
        console.error('Error fetching category order:', categoryOrderError);
        // Continue without category order if there's an error
      }

      // Create a map for quick category order lookup
      const categoryOrderMap = new Map();
      if (categoryOrderData) {
        categoryOrderData.forEach(cat => {
          categoryOrderMap.set(cat.category_name, {
            display_order: cat.display_order,
            shared_category: cat.shared_category,
            weekly_display: cat.weekly_display,
            monthly_target: cat.monthly_target,
            use_shared_target: cat.use_shared_target
          });
        });
      }

      // Get transactions for the specified period
      let transactionQuery = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('payment_year', year)
        .eq('payment_month', month)
        .eq('excluded_from_flow', false);

      if (cashFlowId) {
        transactionQuery = transactionQuery.eq('cash_flow_id', cashFlowId);
      }

      const { data: transactions, error: transactionError } = await transactionQuery;
      if (transactionError) throw transactionError;

      // Calculate totals by category type
      const categoryTotals = {
        income: 0,
        fixed_expense: 0,
        variable_expense: 0,
        savings: 0
      };

      const categoryBreakdown = {};

      (transactions || []).forEach(transaction => {
        const amount = parseFloat(transaction.amount) || 0;
        const categoryName = transaction.category?.name || transaction.category_name || 'Uncategorized';
        const categoryType = transaction.category?.category_type || AdditionalMethods.inferCategoryType(categoryName);

        // Update category totals
        if (categoryType === 'income' && amount > 0) {
          categoryTotals.income += amount;
        } else if (categoryType === 'fixed_expense' && amount < 0) {
          categoryTotals.fixed_expense += Math.abs(amount);
        } else if (categoryType === 'variable_expense' && amount < 0) {
          categoryTotals.variable_expense += Math.abs(amount);
        } else if (categoryName.includes('חיסכון')) {
          categoryTotals.savings += Math.abs(amount);
        }

        // Update category breakdown
        if (!categoryBreakdown[categoryName]) {
          const orderInfo = categoryOrderMap.get(categoryName) || {};
          
          categoryBreakdown[categoryName] = {
            name: categoryName,
            amount: 0,
            count: 0,
            type: categoryType,
            transactions: [], // Add transactions array
            display_order: orderInfo.display_order || 999, // Default to end if no order
            shared_category: orderInfo.shared_category || null,
            weekly_display: orderInfo.weekly_display || false,
            monthly_target: orderInfo.monthly_target || null,
            use_shared_target: orderInfo.use_shared_target || false
          };
        }
        categoryBreakdown[categoryName].amount += Math.abs(amount);
        categoryBreakdown[categoryName].count += 1;
        categoryBreakdown[categoryName].transactions.push(transaction); // Add the transaction
      });

      // Calculate net balance
      const totalIncome = categoryTotals.income;
      const totalExpenses = categoryTotals.fixed_expense + categoryTotals.variable_expense;
      const netBalance = totalIncome - totalExpenses;

      // Get monthly goals
      let monthlyGoal = null;
      if (cashFlowId) {
        const { data: goalData, error: goalError } = await supabase
          .from('monthly_goals')
          .select('*')
          .eq('user_id', userId)
          .eq('cash_flow_id', cashFlowId)
          .eq('year', year)
          .eq('month', month)
          .maybeSingle();

        if (!goalError && goalData) {
          monthlyGoal = goalData;
        }
      }

      // Process shared categories
      const processedCategories = AdditionalMethods.processSharedCategories(categoryBreakdown);
      
      // Sort by display order
      const sortedCategories = Object.values(processedCategories)
        .sort((a, b) => a.display_order - b.display_order);

      return SharedUtilities.createSuccessResponse({
        summary: {
          total_income: totalIncome,
          total_expenses: totalExpenses,
          net_balance: netBalance,
          savings: categoryTotals.savings
        },
        category_totals: categoryTotals,
        category_breakdown: sortedCategories,
        monthly_goal: monthlyGoal,
        transaction_count: transactions ? transactions.length : 0,
        period: { year, month }
      });
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      return SharedUtilities.handleSupabaseError(error, 'get dashboard data');
    }
  }

  // Helper method to process shared categories
  static processSharedCategories(categoryBreakdown) {
    const processedCategories = {};
    const sharedCategoryMap = new Map();

    // First pass: identify all shared categories and their sub-categories
    Object.values(categoryBreakdown).forEach(category => {
      if (category.shared_category && category.use_shared_target) {
        // This category should be grouped under a shared category
        const sharedName = category.shared_category;
        
        if (!sharedCategoryMap.has(sharedName)) {
          // Find the display order for the shared category (use the lowest display_order of its sub-categories)
          const sharedDisplayOrder = Math.min(
            ...Object.values(categoryBreakdown)
              .filter(cat => cat.shared_category === sharedName)
              .map(cat => cat.display_order)
          );
          
          sharedCategoryMap.set(sharedName, {
            name: sharedName,
            amount: 0,
            count: 0,
            type: category.type,
            transactions: [],
            display_order: sharedDisplayOrder,
            is_shared_category: true,
            sub_categories: {},
            shared_category: null,
            weekly_display: false,
            monthly_target: null,
            use_shared_target: false
          });
        }
        
        const sharedCategory = sharedCategoryMap.get(sharedName);
        
        // Add this category as a sub-category
        sharedCategory.sub_categories[category.name] = {
          name: category.name,
          amount: category.amount,
          count: category.count,
          spent: category.type === 'income' ? category.amount : -category.amount,
          transactions: category.transactions,
          display_order: category.display_order,
          weekly_display: category.weekly_display,
          monthly_target: category.monthly_target,
          use_shared_target: category.use_shared_target
        };
        
        // Update shared category totals
        sharedCategory.amount += category.amount;
        sharedCategory.count += category.count;
        sharedCategory.transactions = sharedCategory.transactions.concat(category.transactions);
      } else {
        // This is a regular category (not shared)
        processedCategories[category.name] = {
          ...category,
          spent: category.type === 'income' ? category.amount : -category.amount,
          is_shared_category: false
        };
      }
    });

    // Add all shared categories to the processed categories
    sharedCategoryMap.forEach((sharedCategory, sharedName) => {
      processedCategories[sharedName] = {
        ...sharedCategory,
        spent: sharedCategory.type === 'income' ? sharedCategory.amount : -sharedCategory.amount
      };
    });

    return processedCategories;
  }

  // Helper method to infer category type from name
  static inferCategoryType(categoryName) {
    const name = categoryName.toLowerCase();
    
    if (name.includes('הכנסות') || name.includes('משכורת') || name.includes('פרילנס')) {
      return 'income';
    } else if (name.includes('קבועות') || name.includes('ביטוח') || name.includes('ארנונה')) {
      return 'fixed_expense';
    } else if (name.includes('חיסכון') || name.includes('השקעות')) {
      return 'savings';
    } else {
      return 'variable_expense';
    }
  }

  // ===== USER PREFERENCES =====
  static async getUserPreference(userId, preferenceKey) {
    try {
      SharedUtilities.validateUserId(userId);

      if (!preferenceKey) {
        return SharedUtilities.createErrorResponse('Preference key is required');
      }

      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', userId)
        .eq('preference_key', preferenceKey)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      const value = data ? JSON.parse(data.preference_value) : null;
      return SharedUtilities.createSuccessResponse(value);
    } catch (error) {
      console.error('Error getting user preference:', error);
      return SharedUtilities.handleSupabaseError(error, 'get user preference');
    }
  }

  static async setUserPreference(userId, preferenceKey, preferenceValue) {
    try {
      SharedUtilities.validateUserId(userId);

      if (!preferenceKey) {
        return SharedUtilities.createErrorResponse('Preference key is required');
      }

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
      return SharedUtilities.createSuccessResponse(data, 'User preference saved successfully');
    } catch (error) {
      console.error('Error setting user preference:', error);
      return SharedUtilities.handleSupabaseError(error, 'set user preference');
    }
  }

  // ===== SHARED CATEGORY TARGETS =====
  static async getSharedCategoryTarget(userId, sharedCategoryName) {
    try {
      SharedUtilities.validateUserId(userId);

      if (!sharedCategoryName) {
        return SharedUtilities.createErrorResponse('Shared category name is required');
      }

      const { data, error } = await supabase
        .from('shared_category_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('shared_category_name', sharedCategoryName)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return SharedUtilities.createSuccessResponse(data);
    } catch (error) {
      console.error('Error getting shared category target:', error);
      return SharedUtilities.handleSupabaseError(error, 'get shared category target');
    }
  }

  static async updateSharedCategoryTarget(userId, sharedCategoryName, monthlyTarget, weeklyDisplay = false) {
    try {
      SharedUtilities.validateUserId(userId);

      if (!sharedCategoryName) {
        return SharedUtilities.createErrorResponse('Shared category name is required');
      }

      if (monthlyTarget !== null && monthlyTarget !== undefined) {
        SharedUtilities.validateAmount(monthlyTarget);
      }

      const { data, error } = await supabase
        .from('shared_category_targets')
        .upsert({
          user_id: userId,
          shared_category_name: sharedCategoryName,
          monthly_target: monthlyTarget,
          weekly_display: weeklyDisplay,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,shared_category_name'
        })
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Shared category target updated successfully');
    } catch (error) {
      console.error('Error updating shared category target:', error);
      return SharedUtilities.handleSupabaseError(error, 'update shared category target');
    }
  }

  static async setUseSharedTarget(userId, categoryName, useSharedTarget) {
    try {
      SharedUtilities.validateUserId(userId);

      if (!categoryName) {
        return SharedUtilities.createErrorResponse('Category name is required');
      }

      const { data, error } = await supabase
        .from('category_targets')
        .upsert({
          user_id: userId,
          category_name: categoryName,
          use_shared_target: useSharedTarget,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,category_name'
        })
        .select()
        .single();

      if (error) throw error;
      return SharedUtilities.createSuccessResponse(data, 'Shared target setting updated successfully');
    } catch (error) {
      console.error('Error setting use shared target:', error);
      return SharedUtilities.handleSupabaseError(error, 'set use shared target');
    }
  }

  // ===== SPENDING HISTORY =====
  static async getCategoryMonthlySpending(userId, categoryName, year, month) {
    try {
      SharedUtilities.validateUserId(userId);

      if (!categoryName || !year || !month) {
        return SharedUtilities.createErrorResponse('Category name, year, and month are required');
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('category_name', categoryName)
        .eq('payment_year', year)
        .eq('payment_month', month)
        .eq('excluded_from_flow', false);

      if (error) throw error;

      const totalSpending = (data || []).reduce((sum, transaction) => {
        return sum + Math.abs(parseFloat(transaction.amount) || 0);
      }, 0);

      return SharedUtilities.createSuccessResponse({
        category_name: categoryName,
        total_spending: totalSpending,
        transaction_count: data ? data.length : 0,
        year,
        month
      });
    } catch (error) {
      console.error('Error getting category monthly spending:', error);
      return SharedUtilities.handleSupabaseError(error, 'get category monthly spending');
    }
  }

  static async getCategorySpendingHistory(userId, categoryName, months = 12) {
    try {
      SharedUtilities.validateUserId(userId);

      if (!categoryName) {
        return SharedUtilities.createErrorResponse('Category name is required');
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, payment_year, payment_month')
        .eq('user_id', userId)
        .eq('category_name', categoryName)
        .gte('payment_date', startDate.toISOString().split('T')[0])
        .lte('payment_date', endDate.toISOString().split('T')[0])
        .eq('excluded_from_flow', false)
        .order('payment_date', { ascending: true });

      if (error) throw error;

      // Group by month
      const monthlyData = {};
      (data || []).forEach(transaction => {
        const key = `${transaction.payment_year}-${String(transaction.payment_month).padStart(2, '0')}`;
        if (!monthlyData[key]) {
          monthlyData[key] = {
            year: transaction.payment_year,
            month: transaction.payment_month,
            total_amount: 0,
            transaction_count: 0
          };
        }
        monthlyData[key].total_amount += Math.abs(parseFloat(transaction.amount) || 0);
        monthlyData[key].transaction_count += 1;
      });

      const history = Object.values(monthlyData)
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });

      return SharedUtilities.createSuccessResponse({
        category_name: categoryName,
        months_analyzed: months,
        history,
        total_months_with_data: history.length
      });
    } catch (error) {
      console.error('Error getting category spending history:', error);
      return SharedUtilities.handleSupabaseError(error, 'get category spending history');
    }
  }

  // ===== WEEKLY TARGET CALCULATIONS =====
  static async calculateWeeklyTarget(monthlyTarget, currentWeek, totalWeeksInMonth) {
    try {
      if (!monthlyTarget || !currentWeek || !totalWeeksInMonth) {
        return SharedUtilities.createErrorResponse('Monthly target, current week, and total weeks are required');
      }

      const weeklyTarget = parseFloat(monthlyTarget) / totalWeeksInMonth;
      const targetThisWeek = weeklyTarget * currentWeek;
      const remainingWeeks = totalWeeksInMonth - currentWeek;
      const remainingTarget = parseFloat(monthlyTarget) - targetThisWeek;

      return SharedUtilities.createSuccessResponse({
        monthly_target: parseFloat(monthlyTarget),
        weekly_target: Math.round(weeklyTarget * 100) / 100,
        target_through_week: Math.round(targetThisWeek * 100) / 100,
        remaining_target: Math.round(remainingTarget * 100) / 100,
        current_week: currentWeek,
        total_weeks: totalWeeksInMonth,
        remaining_weeks: remainingWeeks
      });
    } catch (error) {
      console.error('Error calculating weekly target:', error);
      return SharedUtilities.handleSupabaseError(error, 'calculate weekly target');
    }
  }

  // ===== TARGET REFRESH METHODS =====
  static async shouldRefreshMonthlyTargets(userId) {
    try {
      SharedUtilities.validateUserId(userId);

      // Simplified: always return false for now to avoid errors
      // This prevents the monthly targets refresh from causing issues
      return SharedUtilities.createSuccessResponse(false);
    } catch (error) {
      console.error('Error checking if should refresh monthly targets:', error);
      return SharedUtilities.createSuccessResponse(false); // Default to no refresh on error
    }
  }

  static async refreshMonthlyTargetsForNewMonth(userId, forceRefresh = false) {
    try {
      SharedUtilities.validateUserId(userId);

      if (!forceRefresh) {
        const shouldRefreshResult = await AdditionalMethods.shouldRefreshMonthlyTargets(userId);
        if (!shouldRefreshResult.success || !shouldRefreshResult.data) {
          return SharedUtilities.createSuccessResponse({ refreshed: false, reason: 'Not needed' });
        }
      }

      // Get all category targets
      const { data: categoryTargets, error: targetsError } = await supabase
        .from('category_targets')
        .select('*')
        .eq('user_id', userId);

      if (targetsError) throw targetsError;

      let refreshedCount = 0;
      const results = [];

      // Process each category target
      for (const target of categoryTargets || []) {
        if (target.monthly_target && target.monthly_target > 0) {
          // Calculate new target based on historical data if needed
          const avgResult = await AdditionalMethods.calculateMonthlyAverage(userId, target.category_name, 3);
          
          if (avgResult.success && avgResult.data.average > 0) {
            const newTarget = Math.round(avgResult.data.average);
            
            if (newTarget !== target.monthly_target) {
              await supabase
                .from('category_targets')
                .update({ 
                  monthly_target: newTarget,
                  updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .eq('category_name', target.category_name);
              
              refreshedCount++;
              results.push({
                category_name: target.category_name,
                old_target: target.monthly_target,
                new_target: newTarget
              });
            }
          }
        }
      }

      // Update last refresh timestamp
      await AdditionalMethods.setUserPreference(userId, 'last_targets_refresh', new Date().toISOString());

      return SharedUtilities.createSuccessResponse({
        refreshed: true,
        categories_updated: refreshedCount,
        updates: results
      });
    } catch (error) {
      console.error('Error refreshing monthly targets:', error);
      return SharedUtilities.handleSupabaseError(error, 'refresh monthly targets');
    }
  }

  static async calculateAndUpdateSharedCategoryTargets(userId, forceRefresh = false) {
    try {
      SharedUtilities.validateUserId(userId);

      // Get all shared category targets
      const { data: sharedTargets, error: targetsError } = await supabase
        .from('shared_category_targets')
        .select('*')
        .eq('user_id', userId);

      if (targetsError) throw targetsError;

      const results = [];

      for (const sharedTarget of sharedTargets || []) {
        // Calculate spending for this shared category
        const spendingResult = await AdditionalMethods.getSharedCategoryMonthlySpending(
          userId, 
          sharedTarget.shared_category_name, 
          new Date().getFullYear(), 
          new Date().getMonth() + 1
        );

        if (spendingResult.success) {
          const currentSpending = spendingResult.data.total_spending;
          const targetAmount = sharedTarget.monthly_target || 0;

          results.push({
            shared_category_name: sharedTarget.shared_category_name,
            monthly_target: targetAmount,
            current_spending: currentSpending,
            remaining_budget: targetAmount - currentSpending,
            percentage_used: targetAmount > 0 ? (currentSpending / targetAmount) * 100 : 0,
            is_over_budget: currentSpending > targetAmount
          });
        }
      }

      return SharedUtilities.createSuccessResponse({
        shared_category_analysis: results,
        total_shared_categories: results.length,
        analysis_date: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error calculating shared category targets:', error);
      return SharedUtilities.handleSupabaseError(error, 'calculate shared category targets');
    }
  }

  // ===== CATEGORY TYPE INFERENCE =====
  static inferCategoryType(categoryName) {
    try {
      if (!categoryName || typeof categoryName !== 'string') {
        return 'variable_expense'; // Default fallback
      }

      const name = categoryName.toLowerCase();

      // Income categories
      if (name.includes('הכנסות') || name.includes('משכורת') || name.includes('פרמיות') || 
          name.includes('בונוסים') || name.includes('income') || name.includes('salary') ||
          name.includes('dividend') || name.includes('interest') || name.includes('פנסיה') ||
          name.includes('קבלה') || name.includes('מענק') || name.includes('החזר')) {
        return 'income';
      }

      // Fixed expenses categories
      if (name.includes('קבועות') || name.includes('ביטוח') || name.includes('משכנתא') || 
          name.includes('שכר דירה') || name.includes('אגרות') || name.includes('תשלומים') ||
          name.includes('קבוע') || name.includes('fixed') || name.includes('recurring') ||
          name.includes('subscription') || name.includes('מנוי') || name.includes('חשמל') ||
          name.includes('מים') || name.includes('גז') || name.includes('טלפון') ||
          name.includes('אינטרנט') || name.includes('נטפליקס') || name.includes('ספוטיפיי')) {
        return 'fixed_expense';
      }

      // Savings categories
      if (name.includes('חיסכון') || name.includes('השקעות') || name.includes('savings') || 
          name.includes('investment') || name.includes('פנסיה מנהלים') || 
          name.includes('קופת גמל') || name.includes('תגמולים')) {
        return 'savings';
      }

      // Default to variable expense for all other categories
      return 'variable_expense';
    } catch (error) {
      console.error('Error inferring category type:', error);
      return 'variable_expense'; // Safe fallback
    }
  }
}

module.exports = AdditionalMethods;