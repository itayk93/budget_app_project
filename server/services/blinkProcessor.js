/**
 * Blink File Processor Service
 * Processes Blink Excel files for stock investment transactions
 * Port of the Python blink_processor.py to Node.js
 */

const XLSX = require('xlsx');
const crypto = require('crypto');
const path = require('path');
const { getSupabase } = require('../config/supabase');

class BlinkProcessor {
    constructor() {
        this.requiredHeaders = ["תאריך", "סוג פעולה", "שם הנייר", "סכום הפעולה"];
        this.expectedHeaders = [
            "תאריך", "סוג פעולה", "שם הנייר", "כמות",
            "מחיר קנייה ממוצע", "סכום הפעולה", "עמלה", "יתרת מזומן"
        ];
        
        // Translation mapping for transaction types
        this.transactionTypeMapping = {
            "קנייה": "Buy",
            "מכירה": "Sell", 
            "הפקדה": "Deposit",
            "דיבידנד": "Dividend"
        };
    }

    /**
     * Process Blink Excel file and convert to transaction format
     * @param {string} filePath - Path to the Blink Excel file
     * @param {string} userId - User ID for the transactions
     * @param {string} cashFlowId - Cash flow ID for the transactions
     * @returns {Object} - Processing result with transactions
     */
    async processBlinkFile(filePath, userId = null, cashFlowId = null, progressCallback = null, uploadId = null, dateFilterOptions = {}) {
        try {
            console.log(`[BLINK_PROCESSOR] Starting to process file: ${filePath}`);
            
            // Read the Excel file
            const workbook = XLSX.readFile(filePath);
            let sheetName = 'תנועות';
            
            // If the expected sheet doesn't exist, use the first sheet
            if (!workbook.SheetNames.includes(sheetName)) {
                sheetName = workbook.SheetNames[0];
                console.log(`[BLINK_PROCESSOR] Sheet 'תנועות' not found, using '${sheetName}'`);
            }
            
            const worksheet = workbook.Sheets[sheetName];
            
            // Find the header row
            const headerInfo = this.findHeaderRow(worksheet);
            if (!headerInfo) {
                throw new Error('מבנה הקובץ אינו מזוהה. אנא ודא שהקובץ מכיל את העמודות הנדרשות.');
            }
            
            console.log(`[BLINK_PROCESSOR] Found header at row ${headerInfo.row}, starting column ${headerInfo.startCol}`);
            
            // Create range for data extraction starting from the correct position
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            const dataStartRow = headerInfo.row + 1;
            const dataStartCol = headerInfo.startCol;
            const dataEndCol = Math.min(range.e.c, headerInfo.startCol + this.expectedHeaders.length - 1);
            
            // Convert worksheet to JSON using the correct header row
            const rawData = XLSX.utils.sheet_to_json(worksheet, {
                range: headerInfo.row, // Start from header row
                raw: false,
                dateNF: 'yyyy-mm-dd'
            });
            
            // Remove the header row from data (it becomes the first row)
            if (rawData.length > 0) {
                rawData.shift(); // Remove first row which contains the headers
            }
            
            console.log(`[BLINK_PROCESSOR] Extracted ${rawData.length} raw rows`);
            
            // Process each row
            const transactions = [];
            console.log(`[BLINK_PROCESSOR] Starting to process ${rawData.length} rows...`);
            for (let i = 0; i < rawData.length; i++) {
                const row = rawData[i];
                if (row && Object.keys(row).length > 0) {
                    const rowTransactions = this.convertRowToTransaction(row, userId, cashFlowId);
                    if (rowTransactions && rowTransactions.length > 0) {
                        transactions.push(...rowTransactions);
                        console.log(`[BLINK_PROCESSOR] Added ${rowTransactions.length} transactions from row ${i+1}`);
                    } else {
                        console.log(`[BLINK_PROCESSOR] Row ${i+1} produced no valid transactions:`, JSON.stringify(row));
                    }
                } else {
                    console.log(`[BLINK_PROCESSOR] Row ${i+1} is empty or invalid:`, row);
                }
            }
            
            console.log(`[BLINK_PROCESSOR] Processed ${transactions.length} valid transactions`);
            
            // Apply date filtering if enabled
            let filteredTransactions = transactions;
            if (dateFilterOptions.dateFilterEnabled && dateFilterOptions.startDate) {
                if (progressCallback) {
                    progressCallback('filtering', { progress: 90, status: 'מסנן לפי תאריך...' });
                }
                
                const startDate = new Date(dateFilterOptions.startDate);
                const endDate = dateFilterOptions.endDate ? new Date(dateFilterOptions.endDate) : null;
                
                console.log('[BLINK_PROCESSOR] Applying date filter:', {
                    startDate: startDate.toISOString(),
                    endDate: endDate ? endDate.toISOString() : 'no end date',
                    originalCount: transactions.length
                });
                
                filteredTransactions = transactions.filter(transaction => {
                    if (!transaction.date) return false;
                    
                    const transactionDate = new Date(transaction.date);
                    
                    // Check if transaction date is >= start date
                    if (transactionDate < startDate) {
                        return false;
                    }
                    
                    // Check if transaction date is <= end date (if provided)
                    if (endDate && transactionDate > endDate) {
                        return false;
                    }
                    
                    return true;
                });
                
                console.log('[BLINK_PROCESSOR] Date filter applied:', {
                    originalCount: transactions.length,
                    filteredCount: filteredTransactions.length,
                    removedCount: transactions.length - filteredTransactions.length
                });
            }
            
            return {
                success: true,
                transactions: filteredTransactions,
                processed_count: filteredTransactions.length,
                duplicates: [], // Will be filled by caller if needed
                currency_groups: this.groupByCurrency(filteredTransactions),
                raw_data: rawData
            };
            
        } catch (error) {
            console.error(`[BLINK_PROCESSOR] Error processing Blink file: ${error.message}`);
            return {
                success: false,
                error: error.message,
                transactions: []
            };
        }
    }

