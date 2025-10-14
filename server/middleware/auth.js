const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const SupabaseService = require('../services/supabaseService');

// Generate secure JWT secret if not provided
const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable must be set in production');
    }
    return crypto.randomBytes(32).toString('hex');
  }
  return process.env.JWT_SECRET;
};

const JWT_SECRET = getJwtSecret();

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Handle demo user
    if (decoded.is_demo_user && decoded.userId === 'demo-user-001') {
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        username: 'demo',
        first_name: 'משתמש',
        last_name: 'דמו',
        is_demo_user: true
      };
      console.log('🎭 [AUTH] Authenticated demo user');
      return next();
    }
    
    // Handle regular user
    const user = await SupabaseService.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    console.log('🔍 [AUTH] Authenticated user ID:', user.id);
    next();
  } catch (error) {
    // Log error without exposing sensitive data
    console.error('Token verification failed');
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Handle demo user
    if (decoded.is_demo_user && decoded.userId === 'demo-user-001') {
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        username: 'demo',
        first_name: 'משתמש',
        last_name: 'דמו',
        is_demo_user: true
      };
      return next();
    }
    
    // Handle regular user
    const user = await SupabaseService.getUserById(decoded.userId);
    
    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Continue without authentication
  }
  
  next();
};

const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  
  return res.status(401).json({ error: 'Authentication required' });
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAuth
};