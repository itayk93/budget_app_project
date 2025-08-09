#!/usr/bin/env node
const SupabaseService = require('./server/services/supabaseService');

async function inspectServerResponse() {
  try {
    const userId = 'e3f6919b-d83b-4456-8325-676550a4382d';
    const cashFlowId = 'c30c2672-2c39-4599-9e4e-0a536591a438';
    
    console.log('🔍 Inspecting actual server response structure...');
    
    const result = await SupabaseService.getDashboardData(userId, {
      cashFlowId: cashFlowId,
      year: 2025,
      month: 8
    });
    
    console.log('\n📊 Server Response Structure:');
    console.log('Keys:', Object.keys(result));
    
    if (result.category_breakdown) {
      console.log('\n📋 Category Breakdown Structure:');
      console.log('- Type:', Array.isArray(result.category_breakdown) ? 'Array' : 'Object');
      console.log('- Length/Keys:', Array.isArray(result.category_breakdown) ? result.category_breakdown.length : Object.keys(result.category_breakdown));
      
      if (Array.isArray(result.category_breakdown)) {
        console.log('- Sample items:', result.category_breakdown.slice(0, 3).map(item => ({
          name: item.name,
          amount: item.amount,
          type: item.type
        })));
      }
    }
    
    if (result.categories) {
      console.log('\n📂 Categories Object:');
      console.log('Keys:', Object.keys(result.categories));
    } else {
      console.log('\n❌ No "categories" object found in response');
      console.log('This is why the frontend is failing!');
    }
    
    console.log('\n🎯 Frontend expects:');
    console.log('- dashboardData.categories["הכנסות לא תזרימיות"]');
    console.log('- dashboardData.categories["הוצאות לא תזרימיות"]');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

inspectServerResponse();