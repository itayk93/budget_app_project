const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET
);

async function testRecipientNameColumn() {
  console.log('🔄 Testing if recipient_name column exists...');
  
  try {
    // Try to select the column to see if it exists
    const { data, error } = await supabase
      .from('transactions')
      .select('id, business_name, notes, recipient_name')
      .limit(1);
    
    if (error) {
      if (error.message.includes('column "recipient_name" does not exist')) {
        console.log('❌ Column does not exist. Please add it manually.');
        console.log('Please run this SQL in your Supabase SQL editor:');
        console.log(`
ALTER TABLE transactions 
ADD COLUMN recipient_name TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_recipient_name 
ON transactions(recipient_name) 
WHERE recipient_name IS NOT NULL;
        `);
        return false;
      } else {
        console.error('❌ Unexpected error:', error);
        return false;
      }
    } else {
      console.log('✅ Column recipient_name exists!');
      console.log('Sample data:', data);
      return true;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

testRecipientNameColumn();