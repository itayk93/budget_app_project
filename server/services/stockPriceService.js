/**
 * Unified Stock Price Service with fallback logic
 * Primary: Yahoo Finance (faster, higher rate limits)
 * Fallback: Alpha Vantage (reliable, lower rate limits)
 */

const yahooFinanceService = require('./yahooFinanceService');
const alphaVantageService = require('./alphaVantageService');
const { adminClient } = require('../config/supabase');

class StockPriceService {
    constructor() {
        this.primaryService = yahooFinanceService;
        this.fallbackService = alphaVantageService;
        this.maxRetries = 2;
    }

    /**
     * Get current stock price with fallback logic
     * @param {string} symbol - Stock symbol
     * @returns {Object|null} - Current price data
     */
    async getCurrentPrice(symbol) {
        try {
            console.log(`[UNIFIED] Getting current price for ${symbol}`);
            
            // Try Yahoo Finance first
            console.log(`[UNIFIED] Trying Yahoo Finance for ${symbol}...`);
            let result = await this.primaryService.getCurrentPrice(symbol);
            
            if (result && result.price > 0) {
                console.log(`[UNIFIED] ✅ Yahoo Finance succeeded for ${symbol}: $${result.price}`);
                return result;
            }
            
            console.log(`[UNIFIED] ⚠️ Yahoo Finance failed for ${symbol}, trying Alpha Vantage...`);
            
            // Fallback to Alpha Vantage
            result = await this.fallbackService.getCurrentPrice(symbol);
            
            if (result && result.price > 0) {
                console.log(`[UNIFIED] ✅ Alpha Vantage succeeded for ${symbol}: $${result.price}`);
                return result;
            }
            
            console.log(`[UNIFIED] ❌ Both services failed for ${symbol}`);
            return null;
            
        } catch (error) {
            console.error(`[UNIFIED] Error getting current price for ${symbol}:`, error.message);
            return null;
        }
    }

    /**
     * Get historical data with fallback logic
     * @param {string} symbol - Stock symbol
     * @returns {Array|null} - Array of historical price data
     */
    async getLastYearData(symbol) {
        try {
            console.log(`[UNIFIED] Getting historical data for ${symbol}`);
            
            // Try Yahoo Finance first
            console.log(`[UNIFIED] Trying Yahoo Finance historical data for ${symbol}...`);
            let result = await this.primaryService.getLastYearData(symbol);
            
            if (result && result.length > 0) {
                console.log(`[UNIFIED] ✅ Yahoo Finance historical data succeeded for ${symbol}: ${result.length} records`);
                return result;
            }
            
            console.log(`[UNIFIED] ⚠️ Yahoo Finance historical data failed for ${symbol}, trying Alpha Vantage...`);
            
            // Fallback to Alpha Vantage
            result = await this.fallbackService.getLastYearData(symbol);
            
            if (result && result.length > 0) {
                console.log(`[UNIFIED] ✅ Alpha Vantage historical data succeeded for ${symbol}: ${result.length} records`);
                return result;
            }
            
            console.log(`[UNIFIED] ❌ Both services failed for historical data of ${symbol}`);
            return null;
            
        } catch (error) {
            console.error(`[UNIFIED] Error getting historical data for ${symbol}:`, error.message);
            return null;
        }
    }

