const express = require('express');
const router = express.Router();

// Import modular transaction route handlers
const transactionsCrud = require('./transactionsCrud');
const transactionsBatch = require('./transactionsBatch');
const transactionsAnalytics = require('./transactionsAnalytics');
const transactionsFlowMonth = require('./transactionsFlowMonth');
const transactionsSplit = require('./transactionsSplit');

// ===== MODULAR TRANSACTION ROUTES =====

// Basic CRUD operations
// GET /, GET /:id, POST /, PUT /:id, DELETE /:id
router.use('/', transactionsCrud);

// Batch operations
// PATCH /batch, DELETE /batch, POST /api/transactions/batch_categorize
router.use('/', transactionsBatch);

// Analytics and reporting
// GET /analytics/by-category, GET /analytics/stats, GET /duplicates
router.use('/', transactionsAnalytics);

// Flow month operations
// PATCH /:id/flow-month, POST /api/transactions/delete_by_cash_flow
router.use('/', transactionsFlowMonth);

// Transaction splitting
// POST /split, POST /unsplit, GET /split/:originalTransactionId
router.use('/', transactionsSplit);

// TODO: Add remaining modules as they are created:
// router.use('/', require('./transactionsBusiness'));     // Business intelligence
// router.use('/', require('./transactionsApi'));          // Legacy API endpoints

module.exports = router;