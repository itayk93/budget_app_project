#!/usr/bin/env node
/**
 * Add file_source column to transactions table using Node.js
 */

const { supabase } = require('../server/config/supabase');

async function addFileSourceColumn() {
  try {
    console.log('🚀 Starting file_source column migration...');
    
    // Check if column already exists by trying to select it
    console.log('🔍 Checking if file_source column exists...');
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('file_source')
        .limit(1);
      
      if (!error) {
        console.log('✅ file_source column already exists!');
        console.log('Migration not needed.');
        return true;
      }
      
      if (error.message && error.message.includes('column "file_source" does not exist')) {
        console.log('❌ file_source column does not exist, proceeding with migration...');
      } else {
        throw error;
      }
    } catch (checkError) {
      if (checkError.message && checkError.message.includes('column "file_source" does not exist')) {
        console.log('❌ file_source column does not exist, proceeding with migration...');
      } else {
        throw checkError;
      }
    }
    
    // Since we can't run DDL directly, let's create a manual approach
    console.log('\n⚠️  MANUAL MIGRATION REQUIRED');
    console.log('Supabase requires manual DDL execution in the dashboard.');
    console.log('\n📋 Please execute the following SQL in Supabase SQL Editor:');
    console.log('=' * 60);
    console.log(`-- Add file_source column to transactions table
ALTER TABLE transactions 
ADD COLUMN file_source VARCHAR(255) NULL;

-- Create index for performance
CREATE INDEX idx_transactions_file_source ON transactions(file_source) 
WHERE file_source IS NOT NULL;

-- Set default value for existing transactions
UPDATE transactions 
SET file_source = 'legacy' 
WHERE file_source IS NULL;`);
    console.log('=' * 60);
    console.log('\n🔗 Go to: https://supabase.com/dashboard > Your Project > SQL Editor');
    console.log('\n✋ After running the SQL, press Enter to verify the migration...');
    
    // Wait for user input
    await new Promise((resolve) => {
      process.stdin.once('data', () => resolve());
    });
    
    // Verify migration
    console.log('🔍 Verifying migration...');
    
    const { data, error } = await supabase
      .from('transactions')
      .select('file_source')
      .limit(1);
    
    if (error) {
      if (error.message && error.message.includes('column "file_source" does not exist')) {
        console.log('❌ Migration not completed. Please run the SQL manually.');
        return false;
      }
      throw error;
    }
    
    console.log('✅ Migration verified successfully!');
    console.log('✅ file_source column is now available');
    
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}

// Run the migration
addFileSourceColumn()
  .then((success) => {
    if (success) {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    } else {
      console.log('⚠️  Migration needs manual completion');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });