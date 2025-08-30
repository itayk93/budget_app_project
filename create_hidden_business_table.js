const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wgwjfypfkfggwvbwxakp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnd2pmeXBma2ZnZ3d2Ynd4YWtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA4NDE0MiwiZXhwIjoyMDYwNjYwMTQyfQ.3Bspx7XY_x94v7pcbzJNFUNegS1dTxl1r1KN2NcmcAY';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createHiddenBusinessTable() {
  try {
    console.log('🚀 Starting hidden business names table creation...');
    
    // Try to insert a test record to see if table exists
    const testResult = await supabase
      .from('hidden_business_names')
      .select('id')
      .limit(1);
    
    if (!testResult.error || testResult.error.code !== 'PGRST116') {
      console.log('✅ Table already exists and is accessible');
      return;
    }
    
    console.log('📋 Table does not exist, instructions for manual creation:');
    console.log('\n🔧 Please run this SQL manually in Supabase SQL Editor:');
    console.log('\n' + '='.repeat(70));
    console.log(`
-- Create table for hidden business names
CREATE TABLE hidden_business_names (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    business_name TEXT NOT NULL,
    reason TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_hidden_business_names_user_id ON hidden_business_names(user_id);
CREATE INDEX idx_hidden_business_names_business_name ON hidden_business_names(business_name);

-- Enable RLS
ALTER TABLE hidden_business_names ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only see their own hidden business names" 
ON hidden_business_names FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own hidden business names" 
ON hidden_business_names FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own hidden business names" 
ON hidden_business_names FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own hidden business names" 
ON hidden_business_names FOR DELETE 
USING (auth.uid() = user_id);

-- Insert example data for testing
INSERT INTO hidden_business_names (user_id, business_name, reason)
VALUES (
    (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1), 
    'מקס איט פיננסים', 
    'חיוב חודשי חברת אשראי - כפילות לעסקאות קיימות'
);
`);
    console.log('='.repeat(70));
    console.log('\n✅ Copy the SQL above and run it in Supabase Dashboard > SQL Editor');
    console.log('🔗 Go to: https://wgwjfypfkfggwvbwxakp.supabase.co/project/wgwjfypfkfggwvbwxakp/sql');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createHiddenBusinessTable();