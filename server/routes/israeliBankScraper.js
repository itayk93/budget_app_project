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
router.post('/configs/:configId/scrape', async (req, res) => {
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
router.get('/configs/:configId/transactions', async (req, res) => {
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
router.get('/configs/:configId/logs', async (req, res) => {
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
router.delete('/configs/:configId', async (req, res) => {
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

// Toggle configuration active status
router.put('/configs/:configId/toggle', async (req, res) => {
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

module.exports = router;