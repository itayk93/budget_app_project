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
                
                עבור כל פעילות, חלץ את המידע הבא (כולל גם הטקסטים הגולמיים מהמסך כדי שנוכל לאמת ולבצע תיקונים לוגיים):
                1. סמל המניה/פעילות (symbol) - כמו TSLA, AAPL וכו' (עבור מניות), או תיאור כמו "הפקדה", "דיבידנד".
                2. תאריך הפעילות (date) - בפורמט YYYY-MM-DD. חשוב מאוד: המר תאריכים עבריים בצורה נכונה (למשל "17 אוקט׳ 2025" → "2025-10-17").
                   חודשים בעברית: ינואר=01, פברואר=02, מרץ=03, אפריל=04, מאי=05, יוני=06, יולי=07, אוגוסט=08, ספטמבר=09, אוקטובר=10, נובמבר=11, דצמבר=12.
                3. סוג הפעילות (type):
                   - "Buy" - קנייה (כאשר הסכום שלילי ויש סמל מניה)
                   - "Sell" - מכירה (כאשר הסכום חיובי ויש סמל מניה) 
                   - "Deposit" - הפקדה (כאשר רשום "הפקדה")
                   - "Dividend" - דיבידנד (כאשר רשום "דיבידנד")
                   - "Tax" - חיוב מס/ניכוי מס (מופיע כ"חיוב מס" או דומה; בדרך כלל סכום שלילי, ללא סמל מניה)
                4. טקסטים גולמיים:
                   - action_text: הטקסט בעמודה הימנית (למשל "קניה", "מכירה", "הפקדה", "דיבידנד", "חיוב מס אוגוסט" וכו').
                   - center_text: הטקסט בעמודה האמצעית (לרוב סמל המניה, לעתים ריק בשורות כמו הפקדה/חיוב מס).
                   - quantity_text: אם מופיע מתחת לסמל בסגנון "מניות 2.4273" או "2.4273 מניות" — החזר את המחרוזת כפי שהיא.
                5. כמות המניות (quantity) - עבור עסקאות מניות בלבד. נסה לחלץ לפי quantity_text; אם לא מופיע — נסה להסיק אם ברור. אחרת השאר null.
                6. מחיר למניה (price) - עבור עסקאות מניות בלבד. אם קיימת גם כמות וגם סכום — חשב price = ABS(amount) / quantity וענה עם 4 ספרות אחרי הנקודה. אחרת, אם לא ניתן להסיק — השאר null.
                7. סכום כולל (amount) - הסכום בדולרים כפי שמוצג, חיובי/שלילי.
                
                הנחיות נוספות:
                - ודא שכמות (quantity) מעוגלת ל-4 ספרות אחרי הנקודה, אם נמצאה.
                - אם מופיע טקסט בעברית בסגנון "מניות X.XXXX" או "X.XXXX מניות" — זהו את X.XXXX ככמות.
                - החזר את כל השורות שמוצגות בתמונה, כולל הפקדות ודיבידנדים.
                - כאשר action_text הוא "הפקדה"/"דיבידנד"/"חיוב מס ..." — סוג הפעילות נקבע לפיהם גם אם center_text מכיל סמל שנשאב בטעות.
                
                החזר את התוצאות כ-JSON תקין בפורמט הבא:
                {
                    "transactions": [
                        {
                            "symbol": "TSLA",
                            "date": "2025-07-01",
                            "type": "Buy",
                            "quantity": 2.4273,
                            "price": 61.23,
                            "amount": -103.82,
                            "action_text": "קניה",
                            "center_text": "TSLA",
                            "quantity_text": "מניות 2.4273"
                        },
                        {
                            "symbol": "חיוב מס",
                            "date": "2025-10-05",
                            "type": "Tax",
                            "quantity": null,
                            "price": null,
                            "amount": -8.10,
                            "action_text": "חיוב מס אוגוסט",
                            "center_text": "",
                            "quantity_text": null
                        },
                        {
                            "symbol": "הפקדה",
                            "date": "2025-07-01",
                            "type": "Deposit",
                            "quantity": null,
                            "price": null,
                            "amount": 292.79,
                            "action_text": "הפקדה",
                            "center_text": "",
                            "quantity_text": null
                        }
                    ]
                }
                
                חשוב: 
                - החזר רק JSON תקין, ללא טקסט נוסף
                - עבור עסקאות מניות, נסה למלא quantity; ואם ניתן — חשב גם price בהתאם לכללים לעיל
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
            const normalizeType = (t) => {
                if (!t) return 'Other';
                const s = String(t).toLowerCase();
                if (/(buy|קנ(י|י)ה)/.test(s)) return 'Buy';
                if (/(sell|מכ(י|י)רה)/.test(s)) return 'Sell';
                if (/(deposit|הפקד(ה)?)/.test(s)) return 'Deposit';
                if (/(dividend|דיבידנד)/.test(s)) return 'Dividend';
                if (/(tax|מס|ניכוי\s*מס|חיוב\s*מס)/.test(s)) return 'Tax';
                return 'Other';
            };

            let validTransactions = transactions
                .filter(tx => tx && tx.date && tx.type && tx.amount !== undefined && tx.amount !== null)
                .map(tx => {
                    const rawAction = (tx.action_text || '').toLowerCase();
                    const rawCenter = (tx.center_text || '').toUpperCase();
                    let finalType = normalizeType(tx.type);
                    if (/הפקד/.test(rawAction)) finalType = 'Deposit';
                    else if (/דיבידנד/.test(rawAction)) finalType = 'Dividend';
                    else if (/חיוב\s*מס|מס\s|tax/.test(rawAction)) finalType = 'Tax';
                    else if (/קנ(י|י)ה/.test(rawAction)) finalType = 'Buy';
                    else if (/מכ(י|י)רה/.test(rawAction)) finalType = 'Sell';

                    let symbol = (tx.symbol || '').toUpperCase();
                    if (finalType === 'Deposit') symbol = 'הפקדה';
                    else if (finalType === 'Tax') symbol = 'חיוב מס';
                    else if (finalType === 'Dividend' && !symbol) symbol = rawCenter;
                    else if (!symbol) symbol = rawCenter;

                    // Fill quantity from quantity_text if needed
                    let quantity = tx.quantity;
                    if ((quantity === undefined || quantity === null || quantity === '') && tx.quantity_text) {
                        const m = String(tx.quantity_text).match(/([\d.,]+)/);
                        if (m) quantity = parseFloat(m[1].replace(',', '.'));
                    }

                    return {
                        symbol,
                        date: tx.date,
                        type: finalType,
                        quantity: quantity != null && quantity !== '' ? parseFloat(Number(quantity).toFixed(4)) : null,
                        price: tx.price != null && tx.price !== '' ? parseFloat(Number(tx.price).toFixed(4)) : null,
                        amount: parseFloat(tx.amount)
                    };
                });

            // If quantity exists and price missing, compute price from amount/quantity
            validTransactions = validTransactions.map(tx => {
                if ((tx.type === 'Buy' || tx.type === 'Sell') && tx.quantity && !tx.price && tx.amount) {
                    const price = Math.abs(tx.amount) / tx.quantity;
                    return { ...tx, price: parseFloat(price.toFixed(4)) };
                }
                return tx;
            });

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
                    case 'Tax':
                        businessName = 'חיוב מס';
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
            case 'Tax':
                return -Math.abs(transaction.amount);
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
                        case 'Tax':
                            amount = -Math.abs(transaction.amount);
                            businessName = 'חיוב מס';
                            notes = `Tax charge: $${Math.abs(transaction.amount)}`;
                            sourceType = 'investment';
                            transactionType = 'Tax';
                            categoryName = 'מס/עמלות';
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
