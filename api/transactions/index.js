// Import all transaction modules
const transactionsCrud = require('./crud');
const transactionsAnalytics = require('./analytics');
const transactionsBatch = require('./batch');

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse the URL to determine the sub-route
  const { query } = req;
  const path = query.path || [];
  
  try {
    // Route to appropriate handler based on path
    if (path.length === 0) {
      // Base transactions route - CRUD operations
      return await transactionsCrud(req, res);
    } else if (path[0] === 'analytics') {
      return await transactionsAnalytics(req, res);
    } else if (path[0] === 'batch') {
      return await transactionsBatch(req, res);
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('Transaction API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}