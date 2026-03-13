const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET;

if (!process.env.SUPABASE_URL || !serviceKey) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET in .env");
    console.log("Env keys:", Object.keys(process.env));
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, serviceKey);

async function findTransaction() {
    console.log("🔍 Searching for 'פרטנר' in transactions or amount 119...");

    // Check Raw Scraper Transactions
    const { data: raw, error: rawError } = await supabase
        .from('bank_scraper_transactions')
        .select('*')
        .or('description.ilike.%פרטנר%,charged_amount.eq.119')
        .order('transaction_date', { ascending: false })
        .limit(10);

    if (rawError) console.error("Raw Error:", rawError);
    console.log(`\n📂 Raw Scraper Storage: Found ${raw?.length || 0} matches`);
    if (raw && raw.length > 0) {
        raw.forEach(t => console.log(` - [${t.transaction_date}] ${t.description} (Amount: ${t.charged_amount}) Account: ${t.account_number} Config: ${t.config_id}`));
    } else {
        console.log("No raw transactions found.");
    }

    // Check Pending Transactions
    const { data: pending, error: pendingError } = await supabase
        .from('bank_scraper_pending_transactions')
        .select('*')
        .or('business_name.ilike.%פרטנר%,amount.eq.119')
        .order('payment_date', { ascending: false })
        .limit(10);

    if (pendingError) console.error("Pending Error:", pendingError);
    console.log(`\n⏳ Pending Transactions: Found ${pending?.length || 0} matches`);
    if (pending && pending.length > 0) {
        pending.forEach(t => console.log(` - [${t.payment_date}] ${t.business_name} (Amount: ${t.amount}) User: ${t.user_id}`));
    } else {
        console.log("No pending transactions found.");
    }
}

findTransaction();
