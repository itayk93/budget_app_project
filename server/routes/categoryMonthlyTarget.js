const express = require('express');
const CategoryService = require('../services/supabase-modules/CategoryService');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { flow_month, category_name, user_id: queryUserId } = req.query;
    let targetUserId = req.user.id;

    // If a user_id is provided in the query, check permissions
    if (queryUserId) {
      // Allow admins to query for any user. Assumes 'req.user.role' exists.
      if (req.user.role === 'admin') {
        targetUserId = queryUserId;
      } else if (targetUserId !== queryUserId) {
        // Non-admin users cannot query for other users
        return res.status(403).json({ error: 'Forbidden: You are not authorized to access data for other users.' });
      }
    }

    if (!flow_month || !category_name) {
      return res.status(400).json({ error: 'flow_month and category_name are required' });
    }

    const result = await CategoryService.getCategoryMonthlyTarget(targetUserId, flow_month, category_name);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error?.message || 'An unexpected error occurred' });
    }
  } catch (error) {
    console.error('Error in category-monthly-target route:', error);
    res.status(500).json({ error: 'Failed to get category monthly target' });
  }
});

module.exports = router;
