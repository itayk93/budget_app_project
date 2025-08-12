const XLSX = require('xlsx');
const SupabaseService = require('./supabaseService');
const BankYahavService = require('./bankYahavService');

class ExcelService {
  // ===== FILE PROCESSING =====
  
  static async processExcelFile(filePath, userId, cashFlowId, options = {}) {
    try {
      console.log('📄 Processing Excel file:', filePath);
      
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (!jsonData || jsonData.length === 0) {
        throw new Error('File is empty or could not be read');
      }
      
      console.log(`📊 Found ${jsonData.length} rows in Excel file`);
      
      // Detect file format based on headers
      const headers = jsonData[0] || [];
      const fileFormat = this.detectFileFormat(headers);
      
      console.log('🔍 Detected file format:', fileFormat);
      
      // Process based on detected format
      let transactions = [];
      switch (fileFormat) {
        case 'bank_yahav':
          // Use the dedicated Bank Yahav service for multi-step processing
          return await BankYahavService.processYahavFile(filePath, userId, cashFlowId, options);
        case 'isracard':
          transactions = await this.processIsracardData(jsonData, userId, cashFlowId);
          break;
        case 'max_credit':
          transactions = await this.processMaxCreditData(jsonData, userId, cashFlowId);
          break;
        case 'leumi':
          transactions = await this.processLeumiData(jsonData, userId, cashFlowId);
          break;
        case 'hapoalim':
          transactions = await this.processHapoalimData(jsonData, userId, cashFlowId);
          break;
        case 'budgetlens':
          transactions = await this.processBudgetLensData(jsonData, userId, cashFlowId);
          break;
        default:
          transactions = await this.processGenericData(jsonData, userId, cashFlowId);
      }
      
      console.log(`✅ Processed ${transactions.length} transactions`);
      
      // Import transactions with duplicate detection
      const results = await this.importTransactions(transactions, options.forceImport || false);
      
      return {
        success: true,
        fileFormat,
        totalRows: jsonData.length - 1, // Excluding header
        processedTransactions: transactions.length,
        importResults: results
      };
      
    } catch (error) {
      console.error('❌ Error processing Excel file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  static detectFileFormat(headers) {
    const headerString = headers.join('|').toLowerCase();
    
    console.log('🔍 [DETECT] File headers:', headers);
    console.log('🔍 [DETECT] Header string for detection:', headerString);
    
    // Bank Yahav detection - check for specific Hebrew headers
    if (headerString.includes('תאריך') && headerString.includes('אסמכתא') && 
        (headerString.includes('תיאור פעולה') || headerString.includes('שם הפעולה'))) {
      console.log('✅ [DETECT] Detected as: bank_yahav');
      return 'bank_yahav';
    }
    
    // Max credit card detection - includes both תאריך עסקה and תאריך חיוב columns
    // Check this BEFORE isracard because Max files also contain עסקה and סכום
    if (headerString.includes('תאריך עסקה') && headerString.includes('תאריך חיוב') && 
        headerString.includes('שם בית העסק') && headerString.includes('סוג עסקה')) {
      console.log('✅ [DETECT] Detected as: max_credit');
      return 'max_credit';
    }

    // Israeli bank detection patterns
    if (headerString.includes('עסקה') && headerString.includes('סכום') && headerString.includes('תאריך עסקה')) {
      console.log('✅ [DETECT] Detected as: isracard');
      return 'isracard';
    }
    
    if (headerString.includes('תאריך') && headerString.includes('תיאור') && headerString.includes('זכות')) {
      return 'leumi';
    }
    
    if (headerString.includes('תאריך ביצוע') && headerString.includes('פירוט נוסף')) {
      return 'hapoalim';
    }
    
    // BudgetLens export format - check for Hebrew headers
    if (headerString.includes('שם העסק') && headerString.includes('תאריך התשלום') && headerString.includes('סכום')) {
      return 'budgetlens';
    }
    
    // BudgetLens export format - check for English headers
    if (headerString.includes('business_name') && headerString.includes('payment_date') && headerString.includes('amount')) {
      return 'budgetlens';
    }
    
    console.log('✅ [DETECT] Detected as: generic (fallback)');
    return 'generic';
  }
  
  // ===== BANK-SPECIFIC PROCESSORS =====
  
  static async processIsracardData(jsonData, userId, cashFlowId) {
    const transactions = [];
    const headers = jsonData[0];
    
    // Find column indexes
    const businessNameCol = this.findColumnIndex(headers, ['תיאור עסקה', 'עסקה']);
    const paymentDateCol = this.findColumnIndex(headers, ['תאריך עסקה', 'תאריך']);
    const chargeDateCol = this.findColumnIndex(headers, ['תאריך חיוב']);
    const amountCol = this.findColumnIndex(headers, ['סכום', 'סכום עסקה']);
    const currencyCol = this.findColumnIndex(headers, ['מטבע', 'מט"ח']);
    const paymentMethodCol = this.findColumnIndex(headers, ['אמצעי תשלום']);
    
    // Process data rows
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      if (!row || row.length === 0) continue;
      
      try {
        const businessName = this.cleanString(row[businessNameCol]);
        const amount = this.parseAmount(row[amountCol]);
        const paymentDate = this.parseDate(row[paymentDateCol]);
        
        if (!businessName || amount === null || amount === undefined || !paymentDate) {
          console.log(`⚠️ Skipping row ${i}: missing required data`);
          continue;
        }
        
        const transaction = {
          user_id: userId,
          cash_flow_id: cashFlowId,
          business_name: businessName,
          amount: -Math.abs(amount), // Isracard expenses are negative
          payment_date: paymentDate,
          charge_date: this.parseDate(row[chargeDateCol]),
          currency: this.cleanString(row[currencyCol]) || 'ILS',
          payment_method: this.cleanString(row[paymentMethodCol]) || 'Credit Card',
          source_type: 'isracard_import'
        };
        
        // Apply auto-categorization
        const autoCategory = await SupabaseService.getAutoCategoryForBusiness(businessName, transaction.amount, 'isracard');
        transaction.category_name = autoCategory || 'הוצאות משתנות';
        
        // Generate transaction hash
        transaction.transaction_hash = SupabaseService.generateTransactionHash(transaction);
        
        transactions.push(transaction);
      } catch (error) {
        console.log(`⚠️ Error processing row ${i}:`, error.message);
      }
    }
    
    return transactions;
  }

  static async processMaxCreditData(jsonData, userId, cashFlowId) {
    const transactions = [];
    const headers = jsonData[0];
    
    console.log('🔍 [MAX] Processing Max credit card data with headers:', headers);
    
    // Find column indexes for Max format
    const businessNameCol = this.findColumnIndex(headers, ['שם בית העסק']);
    const transactionDateCol = this.findColumnIndex(headers, ['תאריך עסקה']);
    const chargeDateCol = this.findColumnIndex(headers, ['תאריך חיוב']);
    const amountCol = this.findColumnIndex(headers, ['סכום חיוב']);
    const currencyCol = this.findColumnIndex(headers, ['מטבע חיוב']);
    const categoryCol = this.findColumnIndex(headers, ['קטגוריה']);
    const transactionTypeCol = this.findColumnIndex(headers, ['סוג עסקה']);
    const cardCol = this.findColumnIndex(headers, ['4 ספרות אחרונות של כרטיס האשראי']);
    const notesCol = this.findColumnIndex(headers, ['הערות']);
    
    console.log('🔍 [MAX] Column mapping:', {
      businessNameCol, transactionDateCol, chargeDateCol, amountCol, 
      currencyCol, categoryCol, transactionTypeCol
    });
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      if (!row || row.length === 0) continue;
      
      try {
        const businessName = this.cleanString(row[businessNameCol]);
        const amount = this.parseAmount(row[amountCol]);
        const transactionDate = this.parseDate(row[transactionDateCol]);
        const chargeDate = this.parseDate(row[chargeDateCol]);
        const transactionType = this.cleanString(row[transactionTypeCol]);
        
        if (!businessName || amount === null || amount === undefined || !transactionDate || !chargeDate) {
          console.log(`⚠️ [MAX] Skipping row ${i}: missing required data`);
          continue;
        }
        
        // Apply Max-specific logic for installment payment date correction
        let finalPaymentDate = transactionDate;
        
        // Check if this is an installment payment
        if (transactionType && transactionType.includes('תשלומים')) {
          // Calculate the flow month from charge date (one month back)
          const chargeDateObj = new Date(chargeDate);
          const flowMonth = new Date(chargeDateObj.getFullYear(), chargeDateObj.getMonth() - 1, 1);
          
          console.log(`💳 [MAX] Installment detected for ${businessName}:`);
          console.log(`   Original transaction date: ${transactionDate}`);
          console.log(`   Charge date: ${chargeDate}`);
          console.log(`   Flow month: ${flowMonth.getFullYear()}-${(flowMonth.getMonth() + 1).toString().padStart(2, '0')}`);
          
          // If transaction date is not in the same month as flow month, adjust it
          const transactionDateObj = new Date(transactionDate);
          const transactionMonth = transactionDateObj.getMonth();
          const transactionYear = transactionDateObj.getFullYear();
          
          if (transactionYear !== flowMonth.getFullYear() || transactionMonth !== flowMonth.getMonth()) {
            // Keep the same day, but change to flow month
            const adjustedDate = new Date(flowMonth.getFullYear(), flowMonth.getMonth(), transactionDateObj.getDate());
            finalPaymentDate = adjustedDate.toISOString().split('T')[0];
            
            console.log(`   ✅ Adjusted payment date: ${finalPaymentDate}`);
          } else {
            console.log(`   ✅ Transaction date already in correct month, no adjustment needed`);
          }
        }
        
        const transaction = {
          user_id: userId,
          cash_flow_id: cashFlowId,
          business_name: businessName,
          amount: -Math.abs(amount), // Max expenses are negative
          payment_date: finalPaymentDate,
          charge_date: chargeDate,
          currency: this.cleanString(row[currencyCol]) || 'ILS',
          payment_method: `Max Credit Card ****${this.cleanString(row[cardCol]) || 'XXXX'}`,
          source_type: 'max_credit_import',
          category_name: this.cleanString(row[categoryCol]) || null,
          notes: this.cleanString(row[notesCol]) || null,
          transaction_type: transactionType
        };
        
        // Apply auto-categorization if no category provided
        if (!transaction.category_name) {
          const autoCategory = await SupabaseService.getAutoCategoryForBusiness(businessName, transaction.amount, 'max_credit');
          transaction.category_name = autoCategory || 'הוצאות משתנות';
        }
        
        // Generate transaction hash
        transaction.transaction_hash = SupabaseService.generateTransactionHash(transaction);
        
        transactions.push(transaction);
        
      } catch (error) {
        console.log(`⚠️ [MAX] Error processing row ${i}:`, error.message);
      }
    }
    
    console.log(`✅ [MAX] Processed ${transactions.length} Max credit card transactions`);
    return transactions;
  }
  
