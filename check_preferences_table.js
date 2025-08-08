#!/usr/bin/env node
const { supabase } = require('./server/config/supabase');

async function checkPreferencesTable() {
  try {
    console.log('🔍 Checking if user_preferences table exists...');
    
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ user_preferences table does not exist or has issues:', error.message);
      console.log('\n💡 Creating user_preferences table...');
      
      // Try to create the table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS user_preferences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          preference_key VARCHAR(255) NOT NULL,
          preference_value TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(user_id, preference_key)
        );
        
        CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
        ON user_preferences(user_id);
      `;
      
      console.log('📋 Please execute this SQL in Supabase dashboard:');
      console.log('=' * 50);
      console.log(createTableSQL);
      console.log('=' * 50);
      
      return false;
    } else {
      console.log('✅ user_preferences table exists and is accessible');
      return true;
    }
  } catch (err) {
    console.error('❌ Error checking table:', err);
    return false;
  }
}

checkPreferencesTable();