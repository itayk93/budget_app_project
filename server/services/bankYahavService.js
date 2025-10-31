const XLSX = require('xlsx');
const SupabaseService = require('./supabaseService');
const { v4: uuidv4 } = require('uuid');

class BankYahavService {
  // ===== MAIN PROCESSING FUNCTION =====
  
  static async processYahavFile(filePath, userId, cashFlowId, options = {}) {
    try {
      const logger = require('../utils/logger');
      logger.debug('BANK_YAHAV', 'Processing Bank Yahav file', { filePath });
      
      // Read the Excel file (.xls or .xlsx)
      const workbook = XLSX.readFile(filePath);
      const allTransactions = [];
      
      logger.debug('BANK_YAHAV', 'Found sheets in file', { count: workbook.SheetNames.length });
      
      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        logger.debug('BANK_YAHAV', 'Processing sheet', { sheetName });
        
        const worksheet = workbook.Sheets[sheetName];
        
        // Find header row (not necessarily the first row)
        const headerRowIndex = this.findHeaderRow(worksheet);
        
        if (headerRowIndex === -1) {
          logger.debug('BANK_YAHAV', 'Header not found in sheet, skipping', { sheetName });
          continue;
        }
        
        logger.debug('BANK_YAHAV', 'Header found', { row: headerRowIndex + 1 });
        
        // Convert to JSON starting from header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          range: headerRowIndex
        });
        
        if (!jsonData || jsonData.length < 2) {
          logger.debug('BANK_YAHAV', 'Sheet has insufficient data, skipping', { sheetName });
          continue;
        }
        
