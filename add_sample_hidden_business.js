const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wgwjfypfkfggwvbwxakp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnd2pmeXBma2ZnZ3d2Ynd4YWtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA4NDE0MiwiZXhwIjoyMDYwNjYwMTQyfQ.3Bspx7XY_x94v7pcbzJNFUNegS1dTxl1r1KN2NcmcAY';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addSampleHiddenBusiness() {
  try {
    console.log('🔍 Adding sample hidden business name...');
    
    // Get the first user (assuming you have at least one user)
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (userError) {
      console.error('Error fetching users:', userError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.error('No users found in database');
      return;
    }
    
    const userId = users[0].id;
    console.log('👤 Using user ID:', userId);
    
    // Check if already exists
    const { data: existing, error: existingError } = await supabase
      .from('hidden_business_names')
      .select('id')
      .eq('user_id', userId)
      .eq('business_name', 'מקס איט פיננסים')
      .limit(1);
    
    if (existing && existing.length > 0) {
      console.log('✅ Hidden business "מקס איט פיננסים" already exists for this user');
      return;
    }
    
    // Insert sample data using RPC or direct SQL
    const insertQuery = `
      INSERT INTO hidden_business_names (user_id, business_name, reason, is_active)
      VALUES ('${userId}', 'מקס איט פיננסים', 'חיוב חודשי חברת אשראי - כפילות לעסקאות קיימות', true)
      RETURNING *;
    `;
    
    console.log('🔧 Executing SQL:', insertQuery);
    
    const { data, error } = await supabase.rpc('exec_sql', { 
      query: insertQuery 
    }).catch(() => {
      // Fallback to direct insert
      return supabase
        .from('hidden_business_names')
        .insert({
          user_id: userId,
          business_name: 'מקס איט פיננסים', 
          reason: 'חיוב חודשי חברת אשראי - כפילות לעסקאות קיימות',
          is_active: true
        })
        .select();
    });
    
    if (error) {
      console.error('❌ Error adding hidden business:', error);
      return;
    }
    
    console.log('✅ Successfully added hidden business name:');
    console.log('   Business: מקס איט פיננסים');
    console.log('   Reason: חיוב חודשי חברת אשראי - כפילות לעסקאות קיימות');
    console.log('   User ID:', userId);
    console.log('   Record ID:', data[0].id);
    
    // Verify it was added
    const { data: verification, error: verifyError } = await supabase
      .from('hidden_business_names')
      .select('*')
      .eq('user_id', userId);
    
    if (!verifyError && verification) {
      console.log(`📋 Total hidden businesses for this user: ${verification.length}`);
      verification.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.business_name} (${record.is_active ? 'Active' : 'Inactive'})`);
      });
    }
    
  } catch (error) {
    console.error('💥 Script error:', error.message);
  }
}

console.log('🚀 Starting sample hidden business setup...');
addSampleHiddenBusiness();