const express = require('express');
const { adminClient } = require('../config/supabase');

const router = express.Router();

const FLOW_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const normalizeCategoryName = (name = '') => name.trim();

router.get('/', async (req, res) => {
  try {
    const { flow_month: flowMonth, user_id: queryUserId } = req.query;
    let targetUserId = req.user.id;

    if (!flowMonth || !FLOW_MONTH_REGEX.test(flowMonth)) {
      return res.status(400).json({ error: 'flow_month is required in YYYY-MM format (e.g. 2025-10)' });
    }

    if (queryUserId) {
      if (req.user.role === 'admin' || queryUserId === req.user.id) {
        targetUserId = queryUserId;
      } else {
        return res.status(403).json({ error: 'Forbidden: cannot access other users data' });
      }
    }

    // Try RPC first (if the database function exists)
    let rpcPayload = null;
    try {
      const rpcResult = await adminClient.rpc('get_cashflow_with_targets', {
        p_user_id: targetUserId,
        p_flow_month: flowMonth,
      });

      if (rpcResult.error) {
        const errMessage = rpcResult.error.message || '';
        const isMissingFunc = errMessage.includes('does not exist') || errMessage.includes('Unknown function');
        if (isMissingFunc) {
          console.warn('RPC get_cashflow_with_targets missing, falling back to manual query');
        } else {
          console.warn('RPC get_cashflow_with_targets error, falling back', rpcResult.error);
        }
      } else {
        rpcPayload = (rpcResult.data || []).map(row => ({
          flow_month: row.flow_month || flowMonth,
          user_id: row.user_id || targetUserId,
          category_name: normalizeCategoryName(row.category_name),
          monthly_target: row.monthly_target ?? null,
        }));
      }
    } catch (rpcError) {
      console.warn('RPC get_cashflow_with_targets threw error, falling back', rpcError.message);
    }

    if (rpcPayload) {
      const deduped = Array.from(
        new Map(
          rpcPayload.map(item => [`${item.flow_month}:${item.category_name}`, item])
        ).values()
      ).sort((a, b) => a.category_name.localeCompare(b.category_name));

      return res.json(deduped);
    }

    // Manual fallback – fetch transactions and match against category_order
    const { data: transactions, error: transactionsError } = await adminClient
      .from('transactions')
      .select('category_name')
      .eq('user_id', targetUserId)
      .eq('flow_month', flowMonth);

    if (transactionsError) {
      throw transactionsError;
    }

    const uniqueCategories = Array.from(
      new Set(
        (transactions || [])
          .map(row => normalizeCategoryName(row.category_name))
          .filter(Boolean)
      )
    );

    if (uniqueCategories.length === 0) {
      return res.json([]);
    }

    const { data: categoryOrderRows, error: categoryOrderError } = await adminClient
      .from('category_order')
      .select('category_name, monthly_target')
      .eq('user_id', targetUserId);

    if (categoryOrderError) {
      throw categoryOrderError;
    }

    const targetMap = new Map(
      (categoryOrderRows || []).map(row => [
        normalizeCategoryName(row.category_name),
        row.monthly_target !== null && row.monthly_target !== undefined
          ? Number(row.monthly_target)
          : null,
      ])
    );

    const response = uniqueCategories
      .map(categoryName => ({
        flow_month: flowMonth,
        user_id: targetUserId,
        category_name: categoryName,
        monthly_target: targetMap.has(categoryName) ? targetMap.get(categoryName) : null,
      }))
      .sort((a, b) => a.category_name.localeCompare(b.category_name));

    return res.json(response);
  } catch (error) {
    console.error('Error in /api/cashflow-with-targets:', error);
    return res.status(500).json({ error: 'Failed to fetch cash flow targets' });
  }
});

module.exports = router;
