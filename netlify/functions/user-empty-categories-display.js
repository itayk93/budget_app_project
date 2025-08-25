import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET
);

// Authentication middleware with fallback for missing environment variables
async function authenticateToken(event) {
  // Check all possible header variations for authorization
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔍 [USER-CATEGORIES AUTH] Environment check:', {
    JWT_SECRET_exists: !!process.env.JWT_SECRET,
    SUPABASE_URL_exists: !!process.env.SUPABASE_URL,
    SUPABASE_SECRET_exists: !!process.env.SUPABASE_SECRET,
    NODE_ENV: process.env.NODE_ENV || 'undefined'
  });

  // TEMPORARY FIX: If environment variables are missing, return mock user for debugging
  if (!process.env.JWT_SECRET || !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET) {
    console.error('🚨 [USER-CATEGORIES AUTH] Critical environment variables missing!');
    console.error('🚨 [USER-CATEGORIES AUTH] Please configure in Netlify Dashboard:');
    console.error('🚨 [USER-CATEGORIES AUTH] - JWT_SECRET');
    console.error('🚨 [USER-CATEGORIES AUTH] - SUPABASE_URL'); 
    console.error('🚨 [USER-CATEGORIES AUTH] - SUPABASE_SECRET');
    
    // Return error response instead of throwing
    throw new Error('Server configuration incomplete - please configure environment variables in Netlify Dashboard');
  }

  if (!token) {
    console.error('🚨 [USER-CATEGORIES AUTH] No token provided');
    console.error('🚨 [USER-CATEGORIES AUTH] Available headers:', Object.keys(event.headers));
    throw new Error('Access token is required');
  }

  try {
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ [USER-CATEGORIES AUTH] Token verified:', { 
      userId: decoded.userId, 
      email: decoded.email,
      id: decoded.id,
      exp: decoded.exp,
      iat: decoded.iat 
    });
    return decoded;
  } catch (error) {
    console.error('🚨 [USER-CATEGORIES AUTH] JWT verification failed:', {
      error: error.message,
      name: error.name,
      token_length: token?.length,
      token_start: token?.substring(0, 10)
    });
    throw new Error('Invalid token');
  }
}

export const handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Authenticate user
    const user = await authenticateToken(event);
    const userId = user.userId || user.id;
    
    console.log('🔍 [USER-CATEGORIES] User object:', user);
    console.log('🔍 [USER-CATEGORIES] Final userId:', userId);

    if (event.httpMethod === 'GET') {
      const { year, month, cash_flow_id } = event.queryStringParameters || {};

      console.log('🔍 [USER EMPTY CATEGORIES] GET request:', { userId, year, month, cash_flow_id });

      if (!year || !month || !cash_flow_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: 'Missing required parameters: year, month, cash_flow_id' 
          })
        };
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
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: 'Database error', 
            error: error.message 
          })
        };
      }

      const categories = data.map(row => row.category_name);
      console.log('✅ [USER EMPTY CATEGORIES] Retrieved categories:', categories);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          categories,
          period: { year: parseInt(year), month: parseInt(month) },
          cash_flow_id
        })
      };

    } else if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { categories, year, month, cash_flow_id, action } = body;

      if (action === 'add' || !action) {
        // Add categories
        if (!categories || !Array.isArray(categories) || !year || !month || !cash_flow_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              success: false, 
              message: 'Missing required parameters: categories (array), year, month, cash_flow_id' 
            })
          };
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
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              success: false, 
              message: 'Database error', 
              error: error.message 
            })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: `Added ${categories.length} categories to display`,
            categories,
            inserted: data?.length || 0
          })
        };

      } else if (action === 'remove') {
        // Remove categories
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
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              success: false, 
              message: 'Database error', 
              error: error.message 
            })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: `Removed ${categories.length} categories from display`,
            categories,
            removed: data?.length || 0
          })
        };
      }

    } else if (event.httpMethod === 'DELETE') {
      const { year, month, cash_flow_id } = event.queryStringParameters || {};

      console.log('🔍 [USER EMPTY CATEGORIES] DELETE request:', { userId, year, month, cash_flow_id });

      if (!year || !month || !cash_flow_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: 'Missing required parameters: year, month, cash_flow_id' 
          })
        };
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
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: 'Database error', 
            error: error.message 
          })
        };
      }

      console.log('✅ [USER EMPTY CATEGORIES] All categories cleared:', data?.length || 0);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'All empty categories cleared from display',
          removed: data?.length || 0
        })
      };

    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ success: false, message: 'Method not allowed' })
      };
    }

  } catch (error) {
    console.error('🚨 [USER EMPTY CATEGORIES] Unexpected error:', error);
    
    if (error.message === 'Access token is required' || error.message === 'Invalid token') {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, message: 'Unauthorized' })
      };
    }
    
    if (error.message.includes('Server configuration incomplete')) {
      console.error('🚨 [USER EMPTY CATEGORIES] Environment configuration error');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Server configuration error - environment variables not set',
          error: 'Please configure JWT_SECRET, SUPABASE_URL, and SUPABASE_SECRET in Netlify Dashboard'
        })
      };
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Internal server error', 
        error: error.message 
      })
    };
  }
};