        // Process transactions from this sheet
        const sheetTransactions = await this.processSheetData(jsonData, userId, cashFlowId, sheetName);
        allTransactions.push(...sheetTransactions);
      }
      
      logger.debug('BANK_YAHAV', 'Processed transactions from all sheets', { total: allTransactions.length });
      
      // Group by currency for multi-step processing
      const currencyGroups = this.groupByCurrency(allTransactions);
      
      // Check for duplicates
      const duplicates = await this.checkDuplicatesForGroups(currencyGroups, userId, cashFlowId);
      
      return {
        success: true,
        fileFormat: 'bank_yahav',
        totalTransactions: allTransactions.length,
        transactions: allTransactions,
        currencyGroups,
        duplicates
      };
      
    } catch (error) {
      console.error('❌ Error processing Bank Yahav file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // ===== HEADER DETECTION =====
  
  static findHeaderRow(worksheet) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Look for Hebrew header keywords in each row
    for (let rowNum = range.s.r; rowNum <= Math.min(range.s.r + 10, range.e.r); rowNum++) {
      const row = [];
      
      // Get all cells in this row
      for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
        const cell = worksheet[cellAddress];
        row.push(cell ? String(cell.v).trim() : '');
      }
      
      // Check if this row contains Bank Yahav header keywords
      const rowString = row.join('|');
      
      if (this.isYahavHeaderRow(rowString)) {
        return rowNum;
      }
    }
    
    return -1;
  }
  
  static isYahavHeaderRow(rowString) {
    const requiredKeywords = [
      'תאריך',           // Date
      'אסמכתא',          // Reference/Identifier  
      'תיאור פעולה',     // Transaction description
      'שם הפעולה'        // Transaction name (alternative)
    ];
    
    // Check for presence of key Hebrew headers
    const hasDate = rowString.includes('תאריך');
    const hasReference = rowString.includes('אסמכתא');
    const hasDescription = rowString.includes('תיאור פעולה') || rowString.includes('שם הפעולה');
    
    return hasDate && hasReference && hasDescription;
  }
  
  // ===== SHEET DATA PROCESSING =====
  
  static async processSheetData(jsonData, userId, cashFlowId, sheetName) {
    const transactions = [];
    const headers = jsonData[0] || [];
    
    const logger = require('../utils/logger');
    logger.debug('BANK_YAHAV', 'Processing sheet row count', { sheetName, rows: jsonData.length - 1 });
    logger.debug('BANK_YAHAV', 'Headers found', { headers });
    
    // Define column mappings for Bank Yahav format
    const mapping = {
      payment_date_col: this.findColumnIndex(headers, ['תאריך']),
      charge_date_col: this.findColumnIndex(headers, ['תאריך ערך']),
      business_name_col: this.findColumnIndex(headers, ['תיאור פעולה', 'שם הפעולה']),
      payment_identifier_col: this.findColumnIndex(headers, ['אסמכתא']),
      amount_debit_col: this.findColumnIndex(headers, ['חובה(₪)', 'חובה']),
      amount_credit_col: this.findColumnIndex(headers, ['זכות(₪)', 'זכות'])
    };
    
    logger.debug('BANK_YAHAV', 'Column mapping', { mapping });
    
    // Fallback for charge date if not found
    if (mapping.charge_date_col === -1) {
      mapping.charge_date_col = mapping.payment_date_col;
    }
    
    // Ensure all required columns exist
    if (mapping.payment_date_col === -1 || mapping.business_name_col === -1 || 
        mapping.payment_identifier_col === -1 || 
        (mapping.amount_debit_col === -1 && mapping.amount_credit_col === -1)) {
      throw new Error(`Required columns not found in sheet ${sheetName}. Missing columns detected.`);
    }
    
    // Process each data row
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      if (!row || row.length === 0) continue;
      
      try {
        // Parse payment date and filter out invalid rows
        const paymentDateRaw = row[mapping.payment_date_col];
        const paymentDate = this.parseDate(paymentDateRaw);
        
        if (!paymentDate) {
          logger.debug('BANK_YAHAV', 'Skipping row: invalid or missing date', { row: i });
          continue;
        }
        
        // Get business name and clean it
        const businessNameRaw = row[mapping.business_name_col];
        let businessName = this.cleanString(businessNameRaw);
        
        if (!businessName) {
          logger.debug('BANK_YAHAV', 'Skipping row: missing business name', { row: i });
          continue;
        }
        
        // Replace '/' with space in business name (as per Python code)
        businessName = businessName.replace(/\//g, ' ');
        
        // Calculate amount (combine debit and credit)
        const debitAmount = this.parseAmount(row[mapping.amount_debit_col]) || 0;
        const creditAmount = this.parseAmount(row[mapping.amount_credit_col]) || 0;
        const amount = creditAmount - debitAmount; // Credit positive, debit negative
        
        if (amount === 0) {
          logger.debug('BANK_YAHAV', 'Skipping row: zero amount', { row: i });
          continue;
        }
        
        // Get other fields
        const chargeDate = this.parseDate(row[mapping.charge_date_col]) || paymentDate;
        const originalIdentifier = this.cleanString(row[mapping.payment_identifier_col]) || '';
        
        // Extract date components
        const paymentDateObj = new Date(paymentDate);
        const paymentMonth = paymentDateObj.getMonth() + 1;
        const paymentYear = paymentDateObj.getFullYear();
        const flowMonth = `${paymentYear}-${String(paymentMonth).padStart(2, '0')}`;
        
        // Create transaction object
        const transaction = {
          id: null,
          user_id: userId,
          cash_flow_id: cashFlowId,
          business_name: businessName,
          payment_date: paymentDate,
          charge_date: chargeDate,
          amount: amount,
          currency: 'ILS', // Default for Bank Yahav
          payment_method: null,
          payment_identifier: null,
          category_name: parseFloat(amount) <= 0 ? 'הוצאות משתנות' : 'הכנסות משתנות',
          payment_month: paymentMonth,
          payment_year: paymentYear,
          flow_month: flowMonth,
          notes: '',
          excluded_from_flow: false,
          source_type: 'BankAccount',
          original_amount: null,
          transaction_hash: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_transfer: false,
          linked_transaction_id: null,
          category_name: null,
          payment_number: 1,
          total_payments: 1,
          original_currency: null,
          exchange_rate: null,
          exchange_date: null,
          business_country: null,
          quantity: null,
          source_category: null,
          transaction_type: null,
          execution_method: null,
          original_identifier: originalIdentifier
        };
        
        // Apply auto-categorization
        const autoCategory = await SupabaseService.getAutoCategoryForBusiness(
          businessName, 
          amount, 
          'bank_yahav'
        );
        transaction.category_name = autoCategory || 'הוצאות משתנות';
        
        // Generate transaction hash
        transaction.transaction_hash = SupabaseService.generateTransactionHash(transaction);
        
        transactions.push(transaction);
        
      } catch (error) {
        console.log(`⚠️ Error processing row ${i}:`, error.message);
      }
    }
    
    console.log(`✅ Successfully processed ${transactions.length} transactions from sheet: ${sheetName}`);
    return transactions;
  }
  
  // ===== HELPER METHODS =====
  
  static findColumnIndex(headers, possibleNames) {
    for (const name of possibleNames) {
      const index = headers.findIndex(header => 
        header && String(header).trim() === name
      );
      if (index !== -1) return index;
    }
    return -1;
  }
  
  static cleanString(value) {
    if (!value) return null;
    return String(value).trim();
  }
  
  static parseAmount(value) {
    if (!value) return null;
    
    // Handle various number formats
    const cleaned = String(value)
      .replace(/[^\d.,\-]/g, '') // Remove all except digits, commas, dots, minus
      .replace(/,/g, '.'); // Convert commas to dots
    
    const number = parseFloat(cleaned);
    return isNaN(number) ? null : number;
  }
  
  static parseDate(value) {
    if (!value) return null;
    
    try {
      // Handle Excel date numbers
      if (typeof value === 'number') {
        // Excel date serial number
        const excelDate = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) {
          return excelDate.toISOString().split('T')[0];
        }
      }
      
      const dateStr = String(value).trim();
      
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
  
  // ===== CURRENCY AND DUPLICATE CHECKING =====
  
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
        groups[currency].sampleTransactions.push({
          business_name: transaction.business_name,
          amount: transaction.amount,
          payment_date: transaction.payment_date,
          category_name: transaction.category_name
        });
      }
    });
    
    return groups;
  }
  
  static async checkDuplicatesForGroups(currencyGroups, userId, cashFlowId) {
    const allDuplicates = {};
    
    for (const [currency, group] of Object.entries(currencyGroups)) {
      console.log(`🔍 Checking duplicates for ${currency}: ${group.count} transactions`);
      const duplicates = await this.checkDuplicates(group.transactions, userId, cashFlowId);
      if (Object.keys(duplicates).length > 0) {
        Object.assign(allDuplicates, duplicates);
      }
    }
    
    console.log(`🔍 Found ${Object.keys(allDuplicates).length} duplicate groups`);
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
  
  // ===== IMPORT METHODS =====
  
  static async importSelectedTransactions(transactions, userSelections = {}) {
    const results = {
      success: 0,
      duplicates: 0,
      errors: 0,
      skipped: 0,
      details: []
    };
    
    console.log(`[Bank Yahav Import] Processing ${transactions.length} transactions with user selections`);
    
    for (const transaction of transactions) {
      try {
        const hash = transaction.transaction_hash;
        const selection = userSelections[hash] || 'import'; // Default to import
        
        if (selection === 'skip') {
          results.skipped++;
          results.details.push({
            business_name: transaction.business_name,
            amount: transaction.amount,
            payment_date: transaction.payment_date,
            status: 'skipped'
          });
          continue;
        }
        
        const forceImport = selection === 'replace' || selection === 'import';
        const result = await SupabaseService.createTransaction(transaction, forceImport);
        
        if (result.success) {
          results.success++;
          console.log(`✅ [Bank Yahav] Transaction imported: ${transaction.business_name}`);
        } else if (result.duplicate) {
          results.duplicates++;
          console.log(`⚠️ [Bank Yahav] Duplicate found: ${transaction.business_name}`);
          results.details.push({
            business_name: transaction.business_name,
            amount: transaction.amount,
            payment_date: transaction.payment_date,
            status: 'duplicate'
          });
        } else {
          results.errors++;
          console.log(`❌ [Bank Yahav] Import failed: ${transaction.business_name} - ${result.error}`);
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
        console.error(`❌ [Bank Yahav] Error importing transaction:`, error);
        results.details.push({
          business_name: transaction.business_name,
          amount: transaction.amount,
          payment_date: transaction.payment_date,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log(`✅ [Bank Yahav] Import complete: ${results.success} success, ${results.duplicates} duplicates, ${results.errors} errors, ${results.skipped} skipped`);
    
    return results;
  }
}

module.exports = BankYahavService;
