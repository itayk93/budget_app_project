require('dotenv').config();
const SupabaseService = require('./server/services/supabaseService');
const AdditionalMethods = require('./server/services/supabase-modules/AdditionalMethods');

async function debugDashboard() {
  try {
    console.log('🚀 Starting dashboard debug...\n');
    
    // Test parameters from the failing request
    const cash_flow = 'c30c2672-2c39-4599-9e4e-0a536591a438';
    const all_time = '1';
    const format = 'json';
    
    console.log('Parameters:');
    console.log('- cash_flow:', cash_flow);
    console.log('- all_time:', all_time);
    console.log('- format:', format, '\n');
    
    // First, test if we can get any cash flow info (will fail if cash flow doesn't exist)
    console.log('🔍 Testing cash flow existence...');
    try {
      const cashFlow = await SupabaseService.getCashFlow(cash_flow);
      console.log('Cash flow result:', cashFlow);
      
      if (!cashFlow) {
        console.log('❌ Cash flow not found');
        return;
      }
      
      console.log('✅ Cash flow exists, user_id:', cashFlow.user_id);
      
      // Now test with the actual user_id
      const userId = cashFlow.user_id;
      const allTime = all_time === '1' || all_time === 'true';
      
      console.log('\n🎯 Testing getDashboardData...');
      console.log('Parameters for getDashboardData:');
      console.log('- userId:', userId);
      console.log('- flowMonth:', null, '(null because allTime is true)');
      console.log('- cashFlowId:', cash_flow);
      console.log('- allTime:', allTime);
      console.log('- year:', null);
      console.log('- month:', null);
      console.log('- hideEmptyCategories:', false);
      
      const dashboardResult = await AdditionalMethods.getDashboardData(userId, {
        flowMonth: null,
        cashFlowId: cash_flow,
        allTime: allTime,
        year: null,
        month: null,
        hideEmptyCategories: false
      });
      
      console.log('\n✅ getDashboardData completed successfully!');
      console.log('Result structure:', {
        success: dashboardResult.success,
        hasData: !!dashboardResult.data,
        dataKeys: dashboardResult.data ? Object.keys(dashboardResult.data) : null
      });
      
      if (dashboardResult.success && dashboardResult.data) {
        const data = dashboardResult.data;
        console.log('\n📊 Dashboard data summary:');
        console.log('- Category breakdown entries:', data.category_breakdown ? data.category_breakdown.length : 0);
        console.log('- Total income:', data.total_income || 0);
        console.log('- Total expenses:', data.total_expenses || 0);
        console.log('- Transaction count:', data.transaction_count || 0);
      }
      
    } catch (error) {
      console.error('❌ Error testing cash flow:', error.message);
      console.error('Stack:', error.stack);
    }
    
  } catch (error) {
    console.error('❌ Debug script error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugDashboard();