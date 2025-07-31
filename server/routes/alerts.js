
const express = require('express');
const router = express.Router();
const { authenticateToken: auth } = require('../middleware/auth');
const { getSupabase } = require('../config/supabase');

/**
 * @route   GET /api/alerts
 * @desc    Get all alerts for a user
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('stock_alerts')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

/**
 * @route   POST /api/alerts
 * @desc    Create a new alert
 * @access  Private
 */
router.post('/', auth, async (req, res) => {
    const { stock_symbol, alert_type, target_value, notification_method } = req.body;
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('stock_alerts')
            .insert([{ user_id: req.user.id, stock_symbol, alert_type, target_value, notification_method, is_active: true }])
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

/**
 * @route   PUT /api/alerts/:id
 * @desc    Update an alert
 * @access  Private
 */
router.put('/:id', auth, async (req, res) => {
    const { stock_symbol, alert_type, target_value, notification_method, is_active } = req.body;
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('stock_alerts')
            .update({ stock_symbol, alert_type, target_value, notification_method, is_active })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

/**
 * @route   DELETE /api/alerts/:id
 * @desc    Delete an alert
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        const supabase = getSupabase();
        const { error } = await supabase
            .from('stock_alerts')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.json({ msg: 'Alert removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
