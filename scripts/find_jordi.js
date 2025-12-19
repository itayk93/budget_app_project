const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findTransaction() {
    console.log("🔍 Searching for 'ג'ורדי' or 'גורדי' in transactions...");

    // Check Raw Scraper Transactions
    const { data: raw, error: rawError } = await supabase
        .from('bank_scraper_transactions')
        .select('*')
        .or('description.ilike.%ג\'ורדי%,description.ilike.%גורדי%')
        .limit(5);

    if (rawError) console.error("Raw Error:", rawError);
    console.log(`\n📂 Raw Scraper Storage: Found ${raw?.length || 0} matches`);
    if (raw && raw.length > 0) {
        raw.forEach(t => console.log(` - [${t.transaction_date}] ${t.description} (Amount: ${t.charged_amount})`));
    }

    // Check Pending Transactions
    const { data: pending, error: pendingError } = await supabase
        .from('bank_scraper_pending_transactions')
        .select('*')
        .or('business_name.ilike.%ג\'ורדי%,business_name.ilike.%גורדי%')
        .limit(5);

    if (pendingError) console.error("Pending Error:", pendingError);
    console.log(`\n⏳ Pending Transactions: Found ${pending?.length || 0} matches`);
    if (pending && pending.length > 0) {
        pending.forEach(t => console.log(` - [${t.payment_date}] ${t.business_name} (Amount: ${t.amount})`));
    }
}

findTransaction();
