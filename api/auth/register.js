const SupabaseService = require('../../server/services/supabaseService');
const EmailService = require('../../server/services/emailService');
const TokenService = require('../../server/services/tokenService');

const emailService = new EmailService();
const tokenService = new TokenService();

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUserByEmail = await SupabaseService.getUserByEmail(email);
    const existingUserByUsername = await SupabaseService.getUserByUsername(username);

    if (existingUserByEmail || existingUserByUsername) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Create new user (initially unverified)
    const user = await SupabaseService.createUser({
      username,
      email,
      password,
      firstName,
      lastName,
      email_verified: false
    });

    // Generate verification token and send welcome + verification emails
    const verificationToken = tokenService.generateEmailVerificationToken(user.email, user.id);
    
    // Send welcome email
    const welcomeEmailResult = await emailService.sendWelcomeEmail(user);
    if (!welcomeEmailResult.success) {
      console.error('Failed to send welcome email:', welcomeEmailResult.error);
    }

    // Send verification email
    const verificationEmailResult = await emailService.sendVerificationEmail(user, verificationToken);
    if (!verificationEmailResult.success) {
      console.error('Failed to send verification email:', verificationEmailResult.error);
    }

    res.status(201).json({ 
      message: 'User created successfully. Please check your email to verify your account.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        email_verified: user.email_verified
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
}