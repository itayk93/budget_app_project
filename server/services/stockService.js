
/**
 * Stock management service - handles stock data operations
 * Port of the Python stock_service.py to Node.js
 */

const { getSupabase } = require('../config/supabase');
const stockPriceService = require('./stockPriceService');

class StockService {

    /**
     * Get investment cash flows for a user
     * @param {string} userId - User ID
     * @returns {Array} - Array of investment cash flows
     */
    async getInvestmentCashFlows(userId) {
        try {
            console.log(`[INVESTMENT CASH FLOWS] Getting investment cash flows for user ${userId}`);
            
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('cash_flows')
                .select('*')
                .eq('user_id', userId)
                .eq('is_investment_account', true);

            if (error) {
                console.error(`[INVESTMENT CASH FLOWS] Error:`, error);
                throw new Error(error.message);
            }
            
            console.log(`[INVESTMENT CASH FLOWS] Found ${data?.length || 0} investment cash flows`);
            return data || [];
            
        } catch (error) {
            console.error(`[INVESTMENT CASH FLOWS] Unexpected error:`, error);
            throw error;
        }
    }

    async getDashboardData(userId, cashFlowId) {
        const investmentCashFlows = await this.getInvestmentCashFlows(userId);

        if (!investmentCashFlows || investmentCashFlows.length === 0) {
            // Return empty data structure instead of needsSetup
            return {
                holdings: [],
                portfolioSummary: {
                    total_invested: 0,
                    total_market_value: 0,
                    total_gain_loss: 0,
                    return_percentage: 0,
                    number_of_holdings: 0
                },
                recentTransactions: [],
                marketSummary: null,
                investmentCashFlows: [],
                selectedCashFlowId: null,
                message: 'לא נמצאו חשבונות השקעה. אנא צור חשבון השקעה או העלה קובץ Blink.'
            };
        }

        let currentCashFlowId = cashFlowId;
        if (!currentCashFlowId) {
            currentCashFlowId = investmentCashFlows[0].id;
        }

        const holdings = await this.getUserHoldings(userId, currentCashFlowId);
        const portfolioSummary = this.calculatePortfolioSummary(holdings);
        const recentTransactions = await this.getRecentTransactions(userId, currentCashFlowId);
        const marketSummary = await stockPriceService.getMarketSummary(); // This will be implemented later

        return { 
            holdings, 
            portfolioSummary, 
            recentTransactions, 
            marketSummary,
            investmentCashFlows,
            selectedCashFlowId: currentCashFlowId,
            needsSetup: false
        };
    }

