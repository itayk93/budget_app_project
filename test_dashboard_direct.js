#!/usr/bin/env node
const SupabaseService = require('./server/services/supabaseService');

async function testDashboard() {
  try {
    console.log('🧪 Testing dashboard data directly...');
    
    // Use the user ID from the logs
    const userId = 'e3f6919b-d83b-4456-8325-676550a4382d';
    const cashFlowId = 'c30c2672-2c39-4599-9e4e-0a536591a438';
    
    const options = {
      cashFlowId: cashFlowId,
      year: 2025,
      month: 8
    };
    
    console.log(`📊 Calling getDashboardData with userId: ${userId}`);
    console.log(`📊 Options:`, options);
    
    const result = await SupabaseService.getDashboardData(userId, options);
    
    if (result && result.success) {
      console.log('✅ Dashboard data retrieved successfully!');
      console.log('📈 Data preview:', {
        categoryTotals: result.data?.categoryTotals,
        totalTransactions: result.data?.categoryBreakdown ? Object.keys(result.data.categoryBreakdown).length : 0
      });
    } else {
      console.log('❌ Dashboard data failed:', result);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDashboard();