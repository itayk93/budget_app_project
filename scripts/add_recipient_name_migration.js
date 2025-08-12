const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET // Use service role key for admin operations
);

async function addRecipientNameColumn() {
  console.log('🔄 Starting migration: Adding recipient_name column to transactions table...');
  
  try {
    // First check if the column already exists
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'transactions')
      .eq('column_name', 'recipient_name');
    
    if (columnsError) {
      console.error('❌ Error checking if column exists:', columnsError);
      return;
    }
    
    if (columns && columns.length > 0) {
      console.log('✅ Column recipient_name already exists in transactions table');
      return;
    }
    
    // Add the column using SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE transactions 
        ADD COLUMN recipient_name TEXT DEFAULT NULL;
        
        CREATE INDEX IF NOT EXISTS idx_transactions_recipient_name 
        ON transactions(recipient_name) 
        WHERE recipient_name IS NOT NULL;
      `
    });
    
    if (error) {
      console.error('❌ Error adding recipient_name column:', error);
      return;
    }
    
    console.log('✅ Successfully added recipient_name column to transactions table');
    console.log('✅ Created index on recipient_name column');
    
    // Test the new column by selecting a few rows
    const { data: testData, error: testError } = await supabase
      .from('transactions')
      .select('id, business_name, notes, recipient_name')
      .limit(3);
    
    if (testError) {
      console.error('❌ Error testing new column:', testError);
    } else {
      console.log('✅ Test query successful. Sample data:');
      console.log(testData);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Alternative method using direct SQL if RPC doesn't work
async function addRecipientNameColumnDirect() {
  console.log('🔄 Trying direct SQL approach...');
  
  try {
    // Use the SQL query directly
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Cannot access transactions table:', error);
      return;
    }
    
    // Check if recipient_name column exists by trying to select it
    const { data: testColumn, error: testError } = await supabase
      .from('transactions')
      .select('recipient_name')
      .limit(1);
    
    if (testError) {
      if (testError.message.includes('column "recipient_name" does not exist')) {
        console.log('📝 Column does not exist, will need to add it via Supabase dashboard');
        console.log('Please run this SQL in your Supabase SQL editor:');
        console.log(`
ALTER TABLE transactions 
ADD COLUMN recipient_name TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_recipient_name 
ON transactions(recipient_name) 
WHERE recipient_name IS NOT NULL;
        `);
      } else {
        console.error('❌ Unexpected error:', testError);
      }
    } else {
      console.log('✅ Column recipient_name already exists');
    }
    
  } catch (error) {
    console.error('❌ Direct approach failed:', error);
  }
}

// Run the migration
addRecipientNameColumn().catch(() => {
  console.log('🔄 Fallback: Trying direct approach...');
  addRecipientNameColumnDirect();
});