  static async processLeumiData(jsonData, userId, cashFlowId) {
    const transactions = [];
    const headers = jsonData[0];
    
    // Find column indexes for Leumi format
    const dateCol = this.findColumnIndex(headers, ['תאריך']);
    const descriptionCol = this.findColumnIndex(headers, ['תיאור', 'פירוט']);
    const debitCol = this.findColumnIndex(headers, ['חובה']);
    const creditCol = this.findColumnIndex(headers, ['זכות']);
    const balanceCol = this.findColumnIndex(headers, ['יתרה']);
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      if (!row || row.length === 0) continue;
      
      try {
        const businessName = this.cleanString(row[descriptionCol]);
        const paymentDate = this.parseDate(row[dateCol]);
        
        // Amount can be in either debit or credit column
        let amount = this.parseAmount(row[debitCol]) || this.parseAmount(row[creditCol]);
        
        if (!businessName || amount === null || amount === undefined || !paymentDate) {
          continue;
        }
        
        // Credit amounts should be positive, debit negative
        if (row[debitCol] && this.parseAmount(row[debitCol])) {
          amount = -Math.abs(amount);
        } else if (row[creditCol] && this.parseAmount(row[creditCol])) {
          amount = Math.abs(amount);
        }
        
        const transaction = {
          user_id: userId,
          cash_flow_id: cashFlowId,
          business_name: businessName,
          amount: amount,
          payment_date: paymentDate,
          currency: 'ILS',
          payment_method: 'Bank Transfer',
          source_type: 'leumi_import'
        };
        
        // Apply auto-categorization
        const autoCategory = await SupabaseService.getAutoCategoryForBusiness(businessName, transaction.amount, 'leumi');
        transaction.category_name = autoCategory || 'הוצאות משתנות';
        
        transaction.transaction_hash = SupabaseService.generateTransactionHash(transaction);
        transactions.push(transaction);
      } catch (error) {
        console.log(`⚠️ Error processing Leumi row ${i}:`, error.message);
      }
    }
    
