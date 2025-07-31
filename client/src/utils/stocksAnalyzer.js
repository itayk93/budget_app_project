// מנתח נתוני מניות וחישוב פוזיציות נוכחיות
export class StocksAnalyzer {
  constructor(transactions) {
    this.transactions = transactions;
    this.currentHoldings = new Map();
    this.completedTrades = [];
    this.totalInvested = 0;
    this.totalDeposits = 0;
    this.totalWithdraws = 0;
    this.totalFees = 0;
    this.totalTaxes = 0;
    this.totalDividends = 0;
    
    this.processTransactions();
  }

  processTransactions() {
    // מיון עסקאות לפי תאריך
    const sortedTransactions = [...this.transactions].sort((a, b) => 
      new Date(a.payment_date) - new Date(b.payment_date)
    );

    sortedTransactions.forEach(transaction => {
      this.processTransaction(transaction);
    });
  }

  processTransaction(transaction) {
    const { transaction_type, business_name, quantity, amount } = transaction;
    
    switch (transaction_type) {
      case 'Buy':
        this.processBuy(transaction);
        break;
      case 'Sell':
        this.processSell(transaction);
        break;
      case 'Deposit':
        this.totalDeposits += Math.abs(parseFloat(amount));
        break;
      case 'Dividend':
        this.totalDividends += parseFloat(amount);
        break;
      case 'Fee':
        this.totalFees += Math.abs(parseFloat(amount));
        break;
      case 'Tax Charge':
        this.totalTaxes += Math.abs(parseFloat(amount));
        break;
      case 'Tax Credit':
        this.totalTaxes -= parseFloat(amount);
        break;
    }
  }

  processBuy(transaction) {
    const { business_name, quantity, amount, payment_date, notes } = transaction;
    const price = this.extractPriceFromNotes(notes);
    const qty = parseFloat(quantity);
    const cost = Math.abs(parseFloat(amount));

    if (!this.currentHoldings.has(business_name)) {
      this.currentHoldings.set(business_name, {
        symbol: business_name,
        totalQuantity: 0,
        averageCost: 0,
        totalCost: 0,
        transactions: [],
        firstBuyDate: payment_date
      });
    }

    const holding = this.currentHoldings.get(business_name);
    
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

    this.totalInvested += cost;
  }

  processSell(transaction) {
    const { business_name, quantity, amount, payment_date, notes } = transaction;
    const price = this.extractPriceFromNotes(notes);
    const qty = parseFloat(quantity);
    const proceeds = parseFloat(amount);

    if (!this.currentHoldings.has(business_name)) {
      console.warn(`מכירה של ${business_name} בלי קנייה קודמת`);
      return;
    }

    const holding = this.currentHoldings.get(business_name);
    
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

    // אם נמכרה כל הכמות - הוספה לעסקאות מושלמות
    if (holding.totalQuantity <= 0.001) { // threshold קטן לטעויות עיגול
      this.completedTrades.push({
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
      
      this.currentHoldings.delete(business_name);
    }
  }

  extractPriceFromNotes(notes) {
    if (!notes) return 0;
    const priceMatch = notes.match(/Price:\s*\$?([\d,]+\.?\d*)/);
    return priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;
  }

  getCurrentHoldings() {
    return Array.from(this.currentHoldings.values()).map(holding => ({
      ...holding,
      currentValue: 0, // יעודכן עם מחירים נוכחיים
      unrealizedPL: 0, // יחושב עם מחירים נוכחיים
      allocation: 0    // יחושב כאחוז מסך התיק
    }));
  }

  getCompletedTrades() {
    return this.completedTrades.map(trade => ({
      ...trade,
      returnPercentage: ((trade.totalReturns - trade.totalInvested) / trade.totalInvested) * 100,
      holdingPeriod: this.calculateHoldingPeriod(trade.firstBuyDate, trade.lastSellDate)
    }));
  }

  calculateHoldingPeriod(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} ימים`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} חודשים`;
    return `${Math.floor(diffDays / 365)} שנים`;
  }

  getPortfolioSummary() {
    const currentHoldings = this.getCurrentHoldings();
    const totalCurrentValue = currentHoldings.reduce((sum, h) => sum + h.totalCost, 0);
    
    return {
      totalDeposits: this.totalDeposits,
      totalInvested: this.totalInvested,
      totalCurrentValue: totalCurrentValue,
      totalRealizedPL: this.completedTrades.reduce((sum, t) => sum + t.profitLoss, 0),
      totalUnrealizedPL: 0, // יחושב עם מחירים נוכחיים
      totalDividends: this.totalDividends,
      totalFees: this.totalFees,
      totalTaxes: this.totalTaxes,
      numberOfHoldings: currentHoldings.length,
      numberOfCompletedTrades: this.completedTrades.length,
      cashBalance: this.totalDeposits - this.totalInvested - this.totalFees - this.totalTaxes + this.totalDividends +
                   this.completedTrades.reduce((sum, t) => sum + t.totalReturns, 0)
    };
  }

  getTransactionHistory() {
    return this.transactions.map(t => ({
      ...t,
      displayAmount: t.transaction_type === 'Buy' || t.transaction_type === 'Fee' || t.transaction_type === 'Tax Charge' 
        ? -Math.abs(parseFloat(t.amount))
        : parseFloat(t.amount)
    })).sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
  }

  getMonthlyPerformance() {
    const monthlyData = new Map();
    
    this.transactions.forEach(transaction => {
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

  getTopPerformers() {
    const completed = this.getCompletedTrades();
    return completed
      .sort((a, b) => b.returnPercentage - a.returnPercentage)
      .slice(0, 5);
  }

  getWorstPerformers() {
    const completed = this.getCompletedTrades();
    return completed
      .sort((a, b) => a.returnPercentage - b.returnPercentage)
      .slice(0, 5);
  }
}

// פונקציה לקבלת נתונים מעודכנים של המניות
export function analyzePortfolio(transactions) {
  return new StocksAnalyzer(transactions);
}