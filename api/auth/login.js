export default async function handler(req, res) {
  // For now, return a simple response to test the endpoint
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // For now, return a mock success response
    res.json({
      message: 'Login successful (mock)',
      token: 'mock-token-123',
      user: {
        id: 1,
        username: 'testuser',
        email: email,
        firstName: 'Test',
        lastName: 'User',
        email_verified: true,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};