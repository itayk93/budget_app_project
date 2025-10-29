const express = require('express');
const jwt = require('jsonwebtoken');
const SupabaseService = require('../services/supabaseService');
const EmailService = require('../services/emailService');
const TokenService = require('../services/tokenService');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Initialize services
const emailService = new EmailService();
const tokenService = new TokenService();

// Register
router.post('/register', async (req, res) => {
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

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;

    console.log(`✅ New user registered: ${user.email} (ID: ${user.id})`);
    res.status(201).json({
      message: 'User created successfully. Please check your email to verify your account.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        emailVerified: user.email_verified || false
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('🔍 Login attempt:', {
      username: username,
      passwordLength: password ? password.length : 0,
      timestamp: new Date().toISOString()
    });

    if (!username || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username or email
    let user = await SupabaseService.getUserByUsername(username);
    if (!user) {
      user = await SupabaseService.getUserByEmail(username);
    }

    if (!user) {
      console.log('❌ User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('👤 User found:', user.username, user.email);

    // Verify password
    const isValid = await SupabaseService.verifyPassword(password, user.password_hash);
    console.log('🔑 Password verification:', isValid ? 'SUCCESS' : 'FAILED');
    
    if (!isValid) {
      console.log('❌ Invalid password for user:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await SupabaseService.updateUserLastLogin(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        lastLogin: user.last_login
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      lastLogin: user.last_login,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Verify token
router.get('/verify', authenticateToken, (req, res) => {
  // Verify endpoint log disabled
  res.json({ 
    valid: true, 
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      firstName: req.user.first_name,
      lastName: req.user.last_name
    }
  });
});

// Password Reset - Request
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    const user = await SupabaseService.getUserByEmail(email);
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = tokenService.generatePasswordResetToken(user.email, user.id);

    // Send password reset email
    const emailResult = await emailService.sendPasswordResetEmail(user, resetToken);

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      return res.status(500).json({ error: 'Failed to send password reset email' });
    }

    console.log(`📧 Password reset email sent to ${user.email}`);
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Password Reset - Verify Token and Reset
router.post('/reset-password', async (req, res) => {
  try {
    console.log('🔧 DEBUG: Starting password reset process');
    const { token, newPassword } = req.body;
    console.log('🔧 DEBUG: Token received:', token ? 'Yes' : 'No');
    console.log('🔧 DEBUG: New password length:', newPassword?.length || 0);

    if (!token || !newPassword) {
      console.log('🔧 DEBUG: Missing token or password');
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    console.log('🔧 DEBUG: Verifying reset token...');
    // Verify reset token
    const tokenResult = tokenService.verifyPasswordResetToken(token);
    console.log('🔧 DEBUG: Token verification result:', tokenResult);
    
    if (!tokenResult.valid) {
      console.log('🔧 DEBUG: Invalid token');
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    console.log('🔧 DEBUG: Getting user by ID:', tokenResult.userId);
    // Get user by ID to ensure they still exist
    const user = await SupabaseService.getUserById(tokenResult.userId);
    console.log('🔧 DEBUG: User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('🔧 DEBUG: User not found');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('🔧 DEBUG: Updating password for user:', user.email);
    // Update password
    const updatedUser = await SupabaseService.updateUser(user.id, {
      password: newPassword
    });
    console.log('🔧 DEBUG: Password update result:', updatedUser ? 'Success' : 'Failed');

    if (!updatedUser) {
      console.log('🔧 DEBUG: Failed to update password');
      return res.status(500).json({ error: 'Failed to update password' });
    }

    console.log('🔧 DEBUG: Sending confirmation email...');
    // Send confirmation email
    const emailResult = await emailService.sendPasswordChangeConfirmation(user);
    console.log('🔧 DEBUG: Email result:', emailResult);
    
    if (!emailResult.success) {
      console.error('Failed to send password change confirmation:', emailResult.error);
    }

    console.log(`✅ Password reset successfully for user: ${user.email}`);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('❌ DETAILED: Reset password error');
    console.error('❌ DETAILED: Error name:', error.name);
    console.error('❌ DETAILED: Error message:', error.message);
    console.error('❌ DETAILED: Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Change Password (authenticated)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Get full user data
    const user = await SupabaseService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await SupabaseService.verifyPassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password
    const updatedUser = await SupabaseService.updateUser(user.id, {
      password: newPassword
    });

    if (!updatedUser) {
      return res.status(500).json({ error: 'Failed to update password' });
    }

    // Send confirmation email
    const emailResult = await emailService.sendPasswordChangeConfirmation(user);
    if (!emailResult.success) {
      console.error('Failed to send password change confirmation:', emailResult.error);
    }

    console.log(`🔐 Password changed successfully for user: ${user.email}`);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Send Email Verification
router.post('/send-verification', authenticateToken, async (req, res) => {
  try {
    const user = await SupabaseService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already verified
    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate verification token
    const verificationToken = tokenService.generateEmailVerificationToken(user.email, user.id);

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(user, verificationToken);

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    console.log(`📧 Verification email sent to ${user.email}`);
    res.json({ message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('Send verification error:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// Verify Email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Verify token
    const tokenResult = tokenService.verifyEmailVerificationToken(token);
    if (!tokenResult.valid) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Get user and verify they exist
    const user = await SupabaseService.getUserById(tokenResult.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user as verified
    const updatedUser = await SupabaseService.updateUser(user.id, {
      email_verified: true,
      email_verified_at: new Date().toISOString()
    });

    if (!updatedUser) {
      return res.status(500).json({ error: 'Failed to verify email' });
    }

    console.log(`✅ Email verified for user: ${user.email}`);
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Update Profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    const userId = req.user.id;

    // Get current user data
    const currentUser = await SupabaseService.getUserById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare update data
    const updateData = {};
    
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;

    // Handle email change separately (requires verification)
    if (email && email !== currentUser.email) {
      // Check if new email is already in use
      const existingUser = await SupabaseService.getUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Email is already in use by another account' });
      }

      // Generate email change token
      const changeToken = tokenService.generateEmailChangeToken(userId, currentUser.email, email);

      // Send verification email to new address
      const emailResult = await emailService.sendEmailChangeVerification(currentUser, email, changeToken);
      
      if (!emailResult.success) {
        console.error('Failed to send email change verification:', emailResult.error);
        return res.status(500).json({ error: 'Failed to send email verification' });
      }

      // Don't update email immediately - wait for verification
      console.log(`📧 Email change verification sent to ${email}`);
    }

    // Update other profile data
    if (Object.keys(updateData).length > 0) {
      const updatedUser = await SupabaseService.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(500).json({ error: 'Failed to update profile' });
      }
    }

    // Get updated user data
    const finalUser = await SupabaseService.getUserById(userId);
    
    res.json({
      message: email && email !== currentUser.email 
        ? 'Profile updated. Email change verification sent to new address.'
        : 'Profile updated successfully',
      user: {
        id: finalUser.id,
        username: finalUser.username,
        email: finalUser.email,
        firstName: finalUser.first_name,
        lastName: finalUser.last_name,
        emailVerified: finalUser.email_verified
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Verify Email Change
router.post('/verify-email-change', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Verify token
    const tokenResult = tokenService.verifyEmailChangeToken(token);
    if (!tokenResult.valid) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Get user and verify they exist
    const user = await SupabaseService.getUserById(tokenResult.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user email
    const updatedUser = await SupabaseService.updateUser(user.id, {
      email: tokenResult.newEmail,
      email_verified: true,
      email_verified_at: new Date().toISOString()
    });

    if (!updatedUser) {
      return res.status(500).json({ error: 'Failed to update email' });
    }

    console.log(`📧 Email changed from ${tokenResult.oldEmail} to ${tokenResult.newEmail} for user ID: ${user.id}`);
    res.json({ message: 'Email changed successfully' });
  } catch (error) {
    console.error('Verify email change error:', error);
    res.status(500).json({ error: 'Failed to verify email change' });
  }
});

module.exports = router;
