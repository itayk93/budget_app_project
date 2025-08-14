#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SECRET environment variables');
    process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function enableRLS() {
    try {
        console.log('🚀 Starting RLS enablement process...');
        
        // Read the SQL file
        const sqlPath = path.join(__dirname, '..', 'sql', 'enable_rls_for_missing_tables.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        
        // Split the SQL into individual statements
        const statements = sqlContent.split(/;\s*$/gm)
            .map(stmt => stmt.trim())
            .filter(stmt => stmt && !stmt.startsWith('--') && !stmt.startsWith('/*'));
        
        console.log(`📝 Found ${statements.length} SQL statements to execute`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.length > 0) {
                console.log(`\n⚙️  Executing statement ${i + 1}/${statements.length}...`);
                
                try {
                    const { data, error } = await supabase.rpc('exec_sql', {
                        sql_query: statement + ';'
                    });
                    
                    if (error) {
                        console.error(`❌ Error in statement ${i + 1}:`, error.message);
                        console.error('Statement:', statement.substring(0, 100) + '...');
                    } else {
                        console.log(`✅ Statement ${i + 1} executed successfully`);
                    }
                } catch (err) {
                    console.error(`❌ Exception in statement ${i + 1}:`, err.message);
                }
            }
        }
        
        console.log('\n🎉 RLS enablement process completed!');
        console.log('\n📊 Checking final RLS status...');
        
        // Check which tables still don't have RLS
        const { data: tables, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_type', 'BASE TABLE');
            
        if (error) {
            console.error('❌ Error checking table status:', error);
            return;
        }
        
        console.log(`\n📋 Found ${tables.length} tables in public schema`);
        
        // Check RLS status for each table
        for (const table of tables) {
            try {
                const { data: rlsStatus, error: rlsError } = await supabase.rpc('check_rls_status', {
                    table_name: table.table_name
                });
                
                if (rlsError) {
                    console.log(`⚠️  ${table.table_name}: Unable to check RLS status`);
                } else {
                    const status = rlsStatus ? '🔒 Restricted' : '🔓 Unrestricted';
                    console.log(`   ${table.table_name}: ${status}`);
                }
            } catch (err) {
                console.log(`⚠️  ${table.table_name}: Unable to check RLS status`);
            }
        }
        
    } catch (error) {
        console.error('❌ Failed to enable RLS:', error.message);
        process.exit(1);
    }
}

// Run the script
enableRLS().then(() => {
    console.log('\n🏁 Script execution completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});