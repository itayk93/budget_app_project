const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// Add recipient_name column to transactions table
router.post('/add-recipient-name-column', async (req, res) => {
  try {
    console.log('🔄 Starting migration: Adding recipient_name column...');
    
    // First check if column already exists
    const { data: testData, error: testError } = await supabase
      .from('transactions')
      .select('id, business_name, recipient_name')
      .limit(1);
    
    if (testError) {
      if (testError.message.includes('column "recipient_name" does not exist')) {
        console.log('❌ Column does not exist. Need to add it.');
        
        // Use Supabase SQL function to add the column
        const { data: sqlResult, error: sqlError } = await supabase
          .rpc('exec', {
            sql: `
              ALTER TABLE transactions 
              ADD COLUMN recipient_name TEXT DEFAULT NULL;
              
              CREATE INDEX IF NOT EXISTS idx_transactions_recipient_name 
              ON transactions(recipient_name) 
              WHERE recipient_name IS NOT NULL;
            `
          });
        
        if (sqlError) {
          console.error('❌ Error executing SQL:', sqlError);
          return res.status(500).json({ 
            error: 'Failed to add column',
            details: sqlError,
            sqlRequired: `
ALTER TABLE transactions 
ADD COLUMN recipient_name TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_recipient_name 
ON transactions(recipient_name) 
WHERE recipient_name IS NOT NULL;
            `
          });
        }
        
        console.log('✅ Successfully added recipient_name column');
        return res.json({ 
          success: true, 
          message: 'recipient_name column added successfully',
          result: sqlResult
        });
        
      } else {
        console.error('❌ Unexpected error:', testError);
        return res.status(500).json({ error: 'Unexpected database error', details: testError });
      }
    } else {
      console.log('✅ Column recipient_name already exists');
      return res.json({ 
        success: true, 
        message: 'recipient_name column already exists',
        sampleData: testData
      });
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({ 
      error: 'Migration failed', 
      details: error.message,
      sqlRequired: `
Please run this SQL manually in your Supabase SQL editor:

ALTER TABLE transactions 
ADD COLUMN recipient_name TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_recipient_name 
ON transactions(recipient_name) 
WHERE recipient_name IS NOT NULL;
      `
    });
  }
});

module.exports = router;