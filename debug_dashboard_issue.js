#!/usr/bin/env node
/**
 * Debug dashboard issue with real authentication
 */

const SupabaseService = require('./server/services/supabaseService');

async function debugDashboard() {
  try {
    console.log('🔍 Debugging Dashboard Issue...');
    
    const userId = 'e3f6919b-d83b-4456-8325-676550a4382d';
    const cashFlowId = 'c30c2672-2c39-4599-9e4e-0a536591a438';
    
    console.log('1. Testing getDashboardData directly...');
    
    try {
      const result = await SupabaseService.getDashboardData(userId, {
        cashFlowId: cashFlowId,
        year: 2025,
        month: 8
      });
      
      console.log('✅ getDashboardData works:', !!result);
      console.log('   Has data:', !!result.summary);
      
    } catch (dashError) {
      console.error('❌ getDashboardData failed:', dashError.message);
      console.error('Stack:', dashError.stack);
      return;
    }
    
    console.log('\n2. Testing getCashFlows...');
    try {
      const cashFlows = await SupabaseService.getCashFlows(userId);
      console.log('✅ getCashFlows works:', Array.isArray(cashFlows) ? `${cashFlows.length} flows` : 'Non-array result');
    } catch (flowError) {
      console.error('❌ getCashFlows failed:', flowError.message);
    }
    
    console.log('\n3. Testing getCashFlow (single)...');
    try {
      const singleFlow = await SupabaseService.getCashFlow(cashFlowId);
      console.log('✅ getCashFlow works:', !!singleFlow);
    } catch (singleError) {
      console.error('❌ getCashFlow failed:', singleError.message);
    }
    
    console.log('\n4. Testing other dashboard dependencies...');
    try {
      const latestMonth = await SupabaseService.getLatestTransactionMonth(userId, cashFlowId);
      console.log('✅ getLatestTransactionMonth works:', latestMonth);
    } catch (monthError) {
      console.error('❌ getLatestTransactionMonth failed:', monthError.message);
      console.error('This might be the issue!');
    }
    
    console.log('\n🎯 Attempting full dashboard route simulation...');
    
    // Simulate the exact flow from dashboard.js
    console.log('Step 1: Get cash flow...');
    const cashFlow = await SupabaseService.getCashFlow(cashFlowId);
    if (!cashFlow || cashFlow.user_id !== userId) {
      console.log('❌ Cash flow validation failed');
      return;
    }
    console.log('✅ Cash flow validated');
    
    console.log('Step 2: Get dashboard data...');
    const dashboardResult = await SupabaseService.getDashboardData(userId, {
      cashFlowId: cashFlowId,
      year: 2025,
      month: 8
    });
    
    console.log('✅ Dashboard data retrieved');
    
    console.log('Step 3: Get cash flows list...');
    const allCashFlows = await SupabaseService.getCashFlows(userId);
    console.log('✅ Cash flows list retrieved');
    
    console.log('\n🎉 All components work individually!');
    console.log('The issue must be in the route handling or response formatting.');
    
  } catch (error) {
    console.error('💥 Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugDashboard();