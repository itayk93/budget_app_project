const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET;
const supabase = createClient(process.env.SUPABASE_URL, serviceKey);

async function fixJordi() {
    console.log("🔧 Fixing 'Jordi' status...");

    // Find the pending transaction
    const { data: txs, error: findError } = await supabase
        .from('bank_scraper_transactions')
        .select('*')
        .ilike('description', '%ג\'ורדי%')
        .eq('status', 'pending');

    if (findError) {
        console.error("❌ Error finding transaction:", findError);
        return;
    }

    if (!txs || txs.length === 0) {
        console.log("⚠️ No 'pending' Jordi transaction found. It might be already fixed.");
        return;
    }

    console.log(`Found ${txs.length} pending transaction(s). Updating...`);

    for (const tx of txs) {
        const { error: updateError } = await supabase
            .from('bank_scraper_transactions')
            .update({
                status: 'completed',
                processed_date: new Date().toISOString()
            })
            .eq('id', tx.id);

        if (updateError) {
            console.error(`❌ Failed to update ID ${tx.id}:`, updateError);
        } else {
            console.log(`✅ Successfully updated ID ${tx.id} to 'completed'.`);
        }
    }
}

fixJordi();
