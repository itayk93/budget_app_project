#!/usr/bin/env node
/**
 * Interactive migration guide for file_source column
 */

const { supabase } = require('../server/config/supabase');

async function checkColumnExists() {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('file_source')
      .limit(1);
    
    if (error && error.message && error.message.includes('column "file_source" does not exist')) {
      return false;
    }
    
    return !error;
  } catch (e) {
    return false;
  }
}

async function runMigrationGuide() {
  console.log('🎯 BUDGET APP - CRITICAL DATABASE MIGRATION GUIDE');
  console.log('=' * 55);
  
  const columnExists = await checkColumnExists();
  
  if (columnExists) {
    console.log('✅ Migration already completed! file_source column exists.');
    console.log('✅ System is ready to use.');
    return true;
  }
  
  console.log('❌ CRITICAL: file_source column is missing from transactions table');
  console.log('🚨 Transaction imports will fail without this column');
  console.log('');
  
  console.log('📋 STEP 1: Open Supabase Dashboard');
  console.log('🔗 URL: https://supabase.com/dashboard/project/wgwjfypfkfggwvbwxakp');
  console.log('');
  
  console.log('📋 STEP 2: Navigate to SQL Editor');
  console.log('   - Click "SQL Editor" in the left sidebar');
  console.log('   - Click "New Query"');
  console.log('');
  
  console.log('📋 STEP 3: Copy and execute this exact SQL:');
  console.log('━' * 55);
  console.log(`-- Add file_source column for transaction tracking
ALTER TABLE transactions 
ADD COLUMN file_source VARCHAR(255) NULL;

-- Add index for performance  
CREATE INDEX idx_transactions_file_source 
ON transactions(file_source) 
WHERE file_source IS NOT NULL;

-- Set default value for existing transactions
UPDATE transactions 
SET file_source = 'legacy' 
WHERE file_source IS NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
AND column_name = 'file_source';`);
  console.log('━' * 55);
  console.log('');
  
  console.log('📋 STEP 4: Verify Migration');
  console.log('   - You should see output showing the new column');
  console.log('   - file_source | character varying | YES');
  console.log('');
  
  console.log('⏳ After completing the SQL execution, run this command again to verify:');
  console.log('   node database_migrations/migration_guide.js');
  console.log('');
  
  console.log('🚨 IMPORTANT: Do not restart the server until migration is complete!');
  
  return false;
}

// Run the guide
runMigrationGuide()
  .then((migrationComplete) => {
    if (migrationComplete) {
      console.log('');
      console.log('🎉 MIGRATION VERIFIED SUCCESSFULLY!');
      console.log('✅ Transaction imports should now work correctly');
      console.log('✅ You can now restart your server safely');
      console.log('');
      console.log('🚀 To restart server: npm start');
    } else {
      console.log('');
      console.log('⚠️  Migration incomplete - please follow the steps above');
    }
  })
  .catch((error) => {
    console.error('💥 Error:', error);
    process.exit(1);
  });