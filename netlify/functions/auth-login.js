import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET
);

export const handler = async (event, context) => {
  console.log('🚀 [AUTH-LOGIN] Function started');
  console.log('🚀 [AUTH-LOGIN] Method:', event.httpMethod);
  console.log('🚀 [AUTH-LOGIN] Headers:', JSON.stringify(event.headers));
  console.log('🚀 [AUTH-LOGIN] Body:', event.body);
  console.log('🚀 [AUTH-LOGIN] Environment check:', {
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseSecret: !!process.env.SUPABASE_SECRET,
    hasJwtSecret: !!process.env.JWT_SECRET
  });

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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { email, username, password } = body;
    const userEmail = email || username;

    if (!userEmail || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email/username and password are required' })
      };
    }

    // Find user by email or username
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${userEmail},username.eq.${userEmail}`)
      .limit(1);

    if (fetchError) {
      console.error('Database error:', fetchError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Database error' })
      };
    }

    if (!users || users.length === 0) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    // Check if email is verified
    if (!user.email_verified) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          error: 'Please verify your email before logging in',
          requiresVerification: true
        })
      };
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        username: user.username 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          email_verified: user.email_verified,
          created_at: user.created_at,
          last_login: new Date().toISOString()
        }
      })
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Login failed' })
    };
  }
};