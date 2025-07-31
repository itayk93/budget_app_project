
const express = require('express');
const router = express.Router();
const { authenticateToken: auth } = require('../middleware/auth');
const stockService = require('../services/stockService');
const stockPriceService = require('../services/stockPriceService');
const transactionBasedStockService = require('../services/transactionBasedStockService');
const alphaVantageService = require('../services/alphaVantageService');
const { getSupabase } = require('../config/supabase');

/**
 * @route   GET /api/stocks/dashboard
 * @desc    Get stock portfolio dashboard data
 * @access  Private
 */
router.get('/dashboard', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { cash_flow_id } = req.query;

        console.log(`[STOCKS DASHBOARD] Request for user_id=${userId}, cash_flow_id=${cash_flow_id}`);
        
        // השתמש בשירות החדש המבוסס על עסקאות
        const data = await transactionBasedStockService.getDashboardData(userId, cash_flow_id);
        
        console.log(`[STOCKS DASHBOARD] Returning data:`, JSON.stringify(data, null, 2));
        
        res.json(data);

    } catch (err) {
        console.error('Error in /api/stocks/dashboard:', err.message);
        console.error('Full error stack:', err.stack);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/stocks/holdings
 * @desc    Get user's stock holdings
 * @access  Private
 */
router.get('/holdings', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { cash_flow_id, fetch_live_prices } = req.query;

        const holdings = await stockService.getUserHoldings(
            userId, 
            cash_flow_id, 
            fetch_live_prices === 'true'
        );
        
        res.json({ success: true, holdings });

    } catch (err) {
        console.error('Error in /api/stocks/holdings:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/stocks/portfolio-summary
 * @desc    Get portfolio summary
 * @access  Private
 */
router.get('/portfolio-summary', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { cash_flow_id } = req.query;

        const summary = await stockService.getPortfolioSummary(userId, cash_flow_id);
        res.json({ success: true, summary });

    } catch (err) {
        console.error('Error in /api/stocks/portfolio-summary:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/stocks/transactions
 * @desc    Get stock transactions history
 * @access  Private
 */
router.get('/transactions', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { stock_symbol, cash_flow_id, limit } = req.query;

        console.log('📊 [TRANSACTIONS] Fetching with params:', { userId, stock_symbol, cash_flow_id, limit: limit ? parseInt(limit) : 'no limit' });
        
        const transactions = await stockService.getStockTransactions(
            userId, 
            stock_symbol, 
            cash_flow_id, 
            limit ? parseInt(limit) : null
        );
        
        console.log('📊 [TRANSACTIONS] Found transactions:', transactions?.length || 0);
        console.log('📊 [TRANSACTIONS] Sample transaction:', transactions?.[0]);
        
        res.json({ success: true, transactions });

    } catch (err) {
        console.error('Error in /api/stocks/transactions:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/stocks/recent-transactions
 * @desc    Get recent stock transactions
 * @access  Private
 */
router.get('/recent-transactions', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { cash_flow_id, limit } = req.query;

        const transactions = await stockService.getRecentTransactions(
            userId, 
            cash_flow_id, 
            parseInt(limit) || 5
        );
        
        res.json({ success: true, transactions });

    } catch (err) {
        console.error('Error in /api/stocks/recent-transactions:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/stocks/update-prices
 * @desc    Update stock prices for the user's portfolio
 * @access  Private
 */
router.post('/update-prices', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { cash_flow_id } = req.query;

        const updateResult = await stockService.updateUserPortfolioPrices(userId, cash_flow_id);

        if (!updateResult.success) {
            return res.status(500).json({ 
                ...updateResult,
                message: 'שגיאה בעדכון מחירים' 
            });
        }
        
        res.json(updateResult);

    } catch (err) {
        console.error('Error in /api/stocks/update-prices:', err.message);
        res.status(500).json({ success: false, error: err.message, message: 'שגיאה בעדכון מחירים' });
    }
});

/**
 * @route   POST /api/stocks/migrate-holdings
 * @desc    Migrate holdings from transactions table
 * @access  Private
 */
router.post('/migrate-holdings', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { cash_flow_id } = req.body;

        const result = await stockService.migrateHoldingsFromTransactions(userId, cash_flow_id);
        res.json(result);

    } catch (err) {
        console.error('Error in /api/stocks/migrate-holdings:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/stocks/chart-data/:symbol
 * @desc    Get historical chart data for a stock
 * @access  Private
 */
router.get('/chart-data/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const { period } = req.query;
        const data = await alphaVantageService.getHistoricalData(symbol, period);
        
        if (data) {
            res.json({ success: true, data });
        } else {
            res.status(404).json({ success: false, error: 'No data found for symbol' });
        }
    } catch (err) {
        console.error(`Error in /api/stocks/chart-data/${req.params.symbol}:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/stocks/price/:symbol
 * @desc    Get current price for a stock symbol
 * @access  Private
 */
router.get('/price/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const priceData = await alphaVantageService.getCurrentPrice(symbol.toUpperCase());
        
        if (priceData) {
            res.json({ success: true, data: priceData });
        } else {
            res.status(404).json({ success: false, error: 'Stock not found' });
        }
    } catch (err) {
        console.error(`Error in /api/stocks/price/${req.params.symbol}:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/stocks/alerts
 * @desc    Get user's stock alerts
 * @access  Private
 */
router.get('/alerts', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { active_only } = req.query;

        const alerts = await stockService.getUserStockAlerts(userId, active_only !== 'false');
        res.json({ success: true, alerts });

    } catch (err) {
        console.error('Error in /api/stocks/alerts:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/stocks/alerts
 * @desc    Create a new stock alert
 * @access  Private
 */
router.post('/alerts', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { stock_symbol, alert_type, target_value, notification_method } = req.body;

        if (!stock_symbol || !alert_type || !target_value) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: stock_symbol, alert_type, target_value' 
            });
        }

        const result = await stockService.createStockAlert(
            userId,
            stock_symbol,
            alert_type,
            parseFloat(target_value),
            notification_method || 'browser'
        );

        res.json(result);

    } catch (err) {
        console.error('Error in /api/stocks/alerts (POST):', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/stocks/watchlist
 * @desc    Get user's watchlist
 * @access  Private
 */
router.get('/watchlist', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;

        const watchlist = await stockService.getUserWatchlist(userId);
        res.json({ success: true, watchlist });

    } catch (err) {
        console.error('Error in /api/stocks/watchlist:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/stocks/watchlist
 * @desc    Add stock to watchlist
 * @access  Private
 */
router.post('/watchlist', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { stock_symbol, target_price, notes } = req.body;

        if (!stock_symbol) {
            return res.status(400).json({ 
                success: false, 
                error: 'Stock symbol is required' 
            });
        }

        const result = await stockService.addToWatchlist(
            userId,
            stock_symbol.toUpperCase(),
            target_price ? parseFloat(target_price) : null,
            notes || ''
        );

        res.json(result);

    } catch (err) {
        console.error('Error in /api/stocks/watchlist (POST):', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   DELETE /api/stocks/watchlist/:symbol
 * @desc    Remove stock from watchlist
 * @access  Private
 */
router.delete('/watchlist/:symbol', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { symbol } = req.params;

        const supabase = getSupabase();
        const { error } = await supabase
            .from('watchlist')
            .delete()
            .eq('user_id', userId)
            .eq('stock_symbol', symbol.toUpperCase());

        if (error) {
            return res.status(500).json({ success: false, error: error.message });
        }

        res.json({ success: true, message: `${symbol} removed from watchlist` });

    } catch (err) {
        console.error('Error in /api/stocks/watchlist (DELETE):', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/stocks/update-symbol/:symbol
 * @desc    Update price data for a specific symbol
 * @access  Private
 */
router.post('/update-symbol/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const { force_update } = req.body;

        const result = await alphaVantageService.updateSymbolData(
            symbol.toUpperCase(), 
            force_update === true
        );

        res.json(result);

    } catch (err) {
        console.error(`Error in /api/stocks/update-symbol/${req.params.symbol}:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/stocks/market-summary
 * @desc    Get market summary information
 * @access  Private
 */
router.get('/market-summary', auth, async (req, res) => {
    try {
        const summary = await alphaVantageService.getMarketSummary();
        res.json({ success: true, summary });

    } catch (err) {
        console.error('Error in /api/stocks/market-summary:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/stocks/holdings
 * @desc    Add or update a stock holding
 * @access  Private
 */
router.post('/holdings', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { 
            stock_symbol, 
            quantity, 
            average_cost, 
            total_invested, 
            cash_flow_id 
        } = req.body;

        if (!stock_symbol || !quantity || !average_cost || !cash_flow_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const result = await stockService.upsertStockHolding(
            userId,
            stock_symbol.toUpperCase(),
            parseFloat(quantity),
            parseFloat(average_cost),
            parseFloat(total_invested || quantity * average_cost),
            cash_flow_id
        );

        res.json(result);

    } catch (err) {
        console.error('Error in /api/stocks/holdings (POST):', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/stocks/investment-cash-flows
 * @desc    Get investment cash flows for user
 * @access  Private
 */
router.get('/investment-cash-flows', auth, async (req, res) => {
    try {
        console.log('🔍 [INVESTMENT-CASH-FLOWS] Request received');
        console.log('🔑 Auth header:', req.headers.authorization);
        console.log('👤 User object:', req.user);
        
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'User not authenticated' });
        }
        
        const userId = req.user.user_id || req.user.id;
        console.log('🆔 User ID from user_id:', req.user.user_id);
        console.log('🆔 User ID from id:', req.user.id);
        console.log('🆔 Final User ID:', userId);

        const cashFlows = await stockService.getInvestmentCashFlows(userId);
        console.log('💰 Cash flows found:', cashFlows?.length || 0);
        
        res.json({ success: true, cash_flows: cashFlows });

    } catch (err) {
        console.error('❌ Error in /api/stocks/investment-cash-flows:', err.message);
        console.error('❌ Full error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/stocks/prices-from-db/:symbol
 * @desc    Get latest price from database for a symbol
 * @access  Private
 */
router.get('/prices-from-db/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        const priceData = await alphaVantageService.getLatestPriceFromDb(symbol.toUpperCase());
        
        if (priceData) {
            res.json({ success: true, data: priceData });
        } else {
            res.status(404).json({ success: false, error: 'No price data found' });
        }
    } catch (err) {
        console.error(`Error in /api/stocks/prices-from-db/${req.params.symbol}:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/stocks/refresh-prices
 * @desc    Refresh current prices for multiple symbols
 * @access  Private
 */
router.post('/refresh-prices', auth, async (req, res) => {
    try {
        const { symbols } = req.body;

        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Symbols array is required' 
            });
        }

        const results = await alphaVantageService.getMultipleQuotes(symbols);
        res.json({ success: true, prices: results });

    } catch (err) {
        console.error('Error in /api/stocks/refresh-prices:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/stocks/process-blink
 * @desc    Process uploaded Blink file for stock transactions
 * @access  Private
 */
router.post('/process-blink', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { file_path, cash_flow_id, force_import } = req.body;

        if (!file_path || !cash_flow_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'File path and cash flow ID are required' 
            });
        }

        const blinkProcessor = require('../services/blinkProcessor');
        const result = await blinkProcessor.processAndSaveBlinkFile(
            file_path,
            userId,
            cash_flow_id,
            force_import !== true
        );

        res.json(result);

    } catch (err) {
        console.error('Error in /api/stocks/process-blink:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/stocks/sync-blink-transactions
 * @desc    Sync Blink transactions to create stock holdings
 * @access  Private
 */
router.post('/sync-blink-transactions', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { cash_flow_id } = req.body;

        if (!cash_flow_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cash flow ID is required' 
            });
        }

        // Use the migration function to sync Blink transactions to holdings
        const result = await stockService.migrateHoldingsFromTransactions(userId, cash_flow_id);
        res.json(result);

    } catch (err) {
        console.error('Error in /api/stocks/sync-blink-transactions:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/stocks/update-all-prices
 * @desc    Update historical prices for all user's stocks
 * @access  Private
 */
router.post('/update-all-prices', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        console.log(`[STOCKS UPDATE] Received request to update all stock prices for user_id=${userId}`);

        const result = await stockService.updateAllUserStockPrices(userId);

        console.log(`[STOCKS UPDATE] Finished updating prices for user_id=${userId}. Result:`, result);
        res.json(result);

    } catch (err) {
        console.error('Error in /api/stocks/update-all-prices:', err.message);
        console.error('Full error stack:', err.stack);
        res.status(500).json({ success: false, error: 'Failed to update stock prices', details: err.message });
    }
});

/**
 * @route   GET /api/stocks/current-prices
 * @desc    Get current prices for all stocks from database
 * @access  Private
 */
router.get('/current-prices', auth, async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('stock_prices')
            .select('stock_symbol, close_price')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching current prices:', error);
            return res.status(500).json({ success: false, error: 'Failed to fetch current prices' });
        }

        // Convert to object with symbol as key - get latest price for each symbol
        const prices = {};
        data.forEach(row => {
            if (!prices[row.stock_symbol]) {
                prices[row.stock_symbol] = row.close_price;
            }
        });

        console.log(`[CURRENT_PRICES] Returning ${Object.keys(prices).length} price records`);
        res.json({ success: true, prices });

    } catch (err) {
        console.error('Error in /api/stocks/current-prices:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/stocks/service-status
 * @desc    Check the status of stock price services (Yahoo Finance + Alpha Vantage)
 * @access  Private
 */
router.get('/service-status', auth, async (req, res) => {
    try {
        console.log('[SERVICE_STATUS] Checking stock price services status');
        
        const serviceStatus = await stockPriceService.testServices();
        
        res.json({
            success: true,
            services: serviceStatus,
            message: `Yahoo Finance: ${serviceStatus.yahoo_finance ? 'OK' : 'FAILED'}, Alpha Vantage: ${serviceStatus.alpha_vantage ? 'OK' : 'FAILED'}`
        });
        
    } catch (err) {
        console.error('Error in /api/stocks/service-status:', err.message);
        res.status(500).json({ success: false, error: 'Failed to check service status', details: err.message });
    }
});

/**
 * @route   POST /api/stocks/process-blink-screenshot
 * @desc    Process Blink screenshot using OpenAI GPT-4 Vision
 * @access  Private
 */
router.post('/process-blink-screenshot', auth, async (req, res) => {
    try {
        const multer = require('multer');
        const upload = multer({ storage: multer.memoryStorage() });
        
        // Handle the multipart form data
        upload.single('image')(req, res, async (uploadErr) => {
            if (uploadErr) {
                console.error('Upload error:', uploadErr);
                return res.status(400).json({ success: false, error: 'Failed to upload image' });
            }

            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No image file provided' });
            }

            const { cash_flow_id } = req.body;
            if (!cash_flow_id) {
                return res.status(400).json({ success: false, error: 'Cash flow ID is required' });
            }

            try {
                const userId = req.user.user_id || req.user.id;
                const blinkScreenshotService = require('../services/blinkScreenshotService');
                const result = await blinkScreenshotService.processBlinkScreenshot(req.file.buffer, userId, cash_flow_id);
                
                if (result.success) {
                    res.json({
                        success: true,
                        transactions: result.transactions,
                        duplicates: result.duplicates || [],
                        message: `זוהו ${result.transactions.length} עסקאות בתמונה`
                    });
                } else {
                    res.status(400).json({
                        success: false,
                        error: result.error || 'Failed to process screenshot'
                    });
                }
            } catch (processError) {
                console.error('Screenshot processing error:', processError);
                res.status(500).json({
                    success: false,
                    error: 'Failed to process screenshot: ' + processError.message
                });
            }
        });

    } catch (err) {
        console.error('Error in /api/stocks/process-blink-screenshot:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/stocks/import-blink-transactions
 * @desc    Import confirmed Blink transactions to database
 * @access  Private
 */
router.post('/import-blink-transactions', auth, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.id;
        const { transactions, cash_flow_id } = req.body;

        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No transactions to import' 
            });
        }

        if (!cash_flow_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cash flow ID is required' 
            });
        }

        const blinkScreenshotService = require('../services/blinkScreenshotService');
        const result = await blinkScreenshotService.importTransactions(
            transactions, 
            userId, 
            cash_flow_id
        );

        if (result.success) {
            res.json({
                success: true,
                imported: result.imported,
                duplicates: result.duplicates || 0,
                message: `נשמרו בהצלחה ${result.imported} עסקאות`
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error || 'Failed to import transactions'
            });
        }

    } catch (err) {
        console.error('Error in /api/stocks/import-blink-transactions:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
