const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { supabase } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    dest: path.join(__dirname, '../temp/'),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Compare BudgetLens CSV with existing transactions
router.post('/compare', upload.single('budgetlensFile'), authenticateToken, async (req, res) => {
    try {
        console.log('🔍 BudgetLens comparison request received');
        console.log('📁 File info:', req.file ? {
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        } : 'No file');
        console.log('📅 Body:', req.body);
        
        const { startDate, endDate } = req.body;
        const userId = req.user.id;
        
        if (!req.file) {
            console.log('❌ No file uploaded');
            return res.status(400).json({ error: 'No CSV file uploaded' });
        }
        
        if (!startDate || !endDate) {
            console.log('❌ Missing dates');
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        // Parse CSV file
        const csvData = [];
        const filePath = req.file.path;
        
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    csvData.push(row);
                })
                .on('end', resolve)
                .on('error', reject);
        });

        // Clean up the uploaded file
        fs.unlinkSync(filePath);

        // Get existing transactions from database
        const { data: existingTransactions, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .gte('payment_date', startDate)
            .lte('payment_date', endDate);

        if (error) {
            console.error('Error fetching transactions:', error);
            return res.status(500).json({ error: 'Failed to fetch transactions' });
        }

        // Compare and find missing transactions
        const missingTransactions = findMissingTransactions(csvData, existingTransactions);
        const duplicateTransactions = findDuplicateTransactions(csvData, existingTransactions);

        console.log('✅ Comparison completed:', {
            csvCount: csvData.length,
            dbCount: existingTransactions.length,
            missing: missingTransactions.length,
            duplicates: duplicateTransactions.length
        });

        res.json({
            csvTransactionsCount: csvData.length,
            existingTransactionsCount: existingTransactions.length,
            missingTransactions,
            duplicateTransactions,
            dateRange: { startDate, endDate }
        });

    } catch (error) {
        console.error('Error comparing BudgetLens data:', error);
        res.status(500).json({ error: 'Failed to compare data' });
    }
});

// Helper function to find missing transactions
function findMissingTransactions(csvData, existingTransactions) {
    const missing = [];
    
    csvData.forEach(csvRow => {
        // Parse CSV row data
        const csvDate = parseDate(csvRow['תאריך התשלום']);
        const csvAmount = parseFloat(csvRow['סכום']) || 0;
        const csvBusinessName = csvRow['שם העסק'] || '';
        
        if (!csvDate || csvAmount === 0) return;
        
        // Look for matching transaction in database
        const match = existingTransactions.find(dbTx => {
            const dbDate = new Date(dbTx.payment_date);
            const dbAmount = parseFloat(dbTx.amount) || 0;
            const dbBusinessName = dbTx.business_name || '';
            
            // Check if dates match (same day)
            const dateMatch = isSameDate(csvDate, dbDate);
            
            // Check if amounts match (within small tolerance)
            const amountMatch = Math.abs(csvAmount - dbAmount) < 0.01;
            
            // Check if business names are similar
            const nameMatch = businessNamesSimilar(csvBusinessName, dbBusinessName);
            
            return dateMatch && amountMatch && nameMatch;
        });
        
        if (!match) {
            missing.push({
                date: csvDate.toISOString().split('T')[0],
                businessName: csvBusinessName,
                amount: csvAmount,
                currency: csvRow['מטבע חיוב'] || 'ILS',
                paymentMethod: csvRow['אמצעי התשלום'] || '',
                category: csvRow['קטגוריה בתזרים'] || '',
                notes: csvRow['הערות'] || ''
            });
        }
    });
    
    return missing;
}

// Helper function to find potential duplicates
function findDuplicateTransactions(csvData, existingTransactions) {
    const duplicates = [];
    
    csvData.forEach(csvRow => {
        const csvDate = parseDate(csvRow['תאריך התשלום']);
        const csvAmount = parseFloat(csvRow['סכום']) || 0;
        const csvBusinessName = csvRow['שם העסק'] || '';
        
        if (!csvDate || csvAmount === 0) return;
        
        // Find all potential matches (not just first one)
        const matches = existingTransactions.filter(dbTx => {
            const dbDate = new Date(dbTx.payment_date);
            const dbAmount = parseFloat(dbTx.amount) || 0;
            const dbBusinessName = dbTx.business_name || '';
            
            const dateMatch = isSameDate(csvDate, dbDate);
            const amountMatch = Math.abs(csvAmount - dbAmount) < 0.01;
            const nameMatch = businessNamesSimilar(csvBusinessName, dbBusinessName);
            
            return dateMatch && amountMatch && nameMatch;
        });
        
        if (matches.length > 1) {
            duplicates.push({
                csvTransaction: {
                    date: csvDate.toISOString().split('T')[0],
                    businessName: csvBusinessName,
                    amount: csvAmount
                },
                dbMatches: matches.map(tx => ({
                    id: tx.id,
                    date: tx.payment_date,
                    businessName: tx.business_name,
                    amount: tx.amount
                }))
            });
        }
    });
    
    return duplicates;
}

// Helper function to parse date from CSV
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Handle different date formats
    // DD/MM/YYYY or DD/MM/YY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // JavaScript months are 0-based
        let year = parseInt(parts[2]);
        
        // Handle 2-digit years
        if (year < 100) {
            year += year < 50 ? 2000 : 1900;
        }
        
        return new Date(year, month, day);
    }
    
    return null;
}

// Helper function to check if two dates are the same day
function isSameDate(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

// Helper function to check if business names are similar
function businessNamesSimilar(name1, name2) {
    if (!name1 || !name2) return false;
    
    // Clean and normalize names
    const clean1 = name1.toLowerCase().replace(/[^\u0590-\u05FF\w\s]/g, '').trim();
    const clean2 = name2.toLowerCase().replace(/[^\u0590-\u05FF\w\s]/g, '').trim();
    
    // Exact match
    if (clean1 === clean2) return true;
    
    // Check if one contains the other
    if (clean1.includes(clean2) || clean2.includes(clean1)) return true;
    
    // Check for common words (at least 3 characters)
    const words1 = clean1.split(/\s+/).filter(w => w.length >= 3);
    const words2 = clean2.split(/\s+/).filter(w => w.length >= 3);
    
    if (words1.length === 0 || words2.length === 0) return false;
    
    // Check if at least half of the words match
    const commonWords = words1.filter(w1 => words2.some(w2 => w1.includes(w2) || w2.includes(w1)));
    const similarity = commonWords.length / Math.min(words1.length, words2.length);
    
    return similarity >= 0.5;
}

module.exports = router;