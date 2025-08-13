const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SECRET;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

// Admin client - uses service key for operations that need to bypass RLS
// Use for: stock prices, user creation, migrations, admin operations
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// User client - uses anon key, requires user JWT for RLS-protected operations  
// Use for: user-scoped data (transactions, budgets, categories, etc.)
const userClient = createClient(supabaseUrl, supabaseAnonKey);

// Create user-scoped client with specific JWT
const createUserClient = (userToken) => {
  const client = createClient(supabaseUrl, supabaseAnonKey);
  client.auth.setSession({
    access_token: userToken,
    refresh_token: null
  });
  return client;
};

module.exports = {
  // Legacy support - defaults to admin client for backward compatibility
  getSupabase: () => adminClient,
  supabase: adminClient,
  
  // New RLS-aware clients
  adminClient,
  userClient,
  createUserClient
};