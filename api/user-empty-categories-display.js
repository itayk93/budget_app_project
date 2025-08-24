import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// JWT authentication for Vercel functions
function authenticateToken(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Authenticate user
  const user = authenticateToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const userId = user.userId;

  try {
    if (req.method === 'GET') {
      const { year, month, cash_flow_id } = req.query;

      console.log('🔍 [USER EMPTY CATEGORIES] GET request:', { userId, year, month, cash_flow_id });

      if (!year || !month || !cash_flow_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required parameters: year, month, cash_flow_id' 
        });
      }

      // First check if table exists
      const { data: tableCheck, error: tableError } = await supabase
        .from('user_empty_categories_display')
        .select('*')
        .limit(1);

      if (tableError) {
        console.error('🚨 [USER EMPTY CATEGORIES] Table does not exist or no access:', tableError);
        return res.status(500).json({ 
          success: false, 
          message: 'Table user_empty_categories_display does not exist', 
          error: tableError.message 
        });
      }

      const { data, error } = await supabase
        .from('user_empty_categories_display')
        .select('category_name')
        .eq('user_id', userId)
        .eq('cash_flow_id', cash_flow_id)
        .eq('year', parseInt(year))
        .eq('month', parseInt(month));

      if (error) {
        console.error('🚨 [USER EMPTY CATEGORIES] Database error:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Database error', 
          error: error.message 
        });
      }

      const categories = data.map(row => row.category_name);
      console.log('✅ [USER EMPTY CATEGORIES] Retrieved categories:', categories);

      res.json({
        success: true,
        categories,
        period: { year: parseInt(year), month: parseInt(month) },
        cash_flow_id
      });

    } else if (req.method === 'POST') {
      const { categories, year, month, cash_flow_id } = req.body;
      const action = req.body.action; // 'add' or 'remove'

      if (action === 'add' || !action) {
        // Add categories
        if (!categories || !Array.isArray(categories) || !year || !month || !cash_flow_id) {
          return res.status(400).json({ 
            success: false, 
            message: 'Missing required parameters: categories (array), year, month, cash_flow_id' 
          });
        }

        const insertData = categories.map(categoryName => ({
          user_id: userId,
          cash_flow_id,
          category_name: categoryName,
          year: parseInt(year),
          month: parseInt(month)
        }));

        const { data, error } = await supabase
          .from('user_empty_categories_display')
          .upsert(insertData, { 
            onConflict: 'user_id,cash_flow_id,category_name,year,month',
            ignoreDuplicates: true 
          })
          .select();

        if (error) {
          console.error('🚨 [USER EMPTY CATEGORIES] Insert error:', error);
          return res.status(500).json({ 
            success: false, 
            message: 'Database error', 
            error: error.message 
          });
        }

        res.json({
          success: true,
          message: `Added ${categories.length} categories to display`,
          categories,
          inserted: data?.length || 0
        });

      } else if (action === 'remove') {
        // Remove categories
        if (!categories || !Array.isArray(categories) || !year || !month || !cash_flow_id) {
          return res.status(400).json({ 
            success: false, 
            message: 'Missing required parameters: categories (array), year, month, cash_flow_id' 
          });
        }

        const { data, error } = await supabase
          .from('user_empty_categories_display')
          .delete()
          .eq('user_id', userId)
          .eq('cash_flow_id', cash_flow_id)
          .eq('year', parseInt(year))
          .eq('month', parseInt(month))
          .in('category_name', categories)
          .select();

        if (error) {
          console.error('🚨 [USER EMPTY CATEGORIES] Delete error:', error);
          return res.status(500).json({ 
            success: false, 
            message: 'Database error', 
            error: error.message 
          });
        }

        res.json({
          success: true,
          message: `Removed ${categories.length} categories from display`,
          categories,
          removed: data?.length || 0
        });
      }

    } else if (req.method === 'DELETE') {
      const { year, month, cash_flow_id } = req.query;

      console.log('🔍 [USER EMPTY CATEGORIES] DELETE request:', { userId, year, month, cash_flow_id });

      if (!year || !month || !cash_flow_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required parameters: year, month, cash_flow_id' 
        });
      }

      const { data, error } = await supabase
        .from('user_empty_categories_display')
        .delete()
        .eq('user_id', userId)
        .eq('cash_flow_id', cash_flow_id)
        .eq('year', parseInt(year))
        .eq('month', parseInt(month))
        .select();

      if (error) {
        console.error('🚨 [USER EMPTY CATEGORIES] Clear error:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Database error', 
          error: error.message 
        });
      }

      console.log('✅ [USER EMPTY CATEGORIES] All categories cleared:', data?.length || 0);

      res.json({
        success: true,
        message: 'All empty categories cleared from display',
        removed: data?.length || 0
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      res.status(405).json({ success: false, message: 'Method not allowed' });
    }

  } catch (error) {
    console.error('🚨 [USER EMPTY CATEGORIES] Unexpected error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}