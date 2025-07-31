/**
 * Yahoo Finance API integration service for stock data
 * Primary API service with higher rate limits and better reliability
 */

const axios = require('axios');

class YahooFinanceService {
    constructor() {
        // Using Yahoo Finance v2 API (unofficial but reliable)
        this.baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';
        this.quotesUrl = 'https://query1.finance.yahoo.com/v7/finance/quote';
        
        this.rateLimitDelay = 100; // 100ms between calls (much more generous than Alpha Vantage)
        this.lastRequestTime = 0;
        
        // Create axios instance with default config
        this.client = axios.create({
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
    }

    /**
     * Rate limiting for Yahoo Finance (much more generous)
     */
    async rateLimit() {
        const currentTime = Date.now();
        const timeSinceLastRequest = currentTime - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.rateLimitDelay) {
            const sleepTime = this.rateLimitDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, sleepTime));
        }
        
        this.lastRequestTime = Date.now();
    }

    /**
     * Make HTTP request with error handling
     * @param {string} url - Request URL
     * @param {Object} params - Request parameters
     * @returns {Object|null} - API response data or null if failed
     */
    async makeRequest(url, params = {}) {
        try {
            await this.rateLimit();
            
            const response = await this.client.get(url, { params });
            
            if (response.status !== 200) {
                console.error(`Yahoo Finance API error: HTTP ${response.status}`);
                return null;
            }
            
            const data = response.data;
            
            // Check for API error messages
            if (data.chart && data.chart.error) {
                console.error(`Yahoo Finance API error: ${data.chart.error.description}`);
                return null;
            }
            
            return data;
            
        } catch (error) {
            console.error(`Yahoo Finance request failed:`, error.message);
            
            // Check for specific error types that indicate rate limiting or temporary issues
            if (error.response) {
                const status = error.response.status;
                if (status === 429) {
                    console.warn('Yahoo Finance rate limit exceeded');
                } else if (status >= 500) {
                    console.warn('Yahoo Finance server error');
                } else if (status === 404) {
                    console.warn('Yahoo Finance symbol not found');
                }
            } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
                console.warn('Yahoo Finance connection issue');
            }
            
            return null;
        }
    }

    /**
     * Get current stock price using Yahoo Finance quotes API
     * @param {string} symbol - Stock symbol (e.g., 'AAPL', 'TSLA')
     * @returns {Object|null} - Current price data
     */
    async getCurrentPrice(symbol) {
        try {
            console.log(`[YAHOO] Fetching current price for ${symbol}`);
            
            const data = await this.makeRequest(this.quotesUrl, {
                symbols: symbol,
                formatted: false,
                crumb: 'ignore' // Yahoo Finance sometimes requires this
            });
            
            if (!data || !data.quoteResponse || !data.quoteResponse.result || data.quoteResponse.result.length === 0) {
                console.warn(`[YAHOO] No data returned for symbol ${symbol}`);
                return null;
            }
            
            const quote = data.quoteResponse.result[0];
            
            if (!quote || !quote.regularMarketPrice) {
                console.warn(`[YAHOO] Invalid quote data for symbol ${symbol}`);
                return null;
            }
            
            const currentPrice = parseFloat(quote.regularMarketPrice || 0);
            const previousClose = parseFloat(quote.regularMarketPreviousClose || 0);
            const change = parseFloat(quote.regularMarketChange || 0);
            const changePercent = parseFloat(quote.regularMarketChangePercent || 0);
            
            return {
                symbol: symbol,
                price: Number(currentPrice.toFixed(4)),
                previousClose: Number(previousClose.toFixed(4)),
                change: Number(change.toFixed(4)),
                changePercent: Number(changePercent.toFixed(2)),
                volume: parseInt(quote.regularMarketVolume || 0),
                open: Number(parseFloat(quote.regularMarketOpen || 0).toFixed(4)),
                high: Number(parseFloat(quote.regularMarketDayHigh || 0).toFixed(4)),
                low: Number(parseFloat(quote.regularMarketDayLow || 0).toFixed(4)),
                lastUpdate: new Date().toISOString(),
                source: 'yahoo_finance'
            };
            
        } catch (error) {
            console.error(`[YAHOO] Error fetching current price for ${symbol}:`, error.message);
            return null;
        }
    }

    /**
     * Get historical data from Yahoo Finance
     * @param {string} symbol - Stock symbol
     * @param {string} period1 - Start timestamp (Unix)
     * @param {string} period2 - End timestamp (Unix)
     * @param {string} interval - Data interval ('1d', '1wk', '1mo')
     * @returns {Array|null} - Array of historical price data
     */
    async getHistoricalData(symbol, period1 = null, period2 = null, interval = '1d') {
        try {
            console.log(`[YAHOO] Fetching historical data for ${symbol}`);
            
            // Default to last year if no periods specified
            if (!period2) {
                period2 = Math.floor(Date.now() / 1000); // Current time in Unix timestamp
            }
            if (!period1) {
                period1 = period2 - (365 * 24 * 60 * 60); // One year ago
            }
            
            const url = `${this.baseUrl}/${symbol}`;
            const data = await this.makeRequest(url, {
                period1: period1,
                period2: period2,
                interval: interval,
                includePrePost: false,
                events: 'div,splits'
            });
            
            if (!data || !data.chart || !data.chart.result || data.chart.result.length === 0) {
                console.warn(`[YAHOO] No historical data returned for symbol ${symbol}`);
                return null;
            }
            
            const result = data.chart.result[0];
            const timestamps = result.timestamp;
            const indicators = result.indicators.quote[0];
            
            if (!timestamps || !indicators) {
                console.warn(`[YAHOO] Invalid historical data structure for symbol ${symbol}`);
                return null;
            }
            
            // Convert to array of objects
            const priceData = timestamps.map((timestamp, index) => ({
                date: new Date(timestamp * 1000).toISOString().split('T')[0],
                open: indicators.open[index] ? parseFloat(indicators.open[index]) : null,
                high: indicators.high[index] ? parseFloat(indicators.high[index]) : null,
                low: indicators.low[index] ? parseFloat(indicators.low[index]) : null,
                close: indicators.close[index] ? parseFloat(indicators.close[index]) : null,
                volume: indicators.volume[index] ? parseInt(indicators.volume[index]) : null
            })).filter(item => item.close !== null); // Filter out invalid data points
            
            console.log(`[YAHOO] Retrieved ${priceData.length} historical data points for ${symbol}`);
            return priceData;
            
        } catch (error) {
            console.error(`[YAHOO] Error fetching historical data for ${symbol}:`, error.message);
            return null;
        }
    }

    /**
     * Get last year's daily data for a symbol
     * @param {string} symbol - Stock symbol
     * @returns {Array|null} - Array of last year's price data
     */
    async getLastYearData(symbol) {
        try {
            const endTime = Math.floor(Date.now() / 1000);
            const startTime = endTime - (365 * 24 * 60 * 60); // One year ago
            
            return await this.getHistoricalData(symbol, startTime, endTime, '1d');
            
        } catch (error) {
            console.error(`[YAHOO] Error fetching last year data for ${symbol}:`, error.message);
            return null;
        }
    }

    /**
     * Format daily price data for database insertion
     * @param {Array} priceData - Array of price data
     * @param {string} symbol - Stock symbol
     * @returns {Array} - Array of records ready for database insertion
     */
    formatForDatabase(priceData, symbol) {
        try {
            return priceData.map(item => ({
                stock_symbol: symbol,
                price_date: item.date,
                open_price: item.open || null,
                high_price: item.high || null,
                low_price: item.low || null,
                close_price: item.close || null,
                volume: item.volume || null,
                source: 'yahoo_finance'
            }));
            
        } catch (error) {
            console.error(`[YAHOO] Error formatting data for database:`, error.message);
            return [];
        }
    }

    /**
     * Get current quotes for multiple symbols
     * @param {Array} symbols - Array of stock symbols
     * @returns {Object} - Object mapping symbols to their quote data
     */
    async getMultipleQuotes(symbols) {
        try {
            console.log(`[YAHOO] Fetching quotes for ${symbols.length} symbols`);
            
            // Yahoo Finance can handle multiple symbols in one request
            const symbolsString = symbols.join(',');
            const data = await this.makeRequest(this.quotesUrl, {
                symbols: symbolsString,
                formatted: false
            });
            
            if (!data || !data.quoteResponse || !data.quoteResponse.result) {
                console.warn(`[YAHOO] No data returned for symbols: ${symbolsString}`);
                return {};
            }
            
            const results = {};
            for (const quote of data.quoteResponse.result) {
                const symbol = quote.symbol;
                
                if (quote.regularMarketPrice) {
                    const currentPrice = parseFloat(quote.regularMarketPrice || 0);
                    const previousClose = parseFloat(quote.regularMarketPreviousClose || 0);
                    const change = parseFloat(quote.regularMarketChange || 0);
                    const changePercent = parseFloat(quote.regularMarketChangePercent || 0);
                    
                    results[symbol] = {
                        symbol: symbol,
                        price: Number(currentPrice.toFixed(4)),
                        previousClose: Number(previousClose.toFixed(4)),
                        change: Number(change.toFixed(4)),
                        changePercent: Number(changePercent.toFixed(2)),
                        volume: parseInt(quote.regularMarketVolume || 0),
                        open: Number(parseFloat(quote.regularMarketOpen || 0).toFixed(4)),
                        high: Number(parseFloat(quote.regularMarketDayHigh || 0).toFixed(4)),
                        low: Number(parseFloat(quote.regularMarketDayLow || 0).toFixed(4)),
                        lastUpdate: new Date().toISOString(),
                        source: 'yahoo_finance'
                    };
                } else {
                    results[symbol] = null;
                }
            }
            
            console.log(`[YAHOO] Successfully fetched ${Object.keys(results).length} quotes`);
            return results;
            
        } catch (error) {
            console.error(`[YAHOO] Error fetching multiple quotes:`, error.message);
            return {};
        }
    }

    /**
     * Test if Yahoo Finance API is accessible
     * @returns {boolean} - True if API is working
     */
    async testConnection() {
        try {
            console.log('[YAHOO] Testing Yahoo Finance API connection...');
            const testResult = await this.getCurrentPrice('AAPL');
            const isWorking = testResult !== null && testResult.price > 0;
            console.log(`[YAHOO] API test result: ${isWorking ? 'SUCCESS' : 'FAILED'}`);
            return isWorking;
        } catch (error) {
            console.error('[YAHOO] API connection test failed:', error.message);
            return false;
        }
    }
}

module.exports = new YahooFinanceService();