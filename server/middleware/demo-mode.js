/**
 * Demo Mode Middleware
 * Detects and handles demo mode requests
 */

const demoModeMiddleware = (req, res, next) => {
  // Check if this is a demo mode request
  const isDemoMode = req.query.demo === 'true' || 
                     req.headers['x-demo-mode'] === 'true' ||
                     req.path.startsWith('/api/demo');

  // Add demo mode flag to request
  req.isDemoMode = isDemoMode;

  // If it's demo mode, bypass authentication
  if (isDemoMode) {
    // Set demo user for authenticated routes
    req.user = {
      id: 'demo-user-id',
      firstName: 'דנה',
      lastName: 'דוגמה',
      email: 'demo@budgetlens.com',
      token: 'demo-token'
    };
  }

  next();
};

module.exports = demoModeMiddleware;