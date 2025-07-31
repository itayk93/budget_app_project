const express = require('express');
const router = express.Router();
const SupabaseService = require('../services/supabaseService');
const { authenticateToken } = require('../middleware/auth');

// Get monthly goal for specific month
router.get('/:year/:month', authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.params;
    const { cash_flow_id } = req.query;
    const userId = req.user.id;

    const monthlyGoal = await SupabaseService.getMonthlyGoal(userId, cash_flow_id, parseInt(year), parseInt(month));
    
    res.json({
      success: true,
      data: monthlyGoal
    });
  } catch (error) {
    console.error('Error fetching monthly goal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly goal',
      error: error.message
    });
  }
});

// Create or update monthly goal
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const goalData = req.body;
    
    const result = await SupabaseService.saveMonthlyGoal(userId, goalData);
    
    res.json({
      success: true,
      data: result,
      message: 'Monthly goal saved successfully'
    });
  } catch (error) {
    console.error('Error saving monthly goal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save monthly goal',
      error: error.message
    });
  }
});

// Delete monthly goal
router.delete('/:year/:month', authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.params;
    const { cash_flow_id } = req.query;
    const userId = req.user.id;

    await SupabaseService.deleteMonthlyGoal(userId, cash_flow_id, parseInt(year), parseInt(month));
    
    res.json({
      success: true,
      message: 'Monthly goal deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting monthly goal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete monthly goal',
      error: error.message
    });
  }
});

module.exports = router;