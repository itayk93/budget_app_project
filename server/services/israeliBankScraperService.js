const { CompanyTypes, createScraper } = require('israeli-bank-scrapers');
const crypto = require('crypto');
const { supabase } = require('../config/supabase');

const ENCRYPTION_KEY = process.env.BANK_SCRAPER_ENCRYPTION_KEY || 'default-key-change-in-production';

class IsraeliBankScraperService {
    // Encrypt sensitive data before storing  
    encryptCredentials(credentials) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Prepend IV to encrypted data
        return iv.toString('hex') + ':' + encrypted;
    }

    // Decrypt credentials when retrieving
    decryptCredentials(encryptedCredentials) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        
        const textParts = encryptedCredentials.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = textParts.join(':');
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    }

    // Get all available bank types
    getAvailableBankTypes() {
        return {
            hapoalim: { name: 'בנק הפועלים', credentials: ['userCode', 'password'] },
            leumi: { name: 'בנק לאומי', credentials: ['username', 'password'] },
            discount: { name: 'בנק דיסקונט', credentials: ['id', 'password', 'num'] },
            mercantile: { name: 'בנק מרקנטיל', credentials: ['id', 'password', 'num'] },
            mizrahi: { name: 'בנק מזרחי', credentials: ['username', 'password'] },
            otsarHahayal: { name: 'בנק אוצר החייל', credentials: ['username', 'password'] },
            visaCal: { name: 'ויזה כאל', credentials: ['username', 'password'] },
            max: { name: 'מקס (לשעבר לאומי קארד)', credentials: ['username', 'password'] },
            isracard: { name: 'ישראכרט', credentials: ['id', 'card6Digits', 'password'] },
            amex: { name: 'אמריקן אקספרס', credentials: ['username', 'card6Digits', 'password'] },
            unionBank: { name: 'בנק יוניון', credentials: ['username', 'password'] },
            beinleumi: { name: 'בינלאומי', credentials: ['username', 'password'] },
            massad: { name: 'מסד', credentials: ['username', 'password'] },
            yahav: { name: 'בנק יהב', credentials: ['username', 'password', 'nationalID'] },
            beyhadBishvilha: { name: 'ביחד בשבילך', credentials: ['id', 'password'] },
            oneZero: { name: 'וואן זירו', credentials: ['email', 'password'] },
            behatsdaa: { name: 'בהצדעה', credentials: ['id', 'password'] }
        };
    }

    // Create new bank scraper configuration
    async createScraperConfig(userId, configName, bankType, credentials) {
        try {
            const encryptedCredentials = this.encryptCredentials(credentials);
            
            const { data, error } = await supabase
                .from('bank_scraper_configs')
                .insert([{
                    user_id: userId, // userId is already a UUID string
                    config_name: configName,
                    bank_type: bankType,
                    credentials_encrypted: encryptedCredentials,
                    is_active: true
                }])
                .select();

            if (error) throw error;
            return { success: true, config: data[0] };
        } catch (error) {
            console.error('Error creating scraper config:', error);
            return { success: false, error: error.message };
        }
    }

    // Get user's scraper configurations
    async getUserConfigs(userId) {
        try {
            const { data, error } = await supabase
                .from('bank_scraper_configs')
                .select('id, config_name, bank_type, is_active, last_scrape_date, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    // Table doesn't exist
                    return { 
                        success: false, 
                        error: 'הטבלאות של Bank Scraper לא נוצרו עדיין. אנא צור את הטבלאות ב-Supabase Dashboard לפי המדריך.',
                        needsSetup: true
                    };
                }
                throw error;
            }
            return { success: true, configs: data };
        } catch (error) {
            console.error('Error getting user configs:', error);
            return { success: false, error: error.message };
        }
    }

    // Run scraper for specific configuration
    async runScraper(configId, userId, startDate = null, endDate = null) {
        try {
            // Get configuration
            const { data: config, error: configError } = await supabase
                .from('bank_scraper_configs')
                .select('*')
                .eq('id', configId)
                .eq('user_id', userId)
                .single();

            if (configError || !config) {
                throw new Error('Configuration not found');
            }

            if (!config.is_active) {
                throw new Error('Configuration is disabled');
            }

            // Decrypt credentials
            const credentials = this.decryptCredentials(config.credentials_encrypted);

            // Set up scraper options
            const options = {
                companyId: CompanyTypes[config.bank_type],
                startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: last 30 days
                combineInstallments: false,
                showBrowser: true, // Show browser for debugging
                timeout: 60000, // 60 seconds timeout
                executablePath: null, // Use system Chrome
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            };

            if (endDate) {
                options.endDate = new Date(endDate);
            }

            console.log(`🚀 Starting scraper for ${config.bank_type} (Config ID: ${configId})`);
            console.log(`📅 Date range: ${options.startDate.toISOString().split('T')[0]} to ${options.endDate ? options.endDate.toISOString().split('T')[0] : 'now'}`);
            
            const startTime = Date.now();
            const scraper = createScraper(options);
            
            console.log(`🔧 Scraper created, starting scrape...`);
            const scrapeResult = await scraper.scrape(credentials);
            const executionTime = Math.round((Date.now() - startTime) / 1000);
            
            console.log(`✅ Scrape completed in ${executionTime} seconds`);
            console.log(`📊 Result:`, scrapeResult.success ? 'SUCCESS' : `FAILED - ${scrapeResult.errorType}`);
            
            if (scrapeResult.success && scrapeResult.accounts) {
                console.log(`🏦 Found ${scrapeResult.accounts.length} accounts with total ${scrapeResult.accounts.reduce((sum, acc) => sum + acc.txns.length, 0)} transactions`);
            }

            // Log the scraping attempt
            await this.logScrapeAttempt(configId, scrapeResult.success, scrapeResult.errorType, scrapeResult.errorMessage, scrapeResult.accounts?.length || 0, executionTime);

            if (scrapeResult.success) {
                // Store transactions and accounts
                let totalTransactions = 0;
                for (const account of scrapeResult.accounts) {
                    await this.storeAccountData(configId, account);
                    totalTransactions += account.txns.length;
                }

                // Update last scrape date
                await supabase
                    .from('bank_scraper_configs')
                    .update({ last_scrape_date: new Date().toISOString() })
                    .eq('id', configId);

                return {
                    success: true,
                    accounts: scrapeResult.accounts.length,
                    transactions: totalTransactions,
                    executionTime
                };
            } else {
                return {
                    success: false,
                    errorType: scrapeResult.errorType,
                    errorMessage: scrapeResult.errorMessage,
                    executionTime
                };
            }

        } catch (error) {
            console.error('❌ Error running scraper:', error);
            
            // Try to determine error type
            let errorType = 'UNKNOWN_ERROR';
            if (error.message.includes('timeout') || error.message.includes('Navigation timeout')) {
                errorType = 'TIMEOUT';
            } else if (error.message.includes('invalid') || error.message.includes('password')) {
                errorType = 'INVALID_PASSWORD';
            } else if (error.message.includes('blocked') || error.message.includes('captcha')) {
                errorType = 'ACCOUNT_BLOCKED';
            }
            
            await this.logScrapeAttempt(configId, false, errorType, error.message, 0, 0);
            return { 
                success: false, 
                error: error.message,
                errorType: errorType,
                suggestion: this.getErrorSuggestion(errorType)
            };
        }
    }

    // Store account data from scraping
    async storeAccountData(configId, account) {
        try {
            // Update account balance
            if (account.balance !== undefined) {
                await supabase
                    .from('bank_scraper_accounts')
                    .upsert({
                        config_id: configId,
                        account_number: account.accountNumber,
                        account_balance: account.balance,
                        last_updated: new Date().toISOString()
                    });
            }

            // Store transactions
            for (const txn of account.txns) {
                await supabase
                    .from('bank_scraper_transactions')
                    .upsert({
                        config_id: configId,
                        transaction_identifier: txn.identifier?.toString() || null,
                        account_number: account.accountNumber,
                        transaction_date: txn.date,
                        processed_date: txn.processedDate || null,
                        original_amount: txn.originalAmount,
                        original_currency: txn.originalCurrency,
                        charged_amount: txn.chargedAmount,
                        description: txn.description,
                        memo: txn.memo || null,
                        transaction_type: txn.type || 'normal',
                        status: txn.status || 'completed',
                        installment_number: txn.installments?.number || null,
                        total_installments: txn.installments?.total || null
                    });
            }
        } catch (error) {
            console.error('Error storing account data:', error);
            throw error;
        }
    }

    // Log scraping attempts
    async logScrapeAttempt(configId, success, errorType = null, errorMessage = null, transactionsCount = 0, executionTime = 0) {
        try {
            await supabase
                .from('bank_scraper_logs')
                .insert([{
                    config_id: configId,
                    success,
                    error_type: errorType,
                    error_message: errorMessage,
                    transactions_count: transactionsCount,
                    execution_time_seconds: executionTime
                }]);
        } catch (error) {
            console.error('Error logging scrape attempt:', error);
        }
    }

    // Get scraped transactions for a configuration
    async getScrapedTransactions(configId, userId, limit = 100, offset = 0) {
        try {
            // Verify user owns the config
            const { data: config } = await supabase
                .from('bank_scraper_configs')
                .select('id')
                .eq('id', configId)
                .eq('user_id', userId)
                .single();

            if (!config) {
                throw new Error('Configuration not found');
            }

            const { data, error } = await supabase
                .from('bank_scraper_transactions')
                .select('*')
                .eq('config_id', configId)
                .order('transaction_date', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return { success: true, transactions: data };
        } catch (error) {
            console.error('Error getting scraped transactions:', error);
            return { success: false, error: error.message };
        }
    }

    // Get scraping logs
    async getScrapingLogs(configId, userId, limit = 50) {
        try {
            // Verify user owns the config
            const { data: config } = await supabase
                .from('bank_scraper_configs')
                .select('id')
                .eq('id', configId)
                .eq('user_id', userId)
                .single();

            if (!config) {
                throw new Error('Configuration not found');
            }

            const { data, error } = await supabase
                .from('bank_scraper_logs')
                .select('*')
                .eq('config_id', configId)
                .order('scrape_date', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { success: true, logs: data };
        } catch (error) {
            console.error('Error getting scraping logs:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete configuration
    async deleteConfig(configId, userId) {
        try {
            const { data, error } = await supabase
                .from('bank_scraper_configs')
                .delete()
                .eq('id', configId)
                .eq('user_id', userId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting config:', error);
            return { success: false, error: error.message };
        }
    }

    // Update configuration
    async updateConfig(configId, userId, configName, credentials) {
        try {
            // Verify user owns the config
            const { data: config } = await supabase
                .from('bank_scraper_configs')
                .select('*')
                .eq('id', configId)
                .eq('user_id', userId)
                .single();

            if (!config) {
                throw new Error('Configuration not found');
            }

            const updateData = {};
            
            // Update config name if provided
            if (configName && configName !== config.config_name) {
                updateData.config_name = configName;
                updateData.updated_at = new Date().toISOString();
            }

            // Update credentials if provided
            if (credentials && Object.keys(credentials).length > 0) {
                // Filter out empty credentials
                const filteredCredentials = Object.fromEntries(
                    Object.entries(credentials).filter(([key, value]) => value && value.trim() !== '')
                );
                
                if (Object.keys(filteredCredentials).length > 0) {
                    // Decrypt existing credentials
                    const existingCredentials = this.decryptCredentials(config.credentials_encrypted);
                    
                    // Merge with new credentials
                    const mergedCredentials = { ...existingCredentials, ...filteredCredentials };
                    
                    // Encrypt and update
                    updateData.credentials_encrypted = this.encryptCredentials(mergedCredentials);
                    updateData.updated_at = new Date().toISOString();
                }
            }

            if (Object.keys(updateData).length === 0) {
                return { success: true, message: 'No changes to update', config: config };
            }

            const { data: updatedConfig, error } = await supabase
                .from('bank_scraper_configs')
                .update(updateData)
                .eq('id', configId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, config: updatedConfig };
            
        } catch (error) {
            console.error('Error updating config:', error);
            return { success: false, error: error.message };
        }
    }

    // Toggle configuration active status
    async toggleConfig(configId, userId) {
        try {
            // Get current status
            const { data: config } = await supabase
                .from('bank_scraper_configs')
                .select('is_active')
                .eq('id', configId)
                .eq('user_id', userId)
                .single();

            if (!config) {
                throw new Error('Configuration not found');
            }

            // Toggle status
            const { data, error } = await supabase
                .from('bank_scraper_configs')
                .update({ is_active: !config.is_active })
                .eq('id', configId)
                .eq('user_id', userId);

            if (error) throw error;
            return { success: true, isActive: !config.is_active };
        } catch (error) {
            console.error('Error toggling config:', error);
            return { success: false, error: error.message };
        }
    }

    // Get error suggestion based on error type
    getErrorSuggestion(errorType) {
        const suggestions = {
            'TIMEOUT': 'נסה שוב מאוחר יותר. ייתכן שאתר הבנק עמוס או שהחיבור איטי.',
            'INVALID_PASSWORD': 'בדוק את פרטי הכניסה. ייתכן שהסיסמה השתנתה או שהחשבון נחסם.',
            'ACCOUNT_BLOCKED': 'החשבון עלול להיות חסום. פנה לבנק לבירור או נסה שוב מאוחר יותר.',
            'CHANGE_PASSWORD': 'הבנק דורש שינוי סיסמה. התחבר לאתר הבנק ושנה את הסיסמה.',
            'UNKNOWN_ERROR': 'שגיאה לא ידועה. בדוק את החיבור לאינטרנט ונסה שוב.'
        };
        return suggestions[errorType] || suggestions['UNKNOWN_ERROR'];
    }
}

module.exports = new IsraeliBankScraperService();