    /**
     * Find the row containing the expected headers according to specification
     * Scans first 20 rows and finds first row with at least 3 of the required headers
     * @param {Object} worksheet - XLSX worksheet object
     * @returns {Object} - {row: rowIndex, startCol: colIndex} or null if not found
     */
    findHeaderRow(worksheet) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        
        // Check first 20 rows for headers as per specification
        for (let rowNum = range.s.r; rowNum <= Math.min(range.e.r, range.s.r + 19); rowNum++) {
            const row = [];
            for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
                const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
                const cell = worksheet[cellAddress];
                row.push(cell ? cell.v : null);
            }
            
            // Look for headers starting from any column in this row
            for (let startCol = 0; startCol <= row.length - this.requiredHeaders.length; startCol++) {
                let matchCount = 0;
                let actualStartCol = startCol;
                
                // Check for exact sequence of headers starting from this column
                let sequentialMatch = true;
                for (let i = 0; i < this.expectedHeaders.length && (startCol + i) < row.length; i++) {
                    const cellValue = row[startCol + i];
                    const expectedHeader = this.expectedHeaders[i];
                    
                    if (cellValue === expectedHeader) {
                        matchCount++;
                        if (matchCount === 1) {
                            actualStartCol = startCol + i; // First header found here
                        }
                    } else if (i === 0 && cellValue === null) {
                        // Skip null cells at the beginning
                        continue;
                    } else {
                        sequentialMatch = false;
                        break;
                    }
                }
                
                // Alternative: just count how many headers exist in the row from this position
                if (!sequentialMatch) {
                    matchCount = 0;
                    for (const header of this.requiredHeaders) {
                        const subRow = row.slice(startCol);
                        if (subRow.includes(header)) {
                            matchCount++;
                        }
                    }
                    
                    // Find the actual start column of the first header
                    for (let i = startCol; i < row.length; i++) {
                        if (this.requiredHeaders.includes(row[i])) {
                            actualStartCol = i;
                            break;
                        }
                    }
                }
                
                // If at least 3 of the required headers are found, this is our header row
                if (matchCount >= 3) {
                    const logger = require('../utils/logger');
                    logger.debug('BLINK_PROCESSOR', 'Found header row', { row: rowNum, startCol: actualStartCol, matchCount });
                    logger.debug('BLINK_PROCESSOR', 'Headers found', { headers: row.slice(actualStartCol, actualStartCol + this.expectedHeaders.length) });
                    return { row: rowNum, startCol: actualStartCol };
                }
            }
        }
        
        return null;
    }

    /**
     * Check if two arrays are equal
     * @param {Array} arr1 - First array
     * @param {Array} arr2 - Second array
     * @returns {boolean} - True if arrays are equal
     */
    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        
        return true;
    }

    /**
     * Convert a row from Blink file to transaction format according to specification
     * @param {Object} row - Row data from Excel
     * @param {string} userId - User ID
     * @param {string} cashFlowId - Cash flow ID
     * @returns {Array} - Array of transaction objects (can include fee transactions)
     */
    convertRowToTransaction(row, userId, cashFlowId) {
        try {
            // Skip rows without date
            if (!row['תאריך']) {
                return [];
            }
            
            console.log(`[BLINK_PROCESSOR] Processing row: ${JSON.stringify(row)}`);
            
            // Parse date - convert Excel date to standard format
            let dateObj;
            try {
                if (typeof row['תאריך'] === 'string') {
                    if (row['תאריך'].includes('.')) {
                        // Handle DD.MM.YYYY format common in Hebrew Excel files
                        const parts = row['תאריך'].split('.');
                        if (parts.length === 3) {
                            const day = parseInt(parts[0]);
                            const month = parseInt(parts[1]) - 1; // Month is 0-indexed
                            const year = parseInt(parts[2]);
                            dateObj = new Date(year, month, day);
                        }
                    } else if (row['תאריך'].includes('/')) {
                        const parts = row['תאריך'].split('/');
                        if (parts.length === 3) {
                            dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
                        }
                    } else {
                        dateObj = new Date(row['תאריך']);
                    }
                } else {
                    dateObj = new Date(row['תאריך']);
                }
                
                if (isNaN(dateObj.getTime())) {
                    console.warn(`[BLINK_PROCESSOR] Invalid date: ${row['תאריך']}`);
                    return [];
                }
            } catch (error) {
                console.warn(`[BLINK_PROCESSOR] Date parsing error: ${error.message}`);
                return [];
            }
            
            // Parse amount - always USD for Blink investments
            let amountRaw = row['סכום הפעולה'];
            if (typeof amountRaw === 'string') {
                amountRaw = amountRaw.replace(/[,$₪]/g, '').trim();
            }
            
            let amount;
            try {
                amount = parseFloat(amountRaw);
                if (isNaN(amount)) {
                    console.warn(`[BLINK_PROCESSOR] Invalid amount: ${row['סכום הפעולה']}`);
                    return [];
                }
            } catch (error) {
                console.warn(`[BLINK_PROCESSOR] Amount parsing error: ${error.message}`);
                return [];
            }
            
            // Get transaction type and translate
            const hebrewTransactionType = row['סוג פעולה'];
            let transactionType = this.transactionTypeMapping[hebrewTransactionType];
            
            // Handle tax transactions
            if (hebrewTransactionType && (hebrewTransactionType.includes('חיוב מס') || hebrewTransactionType.includes('זיכוי מס'))) {
                transactionType = hebrewTransactionType.includes('חיוב מס') ? 'Tax Charge' : 'Tax Credit';
            }
            
            if (!transactionType) {
                console.warn(`[BLINK_PROCESSOR] Unknown transaction type: ${hebrewTransactionType}`);
                transactionType = hebrewTransactionType || 'Unknown';
            }
            
            // Build base transaction
            const baseDate = dateObj.toISOString().split('T')[0];
            const now = new Date().toISOString();
            const transactions = [];
            
            // Create main transaction based on type
            let businessName, categoryName, notes, finalAmount;
            
            // Helper function to get business name - use stock name if available, otherwise use transaction type
            const getBusinessName = (stockName, transactionType, hebrewTransactionType) => {
                console.log(`[DEBUG] Stock Symbol Debug - stockName: "${stockName}", transactionType: "${transactionType}", hebrewTransactionType: "${hebrewTransactionType}"`);
                console.log(`[DEBUG] Available row keys:`, Object.keys(row));
                
                if (stockName && stockName.trim()) {
                    console.log(`[DEBUG] Using stock name: "${stockName.trim()}"`);
                    return stockName.trim();
                }
                console.log(`[DEBUG] Stock name empty, using fallback: "${hebrewTransactionType || transactionType}"`);
                // If stock name is empty, use Hebrew transaction type
                return hebrewTransactionType || transactionType;
            };

            switch (transactionType) {
                case 'Buy':
                    businessName = getBusinessName(row['שם הנייר'], transactionType, hebrewTransactionType);
                    categoryName = 'קניית מניה';
                    finalAmount = Math.abs(amount) * -1; // Ensure negative for purchases
                    notes = this.buildNotesString(row['כמות'], row['מחיר קנייה ממוצע']);
                    break;
                    
                case 'Sell':
                    businessName = getBusinessName(row['שם הנייר'], transactionType, hebrewTransactionType);
                    categoryName = 'מכירת מניה';
                    finalAmount = Math.abs(amount); // Ensure positive for sales
                    notes = this.buildNotesString(row['כמות'], row['מחיר קנייה ממוצע']);
                    break;
                    
                case 'Deposit':
                    businessName = 'הפקדה לחשבון השקעות';
                    categoryName = 'הפקדה להשקעות';
                    finalAmount = Math.abs(amount) * -1; // Negative as per spec
                    notes = '';
                    break;
                    
                case 'Dividend':
                    businessName = getBusinessName(row['שם הנייר'], transactionType, hebrewTransactionType);
                    categoryName = 'דיבידנדים';
                    finalAmount = Math.abs(amount); // Positive for dividends
                    notes = '';
                    break;
                    
                case 'Tax Charge':
                case 'Tax Credit':
                    businessName = hebrewTransactionType; // Full Hebrew text as per spec
                    categoryName = 'מיסים';
                    finalAmount = amount; // Keep original sign
                    notes = '';
                    break;
                    
                default:
                    businessName = row['שם הנייר'] || hebrewTransactionType || 'Unknown';
                    categoryName = 'השקעות';
                    finalAmount = amount;
                    notes = this.buildNotesString(row['כמות'], row['מחיר קנייה ממוצע']);
            }
            
            // Generate transaction hash
            const hashString = `${userId || 'no_user'}_${businessName}_${baseDate}_${finalAmount}_USD`;
            const transactionHash = crypto.createHash('md5').update(hashString).digest('hex');
            
            const quantity = row['כמות'] ? parseFloat(row['כמות']) : null;
            console.log(`[DEBUG] Extracted quantity: "${row['כמות']}" -> ${quantity}`);
            
            const mainTransaction = {
                flow_month: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`,
                business_name: businessName,
                payment_method: 'Blink',
                payment_identifier: '',
                payment_date: baseDate,
                payment_month: dateObj.getMonth() + 1,
                payment_year: dateObj.getFullYear(),
                charge_date: baseDate,
                amount: finalAmount.toFixed(2),
                original_amount: finalAmount.toFixed(2),
                currency: 'USD',
                payment_number: 1,
                total_payments: 1,
                category_name: categoryName,
                excluded_from_flow: false,
                notes: notes,
                quantity: quantity,
                source_type: 'investment',
                source_category: null,
                user_id: userId,
                cash_flow_id: cashFlowId,
                transaction_hash: transactionHash,
                created_at: now,
                updated_at: now,
                transaction_type: transactionType
            };
            
            transactions.push(mainTransaction);
            
            // Handle fees as separate transactions
            let commission = row['עמלה'];
            if (commission && typeof commission === 'string') {
                commission = commission.replace(/[\s$-]/g, '').trim();
                if (commission && commission !== '' && !isNaN(parseFloat(commission))) {
                    const feeAmount = parseFloat(commission);
                    if (feeAmount !== 0) {
                    const feeHashString = `${userId || 'no_user'}_עמלת מסחר_${baseDate}_${feeAmount}_USD`;
                    const feeHash = crypto.createHash('md5').update(feeHashString).digest('hex');
                    
                    const feeTransaction = {
                        flow_month: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`,
                        business_name: 'עמלת מסחר',
                        payment_method: 'Blink',
                        payment_identifier: '',
                        payment_date: baseDate,
                        payment_month: dateObj.getMonth() + 1,
                        payment_year: dateObj.getFullYear(),
                        charge_date: baseDate,
                        amount: Math.abs(feeAmount) * -1, // Fees should be negative
                        original_amount: Math.abs(feeAmount) * -1,
                        currency: 'USD',
                        payment_number: 1,
                        total_payments: 1,
                        category_name: 'עמלות',
                        excluded_from_flow: false,
                        notes: `עמלה עבור ${businessName}`,
                        source_type: 'investment',
                        source_category: null,
                        user_id: userId,
                        cash_flow_id: cashFlowId,
                        transaction_hash: feeHash,
                        created_at: now,
                        updated_at: now,
                        transaction_type: 'Fee'
                    };
                    
                        transactions.push(feeTransaction);
                    }
                }
            }
            
            // Create stock transaction summary record for Buy/Sell operations
            if (['Buy', 'Sell'].includes(transactionType) && row['שם הנייר'] && row['כמות']) {
                const stockTransaction = {
                    user_id: userId,
                    stock_symbol: row['שם הנייר'].trim(),
                    transaction_type: transactionType.toLowerCase(),
                    quantity: parseFloat(row['כמות']) || 0,
                    price_per_share: parseFloat(row['מחיר קנייה ממוצע']) || null,
                    total_amount: Math.abs(finalAmount),
                    transaction_date: baseDate,
                    original_transaction_id: null, // Will be filled after transaction is saved
                    cash_flow_id: cashFlowId,
                    fees: parseFloat(commission) || 0,
                    notes: notes
                };
                
                console.log(`[BLINK_PROCESSOR] Stock transaction summary:`, stockTransaction);
                // Note: This would need to be saved to stock_transactions_summary table
                // For now, we're just logging it for debugging
            }
            
            console.log(`[BLINK_PROCESSOR] Created ${transactions.length} transactions for ${businessName}`);
            return transactions;
            
        } catch (error) {
            console.error(`[BLINK_PROCESSOR] Error converting row: ${error.message}`);
            return [];
        }
    }
    
    /**
     * Build notes string from quantity and price
     * @param {*} quantity - Stock quantity
     * @param {*} price - Average purchase price
     * @returns {string} - Formatted notes string
     */
    buildNotesString(quantity, price) {
        const parts = [];
        
        if (quantity !== null && quantity !== undefined && quantity !== '') {
            parts.push(`Quantity: ${quantity}`);
        }
        
        if (price !== null && price !== undefined && price !== '') {
            parts.push(`Price: ${price}`);
        }
        
        return parts.join(', ');
    }

    /**
     * Group transactions by currency
     * @param {Array} transactions - Array of transactions
     * @returns {Object} - Grouped transactions by currency
     */
    groupByCurrency(transactions) {
        const groups = {};
        
        for (const transaction of transactions) {
            const currency = transaction.currency || 'USD';
            if (!groups[currency]) {
                groups[currency] = [];
            }
            groups[currency].push(transaction);
        }
        
        return groups;
    }

    /**
     * Save processed transactions to database
     * @param {Array} transactions - Array of transactions to save
     * @param {boolean} checkDuplicates - Whether to check for duplicates
     * @returns {Object} - Save result
     */
    async saveTransactions(transactions, checkDuplicates = true) {
        try {
            console.log(`[BLINK_PROCESSOR] Saving ${transactions.length} transactions to database`);
            
            const supabase = getSupabase();
            let savedCount = 0;
            let duplicateCount = 0;
            const errors = [];
            
            for (const transaction of transactions) {
                try {
                    if (checkDuplicates) {
                        // Check for existing transaction with same hash
                        const { data: existing } = await supabase
                            .from('transactions')
                            .select('id')
                            .eq('transaction_hash', transaction.transaction_hash)
                            .single();
                        
                        if (existing) {
                            duplicateCount++;
                            console.log(`[BLINK_PROCESSOR] Duplicate found: ${transaction.business_name} on ${transaction.payment_date}`);
                            continue;
                        }
                    }
                    
                    // Insert transaction
                    const { error } = await supabase
                        .from('transactions')
                        .insert([transaction]);
                    
                    if (error) {
                        console.error(`[BLINK_PROCESSOR] Error saving transaction: ${error.message}`);
                        errors.push({ transaction: transaction.business_name, error: error.message });
                    } else {
                        savedCount++;
                        console.log(`[BLINK_PROCESSOR] Saved: ${transaction.business_name} - ${transaction.amount} ${transaction.currency}`);
                    }
                    
                } catch (transactionError) {
                    console.error(`[BLINK_PROCESSOR] Transaction processing error: ${transactionError.message}`);
                    errors.push({ transaction: transaction.business_name, error: transactionError.message });
                }
            }
            
            console.log(`[BLINK_PROCESSOR] Save completed: ${savedCount} saved, ${duplicateCount} duplicates, ${errors.length} errors`);
            
            return {
                success: true,
                saved_count: savedCount,
                duplicate_count: duplicateCount,
                total_processed: transactions.length,
                errors: errors
            };
            
        } catch (error) {
            console.error(`[BLINK_PROCESSOR] Error saving transactions: ${error.message}`);
            return {
                success: false,
                error: error.message,
                saved_count: 0,
                duplicate_count: 0,
                total_processed: 0,
                errors: []
            };
        }
    }

    /**
     * Process Blink file and save to database in one operation
     * @param {string} filePath - Path to the Blink Excel file
     * @param {string} userId - User ID
     * @param {string} cashFlowId - Cash flow ID
     * @param {boolean} checkDuplicates - Whether to check for duplicates
     * @returns {Object} - Complete processing result
     */
    async processAndSaveBlinkFile(filePath, userId, cashFlowId, checkDuplicates = true) {
        try {
            console.log(`[BLINK_PROCESSOR] Starting complete processing for user ${userId}, cash_flow ${cashFlowId}`);
            
            // Process the file
            const processResult = await this.processBlinkFile(filePath, userId, cashFlowId);
            
            if (!processResult.success) {
                return processResult;
            }
            
            // Save transactions
            const saveResult = await this.saveTransactions(processResult.transactions, checkDuplicates);
            
            return {
                success: saveResult.success,
                file_processed: processResult.success,
                transactions_processed: processResult.processed_count,
                transactions_saved: saveResult.saved_count,
                duplicates_found: saveResult.duplicate_count,
                errors: saveResult.errors,
                currency_groups: processResult.currency_groups,
                message: `Processed ${processResult.processed_count} transactions, saved ${saveResult.saved_count}, found ${saveResult.duplicate_count} duplicates`
            };
            
        } catch (error) {
            console.error(`[BLINK_PROCESSOR] Error in complete processing: ${error.message}`);
            return {
                success: false,
                error: error.message,
                file_processed: false,
                transactions_processed: 0,
                transactions_saved: 0,
                duplicates_found: 0,
                errors: []
            };
        }
    }
}

module.exports = new BlinkProcessor();
