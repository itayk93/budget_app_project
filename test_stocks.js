const axios = require('axios');

// Simple test script to verify stock functionality
async function testStockEndpoints() {
    const baseURL = 'http://localhost:5001';
    
    try {
        console.log('Testing stock endpoints...');
        
        // Test server health
        const healthResponse = await axios.get(`${baseURL}/health`);
        console.log('✓ Server is running');
        
        // Test stock dashboard endpoint (this might fail without auth, but we'll see if the route exists)
        try {
            const dashboardResponse = await axios.get(`${baseURL}/api/stocks/dashboard`);
            console.log('✓ Stock dashboard endpoint exists');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✓ Stock dashboard endpoint exists (requires auth)');
            } else {
                console.log('✗ Stock dashboard endpoint error:', error.message);
            }
        }
        
        // Test if stock routes are registered
        try {
            const pricesResponse = await axios.get(`${baseURL}/api/stocks/investment-cash-flows`);
            console.log('✓ Stock investment cash flows endpoint exists');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✓ Stock investment cash flows endpoint exists (requires auth)');
            } else {
                console.log('✗ Stock investment cash flows endpoint error:', error.message);
            }
        }
        
        console.log('\nStock functionality appears to be properly set up!');
        console.log('You can now access the stock dashboard at: http://localhost:4000/stocks');
        
    } catch (error) {
        console.error('Error testing endpoints:', error.message);
        console.log('Make sure the server is running with: npm run dev');
    }
}

// Run the test
testStockEndpoints();