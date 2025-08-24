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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Authenticate user
  const user = authenticateToken(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const userId = user.userId;

  try {
    const { categories, year, month, cash_flow_id } = req.body;

    console.log('🔍 [USER EMPTY CATEGORIES] POST remove request:', { userId, categories, year, month, cash_flow_id });

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

    console.log('✅ [USER EMPTY CATEGORIES] Categories removed:', data?.length || 0);

    res.json({
      success: true,
      message: `Removed ${categories.length} categories from display`,
      categories,
      removed: data?.length || 0
    });

  } catch (error) {
    console.error('🚨 [USER EMPTY CATEGORIES] Unexpected error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}