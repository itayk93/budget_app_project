const express = require('express');
const SupabaseService = require('../services/supabaseService');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get user cash flows
router.get('/', authenticateToken, async (req, res) => {
  try {
    const cashFlows = await SupabaseService.getCashFlows(req.user.id);
    res.json(cashFlows);
  } catch (error) {
    console.error('Get cash flows error:', error);
    res.status(500).json({ error: 'Failed to fetch cash flows' });
  }
});

// Get default cash flow
router.get('/default', authenticateToken, async (req, res) => {
  try {
    const defaultCashFlow = await SupabaseService.getDefaultCashFlow(req.user.id);
    
    if (!defaultCashFlow) {
      return res.status(404).json({ error: 'No default cash flow found' });
    }

    res.json(defaultCashFlow);
  } catch (error) {
    console.error('Get default cash flow error:', error);
    res.status(500).json({ error: 'Failed to fetch default cash flow' });
  }
});

// Create new cash flow
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, isDefault = false, currency = 'ILS' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const cashFlowData = {
      user_id: req.user.id,
      name,
      description,
      is_default: isDefault,
      currency
    };

    const cashFlow = await SupabaseService.createCashFlow(cashFlowData);
    
    if (!cashFlow) {
      return res.status(500).json({ error: 'Failed to create cash flow' });
    }

    res.status(201).json(cashFlow);
  } catch (error) {
    console.error('Create cash flow error:', error);
    res.status(500).json({ error: 'Failed to create cash flow' });
  }
});

// Update cash flow
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isDefault, currency } = req.body;

    // Verify cash flow exists and belongs to user
    const existingCashFlow = await SupabaseService.getCashFlow(id);
    if (!existingCashFlow || existingCashFlow.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Cash flow not found' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isDefault !== undefined) updateData.is_default = isDefault;
    if (currency) updateData.currency = currency;

    const updatedCashFlow = await SupabaseService.updateCashFlow(id, updateData);
    
    if (!updatedCashFlow) {
      return res.status(500).json({ error: 'Failed to update cash flow' });
    }

    res.json(updatedCashFlow);
  } catch (error) {
    console.error('Update cash flow error:', error);
    res.status(500).json({ error: 'Failed to update cash flow' });
  }
});

// Get latest transaction date for cash flow
router.get('/:id/latest-transaction-date', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify cash flow exists and belongs to user
    const existingCashFlow = await SupabaseService.getCashFlow(id);
    if (!existingCashFlow || existingCashFlow.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Cash flow not found' });
    }

    const latestDate = await SupabaseService.getLatestTransactionDate(id);
    
    res.json({ 
      cashFlowId: id,
      cashFlowName: existingCashFlow.name,
      latestTransactionDate: latestDate
    });
  } catch (error) {
    console.error('Get latest transaction date error:', error);
    res.status(500).json({ error: 'Failed to fetch latest transaction date' });
  }
});

// Set default cash flow
router.put('/:id/default', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify cash flow exists and belongs to user
    const existingCashFlow = await SupabaseService.getCashFlow(id);
    if (!existingCashFlow || existingCashFlow.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Cash flow not found' });
    }

    // Set this as default and remove default from others
    const updatedCashFlow = await SupabaseService.updateCashFlow(id, { is_default: true });
    
    if (!updatedCashFlow) {
      return res.status(500).json({ error: 'Failed to set default cash flow' });
    }

    res.json(updatedCashFlow);
  } catch (error) {
    console.error('Set default cash flow error:', error);
    res.status(500).json({ error: 'Failed to set default cash flow' });
  }
});

// Delete cash flow
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify cash flow exists and belongs to user
    const existingCashFlow = await SupabaseService.getCashFlow(id);
    if (!existingCashFlow || existingCashFlow.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Cash flow not found' });
    }

    const success = await SupabaseService.deleteCashFlow(id);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete cash flow' });
    }

    res.json({ message: 'Cash flow deleted successfully' });
  } catch (error) {
    console.error('Delete cash flow error:', error);
    res.status(500).json({ error: 'Failed to delete cash flow' });
  }
});

module.exports = router;