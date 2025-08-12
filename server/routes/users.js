const express = require('express');
const SupabaseService = require('../services/supabaseService');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    const user = req.user;

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await SupabaseService.getUserByEmail(email);
      if (existingUser && existingUser.id !== user.id) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    const updateData = {};
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (email) updateData.email = email;

    const updatedUser = await SupabaseService.updateUser(user.id, updateData);
    
    if (!updatedUser) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      firstName: updatedUser.first_name,
      lastName: updatedUser.last_name,
      lastLogin: updatedUser.last_login,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Verify current password
    const isValid = await SupabaseService.verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    const updatedUser = await SupabaseService.updateUser(user.id, { password: newPassword });
    
    if (!updatedUser) {
      return res.status(500).json({ error: 'Failed to change password' });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const user = req.user;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to delete account' });
    }

    // Verify password
    const isValid = await SupabaseService.verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    // For now, we'll just return a message - actual deletion would require careful cascade handling
    res.json({ message: 'Account deletion feature not implemented yet' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// User Preferences API endpoints

// Get all user preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const AdditionalMethods = require('../services/supabase-modules/AdditionalMethods');
    
    // Get all preferences for the user - for now we'll just return the one we need
    const hideEmptyCategories = await AdditionalMethods.getUserPreference(userId, 'hide_empty_categories');
    
    res.json({
      hide_empty_categories: hideEmptyCategories !== null ? hideEmptyCategories : true
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch user preferences' });
  }
});

// Get specific user preference
router.get('/preferences/:key', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { key } = req.params;
    const AdditionalMethods = require('../services/supabase-modules/AdditionalMethods');
    
    const preferenceValue = await AdditionalMethods.getUserPreference(userId, key);
    
    res.json({
      [key]: preferenceValue
    });
  } catch (error) {
    console.error('Get preference error:', error);
    res.status(500).json({ error: `Failed to fetch preference: ${req.params.key}` });
  }
});

// Set user preference
router.put('/preferences/:key', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { key } = req.params;
    const { value } = req.body;
    const AdditionalMethods = require('../services/supabase-modules/AdditionalMethods');
    
    await AdditionalMethods.setUserPreference(userId, key, value);
    
    res.json({ 
      message: `Preference ${key} updated successfully`,
      [key]: value 
    });
  } catch (error) {
    console.error('Set preference error:', error);
    res.status(500).json({ error: `Failed to update preference: ${req.params.key}` });
  }
});

module.exports = router;