    /**
     * Get all stock holdings for a user, preferably from the holdings table.
     * If not available, calculate from transactions as a fallback.
     * @param {string} userId - User ID
     * @param {string} cashFlowId - Optional cash flow ID filter
     * @param {boolean} fetchLivePrices - Whether to fetch live prices from Alpha Vantage
     * @returns {Array} - List of holdings with current prices
     */
    async getUserHoldings(userId, cashFlowId = null, fetchLivePrices = false) {
        try {
            console.log(`[HOLDINGS] Starting getUserHoldings for user_id=${userId}, cash_flow_id=${cashFlowId}`);
            
            // First, try to get holdings from the dedicated stock_holdings table
            console.log("[HOLDINGS] Querying stock_holdings table...");
            const supabase = getSupabase();
            let query = supabase
                .from('stock_holdings')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true);

            if (cashFlowId) {
                query = query.eq('cash_flow_id', cashFlowId);
                console.log(`[HOLDINGS] Added cash_flow_id filter: ${cashFlowId}`);
            }

            console.log("[HOLDINGS] Executing query...");
            const { data: holdingsData, error } = await query;
            
            if (error) {
                console.error(`[HOLDINGS] Error querying holdings: ${error.message}`);
                // If table doesn't exist, fall back to transaction calculation
                if (error.message.includes('relation "stock_holdings" does not exist') || error.code === '42P01') {
                    console.log("[HOLDINGS] stock_holdings table doesn't exist, falling back to transaction calculation.");
                    return await this.calculateHoldingsFromTransactions(userId, cashFlowId, fetchLivePrices);
                }
                throw new Error(error.message);
            }

            console.log(`[HOLDINGS] Found ${holdingsData?.length || 0} holdings in stock_holdings table`);

            if (holdingsData && holdingsData.length > 0) {
                console.log("[HOLDINGS] Processing holdings from stock_holdings table...");
                
                // Enrich with current prices
                for (let i = 0; i < holdingsData.length; i++) {
                    const holding = holdingsData[i];
                    console.log(`[HOLDINGS] Processing holding ${i+1}/${holdingsData.length}: ${holding.stock_symbol}`);
                    
                    try {
                        // Get current price from database or live if requested
                        let priceData;
                        if (fetchLivePrices) {
                            console.log(`Getting live price for ${holding.stock_symbol} from unified service`);
                            priceData = await stockPriceService.getCurrentPrice(holding.stock_symbol);
                            if (!priceData) {
                                // Fallback to database
                                priceData = await stockPriceService.getLatestPriceFromDb(holding.stock_symbol);
                            }
                        } else {
                            console.log(`Getting stored price for ${holding.stock_symbol} from database`);
                            priceData = await stockPriceService.getLatestPriceFromDb(holding.stock_symbol);
                        }

                        if (priceData) {
                            holding.current_price = priceData.price;
                            holding.change = 0; // Can be calculated from previous day if needed
                        } else {
                            // Fallback to average cost if no price data
                            holding.current_price = holding.average_cost || 0;
                            holding.change = 0;
                        }

                        holding.change_percent = 0;
                        holding.market_value = parseFloat(holding.quantity) * holding.current_price;
                        holding.unrealized_gain_loss = holding.market_value - parseFloat(holding.total_invested);
                        
                        if (parseFloat(holding.total_invested) > 0) {
                            holding.unrealized_gain_loss_percent = (holding.unrealized_gain_loss / parseFloat(holding.total_invested)) * 100;
                        } else {
                            holding.unrealized_gain_loss_percent = 0;
                        }

                        // Add individual stock comparison data
                        holding.stock_invested = parseFloat(holding.total_invested); // Total invested in this specific stock
                        holding.stock_current_value = holding.market_value; // Current value of this specific stock
                        holding.stock_gain_loss = holding.unrealized_gain_loss; // Gain/loss for this specific stock
                        holding.stock_gain_loss_percent = holding.unrealized_gain_loss_percent; // Percentage for this specific stock
                        
                        console.log(`[HOLDINGS] Processed ${holding.stock_symbol}: price=${holding.current_price}, value=${holding.market_value}`);
                        
                    } catch (priceError) {
                        console.error(`[HOLDINGS] Error processing ${holding.stock_symbol}: ${priceError}`);
                        holding.current_price = 0;
                        holding.market_value = 0;
                        holding.unrealized_gain_loss = 0;
                        holding.unrealized_gain_loss_percent = 0;
                    }
                }

                console.log(`[HOLDINGS] Returning ${holdingsData.length} holdings from stock_holdings table`);
                return holdingsData;
            }

            // Fallback: if no holdings in stock_holdings, calculate from transactions
            console.log("[HOLDINGS] No holdings found in stock_holdings, falling back to transaction calculation.");
            return await this.calculateHoldingsFromTransactions(userId, cashFlowId, fetchLivePrices);
            
        } catch (error) {
            console.error(`[HOLDINGS] ERROR in getUserHoldings: ${error.message}`);
            return [];
        }
    }

    /**
     * Calculate holdings from the transactions table (fallback method)
     * @param {string} userId - User ID
     * @param {string} cashFlowId - Optional cash flow ID filter
     * @param {boolean} fetchLivePrices - Whether to fetch live prices
     * @returns {Array} - List of calculated holdings
     */
    async calculateHoldingsFromTransactions(userId, cashFlowId = null, fetchLivePrices = false) {
        try {
            console.log(`[HOLDINGS] Calculating holdings from transactions for user ${userId}`);
            
            // Get transactions from the transactions table
            const supabase = getSupabase();
            let query = supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId);

            if (cashFlowId) {
                query = query.eq('cash_flow_id', cashFlowId);
            }

            const { data: transactions, error } = await query;
            
            if (error) {
                console.error(`[HOLDINGS] Error getting transactions: ${error.message}`);
                return [];
            }

            // Calculate holdings from transactions
            const stockHoldings = {};

            for (const transaction of transactions) {
                const businessName = transaction.business_name;
                const amount = transaction.amount;
                const quantity = transaction.quantity;

                // Skip deposits, tax charges, and non-stock transactions
                if (businessName === 'הפקדה' || 
                    businessName?.includes('חיוב מס') || 
                    businessName?.startsWith('חיוב') ||
                    this.isNonStockTransaction(businessName) || 
                    !businessName) {
                    continue;
                }

                // Skip dividend transactions (amount is null)
                if (amount === null || amount === undefined) {
                    continue;
                }

                const amountFloat = parseFloat(amount);
                const quantityFloat = quantity ? parseFloat(quantity) : null;

                // Initialize holding if not exists
                if (!stockHoldings[businessName]) {
                    stockHoldings[businessName] = {
                        stock_symbol: businessName,
                        quantity: 0,
                        cash_flow_id: transaction.cash_flow_id,
                        user_id: userId,
                        transactions: [] // Track all transactions for FIFO calculation
                    };
                }

                // Determine actual quantity based on amount sign and available quantity data
                let actualQuantity;
                if (quantityFloat !== null) {
                    // Use the quantity field but apply correct sign based on amount
                    if (amountFloat < 0) { // Negative amount = buy (add to quantity)
                        actualQuantity = Math.abs(quantityFloat);
                        console.log(`[HOLDINGS] ${businessName}: BUY $${Math.abs(amountFloat).toFixed(2)} -> +${actualQuantity} shares`);
                    } else { // Positive amount = sell (subtract from quantity)
                        actualQuantity = -Math.abs(quantityFloat);
                        console.log(`[HOLDINGS] ${businessName}: SELL $${amountFloat.toFixed(2)} -> ${actualQuantity} shares`);
                    }
                } else {
                    // Fallback: estimate quantity from amount (this is not ideal but better than nothing)
                    const estimatedQuantity = Math.abs(amountFloat) / 100; // Rough estimate
                    if (amountFloat < 0) { // Buy
                        actualQuantity = estimatedQuantity;
                        console.warn(`[HOLDINGS] ${businessName}: BUY $${Math.abs(amountFloat).toFixed(2)} -> +${actualQuantity} shares (ESTIMATED)`);
                    } else { // Sell
                        actualQuantity = -estimatedQuantity;
                        console.warn(`[HOLDINGS] ${businessName}: SELL $${amountFloat.toFixed(2)} -> ${actualQuantity} shares (ESTIMATED)`);
                    }
                }

                stockHoldings[businessName].transactions.push({
                    amount: amountFloat,
                    quantity: actualQuantity,
                    date: transaction.created_at || transaction.payment_date
                });

                // Update net quantity based on amount sign
                stockHoldings[businessName].quantity += actualQuantity;
                console.log(`[HOLDINGS] ${businessName}: Running total = ${stockHoldings[businessName].quantity.toFixed(4)} shares`);
            }

            // Convert to list and calculate metrics
            const holdings = [];
            for (const [symbol, holding] of Object.entries(stockHoldings)) {
                console.log(`[HOLDINGS] Final check for ${symbol}: ${holding.quantity.toFixed(4)} shares`);
                
                // Only include if there's a meaningful positive quantity
                console.log(`[HOLDINGS] Checking ${symbol}: quantity=${holding.quantity.toFixed(6)}, including=${holding.quantity > 0.0001}`);
                if (holding.quantity > 0.0001) {
                    // Calculate cost basis for currently held shares using FIFO
                    const costBasis = this.calculateCostBasisForRemainingShares(
                        holding.transactions, 
                        holding.quantity
                    );
                    holding.total_invested = costBasis.totalInvested;
                    holding.average_cost = costBasis.averageCost;

                    // Get current price
                    try {
                        const priceData = await stockPriceService.getLatestPriceFromDb(symbol);
                        
                        if (priceData) {
                            holding.current_price = priceData.price;
                            holding.change = 0; // Can be calculated from previous day if needed
                            holding.change_percent = 0;
                            holding.market_value = holding.quantity * holding.current_price;
                            
                            // Calculate unrealized gain/loss based on market value
                            holding.unrealized_gain_loss = holding.market_value - holding.total_invested;
                            if (holding.total_invested > 0) {
                                holding.unrealized_gain_loss_percent = (holding.unrealized_gain_loss / holding.total_invested) * 100;
                            } else {
                                holding.unrealized_gain_loss_percent = 0;
                            }
                            
                            // Add individual stock comparison data
                            holding.stock_invested = holding.total_invested;
                            holding.stock_current_value = holding.market_value;
                            holding.stock_gain_loss = holding.unrealized_gain_loss;
                            holding.stock_gain_loss_percent = holding.unrealized_gain_loss_percent;
                        } else {
                            // No price data available (using average cost as fallback)
                            holding.current_price = holding.average_cost;
                            holding.change = 0;
                            holding.change_percent = 0;
                            holding.market_value = holding.quantity * holding.current_price;
                            holding.unrealized_gain_loss = holding.market_value - holding.total_invested;
                            if (holding.total_invested > 0) {
                                holding.unrealized_gain_loss_percent = (holding.unrealized_gain_loss / holding.total_invested) * 100;
                            } else {
                                holding.unrealized_gain_loss_percent = 0;
                            }
                            
                            // Add individual stock comparison data
                            holding.stock_invested = holding.total_invested;
                            holding.stock_current_value = holding.market_value;
                            holding.stock_gain_loss = holding.unrealized_gain_loss;
                            holding.stock_gain_loss_percent = holding.unrealized_gain_loss_percent;
                        }
                    } catch (priceError) {
                        console.warn(`Could not get price for ${symbol}: ${priceError.message}`);
                        holding.current_price = 0;
                        holding.change = 0;
                        holding.change_percent = 0;
                        holding.market_value = 0;
                        holding.unrealized_gain_loss = 0;
                        holding.unrealized_gain_loss_percent = 0;
                    }

                    holdings.push(holding);
                }
            }

            return holdings;
            
        } catch (error) {
            console.error(`Error calculating holdings from transactions: ${error.message}`);
            return [];
        }
    }

    /**
     * Check if a business name is NOT a stock symbol
     * @param {string} businessName - Business name to check
     * @returns {boolean} - True if it's not a stock symbol
     */
    isNonStockTransaction(businessName) {
        if (!businessName) return true;
        
        const name = businessName.trim();
        
        // Valid stock symbols are typically 1-5 uppercase letters only
        if (name.length <= 5 && name.replace('.', '').match(/^[A-Z]+$/)) {
            return false; // This is likely a stock symbol
        }
        
        // If it contains spaces, it's probably a business name
        if (name.includes(' ')) {
            return true;
        }
        
        // Known non-stock patterns
        const nonStockPatterns = [
            'AIRALO', 'BOB', 'BUYME', 'GETT', 'MYSTIC', 'NOIR', 'OPENAI', 'OTTO',
            'MCDONALD', 'INTIMISSIMI', 'WOLT', 'UBER', 'REVOLUT', 'PAYPAL',
            'AMAZON', 'NETFLIX', 'SPOTIFY', 'GOOGLE', 'FACEBOOK', 'TWITTER',
            'PAYBOX', 'BIT', 'STARBUCKS', 'MONOPRIX', 'RYANAIR',
            'מקדונלדס', 'קפה', 'פיצה', 'מסעדה', 'ג\'לטריה', 'פלאפל',
            'שווארמה', 'המבורגר', 'נתבג', 'דיוטי פרי', 'גלידה'
        ];
        
        return nonStockPatterns.some(pattern => name.toLowerCase().includes(pattern.toLowerCase()));
    }

    /**
     * Calculate cost basis for remaining shares using FIFO method
     * @param {Array} transactions - List of buy/sell transactions for a stock
     * @param {number} remainingQuantity - Current quantity of shares held
     * @returns {Object} - Object with totalInvested and averageCost for remaining shares only
     */
    calculateCostBasisForRemainingShares(transactions, remainingQuantity) {
        try {
            // Sort transactions by date (oldest first for FIFO)
            const sortedTransactions = transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Track buy lots (FIFO queue)
            const buyLots = []; // Each lot: {quantity: number, pricePerShare: number, remaining: number}
            
            for (const transaction of sortedTransactions) {
                const amount = transaction.amount;
                const quantity = Math.abs(transaction.quantity);
                
                if (amount < 0) {
                    // Buy transaction (negative amount)
                    const pricePerShare = Math.abs(amount) / quantity;
                    buyLots.push({
                        quantity: quantity,
                        pricePerShare: pricePerShare,
                        remaining: quantity
                    });
                    console.log(`[COST_BASIS] Buy: ${quantity} shares at $${pricePerShare.toFixed(2)} each`);
                    
                } else if (amount > 0) {
                    // Sell transaction (positive amount)
                    // Remove shares from oldest lots first (FIFO)
                    let sharesToSell = quantity;
                    console.log(`[COST_BASIS] Sell: ${quantity} shares`);
                    
                    for (const lot of buyLots) {
                        if (sharesToSell <= 0) break;
                        
                        if (lot.remaining > 0) {
                            const soldFromLot = Math.min(lot.remaining, sharesToSell);
                            lot.remaining -= soldFromLot;
                            sharesToSell -= soldFromLot;
                            console.log(`[COST_BASIS] Sold ${soldFromLot} from lot, ${lot.remaining} remaining in lot`);
                        }
                    }
                }
            }
            
            // Calculate total investment for remaining shares
            let totalInvested = 0;
            let sharesAccounted = 0;
            
            for (const lot of buyLots) {
                if (lot.remaining > 0 && sharesAccounted < remainingQuantity) {
                    // Count shares from this lot up to the remaining quantity
                    const sharesToCount = Math.min(lot.remaining, remainingQuantity - sharesAccounted);
                    const costForTheseShares = sharesToCount * lot.pricePerShare;
                    totalInvested += costForTheseShares;
                    sharesAccounted += sharesToCount;
                    
                    console.log(`[COST_BASIS] Counting ${sharesToCount} shares at $${lot.pricePerShare.toFixed(2)} = $${costForTheseShares.toFixed(2)}`);
                    
                    if (sharesAccounted >= remainingQuantity) break;
                }
            }
            
            const averageCost = remainingQuantity > 0 ? totalInvested / remainingQuantity : 0;
            
            console.log(`[COST_BASIS] Final result: ${remainingQuantity} shares, invested=$${totalInvested.toFixed(2)}, avg=$${averageCost.toFixed(2)}`);
            
            return {
                totalInvested: totalInvested,
                averageCost: averageCost
            };
            
        } catch (error) {
            console.error(`[COST_BASIS] Error calculating cost basis: ${error.message}`);
            // Fallback to simple calculation
            return {
                totalInvested: 0,
                averageCost: 0
            };
        }
    }

    /**
     * Get portfolio summary with totals and performance
     * @param {string} userId - User ID
     * @param {string} cashFlowId - Optional cash flow ID filter
     * @returns {Object} - Portfolio summary dictionary
     */
    async getPortfolioSummary(userId, cashFlowId = null) {
        try {
            console.log(`[PORTFOLIO] Starting getPortfolioSummary for user_id=${userId}, cash_flow_id=${cashFlowId}`);
            
            // Get user holdings
            console.log("[PORTFOLIO] Getting user holdings...");
            const holdings = await this.getUserHoldings(userId, cashFlowId);
            console.log(`[PORTFOLIO] Got ${holdings.length} holdings`);
            
            if (!holdings || holdings.length === 0) {
                console.log("[PORTFOLIO] No holdings found, returning empty summary");
                return {
                    total_invested: 0,
                    current_value: 0,
                    total_market_value: 0, // Add alias for template compatibility
                    total_gain_loss: 0,
                    total_gain_loss_percent: 0,
                    return_percentage: 0, // Add alias for template compatibility
                    number_of_holdings: 0,
                    holdings_count: 0,
                    daily_change: 0,
                    daily_change_percent: 0,
                    total_dividends: 0,
                    unrealized_gain_loss: 0,
                    realized_gain_loss: 0
                };
            }
            
            // Calculate summary metrics
            console.log("[PORTFOLIO] Calculating summary metrics...");
            
            // Calculate total deposits to investment account (all הפקדה transactions)
            const totalDeposits = await this.calculateTotalDeposits(userId, cashFlowId);
            console.log(`[PORTFOLIO] Total deposits to account: ${totalDeposits}`);
            
            // Current value from holdings
            const currentValue = holdings.reduce((sum, h) => sum + (h.market_value || 0), 0);
            
            // Gain/loss based on deposits vs current value
            const totalGainLoss = currentValue - totalDeposits;
            const totalGainLossPercent = totalDeposits > 0 ? (totalGainLoss / totalDeposits * 100) : 0;
            
            console.log(`[PORTFOLIO] Summary calculated: invested=${totalDeposits}, value=${currentValue}, gain_loss=${totalGainLoss}`);
            
            return {
                total_invested: totalDeposits,
                current_value: currentValue,
                total_market_value: currentValue, // Add alias for template compatibility
                total_gain_loss: totalGainLoss,
                total_gain_loss_percent: totalGainLossPercent,
                return_percentage: totalGainLossPercent, // Add alias for template compatibility
                number_of_holdings: holdings.length,
                holdings_count: holdings.length,
                daily_change: 0, // No real-time data available
                daily_change_percent: 0, // No real-time data available
                total_dividends: 0, // Could calculate from dividend transactions later
                unrealized_gain_loss: totalGainLoss, // Same as total_gain_loss for now
                realized_gain_loss: 0 // Could calculate from sell transactions later
            };
            
        } catch (error) {
            console.error(`[PORTFOLIO] ERROR in getPortfolioSummary: ${error.message}`);
            return {
                total_invested: 0,
                current_value: 0,
                total_market_value: 0, // Add alias for template compatibility
                total_gain_loss: 0,
                total_gain_loss_percent: 0,
                return_percentage: 0, // Add alias for template compatibility
                number_of_holdings: 0,
                holdings_count: 0,
                daily_change: 0,
                daily_change_percent: 0,
                total_dividends: 0,
                unrealized_gain_loss: 0,
                realized_gain_loss: 0
            };
        }
    }

    /**
     * Calculate total deposits (הפקדה) to investment account
     * @param {string} userId - User ID
     * @param {string} cashFlowId - Cash flow ID
     * @returns {number} - Total deposits amount
     */
    async calculateTotalDeposits(userId, cashFlowId = null) {
        try {
            const supabase = getSupabase();
            let query = supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .eq('business_name', 'הפקדה');
            
            if (cashFlowId) {
                query = query.eq('cash_flow_id', cashFlowId);
            }
            
            const { data: deposits, error } = await query;
            
            if (error) {
                console.error(`[DEPOSITS] Error calculating deposits: ${error.message}`);
                return 0.0;
            }
            
            const totalDeposits = (deposits || []).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);
            console.log(`[DEPOSITS] Found ${deposits?.length || 0} deposits totaling ${totalDeposits}`);
            
            return totalDeposits;
            
        } catch (error) {
            console.error(`[DEPOSITS] Error calculating deposits: ${error.message}`);
            return 0.0;
        }
    }

    /**
     * Calculate portfolio summary from holdings (legacy method for compatibility)
     * @param {Array} holdings - Array of holdings
     * @returns {Object} - Portfolio summary
     */
    calculatePortfolioSummary(holdings) {
        const summary = {
            total_invested: 0,
            total_market_value: 0,
            total_gain_loss: 0,
            return_percentage: 0,
            number_of_holdings: holdings.length,
            daily_change: 0, // To be implemented
            daily_change_percent: 0 // To be implemented
        };

        for (const holding of holdings) {
            summary.total_invested += holding.total_invested || 0;
            summary.total_market_value += holding.market_value || 0;
        }

        summary.total_gain_loss = summary.total_market_value - summary.total_invested;
        summary.return_percentage = summary.total_invested > 0 ? (summary.total_gain_loss / summary.total_invested) * 100 : 0;

        return summary;
    }

    /**
     * Get recent stock transactions for a user
     * @param {string} userId - User ID
     * @param {string} cashFlowId - Optional cash flow ID filter
     * @param {number} limit - Number of transactions to return
     * @returns {Array} - List of recent stock transactions
     */
    async getRecentTransactions(userId, cashFlowId = null, limit = 5) {
        try {
            console.log(`[TRANSACTIONS] Starting getRecentTransactions for user_id=${userId}, cash_flow_id=${cashFlowId}, limit=${limit}`);
            
            const supabase = getSupabase();
            let query = supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('payment_date', { ascending: false });
            
            console.log("[TRANSACTIONS] Built base query");
            
            if (cashFlowId) {
                query = query.eq('cash_flow_id', cashFlowId);
                console.log(`[TRANSACTIONS] Added cash_flow_id filter: ${cashFlowId}`);
            }
            
            // Execute query
            console.log("[TRANSACTIONS] Executing query...");
            const { data: allTransactions, error } = await query;
            
            if (error) {
                console.error(`[TRANSACTIONS] Error getting transactions: ${error.message}`);
                return [];
            }
            
            console.log(`[TRANSACTIONS] Got ${allTransactions?.length || 0} total transactions`);
            
            // Filter stock transactions
            console.log("[TRANSACTIONS] Filtering stock transactions...");
            const stockTransactions = [];
            for (const transaction of allTransactions || []) {
                const businessName = transaction.business_name;
                if (businessName && businessName !== 'הפקדה') {
                    // Convert to stock transaction format
                    const stockTransaction = {
                        id: transaction.id,
                        stock_symbol: businessName,
                        transaction_date: transaction.payment_date,
                        transaction_type: parseFloat(transaction.amount || 0) < 0 ? 'buy' : 'sell',
                        total_amount: Math.abs(parseFloat(transaction.amount || 0)),
                        cash_flow_id: transaction.cash_flow_id,
                        notes: transaction.notes || '',
                        category_name: transaction.category_name || ''
                    };
                    
                    stockTransactions.push(stockTransaction);
                }
            }
            
            console.log(`[TRANSACTIONS] Filtered to ${stockTransactions.length} stock transactions`);
            
            // Apply limit
            const limitedTransactions = limit ? stockTransactions.slice(0, limit) : stockTransactions;
            console.log(`[TRANSACTIONS] Applied limit, returning ${limitedTransactions.length} transactions`);
            
            return limitedTransactions;
            
        } catch (error) {
            console.error(`[TRANSACTIONS] ERROR in getRecentTransactions: ${error.message}`);
            return [];
        }
    }

    /**
     * Get stock transactions history for a user
     * @param {string} userId - User ID
     * @param {string} stockSymbol - Optional stock symbol filter
     * @param {string} cashFlowId - Optional cash flow ID filter
     * @param {number} limit - Number of transactions to return
     * @returns {Array} - List of stock transactions
     */
    async getStockTransactions(userId, stockSymbol = null, cashFlowId = null, limit = null) {
        try {
            console.log(`[TRANSACTIONS] Starting getStockTransactions for user_id=${userId}`);
            
            const supabase = getSupabase();
            let query = supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('payment_date', { ascending: false });
            
            if (cashFlowId) {
                query = query.eq('cash_flow_id', cashFlowId);
            }
            
            const { data: allTransactions, error } = await query;
            
            if (error) {
                console.error(`[TRANSACTIONS] Error getting transactions: ${error.message}`);
                return [];
            }
            
            // Filter stock transactions
            const stockTransactions = [];
            for (const transaction of allTransactions || []) {
                const businessName = transaction.business_name;
                if (businessName && businessName !== 'הפקדה') {
                    // Apply stock symbol filter
                    if (!stockSymbol || businessName === stockSymbol) {
                        const stockTransaction = {
                            id: transaction.id,
                            stock_symbol: businessName,
                            transaction_date: transaction.payment_date,
                            transaction_type: parseFloat(transaction.amount || 0) < 0 ? 'buy' : 'sell',
                            total_amount: Math.abs(parseFloat(transaction.amount || 0)),
                            cash_flow_id: transaction.cash_flow_id,
                            notes: transaction.notes || '',
                            category_name: transaction.category_name || '',
                            quantity: transaction.quantity || null
                        };
                        
                        stockTransactions.push(stockTransaction);
                    }
                }
            }
            
            // Apply limit only if specified
            return limit && limit > 0 ? stockTransactions.slice(0, limit) : stockTransactions;
            
        } catch (error) {
            console.error(`[TRANSACTIONS] ERROR in getStockTransactions: ${error.message}`);
            return [];
        }
    }

    /**
     * Update all stock prices for user's holdings (API endpoint wrapper)
     * @param {string} userId - User ID
     * @returns {Object} - Update result
     */
    async updateAllUserStockPrices(userId) {
        try {
            console.log(`[UPDATE_ALL_PRICES] Starting updateAllUserStockPrices for user_id=${userId}`);
            
            // Get all investment cash flows for this user
            const investmentCashFlows = await this.getInvestmentCashFlows(userId);
            
            if (!investmentCashFlows || investmentCashFlows.length === 0) {
                console.log('[UPDATE_ALL_PRICES] No investment cash flows found');
                return {
                    success: true,
                    message: 'No investment accounts found',
                    total_symbols: 0,
                    updated_symbols: 0,
                    api_calls_made: 0,
                    total_records_inserted: 0,
                    results: []
                };
            }
            
            let totalSymbols = 0;
            let totalUpdated = 0;
            let totalApiCalls = 0;
            let totalRecords = 0;
            const allResults = [];
            
            // Process each cash flow account
            for (const cashFlow of investmentCashFlows) {
                console.log(`[UPDATE_ALL_PRICES] Processing cash flow: ${cashFlow.id}`);
                const result = await this.updateUserPortfolioPrices(userId, cashFlow.id);
                
                totalSymbols += result.total_symbols || 0;
                totalUpdated += result.updated_symbols || 0;
                totalApiCalls += result.api_calls_made || 0;
                totalRecords += result.total_records_inserted || 0;
                allResults.push(...(result.results || []));
            }
            
            console.log(`[UPDATE_ALL_PRICES] Completed for all accounts: ${totalUpdated}/${totalSymbols} symbols updated`);
            
            return {
                success: true,
                message: `Updated prices for ${totalUpdated}/${totalSymbols} symbols across all investment accounts`,
                total_symbols: totalSymbols,
                updated_symbols: totalUpdated,
                api_calls_made: totalApiCalls,
                total_records_inserted: totalRecords,
                results: allResults
            };
            
        } catch (error) {
            console.error(`[UPDATE_ALL_PRICES] ERROR in updateAllUserStockPrices: ${error.message}`);
            return {
                success: false,
                message: `Error updating all stock prices: ${error.message}`,
                total_symbols: 0,
                updated_symbols: 0,
                api_calls_made: 0,
                total_records_inserted: 0,
                results: []
            };
        }
    }

    async updateUserPortfolioPrices(userId, cashFlowId) {
        try {
            console.log(`[UPDATE_PRICES] Starting updateUserPortfolioPrices for user_id=${userId}, cash_flow_id=${cashFlowId}`);
            
            const holdings = await this.getUserHoldings(userId, cashFlowId);
            if (!holdings || holdings.length === 0) {
                console.log('[UPDATE_PRICES] No holdings found for user');
                return {
                    success: true,
                    message: 'No holdings to update',
                    total_symbols: 0,
                    updated_symbols: 0,
                    api_calls_made: 0,
                    total_records_inserted: 0,
                    results: []
                };
            }
            
            const symbols = [...new Set(holdings.map(h => h.stock_symbol))]; // Remove duplicates
            console.log(`[UPDATE_PRICES] Found ${symbols.length} unique symbols: ${symbols.join(', ')}`);
            
            const results = [];
            let apiCallsMade = 0;
            let recordsInserted = 0;

            for (const symbol of symbols) {
                console.log(`[UPDATE_PRICES] Processing symbol ${symbol}...`);
                const result = await stockPriceService.updateSymbolData(symbol);
                results.push(result);
                
                if (result.api_call_made) apiCallsMade++;
                if (result.records_inserted) recordsInserted += result.records_inserted;
                
                console.log(`[UPDATE_PRICES] ${symbol} result: success=${result.success}, records=${result.records_inserted}`);
            }

            const successfulUpdates = results.filter(r => r.success).length;
            console.log(`[UPDATE_PRICES] Completed: ${successfulUpdates}/${symbols.length} symbols updated successfully`);

            return {
                success: true,
                message: `Processed ${symbols.length} symbols, ${successfulUpdates} successful.`,
                total_symbols: symbols.length,
                updated_symbols: successfulUpdates,
                api_calls_made: apiCallsMade,
                total_records_inserted: recordsInserted,
                results: results
            };
            
        } catch (error) {
            console.error(`[UPDATE_PRICES] ERROR in updateUserPortfolioPrices: ${error.message}`);
            return {
                success: false,
                message: `Error updating portfolio prices: ${error.message}`,
                total_symbols: 0,
                updated_symbols: 0,
                api_calls_made: 0,
                total_records_inserted: 0,
                results: []
            };
        }
    }

    /**
     * Add or update user stock holding in holdings table
     * @param {string} userId - User ID
     * @param {string} stockSymbol - Stock symbol
     * @param {number} quantity - Share quantity
     * @param {number} averageCost - Average cost per share
     * @param {number} totalInvested - Total amount invested
     * @param {string} cashFlowId - Cash flow ID
     * @returns {Object} - Operation result
     */
    async upsertStockHolding(userId, stockSymbol, quantity, averageCost, totalInvested, cashFlowId) {
        try {
            console.log(`[UPSERT_HOLDING] Adding/updating holding: ${stockSymbol}, qty=${quantity}, cost=${averageCost}`);
            
            const supabase = getSupabase();
            
            // First check if stock exists in stocks table
            const { data: stockExists } = await supabase
                .from('stocks')
                .select('symbol')
                .eq('symbol', stockSymbol)
                .single();
            
            if (!stockExists) {
                // Add stock to stocks table
                const { error: stockError } = await supabase
                    .from('stocks')
                    .insert([{
                        symbol: stockSymbol,
                        company_name: stockSymbol, // Fallback name
                        is_active: true
                    }]);
                
                if (stockError) {
                    console.error(`[UPSERT_HOLDING] Error adding stock ${stockSymbol}:`, stockError);
                }
            }
            
            // Upsert the holding
            const holdingData = {
                user_id: userId,
                stock_symbol: stockSymbol,
                quantity: quantity,
                average_cost: averageCost,
                total_invested: totalInvested,
                cash_flow_id: cashFlowId,
                last_transaction_date: new Date().toISOString().split('T')[0],
                is_active: quantity > 0.0001 // Mark as inactive if no shares left
            };
            
            const { data, error } = await supabase
                .from('stock_holdings')
                .upsert(holdingData, {
                    onConflict: 'user_id,stock_symbol,cash_flow_id',
                    ignoreDuplicates: false
                });
            
            if (error) {
                console.error(`[UPSERT_HOLDING] Database error:`, error);
                return { success: false, error: error.message };
            }
            
            console.log(`[UPSERT_HOLDING] Successfully updated holding for ${stockSymbol}`);
            return { success: true, data: data };
            
        } catch (error) {
            console.error(`[UPSERT_HOLDING] Error upserting holding:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Migrate/rebuild all holdings from transactions
     * This method recalculates all holdings from scratch based on transaction history
     * @param {string} userId - User ID
     * @param {string} cashFlowId - Optional cash flow ID filter
     * @returns {Object} - Migration result
     */
    async migrateHoldingsFromTransactions(userId, cashFlowId = null) {
        try {
            console.log(`[MIGRATE_HOLDINGS] Starting migration for user_id=${userId}, cash_flow_id=${cashFlowId}`);
            
            // First, calculate holdings from transactions
            const calculatedHoldings = await this.calculateHoldingsFromTransactions(userId, cashFlowId);
            console.log(`[MIGRATE_HOLDINGS] Calculated ${calculatedHoldings.length} holdings from transactions`);
            
            if (calculatedHoldings.length === 0) {
                console.log('[MIGRATE_HOLDINGS] No holdings to migrate');
                return {
                    success: true,
                    message: 'No holdings to migrate',
                    holdings_migrated: 0
                };
            }
            
            const supabase = getSupabase();
            let migrated = 0;
            
            // Delete existing holdings for this user/cash_flow
            let deleteQuery = supabase
                .from('stock_holdings')
                .delete()
                .eq('user_id', userId);
            
            if (cashFlowId) {
                deleteQuery = deleteQuery.eq('cash_flow_id', cashFlowId);
            }
            
            const { error: deleteError } = await deleteQuery;
            if (deleteError) {
                console.error('[MIGRATE_HOLDINGS] Error deleting existing holdings:', deleteError);
            } else {
                console.log('[MIGRATE_HOLDINGS] Cleared existing holdings');
            }
            
            // Insert new holdings
            for (const holding of calculatedHoldings) {
                const result = await this.upsertStockHolding(
                    userId,
                    holding.stock_symbol,
                    holding.quantity,
                    holding.average_cost,
                    holding.total_invested,
                    holding.cash_flow_id
                );
                
                if (result.success) {
                    migrated++;
                    console.log(`[MIGRATE_HOLDINGS] Migrated ${holding.stock_symbol}: ${holding.quantity} shares`);
                } else {
                    console.error(`[MIGRATE_HOLDINGS] Failed to migrate ${holding.stock_symbol}:`, result.error);
                }
            }
            
            console.log(`[MIGRATE_HOLDINGS] Migration completed: ${migrated}/${calculatedHoldings.length} holdings migrated`);
            
            return {
                success: true,
                message: `Successfully migrated ${migrated} holdings`,
                holdings_migrated: migrated,
                total_holdings: calculatedHoldings.length
            };
            
        } catch (error) {
            console.error(`[MIGRATE_HOLDINGS] Error in migration:`, error);
            return {
                success: false,
                error: error.message,
                holdings_migrated: 0
            };
        }
    }

    /**
     * Create or update a stock alert
     * @param {string} userId - User ID
     * @param {string} stockSymbol - Stock symbol
     * @param {string} alertType - Alert type ('price_above', 'price_below', etc.)
     * @param {number} targetValue - Target value for alert
     * @param {string} notificationMethod - Notification method
     * @returns {Object} - Operation result
     */
    async createStockAlert(userId, stockSymbol, alertType, targetValue, notificationMethod = 'browser') {
        try {
            console.log(`[CREATE_ALERT] Creating alert: ${stockSymbol} ${alertType} ${targetValue}`);
            
            const supabase = getSupabase();
            
            const alertData = {
                user_id: userId,
                stock_symbol: stockSymbol,
                alert_type: alertType,
                target_value: targetValue,
                notification_method: notificationMethod,
                is_active: true,
                comparison_operator: alertType.includes('above') ? '>' : '<'
            };
            
            const { data, error } = await supabase
                .from('stock_alerts')
                .insert([alertData]);
            
            if (error) {
                console.error('[CREATE_ALERT] Database error:', error);
                return { success: false, error: error.message };
            }
            
            console.log(`[CREATE_ALERT] Successfully created alert for ${stockSymbol}`);
            return { success: true, data: data };
            
        } catch (error) {
            console.error('[CREATE_ALERT] Error creating alert:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get user's stock alerts
     * @param {string} userId - User ID
     * @param {boolean} activeOnly - Whether to return only active alerts
     * @returns {Array} - List of stock alerts
     */
    async getUserStockAlerts(userId, activeOnly = true) {
        try {
            console.log(`[GET_ALERTS] Getting alerts for user_id=${userId}, active_only=${activeOnly}`);
            
            const supabase = getSupabase();
            let query = supabase
                .from('stock_alerts')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            if (activeOnly) {
                query = query.eq('is_active', true);
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.error('[GET_ALERTS] Error getting alerts:', error);
                return [];
            }
            
            console.log(`[GET_ALERTS] Found ${data?.length || 0} alerts`);
            return data || [];
            
        } catch (error) {
            console.error('[GET_ALERTS] Error getting alerts:', error);
            return [];
        }
    }

    /**
     * Add stock to user's watchlist
     * @param {string} userId - User ID
     * @param {string} stockSymbol - Stock symbol
     * @param {number} targetPrice - Optional target price
     * @param {string} notes - Optional notes
     * @returns {Object} - Operation result
     */
    async addToWatchlist(userId, stockSymbol, targetPrice = null, notes = '') {
        try {
            console.log(`[ADD_WATCHLIST] Adding ${stockSymbol} to watchlist for user ${userId}`);
            
            const supabase = getSupabase();
            
            const watchlistData = {
                user_id: userId,
                stock_symbol: stockSymbol,
                target_price: targetPrice,
                notes: notes
            };
            
            const { data, error } = await supabase
                .from('watchlist')
                .insert([watchlistData]);
            
            if (error) {
                console.error('[ADD_WATCHLIST] Database error:', error);
                return { success: false, error: error.message };
            }
            
            console.log(`[ADD_WATCHLIST] Successfully added ${stockSymbol} to watchlist`);
            return { success: true, data: data };
            
        } catch (error) {
            console.error('[ADD_WATCHLIST] Error adding to watchlist:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get user's watchlist
     * @param {string} userId - User ID
     * @returns {Array} - List of watchlist items with current prices
     */
    async getUserWatchlist(userId) {
        try {
            console.log(`[GET_WATCHLIST] Getting watchlist for user_id=${userId}`);
            
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('watchlist')
                .select('*')
                .eq('user_id', userId)
                .order('added_at', { ascending: false });
            
            if (error) {
                console.error('[GET_WATCHLIST] Error getting watchlist:', error);
                return [];
            }
            
            if (!data || data.length === 0) {
                console.log('[GET_WATCHLIST] No watchlist items found');
                return [];
            }
            
            // Enrich with current prices
            for (const item of data) {
                try {
                    const priceData = await stockPriceService.getLatestPriceFromDb(item.stock_symbol);
                    if (priceData) {
                        item.current_price = priceData.price;
                        item.last_update = priceData.date;
                        
                        // Calculate target price percentage if set
                        if (item.target_price && item.current_price) {
                            const priceDiff = item.target_price - item.current_price;
                            item.price_to_target_percent = (priceDiff / item.current_price) * 100;
                        }
                    }
                } catch (priceError) {
                    console.warn(`[GET_WATCHLIST] Could not get price for ${item.stock_symbol}`);
                    item.current_price = null;
                }
            }
            
            console.log(`[GET_WATCHLIST] Returning ${data.length} watchlist items`);
            return data;
            
        } catch (error) {
            console.error('[GET_WATCHLIST] Error getting watchlist:', error);
            return [];
        }
    }
}

module.exports = new StockService();
