require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkTables() {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET
    );
    
    console.log('Checking if stock tables exist...');
    
    const tables = [
        'stocks',
        'stock_holdings', 
        'stock_prices',
        'stock_transactions_summary',
        'stock_alerts',
        'stock_alert_history',
        'daily_portfolio_performance',
        'watchlist'
    ];
    
    for (const table of tables) {
        try {
            const { data, error } = await supabase
                .from(table)
                .select('id')
                .limit(1);
                
            if (error) {
                if (error.code === '42P01') {
                    console.log(`❌ Table "${table}" does not exist`);
                } else {
                    console.log(`⚠️  Table "${table}" error: ${error.message}`);
                }
            } else {
                console.log(`✅ Table "${table}" exists`);
            }
        } catch (err) {
            console.log(`❌ Table "${table}" check failed: ${err.message}`);
        }
    }
    
    console.log('\nTo create the missing tables, run this SQL in Supabase:');
    console.log('Path: /Users/itaykarkason/Python Projects/budget_app_project_new/sql/create_stock_system_tables.sql');
}

checkTables().then(() => {
    console.log('\nTable check complete!');
    process.exit(0);
}).catch(err => {
    console.error('Error checking tables:', err);
    process.exit(1);
});