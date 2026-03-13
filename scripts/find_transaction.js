const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Check for required env vars
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET;
if (!process.env.SUPABASE_URL || !serviceKey) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET in .env");
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, serviceKey);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => {
    return new Promise(resolve => rl.question(query, resolve));
};

async function findTransaction() {
    console.log("🔍 Transaction Finder Tool");
    console.log("--------------------------");

    const searchTerm = await askQuestion("Enter search term (business name or amount): ");

    if (!searchTerm) {
        console.log("❌ Search term cannot be empty");
        rl.close();
        return;
    }

    const isAmount = !isNaN(parseFloat(searchTerm));
    let queryFilter;

    if (isAmount) {
        console.log(`Searching for amount: ${searchTerm}`);
        // For amount, we check exact match or negative of that amount (expense)
        const amount = parseFloat(searchTerm);
        // Note: We can't easily do complex OR logic with amount across numeric/text fields in one go simply
        // So we'll try to match exact amount
    } else {
        console.log(`Searching for text: ${searchTerm}`);
    }

    console.log("\n1. Searching Raw Scraper Transactions...");
    try {
        let query = supabase
            .from('bank_scraper_transactions')
            .select('*')
            .order('transaction_date', { ascending: false })
            .limit(20);

        if (isAmount) {
            query = query.or(`charged_amount.eq.${searchTerm},charged_amount.eq.-${searchTerm}`);
        } else {
            query = query.ilike('description', `%${searchTerm}%`);
        }

        const { data: raw, error: rawError } = await query;

        if (rawError) throw rawError;

        if (raw && raw.length > 0) {
            console.log(`✅ Found ${raw.length} matches in Raw Storage:`);
            raw.forEach(t => console.log(`   - [${t.transaction_date}] ${t.description} (Amount: ${t.charged_amount}) Account: ${t.account_number}`));
        } else {
            console.log("   No matches found in raw storage.");
        }
    } catch (err) {
        console.error("   Error searching raw transactions:", err.message);
    }

    console.log("\n2. Searching Pending Transactions...");
    try {
        let query = supabase
            .from('bank_scraper_pending_transactions')
            .select('*')
            .order('payment_date', { ascending: false })
            .limit(20);

        if (isAmount) {
            query = query.or(`amount.eq.${searchTerm},amount.eq.-${searchTerm}`);
        } else {
            query = query.ilike('business_name', `%${searchTerm}%`);
        }

        const { data: pending, error: pendingError } = await query;

        if (pendingError) throw pendingError;

        if (pending && pending.length > 0) {
            console.log(`✅ Found ${pending.length} matches in Pending Transactions:`);
            pending.forEach(t => console.log(`   - [${t.payment_date}] ${t.business_name} (Amount: ${t.amount}) User: ${t.user_id}`));
        } else {
            console.log("   No matches found in pending transactions.");
        }
    } catch (err) {
        console.error("   Error searching pending transactions:", err.message);
    }

    rl.close();
}

findTransaction().catch(err => {
    console.error("Unexpected error:", err);
    rl.close();
});
