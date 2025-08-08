// NEW MODULAR CATEGORIES ROUTER - REPLACES categories.js
// This file demonstrates the new modular structure for categories routes

const express = require('express');
const router = express.Router();

// Import modular category route handlers
const categoriesBasic = require('./categories/categoriesBasic');
const categoriesOrder = require('./categories/categoriesOrder');
const categoriesBusiness = require('./categories/categoriesBusiness');
const categoriesTargets = require('./categories/categoriesTargets');
const categoriesShared = require('./categories/categoriesShared');

// ===== MODULAR CATEGORY ROUTES =====
// Each module handles a specific domain of category operations

// 1. Basic CRUD operations (137 lines -> categoriesBasic.js)
// Routes: GET /, GET /type/:type, GET /default, POST /, PUT /:id, DELETE /:id, GET /:id/transactions
router.use('/', categoriesBasic);

// 2. Category order and organization management (100+ lines -> categoriesOrder.js)
// Routes: GET /order, POST /reorder, POST /update-shared-category, POST /update-weekly-display
router.use('/', categoriesOrder);

// 3. Business-category mapping and bulk operations (150+ lines -> categoriesBusiness.js)
// Routes: GET /business-mappings, POST /import-mappings
router.use('/', categoriesBusiness);

// 4. Individual category monthly targets and analytics (129 lines -> categoriesTargets.js)
// Routes: POST /calculate-monthly-target, POST /update-monthly-target, GET /monthly-spending/:categoryName
router.use('/', categoriesTargets);

// 5. Shared category targets and collective spending management (136 lines -> categoriesShared.js)
// Routes: GET /shared-target/:sharedCategoryName, POST /update-shared-target, GET /shared-spending/:sharedCategoryName
// POST /set-use-shared-target
router.use('/', categoriesShared);

// ===== BENEFITS OF MODULAR STRUCTURE =====
// ✅ Reduced file size from 918 lines to ~100-150 lines per module
// ✅ Better organization and maintainability
// ✅ Easier testing and debugging
// ✅ Better team collaboration
// ✅ Clear separation of concerns

// ===== IMPLEMENTATION STATUS =====
// ✅ categoriesBasic.js - Basic CRUD operations (COMPLETED)
// ✅ categoriesOrder.js - Category order management (COMPLETED)  
// ✅ categoriesBusiness.js - Business mapping operations (COMPLETED)
// ✅ categoriesTargets.js - Monthly targets & analytics (COMPLETED)
// ✅ categoriesShared.js - Shared category management (COMPLETED)

module.exports = router;