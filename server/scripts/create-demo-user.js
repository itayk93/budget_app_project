#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Initialize Supabase client
console.log('Loading env variables...');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_KEY exists:', !!process.env.SUPABASE_SERVICE_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const DEMO_USER_EMAIL = 'demo@budgetlens.com';
const DEMO_USER_PASSWORD = 'demo123';
const DEMO_USER_NAME = 'משתמש דמו';

async function createDemoUser() {
  try {
    console.log('🎭 Creating demo user...');
    
    // Check if demo user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', DEMO_USER_EMAIL)
      .single();

    let demoUserId;
    
    if (existingUser) {
      console.log('📌 Demo user already exists, using existing user');
      demoUserId = existingUser.id;
      
      // Clean up existing demo data
      console.log('🧹 Cleaning up existing demo data...');
      await supabase.from('transactions').delete().eq('user_id', demoUserId);
      await supabase.from('categories').delete().eq('user_id', demoUserId);
      await supabase.from('cash_flows').delete().eq('user_id', demoUserId);
    } else {
      // Create new demo user (plain text password for demo)
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([{
          email: DEMO_USER_EMAIL,
          password: DEMO_USER_PASSWORD, // Plain text for demo simplicity
          name: DEMO_USER_NAME,
          is_demo_user: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (userError) {
        throw new Error(`Failed to create user: ${userError.message}`);
      }
      
      demoUserId = newUser.id;
      console.log(`✅ Created demo user with ID: ${demoUserId}`);
    }

    // Create demo cash flows (accounts)
    console.log('💳 Creating demo cash flows...');
    const cashFlows = [
      {
        id: 'demo-cf-001',
        user_id: demoUserId,
        name: 'עו"ש בנק לאומי',
        currency: 'ILS',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-cf-002', 
        user_id: demoUserId,
        name: 'אשראי הפועלים',
        currency: 'ILS',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-cf-003',
        user_id: demoUserId,
        name: 'חסכון מקדש',
        currency: 'ILS',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const { error: cashFlowError } = await supabase
      .from('cash_flows')
      .insert(cashFlows);

    if (cashFlowError) {
      throw new Error(`Failed to create cash flows: ${cashFlowError.message}`);
    }

    // Create demo categories
    console.log('📂 Creating demo categories...');
    const categories = [
      {
        id: 'demo-cat-001',
        user_id: demoUserId,
        name: 'מזון וקניות',
        category_type: 'variable_expense',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-cat-002',
        user_id: demoUserId,
        name: 'תחבורה',
        category_type: 'variable_expense',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-cat-003',
        user_id: demoUserId,
        name: 'בילויים',
        category_type: 'variable_expense',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-cat-004',
        user_id: demoUserId,
        name: 'חשבונות',
        category_type: 'fixed_expense',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-cat-005',
        user_id: demoUserId,
        name: 'בריאות',
        category_type: 'variable_expense',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-cat-006',
        user_id: demoUserId,
        name: 'שונות',
        category_type: 'variable_expense',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-cat-007',
        user_id: demoUserId,
        name: 'הכנסות',
        category_type: 'income',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const { error: categoriesError } = await supabase
      .from('categories')
      .insert(categories);

    if (categoriesError) {
      throw new Error(`Failed to create categories: ${categoriesError.message}`);
    }

    // Create demo transactions
    console.log('💰 Creating demo transactions...');
    const transactions = [
      {
        id: 'demo-tx-001',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-002',
        business_name: 'שופרסל - קניות שבועיות',
        amount: -487.50,
        payment_date: '2025-09-06',
        category_name: 'מזון וקניות',
        flow_month: '2025-09',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-002',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-001',
        business_name: 'משכורת',
        amount: 12500,
        payment_date: '2025-09-01',
        category_name: 'הכנסות',
        flow_month: '2025-09',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-003',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-002',
        business_name: 'דלק דור אלון - תדלוק',
        amount: -280,
        payment_date: '2025-09-05',
        category_name: 'תחבורה',
        flow_month: '2025-09',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-004',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-002',
        business_name: 'נטפליקס - מנוי חודשי',
        amount: -49.90,
        payment_date: '2025-09-04',
        category_name: 'בילויים',
        flow_month: '2025-09',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-005',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-001',
        business_name: 'חברת החשמל',
        amount: -520,
        payment_date: '2025-09-03',
        category_name: 'חשבונות',
        flow_month: '2025-09',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-006',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-001',
        business_name: 'ביט - הוראת קבע ביטוח',
        amount: -450,
        payment_date: '2025-09-02',
        category_name: 'בריאות',
        flow_month: '2025-09',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-007',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-002',
        business_name: 'קפה נוח - ארוחת בוקר',
        amount: -32,
        payment_date: '2025-09-06',
        category_name: 'מזון וקניות',
        flow_month: '2025-09',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-008',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-002',
        business_name: 'וולט - משלוח אוכל',
        amount: -89,
        payment_date: '2025-09-05',
        category_name: 'מזון וקניות',
        flow_month: '2025-09',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-009',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-002',
        business_name: 'רכבת ישראל',
        amount: -28.50,
        payment_date: '2025-09-04',
        category_name: 'תחבורה',
        flow_month: '2025-09',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-010',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-002',
        business_name: 'מכבי פארם - תרופות',
        amount: -125,
        payment_date: '2025-09-03',
        category_name: 'בריאות',
        flow_month: '2025-09',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      // Add more transactions for previous months
      {
        id: 'demo-tx-011',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-001',
        business_name: 'משכורת',
        amount: 12500,
        payment_date: '2025-08-01',
        category_name: 'הכנסות',
        flow_month: '2025-08',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-012',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-002',
        business_name: 'שופרסל - קניות חודש קודם',
        amount: -2200,
        payment_date: '2025-08-15',
        category_name: 'מזון וקניות',
        flow_month: '2025-08',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-013',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-002',
        business_name: 'דלק חודש קודם',
        amount: -890,
        payment_date: '2025-08-10',
        category_name: 'תחבורה',
        flow_month: '2025-08',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-014',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-002',
        business_name: 'בילויים חודש קודם',
        amount: -1200,
        payment_date: '2025-08-20',
        category_name: 'בילויים',
        flow_month: '2025-08',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'demo-tx-015',
        user_id: demoUserId,
        cash_flow_id: 'demo-cf-001',
        business_name: 'חשבונות חודש קודם',
        amount: -2100,
        payment_date: '2025-08-05',
        category_name: 'חשבונות',
        flow_month: '2025-08',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const { error: transactionsError } = await supabase
      .from('transactions')
      .insert(transactions);

    if (transactionsError) {
      throw new Error(`Failed to create transactions: ${transactionsError.message}`);
    }

    console.log('🎉 Demo user created successfully!');
    console.log(`📧 Email: ${DEMO_USER_EMAIL}`);
    console.log(`🔑 Password: ${DEMO_USER_PASSWORD}`);
    console.log(`👤 User ID: ${demoUserId}`);
    
    return demoUserId;

  } catch (error) {
    console.error('❌ Error creating demo user:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createDemoUser()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createDemoUser };