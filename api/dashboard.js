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

    // Get cash flows for selector
    const { data: cashFlows } = await supabase
      .from('cash_flows')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    // Get categories
    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('display_order', { ascending: true });

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

    const { data: transactions } = await transactionsQuery;

    // Process categories and transactions
    const categoryBreakdown = [];
    const processedCategories = {};
    let totalBalance = 0;
    let expenseTotal = 0;
    let incomeTotal = 0;

    if (categories) {
      categories.forEach(category => {
        const categoryTransactions = transactions?.filter(t => t.category === category.name) || [];
        const amount = categoryTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const count = categoryTransactions.length;

        const categoryData = {
          name: category.name,
          spent: category.type === 'income' ? amount : -amount,
          amount: Math.abs(amount),
          count: count,
          type: category.type,
          transactions: categoryTransactions,
          category_type: category.type,
          display_order: category.display_order,
          shared_category: category.shared_category || null,
          weekly_display: category.weekly_display || false,
          monthly_target: category.monthly_target || null,
          use_shared_target: category.use_shared_target || false,
          is_shared_category: category.is_shared_category || false
        };

        categoryBreakdown.push(categoryData);
        processedCategories[category.name] = categoryData;

        // Calculate totals
        if (category.type === 'income') {
          incomeTotal += amount;
          totalBalance += amount;
        } else {
          expenseTotal += Math.abs(amount);
          totalBalance -= Math.abs(amount);
        }
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

    // Prepare response data
    const responseData = {
      categories: processedCategories,
      category_breakdown: categoryBreakdown,
      orderedCategories: categoryBreakdown,
      cash_flows: cashFlows || [],
      current_cash_flow_id: cash_flow,
      flow_month: flow_month,
      year: finalYear,
      month: finalMonth,
      all_time: allTime,
      hebrew_month_name: finalMonth ? getHebrewMonthName(finalMonth) : null,
      monthly_goal: monthlyGoal,
      total_balance: totalBalance,
      expense_total: expenseTotal,
      income_total: incomeTotal,
      monthly_savings: 0,
      transaction_count: transactions?.length || 0
    };

    res.json(responseData);

  } catch (error) {
    console.error('Dashboard error:', error);
    
    if (error.message === 'Access token is required' || error.message === 'Invalid token') {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}