    /**
     * Get current quotes for multiple symbols with intelligent batching
     * @param {Array} symbols - Array of stock symbols
     * @returns {Object} - Object mapping symbols to their quote data
     */
    async getMultipleQuotes(symbols) {
        try {
            console.log(`[UNIFIED] Getting quotes for ${symbols.length} symbols`);
            
            // Try Yahoo Finance first - it supports multiple symbols in one request
            console.log(`[UNIFIED] Trying Yahoo Finance for multiple quotes...`);
            let results = await this.primaryService.getMultipleQuotes(symbols);
            
            // Check which symbols failed
            const failedSymbols = symbols.filter(symbol => !results[symbol] || results[symbol].price <= 0);
            
            if (failedSymbols.length === 0) {
                console.log(`[UNIFIED] ✅ Yahoo Finance succeeded for all ${symbols.length} symbols`);
                return results;
            }
            
            console.log(`[UNIFIED] ⚠️ Yahoo Finance failed for ${failedSymbols.length} symbols, trying Alpha Vantage for failed ones...`);
            
            // Try Alpha Vantage for failed symbols (one by one due to rate limits)
            for (const symbol of failedSymbols) {
                console.log(`[UNIFIED] Trying Alpha Vantage for ${symbol}...`);
                const fallbackResult = await this.fallbackService.getCurrentPrice(symbol);
                
                if (fallbackResult && fallbackResult.price > 0) {
                    results[symbol] = fallbackResult;
                    console.log(`[UNIFIED] ✅ Alpha Vantage succeeded for ${symbol}: $${fallbackResult.price}`);
                } else {
                    console.log(`[UNIFIED] ❌ Alpha Vantage also failed for ${symbol}`);
                    results[symbol] = null;
                }
            }
            
            const successCount = Object.values(results).filter(r => r && r.price > 0).length;
            console.log(`[UNIFIED] Final result: ${successCount}/${symbols.length} symbols successfully retrieved`);
            
            return results;
            
        } catch (error) {
            console.error(`[UNIFIED] Error getting multiple quotes:`, error.message);
            return {};
        }
    }

    /**
     * Update symbol data with smart service selection and fallback
     * @param {string} symbol - Stock symbol
     * @param {boolean} forceFullUpdate - Force full update regardless of existing data
     * @returns {Object} - Update result
     */
    async updateSymbolData(symbol, forceFullUpdate = false) {
        try {
            console.log(`[UNIFIED] Starting update for symbol: ${symbol}`);

            // Check missing dates first (reuse Alpha Vantage logic)
            if (!forceFullUpdate) {
                const missingDates = await this.fallbackService.checkMissingDates(symbol);

                if (missingDates.length === 0) {
                    console.log(`[UNIFIED] Symbol ${symbol} is up to date, skipping API call`);
                    return {
                        symbol: symbol,
                        success: true,
                        records_inserted: 0,
                        message: 'Already up to date',
                        api_call_made: false,
                        service_used: 'none'
                    };
                }

                console.log(`[UNIFIED] Symbol ${symbol} missing ${missingDates.length} dates, fetching data`);
            } else {
                console.log(`[UNIFIED] Force update for ${symbol}, fetching full year of data`);
            }

            // Try to get data from primary service (Yahoo Finance) first
            console.log(`[UNIFIED] Trying Yahoo Finance for ${symbol} data...`);
            let priceData = await this.primaryService.getLastYearData(symbol);
            let serviceUsed = 'yahoo_finance';

            if (!priceData || priceData.length === 0) {
                console.log(`[UNIFIED] Yahoo Finance failed for ${symbol}, trying Alpha Vantage...`);
                priceData = await this.fallbackService.getLastYearData(symbol);
                serviceUsed = 'alpha_vantage';
            }

            if (!priceData || priceData.length === 0) {
                console.warn(`[UNIFIED] Both services failed to get data for ${symbol}`);
                return {
                    symbol: symbol,
                    success: false,
                    error: 'No data from any service',
                    records_inserted: 0,
                    api_call_made: true,
                    service_used: 'none'
                };
            }

            console.log(`[UNIFIED] Got ${priceData.length} records for ${symbol} from ${serviceUsed}`);

            // If not force update, filter to only missing dates
            let dataToInsert = priceData;
            if (!forceFullUpdate) {
                const missingDates = await this.fallbackService.checkMissingDates(symbol);
                const missingDatesSet = new Set(missingDates);
                dataToInsert = priceData.filter(item => missingDatesSet.has(item.date));

                if (dataToInsert.length === 0) {
                    console.log(`[UNIFIED] No new data in API response for ${symbol}`);
                    return {
                        symbol: symbol,
                        success: true,
                        records_inserted: 0,
                        message: 'No new data in API response',
                        api_call_made: true,
                        service_used: serviceUsed
                    };
                }
            }

            // Format for database insertion using the appropriate service formatter
            let records;
            if (serviceUsed === 'yahoo_finance') {
                records = this.primaryService.formatForDatabase(dataToInsert, symbol);
            } else {
                records = this.fallbackService.formatForDatabase(dataToInsert, symbol);
            }

            if (records.length === 0) {
                console.warn(`[UNIFIED] No valid records to insert for ${symbol}`);
                return {
                    symbol: symbol,
                    success: false,
                    error: 'No valid records formatted',
                    records_inserted: 0,
                    api_call_made: true,
                    service_used: serviceUsed
                };
            }

            // Insert into database using upsert to handle duplicates
            // Use admin client for stock prices (global data that bypasses RLS)
            const { data, error } = await adminClient
                .from('stock_prices')
                .upsert(records, { 
                    onConflict: 'stock_symbol,price_date',
                    ignoreDuplicates: false 
                });

            if (error) {
                console.error(`[UNIFIED] Database insertion failed for ${symbol}:`, error);
                return {
                    symbol: symbol,
                    success: false,
                    error: `Database insertion failed: ${error.message}`,
                    records_inserted: 0,
                    api_call_made: true,
                    service_used: serviceUsed
                };
            }

            const recordsInserted = data ? data.length : records.length;
            console.log(`[UNIFIED] ✅ Successfully inserted/updated ${recordsInserted} records for ${symbol} using ${serviceUsed}`);

            return {
                symbol: symbol,
                success: true,
                records_inserted: recordsInserted,
                message: `Inserted ${recordsInserted} records using ${serviceUsed}`,
                api_call_made: true,
                service_used: serviceUsed
            };

        } catch (error) {
            console.error(`[UNIFIED] Error updating ${symbol}:`, error);
            return {
                symbol: symbol,
                success: false,
                error: error.message,
                records_inserted: 0,
                api_call_made: true,
                service_used: 'error'
            };
        }
    }

