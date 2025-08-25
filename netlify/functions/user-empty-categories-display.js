import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET
);

// Authentication middleware
async function authenticateToken(event) {
  const authHeader = event.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new Error('Access token is required');
  }

  try {
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
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
    const userId = user.userId;

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