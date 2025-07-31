const supabase = require('./server/config/supabase');
const SupabaseService = require('./server/services/supabaseService');

async function migrateHashes() {
  try {
    console.log('🔄 Starting direct migration...');
    
    // Get all transactions for this user
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', 'e3f6919b-d83b-4456-8325-676550a4382d');
    
    if (fetchError) {
      throw new Error('Failed to fetch transactions: ' + fetchError.message);
    }
    
    console.log('Found ' + transactions.length + ' transactions');
    
    let updated_count = 0;
    let error_count = 0;
    
    for (const transaction of transactions) {
      try {
        // Generate new hash with the corrected function
        const old_hash = transaction.transaction_hash;
        const new_hash = SupabaseService.generateTransactionHash(transaction);
        
        if (old_hash !== new_hash) {
          console.log('Updating transaction: ' + transaction.business_name);
          console.log('  Old hash: ' + old_hash);
          console.log('  New hash: ' + new_hash);
          
          const { error: updateError } = await supabase
            .from('transactions')
            .update({ transaction_hash: new_hash })
            .eq('id', transaction.id);
          
          if (updateError) {
            console.error('Error updating transaction ' + transaction.id + ':', updateError);
            error_count++;
          } else {
            updated_count++;
          }
        }
      } catch (error) {
        console.error('Exception processing transaction ' + transaction.id + ':', error);
        error_count++;
      }
    }
    
    console.log('🎉 Migration completed: ' + updated_count + ' updated, ' + error_count + ' errors');
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}

migrateHashes();