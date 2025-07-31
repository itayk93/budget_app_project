const jwt = require('jsonwebtoken');
const SupabaseService = require('../services/supabaseService');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('🔐 Token decoded:', { userId: decoded.userId, decoded });
    const user = await SupabaseService.getUserById(decoded.userId);
    console.log('👤 User from DB:', { user_id: user?.id, username: user?.username });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
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