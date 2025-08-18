import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET
);

export default async function handler(req, res) {
  console.log('Login endpoint called with method:', req.method);
  console.log('Request body:', req.body);
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Handle both email and username field names
    const { email, username, password } = req.body;
    const userEmail = email || username;

    if (!userEmail || !password) {
      return res.status(400).json({ error: 'Email/username and password are required' });
    }

    // Find user by email or username
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${userEmail},username.eq.${userEmail}`)
      .limit(1);

    if (fetchError) {
      console.error('Database error:', fetchError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({ 
        error: 'Please verify your email before logging in',
        requiresVerification: true
      });
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

    res.json({
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
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};