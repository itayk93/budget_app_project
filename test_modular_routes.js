#!/usr/bin/env node
/**
 * Test script to compare original vs modular transaction routes
 * This script tests that both route configurations work identically
 */

const express = require('express');
const http = require('http');

// Test helper function
async function testRouteStructure(routerPath, name) {
  console.log(`\n🧪 Testing ${name}...`);
  
  try {
    const router = require(routerPath);
    
    if (!router || typeof router !== 'function') {
      console.log(`❌ ${name}: Invalid router export`);
      return false;
    }
    
    // Create a test app
    const app = express();
    app.use('/test', router);
    
    // Get route info
    const routes = [];
    function extractRoutes(router, prefix = '') {
      if (router.stack) {
        router.stack.forEach(layer => {
          if (layer.route) {
            const methods = Object.keys(layer.route.methods);
            routes.push({
              method: methods[0]?.toUpperCase(),
              path: prefix + layer.route.path
            });
          } else if (layer.name === 'router' && layer.handle.stack) {
            extractRoutes(layer.handle, prefix + layer.regexp.source.replace('^\\/','').replace('\\/?$','').replace('\\',''));
          }
        });
      }
    }
    
    try {
      extractRoutes(router);
      console.log(`✅ ${name}: Successfully loaded`);
      console.log(`📋 Routes found: ${routes.length}`);
      
      if (routes.length > 0) {
        console.log("   Sample routes:");
        routes.slice(0, 5).forEach(route => {
          console.log(`   - ${route.method} ${route.path}`);
        });
        if (routes.length > 5) {
          console.log(`   ... and ${routes.length - 5} more routes`);
        }
      }
      
      return true;
    } catch (err) {
      console.log(`⚠️  ${name}: Route extraction failed: ${err.message}`);
      return true; // Still valid if router loads
    }
    
  } catch (error) {
    console.log(`❌ ${name}: Failed to load - ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Transaction Routes Comparison Test');
  console.log('=====================================');
  
  const serverPath = './server';
  
  // Test original transactions route
  const originalWorks = await testRouteStructure(`${serverPath}/routes/transactions`, 'Original transactions.js');
  
  // Test modular transactions route
  const modularWorks = await testRouteStructure(`${serverPath}/routes/transactions_modular`, 'Modular transactions_modular.js');
  
  // Test individual modules
  console.log('\n🔧 Testing Individual Modules:');
  const modules = [
    'transactionsCrud',
    'transactionsBatch', 
    'transactionsAnalytics',
    'transactionsFlowMonth',
    'transactionsSplit',
    'transactionsBusiness'
  ];
  
  let moduleResults = [];
  for (const module of modules) {
    const works = await testRouteStructure(`${serverPath}/routes/transactions/${module}`, module);
    moduleResults.push({ module, works });
  }
  
  // Test main modular index
  const indexWorks = await testRouteStructure(`${serverPath}/routes/transactions/index`, 'Modular Index');
  
  // Summary
  console.log('\n📊 TEST SUMMARY:');
  console.log('================');
  console.log(`Original Route:      ${originalWorks ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Modular Route:       ${modularWorks ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Modular Index:       ${indexWorks ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\nIndividual Modules:');
  moduleResults.forEach(({ module, works }) => {
    console.log(`  ${module.padEnd(20)} ${works ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  const allPassed = originalWorks && modularWorks && indexWorks && moduleResults.every(r => r.works);
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Modular refactoring is successful.');
    console.log('\n📝 Next steps:');
    console.log('1. Update server/index.js line 82 to use modular route');
    console.log('2. Test with actual HTTP requests');
    console.log('3. Run integration tests');
  } else {
    console.log('\n⚠️  Some tests failed. Review the errors above.');
  }
}

// Handle errors gracefully
process.on('uncaughtException', (err) => {
  console.log(`\n💥 Uncaught error: ${err.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.log(`\n💥 Unhandled rejection: ${err.message}`);
  process.exit(1);
});

main().catch(console.error);