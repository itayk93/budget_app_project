export class ForeignCurrencyService {
  constructor() {
    this.isModalOpen = false;
    this.selectedTransaction = null;
    this.targetCashFlowId = '';
    this.foreignCurrency = '';
    this.foreignAmount = '';
    this.exchangeRate = '';
  }

  formatAmount(amount, currency = 'ILS') {
    const currencySymbols = {
      'ILS': '₪',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'CHF': 'CHF',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr'
    };
    
    const symbol = currencySymbols[currency] || currency;
    return `${symbol} ${Math.abs(amount).toFixed(2)}`;
  }

  detectForeignCurrency(businessName) {
    if (!businessName) return null;
    
    const currencies = {
      'USD': ['USD', 'DOLLAR', 'דולר'],
      'EUR': ['EUR', 'EURO', 'יורו', 'אירו'],
      'GBP': ['GBP', 'POUND', 'פאונד'],
      'CHF': ['CHF', 'FRANC', 'פרנק'],
      'JPY': ['JPY', 'YEN', 'ין יפני'],
      'CAD': ['CAD', 'קנדי'],
      'AUD': ['AUD', 'אוסטרלי'],
      'SEK': ['SEK', 'קרונה'],
      'NOK': ['NOK', 'נורבגי'],
      'DKK': ['DKK', 'דני']
    };
    
    const upperName = businessName.toUpperCase();
    
    for (const [currency, keywords] of Object.entries(currencies)) {
      for (const keyword of keywords) {
        if (upperName.includes(keyword.toUpperCase())) {
          return currency;
        }
      }
    }
    
    return null;
  }

  openForeignCopyModal(transaction, cashFlows, cashFlowId) {
    const detectedCurrency = this.detectForeignCurrency(transaction.business_name);
    console.log('🔄 [FOREIGN COPY] Detected currency:', detectedCurrency);
    console.log('🔄 [FOREIGN COPY] Available cash flows:', cashFlows);
    console.log('🔄 [FOREIGN COPY] Current cash flow ID:', cashFlowId);
    
    this.selectedTransaction = transaction;
    this.foreignCurrency = detectedCurrency || 'USD';
    this.foreignAmount = '';
    this.exchangeRate = '';
    this.targetCashFlowId = '';
    this.isModalOpen = true;
  }

  handleForeignAmountChange(value, onExchangeRateChange) {
    this.foreignAmount = value;
    if (value && this.selectedTransaction) {
      const originalAmount = Math.abs(parseFloat(this.selectedTransaction.amount));
      const foreignAmountNum = parseFloat(value);
      
      if (foreignAmountNum > 0) {
        const rate = originalAmount / foreignAmountNum;
        this.exchangeRate = rate.toFixed(4);
        onExchangeRateChange && onExchangeRateChange(this.exchangeRate);
      }
    }
  }

  createForeignCopyTransaction(cashFlows, selectedSourceCashFlowId) {
    if (!this.selectedTransaction || !this.targetCashFlowId || !this.foreignAmount || !this.exchangeRate) {
      throw new Error('אנא מלא את כל השדות הנדרשים');
    }

    console.log('🔄 [FOREIGN COPY] Creating new transaction for target cash flow');
    
    // Find the target cash flow to get its details
    const targetCashFlow = cashFlows.find(cf => cf.id === this.targetCashFlowId);
    if (!targetCashFlow) {
      throw new Error('שגיאה: לא נמצא תזרים יעד');
    }

    // Create a new transaction based on the original one but for the target cash flow
    const newTransaction = {
      tempId: `foreign_copy_${Date.now()}`,
      user_id: this.selectedTransaction.user_id,
      business_name: this.selectedTransaction.business_name,
      payment_date: this.selectedTransaction.payment_date,
      amount: parseFloat(this.foreignAmount), // Positive amount for income
      currency: this.foreignCurrency,
      payment_method: this.selectedTransaction.payment_method,
      category_name: 'הכנסות משתנות',
      notes: `העתקה מעסקת מטבע זר - שער חליפין: 1 ${this.foreignCurrency} = ${this.exchangeRate} ₪ - העתקה מתזרים ${cashFlows.find(cf => cf.id === selectedSourceCashFlowId)?.name || 'לא ידוע'}`,
      recipient_name: '',
      cash_flow_id: this.targetCashFlowId,
      is_income: true
    };

    console.log('✅ [FOREIGN COPY] Added new transaction:', newTransaction);
    
    return {
      transaction: newTransaction,
      message: `✅ נוספה עסקה חדשה לתזרים "${targetCashFlow.name}" עבור ${this.foreignAmount} ${this.foreignCurrency}\nהעסקה תיווסף לרשימת העסקאות לאישור.`
    };
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedTransaction = null;
    this.targetCashFlowId = '';
    this.foreignCurrency = '';
    this.foreignAmount = '';
    this.exchangeRate = '';
  }

  getModalState() {
    return {
      isOpen: this.isModalOpen,
      selectedTransaction: this.selectedTransaction,
      targetCashFlowId: this.targetCashFlowId,
      foreignCurrency: this.foreignCurrency,
      foreignAmount: this.foreignAmount,
      exchangeRate: this.exchangeRate
    };
  }

  setTargetCashFlowId(id) {
    this.targetCashFlowId = id;
  }

  setForeignCurrency(currency) {
    console.log('🔄 [FOREIGN COPY] Currency changed to:', currency);
    this.foreignCurrency = currency;
    this.targetCashFlowId = ''; // Reset target flow when currency changes
  }

  setExchangeRate(rate) {
    this.exchangeRate = rate;
  }

  getFilteredCashFlows(cashFlows, selectedSourceCashFlowId) {
    const filteredFlows = cashFlows?.filter(cf => 
      cf.id !== selectedSourceCashFlowId && 
      cf.currency === this.foreignCurrency
    ) || [];
    console.log('🔄 [FOREIGN COPY] Filtered flows for currency', this.foreignCurrency, ':', filteredFlows);
    return filteredFlows;
  }
}

const foreignCurrencyServiceInstance = new ForeignCurrencyService();
export default foreignCurrencyServiceInstance;