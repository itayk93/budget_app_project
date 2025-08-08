const express = require('express');
const router = express.Router();

// Import modular category route handlers
const categoriesBasic = require('./categoriesBasic');
const categoriesOrder = require('./categoriesOrder');
const categoriesBusiness = require('./categoriesBusiness');
const categoriesTargets = require('./categoriesTargets');
const categoriesShared = require('./categoriesShared');

// ===== MODULAR CATEGORY ROUTES =====

// Basic CRUD operations
// GET /, GET /type/:type, GET /default, POST /, PUT /:id, DELETE /:id, GET /:id/transactions
router.use('/', categoriesBasic);

// Category order and organization management
// GET /order, POST /reorder, POST /update-shared-category, POST /update-weekly-display
router.use('/', categoriesOrder);

// Business-category mapping and bulk operations
// GET /business-mappings, POST /import-mappings
router.use('/', categoriesBusiness);

// Individual category monthly targets and analytics
// POST /calculate-monthly-target, POST /update-monthly-target, GET /monthly-spending/:categoryName
router.use('/', categoriesTargets);

// Shared category targets and collective spending management
// GET /shared-target/:sharedCategoryName, POST /update-shared-target, GET /shared-spending/:sharedCategoryName
// POST /set-use-shared-target
router.use('/', categoriesShared);

module.exports = router;