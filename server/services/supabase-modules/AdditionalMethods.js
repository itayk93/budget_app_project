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
        flowMonth = null,
        allTime = false,
        year = new Date().getFullYear(), 
        month = new Date().getMonth() + 1,
        hideEmptyCategories = false
      } = options;

      // If allTime is true, get data for all time instead of specific month
      let finalYear = year;
      let finalMonth = month;
      
      if (allTime) {
        // For all-time data, we'll aggregate across all months
        finalYear = null;
        finalMonth = null;
      } else if (flowMonth) {
        // If flowMonth is provided, parse it (format: YYYY-MM)
        const [y, m] = flowMonth.split('-');
        finalYear = parseInt(y);
        finalMonth = parseInt(m);
      }

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
        .eq('excluded_from_flow', false);

      // Add time period filters - use flow_month instead of payment_month
      if (!allTime && finalYear && finalMonth) {
        const flowMonthFilter = `${finalYear}-${finalMonth.toString().padStart(2, '0')}`;
        transactionQuery = transactionQuery.eq('flow_month', flowMonthFilter);
      }

      if (cashFlowId) {
        transactionQuery = transactionQuery.eq('cash_flow_id', cashFlowId);
      }

      const { data: transactions, error: transactionError } = await transactionQuery.order('payment_date', { ascending: true });
      if (transactionError) throw transactionError;

      // Calculate totals by category type
      const categoryTotals = {
        income: 0,
        fixed_expense: 0,
        variable_expense: 0,
        savings: 0
      };

      const categoryBreakdown = {};

      // First, initialize ALL categories from category_order table (even without transactions)
      if (categoryOrderData) {
        categoryOrderData.forEach(categoryOrder => {
          const categoryName = categoryOrder.category_name;
          const categoryType = AdditionalMethods.inferCategoryType(categoryName);
          
          categoryBreakdown[categoryName] = {
            name: categoryName,
            amount: 0,
            count: 0,
            type: categoryType,
            transactions: [],
            display_order: categoryOrder.display_order,
            shared_category: categoryOrder.shared_category || null,
            weekly_display: categoryOrder.weekly_display || false,
            monthly_target: categoryOrder.monthly_target || null,
            use_shared_target: categoryOrder.use_shared_target || false
          };
        });
      }

      // Now process transactions and update existing categories
      (transactions || []).forEach(transaction => {
        const amount = parseFloat(transaction.amount) || 0;
        const categoryName = transaction.category?.name || transaction.category_name || 'Uncategorized';
        const categoryType = transaction.category?.category_type || AdditionalMethods.inferCategoryType(categoryName);
        
        // Get category order info to check if this is non-cash-flow
        const orderInfo = categoryOrderMap.get(categoryName) || {};
        const isNonCashFlow = orderInfo.shared_category === 'לא בתזרים';

        // Update category totals - EXCLUDE non-cash-flow transactions
        if (!isNonCashFlow) {
          if (categoryType === 'income' && amount > 0) {
            categoryTotals.income += amount;
          } else if (categoryType === 'fixed_expense' && amount < 0) {
            categoryTotals.fixed_expense += Math.abs(amount);
          } else if (categoryType === 'variable_expense' && amount < 0) {
            categoryTotals.variable_expense += Math.abs(amount);
          } else if (categoryName.includes('חיסכון')) {
            categoryTotals.savings += Math.abs(amount);
          }
        }

        // Update category breakdown (create if doesn't exist for categories not in category_order)
        if (!categoryBreakdown[categoryName]) {
          const orderInfo = categoryOrderMap.get(categoryName) || {};
          console.log(`⚠️  Creating category ${categoryName} from transaction - orderInfo found:`, orderInfo);
          
          categoryBreakdown[categoryName] = {
            name: categoryName,
            amount: 0,
            count: 0,
            type: categoryType,
            transactions: [],
            display_order: orderInfo.display_order || 999, // Default to end if no order
            shared_category: orderInfo.shared_category || null,
            weekly_display: orderInfo.weekly_display || false,
            monthly_target: orderInfo.monthly_target || null,
            use_shared_target: orderInfo.use_shared_target || false
          };
        }
        categoryBreakdown[categoryName].amount += Math.abs(amount);
        categoryBreakdown[categoryName].count += 1;
        categoryBreakdown[categoryName].transactions.push(transaction);
      });

      // Calculate net balance (already excluding non-cash-flow)
      const totalIncome = categoryTotals.income;
      const totalExpenses = categoryTotals.fixed_expense + categoryTotals.variable_expense;
      const netBalance = totalIncome - totalExpenses;

      // Get monthly goals (only for specific months, not for all time)
      let monthlyGoal = null;
      if (cashFlowId && !allTime && finalYear && finalMonth) {
        const { data: goalData, error: goalError } = await supabase
          .from('monthly_goals')
          .select('*')
          .eq('user_id', userId)
          .eq('cash_flow_id', cashFlowId)
          .eq('year', finalYear)
          .eq('month', finalMonth)
          .maybeSingle();

        if (!goalError && goalData) {
          monthlyGoal = goalData;
        }
      }

      // Process shared categories
      const processedCategories = AdditionalMethods.processSharedCategories(categoryBreakdown, hideEmptyCategories);
      
      // Sort by display order - ensure we're comparing numbers, not strings
      const sortedCategories = Object.values(processedCategories)
        .sort((a, b) => {
          const aOrder = a.display_order !== null && a.display_order !== undefined ? parseInt(a.display_order) : 999;
          const bOrder = b.display_order !== null && b.display_order !== undefined ? parseInt(b.display_order) : 999;
          return aOrder - bOrder;
        });

      // Debug: log all shared categories
      const sharedCategories = Object.values(processedCategories).filter(c => c.is_shared_category);
      if (sharedCategories.length > 0) {
        console.log(`🔍 SERVER DEBUG: Found ${sharedCategories.length} shared categories:`);
        sharedCategories.forEach(category => {
          console.log(`   📁 "${category.name}": ${category.sub_categories ? Object.keys(category.sub_categories).length : 0} sub-categories`);
          if (category.sub_categories) {
            console.log(`      └─ Sub Categories:`, Object.keys(category.sub_categories));
          }
        });
      }

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
        period: allTime ? { all_time: true } : { year: finalYear, month: finalMonth }
      });
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      return SharedUtilities.handleSupabaseError(error, 'get dashboard data');
    }
  }

  // Helper method to process shared categories
  static processSharedCategories(categoryBreakdown, hideEmptyCategories = false) {
    const processedCategories = {};
    const sharedCategoryMap = new Map();

    // First pass: identify all shared categories and their sub-categories
    Object.values(categoryBreakdown).forEach(category => {
      if (category.shared_category && category.use_shared_target) {
        // This category should be grouped under a shared category
        const sharedName = category.shared_category;
        
        if (!sharedCategoryMap.has(sharedName)) {
          // Find the display order for the shared category (use the lowest display_order of its sub-categories)
          const subCategories = Object.values(categoryBreakdown)
            .filter(cat => cat.shared_category === sharedName);
          const sharedDisplayOrder = Math.min(...subCategories.map(cat => 
            cat.display_order !== null && cat.display_order !== undefined ? parseInt(cat.display_order) : 999
          ));
          
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
        
        // Add this category as a sub-category (only if it has transactions or hideEmptyCategories is false)
        if (!hideEmptyCategories || category.count > 0) {
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
        
          // Update shared category totals (only for non-empty categories)
          sharedCategory.amount += category.amount;
          sharedCategory.count += category.count;
          sharedCategory.transactions = sharedCategory.transactions.concat(category.transactions);
        }
      } else {
        // This is a regular category (not shared) - only add if it has transactions or hideEmptyCategories is false
        if (!hideEmptyCategories || category.count > 0) {
          processedCategories[category.name] = {
            ...category,
            spent: category.type === 'income' ? category.amount : -category.amount,
            is_shared_category: false,
            display_order: category.display_order !== null && category.display_order !== undefined ? parseInt(category.display_order) : 999 // Ensure display_order is properly preserved
          };
        }
      }
    });

    // Add all shared categories to the processed categories (only if they have sub-categories or hideEmptyCategories is false)
    sharedCategoryMap.forEach((sharedCategory, sharedName) => {
      const hasSubCategories = Object.keys(sharedCategory.sub_categories).length > 0;
      
      if (!hideEmptyCategories || hasSubCategories) {
        processedCategories[sharedName] = {
          ...sharedCategory,
          spent: sharedCategory.type === 'income' ? sharedCategory.amount : -sharedCategory.amount
        };
      }
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
        .from('category_order')
        .update({
          use_shared_target: useSharedTarget,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('category_name', categoryName)
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
        .eq('flow_month', `${year}-${month.toString().padStart(2, '0')}`)
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
        .select('amount, flow_month')
        .eq('user_id', userId)
        .eq('category_name', categoryName)
        .gte('payment_date', startDate.toISOString().split('T')[0])
        .lte('payment_date', endDate.toISOString().split('T')[0])
        .eq('excluded_from_flow', false)
        .order('payment_date', { ascending: true });

      if (error) throw error;

      // Group by flow_month
      const monthlyData = {};
      (data || []).forEach(transaction => {
        const key = transaction.flow_month;
        if (!monthlyData[key]) {
          const [year, month] = key.split('-');
          monthlyData[key] = {
            year: parseInt(year),
            month: parseInt(month),
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
        })
        .map(item => ({
          amount: item.total_amount,
          month: `${item.year}-${String(item.month).padStart(2, '0')}`,
          year: item.year,
          monthNumber: item.month,
          transaction_count: item.transaction_count
        }));

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

      // Check if there are categories without monthly targets
      const { data: categoriesWithoutTargets, error } = await supabase
        .from('category_order')
        .select('category_name')
        .eq('user_id', userId)
        .is('monthly_target', null);

      if (error) throw error;

      // If there are categories without targets, suggest refresh
      return SharedUtilities.createSuccessResponse(categoriesWithoutTargets && categoriesWithoutTargets.length > 0);
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

      // Get all categories (both with and without targets)
      const { data: allCategories, error: categoriesError } = await supabase
        .from('category_order')
        .select('*')
        .eq('user_id', userId);

      if (categoriesError) throw categoriesError;

      // Get all transactions for this user to calculate averages
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('category_name, amount, payment_date')
        .eq('user_id', userId)
        .eq('excluded_from_flow', false)
        .not('category_name', 'is', null);

      if (transactionsError) throw transactionsError;

      let refreshedCount = 0;
      const results = [];
      
      // Calculate monthly averages for all categories from transactions
      const categoryMonthlyTotals = new Map();
      
      transactions.forEach(transaction => {
        const categoryName = transaction.category_name;
        const date = new Date(transaction.payment_date);
        const monthKey = `${categoryName}_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!categoryMonthlyTotals.has(categoryName)) {
          categoryMonthlyTotals.set(categoryName, new Map());
        }
        
        const categoryMap = categoryMonthlyTotals.get(categoryName);
        const currentTotal = categoryMap.get(monthKey) || 0;
        categoryMap.set(monthKey, currentTotal + Math.abs(parseFloat(transaction.amount || 0)));
      });

      // Process each category to create or update targets
      for (const category of allCategories || []) {
        const categoryName = category.category_name;
        const categoryTotals = categoryMonthlyTotals.get(categoryName);
        
        // Skip categories with insufficient data (less than 2 months)
        if (!categoryTotals || categoryTotals.size < 2) {
          continue;
        }
        
        // Calculate average monthly spending
        const monthlyValues = Array.from(categoryTotals.values());
        const averageMonthlySpending = monthlyValues.reduce((sum, val) => sum + val, 0) / monthlyValues.length;
        const suggestedTarget = Math.round(averageMonthlySpending);
        
        // Only set target if it's meaningful (> 10 NIS) and category doesn't already have a target
        if (suggestedTarget > 10 && (!category.monthly_target || forceRefresh)) {
          await supabase
            .from('category_order')
            .update({ 
              monthly_target: suggestedTarget,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('category_name', categoryName);
          
          refreshedCount++;
          results.push({
            category_name: categoryName,
            old_target: category.monthly_target || 0,
            new_target: suggestedTarget,
            months_analyzed: monthlyValues.length
          });
        }
      }

      // Update last refresh timestamp
      await AdditionalMethods.setUserPreference(userId, 'last_targets_refresh', new Date().toISOString());

      return SharedUtilities.createSuccessResponse({
        refreshed: refreshedCount > 0,
        refreshedCount: refreshedCount,
        totalCategories: allCategories.length,
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