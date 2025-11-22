const { CompanyTypes, createScraper } = require('israeli-bank-scrapers');
const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const SupabaseService = require('./supabaseService');
const HiddenBusinessService = require('./hiddenBusinessService');

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

    // Get pending transactions for approval for a user
    async getPendingTransactions(userId, limit = 200) {
        try {
            const { data, error } = await supabase
                .from('bank_scraper_pending_transactions')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'pending')
                .order('payment_date', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return { success: true, transactions: data || [] };
        } catch (error) {
            console.error('Error fetching pending transactions:', error);
            return { success: false, error: error.message };
        }
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
        const types = {
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
            yahav: { name: 'בנק יהב', credentials: ['username', 'password', 'nationalID', 'accountNumber'] },
            beyhadBishvilha: { name: 'ביחד בשבילך', credentials: ['id', 'password'] },
            oneZero: { name: 'וואן זירו', credentials: ['email', 'password'] },
            behatsdaa: { name: 'בהצדעה', credentials: ['id', 'password'] }
        };

        // Attach envEnabled flag per bank
        const withEnvFlags = {};
        for (const [key, val] of Object.entries(types)) {
            withEnvFlags[key] = {
                ...val,
                envEnabled: this.isBankUsingEnvCredentials(key)
            };
        }

        return withEnvFlags;
    }

    // Create new bank scraper configuration
    async createScraperConfig(userId, configName, bankType, credentials) {
        try {
            // For Yahav, check if ENV is properly configured
            if (bankType === 'yahav') {
                const envEnabled = process.env.BANK_ENV_CREDENTIALS_ENABLED === 'true';
                const allowedBanks = process.env.BANK_ENV_ALLOWED_BANKS ? 
                    process.env.BANK_ENV_ALLOWED_BANKS.split(',').map(b => b.trim()) : [];
                const yahavPassword = process.env.YAHAV_BANK_PASSWORD;

                console.log(`🔍 Yahav config check - ENV enabled: ${envEnabled}, Allowed banks: [${allowedBanks.join(', ')}], Password set: ${!!yahavPassword}`);

                if (!envEnabled || !allowedBanks.includes('yahav')) {
                    throw new Error('בנק יהב דורש הגדרת ENV. אנא וודא ש-BANK_ENV_CREDENTIALS_ENABLED=true ו-BANK_ENV_ALLOWED_BANKS=yahav מוגדרים בקובץ .env ואתחל את השרת.');
                }

                if (!yahavPassword || yahavPassword.includes('your_') || yahavPassword.includes('_here')) {
                    throw new Error('הסיסמה לבנק יהב לא מוגדרת ב-ENV. אנא הגדר YAHAV_BANK_PASSWORD בקובץ .env עם הסיסמה האמיתית ואתחל את השרת.');
                }

                // For Yahav, we need username, nationalID and accountNumber in the database
                if (!credentials.username || !credentials.nationalID || !credentials.accountNumber) {
                    throw new Error('עבור בנק יהב נדרשים שם משתמש, תעודת זהות ומספר חשבון. הסיסמה נטענת מ-ENV.');
                }
            }

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

    // Insert converted transactions into a pending-approval table
    async queueTransactionsForApproval(configId, userId) {
        try {
            // First convert to the main format used by the upload flow
            const conversion = await this.convertScrapedTransactionsToMainFormat(configId, userId);
            if (!conversion.success) {
                throw new Error(conversion.error || 'Conversion failed');
            }

            const transactions = conversion.transactions || [];
            if (transactions.length === 0) {
                return {
                    success: true,
                    message: 'No transactions to queue',
                    count: 0,
                    data: { queued: 0 }
                };
            }

            // Get existing transaction hashes for the user to prevent duplicates
            const { data: existingHashes, error: hashError } = await supabase
                .from('bank_scraper_pending_transactions')
                .select('transaction_hash')
                .eq('user_id', userId);

            if (hashError) {
                console.error('Error fetching existing transaction hashes:', hashError);
                throw hashError;
            }

            const existingHashSet = new Set(existingHashes.map(h => h.transaction_hash));
            
            // Filter out transactions that already exist
            const newTransactions = transactions.filter(tx => !existingHashSet.has(tx.transaction_hash));

            if (newTransactions.length === 0) {
                return {
                    success: true,
                    message: 'No new transactions to queue, all are duplicates.',
                    count: 0,
                    data: { queued: 0, duplicates: transactions.length }
                };
            }

            // Filter out transactions from hidden businesses before queuing
            const filteredTransactions = [];
            let hiddenBusinessCount = 0;

            // Get hidden business names for debugging
            const hiddenBusinessNames = await HiddenBusinessService.getHiddenBusinessNames(userId);
            console.log(`📊 [HIDDEN BUSINESS DEBUG] Found ${hiddenBusinessNames.length} hidden businesses for user ${userId}:`,
                hiddenBusinessNames.map(hb => hb.business_name));

            for (const tx of newTransactions) {
                if (tx.business_name) {
                    console.log(`🔍 [HIDDEN BUSINESS CHECK] Checking transaction: "${tx.business_name}" with hash ${tx.transaction_hash} for user ${userId}`);
                    const isHidden = await HiddenBusinessService.isBusinessHidden(tx.business_name, userId);
                    if (isHidden) {
                        hiddenBusinessCount++;
                        console.log(`🚫 Hidden business filtered from queue: "${tx.business_name}" for user ${userId}`);
                    } else {
                        console.log(`✅ Transaction allowed in queue: "${tx.business_name}"`);
                        filteredTransactions.push(tx);
                    }
                } else {
                    // If no business name, still add to queue
                    console.log(`❓ Transaction with no business name added to queue: hash ${tx.transaction_hash}`);
                    filteredTransactions.push(tx);
                }
            }

            console.log(`📊 [QUEUE FILTERING SUMMARY] Total new transactions: ${newTransactions.length}, Filtered: ${filteredTransactions.length}, Hidden filtered: ${hiddenBusinessCount}`);

            // Prepare rows for pending table with filtered transactions
            const rows = filteredTransactions.map(tx => ({
                user_id: userId,
                config_id: configId,
                business_name: tx.business_name,
                payment_date: tx.payment_date,
                amount: tx.amount,
                currency: tx.currency,
                payment_method: tx.payment_method,
                payment_identifier: tx.payment_identifier,
                category_name: tx.category_name,
                payment_month: tx.payment_month,
                payment_year: tx.payment_year,
                flow_month: tx.flow_month,
                charge_date: tx.charge_date,
                notes: tx.notes,
                excluded_from_flow: tx.excluded_from_flow,
                source_type: tx.source_type,
                original_amount: tx.original_amount,
                transaction_hash: tx.transaction_hash,
                is_transfer: tx.is_transfer,
                linked_transaction_id: tx.linked_transaction_id,
                payment_number: tx.payment_number,
                total_payments: tx.total_payments,
                original_currency: tx.original_currency,
                exchange_rate: tx.exchange_rate,
                exchange_date: tx.exchange_date,
                business_country: tx.business_country,
                quantity: tx.quantity,
                source_category: tx.source_category,
                transaction_type: tx.transaction_type,
                execution_method: tx.execution_method,
                file_source: tx.file_source,
                recipient_name: tx.recipient_name,
                duplicate_parent_id: tx.duplicate_parent_id,
                bank_scraper_source_id: tx.bank_scraper_source_id,
                status: 'pending'
            }));

            // Insert in chunks to avoid payload limits
            const chunkSize = 500;
            let inserted = 0;
            for (let i = 0; i < rows.length; i += chunkSize) {
                const chunk = rows.slice(i, i + chunkSize);
                const { error } = await supabase
                    .from('bank_scraper_pending_transactions')
                    .insert(chunk);
                if (error) {
                    throw error;
                }
                inserted += chunk.length;
            }

            return {
                success: true,
                message: hiddenBusinessCount > 0
                    ? `Queued ${inserted} new transactions for approval from ${conversion.configName}. Skipped ${transactions.length - newTransactions.length} duplicates and ${hiddenBusinessCount} hidden business transactions.`
                    : `Queued ${inserted} new transactions for approval from ${conversion.configName}. Skipped ${transactions.length - newTransactions.length} duplicates.`,
                count: inserted,
                data: {
                    queued: inserted,
                    duplicates: transactions.length - newTransactions.length,
                    hiddenBusinesses: hiddenBusinessCount,
                    configName: conversion.configName,
                    accountNumber: conversion.accountNumber
                }
            };
        } catch (error) {
            console.error('Error queueing transactions for approval:', error);
            return { success: false, error: error.message };
        }
    }

    async queueAllConfigsForApproval(userId, includeInactive = false) {
        try {
            const configsResult = await this.getUserConfigs(userId);
            if (!configsResult.success) {
                return {
                    success: false,
                    error: configsResult.error,
                    needsSetup: configsResult.needsSetup
                };
            }

            let configs = configsResult.configs || [];
            if (!includeInactive) {
                configs = configs.filter(config => config.is_active);
            }

            if (configs.length === 0) {
                return {
                    success: false,
                    error: includeInactive ? 'אין קונפיגורציות זמינות להרצה.' : 'אין קונפיגורציות פעילות להזנה לתור אישור.'
                };
            }

            const summary = [];
            let totalQueued = 0;
            let totalDuplicates = 0;

            for (const config of configs) {
                try {
                    const result = await this.queueTransactionsForApproval(config.id, userId);
                    if (result.success) {
                        const queued = result.data && typeof result.data.queued === 'number'
                            ? result.data.queued
                            : (typeof result.count === 'number' ? result.count : 0);
                        const duplicates = result.data && typeof result.data.duplicates === 'number'
                            ? result.data.duplicates
                            : 0;

                        totalQueued += queued;
                        totalDuplicates += duplicates;

                        summary.push({
                            configId: config.id,
                            configName: config.config_name,
                            bankType: config.bank_type,
                            success: true,
                            queued,
                            duplicates,
                            message: result.message
                        });
                    } else {
                        summary.push({
                            configId: config.id,
                            configName: config.config_name,
                            bankType: config.bank_type,
                            success: false,
                            error: result.error || 'שגיאה לא ידועה בתור האישור.'
                        });
                    }
                } catch (error) {
                    summary.push({
                        configId: config.id,
                        configName: config.config_name,
                        bankType: config.bank_type,
                        success: false,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                summary,
                totals: {
                    configsProcessed: configs.length,
                    totalConfigs: configsResult.configs.length,
                    totalQueued,
                    totalDuplicates
                }
            };
        } catch (error) {
            console.error('Error queueing all configs for approval:', error);
            return { success: false, error: error.message };
        }
    }

    async runAllScrapers(userId, options = {}) {
        const {
            includeInactive = false,
            startDate = null,
            endDate = null
        } = options;

        try {
            const configsResult = await this.getUserConfigs(userId);
            if (!configsResult.success) {
                return {
                    success: false,
                    error: configsResult.error,
                    needsSetup: configsResult.needsSetup
                };
            }

            let configs = configsResult.configs || [];
            if (!includeInactive) {
                configs = configs.filter(config => config.is_active);
            }

            if (configs.length === 0) {
                return {
                    success: false,
                    error: includeInactive ? 'אין קונפיגורציות זמינות להרצה.' : 'אין קונפיגורציות פעילות להרצת כריית נתונים.'
                };
            }

            const summary = [];
            let totalAccounts = 0;
            let totalTransactions = 0;

            for (const config of configs) {
                const configId = this.normalizeConfigId(config.id);
                try {
                    const result = await this.runScraper(
                        configId,
                        userId,
                        startDate,
                        endDate
                    );

                    if (result.success) {
                        totalAccounts += result.accounts || 0;
                        totalTransactions += result.transactions || 0;
                        summary.push({
                            configId,
                            configName: config.config_name,
                            bankType: config.bank_type,
                            success: true,
                            accounts: result.accounts,
                            transactions: result.transactions,
                            executionTime: result.executionTime
                        });
                    } else {
                        summary.push({
                            configId,
                            configName: config.config_name,
                            bankType: config.bank_type,
                            success: false,
                            errorType: result.errorType,
                            error: result.error || result.errorMessage || 'שגיאה בהרצת הסקרייפר'
                        });
                    }
                } catch (error) {
                    summary.push({
                        configId,
                        configName: config.config_name,
                        bankType: config.bank_type,
                        success: false,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                summary,
                totals: {
                    configsProcessed: configs.length,
                    totalConfigs: configsResult.configs.length,
                    totalAccounts,
                    totalTransactions
                }
            };
        } catch (error) {
            console.error('Error running all scrapers:', error);
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
            const normalizedConfigId = this.normalizeConfigId(configId);

            // Get configuration
            const { data: config, error: configError } = await supabase
                .from('bank_scraper_configs')
                .select('*')
                .eq('id', normalizedConfigId)
                .eq('user_id', userId)
                .single();

            if (configError || !config) {
                throw new Error('Configuration not found');
            }

            if (!config.is_active) {
                throw new Error('Configuration is disabled');
            }

            // Get credentials - use ENV if configured for this bank type
            const credentials = this.getCredentialsForBank(config.bank_type, config.credentials_encrypted);

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

            console.log(`🚀 Starting scraper for ${config.bank_type} (Config ID: ${normalizedConfigId})`);
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

            if (scrapeResult.success) {
                // Store transactions and accounts
                let totalTransactions = 0;
                for (const account of scrapeResult.accounts) {
                    console.log(`💾 Storing account ${account.accountNumber} with ${account.txns.length} transactions`);
                    await this.storeAccountData(normalizedConfigId, account);
                    totalTransactions += account.txns.length;
                }

                // Update last scrape date
                await supabase
                    .from('bank_scraper_configs')
                    .update({ last_scrape_date: new Date().toISOString() })
                    .eq('id', normalizedConfigId);

                console.log(`✅ Successfully stored ${totalTransactions} transactions from ${scrapeResult.accounts.length} accounts`);

                // Log the scraping attempt
                await this.logScrapeAttempt(normalizedConfigId, scrapeResult.success, scrapeResult.errorType, scrapeResult.errorMessage, totalTransactions, executionTime);

                // Enforce retention policy (keep only last two months)
                await this.cleanupOldTransactions();

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
                    }, {
                        onConflict: 'config_id, account_number'
                    });
            }

            // Store transactions with duplicate check
            let storedCount = 0;
            let duplicateCount = 0;
            for (const txn of account.txns) {
                try {
                    // 1. Check for duplicates before inserting
                    const { data: existing, error: checkError } = await supabase
                        .from('bank_scraper_transactions')
                        .select('id')
                        .eq('config_id', configId)
                        .eq('account_number', account.accountNumber)
                        .eq('transaction_date', txn.date)
                        .eq('charged_amount', txn.chargedAmount)
                        .eq('description', txn.description)
                        .limit(1);

                    if (checkError) {
                        console.error('Error checking for duplicate transaction:', checkError, txn);
                        continue; // Skip this transaction on error
                    }

                    if (existing && existing.length > 0) {
                        duplicateCount++;
                        continue; // This is a duplicate, skip it
                    }

                    // 2. If not a duplicate, insert it
                    const { error: insertError } = await supabase
                        .from('bank_scraper_transactions')
                        .insert([{
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
                        }]);
                    
                    if (insertError) {
                        console.error('Error storing transaction:', insertError, txn);
                    } else {
                        storedCount++;
                    }
                } catch (error) {
                    console.error('Exception storing transaction:', error, txn);
                }
            }
            console.log(`💾 Stored ${storedCount} new transactions for account ${account.accountNumber}. Skipped ${duplicateCount} duplicates.`);
            
            return storedCount;
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

    // Remove any transactions older than the retention window
    async cleanupOldTransactions(monthsBack = 2) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
            cutoffDate.setHours(0, 0, 0, 0);
            const cutoffIso = cutoffDate.toISOString();

            const { count, error } = await supabase
                .from('bank_scraper_transactions')
                .delete({ count: 'exact' })
                .lt('transaction_date', cutoffIso);

            if (error) {
                throw error;
            }

            console.log(`🧹 Removed ${count || 0} bank scraper transactions older than ${cutoffIso}`);
            return count || 0;
        } catch (error) {
            console.error('Error cleaning old bank scraper transactions:', error);
            return null;
        }
    }

    // Get scraped transactions for a configuration
    async getScrapedTransactions(configId, userId, limit = 100, offset = 0) {
        try {
            console.log(`🔍 Getting transactions for config ${configId}, user ${userId}`);
            
            // Verify user owns the config
            const { data: config } = await supabase
                .from('bank_scraper_configs')
                .select('id, config_name')
                .eq('id', configId)
                .eq('user_id', userId)
                .single();

            if (!config) {
                console.log(`❌ Configuration ${configId} not found for user ${userId}`);
                throw new Error('Configuration not found');
            }

            console.log(`✅ Configuration found: ${config.config_name}`);

            const { data, error } = await supabase
                .from('bank_scraper_transactions')
                .select('*')
                .eq('config_id', configId)
                .order('transaction_date', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                console.error('❌ Error querying transactions:', error);
                throw error;
            }

            console.log(`✅ Found ${data?.length || 0} transactions for config ${configId}`);
            return { success: true, transactions: data || [] };
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

    // Get credentials for a bank - use hybrid ENV+DB approach for Yahav, otherwise decrypt stored credentials
    getCredentialsForBank(bankType, encryptedCredentials) {
        const envCredentialsEnabled = process.env.BANK_ENV_CREDENTIALS_ENABLED === 'true';
        const allowedBanks = process.env.BANK_ENV_ALLOWED_BANKS ? 
            process.env.BANK_ENV_ALLOWED_BANKS.split(',').map(b => b.trim()) : [];

        console.log(`🔐 Getting credentials for ${bankType}, ENV enabled: ${envCredentialsEnabled}, Allowed: [${allowedBanks.join(', ')}]`);

        // Check if ENV credentials are enabled for this bank type
        if (envCredentialsEnabled && allowedBanks.includes(bankType)) {
            if (bankType === 'yahav') {
                console.log(`🌍 Using hybrid ENV+DB credentials for ${bankType}`);
                try {
                    return this.getHybridCredentials(bankType, encryptedCredentials);
                } catch (error) {
                    console.error(`❌ Error getting hybrid credentials for ${bankType}:`, error.message);
                    throw error;
                }
            } else {
                console.log(`🌍 Using full ENV credentials for ${bankType}`);
                return this.getEnvCredentials(bankType);
            }
        }

        console.log(`🔒 Using encrypted stored credentials for ${bankType}`);
        return this.decryptCredentials(encryptedCredentials);
    }

    // Get hybrid credentials - password from ENV, username/nationalID from database (for Yahav)
    getHybridCredentials(bankType, encryptedCredentials) {
        if (bankType !== 'yahav') {
            throw new Error(`Hybrid credentials only supported for Yahav bank, not ${bankType}`);
        }

        console.log(`🔄 Getting hybrid credentials for ${bankType}...`);

        // Get username and nationalID from encrypted database credentials
        let dbCredentials;
        try {
            dbCredentials = this.decryptCredentials(encryptedCredentials);
            console.log(`📊 DB credentials loaded, fields: ${Object.keys(dbCredentials).join(', ')}`);
        } catch (error) {
            console.error(`❌ Failed to decrypt DB credentials:`, error.message);
            throw new Error('Failed to decrypt database credentials for Yahav. Please check your configuration.');
        }
        
        // Get password from ENV
        const envPassword = process.env.YAHAV_BANK_PASSWORD;
        console.log(`🌍 ENV password loaded: ${envPassword ? 'YES' : 'NO'}`);
        
        // Validate ENV password
        if (!envPassword || envPassword.trim() === '' || envPassword.includes('your_') || envPassword.includes('_here')) {
            throw new Error('Missing or invalid YAHAV_BANK_PASSWORD in ENV. Please update your .env file with actual password.');
        }

        // Validate required DB credentials
        if (!dbCredentials.username || !dbCredentials.nationalID || !dbCredentials.accountNumber) {
            console.error(`❌ Missing required DB credentials. Found: ${Object.keys(dbCredentials).join(', ')}`);
            const missingFields = [];
            if (!dbCredentials.username) missingFields.push('שם משתמש');
            if (!dbCredentials.nationalID) missingFields.push('תעודת זהות');
            if (!dbCredentials.accountNumber) missingFields.push('מספר חשבון');
            
            throw new Error(`חסרים שדות נדרשים בקונפיגורציה: ${missingFields.join(', ')}. אנא ערוך את הקונפיגורציה והוסף את מספר החשבון (${dbCredentials.accountNumber ? 'קיים' : 'חסר'}).`);
        }

        const hybridCredentials = {
            username: dbCredentials.username,
            password: envPassword, // From ENV
            nationalID: dbCredentials.nationalID,
            accountNumber: dbCredentials.accountNumber // From DB for transaction processing
        };

        console.log(`✅ Successfully loaded hybrid credentials for ${bankType}: username(${dbCredentials.username}) + nationalID + password from ENV`);
        return hybridCredentials;
    }

    // Get credentials from environment variables (full ENV mode - kept for other banks if needed)
    getEnvCredentials(bankType) {
        const credentials = {};

        switch (bankType) {
            case 'yahav':
                credentials.username = process.env.YAHAV_BANK_USERNAME;
                credentials.password = process.env.YAHAV_BANK_PASSWORD;
                credentials.nationalID = process.env.YAHAV_BANK_NATIONAL_ID;
                break;
            
            case 'hapoalim':
                credentials.userCode = process.env.HAPOALIM_BANK_USER_CODE;
                credentials.password = process.env.HAPOALIM_BANK_PASSWORD;
                break;
            
            case 'leumi':
                credentials.username = process.env.LEUMI_BANK_USERNAME;
                credentials.password = process.env.LEUMI_BANK_PASSWORD;
                break;
            
            case 'visaCal':
                credentials.username = process.env.VISA_CAL_USERNAME;
                credentials.password = process.env.VISA_CAL_PASSWORD;
                break;
            
            // Add more banks as needed
            default:
                throw new Error(`ENV credentials not configured for bank type: ${bankType}`);
        }

        // Validate that required credentials are present
        const missingCredentials = Object.entries(credentials)
            .filter(([key, value]) => !value || value.trim() === '' || value.includes('your_') || value.includes('_here'))
            .map(([key]) => key);

        if (missingCredentials.length > 0) {
            throw new Error(`Missing or invalid ENV credentials for ${bankType}: ${missingCredentials.join(', ')}. Please update your .env file with actual values.`);
        }

        console.log(`✅ Successfully loaded ENV credentials for ${bankType} with fields: ${Object.keys(credentials).join(', ')}`);
        return credentials;
    }

    // Check if a bank is configured to use ENV credentials
    isBankUsingEnvCredentials(bankType) {
        const envCredentialsEnabled = process.env.BANK_ENV_CREDENTIALS_ENABLED === 'true';
        const allowedBanks = process.env.BANK_ENV_ALLOWED_BANKS ? 
            process.env.BANK_ENV_ALLOWED_BANKS.split(',').map(b => b.trim()) : [];
        
        return envCredentialsEnabled && allowedBanks.includes(bankType);
    }

    // Test ENV credentials configuration (for debugging)
    testEnvCredentials(bankType) {
        try {
            if (!this.isBankUsingEnvCredentials(bankType)) {
                return {
                    success: false,
                    message: `ENV credentials not enabled for ${bankType}`,
                    details: {
                        envEnabled: process.env.BANK_ENV_CREDENTIALS_ENABLED,
                        allowedBanks: process.env.BANK_ENV_ALLOWED_BANKS
                    }
                };
            }

            if (bankType === 'yahav') {
                // Test hybrid mode for Yahav
                const envPassword = process.env.YAHAV_BANK_PASSWORD;
                
                if (!envPassword || envPassword.trim() === '' || envPassword.includes('your_') || envPassword.includes('_here')) {
                    return {
                        success: false,
                        message: 'Missing or invalid YAHAV_BANK_PASSWORD in ENV',
                        error: 'Please update your .env file with actual password'
                    };
                }

                return {
                    success: true,
                    message: `Hybrid mode successfully configured for ${bankType}`,
                    mode: 'hybrid',
                    description: 'Password from ENV, username+nationalID from database',
                    envFields: ['password'],
                    dbFields: ['username', 'nationalID'],
                    details: {
                        envEnabled: process.env.BANK_ENV_CREDENTIALS_ENABLED,
                        allowedBanks: process.env.BANK_ENV_ALLOWED_BANKS
                    }
                };
            } else {
                // Test full ENV mode for other banks
                const credentials = this.getEnvCredentials(bankType);
                return {
                    success: true,
                    message: `Full ENV credentials successfully loaded for ${bankType}`,
                    mode: 'full_env',
                    fields: Object.keys(credentials),
                    details: {
                        envEnabled: process.env.BANK_ENV_CREDENTIALS_ENABLED,
                        allowedBanks: process.env.BANK_ENV_ALLOWED_BANKS
                    }
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message,
                error: error.message
            };
        }
    }

    // Convert bank scraper transactions to main transactions format for approval
    async convertScrapedTransactionsToMainFormat(configId, userId) {
        try {
            console.log(`🔄 Converting scraped transactions from config ${configId} to main format...`);
            
            // Get configuration to extract account number
            const { data: config } = await supabase
                .from('bank_scraper_configs')
                .select('*')
                .eq('id', configId)
                .eq('user_id', userId)
                .single();

            if (!config) {
                throw new Error('Configuration not found');
            }

            let accountNumber;

            // Try to get account number from credentials (may be missing for ENV-only banks like visaCal)
            const credentials = this.getCredentialsForBank(config.bank_type, config.credentials_encrypted);
            accountNumber = credentials && credentials.accountNumber ? credentials.accountNumber : undefined;

            // If not found, fallback to extract from existing stored transactions for this config
            if (!accountNumber) {
                const { data: existingTransactions } = await supabase
                    .from('bank_scraper_transactions')
                    .select('account_number')
                    .eq('config_id', configId)
                    .not('account_number', 'is', null)
                    .limit(1);

                if (existingTransactions && existingTransactions.length > 0) {
                    accountNumber = existingTransactions[0].account_number;
                    console.log(`📋 Using account number from existing transactions: ${accountNumber}`);
                } else {
                    console.log('⚠️ No account number found in credentials or existing transactions. Will use per-transaction account_number if available.');
                }
            }

            // Get scraped transactions - for credit card banks, exclude pending/unauthorized transactions
            // For bank accounts (checking/savings), include all transactions
            const creditCardBanks = ['visaCal', 'max', 'isracard', 'amex'];

            let scrapedTransactions;

            if (creditCardBanks.includes(config.bank_type)) {
                // For credit cards: exclude pending status. The charged_amount filter was too restrictive.
                const result = await supabase
                    .from('bank_scraper_transactions')
                    .select('*')
                    .eq('config_id', configId)
                    .neq('status', 'pending')  // Exclude pending status transactions
                    // .gt('charged_amount', 0)   // Temporarily removed to debug ETL issue where only hidden businesses were being processed
                    .order('transaction_date', { ascending: false });

                if (result.error) throw result.error;
                scrapedTransactions = result.data;
            } else {
                // For bank accounts: get all transactions
                const result = await supabase
                    .from('bank_scraper_transactions')
                    .select('*')
                    .eq('config_id', configId)
                    .order('transaction_date', { ascending: false });

                if (result.error) throw result.error;
                scrapedTransactions = result.data;
            }

            if (!scrapedTransactions || scrapedTransactions.length === 0) {
                return { success: true, transactions: [], message: 'No transactions found to convert' };
            }

            const defaultCategoryCache = new Map();
            const getCachedDefaultCategory = async (name) => {
                if (!name) return null;
                const cacheKey = name.trim().toLowerCase();
                if (defaultCategoryCache.has(cacheKey)) {
                    return defaultCategoryCache.get(cacheKey);
                }
                const category = await SupabaseService.getBusinessCategoryDefault(name, userId);
                defaultCategoryCache.set(cacheKey, category);
                return category;
            };

            // Convert to main transactions format
            const convertedTransactions = await Promise.all(scrapedTransactions.map(async txn => {
                const businessName = this.cleanBusinessName(txn.description);
                const recipientName = this.extractRecipient(businessName);

                const transaction = {
                    user_id: userId,
                    business_name: businessName,
                    payment_date: txn.transaction_date,
                    amount: txn.charged_amount.toString(),
                    currency: txn.original_currency,
                    payment_method: txn.account_number || accountNumber || null, // Prefer per-transaction account number (credit cards)
                    payment_identifier: txn.transaction_identifier,
                    category_name: parseFloat(txn.charged_amount) <= 0 ? 'הוצאות משתנות' : 'הכנסות משתנות', // Auto-assign category based on amount
                    payment_month: new Date(txn.transaction_date).getMonth() + 1,
                    payment_year: new Date(txn.transaction_date).getFullYear(),
                    flow_month: `${new Date(txn.transaction_date).getFullYear()}-${String(new Date(txn.transaction_date).getMonth() + 1).padStart(2, '0')}`,
                    charge_date: txn.processed_date || txn.transaction_date,
                    notes: txn.memo || '',
                    excluded_from_flow: false,
                    source_type: 'bank_scraper',
                    original_amount: txn.original_amount.toString(),
                    transaction_hash: this.generateTransactionHash(txn),
                    is_transfer: false,
                    linked_transaction_id: null,
                    payment_number: txn.installment_number || 1,
                    total_payments: txn.total_installments || 1,
                    original_currency: txn.original_currency,
                    exchange_rate: txn.original_currency !== 'ILS' ? null : null,
                    exchange_date: txn.original_currency !== 'ILS' ? txn.transaction_date : null,
                    business_country: null,
                    quantity: null,
                    source_category: null,
                    transaction_type: txn.transaction_type,
                    execution_method: null,
                    file_source: 'bank_scraper',
                    recipient_name: recipientName,
                    duplicate_parent_id: null,
                    bank_scraper_source_id: txn.id // Reference to original scraped transaction
                };

                let finalBusinessName = transaction.business_name;
                if (recipientName) {
                    finalBusinessName = `העברה ל${recipientName}`;
                    transaction.business_name = finalBusinessName;
                    transaction.is_transfer = true;
                }

                const lookupNames = [];
                if (finalBusinessName) {
                    lookupNames.push(finalBusinessName);
                }
                if (businessName && businessName !== finalBusinessName) {
                    lookupNames.push(businessName);
                }

                for (const name of lookupNames) {
                    const defaultCategory = await getCachedDefaultCategory(name);
                    if (defaultCategory) {
                        transaction.category_name = defaultCategory;
                        break;
                    }
                }

                return transaction;
            }));

            console.log(`✅ Converted ${convertedTransactions.length} transactions from scraper format to main format`);
            
            return {
                success: true,
                transactions: convertedTransactions,
                accountNumber: accountNumber,
                configName: config.config_name,
                bankType: config.bank_type
            };

        } catch (error) {
            console.error('Error converting scraped transactions:', error);
            return { success: false, error: error.message };
        }
    }

    // Clean business name from Hebrew formatting issues and problematic SQL characters
    cleanBusinessName(description) {
        if (!description) return 'עסקה ללא תיאור';
        
        // Remove RTL marks, formatting characters, and SQL-problematic characters
        return description
            .replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u061C]/g, '') // RTL marks
            .replace(/[()[\]{}]/g, '') // Brackets
            .replace(/^[‫]+|[‫]+$/g, '') // Leading/trailing Hebrew punctuation
            .replace(/\//g, ' ') // Replace slashes with spaces
            .replace(/[״""''`]/g, '') // Remove quotes and apostrophes
            .replace(/[';]/g, '') // Remove semicolons and single quotes (SQL injection prevention)
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();
    }

    extractRecipient(description) {
        if (!description || typeof description !== 'string') {
            return null;
        }
        
        const desc = description.trim();
        
        // Pattern for Bit transfers: "העברה בביט ל [name]"
        let recipientMatch = desc.match(/העברה בביט ל(.+)/);
        if (recipientMatch) {
            return recipientMatch[1].trim();
        }

        // Pattern for Paybox transfers: "העברה בפייבוקס ל [name]"
        recipientMatch = desc.match(/העברה בפייבוקס ל(.+)/);
        if (recipientMatch) {
            return recipientMatch[1].trim();
        }

        return null;
    }

    // Generate hash for transaction deduplication
    generateTransactionHash(transaction) {
        const crypto = require('crypto');
        const hashString = `${transaction.transaction_date}_${transaction.charged_amount}_${transaction.description}_${transaction.account_number}`;
        return crypto.createHash('md5').update(hashString).digest('hex');
    }

    normalizeConfigId(configId) {
        if (typeof configId === 'number' && !Number.isNaN(configId)) {
            return configId;
        }

        if (typeof configId === 'string') {
            const numericPattern = /^\d+$/;
            if (numericPattern.test(configId.trim())) {
                const parsed = parseInt(configId.trim(), 10);
                if (!Number.isNaN(parsed)) {
                    return parsed;
                }
            }
            return configId.trim();
        }

        return configId;
    }
}

module.exports = new IsraeliBankScraperService();
