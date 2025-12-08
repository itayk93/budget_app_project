#!/usr/bin/env node

// Temporary script to clear empty categories from database
// Run this once to clean up existing data

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

console.log('Environment check:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Found' : 'Missing');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearEmptyCategories() {
  try {
    console.log('🔄 Clearing all empty categories from database...');
    
    // Clear all records from user_empty_categories_display table
    const { data, error } = await supabase
      .from('user_empty_categories_display')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (error) {
      console.error('❌ Error clearing empty categories:', error);
      process.exit(1);
    }
    
    console.log('✅ Successfully cleared all empty categories from database');
    console.log('📊 Records removed:', data?.length || 0);
    console.log('');
    console.log('Now refresh your dashboard - no empty categories should appear!');
    
  } catch (error) {
    console.error('❌ Script error:', error);
    process.exit(1);
  }
}

// Run the script
clearEmptyCategories();