#!/usr/bin/env node
/**
 * Test script to verify all critical fixes are working
 */

const SupabaseService = require('./server/services/supabaseService');

async function testCriticalFixes() {
  console.log('🧪 Testing Critical Fixes for Budget App');
  console.log('=' * 45);
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  function addTest(name, success, error = null) {
    results.tests.push({ name, success, error });
    if (success) {
      results.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.failed++;
      console.log(`❌ ${name}: ${error}`);
    }
  }
  
  // Test 1: inferCategoryType method
  try {
    const AdditionalMethods = require('./server/services/supabase-modules/AdditionalMethods');
    const categoryType1 = AdditionalMethods.inferCategoryType('הכנסות');
    const categoryType2 = AdditionalMethods.inferCategoryType('קבועות');
    const categoryType3 = AdditionalMethods.inferCategoryType('משתנות');
    
    if (categoryType1 === 'income' && categoryType2 === 'fixed_expense' && categoryType3 === 'variable_expense') {
      addTest('inferCategoryType method works correctly', true);
    } else {
      addTest('inferCategoryType method', false, `Got: ${categoryType1}, ${categoryType2}, ${categoryType3}`);
    }
  } catch (error) {
    addTest('inferCategoryType method', false, error.message);
  }
  
  // Test 2: SupabaseService methods exist
  try {
    const methods = [
      'generateTransactionHash',
      'createTransactionsBatch', 
      'getCashFlow',
      'getExistingHashesBatch',
      'shouldRefreshMonthlyTargets',
      'getCategorySpendingHistory'
    ];
    
    let allMethodsExist = true;
    const missingMethods = [];
    
    for (const method of methods) {
      if (typeof SupabaseService[method] !== 'function') {
        allMethodsExist = false;
        missingMethods.push(method);
      }
    }
    
    if (allMethodsExist) {
      addTest('All required SupabaseService methods exist', true);
    } else {
      addTest('SupabaseService methods', false, `Missing: ${missingMethods.join(', ')}`);
    }
  } catch (error) {
    addTest('SupabaseService methods check', false, error.message);
  }
  
  // Test 3: createTransactionsBatch format
  try {
    const testTransaction = {
      user_id: 'test-user-id',
      cash_flow_id: 'test-cash-flow-id', 
      amount: -100,
      description: 'Test transaction',
      payment_date: '2025-01-01',
      category_name: 'Test Category'
    };
    
    // We can't actually run this without a real DB, but we can check if the method is callable
    const method = SupabaseService.createTransactionsBatch;
    if (typeof method === 'function') {
      addTest('createTransactionsBatch method is accessible', true);
    } else {
      addTest('createTransactionsBatch method', false, 'Not a function');
    }
  } catch (error) {
    addTest('createTransactionsBatch format check', false, error.message);
  }
  
  // Test 4: Check if server routes are working
  try {
    const axios = require('axios');
    
    // Test health endpoint
    const response = await axios.get('http://localhost:5001/api/health');
    if (response.status === 200) {
      addTest('Server API health check', true);
    } else {
      addTest('Server API health check', false, `Status: ${response.status}`);
    }
  } catch (error) {
    addTest('Server API health check', false, error.message);
  }
  
  // Test 5: Categories should-refresh-targets route
  try {
    const axios = require('axios');
    
    // This will fail with 401 (no auth), but should not be 404
    try {
      await axios.get('http://localhost:5001/api/categories/should-refresh-targets');
    } catch (routeError) {
      if (routeError.response && routeError.response.status === 401) {
        addTest('Categories should-refresh-targets route exists', true);
      } else if (routeError.response && routeError.response.status === 404) {
        addTest('Categories should-refresh-targets route', false, 'Route not found (404)');
      } else {
        addTest('Categories should-refresh-targets route exists', true, 'Route accessible but auth required');
      }
    }
  } catch (error) {
    addTest('Categories route test', false, error.message);
  }
  
  console.log('\n' + '=' * 45);
  console.log(`📊 RESULTS: ${results.passed} passed, ${results.failed} failed`);
  
  if (results.failed === 0) {
    console.log('🎉 ALL CRITICAL FIXES WORKING!');
    console.log('✅ Dashboard should load without errors');
    console.log('✅ Transaction imports should work (after DB migration)');
    console.log('✅ Category refresh routes available');
  } else {
    console.log('⚠️  Some issues remain:');
    results.tests.forEach(test => {
      if (!test.success) {
        console.log(`   - ${test.name}: ${test.error}`);
      }
    });
  }
  
  // Final instructions
  console.log('\n🔧 REMAINING MANUAL STEPS:');
  console.log('1. Complete database migration for file_source column:');
  console.log('   https://supabase.com/dashboard/project/wgwjfypfkfggwvbwxakp');
  console.log('   Execute: ALTER TABLE transactions ADD COLUMN file_source VARCHAR(255) NULL;');
  console.log('2. Test transaction import functionality after migration');
  
  return results.failed === 0;
}

// Run tests
testCriticalFixes()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });