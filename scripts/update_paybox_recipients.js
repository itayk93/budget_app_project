const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET
);

function extractRecipientName(businessName, notes) {
  // Check if this is a PAYBOX transaction and has recipient info in notes
  if (businessName && businessName.includes('PAYBOX') && notes) {
    // Try multiple patterns for recipient extraction
    let recipientMatch = null;
    let pattern = null;
    let recipientName = null;
    
    // Pattern 1: "למי: [name]"
    recipientMatch = notes.match(/למי:\s*(.+?)(?:\s+(?:some|additional|notes|info|details|comment|remark)|$)/);
    if (recipientMatch) {
      recipientName = recipientMatch[1].trim();
      pattern = new RegExp(`למי:\\s*${recipientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'g');
      console.log(`🎯 Found recipient with "למי:" pattern: "${recipientName}"`);
    } else {
      // Pattern 2: "שובר ל-[name]" or "שוברים ל-[name]" or "שוברים לקניה ב-[name]"
      recipientMatch = notes.match(/שוברי?ם?\s+ל(?:קניה\s+ב)?-(.+?)(?:\s+|$)/);
      if (recipientMatch) {
        recipientName = recipientMatch[1].trim();
        pattern = new RegExp(`שוברי?ם?\\s+ל(?:קניה\\s+ב)?-${recipientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`, 'g');
        console.log(`🎯 Found recipient with "שובר/שוברים" pattern: "${recipientName}"`);
      }
    }
    
    if (recipientName) {
      // Clean the notes by removing the recipient pattern
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

async function updatePayboxTransactions() {
  console.log('🚀 Starting PAYBOX recipient extraction update...\n');
  
  try {
    // Get all PAYBOX transactions that have notes and don't have recipient_name yet
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, business_name, notes, recipient_name')
      .ilike('business_name', '%PAYBOX%')
      .or('notes.like.%למי:%,notes.like.%שובר%')
      .is('recipient_name', null);
    
    if (fetchError) {
      console.error('❌ Error fetching transactions:', fetchError);
      return;
    }
    
    if (!transactions || transactions.length === 0) {
      console.log('✅ No PAYBOX transactions found that need recipient extraction.');
      return;
    }
    
    console.log(`📊 Found ${transactions.length} PAYBOX transactions to process:\n`);
    
    let updatedCount = 0;
    
    for (const transaction of transactions) {
      console.log(`Processing transaction ${transaction.id}:`);
      console.log(`  Business: ${transaction.business_name}`);
      console.log(`  Notes: "${transaction.notes}"`);
      
      const result = extractRecipientName(transaction.business_name, transaction.notes);
      
      if (result.recipientName) {
        console.log(`  ✅ Found recipient: "${result.recipientName}"`);
        console.log(`  📝 Cleaned notes: "${result.cleanedNotes}"`);
        
        // Update the transaction
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            recipient_name: result.recipientName,
            notes: result.cleanedNotes,
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.id);
        
        if (updateError) {
          console.error(`  ❌ Error updating transaction ${transaction.id}:`, updateError);
        } else {
          console.log(`  ✅ Updated transaction ${transaction.id}`);
          updatedCount++;
        }
      } else {
        console.log('  ⚠️  No recipient pattern found');
      }
      
      console.log('---');
    }
    
    console.log(`\n🎉 Update complete! Updated ${updatedCount} out of ${transactions.length} transactions.`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the update
updatePayboxTransactions();