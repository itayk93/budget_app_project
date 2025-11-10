import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET
);

// Helper function for Hebrew month names
function getHebrewMonthName(month) {
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
  return hebrewMonths[month] || `חודש ${month}`;
}

// Authentication middleware
async function authenticateToken(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new Error('Access token is required');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req);
    const userId = user.id;

    let { flow_month, cash_flow, all_time, year, month, format } = req.query;
    
    // Handle null/empty values
    if (cash_flow === 'null' || cash_flow === '') {
      cash_flow = null;
    }
    
    // Get default cash flow if none provided
    if (!cash_flow) {
      const { data: defaultCashFlow } = await supabase
        .from('cash_flows')
        .select('*')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();
      
      if (!defaultCashFlow) {
        return res.status(400).json({ 
          error: 'No cash flows available. Please create a cash flow first.' 
        });
      }
      cash_flow = defaultCashFlow.id;
    }

    const allTime = all_time === '1' || all_time === 'true';
    let finalYear = null, finalMonth = null;

    // Parse and validate date parameters
    if (!allTime) {
      if (year && month) {
        finalYear = parseInt(year);
        finalMonth = parseInt(month);
        flow_month = `${finalYear}-${finalMonth.toString().padStart(2, '0')}`;
      } else {
        // Default to current month
        const now = new Date();
        finalYear = now.getFullYear();
        finalMonth = now.getMonth() + 1;
        flow_month = `${finalYear}-${finalMonth.toString().padStart(2, '0')}`;
      }
    }

    console.log('🔍 DEBUG - Starting data fetch for user:', userId);
    console.log('🔍 DEBUG - Parameters:', { cash_flow, flow_month, allTime, finalYear, finalMonth });

    // Get cash flows for selector
    const { data: cashFlows, error: cashFlowsError } = await supabase
      .from('cash_flows')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    console.log('🔍 DEBUG - Cash flows result:', { data: cashFlows, error: cashFlowsError });

    // Get categories from category_order table (as per documentation)
    const { data: categories, error: categoriesError } = await supabase
      .from('category_order')
      .select('*')
      .eq('user_id', userId)
      .order('display_order', { ascending: true });

    console.log('🔍 DEBUG - Categories result:', { count: categories?.length, error: categoriesError });

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return res.status(500).json({ error: 'Failed to fetch categories', details: categoriesError.message });
    }

    // Get transactions for the specified period
    let transactionsQuery = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId);

    if (cash_flow) {
      transactionsQuery = transactionsQuery.eq('cash_flow_id', cash_flow);
    }

    if (!allTime && flow_month) {
      transactionsQuery = transactionsQuery.eq('flow_month', flow_month);
    }

    const { data: transactions, error: transactionsError } = await transactionsQuery;
    console.log('🔍 DEBUG - Transactions result:', { count: transactions?.length, error: transactionsError });

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return res.status(500).json({ error: 'Failed to fetch transactions', details: transactionsError.message });
    }

    // Fetch shared category targets if any categories use them
    const categoriesWithSharedTarget = categories?.filter(cat => 
      cat.shared_category && cat.use_shared_target === true
    ) || [];

    let sharedTargets = {};
    if (categoriesWithSharedTarget.length > 0) {
      const sharedCategoryNames = [...new Set(categoriesWithSharedTarget.map(cat => cat.shared_category))];
      const { data: sharedTargetsData, error: sharedTargetsError } = await supabase
        .from('shared_category_targets')
        .select('*')
        .eq('user_id', userId)
        .in('shared_category_name', sharedCategoryNames);

      if (sharedTargetsError) {
        console.warn('Error fetching shared category targets (optional):', sharedTargetsError);
      } else if (sharedTargetsData) {
        sharedTargetsData.forEach(target => {
          sharedTargets[target.shared_category_name] = target;
        });
      }
    }

    // Process categories and transactions
    const categoryBreakdown = [];
    const processedCategories = {};
    let expenseTotal = 0;
    let incomeTotal = 0;

    // Initialize categories from category_order
    if (categories) {
      categories.forEach(category => {
        // Use shared target if applicable
        let monthlyTarget = category.monthly_target || null;
        let weeklyDisplay = category.weekly_display || false;
        
        if (category.use_shared_target && category.shared_category && sharedTargets[category.shared_category]) {
          const sharedTarget = sharedTargets[category.shared_category];
          monthlyTarget = sharedTarget.monthly_target || monthlyTarget;
          weeklyDisplay = sharedTarget.weekly_display !== undefined 
            ? sharedTarget.weekly_display 
            : weeklyDisplay;
        }

        // Filter transactions by category_name (not category)
        const categoryTransactions = transactions?.filter(t => 
          t.category_name === category.category_name
        ) || [];

        // Calculate amount (absolute value)
        const amount = categoryTransactions.reduce((sum, t) => {
          const transactionAmount = parseFloat(t.amount) || 0;
          return sum + Math.abs(transactionAmount);
        }, 0);

        const count = categoryTransactions.length;

        // Determine category type from transactions if not available
        let categoryType = null;
        if (categoryTransactions.length > 0) {
          // Try to infer from transaction category_type or amount sign
          const firstTransaction = categoryTransactions[0];
          if (firstTransaction.category_type) {
            categoryType = firstTransaction.category_type;
          } else {
            // Infer from amount: positive = income, negative = expense
            const firstAmount = parseFloat(firstTransaction.amount) || 0;
            categoryType = firstAmount >= 0 ? 'income' : 'expense';
          }
        } else {
          // Default to expense if no transactions
          categoryType = 'expense';
        }

        const categoryData = {
          name: category.category_name,
          type: categoryType,
          amount: amount, // Absolute amount (always positive)
          count: count,
          is_shared_category: !!category.shared_category,
          shared_category: category.shared_category || null,
          weekly_display: weeklyDisplay,
          monthly_target: monthlyTarget,
          use_shared_target: category.use_shared_target || false,
          display_order: category.display_order || 0
        };

        categoryBreakdown.push(categoryData);
        processedCategories[category.category_name] = categoryData;

        // Calculate totals (only for non-excluded transactions)
        categoryTransactions.forEach(transaction => {
          if (!transaction.excluded_from_flow) {
            const transactionAmount = parseFloat(transaction.amount) || 0;
            if (transactionAmount < 0) {
              // Expense
              expenseTotal += Math.abs(transactionAmount);
            } else if (transactionAmount > 0) {
              // Income
              incomeTotal += transactionAmount;
            }
          }
        });
      });
    }

    // Get monthly goal if not all time
    let monthlyGoal = null;
    if (!allTime && finalYear && finalMonth) {
      const { data: goalData } = await supabase
        .from('monthly_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('cash_flow_id', cash_flow)
        .eq('year', finalYear)
        .eq('month', finalMonth)
        .single();
      
      monthlyGoal = goalData;
    }

    // Check if user has requested to show empty categories for this period
    let showEmptyCategories = [];
    if (!allTime && finalYear && finalMonth && cash_flow) {
      try {
        const { data: emptyCategoriesToShow, error: emptyCategoriesError } = await supabase
          .from('user_empty_categories_display')
          .select('category_name')
          .eq('user_id', userId)
          .eq('cash_flow_id', cash_flow)
          .eq('year', finalYear)
          .eq('month', finalMonth);
          
        if (!emptyCategoriesError && emptyCategoriesToShow) {
          showEmptyCategories = emptyCategoriesToShow.map(row => row.category_name);
        }
      } catch (error) {
        console.error('Error checking empty categories:', error);
      }
    }

    // Filter out empty categories based on whether month is finished or not
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const isMonthFinished = finalYear && finalMonth && (finalYear < currentYear || (finalYear === currentYear && finalMonth < currentMonth));
    
    const filteredCategories = categoryBreakdown.filter(category => {
      const hasTransactions = category.count > 0;
      const hasMonthlyTarget = category.monthly_target && category.monthly_target > 0;
      const explicitlyRequested = showEmptyCategories.includes(category.name);
      
      let shouldShow;
      if (allTime || !isMonthFinished) {
        // For all-time or current/future months: show if has transactions OR monthly target (or explicitly requested)
        shouldShow = hasTransactions || hasMonthlyTarget || explicitlyRequested;
      } else {
        // For finished months: show only categories with transactions (or explicitly requested)
        shouldShow = hasTransactions || explicitlyRequested;
      }
      
      return shouldShow;
    });

    // Sort categories by display_order
    const sortedCategories = filteredCategories.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    // Prepare response data according to documentation
    const responseData = {
      summary: {
        total_income: incomeTotal,
        total_expenses: expenseTotal,
        net_balance: incomeTotal - expenseTotal
      },
      transaction_count: transactions?.length || 0,
      flow_month: flow_month,
      current_cash_flow_id: cash_flow,
      all_time: allTime,
      orderedCategories: sortedCategories,
      category_breakdown: sortedCategories,
      categories: processedCategories, // Keep for backward compatibility
      cash_flows: cashFlows || [],
      year: finalYear,
      month: finalMonth,
      hebrew_month_name: finalMonth ? getHebrewMonthName(finalMonth) : null,
      monthly_goal: monthlyGoal
    };

    console.log('🔍 DEBUG - Final response data:', {
      categories_count: Object.keys(processedCategories).length,
      category_breakdown_count: sortedCategories.length,
      cash_flows_count: cashFlows?.length || 0,
      transaction_count: transactions?.length || 0,
      totals: { netBalance: incomeTotal - expenseTotal, expenseTotal, incomeTotal }
    });

    res.json(responseData);

  } catch (error) {
    console.error('Dashboard error:', error);
    
    if (error.message === 'Access token is required' || error.message === 'Invalid token') {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}