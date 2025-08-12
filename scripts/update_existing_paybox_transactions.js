/**
 * Script to update existing PAYBOX transactions and extract recipient names
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET
);

// Recipient extraction function (same as in TransactionService)
function extractRecipientName(businessName, notes) {
  // Check if this is a PAYBOX transaction and has recipient info in notes
  if (businessName && businessName.includes('PAYBOX') && notes) {
    // Match Hebrew or English names after "למי:" - stop at common English words that indicate additional info
    const recipientMatch = notes.match(/למי:\s*(.+?)(?:\s+(?:some|additional|notes|info|details|comment|remark)|$)/);
    if (recipientMatch) {
      const recipientName = recipientMatch[1].trim();
      
      console.log(`🎯 [RECIPIENT EXTRACTION] Found recipient: "${recipientName}" for PAYBOX transaction`);
      
      // Remove the entire "למי: [name]" part from notes
      const pattern = new RegExp(`למי:\\s*${recipientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'g');
      const cleanedNotes = notes.replace(pattern, '').trim();
      
      return {
        recipientName: recipientName,
        cleanedNotes: cleanedNotes || null
      };
    }
  }
  
  return {
    recipientName: null,
    cleanedNotes: notes
  };
}

async function updateExistingPayboxTransactions() {
  console.log('🔄 Starting update of existing PAYBOX transactions...');
  
  try {
    // First, get all PAYBOX transactions that have "למי:" in notes
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, business_name, notes, recipient_name')
      .ilike('business_name', '%PAYBOX%')
      .ilike('notes', '%למי:%');
    
    if (fetchError) {
      console.error('❌ Error fetching PAYBOX transactions:', fetchError);
      return;
    }
    
    if (!transactions || transactions.length === 0) {
      console.log('✅ No PAYBOX transactions with "למי:" found.');
      return;
    }
    
    console.log(`📊 Found ${transactions.length} PAYBOX transactions to update:`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const transaction of transactions) {
      console.log(`\n🔍 Processing transaction ID: ${transaction.id}`);
      console.log(`   Business: ${transaction.business_name}`);
      console.log(`   Current notes: ${transaction.notes}`);
      console.log(`   Current recipient_name: ${transaction.recipient_name}`);
      
      // Extract recipient info
      const recipientInfo = extractRecipientName(transaction.business_name, transaction.notes);
      
      if (recipientInfo.recipientName) {
        console.log(`   ➡️  Extracted recipient: "${recipientInfo.recipientName}"`);
        console.log(`   ➡️  Cleaned notes: "${recipientInfo.cleanedNotes}"`);
        
        // Update the transaction
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            recipient_name: recipientInfo.recipientName,
            notes: recipientInfo.cleanedNotes,
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.id);
        
        if (updateError) {
          console.error(`   ❌ Error updating transaction ${transaction.id}:`, updateError);
        } else {
          console.log(`   ✅ Successfully updated transaction ${transaction.id}`);
          updated++;
        }
      } else {
        console.log(`   ⏭️  Skipped - no recipient found`);
        skipped++;
      }
    }
    
    console.log(`\n🏁 Update completed:`);
    console.log(`   ✅ Updated: ${updated} transactions`);
    console.log(`   ⏭️  Skipped: ${skipped} transactions`);
    
    if (updated > 0) {
      console.log('\n🎉 PAYBOX transactions have been updated! Refresh your page to see the changes.');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

// Run the update
updateExistingPayboxTransactions();