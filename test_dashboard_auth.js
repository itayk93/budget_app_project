require('dotenv').config();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate JWT secret (same logic as in auth middleware)
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

async function testDashboardWithAuth() {
  try {
    console.log('🚀 Testing dashboard with authentication...\n');
    
    // User ID from our cash flow test
    const userId = 'e3f6919b-d83b-4456-8325-676550a4382d';
    const cashFlowId = 'c30c2672-2c39-4599-9e4e-0a536591a438';
    
    // Generate a valid JWT token
    const token = jwt.sign(
      { userId: userId, username: 'test_user' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('Generated JWT token (first 20 chars):', token.substring(0, 20) + '...');
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('Using generated secret:', !process.env.JWT_SECRET);
    
    // Import axios for HTTP requests
    const axios = require('axios');
    
    // Test the dashboard endpoint with proper auth
    const url = `http://localhost:5001/api/dashboard?cash_flow=${cashFlowId}&all_time=1&format=json`;
    console.log('\\nTesting URL:', url);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('\\n✅ Success! Status:', response.status);
    console.log('Response keys:', Object.keys(response.data));
    console.log('Transaction count:', response.data.transaction_count);
    console.log('Categories:', response.data.orderedCategories ? response.data.orderedCategories.length : 0);
    
  } catch (error) {
    console.error('\\n❌ Error testing dashboard with auth:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error message:', error.message);
    }
    
    console.error('Full error:', error);
  }
}

testDashboardWithAuth();