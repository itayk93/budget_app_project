const express = require('express');
const router = express.Router();
const israeliBankScraperService = require('../services/israeliBankScraperService');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Get available bank types
router.get('/bank-types', async (req, res) => {
    try {
        const bankTypes = israeliBankScraperService.getAvailableBankTypes();
        res.json({ success: true, bankTypes });
    } catch (error) {
        console.error('Error getting bank types:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test ENV credentials for a specific bank (debugging endpoint)
router.get('/test-env/:bankType', async (req, res) => {
    try {
        const { bankType } = req.params;
        
        // Debug ENV variables
        console.log('🔍 ENV Debug Info:');
        console.log('  BANK_ENV_CREDENTIALS_ENABLED:', process.env.BANK_ENV_CREDENTIALS_ENABLED);
        console.log('  BANK_ENV_ALLOWED_BANKS:', process.env.BANK_ENV_ALLOWED_BANKS);
        console.log('  YAHAV_BANK_PASSWORD:', process.env.YAHAV_BANK_PASSWORD ? 'SET' : 'NOT SET');
        
        const result = israeliBankScraperService.testEnvCredentials(bankType);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error testing ENV credentials:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new scraper configuration
router.post('/configs', async (req, res) => {
    try {
        const { configName, bankType, credentials } = req.body;
        const userId = req.user.id;

        if (!configName || !bankType || !credentials) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: configName, bankType, credentials' 
            });
        }

        const result = await israeliBankScraperService.createScraperConfig(
            userId, 
            configName, 
            bankType, 
            credentials
        );

        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error creating scraper config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user's scraper configurations
router.get('/configs', async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await israeliBankScraperService.getUserConfigs(userId);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('Error getting user configs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Run scraper for specific configuration
router.post('/configs/:configId(\\d+)/scrape', async (req, res) => {
    try {
        const { configId } = req.params;
        const { startDate, endDate } = req.body;
        const userId = req.user.id;

        const result = await israeliBankScraperService.runScraper(
            parseInt(configId),
            userId,
            startDate,
            endDate
        );

        if (result.success) {
            res.json({
                success: true,
                message: `Scraping completed successfully. Found ${result.transactions} transactions from ${result.accounts} accounts.`,
                data: {
                    accounts: result.accounts,
                    transactions: result.transactions,
                    executionTime: result.executionTime
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error || result.errorMessage,
                errorType: result.errorType
            });
        }
    } catch (error) {
        console.error('Error running scraper:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get scraped transactions for a configuration
router.get('/configs/:configId(\\d+)/transactions', async (req, res) => {
    try {
        const { configId } = req.params;
        const { limit = 100, offset = 0 } = req.query;
        const userId = req.user.id;

        const result = await israeliBankScraperService.getScrapedTransactions(
            parseInt(configId),
            userId,
            parseInt(limit),
            parseInt(offset)
        );

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error getting scraped transactions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get scraping logs for a configuration
router.get('/configs/:configId(\\d+)/logs', async (req, res) => {
    try {
        const { configId } = req.params;
        const { limit = 50 } = req.query;
        const userId = req.user.id;

        const result = await israeliBankScraperService.getScrapingLogs(
            parseInt(configId),
            userId,
            parseInt(limit)
        );

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error getting scraping logs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete configuration
router.delete('/configs/:configId(\\d+)', async (req, res) => {
    try {
        const { configId } = req.params;
        const userId = req.user.id;

        const result = await israeliBankScraperService.deleteConfig(
            parseInt(configId),
            userId
        );

        if (result.success) {
            res.json({ success: true, message: 'Configuration deleted successfully' });
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error deleting config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update configuration
router.put('/configs/:configId(\\d+)', async (req, res) => {
    try {
        const { configId } = req.params;
        const { configName, credentials } = req.body;
        const userId = req.user.id;

        const result = await israeliBankScraperService.updateConfig(
            parseInt(configId),
            userId,
            configName,
            credentials
        );

        if (result.success) {
            res.json({
                success: true,
                message: 'Configuration updated successfully',
                config: result.config
            });
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Toggle configuration active status
router.put('/configs/:configId(\\d+)/toggle', async (req, res) => {
    try {
        const { configId } = req.params;
        const userId = req.user.id;

        const result = await israeliBankScraperService.toggleConfig(
            parseInt(configId),
            userId
        );

        if (result.success) {
            res.json({
                success: true,
                message: `Configuration ${result.isActive ? 'enabled' : 'disabled'} successfully`,
                isActive: result.isActive
            });
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error toggling config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Convert scraped transactions to main transaction format for approval
router.post('/configs/:configId(\\d+)/convert-to-transactions', async (req, res) => {
    try {
        const { configId } = req.params;
        const userId = req.user.id;

        console.log(`🔄 Converting transactions for config ${configId}, user ${userId}`);

        const result = await israeliBankScraperService.convertScrapedTransactionsToMainFormat(
            parseInt(configId),
            userId
        );

        if (result.success) {
            res.json({
                success: true,
                message: `המרנו ${result.transactions.length} עסקאות מ${result.configName} לפורמט אישור העסקאות`,
                data: {
                    transactions: result.transactions,
                    accountNumber: result.accountNumber,
                    configName: result.configName,
                    bankType: result.bankType,
                    count: result.transactions.length
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error converting transactions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pending transactions for approval
router.get('/pending', async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 200 } = req.query;

        const result = await israeliBankScraperService.getPendingTransactions(userId, parseInt(limit));
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error fetching pending transactions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Queue all configurations sequentially into the approval queue
router.post('/configs/bulk/queue-for-approval', async (req, res) => {
    try {
        const userId = req.user.id;
        const includeInactive = req.body?.includeInactive || false;

        const result = await israeliBankScraperService.queueAllConfigsForApproval(
            userId,
            includeInactive
        );

        if (result.success) {
            res.json({
                success: true,
                message: `הוספנו ${result.totals.totalQueued} עסקאות מתוך ${result.totals.configsProcessed} קונפיגורציות.`,
                summary: result.summary,
                totals: result.totals
            });
        } else {
            res.status(result.needsSetup ? 412 : 400).json(result);
        }
    } catch (error) {
        console.error('Error queueing all configs for approval:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Run scraper sequentially for all configurations
router.post('/configs/bulk/scrape', async (req, res) => {
    try {
        const userId = req.user.id;
        const { includeInactive = false, startDate = null, endDate = null } = req.body || {};

        const result = await israeliBankScraperService.runAllScrapers(userId, {
            includeInactive,
            startDate,
            endDate
        });

        if (result.success) {
            res.json({
                success: true,
                message: `השלמנו כריית נתונים עבור ${result.totals.configsProcessed} קונפיגורציות.`,
                summary: result.summary,
                totals: result.totals
            });
        } else {
            res.status(result.needsSetup ? 412 : 400).json(result);
        }
    } catch (error) {
        console.error('Error running scrapers for all configs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Queue converted transactions into a pending-approval table
router.post('/configs/:configId(\\d+)/queue-for-approval', async (req, res) => {
    try {
        const { configId } = req.params;
        const userId = req.user.id;

        const result = await israeliBankScraperService.queueTransactionsForApproval(
            parseInt(configId),
            userId
        );

        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                data: result.data,
                count: result.count
            });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error queueing transactions for approval:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
