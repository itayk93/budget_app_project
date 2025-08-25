import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET
);

// Authentication middleware
async function authenticateToken(event) {
  const authHeader = event.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔍 [CASHFLOWS AUTH] Headers:', JSON.stringify(event.headers));
  console.log('🔍 [CASHFLOWS AUTH] Token:', token ? 'Present' : 'Missing');

  if (!token) {
    throw new Error('Access token is required');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔍 [CASHFLOWS AUTH] Decoded:', { userId: decoded.userId, email: decoded.email });
    return decoded;
  } catch (error) {
    console.error('🚨 [CASHFLOWS AUTH] JWT Error:', error);
    throw new Error('Invalid token');
  }
}

export const handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Authenticate user
    const user = await authenticateToken(event);
    const userId = user.userId;

    // Fetch cash flows from Supabase for this user
    const { data: cashFlows, error } = await supabase
      .from('cash_flows')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (error) {
      console.error('Supabase error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Database error' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(cashFlows || [])
    };
  } catch (error) {
    console.error('🚨 [CASHFLOWS] Error:', error);
    
    if (error.message === 'Access token is required' || error.message === 'Invalid token') {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch cash flows',
        details: error.message
      })
    };
  }
};