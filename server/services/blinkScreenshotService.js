const OpenAI = require('openai');
const { getSupabase } = require('../config/supabase');
const crypto = require('crypto');

class BlinkScreenshotService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    /**
     * Process Blink screenshot using OpenAI GPT-4 Vision
     * @param {Buffer} imageBuffer - The image file buffer
     * @param {string} userId - User ID for duplicate checking
     * @param {string} cashFlowId - Cash flow ID
     * @returns {Object} Result with extracted transactions
     */
    async processBlinkScreenshot(imageBuffer, userId, cashFlowId) {
        try {
            console.log('[BLINK_SCREENSHOT] Starting to process screenshot');
            
            if (!this.openai.apiKey) {
                throw new Error('OpenAI API key not configured');
            }

            // Convert buffer to base64
            const base64Image = imageBuffer.toString('base64');
            const mimeType = this.detectMimeType(imageBuffer);

            const prompt = `
                אתה מומחה בקריאת צילומי מסך של אפליקציית Blink הישראלית לטריידינג.
                
                אנא נתח את התמונה וחלץ את כל הפעילויות הפיננסיות שמוצגות בה.
                
                עבור כל פעילות, חלץ את המידע הבא:
                1. סמל המניה/פעילות (symbol) - כמו TSLA, AAPL וכו' (עבור מניות), או תיאור כמו "הפקדה", "דיבידנד"
                2. תאריך הפעילות (date) - בפורמט YYYY-MM-DD. חשוב מאוד: המר תאריכים עבריים בצורה נכונה:
                   - "01 יולי 2025" = "2025-07-01"
                   - "09 יוני 2025" = "2025-06-09" 
                   - "23 יוני 2025" = "2025-06-23"
                   - "11 יוני 2025" = "2025-06-11"
                   חודשים בעברית: ינואר=01, פברואר=02, מרץ=03, אפריל=04, מאי=05, יוני=06, יולי=07, אוגוסט=08, ספטמבר=09, אוקטובר=10, נובמבר=11, דצמבר=12
                3. סוג הפעילות (type):
                   - "Buy" - קנייה (כאשר הסכום שלילי ויש סמל מניה)
                   - "Sell" - מכירה (כאשר הסכום חיובי ויש סמל מניה) 
                   - "Deposit" - הפקדה (כאשר רשום "הפקדה")
                   - "Dividend" - דיבידנד (כאשר רשום "דיבידנד")
                4. כמות המניות (quantity) - רק עבור עסקאות מניות, null עבור הפקדות/דיבידנדים
                5. מחיר למניה (price) - רק עבור עסקאות מניות, null עבור הפקדות/דיבידנדים
                6. סכום כולל (amount) - הסכום בדולרים (חיובי או שלילי כפי שמוצג)
                
                חלץ את כל השורות שמוצגות בתמונה, כולל הפקדות ודיבידנדים.
                
                החזר את התוצאות כ-JSON תקין בפורמט הבא:
                {
                    "transactions": [
                        {
                            "symbol": "TSLA",
                            "date": "2025-07-01",
                            "type": "Buy",
                            "quantity": null,
                            "price": null,
                            "amount": -103.82
                        },
                        {
                            "symbol": "הפקדה",
                            "date": "2025-07-01",
                            "type": "Deposit",
                            "quantity": null,
                            "price": null,
                            "amount": 292.79
                        }
                    ]
                }
                
                חשוב: 
                - החזר רק JSON תקין, ללא טקסט נוסף
                - עבור עסקאות מניות, השאר quantity ו-price כ-null (המשתמש ימלא אותם ידנית)
                - תמיד תכלול את כל השורות שמוצגות בתמונה
            `;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 2000,
                temperature: 0.1
            });

            const aiResponse = response.choices[0].message.content;
            console.log('[BLINK_SCREENSHOT] AI Response:', aiResponse);

            // Parse the JSON response
            let parsedResponse;
            try {
                // Clean the response - remove any potential markdown formatting
                const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                parsedResponse = JSON.parse(cleanResponse);
            } catch (parseError) {
                console.error('[BLINK_SCREENSHOT] Failed to parse AI response:', parseError);
                console.error('[BLINK_SCREENSHOT] AI Response was:', aiResponse);
                throw new Error('Failed to parse AI response. Please try again with a clearer image.');
            }

            const transactions = parsedResponse.transactions || [];
            console.log(`[BLINK_SCREENSHOT] Extracted ${transactions.length} transactions`);

            // Validate and clean up the transactions
            const validTransactions = transactions
                .filter(tx => tx.symbol && tx.date && tx.type && tx.amount)
                .map(tx => ({
                    symbol: tx.type === 'Deposit' ? 'הפקדה' : tx.type === 'Dividend' ? 'דיבידנד' : tx.symbol.toUpperCase(),
                    date: tx.date,
                    type: tx.type,
                    quantity: tx.quantity ? parseFloat(tx.quantity) : null,
                    price: tx.price ? parseFloat(tx.price) : null,
                    amount: parseFloat(tx.amount)
                }));

            // Check for duplicates after extraction
            const duplicateInfo = await this.checkForDuplicates(validTransactions, userId);

            return {
                success: true,
                transactions: validTransactions,
                duplicates: duplicateInfo,
                raw_response: aiResponse
            };

        } catch (error) {
            console.error('[BLINK_SCREENSHOT] Processing error:', error);
            return {
                success: false,
                error: error.message || 'Failed to process screenshot'
            };
        }
    }

    /**
     * Check for duplicate transactions in database
     * @param {Array} transactions - Array of transactions to check
     * @param {string} userId - User ID
     * @param {string} cashFlowId - Cash flow ID (not used in duplicate check since we don't have it in the function call)
     * @returns {Array} Array of duplicate information
     */
    async checkForDuplicates(transactions, userId, cashFlowId = null) {
        try {
            const supabase = getSupabase();
            const duplicates = [];

            for (const transaction of transactions) {
                // Create business name for comparison
                let businessName;
                switch (transaction.type) {
                    case 'Deposit':
                        businessName = 'הפקדה לחשבון השקעות';
                        break;
                    case 'Dividend':
                        businessName = transaction.symbol;
                        break;
                    default:
                        businessName = transaction.symbol;
                }

                // Check for existing transaction with same date, business_name, and amount
                const expectedAmount = this.calculateTransactionAmount(transaction);
                const { data: existing } = await supabase
                    .from('transactions')
                    .select('id, business_name, payment_date, amount, notes, transaction_type')
                    .eq('user_id', userId)
                    .eq('business_name', businessName)
                    .eq('payment_date', transaction.date)
                    .eq('amount', expectedAmount);

                console.log(`[DUPLICATE_CHECK] Checking: ${businessName} on ${transaction.date} amount ${expectedAmount} - Found ${existing?.length || 0} matches`);

                if (existing && existing.length > 0) {
                    duplicates.push({
                        newTransaction: transaction,
                        existingTransactions: existing,
                        isDuplicate: true
                    });
                }
            }

            return duplicates;

        } catch (error) {
            console.error('[BLINK_DUPLICATE_CHECK] Error checking duplicates:', error);
            return [];
        }
    }

    /**
     * Calculate transaction amount based on type
     * @param {Object} transaction - Transaction object
     * @returns {number} Calculated amount
     */
    calculateTransactionAmount(transaction) {
        switch (transaction.type) {
            case 'Buy':
                return -Math.abs(transaction.amount);
            case 'Sell':
            case 'Deposit':
            case 'Dividend':
                return Math.abs(transaction.amount);
            default:
                return parseFloat(transaction.amount);
        }
    }

    /**
     * Import confirmed transactions to database
     * @param {Array} transactions - Array of transaction objects
     * @param {string} userId - User ID
     * @param {string} cashFlowId - Cash flow ID
     * @returns {Object} Import result
     */
    async importTransactions(transactions, userId, cashFlowId) {
        try {
            console.log(`[BLINK_IMPORT] Starting import of ${transactions.length} transactions`);
            
            const supabase = getSupabase();
            let imported = 0;
            let duplicates = 0;

            for (const transaction of transactions) {
                try {
                    // Generate transaction hash to prevent duplicates
                    const transactionHash = this.generateTransactionHash(transaction, userId);
                    
                    console.log(`[BLINK_IMPORT] Processing transaction: ${transaction.symbol} ${transaction.type} ${transaction.amount}`);
                    
                    // Check if transaction already exists
                    const { data: existing } = await supabase
                        .from('transactions')
                        .select('id')
                        .eq('transaction_hash', transactionHash)
                        .eq('user_id', userId)
                        .single();

                    if (existing) {
                        console.log(`[BLINK_IMPORT] Duplicate transaction found: ${transaction.symbol} ${transaction.date}`);
                        duplicates++;
                        continue;
                    }

                    // Determine amount and transaction details based on type
                    let amount, businessName, notes, sourceType, transactionType, categoryName, quantity;
                    
                    switch (transaction.type) {
                        case 'Buy':
                            amount = -Math.abs(transaction.amount);
                            businessName = transaction.symbol;
                            notes = transaction.quantity && transaction.price 
                                ? `Quantity: ${transaction.quantity}, Price: $${transaction.price}`
                                : `Amount: $${Math.abs(transaction.amount)}`;
                            sourceType = 'investment';
                            transactionType = 'Buy';
                            categoryName = 'קניית מניה';
                            quantity = transaction.quantity ? transaction.quantity.toString() : null;
                            break;
                            
                        case 'Sell':
                            amount = Math.abs(transaction.amount);
                            businessName = transaction.symbol;
                            notes = transaction.quantity && transaction.price 
                                ? `Quantity: ${transaction.quantity}, Price: $${transaction.price}`
                                : `Amount: $${Math.abs(transaction.amount)}`;
                            sourceType = 'investment';
                            transactionType = 'Sell';
                            categoryName = 'מכירת מניה';
                            quantity = transaction.quantity ? transaction.quantity.toString() : null;
                            break;
                            
                        case 'Deposit':
                            amount = Math.abs(transaction.amount);
                            businessName = 'הפקדה לחשבון השקעות';
                            notes = `Deposit: $${Math.abs(transaction.amount)}`;
                            sourceType = 'investment';
                            transactionType = 'Deposit';
                            categoryName = 'הפקדה';
                            quantity = null;
                            break;
                            
                        case 'Dividend':
                            amount = Math.abs(transaction.amount);
                            businessName = transaction.symbol;
                            notes = `Dividend: $${Math.abs(transaction.amount)}`;
                            sourceType = 'investment';
                            transactionType = 'Dividend';
                            categoryName = 'דיבידנד';
                            quantity = null;
                            break;
                            
                        default:
                            amount = parseFloat(transaction.amount);
                            businessName = transaction.symbol;
                            notes = `Amount: $${Math.abs(transaction.amount)}`;
                            sourceType = 'investment';
                            transactionType = transaction.type;
                            categoryName = null;
                            quantity = transaction.quantity ? transaction.quantity.toString() : null;
                    }
                    
                    // Create transaction record
                    const transactionData = {
                        user_id: userId,
                        business_name: businessName,
                        payment_date: transaction.date,
                        amount: amount,
                        currency: 'USD',
                        payment_method: 'Blink',
                        payment_identifier: '',
                        payment_month: new Date(transaction.date).getMonth() + 1,
                        payment_year: new Date(transaction.date).getFullYear(),
                        flow_month: this.getFlowMonth(transaction.date),
                        charge_date: transaction.date,
                        notes: notes,
                        excluded_from_flow: false,
                        source_type: sourceType,
                        original_amount: amount.toString(),
                        transaction_hash: transactionHash,
                        cash_flow_id: cashFlowId,
                        is_transfer: false,
                        linked_transaction_id: null,
                        payment_number: 1,
                        total_payments: 1,
                        original_currency: null,
                        exchange_rate: null,
                        exchange_date: null,
                        business_country: null,
                        quantity: quantity,
                        source_category: null,
                        transaction_type: transactionType,
                        execution_method: null
                    };

                    const { error } = await supabase
                        .from('transactions')
                        .insert([transactionData]);

                    if (error) {
                        console.error(`[BLINK_IMPORT] Error inserting transaction ${transaction.symbol}:`, error);
                        continue;
                    }

                    imported++;
                    console.log(`[BLINK_IMPORT] Successfully imported: ${transaction.symbol} ${transaction.type} ${transaction.quantity} @ $${transaction.price}`);

                } catch (txError) {
                    console.error(`[BLINK_IMPORT] Error processing transaction ${transaction.symbol}:`, txError);
                }
            }

            console.log(`[BLINK_IMPORT] Import completed: ${imported} imported, ${duplicates} duplicates`);

            return {
                success: true,
                imported,
                duplicates,
                total: transactions.length
            };

        } catch (error) {
            console.error('[BLINK_IMPORT] Import error:', error);
            return {
                success: false,
                error: error.message || 'Failed to import transactions'
            };
        }
    }

    /**
     * Generate a hash for transaction to prevent duplicates
     * @param {Object} transaction - Transaction object
     * @param {string} userId - User ID
     * @returns {string} Transaction hash
     */
    generateTransactionHash(transaction, userId) {
        const hashString = `${userId}-${transaction.symbol}-${transaction.date}-${transaction.type}-${transaction.quantity}-${transaction.price}`;
        return crypto.createHash('md5').update(hashString).digest('hex');
    }

    /**
     * Get flow month in YYYY-MM format
     * @param {string} dateStr - Date string
     * @returns {string} Flow month
     */
    getFlowMonth(dateStr) {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * Detect MIME type from buffer
     * @param {Buffer} buffer - Image buffer
     * @returns {string} MIME type
     */
    detectMimeType(buffer) {
        // Check PNG signature
        if (buffer.length >= 8 && 
            buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
            buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
            return 'image/png';
        }
        
        // Check JPEG signature
        if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
            return 'image/jpeg';
        }
        
        // Default to jpeg
        return 'image/jpeg';
    }
}

module.exports = new BlinkScreenshotService();