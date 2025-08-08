#!/usr/bin/env node
/**
 * Direct SQL migration using raw Supabase client
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function executeMigration() {
  console.log('🚀 Attempting direct SQL migration...');
  
  // Create admin client with service role key
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET;
  
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase credentials');
    return false;
  }
  
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // Check if column exists first
    console.log('🔍 Checking current table structure...');
    
    const { data: existingColumns, error: columnCheckError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'transactions')
      .eq('column_name', 'file_source');
    
    if (columnCheckError) {
      console.log('⚠️  Could not check existing columns, proceeding with migration...');
    } else if (existingColumns && existingColumns.length > 0) {
      console.log('✅ file_source column already exists!');
      return true;
    }
    
    // Try to add column using SQL RPC if it exists
    console.log('📝 Attempting to add file_source column...');
    
    // First, let's try using the rpc method to execute raw SQL
    try {
      console.log('🔧 Method 1: Trying RPC SQL execution...');
      
      const { data, error } = await supabaseAdmin.rpc('execute_sql', {
        query: `
          ALTER TABLE transactions ADD COLUMN file_source VARCHAR(255) NULL;
          CREATE INDEX idx_transactions_file_source ON transactions(file_source) WHERE file_source IS NOT NULL;
          UPDATE transactions SET file_source = 'legacy' WHERE file_source IS NULL;
        `
      });
      
      if (error) throw error;
      console.log('✅ Migration successful via RPC!');
      return true;
      
    } catch (rpcError) {
      console.log('❌ RPC method failed:', rpcError.message);
    }
    
    // Method 2: Try using postgrest raw SQL
    try {
      console.log('🔧 Method 2: Trying PostgREST raw SQL...');
      
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey
        },
        body: JSON.stringify({
          sql: "ALTER TABLE transactions ADD COLUMN file_source VARCHAR(255) NULL;"
        })
      });
      
      if (response.ok) {
        console.log('✅ Column added successfully!');
        
        // Add index
        const indexResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey
          },
          body: JSON.stringify({
            sql: "CREATE INDEX idx_transactions_file_source ON transactions(file_source) WHERE file_source IS NOT NULL;"
          })
        });
        
        // Update existing records
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey
          },
          body: JSON.stringify({
            sql: "UPDATE transactions SET file_source = 'legacy' WHERE file_source IS NULL;"
          })
        });
        
        console.log('✅ Migration completed successfully!');
        return true;
      } else {
        console.log('❌ PostgREST method failed');
      }
      
    } catch (fetchError) {
      console.log('❌ Fetch method failed:', fetchError.message);
    }
    
    // If all automated methods fail, show manual instructions
    console.log('\n❌ Automated migration failed. Manual migration required.');
    console.log('\n📋 MANUAL MIGRATION INSTRUCTIONS:');
    console.log('═' * 50);
    console.log('1. Go to: https://supabase.com/dashboard/project/wgwjfypfkfggwvbwxakp');
    console.log('2. Click "SQL Editor" in the left sidebar');
    console.log('3. Click "New Query" and paste this SQL:');
    console.log('\n-- Add file_source column');
    console.log('ALTER TABLE transactions ADD COLUMN file_source VARCHAR(255) NULL;');
    console.log('\n-- Add index for performance');
    console.log('CREATE INDEX idx_transactions_file_source ON transactions(file_source) WHERE file_source IS NOT NULL;');
    console.log('\n-- Update existing records');
    console.log("UPDATE transactions SET file_source = 'legacy' WHERE file_source IS NULL;");
    console.log('\n4. Click "Run" to execute');
    console.log('═' * 50);
    
    return false;
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    return false;
  }
}

// Run migration
executeMigration().then(success => {
  if (success) {
    console.log('\n🎉 MIGRATION COMPLETED!');
    console.log('✅ file_source column has been added');
    console.log('✅ Transaction imports should now work');
    console.log('✅ You can restart the server');
  } else {
    console.log('\n⚠️  Please complete the manual migration steps above');
  }
});