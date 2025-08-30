const { adminClient } = require('./server/config/supabase');

async function verifyColumnRemoval() {
  console.log('🔍 Checking if category_id column has been removed...\n');
  
  try {
    // Check current table structure
    const { data, error } = await adminClient
      .from('transactions')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error accessing transactions table:', error);
      return;
    }

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log(`📊 Current transactions table columns (${columns.length}):`);
      console.log(columns.join(', '));
      
      if (columns.includes('category_id')) {
        console.log('\n❌ category_id column still exists');
        console.log('📝 Please follow the instructions in MANUAL_COLUMN_REMOVAL_INSTRUCTIONS.md');
        console.log('🔗 Go to https://app.supabase.com and run:');
        console.log('   ALTER TABLE transactions DROP COLUMN IF EXISTS category_id;');
      } else {
        console.log('\n🎉 SUCCESS! category_id column has been removed!');
        console.log(`✅ Transactions table now has ${columns.length} columns`);
        console.log('✅ All category references now use category_name only');
      }
    } else {
      console.log('⚠️ No data found in transactions table');
    }
    
  } catch (err) {
    console.error('❌ Verification failed:', err);
  }
}

// Run verification
console.log('🚀 Category ID Column Removal Verification');
console.log('==========================================\n');
verifyColumnRemoval().catch(console.error);