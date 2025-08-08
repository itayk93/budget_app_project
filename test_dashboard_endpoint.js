#!/usr/bin/env node
const axios = require('axios');

async function testDashboardEndpoint() {
  try {
    console.log('🧪 Testing dashboard endpoint...');
    
    // This will fail with 401 but we can see if it's 500 or 401
    try {
      const response = await axios.get('http://localhost:5001/api/dashboard?year=2025&month=8&cash_flow=c30c2672-2c39-4599-9e4e-0a536591a438&all_time=0&format=json');
      console.log('✅ Dashboard endpoint successful!', response.status);
    } catch (error) {
      if (error.response) {
        if (error.response.status === 401) {
          console.log('✅ Dashboard endpoint responding (401 - needs auth, as expected)');
        } else if (error.response.status === 500) {
          console.log('❌ Dashboard endpoint still has 500 error');
          console.log('Error details:', error.response.data);
        } else {
          console.log(`📊 Dashboard endpoint status: ${error.response.status}`);
        }
      } else {
        console.log('❌ Network error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDashboardEndpoint();