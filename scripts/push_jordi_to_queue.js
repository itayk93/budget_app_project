const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET;
const supabase = createClient(process.env.SUPABASE_URL, serviceKey);

// Hash function used by the service (MD5 of certain fields) to detect duplicates
function generateTransactionHash(tx) {
    const data = `${tx.payment_date}_${tx.amount}_${tx.business_name}`;
    return crypto.createHash('md5').update(data).digest('hex');
}

async function pushJordi() {
    console.log("🚀 Pushing 'Jordi' to Pending Queue...");

    // 1. Get the Raw Transaction (now 'completed')
    const { data: rawTxs, error: rawError } = await supabase
        .from('bank_scraper_transactions')
        .select('*')
        .ilike('description', '%ג\'ורדי%')
        .eq('status', 'completed')
        .limit(1);

    if (rawError || !rawTxs || rawTxs.length === 0) {
        console.error("❌ Could not find the RAW 'completed' Jordi transaction. Did the previous fix work?");
        return;
    }

    const raw = rawTxs[0];
    console.log(`found raw transaction: ${raw.description}, ID: ${raw.id}`);

    // 2. Prepare Pending Object
    // We need the user_id. We'll grab it from an existing pending transaction for config 3, or hardcode from user's log if needed.
    // Let's try to find any pending tx for this config to get user_id
    const { data: sample } = await supabase
        .from('bank_scraper_pending_transactions')
        .select('user_id')
        .eq('config_id', raw.config_id)
        .limit(1);

    const userId = sample && sample.length > 0 ? sample[0].user_id : 'e3f6919b-d83b-4456-8325-676550a4382d'; // Fallback to ID from user's message

    const amount = raw.charged_amount.toString();
    const paymentDate = raw.transaction_date;
    const businessName = raw.description; // In real app, this runs through cleanBusinessName, but raw is fine here

    // Construct the pending object
    const pendingTx = {
        user_id: userId,
        config_id: raw.config_id,
        business_name: businessName,
        payment_date: paymentDate,
        amount: amount,
        currency: raw.original_currency || '₪',
        payment_method: raw.account_number,
        payment_identifier: raw.transaction_identifier,
        category_name: parseFloat(amount) <= 0 ? 'הוצאות משתנות' : 'הכנסות משתנות',
        payment_month: new Date(paymentDate).getMonth() + 1,
        payment_year: new Date(paymentDate).getFullYear(),
        flow_month: new Date(paymentDate).toISOString().slice(0, 7), // YYYY-MM
        charge_date: raw.processed_date || null, // Best guess
        source_type: 'bank_scraper',
        original_amount: raw.original_amount ? raw.original_amount.toString() : amount,
        transaction_hash: null, // Will generate below
        status: 'pending', // This is the status in the QUEUE, meaning "Waiting for user action", not bank status
        bank_scraper_source_id: raw.id
    };

    pendingTx.transaction_hash = generateTransactionHash(pendingTx);

    // 3. Insert into Pending
    const { data: inserted, error: insertError } = await supabase
        .from('bank_scraper_pending_transactions')
        .insert([pendingTx])
        .select();

    if (insertError) {
        console.error("❌ Error inserting to pending:", insertError);
    } else {
        console.log(`✅ Successfully pushed to Pending! ID: ${inserted[0].id}`);
    }
}

pushJordi();
