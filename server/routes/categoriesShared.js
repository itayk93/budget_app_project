const express = require('express');
const SupabaseService = require('../services/supabaseService');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ===== SHARED CATEGORY TARGETS ENDPOINTS =====

// Get shared category target
router.get('/target/:sharedCategoryName', authenticateToken, async (req, res) => {
  try {
    const { sharedCategoryName } = req.params;
    const userId = req.user.id;
    
    const target = await SupabaseService.getSharedCategoryTarget(userId, sharedCategoryName);
    
    res.json({
      success: true,
      target: target
    });
  } catch (error) {
    console.error('Get shared category target error:', error);
    res.status(500).json({ error: 'Failed to get shared category target' });
  }
});

// Update shared category target
router.post('/update-shared-target', authenticateToken, async (req, res) => {
  try {
    const { shared_category_name, monthly_target, weekly_display } = req.body;
    const userId = req.user.id;

    if (!shared_category_name || monthly_target === undefined) {
      return res.status(400).json({ error: 'Shared category name and monthly target are required' });
    }

    const updatedTarget = await SupabaseService.updateSharedCategoryTarget(
      userId, 
      shared_category_name, 
      monthly_target, 
      weekly_display
    );

    res.json({
      success: true,
      target: updatedTarget
    });
  } catch (error) {
    console.error('Update shared category target error:', error);
    res.status(500).json({ error: 'Failed to update shared category target' });
  }
});

// Get shared category spending data for current month
router.get('/spending/:sharedCategoryName', authenticateToken, async (req, res) => {
  try {
    const { sharedCategoryName } = req.params;
    const userId = req.user.id;
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const currentSpending = await SupabaseService.getSharedCategoryMonthlySpending(
      userId, 
      sharedCategoryName, 
      currentYear, 
      currentMonth
    );
    
    res.json({
      success: true,
      currentSpending: currentSpending
    });
  } catch (error) {
    console.error('Get shared category spending error:', error);
    res.status(500).json({ error: 'Failed to get shared category spending' });
  }
});

// Set category to use shared target
router.post('/set-use-shared-target', authenticateToken, async (req, res) => {
  try {
    const { category_name, use_shared_target } = req.body;
    const userId = req.user.id;

    if (!category_name || use_shared_target === undefined) {
      return res.status(400).json({ error: 'Category name and use_shared_target are required' });
    }

    const updatedCategory = await SupabaseService.setUseSharedTarget(
      userId, 
      category_name, 
      use_shared_target
    );

    res.json({
      success: true,
      category: updatedCategory
    });
  } catch (error) {
    console.error('Set use shared target error:', error);
    res.status(500).json({ error: 'Failed to set use shared target' });
  }
});

// Calculate and update shared category targets
router.post('/calculate-shared-targets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { force = false } = req.body;
    
    const result = await SupabaseService.calculateAndUpdateSharedCategoryTargets(userId, force);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Calculate shared category targets error:', error);
    res.status(500).json({ error: 'Failed to calculate shared category targets' });
  }
});

// TEMP: Initialize shared targets manually
router.post('/init-shared-targets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Create shared target for income manually
    const result = await SupabaseService.calculateAndUpdateSharedCategoryTargets(userId, true);
    
    res.json({
      success: true,
      message: 'Shared targets initialized',
      ...result
    });
  } catch (error) {
    console.error('Initialize shared targets error:', error);
    res.status(500).json({ error: 'Failed to initialize shared targets' });
  }
});

module.exports = router;