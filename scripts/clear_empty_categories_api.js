#!/usr/bin/env node

// Simple script to clear empty categories using the API endpoint
const https = require('https');

async function clearEmptyCategories() {
  try {
    console.log('🔄 Starting server to access API...');
    
    // Start the server
    const { spawn } = require('child_process');
    const server = spawn('node', ['server/index.js'], {
      cwd: '/Users/itaykarkason/Python Projects/budget_app_project',
      stdio: 'pipe'
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📞 Making API call to clear empty categories...');
    
    // Make API call to get test token (you'll need to replace with your actual token)
    console.log('⚠️ Please manually:');
    console.log('1. Go to http://localhost:4000/dashboard');
    console.log('2. Open developer tools (F12)');
    console.log('3. Go to Application tab > Local Storage');
    console.log('4. Copy the "token" value');
    console.log('5. Run this command in a new terminal:');
    console.log('');
    console.log('curl -X DELETE "http://localhost:5001/api/user-empty-categories-display?year=2025&month=8&cash_flow_id=YOUR_CASH_FLOW_ID" \\');
    console.log('  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\');
    console.log('  -H "Content-Type: application/json"');
    console.log('');
    console.log('6. Refresh your dashboard');
    
    // Clean up
    server.kill();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

clearEmptyCategories();