    /**
     * Get latest price from database (reuse Alpha Vantage method)
     * @param {string} symbol - Stock symbol
     * @returns {Object|null} - Latest price data from database
     */
    async getLatestPriceFromDb(symbol) {
        return await this.fallbackService.getLatestPriceFromDb(symbol);
    }

    /**
     * Test which services are available
     * @returns {Object} - Service availability status
     */
    async testServices() {
        console.log('[UNIFIED] Testing service availability...');
        
        const results = {
            yahoo_finance: false,
            alpha_vantage: false,
            timestamp: new Date().toISOString()
        };

        try {
            // Test Yahoo Finance
            console.log('[UNIFIED] Testing Yahoo Finance...');
            results.yahoo_finance = await this.primaryService.testConnection();
        } catch (error) {
            console.error('[UNIFIED] Yahoo Finance test failed:', error.message);
        }

        try {
            // Test Alpha Vantage
            console.log('[UNIFIED] Testing Alpha Vantage...');
            const testResult = await this.fallbackService.getCurrentPrice('AAPL');
            results.alpha_vantage = testResult !== null && testResult.price > 0;
        } catch (error) {
            console.error('[UNIFIED] Alpha Vantage test failed:', error.message);
        }

        console.log(`[UNIFIED] Service availability: Yahoo=${results.yahoo_finance}, Alpha Vantage=${results.alpha_vantage}`);
        return results;
    }

    /**
     * Get historical data for charting (reuse Alpha Vantage method)
     * @param {string} symbol - Stock symbol
     * @param {string} period - Time period
     * @returns {Object|null} - Chart data
     */
    async getHistoricalData(symbol, period = '1y') {
        return await this.fallbackService.getHistoricalData(symbol, period);
    }

    /**
     * Get market summary (reuse Alpha Vantage method)
     * @returns {Object} - Market summary information
     */
    async getMarketSummary() {
        return await this.fallbackService.getMarketSummary();
    }
}

module.exports = new StockPriceService();