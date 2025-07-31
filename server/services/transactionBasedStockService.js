/**
 * Transaction-based stock service
 * מנתח מניות מבוסס על העסקאות הישירות מהדאטה שהועלתה
 */

const { getSupabase } = require('../config/supabase');
const alphaVantageService = require('./alphaVantageService');

class TransactionBasedStockService {
    
    /**
     * מקבל את כל העסקאות מחשבון השקעות ומנתח אותן
     */
    async getInvestmentTransactions(userId, cashFlowId) {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .eq('cash_flow_id', cashFlowId)
                .eq('source_type', 'investment')
                .order('payment_date', { ascending: true });

            if (error) {
                throw new Error(error.message);
            }

            return data || [];
        } catch (error) {
            console.error('Error fetching investment transactions:', error);
            throw error;
        }
    }

    /**
     * מנתח העסקאות ומחזיר החזקות נוכחיות
     */
    analyzeTransactions(transactions) {
        const holdings = new Map();
        const completedTrades = [];
        let totalDeposits = 0;
        let totalFees = 0;
        let totalTaxes = 0;
        let totalDividends = 0;

        // מיון עסקאות לפי תאריך
        const sortedTransactions = [...transactions].sort((a, b) => 
            new Date(a.payment_date) - new Date(b.payment_date)
        );

        sortedTransactions.forEach(transaction => {
            const { transaction_type, business_name, quantity, amount, payment_date, notes } = transaction;
            
            switch (transaction_type) {
                case 'Buy':
                    this.processBuy(holdings, transaction);
                    break;
                case 'Sell':
                    this.processSell(holdings, completedTrades, transaction);
                    break;
                case 'Deposit':
                    totalDeposits += Math.abs(parseFloat(amount));
                    break;
                case 'Dividend':
                    totalDividends += parseFloat(amount);
                    break;
                case 'Fee':
                    totalFees += Math.abs(parseFloat(amount));
                    break;
                case 'Tax Charge':
                    totalTaxes += Math.abs(parseFloat(amount));
                    break;
                case 'Tax Credit':
                    totalTaxes -= parseFloat(amount);
                    break;
            }
        });

        return {
            currentHoldings: Array.from(holdings.values()),
            completedTrades,
            summary: {
                totalDeposits,
                totalFees,
                totalTaxes,
                totalDividends
            }
        };
    }

    processBuy(holdings, transaction) {
        const { business_name, quantity, amount, payment_date, notes } = transaction;
        const price = this.extractPriceFromNotes(notes);
        const qty = parseFloat(quantity);
        const cost = Math.abs(parseFloat(amount));

        if (!holdings.has(business_name)) {
            holdings.set(business_name, {
                symbol: business_name,
                totalQuantity: 0,
                averageCost: 0,
                totalCost: 0,
                transactions: [],
                firstBuyDate: payment_date
            });
        }

        const holding = holdings.get(business_name);
        
        // עדכון ממוצע עלות
        const newTotalCost = holding.totalCost + cost;
        const newTotalQuantity = holding.totalQuantity + qty;
        
        holding.totalCost = newTotalCost;
        holding.totalQuantity = newTotalQuantity;
        holding.averageCost = newTotalCost / newTotalQuantity;
        holding.transactions.push({
            type: 'Buy',
            quantity: qty,
            price: price,
            amount: cost,
            date: payment_date
        });
    }

    processSell(holdings, completedTrades, transaction) {
        const { business_name, quantity, amount, payment_date, notes } = transaction;
        const price = this.extractPriceFromNotes(notes);
        const qty = parseFloat(quantity);
        const proceeds = parseFloat(amount);

        if (!holdings.has(business_name)) {
            console.warn(`מכירה של ${business_name} בלי קנייה קודמת`);
            return;
        }

        const holding = holdings.get(business_name);
        
        // חישוב רווח/הפסד
        const costBasis = holding.averageCost * qty;
        const profitLoss = proceeds - costBasis;

        // עדכון החזקה
        holding.totalQuantity -= qty;
        holding.totalCost -= costBasis;
        holding.transactions.push({
            type: 'Sell',
            quantity: qty,
            price: price,
            amount: proceeds,
            profitLoss: profitLoss,
            date: payment_date
        });

        // אם נמכרה כל הכמות (כולל מקרים של כמות שלילית קטנה) - הוספה לעסקאות מושלמות
        if (Math.abs(holding.totalQuantity) <= 0.001) {
            completedTrades.push({
                symbol: business_name,
                totalInvested: holding.totalCost + costBasis,
                totalReturns: holding.transactions
                    .filter(t => t.type === 'Sell')
                    .reduce((sum, t) => sum + t.amount, 0),
                profitLoss: holding.transactions
                    .filter(t => t.type === 'Sell')
                    .reduce((sum, t) => sum + t.profitLoss, 0),
                firstBuyDate: holding.firstBuyDate,
                lastSellDate: payment_date,
                transactions: [...holding.transactions]
            });
            
            holdings.delete(business_name);
        }
    }

    extractPriceFromNotes(notes) {
        if (!notes) return 0;
        const priceMatch = notes.match(/Price:\s*\$?([\d,]+\.?\d*)/);
        return priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;
    }

    /**
     * מקבל דאטה מלאה לדשבורד המניות
     */
    async getDashboardData(userId, cashFlowId) {
        try {
            // קבלת חשבונות השקעה
            const investmentCashFlows = await this.getInvestmentCashFlows(userId);
            
            if (!investmentCashFlows || investmentCashFlows.length === 0) {
                return {
                    holdings: [],
                    portfolioSummary: this.getEmptyPortfolioSummary(),
                    recentTransactions: [],
                    marketSummary: null,
                    investmentCashFlows: [],
                    selectedCashFlowId: null,
                    message: 'לא נמצאו חשבונות השקעה. אנא צור חשבון השקעה או העלה קובץ Blink.',
                    completedTrades: [],
                    monthlyPerformance: []
                };
            }

            // בחירת חשבון השקעה
            let currentCashFlowId = cashFlowId;
            if (!currentCashFlowId) {
                currentCashFlowId = investmentCashFlows[0].id;
            }

            // קבלת העסקאות
            const transactions = await this.getInvestmentTransactions(userId, currentCashFlowId);
            
            // ניתוח העסקאות
            const analysis = this.analyzeTransactions(transactions);
            
            // עדכון מחירים נוכחיים לחלקות הקיימות
            const holdingsWithCurrentPrices = await this.enrichHoldingsWithCurrentPrices(analysis.currentHoldings);
            
            // חישוב סיכום תיק
            const portfolioSummary = this.calculatePortfolioSummary(holdingsWithCurrentPrices, analysis.summary, analysis.completedTrades);
            
            // עסקאות אחרונות
            const recentTransactions = this.getRecentTransactions(transactions, 10);
            
            // ביצועים חודשיים
            const monthlyPerformance = this.calculateMonthlyPerformance(transactions);

            return {
                holdings: holdingsWithCurrentPrices,
                portfolioSummary,
                recentTransactions,
                marketSummary: await this.getMarketSummary(),
                investmentCashFlows,
                selectedCashFlowId: currentCashFlowId,
                completedTrades: analysis.completedTrades,
                monthlyPerformance
            };

        } catch (error) {
            console.error('Error in getDashboardData:', error);
            throw error;
        }
    }

    async getInvestmentCashFlows(userId) {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('cash_flows')
                .select('*')
                .eq('user_id', userId)
                .eq('is_investment_account', true);

            if (error) {
                throw new Error(error.message);
            }
            
            return data || [];
        } catch (error) {
            console.error('Error fetching investment cash flows:', error);
            throw error;
        }
    }

    async enrichHoldingsWithCurrentPrices(holdings) {
        const enrichedHoldings = [];
        
        // פילטר החזקות עם כמות אפס או שלילית קטנה
        const validHoldings = holdings.filter(holding => Math.abs(holding.totalQuantity) > 0.001);
        
        for (const holding of validHoldings) {
            try {
                // ננסה לקבל מחיר נוכחי, אבל נמשיך גם אם זה נכשל
                let currentPrice = holding.averageCost; // ברירת מחדל
                
                try {
                    const priceData = await alphaVantageService.getCurrentPrice(holding.symbol);
                    if (priceData && priceData.price) {
                        currentPrice = parseFloat(priceData.price);
                    }
                } catch (priceError) {
                    console.warn(`Could not fetch live price for ${holding.symbol}, using average cost`);
                }
                
                const currentValue = holding.totalQuantity * currentPrice;
                const unrealizedPL = currentValue - holding.totalCost;
                const unrealizedPLPercent = holding.totalCost > 0 ? (unrealizedPL / holding.totalCost) * 100 : 0;

                enrichedHoldings.push({
                    stock_symbol: holding.symbol,
                    quantity: holding.totalQuantity,
                    average_cost: holding.averageCost,
                    total_invested: holding.totalCost,
                    current_price: currentPrice,
                    current_value: currentValue,
                    unrealized_pl: unrealizedPL,
                    unrealized_pl_percent: unrealizedPLPercent,
                    first_buy_date: holding.firstBuyDate,
                    last_updated: new Date().toISOString()
                });
            } catch (error) {
                console.warn(`Error processing holding for ${holding.symbol}:`, error.message);
                
                // במקרה של שגיאה, נשתמש במחיר הממוצע
                const currentValue = holding.totalQuantity * holding.averageCost;
                
                enrichedHoldings.push({
                    stock_symbol: holding.symbol,
                    quantity: holding.totalQuantity,
                    average_cost: holding.averageCost,
                    total_invested: holding.totalCost,
                    current_price: holding.averageCost,
                    current_value: currentValue,
                    unrealized_pl: 0,
                    unrealized_pl_percent: 0,
                    first_buy_date: holding.firstBuyDate,
                    last_updated: new Date().toISOString()
                });
            }
        }

        return enrichedHoldings;
    }

    calculatePortfolioSummary(holdings, summary, completedTrades) {
        const totalInvested = holdings.reduce((sum, h) => sum + h.total_invested, 0);
        const totalCurrentValue = holdings.reduce((sum, h) => sum + h.current_value, 0);
        const totalUnrealizedPL = holdings.reduce((sum, h) => sum + h.unrealized_pl, 0);
        
        // חישוב רווח ממומש מעסקאות מושלמות
        const totalRealizedPL = completedTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);
        
        // חישוב סך כל הרווח/הפסד (ממומש + לא ממומש)
        const totalPL = totalUnrealizedPL + totalRealizedPL;
        
        // חישוב אחוז תשואה מכל ההשקעות
        const totalEverInvested = summary.totalDeposits - summary.totalFees - summary.totalTaxes;
        const returnPercentage = totalEverInvested > 0 ? (totalPL / totalEverInvested) * 100 : 0;
        
        // חישוב מזומן פנוי תקין
        const cashBalance = summary.totalDeposits - totalInvested - summary.totalFees - summary.totalTaxes + summary.totalDividends + completedTrades.reduce((sum, trade) => sum + trade.totalReturns, 0) - completedTrades.reduce((sum, trade) => sum + trade.totalInvested, 0);

        return {
            total_invested: totalInvested,
            total_market_value: totalCurrentValue,
            total_gain_loss: totalUnrealizedPL,
            total_realized_pl: totalRealizedPL,
            total_combined_pl: totalPL,
            return_percentage: returnPercentage,
            number_of_holdings: holdings.length,
            cash_balance: cashBalance,
            total_deposits: summary.totalDeposits,
            total_fees: summary.totalFees,
            total_taxes: summary.totalTaxes,
            total_dividends: summary.totalDividends
        };
    }

    getRecentTransactions(transactions, limit = 10) {
        return transactions
            .slice(-limit)
            .reverse()
            .map(t => ({
                ...t,
                display_amount: this.getDisplayAmount(t)
            }));
    }

    getDisplayAmount(transaction) {
        const amount = parseFloat(transaction.amount);
        switch (transaction.transaction_type) {
            case 'Buy':
            case 'Fee':
            case 'Tax Charge':
                return -Math.abs(amount);
            default:
                return amount;
        }
    }

    calculateMonthlyPerformance(transactions) {
        const monthlyData = new Map();
        
        transactions.forEach(transaction => {
            const date = new Date(transaction.payment_date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData.has(monthKey)) {
                monthlyData.set(monthKey, {
                    month: monthKey,
                    deposits: 0,
                    invested: 0,
                    returns: 0,
                    fees: 0,
                    dividends: 0
                });
            }
            
            const monthData = monthlyData.get(monthKey);
            const amount = parseFloat(transaction.amount);
            
            switch (transaction.transaction_type) {
                case 'Deposit':
                    monthData.deposits += Math.abs(amount);
                    break;
                case 'Buy':
                    monthData.invested += Math.abs(amount);
                    break;
                case 'Sell':
                    monthData.returns += amount;
                    break;
                case 'Fee':
                    monthData.fees += Math.abs(amount);
                    break;
                case 'Dividend':
                    monthData.dividends += amount;
                    break;
            }
        });
        
        return Array.from(monthlyData.values()).sort((a, b) => a.month.localeCompare(b.month));
    }

    getEmptyPortfolioSummary() {
        return {
            total_invested: 0,
            total_market_value: 0,
            total_gain_loss: 0,
            return_percentage: 0,
            number_of_holdings: 0,
            cash_balance: 0,
            total_deposits: 0,
            total_fees: 0,
            total_taxes: 0,
            total_dividends: 0
        };
    }

    async getMarketSummary() {
        try {
            return await alphaVantageService.getMarketSummary();
        } catch (error) {
            console.warn('Could not fetch market summary:', error.message);
            return null;
        }
    }
}

const transactionBasedStockService = new TransactionBasedStockService();
module.exports = transactionBasedStockService;