    return transactions;
  }
  
  static async processHapoalimData(jsonData, userId, cashFlowId) {
    const transactions = [];
    const headers = jsonData[0];
    
    // Bank Hapoalim specific columns
    const dateCol = this.findColumnIndex(headers, ['תאריך ביצוע']);
    const descriptionCol = this.findColumnIndex(headers, ['פירוט נוסף', 'תיאור']);
    const amountCol = this.findColumnIndex(headers, ['סכום']);
    const typeCol = this.findColumnIndex(headers, ['זכות/חובה']);
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      if (!row || row.length === 0) continue;
      
      try {
        const businessName = this.cleanString(row[descriptionCol]);
        const paymentDate = this.parseDate(row[dateCol]);
        let amount = this.parseAmount(row[amountCol]);
        const transactionType = this.cleanString(row[typeCol]);
        
        if (!businessName || amount === null || amount === undefined || !paymentDate) {
          continue;
        }
        
        // Adjust amount sign based on transaction type
        if (transactionType && transactionType.includes('חובה')) {
          amount = -Math.abs(amount);
        } else {
          amount = Math.abs(amount);
        }
        
        const transaction = {
          user_id: userId,
          cash_flow_id: cashFlowId,
          business_name: businessName,
          amount: amount,
          payment_date: paymentDate,
          currency: 'ILS',
          payment_method: 'Bank Transfer',
          source_type: 'hapoalim_import'
        };
        
        // Apply auto-categorization
        const autoCategory = await SupabaseService.getAutoCategoryForBusiness(businessName, transaction.amount, 'hapoalim');
        transaction.category_name = autoCategory || 'הוצאות משתנות';
        
        transaction.transaction_hash = SupabaseService.generateTransactionHash(transaction);
        transactions.push(transaction);
      } catch (error) {
        console.log(`⚠️ Error processing Hapoalim row ${i}:`, error.message);
      }
    }
    
    return transactions;
  }
  
  static async processBudgetLensData(jsonData, userId, cashFlowId) {
    const transactions = [];
    const headers = jsonData[0];
    
    console.log('🔍 [BudgetLens] Processing BudgetLens data with headers:', headers);
    
    // BudgetLens export format - map both Hebrew and English column names
    const colMap = {};
    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase();
      colMap[headerLower] = index;
      
      // Map Hebrew headers
      if (header === 'שם העסק') colMap['business_name'] = index;
      if (header === 'סכום') colMap['amount'] = index;
      if (header === 'תאריך התשלום') colMap['payment_date'] = index;
      if (header === 'תאריך החיוב בחשבון') colMap['charge_date'] = index;
      if (header === 'מטבע חיוב') colMap['currency'] = index;
      if (header === 'אמצעי התשלום') colMap['payment_method'] = index;
      if (header === 'אמצעי זיהוי התשלום') colMap['payment_identifier'] = index;
      if (header === 'קטגוריה בתזרים') colMap['category_name'] = index;
      if (header === 'הערות') colMap['notes'] = index;
      if (header === 'שייך לתזרים חודש') colMap['flow_month'] = index;
    });
    
    console.log('🔍 [BudgetLens] Column mapping:', colMap);
    console.log('🔍 [BudgetLens] flow_month column index:', colMap['flow_month']);
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      if (!row || row.length === 0) continue;
      
      try {
        const transaction = {
          user_id: userId,
          cash_flow_id: cashFlowId,
          business_name: this.cleanString(row[colMap['business_name']]),
          amount: this.parseAmount(row[colMap['amount']]),
          payment_date: this.parseDate(row[colMap['payment_date']]),
          charge_date: this.parseDate(row[colMap['charge_date']]),
          currency: this.cleanString(row[colMap['currency']]) || 'ILS',
          payment_method: this.cleanString(row[colMap['payment_method']]),
          payment_identifier: this.cleanString(row[colMap['payment_identifier']]),
          category_name: this.cleanString(row[colMap['category_name']]),
          notes: this.cleanString(row[colMap['notes']]),
          source_type: 'budgetlens_export'
        };

        // Handle category_name with proper fallback logic for BudgetLens files
        if (transaction.category_name && transaction.category_name.trim()) {
          // Keep the original category from BudgetLens file
          console.log(`🔍 [BudgetLens] Using original category "${transaction.category_name}" for ${transaction.business_name}`);
        } else {
          // Apply auto-categorization as fallback for empty categories
          const autoCategory = await SupabaseService.getAutoCategoryForBusiness(
            transaction.business_name, 
            transaction.amount, 
            'budgetlens_export'
          );
          transaction.category_name = autoCategory || 'הוצאות משתנות';
          console.log(`🔍 [BudgetLens] Applied fallback category "${transaction.category_name}" for ${transaction.business_name}`);
        }

        // Set flow_month from the "שייך לתזרים חודש" column
        if (colMap['flow_month'] !== undefined && row[colMap['flow_month']]) {
          const flowMonthValue = this.cleanString(row[colMap['flow_month']]);
          transaction.flow_month = flowMonthValue;
          console.log(`🔍 [BudgetLens] Row ${i} - flow_month from CSV: "${flowMonthValue}" for transaction: ${transaction.business_name}`);
        } else {
          console.log(`🔍 [BudgetLens] Row ${i} - NO flow_month value found in CSV for transaction: ${transaction.business_name}`);
          if (colMap['flow_month'] === undefined) {
            console.log(`🔍 [BudgetLens] Row ${i} - flow_month column not found in headers`);
          } else {
            console.log(`🔍 [BudgetLens] Row ${i} - flow_month column exists but row value is empty: "${row[colMap['flow_month']]}"`);
          }
        }
        
        // Only add if we have required fields
        if (transaction.business_name && transaction.amount && transaction.payment_date) {
          transaction.transaction_hash = SupabaseService.generateTransactionHash(transaction);
          transactions.push(transaction);
        }
      } catch (error) {
        console.log(`⚠️ Error processing BudgetLens row ${i}:`, error.message);
      }
    }
    
    console.log(`🔍 [BudgetLens] Processed ${transactions.length} transactions`);
    return transactions;
  }
  
  static async processGenericData(jsonData, userId, cashFlowId) {
    const transactions = [];
    const headers = jsonData[0];
    
    // Try to find common column patterns
    const businessNameCol = this.findColumnIndex(headers, ['description', 'merchant', 'business', 'תיאור', 'עסק']);
    const amountCol = this.findColumnIndex(headers, ['amount', 'sum', 'total', 'סכום']);
    const dateCol = this.findColumnIndex(headers, ['date', 'תאריך']);
    
    if (businessNameCol === -1 || amountCol === -1 || dateCol === -1) {
      throw new Error('Could not identify required columns in the file');
    }
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      if (!row || row.length === 0) continue;
      
      try {
        const transaction = {
          user_id: userId,
          cash_flow_id: cashFlowId,
          business_name: this.cleanString(row[businessNameCol]),
          amount: this.parseAmount(row[amountCol]),
          payment_date: this.parseDate(row[dateCol]),
          currency: 'ILS',
          payment_method: 'Unknown',
          source_type: 'generic_import'
        };
        
        if (transaction.business_name && transaction.amount && transaction.payment_date) {
          // Apply auto-categorization
          const autoCategory = await SupabaseService.getAutoCategoryForBusiness(transaction.business_name, transaction.amount, 'generic');
          transaction.category_name = autoCategory || 'הוצאות משתנות';
          
          transaction.transaction_hash = SupabaseService.generateTransactionHash(transaction);
          transactions.push(transaction);
        }
      } catch (error) {
        console.log(`⚠️ Error processing generic row ${i}:`, error.message);
      }
    }
    
    return transactions;
  }
  
  // ===== HELPER METHODS =====
  
  static findColumnIndex(headers, possibleNames) {
    for (const name of possibleNames) {
      const index = headers.findIndex(header => 
        header && header.toString().toLowerCase().includes(name.toLowerCase())
      );
      if (index !== -1) return index;
    }
    return -1;
  }
  
  static cleanString(value) {
    if (!value) return null;
    return value.toString().trim();
  }
  
  static parseAmount(value) {
    if (!value) return null;
    
    // Handle various number formats
    const cleaned = value.toString()
      .replace(/[^\d.,\-]/g, '') // Remove all except digits, commas, dots, minus
      .replace(/,/g, '.'); // Convert commas to dots
    
    const number = parseFloat(cleaned);
    return isNaN(number) ? null : number;
  }
  
  static parseDate(value) {
    if (!value) return null;
    
    try {
      // Try different date formats
      const dateStr = value.toString().trim();
      
      // DD/MM/YYYY format (common in Israeli banks)
      if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // DD-MM-YYYY format
      if (dateStr.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
        const [day, month, year] = dateStr.split('-');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // YYYY-MM-DD format (ISO)
      if (dateStr.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
        return dateStr;
      }
      
      // Try parsing as Date object
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      
      return null;
    } catch (error) {
      console.log('Date parsing error:', error.message);
      return null;
    }
  }
  
  // ===== MULTI-STEP PROCESSING METHODS =====
  
  static async processExcelFileMultiStep(filePath, userId, cashFlowId, options = {}) {
    try {
      console.log('📄 Processing Excel file (multi-step):', filePath);
      
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (!jsonData || jsonData.length === 0) {
        throw new Error('File is empty or could not be read');
      }
      
      console.log(`📊 Found ${jsonData.length} rows in Excel file`);
      
      // Detect file format based on headers
      const headers = jsonData[0] || [];
      const fileFormat = this.detectFileFormat(headers);
      
      console.log('🔍 Detected file format:', fileFormat);
      
      // Process based on detected format
      let transactions = [];
      switch (fileFormat) {
        case 'isracard':
          transactions = await this.processIsracardData(jsonData, userId, cashFlowId);
          break;
        case 'max_credit':
          transactions = await this.processMaxCreditData(jsonData, userId, cashFlowId);
          break;
        case 'leumi':
          transactions = await this.processLeumiData(jsonData, userId, cashFlowId);
          break;
        case 'hapoalim':
          transactions = await this.processHapoalimData(jsonData, userId, cashFlowId);
          break;
        case 'budgetlens':
          transactions = await this.processBudgetLensData(jsonData, userId, cashFlowId);
          break;
        default:
          transactions = await this.processGenericData(jsonData, userId, cashFlowId);
      }
      
      console.log(`✅ Processed ${transactions.length} transactions`);
      
      // Group by currency
      const currencyGroups = this.groupByCurrency(transactions);
      
      // Check for duplicates
      const duplicates = await this.checkDuplicatesForGroups(currencyGroups, userId, cashFlowId);
      
      return {
        success: true,
        fileFormat,
        totalRows: jsonData.length - 1, // Excluding header
        transactions,
        currencyGroups,
        duplicates
      };
      
    } catch (error) {
      console.error('❌ Error processing Excel file (multi-step):', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  static groupByCurrency(transactions) {
    const groups = {};
    
    transactions.forEach(transaction => {
      const currency = transaction.currency || 'ILS';
      
      if (!groups[currency]) {
        groups[currency] = {
          transactions: [],
          count: 0,
          totalAmount: 0,
          dateRange: { from: null, to: null },
          sampleTransactions: []
        };
      }
      
      groups[currency].transactions.push(transaction);
      groups[currency].count++;
      groups[currency].totalAmount += Math.abs(transaction.amount || 0);
      
      // Update date range
      const paymentDate = transaction.payment_date;
      if (paymentDate) {
        if (!groups[currency].dateRange.from || paymentDate < groups[currency].dateRange.from) {
          groups[currency].dateRange.from = paymentDate;
        }
        if (!groups[currency].dateRange.to || paymentDate > groups[currency].dateRange.to) {
          groups[currency].dateRange.to = paymentDate;
        }
      }
      
      // Add to sample transactions (first 5)
      if (groups[currency].sampleTransactions.length < 5) {
        groups[currency].sampleTransactions.push(transaction);
      }
    });
    
    return groups;
  }
  
  static async checkDuplicatesForGroups(currencyGroups, userId, cashFlowId) {
    const allDuplicates = {};
    
    for (const [currency, group] of Object.entries(currencyGroups)) {
      const duplicates = await this.checkDuplicates(group.transactions, userId, cashFlowId);
      if (Object.keys(duplicates).length > 0) {
        Object.assign(allDuplicates, duplicates);
      }
    }
    
    return allDuplicates;
  }
  
  static async checkDuplicates(transactions, userId, cashFlowId) {
    const duplicates = {};
    
    for (const transaction of transactions) {
      try {
        // Check for existing transactions with same hash
        const existingTransactions = await SupabaseService.getTransactionsByHash(
          transaction.transaction_hash,
          userId
        );
        
        if (existingTransactions && existingTransactions.length > 0) {
          duplicates[transaction.transaction_hash] = {
            newTransaction: transaction,
            existingTransactions: existingTransactions,
            count: existingTransactions.length + 1
          };
        }
      } catch (error) {
        console.error('Error checking duplicates:', error);
      }
    }
    
    return duplicates;
  }
  
  static applyDuplicateResolutions(transactions, resolutions) {
    const finalTransactions = [];
    
    for (const transaction of transactions) {
      const resolution = resolutions[transaction.transaction_hash];
      
      if (!resolution || resolution === 'import') {
        // Import the transaction
        finalTransactions.push(transaction);
      } else if (resolution === 'skip') {
        // Skip this transaction
        continue;
      } else if (resolution === 'replace') {
        // Mark for replacement (will be handled by import logic)
        transaction.replaceExisting = true;
        finalTransactions.push(transaction);
      }
    }
    
    return finalTransactions;
  }

  // ===== IMPORT METHODS =====
  
  static async importTransactions(transactions, forceImport = false) {
    const results = {
      success: 0,
      duplicates: 0,
      errors: 0,
      details: []
    };
    
    console.log(`[importTransactions] Importing ${transactions.length} transactions. forceImport (default): ${forceImport}`);

    for (const transaction of transactions) {
      try {
        // Log details for the specific transaction being processed
        console.log(`[importTransactions] Processing tx with hash: ${transaction.transaction_hash}, forceFlag: ${transaction.forceImport}, business_name: ${transaction.business_name}`);
        const result = await SupabaseService.createTransaction(transaction, transaction.forceImport || forceImport);
        
        console.log(`[importTransactions] Result for ${transaction.business_name}:`, {
          success: result.success,
          duplicate: result.duplicate,
          transaction_id: result.transaction_id,
          error: result.error
        });
        
        if (result.success) {
          results.success++;
          console.log(`✅ [IMPORT SUCCESS] Transaction ${transaction.business_name} imported with ID: ${result.transaction_id}`);
        } else if (result.duplicate) {
          results.duplicates++;
          console.log(`⚠️ [IMPORT DUPLICATE] Transaction ${transaction.business_name} marked as duplicate`);
          results.details.push({
            business_name: transaction.business_name,
            amount: transaction.amount,
            payment_date: transaction.payment_date,
            status: 'duplicate'
          });
        } else {
          results.errors++;
          console.log(`❌ [IMPORT ERROR] Transaction ${transaction.business_name} failed: ${result.error}`);
          results.details.push({
            business_name: transaction.business_name,
            amount: transaction.amount,
            payment_date: transaction.payment_date,
            status: 'error',
            error: result.error
          });
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          business_name: transaction.business_name,
          amount: transaction.amount,
          payment_date: transaction.payment_date,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log(`✅ Import complete: ${results.success} success, ${results.duplicates} duplicates, ${results.errors} errors`);
    
    return results;
  }
  
  // ===== EXPORT METHODS =====
  
  static async exportTransactionsToExcel(transactions, filePath) {
    try {
      // Prepare data for export
      const exportData = transactions.map(transaction => ({
        'Business Name': transaction.business_name,
        'Amount': transaction.amount,
        'Payment Date': transaction.payment_date,
        'Charge Date': transaction.charge_date,
        'Currency': transaction.currency,
        'Payment Method': transaction.payment_method,
        'Category': transaction.category_name,
        'Notes': transaction.notes,
        'Flow Month': transaction.flow_month,
        'Created At': transaction.created_at
      }));
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
      
      // Write to file
      XLSX.writeFile(workbook, filePath);
      
      return {
        success: true,
        filePath: filePath,
        count: exportData.length
      };
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ExcelService;