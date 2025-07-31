
/**
 * Alpha Vantage API integration service for stock data
 * Handles fetching real-time and historical stock prices
 */

const axios = require('axios');
const { getSupabase } = require('../config/supabase');

class AlphaVantageService {
    constructor() {
        this.baseUrl = 'https://www.alphavantage.co/query';
        this.apiKey = process.env.ALPHA_VANTAGE_API_KEY;
        
        if (!this.apiKey) {
            console.warn('ALPHA_VANTAGE_API_KEY not found in environment variables');
        }
        
        this.rateLimitDelay = 12000; // 12 seconds between calls (5 calls per minute for free tier)
        this.lastRequestTime = 0;
        
        // Create axios instance with default config
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 30000,
            headers: {
                'User-Agent': 'BudgetApp/1.0',
                'Accept': 'application/json'
            }
        });
    }

    /**
     * Rate limiting to respect Alpha Vantage limits (5 calls per minute for free tier)
     */
    async rateLimit() {
        const currentTime = Date.now();
        const timeSinceLastRequest = currentTime - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.rateLimitDelay) {
            const sleepTime = this.rateLimitDelay - timeSinceLastRequest;
            console.log(`Rate limiting: waiting ${sleepTime}ms before next request`);
            await new Promise(resolve => setTimeout(resolve, sleepTime));
        }
        
        this.lastRequestTime = Date.now();
    }

    /**
     * Make HTTP request with error handling
     * @param {Object} params - Request parameters
     * @returns {Object|null} - API response data or null if failed
     */
    async makeRequest(params) {
        try {
            if (!this.apiKey) {
                throw new Error('Alpha Vantage API key not configured');
            }

            await this.rateLimit();
            
            const response = await this.client.get('', {
                params: {
                    ...params,
                    apikey: this.apiKey
                }
            });
            
            const data = response.data;
            
            // Check for API error messages
            if (data['Error Message']) {
                console.error(`Alpha Vantage API error: ${data['Error Message']}`);
                return null;
            }
            
            if (data['Note']) {
                console.warn(`Alpha Vantage API note: ${data['Note']}`);
                return null;
            }
            
            return data;
            
        } catch (error) {
            console.error(`Alpha Vantage request failed:`, error.message);
            return null;
        }
    }

    // Legacy method for backward compatibility
    async _rateLimit() {
        return this.rateLimit();
    }

    // Legacy method for backward compatibility
    async _makeRequest(params) {
        return this.makeRequest(params);
    }

    /**
     * Get current stock price using Global Quote endpoint
     * @param {string} symbol - Stock symbol (e.g., 'AAPL', 'TSLA')
     * @returns {Object|null} - Current price data
     */
    async getCurrentPrice(symbol) {
        try {
            const params = {
                'function': 'GLOBAL_QUOTE',
                'symbol': symbol
            };
            
            const data = await this.makeRequest(params);
            if (!data || !data['Global Quote']) {
                console.warn(`No data returned for symbol ${symbol}`);
                return null;
            }
            
            const quote = data['Global Quote'];
            if (!quote || Object.keys(quote).length === 0) {
                console.warn(`Empty quote data for symbol ${symbol}`);
                return null;
            }
            
            const currentPrice = parseFloat(quote['05. price'] || 0);
            const previousClose = parseFloat(quote['08. previous close'] || 0);
            const change = parseFloat(quote['09. change'] || 0);
            const changePercent = quote['10. change percent'] ? 
                parseFloat(quote['10. change percent'].replace('%', '')) : 0;
            
            return {
                symbol: symbol,
                price: Number(currentPrice.toFixed(4)),
                previousClose: Number(previousClose.toFixed(4)),
                change: Number(change.toFixed(4)),
                changePercent: Number(changePercent.toFixed(2)),
                volume: parseInt(quote['06. volume'] || 0),
                open: Number(parseFloat(quote['02. open'] || 0).toFixed(4)),
                high: Number(parseFloat(quote['03. high'] || 0).toFixed(4)),
                low: Number(parseFloat(quote['04. low'] || 0).toFixed(4)),
                lastUpdate: new Date().toISOString(),
                source: 'alphavantage'
            };
            
        } catch (error) {
            console.error(`Error fetching current price for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get daily time series data from Alpha Vantage
     * @param {string} symbol - Stock symbol
     * @param {string} outputsize - 'compact' (last 100 days) or 'full' (20+ years)
     * @returns {Array|null} - Array of daily price data
     */
    async getDailyData(symbol, outputsize = 'full') {
        try {
            const params = {
                'function': 'TIME_SERIES_DAILY',
                'symbol': symbol,
                'outputsize': outputsize
            };
            
            const data = await this.makeRequest(params);
            if (!data || !data['Time Series (Daily)']) {
                console.warn(`No daily data returned for symbol ${symbol}`);
                return null;
            }
            
            const timeSeries = data['Time Series (Daily)'];
            
            // Convert to array of objects sorted by date (most recent first)
            const priceData = Object.entries(timeSeries)
                .map(([date, values]) => ({
                    date: date,
                    open: parseFloat(values['1. open']),
                    high: parseFloat(values['2. high']),
                    low: parseFloat(values['3. low']),
                    close: parseFloat(values['4. close']),
                    volume: parseInt(values['5. volume'])
                }))
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            
            return priceData;
            
        } catch (error) {
            console.error(`Error fetching daily data for ${symbol}:`, error);
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
            const data = await this.getDailyData(symbol, 'full');
            if (!data) return null;
            
            // Filter to last year
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            
            const lastYearData = data.filter(item => 
                new Date(item.date) >= oneYearAgo
            );
            
            return lastYearData;
            
        } catch (error) {
            console.error(`Error fetching last year data for ${symbol}:`, error);
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
                source: 'alphavantage'
            }));
            
        } catch (error) {
            console.error(`Error formatting data for database:`, error);
            return [];
        }
    }

    /**
     * Check missing dates for a symbol
     * @param {string} symbol - Stock symbol
     * @param {number} daysBack - Number of days to check (default: 365)
     * @returns {Array} - Array of missing dates
     */
    async checkMissingDates(symbol, daysBack = 365) {
        try {
            const supabase = getSupabase();
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - daysBack);

            // Get existing dates from database
            const { data, error } = await supabase
                .from('stock_prices')
                .select('price_date')
                .eq('stock_symbol', symbol)
                .gte('price_date', startDate.toISOString().split('T')[0])
                .lte('price_date', endDate.toISOString().split('T')[0]);

            if (error) {
                console.error(`Error checking missing dates for ${symbol}:`, error);
                return [];
            }

            // Convert to set of existing dates
            const existingDates = new Set((data || []).map(record => record.price_date));

            // Generate all business days (Monday-Friday) in the range
            const businessDays = [];
            const currentDate = new Date(startDate);
            
            while (currentDate <= endDate) {
                // Skip weekends (0 = Sunday, 6 = Saturday)
                if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    if (!existingDates.has(dateStr)) {
                        businessDays.push(dateStr);
                    }
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            console.log(`Symbol ${symbol}: ${existingDates.size} existing, ${businessDays.length} missing dates`);
            return businessDays;

        } catch (error) {
            console.error(`Error checking missing dates for ${symbol}:`, error);
            return [];
        }
    }

    /**
     * Update symbol data with smart logic (only missing data)
     * @param {string} symbol - Stock symbol
     * @param {boolean} forceFullUpdate - Force full update regardless of existing data
     * @returns {Object} - Update result
     */
    async updateSymbolData(symbol, forceFullUpdate = false) {
        try {
            console.log(`Starting update for symbol: ${symbol}`);

            if (!forceFullUpdate) {
                // Check what dates are missing
                const missingDates = await this.checkMissingDates(symbol);

                if (missingDates.length === 0) {
                    console.log(`Symbol ${symbol} is up to date, skipping API call`);
                    return {
                        symbol: symbol,
                        success: true,
                        records_inserted: 0,
                        message: 'Already up to date',
                        api_call_made: false
                    };
                }

                console.log(`Symbol ${symbol} missing ${missingDates.length} dates, fetching data`);
            } else {
                console.log(`Force update for ${symbol}, fetching full year of data`);
            }

            // Fetch data from Alpha Vantage
            const priceData = await this.getLastYearData(symbol);

            if (!priceData || priceData.length === 0) {
                console.warn(`No data received from Alpha Vantage for ${symbol}`);
                return {
                    symbol: symbol,
                    success: false,
                    error: 'No data from Alpha Vantage',
                    records_inserted: 0,
                    api_call_made: true
                };
            }

            // If not force update, filter to only missing dates
            let dataToInsert = priceData;
            if (!forceFullUpdate) {
                const missingDates = await this.checkMissingDates(symbol);
                const missingDatesSet = new Set(missingDates);
                dataToInsert = priceData.filter(item => missingDatesSet.has(item.date));

                if (dataToInsert.length === 0) {
                    console.log(`No new data in API response for ${symbol}`);
                    return {
                        symbol: symbol,
                        success: true,
                        records_inserted: 0,
                        message: 'No new data in API response',
                        api_call_made: true
                    };
                }
            }

            // Format for database insertion
            const records = this.formatForDatabase(dataToInsert, symbol);

            if (records.length === 0) {
                console.warn(`No valid records to insert for ${symbol}`);
                return {
                    symbol: symbol,
                    success: false,
                    error: 'No valid records formatted',
                    records_inserted: 0,
                    api_call_made: true
                };
            }

            // Insert into database using upsert to handle duplicates
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('stock_prices')
                .upsert(records, { 
                    onConflict: 'stock_symbol,price_date',
                    ignoreDuplicates: false 
                });

            if (error) {
                console.error(`Database insertion failed for ${symbol}:`, error);
                return {
                    symbol: symbol,
                    success: false,
                    error: `Database insertion failed: ${error.message}`,
                    records_inserted: 0,
                    api_call_made: true
                };
            }

            const recordsInserted = data ? data.length : records.length;
            console.log(`Successfully inserted/updated ${recordsInserted} records for ${symbol}`);

            return {
                symbol: symbol,
                success: true,
                records_inserted: recordsInserted,
                message: `Inserted ${recordsInserted} records`,
                api_call_made: true
            };

        } catch (error) {
            console.error(`Error updating ${symbol}:`, error);
            return {
                symbol: symbol,
                success: false,
                error: error.message,
                records_inserted: 0,
                api_call_made: true
            };
        }
    }

    /**
     * Get latest price from database
     * @param {string} symbol - Stock symbol
     * @returns {Object|null} - Latest price data from database
     */
    async getLatestPriceFromDb(symbol) {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('stock_prices')
                .select('*')
                .eq('stock_symbol', symbol)
                .order('price_date', { ascending: false })
                .limit(1);

            if (error) {
                console.error(`Error getting latest price for ${symbol}:`, error);
                // If table doesn't exist, just return null (no prices available)
                if (error.message.includes('relation "stock_prices" does not exist') || error.code === '42P01') {
                    console.log(`stock_prices table doesn't exist, returning null for ${symbol}`);
                }
                return null;
            }

            if (!data || data.length === 0) {
                return null;
            }

            const priceData = data[0];
            return {
                symbol: symbol,
                price: parseFloat(priceData.close_price),
                open: parseFloat(priceData.open_price || 0),
                high: parseFloat(priceData.high_price || 0),
                low: parseFloat(priceData.low_price || 0),
                volume: parseInt(priceData.volume || 0),
                date: priceData.price_date,
                source: priceData.source || 'database'
            };

        } catch (error) {
            console.error(`Error getting latest price for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get current quotes for multiple symbols
     * @param {Array} symbols - Array of stock symbols
     * @returns {Object} - Object mapping symbols to their quote data
     */
    async getMultipleQuotes(symbols) {
        const results = {};
        
        for (const symbol of symbols) {
            console.log(`Fetching quote for ${symbol}`);
            results[symbol] = await this.getCurrentPrice(symbol);
        }
        
        return results;
    }

    /**
     * Get market summary data
     * @returns {Object} - Market summary information
     */
    async getMarketSummary() {
        try {
            // For now, return basic market status
            // In a real implementation, you might fetch major indices
            const now = new Date();
            const hour = now.getHours();
            const day = now.getDay();
            
            // Market is open Mon-Fri 9:30 AM - 4:00 PM EST
            const isMarketOpen = day >= 1 && day <= 5 && hour >= 9 && hour <= 16;
            
            return {
                market_open: isMarketOpen,
                last_update: now.toISOString(),
                indices: {}
            };
            
        } catch (error) {
            console.error('Error getting market summary:', error);
            return {
                market_open: false,
                last_update: null,
                indices: {}
            };
        }
    }

    /**
     * Get historical data for charting
     * @param {string} symbol - Stock symbol
     * @param {string} period - Time period ('1d', '1w', '1m', '3m', '6m', '1y', '2y')
     * @returns {Object|null} - Chart data
     */
    async getHistoricalData(symbol, period = '1y') {
        try {
            const supabase = getSupabase();
            
            // Calculate date range based on period
            const endDate = new Date();
            const startDate = new Date();
            
            switch (period) {
                case '1d':
                    startDate.setDate(startDate.getDate() - 1);
                    break;
                case '1w':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case '1m':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case '3m':
                    startDate.setMonth(startDate.getMonth() - 3);
                    break;
                case '6m':
                    startDate.setMonth(startDate.getMonth() - 6);
                    break;
                case '1y':
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
                case '2y':
                    startDate.setFullYear(startDate.getFullYear() - 2);
                    break;
                default:
                    startDate.setFullYear(startDate.getFullYear() - 1);
            }

            const { data, error } = await supabase
                .from('stock_prices')
                .select('*')
                .eq('stock_symbol', symbol)
                .gte('price_date', startDate.toISOString().split('T')[0])
                .lte('price_date', endDate.toISOString().split('T')[0])
                .order('price_date', { ascending: true });

            if (error) {
                console.error(`Error getting historical data for ${symbol}:`, error);
                return null;
            }

            if (!data || data.length === 0) {
                console.warn(`No historical data found for ${symbol}`);
                return null;
            }

            // Format data for charting
            const chartData = data.map(item => ({
                date: item.price_date,
                open: parseFloat(item.open_price || 0),
                high: parseFloat(item.high_price || 0),
                low: parseFloat(item.low_price || 0),
                close: parseFloat(item.close_price || 0),
                volume: parseInt(item.volume || 0)
            }));

            return {
                symbol: symbol,
                period: period,
                data: chartData,
                metadata: {
                    dataPoints: chartData.length,
                    startDate: chartData[0]?.date,
                    endDate: chartData[chartData.length - 1]?.date
                }
            };

        } catch (error) {
            console.error(`Error getting historical data for ${symbol}:`, error);
            return null;
        }
    }
}

module.exports = new AlphaVantageService();
