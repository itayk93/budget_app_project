const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const glob = require('glob');
const crypto = require('crypto');
const ExcelService = require('./excelService');
const SupabaseService = require('./supabaseService');
const AmericanExpressService = require('./americanExpressService');
const logger = require('../utils/logger');

class WorkingExcelService {
  constructor() {
    // Currency detection based on the old working project
    this.CURRENCY_SYMBOLS = {
      '€': 'EUR',
      '$': 'USD', 
      '£': 'GBP',
      '₪': 'ILS',
      '¥': 'JPY',
      '₹': 'INR',
      '₩': 'KRW'
    };
    
    this.setupColumnMappings();
    this.businessCategoryCache = new Map();
  }

  // Convert currency symbol to code
  convertCurrencySymbolToCode(value) {
    if (!value) return 'ILS';
    const stringValue = String(value).trim();
    
    // Check if it's already a code
    if (stringValue.length === 3 && /^[A-Z]+$/.test(stringValue)) {
      return stringValue;
    }
    
    // Convert symbol to code
    for (const [symbol, code] of Object.entries(this.CURRENCY_SYMBOLS)) {
      if (stringValue.includes(symbol)) {
        return code;
      }
    }
    
    // Default to ILS if not found
    return 'ILS';
  }

  // Get category by business name with auto-categorization
  async getCategoryByBusinessName(businessName, amount = null, sourceType = null, userId = null) {
    if (!businessName) return null;
    
    console.log(`🔍 [getCategoryByBusinessName] Called with: businessName="${businessName}", amount=${amount}, sourceType="${sourceType}", userId=${userId}`);
    
    // Check cache first
    const cacheKey = `${businessName}_${userId}`;
    if (this.businessCategoryCache.has(cacheKey)) {
      const cachedCategory = this.businessCategoryCache.get(cacheKey);
      console.log(`🎯 [getCategoryByBusinessName] Cache hit: "${businessName}" -> "${cachedCategory}"`);
      return cachedCategory;
    }
    
    try {
      // Call the SupabaseService auto-categorization with userId
      console.log(`🔍 [getCategoryByBusinessName] Calling SupabaseService.getAutoCategoryForBusiness...`);
      const autoCategory = await SupabaseService.getAutoCategoryForBusiness(businessName, amount, sourceType, userId);
      
      if (autoCategory) {
        // Cache the result
        this.businessCategoryCache.set(cacheKey, autoCategory);
        console.log(`✅ [getCategoryByBusinessName] Auto-categorized "${businessName}" as "${autoCategory}"`);
        return autoCategory;
      } else {
        console.log(`❌ [getCategoryByBusinessName] No auto-category found for "${businessName}"`);
      }
    } catch (error) {
      console.warn(`❌ [getCategoryByBusinessName] Error getting auto category for business ${businessName}:`, error);
    }
    
    return null;
  }
  
  // Extract currency from amount text (Cal format)
  extractCurrencyFromAmount(amountText) {
    if (!amountText) return 'ILS';
    
    const text = String(amountText).trim();
    
    // Check for common currency symbols
    if (text.includes('₪') || text.includes('ILS') || text.includes('שקל')) {
      return 'ILS';
    }
    if (text.includes('$') || text.includes('USD')) {
      return 'USD';
    }
    if (text.includes('€') || text.includes('EUR')) {
      return 'EUR';
    }
    if (text.includes('£') || text.includes('GBP')) {
      return 'GBP';
    }
    
    return 'ILS'; // Default to ILS if no currency found
  }
  
  setupColumnMappings() {
    // Hebrew column mappings from the old working project
    this.COLUMN_MAPPINGS = {
      // Date columns - Cal format
      'תאריך עסקה': 'payment_date',
      'תאריך': 'payment_date',
      'תאריך ביצוע': 'payment_date',
      'תאריך תשלום': 'payment_date',
      'תאריך העסקה': 'payment_date',
      'תאריך חיוב': 'charge_date',
      'תאריך החיוב': 'charge_date',
      'תאריך רכישה': 'payment_date',
      'תאריך חיוב בבנק': 'charge_date',
      
      // Description columns - Cal format
      'שם בית עסק': 'business_name',
      'תיאור עסקה': 'description',
      'תיאור': 'description',
      'פירוט נוסף': 'description', 
      'שם בית העסק': 'business_name',
      'שם העסק': 'business_name',
      'בית עסק': 'business_name',
      
      // Amount columns - Cal format
      'סכום עסקה': 'original_amount',
      'סכום חיוב': 'amount',
      'סכום': 'amount',
      'סכום בשקלים': 'amount',
      'זכות': 'credit',
      'חובה': 'debit',
      'זכות/חובה': 'amount',
      
      // Currency columns
      'מטבע': 'currency',
      'מטבע חיוב': 'currency',
      'מטבע מקור': 'original_currency',
      
      // Payment method columns
      'אמצעי תשלום': 'payment_method',
      'סוג תשלום': 'payment_method',
      
      // Card/identifier columns
      'מספר כרטיס': 'card_number',
      '4 ספרות אחרונות': 'last_four',
      '4 ספרות אחרונות של כרטיס האשראי': 'payment_identifier',
      'זיהוי': 'identifier',
      
      // Flow month column
      'שייך לתזרים חודש': 'flow_month',
      
      // Cal specific columns
      'סוג עסקה': 'transaction_type',
      'הערות': 'notes',
      
      // Source category columns (Max, Cal, etc.)
      'קטגוריה': 'source_category',
      'ענף': 'source_category',
      'אופן ביצוע ההעסקה': 'execution_method',
      
      // Columns to exclude/ignore
      'מס\' שובר': 'voucher_number'
    };

    // Known bank formats from the old working project
    this.BANK_FORMATS = {
      isracard: {
        requiredColumns: ['תאריך רכישה', 'תאריך חיוב בבנק', 'שם בית העסק', 'סכום עסקה', 'מטבע מקור', 'סכום חיוב', 'מטבע', 'מס\' שובר'],
        alternativeColumns: ['תאריך עסקה', 'תיאור עסקה', 'סכום', 'פירוט', 'עסק', 'גולד', 'מסטרקארד'],
        keywords: ['ישראכרט', 'isracard', 'פירוט עסקאות', 'גולד', 'מסטרקארד'],
        currencyColumn: 'מטבע',
        amountColumn: 'סכום חיוב',
        originalAmountColumn: 'סכום עסקה',
        originalCurrencyColumn: 'מטבע מקור',
        dateColumn: 'תאריך רכישה',
        chargeDateColumn: 'תאריך חיוב בבנק',
        descriptionColumn: 'שם בית העסק',
        voucherColumn: 'מס\' שובר'
      },
      cal: {
        requiredColumns: ['תאריך עסקה', 'שם בית עסק', 'סכום עסקה', 'סכום חיוב'],
        alternativeColumns: ['סוג עסקה', 'ענף', 'הערות'],
        keywords: ['cal', 'קאל', 'דיינרס', 'diners', 'מסטרקארד', 'פירוט חיובים'],
        amountColumn: 'סכום חיוב',
        originalAmountColumn: 'סכום עסקה',
        dateColumn: 'תאריך עסקה',
        descriptionColumn: 'שם בית עסק',
        transactionTypeColumn: 'סוג עסקה',
        sourceCategoryColumn: 'ענף',
        notesColumn: 'הערות'
      },
      leumi: {
        requiredColumns: ['תאריך', 'תיאור', 'זכות/חובה'],
        amountColumns: ['זכות', 'חובה', 'זכות/חובה'],
        dateColumn: 'תאריך',
        descriptionColumn: 'תיאור'
      },
      hapoalim: {
        requiredColumns: ['תאריך ביצוע', 'פירוט נוסף', 'סכום'],
        amountColumn: 'סכום',
        dateColumn: 'תאריך ביצוע', 
        descriptionColumn: 'פירוט נוסף'
      },
      budgetlens: {
        requiredColumns: ['שם העסק', 'תאריך התשלום', 'סכום'],
        amountColumn: 'סכום',
        dateColumn: 'תאריך התשלום',
        chargeDateColumn: 'תאריך החיוב בחשבון',
        descriptionColumn: 'שם העסק',
        paymentIdentifierColumn: 'אמצעי זיהוי התשלום',
        originalAmountColumn: 'סכום מקורי'
      },
      max: {
        requiredColumns: ['תאריך עסקה', 'שם בית העסק', 'קטגוריה', '4 ספרות אחרונות של כרטיס האשראי', 'סוג עסקה', 'סכום חיוב'],
        alternativeColumns: ['מטבע חיוב', 'סכום עסקה מקורי', 'תאריך חיוב', 'הערות', 'אופן ביצוע ההעסקה'],
        keywords: ['max', 'מקס', 'transaction-details_export'],
        amountColumn: 'סכום חיוב',
        originalAmountColumn: 'סכום עסקה מקורי',
        originalCurrencyColumn: 'מטבע עסקה מקורי',
        currencyColumn: 'מטבע חיוב',
        dateColumn: 'תאריך עסקה',
        chargeDateColumn: 'תאריך חיוב',
        descriptionColumn: 'שם בית העסק',
        categoryColumn: 'קטגוריה',
        cardColumn: '4 ספרות אחרונות של כרטיס האשראי',
        transactionTypeColumn: 'סוג עסקה',
        executionMethodColumn: 'אופן ביצוע ההעסקה',
        notesColumn: 'הערות'
      },
      americanexpress: {
        requiredColumns: ['תאריך רכישה', 'שם בית עסק'],
        alternativeColumns: ['סכום עסקה', 'מטבע עסקה', 'סכום חיוב', 'מטבע חיוב', 'מס\' שובר', 'פירוט נוסף'],
        keywords: ['american express', 'amex', 'אמריקן אקספרס'],
        amountColumn: 'סכום חיוב',
        originalAmountColumn: 'סכום עסקה',
        originalCurrencyColumn: 'מטבע עסקה',
        currencyColumn: 'מטבע חיוב',
        dateColumn: 'תאריך רכישה',
        descriptionColumn: 'שם בית עסק',
        voucherColumn: 'מס\' שובר',
        notesColumn: 'פירוט נוסף'
      },
      bank_yahav: {
        requiredColumns: ['תאריך', 'אסמכתא', 'תיאור פעולה', 'חובה(₪)', 'זכות(₪)'],
        alternativeColumns: ['שם הפעולה', 'תאריך ערך', 'יתרה משוערכת(₪)'],
        keywords: ['יהב', 'yahav', 'תנועות עו"ש', 'תנועות זמניות'],
        amountColumns: ['חובה(₪)', 'זכות(₪)', 'חובה', 'זכות'],
        dateColumn: 'תאריך',
        chargeDateColumn: 'תאריך ערך',
        descriptionColumn: 'תיאור פעולה',
        paymentIdentifierColumn: 'אסמכתא',
        balanceColumn: 'יתרה משוערכת(₪)'
      }
    };
  }

  // Flask equivalent: fix_euro_amounts function
  fixEuroAmounts(transactions) {
    const fixedTransactions = [];
    
    for (const transaction of transactions) {
      const fixed = { ...transaction };
      
      // Check if amount contains Euro symbol
      if (fixed.amount && typeof fixed.amount === 'string' && fixed.amount.includes('€')) {
        // Extract numeric value and handle European decimal format
        let amountStr = fixed.amount.replace('€', '').trim();
        
        // Handle European number format (comma as decimal separator)
        if (amountStr.includes(',') && amountStr.includes('.')) {
          // Format like "1.234,56" - comma is decimal separator
          amountStr = amountStr.replace(/\./g, '').replace(',', '.');
        } else if (amountStr.includes(',') && !amountStr.includes('.')) {
          // Format like "1234,56" - comma is decimal separator
          amountStr = amountStr.replace(',', '.');
        }
        
        // Parse the cleaned amount
        const numericAmount = parseFloat(amountStr);
        if (!isNaN(numericAmount)) {
          fixed.amount = numericAmount;
          fixed.currency = 'EUR';
        }
      }
      
      // Handle original_amount if it exists
      if (fixed.original_amount && typeof fixed.original_amount === 'string' && fixed.original_amount.includes('€')) {
        let originalAmountStr = fixed.original_amount.replace('€', '').trim();
        
        if (originalAmountStr.includes(',') && originalAmountStr.includes('.')) {
          originalAmountStr = originalAmountStr.replace(/\./g, '').replace(',', '.');
        } else if (originalAmountStr.includes(',') && !originalAmountStr.includes('.')) {
          originalAmountStr = originalAmountStr.replace(',', '.');
        }
        
        const numericOriginalAmount = parseFloat(originalAmountStr);
        if (!isNaN(numericOriginalAmount)) {
          fixed.original_amount = numericOriginalAmount;
        }
      }
      
      fixedTransactions.push(fixed);
    }
    
    return fixedTransactions;
  }

  // Flask equivalent: normalize_header function
  normalizeHeader(col) {
    if (!col) return '';
    return String(col).replace(/\s+/g, ' ').trim();
  }

  // Flask equivalent: looks_like_date function
  looksLikeDate(series) {
    if (!Array.isArray(series) || series.length === 0) return false;
    
    let validDates = 0;
    const sampleSize = Math.min(series.length, 10);
    
    for (let i = 0; i < sampleSize; i++) {
      const val = series[i];
      if (!val) continue;
      
      const strVal = String(val).trim();
      
      // Skip short strings that are likely IDs (like "8429", "3079")
      if (strVal.length < 6) continue;
      
      // Skip patterns that look like payment IDs (numbers with hyphens like "131-011822")
      if (/^\d+-\d+$/.test(strVal)) continue;
      
      // Check if it's a valid date
      if (moment(val, moment.ISO_8601, true).isValid()) {
        validDates++;
      }
    }
    
    return sampleSize > 0 && (validDates / sampleSize) >= 0.8;
  }

  // Flask equivalent: looks_like_numeric function
  looksLikeNumeric(series) {
    if (!Array.isArray(series) || series.length === 0) return false;
    
    let numericCount = 0;
    const sampleSize = Math.min(series.length, 10);
    
    for (let i = 0; i < sampleSize; i++) {
      const val = series[i];
      if (val !== null && val !== undefined && !isNaN(parseFloat(val))) {
        numericCount++;
      }
    }
    
    return (numericCount / sampleSize) >= 0.8;
  }

  // Flask equivalent: read_csv_with_hebrew_headers function
  async readCSVWithHebrewHeaders(filePath) {
    try {
      console.log(`[read_csv_with_hebrew_headers] Reading: ${filePath}`);
      
      // Try UTF-8 first, then UTF-8-SIG
      const encodings = ['utf8', 'utf8'];
      let rawData = null;
      let error = null;
      
      for (const encoding of encodings) {
        try {
          rawData = await this.readCSVFileWithEncoding(filePath, encoding);
          if (rawData && rawData.length > 0) {
            console.log(`[read_csv_with_hebrew_headers] Successfully read with ${encoding} encoding`);
            break;
          }
        } catch (e) {
          error = e;
          console.warn(`[read_csv_with_hebrew_headers] Failed with ${encoding}:`, e.message);
        }
      }
      
      if (!rawData || rawData.length === 0) {
        throw error || new Error('Could not read CSV file with any encoding');
      }
      
      // Normalize headers
      const normalizedData = rawData.map(row => {
        const normalizedRow = {};
        for (const [key, value] of Object.entries(row)) {
          const normalizedKey = this.normalizeHeader(key);
          normalizedRow[normalizedKey] = value;
        }
        return normalizedRow;
      });
      
      console.log(`[read_csv_with_hebrew_headers] Read ${normalizedData.length} rows`);
      return normalizedData;
      
    } catch (error) {
      console.error(`[read_csv_with_hebrew_headers] Error:`, error);
      throw error;
    }
  }

  async readCSVFileWithEncoding(filePath, encoding) {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = fs.createReadStream(filePath, { encoding });
      
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  // Enhanced map_sheet function based on Flask logic
  async mapSheet(rawData, fileSource, uploadId = null, userId = null) {
    logger.info('UPLOAD', `Starting sheet mapping for ${rawData.length} rows`, {
      uploadId,
      fileSource,
      rowCount: rawData.length
    });
    
    if (!rawData || rawData.length === 0) {
      logger.warn('UPLOAD', 'No data to map - empty dataset', { uploadId });
      return [];
    }
    
    const mappedTransactions = [];
    const headers = Object.keys(rawData[0]);
    
    // Log original headers found
    logger.info('UPLOAD', 'Original columns detected', {
      uploadId,
      headers,
      headerCount: headers.length
    });
    
    // Analyze columns to determine their types
    const columnAnalysis = this.analyzeColumns(rawData, headers);
    
    // Log column analysis results
    logger.info('UPLOAD', 'Column analysis completed', {
      uploadId,
      analysis: Object.entries(columnAnalysis).map(([header, analysis]) => ({
        header,
        isDate: analysis.isDate,
        isNumeric: analysis.isNumeric,
        sampleValues: analysis.sampleValues
      }))
    });
    
    // Track mapping statistics
    let validTransactions = 0;
    let invalidTransactions = 0;
    const mappingErrors = [];
    
    for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      try {
        const mappedRow = await this.mapRowAdvanced(row, columnAnalysis, fileSource, uploadId, rowIndex, userId);
        if (mappedRow && this.isValidTransaction(mappedRow)) {
          mappedTransactions.push(mappedRow);
          validTransactions++;
        } else {
          invalidTransactions++;
          logger.debug('UPLOAD', 'Invalid transaction skipped', {
            uploadId,
            rowIndex,
            reason: 'Failed validation',
            rowData: row
          });
        }
      } catch (error) {
        invalidTransactions++;
        mappingErrors.push({
          rowIndex,
          error: error.message,
          rowData: row
        });
        logger.error('UPLOAD', `Error mapping row ${rowIndex}`, {
          uploadId,
          rowIndex,
          error: error.message,
          rowData: row
        });
      }
    }
    
    // Log final mapping results
    logger.success('UPLOAD', 'Sheet mapping completed', {
      uploadId,
      validTransactions,
      invalidTransactions,
      totalRows: rawData.length,
      successRate: ((validTransactions / rawData.length) * 100).toFixed(2) + '%',
      errorCount: mappingErrors.length
    });
    
    if (mappingErrors.length > 0) {
      logger.warn('UPLOAD', 'Mapping errors summary', {
        uploadId,
        errors: mappingErrors
      });
    }
    
    return mappedTransactions;
  }

  analyzeColumns(rawData, headers) {
    const analysis = {};
    
    for (const header of headers) {
      const values = rawData.map(row => row[header]).filter(val => val !== null && val !== undefined && val !== '');
      
      analysis[header] = {
        isDate: this.looksLikeDate(values),
        isNumeric: this.looksLikeNumeric(values),
        sampleValues: values.slice(0, 3)
      };
    }
    
    return analysis;
  }

  async mapRowAdvanced(row, columnAnalysis, fileSource, uploadId = null, rowIndex = null, userId = null) {
    const mapped = {
      source_type: 'creditCard',
      flow_month: null,
      business_name: null,
      payment_method: null,
      payment_identifier: null,
      payment_date: null,
      payment_month: null,
      payment_year: null,
      charge_date: null,
      amount: null,
      currency: 'ILS',
      payment_number: 1,
      total_payments: 1,
      category_name: null,
      excluded_from_flow: false,
      notes: null,
      original_amount: null,
      source_category: null
    };
    
    
    // Map each column based on analysis and Hebrew mappings
    for (const [colName, value] of Object.entries(row)) {
      // Skip empty values except for payment identifier which we want to process even if it might be falsy
      if (!value && colName !== 'אמצעי זיהוי התשלום') continue;
      
      const normalizedCol = this.normalizeHeader(colName);
      const analysis = columnAnalysis[colName];
      
      
      
      
      // Date mapping - handle Cal date format (Excel serial dates)
      if (this.isDateColumn(normalizedCol) || normalizedCol.includes('תאריך')) {
        let dateValue = value;
        
        // Convert Excel serial date to proper date if needed
        if (typeof value === 'number' && value > 25000) {
          // Excel serial date - convert to JS date
          const excelEpoch = new Date(1900, 0, 1);
          const jsDate = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
          dateValue = jsDate.toISOString().split('T')[0]; // Get YYYY-MM-DD format
        }
        
        // Handle specific date columns
        if (normalizedCol.includes('תאריך עסקה') || normalizedCol.includes('תאריך רכישה')) {
          const paymentDate = this.ensureDateFormat(dateValue);
          if (paymentDate) {
            mapped.payment_date = paymentDate;
          }
        } else if (normalizedCol.includes('תאריך החיוב') || normalizedCol.includes('תאריך חיוב בבנק')) {
          const chargeDate = this.ensureDateFormat(dateValue);
          if (chargeDate) {
            mapped.charge_date = chargeDate;
          }
        } else if (!mapped.payment_date) {
          const paymentDate = this.ensureDateFormat(dateValue);
          if (paymentDate) {
            mapped.payment_date = paymentDate;
          }
        }
        continue;
      }
      
      // Original amount mapping (Cal format - extract currency from this column)
      if (normalizedCol.includes('סכום עסקה') || normalizedCol.includes('סכום מקורי') || normalizedCol.includes('original_amount')) {
        const originalAmount = this.parseAmount(value);
        if (originalAmount !== null) {
          mapped.original_amount = originalAmount;
        }
        
        // Extract currency from the text in סכום עסקה
        if (normalizedCol.includes('סכום עסקה')) {
          const extractedCurrency = this.extractCurrencyFromAmount(value);
          mapped.currency = extractedCurrency;
        }
        continue;
      }
      
      // Amount mapping (main amount column) - Cal format
      // Amount mapping (main amount column) - Cal format
      if (normalizedCol.includes('סכום חיוב') || (this.isAmountColumn(normalizedCol) && !normalizedCol.includes('מקורי') && !normalizedCol.includes('עסקה'))) {
        const amount = this.parseAmount(value);
        if (amount !== null) {
          mapped.amount = amount;
        }
        continue;
      }
      
      // Business name mapping - Cal format
      if (this.isBusinessNameColumn(normalizedCol) || normalizedCol.includes('שם בית עסק')) {
        mapped.business_name = String(value).trim();
        continue;
      }
      
      // Currency mapping
      if (this.isCurrencyColumn(normalizedCol)) {
        mapped.currency = this.normalizeCurrency(value);
        continue;
      }
      
      // Payment method mapping
      if (this.isPaymentMethodColumn(normalizedCol)) {
        mapped.payment_method = String(value).trim();
        continue;
      }
      
      // Category mapping
      if (this.isCategoryColumn(normalizedCol)) {
        mapped.category_name = String(value).trim();
        continue;
      }
      
      // Notes mapping
      if (this.isNotesColumn(normalizedCol)) {
        mapped.notes = String(value).trim();
        continue;
      }
      
      // Payment identifier mapping (for BudgetLens)
      if (normalizedCol.includes('אמצעי זיהוי') || normalizedCol.includes('payment_identifier')) {
        if (value && value !== 'NaN' && value !== '') {
          const last4 = String(value).replace(/\D/g, '').slice(-4);
          mapped.payment_identifier = last4.padStart(4, '0');
        }
        continue;
      }
      
      // Original amount mapping (for BudgetLens)
      if (normalizedCol.includes('סכום מקורי') || normalizedCol.includes('original_amount')) {
        const originalAmt = this.parseAmount(value);
        if (originalAmt !== null) {
          mapped.original_amount = originalAmt;
        }
        continue;
      }
      
      // Handle Cal specific columns
      if (normalizedCol.includes('סוג עסקה') || normalizedCol.includes('transaction_type')) {
        if (value && String(value).trim()) {
          mapped.transaction_type = String(value).trim();
        }
        continue;
      }
      
      // Source category mapping (ענף or קטגוריה columns)
      if (normalizedCol.includes('ענף') || normalizedCol.includes('קטגוריה') || normalizedCol.includes('source_category')) {
        if (value && String(value).trim()) {
          mapped.source_category = String(value).trim();
          logger.sourceCategoryProcessing(uploadId, rowIndex, mapped.source_category, mapped.business_name);
          
          // Debug log for source_category mapping
          logger.debug('UPLOAD', 'Source category mapped', {
            uploadId,
            rowIndex,
            columnName: colName,
            normalizedColumn: normalizedCol,
            sourceValue: value,
            mappedValue: mapped.source_category
          });
        }
        continue;
      }
      
      // Legacy business_category mapping for compatibility
      if (normalizedCol.includes('business_category')) {
        if (value && String(value).trim()) {
          mapped.business_category = String(value).trim();
          // Also set category_name if not already set
          if (!mapped.category_name) {
            mapped.category_name = String(value).trim();
          }
        }
        continue;
      }
      
      // Handle flow_month from CSV (specifically for BudgetLens files)
      if (normalizedCol.includes('שייך לתזרים חודש') || normalizedCol.includes('flow_month')) {
        if (value && String(value).trim()) {
          mapped.flow_month = String(value).trim();
          if (process.env.DEBUG === 'true') {
              console.log(`🔍 [WorkingExcelService] Found flow_month in CSV: ${mapped.flow_month}`);
          }
        }
        continue;
      }
    }
    
    // Apply auto-categorization if no category was found in the Excel and business name exists
    if (!mapped.category_name && mapped.business_name) {
      try {
        const autoCategory = await this.getCategoryByBusinessName(mapped.business_name, mapped.amount, fileSource, userId);
        if (autoCategory) {
          mapped.category_name = autoCategory;
          console.log(`Auto-categorized "${mapped.business_name}" as "${autoCategory}" in mapRowAdvanced`);
        }
      } catch (error) {
        console.warn(`Error auto-categorizing in mapRowAdvanced for ${mapped.business_name}:`, error);
      }
    }
    
    // Post-processing based on file source
    await this.applyFileSourceLogic(mapped, fileSource, userId);
    
    return mapped;
  }

  isDateColumn(colName) {
    // Exclude payment identifier columns from being considered date columns
    if (colName.includes('אמצעי זיהוי')) {
      return false;
    }
    
    // Exclude amount columns that contain חיוב but also סכום
    if (colName.includes('סכום') && colName.includes('חיוב')) {
      return false;
    }
    
    const dateKeywords = ['תאריך', 'date', 'תשלום', 'חיוב', 'ביצוע'];
    return dateKeywords.some(keyword => colName.includes(keyword));
  }

  isAmountColumn(colName) {
    const amountKeywords = ['סכום', 'amount', 'charge', 'חיוב'];
    return amountKeywords.some(keyword => colName.includes(keyword));
  }

  isBusinessNameColumn(colName) {
    const businessKeywords = ['שם העסק', 'שם בית העסק', 'שם הנייר', 'business', 'merchant', 'תיאור'];
    return businessKeywords.some(keyword => colName.includes(keyword));
  }

  isCurrencyColumn(colName) {
    const currencyKeywords = ['מטבע', 'currency'];
    return currencyKeywords.some(keyword => colName.includes(keyword));
  }

  isPaymentMethodColumn(colName) {
    // Exclude payment identifier columns from being considered payment method columns
    if (colName.includes('אמצעי זיהוי')) {
      return false;
    }
    
    const paymentKeywords = ['אמצעי תשלום', 'payment method', 'אמצעי'];
    return paymentKeywords.some(keyword => colName.includes(keyword));
  }

  isCategoryColumn(colName) {
    const categoryKeywords = ['קטגוריה', 'category', 'ענף'];
    return categoryKeywords.some(keyword => colName.includes(keyword));
  }

  isNotesColumn(colName) {
    const notesKeywords = ['הערות', 'notes', 'פירוט'];
    return notesKeywords.some(keyword => colName.includes(keyword));
  }

  normalizeCurrency(value) {
    if (!value) return 'ILS';
    const val = String(value).trim().toUpperCase();
    
    // Check for currency symbols
    for (const [symbol, code] of Object.entries(this.CURRENCY_SYMBOLS)) {
      if (val.includes(symbol)) {
        return code;
      }
    }
    
    // Check for ISO codes
    if (/^[A-Z]{3}$/.test(val)) {
      return val;
    }
    
    return 'ILS'; // Default
  }

  async applyFileSourceLogic(mapped, fileSource, userId = null) {
    // Apply auto-categorization for non-BudgetLens files if no category is set
    if (fileSource !== 'budgetlens' && !mapped.category_name && mapped.business_name) {
      try {
        const autoCategory = await this.getCategoryByBusinessName(mapped.business_name, mapped.amount, fileSource, userId);
        if (autoCategory) {
          mapped.category_name = autoCategory;
          console.log(`Auto-categorized "${mapped.business_name}" as "${autoCategory}" in applyFileSourceLogic`);
        }
      } catch (error) {
        console.warn(`Error auto-categorizing in applyFileSourceLogic for ${mapped.business_name}:`, error);
      }
    }

    // Apply file source specific logic
    if (fileSource === 'isracard' || fileSource === 'cal') {
      mapped.category_name = mapped.category_name || 'הוצאות תזרימיות';
      mapped.payment_method = mapped.payment_method || (fileSource === 'cal' ? 'cal' : 'isracard');
      
      // Cal/Isracard amounts are usually positive but represent expenses
      if (mapped.amount > 0) {
        mapped.amount = -Math.abs(mapped.amount);
      }
    } else if (fileSource === 'americanexpress') {
      mapped.category_name = mapped.category_name || 'הוצאות תזרימיות';
      mapped.payment_method = mapped.payment_method || 'americanexpress';
      mapped.source_type = 'creditCard';
      
      // American Express amounts are usually positive but represent expenses
      if (mapped.amount > 0) {
        mapped.amount = -Math.abs(mapped.amount);
      }
    } else if (fileSource === 'budgetlens') {
      // BudgetLens keeps original signs - amounts are already correctly signed
      mapped.payment_method = mapped.payment_method || 'budgetlens';
      mapped.category_name = mapped.category_name || 'הוצאות משתנות';
    } else {
      mapped.category_name = mapped.category_name || 'הוצאות משתנות';
      mapped.payment_method = mapped.payment_method || fileSource || 'other';
    }
    
    // Set derived fields
    if (mapped.payment_date) {
      const date = moment(mapped.payment_date, 'YYYY-MM-DD');
      if (date.isValid()) {
        mapped.payment_month = date.month() + 1;
        mapped.payment_year = date.year();
        // Only calculate flow_month if not already set from CSV
        if (!mapped.flow_month) {
          mapped.flow_month = date.format('YYYY-MM');
          if (process.env.DEBUG === 'true') {
              console.log(`🔍 [WorkingExcelService] Calculated flow_month: ${mapped.flow_month} from payment_date: ${mapped.payment_date}`);
          }
        } else {
          if (process.env.DEBUG === 'true') {
              console.log(`🔍 [WorkingExcelService] Preserving CSV flow_month: ${mapped.flow_month} for payment_date: ${mapped.payment_date}`);
          }
        }
      }
    }
    
    // Set charge_date if not set
    if (!mapped.charge_date) {
      mapped.charge_date = mapped.payment_date;
    }
  }

  isValidTransaction(transaction) {
    return transaction && 
           transaction.payment_date && 
           transaction.payment_date !== null &&
           transaction.payment_date !== '2000-01-01' && // Reject the old fallback date
           transaction.amount !== null && 
           transaction.amount !== undefined &&
           !isNaN(transaction.amount) &&
           transaction.business_name;
  }

  // Main conversion function - exact copy from old working project logic
  async convert_file_to_df(filePath, fileSource = 'other', paymentMethod = null, paymentIdentifier = null, uploadId = null) {
    try {
      console.log('🔄 Starting file conversion with intelligent header detection...', { filePath, fileSource });
      const ext = path.extname(filePath).toLowerCase();
      let rawData;
      let formatDetection;

      if (ext === '.csv') {
        rawData = await this.readCSVWithHebrewHeaders(filePath);
        if (rawData.length > 0) {
          formatDetection = this.detectFormat(rawData, fileSource);
        }
      } else if (ext === '.xlsx' || ext === '.xls') {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Read top 20 rows to find the header
        const topRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 'A1:Z20' });
        let headerRowIndex = -1;

        for (let i = 0; i < topRows.length; i++) {
          const potentialHeaders = topRows[i].map(cell => String(cell || '').trim());
          console.log(`🔍 Row ${i} potential headers:`, potentialHeaders);
          if (potentialHeaders.length < 2) continue; // Skip empty or sparse rows

          const dummyData = [potentialHeaders.reduce((obj, header) => ({ ...obj, [header]: '' }), {})];
          console.log(`🔍 Row ${i} dummy data:`, dummyData[0]);
          const detectionResult = this.detectFormat(dummyData, fileSource);
          
          // For 'cal', we need a high confidence match
          const requiredConfidence = (fileSource === 'cal' || fileSource === 'isracard') ? 0.7 : 0.5;

          if (detectionResult.confidence >= requiredConfidence) {
            headerRowIndex = i;
            formatDetection = detectionResult;
            console.log(`✅ Header row found for format '${detectionResult.format}' at index ${headerRowIndex} with confidence ${detectionResult.confidence}`);
            break;
          }
        }

        if (headerRowIndex === -1) {
          console.warn('Could not confidently detect header row. Falling back to default parsing from first row.');
          headerRowIndex = 0;
          // Try to detect format from the first row as a fallback
          const fallbackHeaders = topRows[0].map(cell => String(cell || '').trim());
          const dummyData = [fallbackHeaders.reduce((obj, header) => ({ ...obj, [header]: '' }), {})];
          formatDetection = this.detectFormat(dummyData, fileSource);
        }
        
        // Read the sheet using the found header row
        rawData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
        console.log(`📊 Raw data columns after reading from header row ${headerRowIndex}:`, Object.keys(rawData[0] || {}));
        console.log(`📊 First row sample data:`, rawData[0]);

      } else {
        throw new Error('Unsupported file format');
      }

      if (!rawData || rawData.length === 0) {
        console.warn('No data could be read from the file.');
        return { success: true, data: [], currencyGroups: {}, detectedFormat: 'unknown', totalRows: 0, processedTransactions: 0 };
      }

      console.log('📊 Raw data loaded:', { rows: rawData.length, columns: Object.keys(rawData[0] || {}).length });
      
      // Use the detected format from the header finding step
      const detectedFileSource = formatDetection ? formatDetection.format : fileSource;
      console.log(`🎯 Using detected format: '${detectedFileSource}' for mapping.`);

      let processedData = await this.mapSheet(rawData, detectedFileSource, uploadId);
      processedData = this.fixEuroAmounts(processedData);
      
      const currencyGroups = this.groupByCurrency(processedData);
      console.log('💱 Currency groups:', Object.keys(currencyGroups));

      return {
        success: true,
        data: processedData,
        currencyGroups: currencyGroups,
        detectedFormat: detectedFileSource,
        totalRows: rawData.length,
        processedTransactions: processedData.length
      };

    } catch (error) {
      console.error('❌ File conversion error:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  async readCSVFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async readExcelFile(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  }

  detectFormat(data, fileSource) {
    if (!data || data.length === 0) {
      return { format: 'unknown', confidence: 0 };
    }

    const headers = Object.keys(data[0]).map(h => h.trim());
    console.log('🔍 Headers found:', headers);
    
    // Debug: log first few rows for Isracard debugging
    if (fileSource === 'isracard') {
      console.log('🏦 Isracard file - first 3 rows for debugging:');
      for (let i = 0; i < Math.min(3, data.length); i++) {
        console.log(`Row ${i}:`, data[i]);
      }
    }

    // If fileSource is explicitly provided, trust it for known formats
    if (fileSource && fileSource.toLowerCase() === 'budgetlens') {
      // For BudgetLens, check if we have the key columns
      const hasBusinessName = headers.some(h => h.includes('שם העסק') || h.includes('שם בית העסק'));
      const hasAmount = headers.some(h => h.includes('סכום'));
      const hasDate = headers.some(h => h.includes('תאריך התשלום') || h.includes('תאריך'));
      
      if (hasBusinessName && hasAmount && hasDate) {
        console.log('🎯 Forcing BudgetLens format based on fileSource');
        return { 
          format: 'budgetlens', 
          confidence: 1.0,
          bankFormat: this.BANK_FORMATS['budgetlens']
        };
      }
    }

    // Check for specific bank formats
    if (fileSource && this.BANK_FORMATS[fileSource]) {
      const bankFormat = this.BANK_FORMATS[fileSource];
      const hasRequired = bankFormat.requiredColumns.every(col => 
        headers.some(h => h.includes(col) || col.includes(h))
      );
      
      // Also check alternative columns if they exist
      const hasAlternative = bankFormat.alternativeColumns ? 
        bankFormat.alternativeColumns.every(col => 
          headers.some(h => h.includes(col) || col.includes(h))
        ) : false;
      
      // Also check keywords if they exist
      const hasKeywords = bankFormat.keywords ? 
        bankFormat.keywords.some(keyword => 
          headers.some(h => h.includes(keyword) || keyword.includes(h))
        ) : false;
      
      if (hasRequired || hasAlternative || hasKeywords) {
        return { 
          format: fileSource, 
          confidence: 0.9,
          bankFormat: bankFormat
        };
      }
    }

    // Auto-detect based on headers
    for (const [bankName, bankFormat] of Object.entries(this.BANK_FORMATS)) {
      const matches = bankFormat.requiredColumns.filter(col =>
        headers.some(h => h.includes(col) || col.includes(h))
      );
      
      // Also check alternative columns for auto-detection
      const altMatches = bankFormat.alternativeColumns ? 
        bankFormat.alternativeColumns.filter(col =>
          headers.some(h => h.includes(col) || col.includes(h))
        ) : [];
      
      // Also check keywords for auto-detection
      const keywordMatches = bankFormat.keywords ? 
        bankFormat.keywords.filter(keyword =>
          headers.some(h => h.includes(keyword) || keyword.includes(h))
        ) : [];
      
      const totalRequired = bankFormat.requiredColumns.length;
      const totalAltRequired = bankFormat.alternativeColumns ? bankFormat.alternativeColumns.length : 0;
      const totalKeywords = bankFormat.keywords ? bankFormat.keywords.length : 0;
      
      // Check if we have enough matches in any of the categories
      const hasEnoughRequired = matches.length >= totalRequired * 0.7;
      const hasEnoughAlternative = totalAltRequired > 0 && altMatches.length >= totalAltRequired * 0.7;
      const hasKeywordMatch = totalKeywords > 0 && keywordMatches.length > 0;
      
      if (hasEnoughRequired || hasEnoughAlternative || hasKeywordMatch) {
        let confidence = 0.5; // Default confidence for keyword match
        
        if (hasEnoughRequired) {
          confidence = matches.length / totalRequired;
        } else if (hasEnoughAlternative) {
          confidence = altMatches.length / totalAltRequired;
        } else if (hasKeywordMatch) {
          confidence = Math.min(0.8, keywordMatches.length / totalKeywords);
        }
          
        return {
          format: bankName,
          confidence: confidence,
          bankFormat: bankFormat
        };
      }
    }

    // Fallback to generic format
    return { format: 'generic', confidence: 0.5 };
  }

  async applyFormatProcessing(data, formatDetection, paymentMethod, paymentIdentifier, userId = null) {
    console.log('🔧 Applying format processing:', formatDetection.format);
    console.log('📊 Total rows to process:', data.length);
    
    const processedTransactions = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        if (process.env.DEBUG === 'true') {
            console.log(`🔍 Processing row ${i + 1}:`, row);
        }
        const transaction = await this.processRow(row, formatDetection, paymentMethod, paymentIdentifier, userId);
        if (process.env.DEBUG === 'true') {
            console.log(`📝 Transaction result for row ${i + 1}:`, transaction);
        }
        
        if (transaction && transaction.amount !== null && transaction.amount !== undefined && !isNaN(transaction.amount)) {
          if (process.env.DEBUG === 'true') {
              console.log(`✅ Row ${i + 1} passed validation, adding to processed transactions`);
          }
          processedTransactions.push(transaction);
        } else {
          if (process.env.DEBUG === 'true') {
              console.log(`❌ Row ${i + 1} failed validation:`, {
              hasTransaction: !!transaction,
              amount: transaction?.amount,
              isNaN: transaction?.amount ? isNaN(transaction.amount) : 'N/A'
            });
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error processing row ${i + 1}:`, error.message);
      }
    }

    console.log(`📈 Final processed transactions count: ${processedTransactions.length}`);
    return processedTransactions;
  }

  async processRow(row, formatDetection, paymentMethod, paymentIdentifier, userId = null) {
    // Store format detection for use in date parsing
    this.currentFormatDetection = formatDetection;
    const df = {};
    df.source_type = formatDetection.format && formatDetection.format.toLowerCase() === 'bank_yahav' ? 'BankAccount' : 'creditCard';

    const looks_like_date = (val) => {
        if (!val) return false;
        const strVal = String(val).trim();
        
        // Check for Excel serial numbers (common range for recent dates)
        if (/^\d+$/.test(strVal)) {
            const numVal = parseInt(strVal);
            // Excel dates typically start from 1900, serial numbers 40000+ are roughly 2009+
            // 45000+ are roughly 2023+, which makes sense for recent transactions
            if (numVal >= 40000 && numVal <= 50000) {
                console.log(`✅ Detected Excel date serial: ${numVal}`);
                return true;
            }
            return false;
        }
        
        // Don't consider IDs like "131-011822" but allow shorter dates
        if (/^\d+-\d+$/.test(strVal)) return false;
        
        return moment(strVal, moment.ISO_8601, true).isValid() || 
               moment(strVal, 'DD/MM/YYYY', true).isValid() || 
               moment(strVal, 'MM/DD/YYYY', true).isValid() ||
               moment(strVal, 'DD-MM-YYYY', true).isValid() ||
               moment(strVal, 'DD/MM/YY', true).isValid() ||  // Support short year format like 19/7/25
               moment(strVal, 'D/M/YY', true).isValid() ||   // Support single digit day/month
               moment(strVal, 'DD/M/YY', true).isValid() ||  // Support mixed format
               moment(strVal, 'D/MM/YY', true).isValid();
    };

    // Log all columns found in the first row
    if (!this.hasLoggedColumns) {
        logger.info('UPLOAD', 'All columns found in file', {
            columns: Object.keys(row),
            totalColumns: Object.keys(row).length
        });
        this.hasLoggedColumns = true;
    }

    for (const col in row) {
        const lc = col.toLowerCase();
        const val = row[col];
        
        // Debug logging for all columns to see what we're processing
        if (process.env.DEBUG === 'true') {
            console.log(`🔍 Processing column: "${col}" (lowercase: "${lc}") with value: "${val}"`);
        }

        if (lc.includes('תאריך') || lc.includes('date')) {
            if (process.env.DEBUG === 'true') {
                console.log(`🔍 Date column found: "${col}" with value: ${val} (type: ${typeof val})`);
            }
            // Only process if value is not empty and looks like a date
            if (val && val.toString().trim() !== '' && looks_like_date(val)) {
                if (process.env.DEBUG === 'true') {
                    console.log(`✅ Date value "${val}" passed looks_like_date check`);
                }
                // For Isracard, specifically handle purchase date and bank charge date
                if (lc.includes('תאריך רכישה')) {
                    df.payment_date = val;
                    if (process.env.DEBUG === 'true') {
                        console.log(`📅 Set payment_date from תאריך רכישה: ${val}`);
                    }
                } else if (lc.includes('תאריך חיוב בבנק')) {
                    df.charge_date = val;
                    if (process.env.DEBUG === 'true') {
                        console.log(`📅 Set charge_date from תאריך חיוב בבנק: ${val}`);
                    }
                } else if (lc.includes('תאריך החיוב בחשבון') || lc.includes('תאריך החיוב')) {
                    df.charge_date = val;
                    if (process.env.DEBUG === 'true') {
                        console.log(`📅 Set charge_date from תאריך החיוב: ${val}`);
                    }
                } else if (lc.includes('תאריך התשלום') || lc.includes('תאריך עסקה') || (!df.payment_date && (lc.includes('תאריך') || lc.includes('date')))) {
                    df.payment_date = val;
                    console.log(`📅 Set payment_date from תאריך עסקה/תאריך התשלום: ${val}`);
                } else if (!df.charge_date) {
                    df.charge_date = val;
                    if (process.env.DEBUG === 'true') {
                        console.log(`📅 Set charge_date as fallback: ${val}`);
                    }
                }
            } else {
                if (process.env.DEBUG === 'true') {
                    console.warn(`❌ Date value "${val}" did not pass looks_like_date check`);
                }
            }
            continue;
        }

        if (lc.includes('סכום חיוב')) {
            console.log(`💰 Found amount column (סכום חיוב): "${col}" with value: "${val}"`);
            // Use the robust parseAmount function
            let amt = this.parseAmount(val);
            console.log(`💰 Parsed amount result: ${amt}`);
            
            if (amt === null) {
                console.warn(`⚠️ Invalid amount '${val}', setting to 0`);
                amt = 0;
            }
            
            // For credit card formats (Isracard, CAL, Max), multiply by -1 to make it negative (expense)
            if (formatDetection.format && ['isracard', 'cal', 'max'].includes(formatDetection.format.toLowerCase())) {
                df.amount = amt > 0 ? -amt : amt;
                console.log(`💰 Applied ${formatDetection.format} format (negative): ${df.amount}`);
            } else {
                df.amount = amt;
                console.log(`💰 Set amount: ${df.amount}`);
            }
            continue;
        }

        // Handle Cal's "סכום חיוב" specifically
        if (lc.includes('סכום חיוב') || lc.includes('amount') || (lc.includes('סכום') && !lc.includes('מקורי') && !lc.includes('חיוב') && !lc.includes('עסקה')) || lc.includes('charge')) {
            // Use the robust parseAmount function
            let amt = this.parseAmount(val);
            
            if (amt === null) {
                console.warn(`⚠️ Invalid amount '${val}', setting to 0`);
                amt = 0;
            }
            
            // Apply format-specific logic
            if (formatDetection.format && ['isracard', 'gold', 'mastercard', 'visa', 'cal', 'max'].includes(formatDetection.format.toLowerCase())) {
                if (amt > 0) {
                    amt = -Math.abs(amt);
                }
            }
            
            // For BudgetLens, amounts are already properly signed - don't multiply by -1
            if (formatDetection.format && formatDetection.format.toLowerCase() === 'budgetlens') {
                df.amount = amt;
            } else if (formatDetection.format && ['cal', 'max'].includes(formatDetection.format.toLowerCase())) {
                // For Cal and Max, make amounts negative for expenses (unless already negative like refunds)
                df.amount = amt > 0 ? -amt : amt;
            } else {
                df.amount = amt * -1;
            }
            continue;
        }

        if (lc.includes('סכום עסקה מקורי') || lc.includes('סכום מקורי') || lc.includes('סכום עסקה')) {
            const originalAmt = this.parseAmount(val);
            df.original_amount = originalAmt !== null ? originalAmt : 0;
            continue;
        }

        if (lc.includes('שם בית עסק') || lc.includes('שם בית העסק') || lc.includes('שם העסק') || lc.includes('business')) {
            if (process.env.DEBUG === 'true') {
                console.log(`🏢 Found business name column: "${col}" with value: "${val}"`);
            }
            df.business_name = val;
            continue;
        }

        // Handle Bank Yahav specific columns
        if (lc.includes('תיאור פעולה') || lc.includes('שם הפעולה')) {
            if (process.env.DEBUG === 'true') {
                console.log(`🏦 Found Bank Yahav business name column: "${col}" with value: "${val}"`);
            }
            df.business_name = val;
            // Clean up business name - replace '/' with space as per Python code
            if (df.business_name) {
                df.business_name = df.business_name.replace(/\//g, ' ');
            }
            continue;
        }

        if (lc.includes('אסמכתא')) {
            if (process.env.DEBUG === 'true') {
                console.log(`🏦 Found Bank Yahav reference column: "${col}" with value: "${val}"`);
            }
            df.original_identifier = val;
            continue;
        }

        // Handle Bank Yahav debit/credit columns
        if (formatDetection.format && formatDetection.format.toLowerCase() === 'bank_yahav') {
            if (lc.includes('חובה')) {
                if (process.env.DEBUG === 'true') {
                    console.log(`🏦 Found Bank Yahav debit column: "${col}" with value: "${val}"`);
                }
                const debitAmount = this.parseAmount(val);
                if (debitAmount && debitAmount > 0) {
                    df.amount = -debitAmount; // Debit amounts are negative
                    console.log(`💰 Set Bank Yahav debit amount: ${df.amount}`);
                }
                continue;
            }
            
            if (lc.includes('זכות')) {
                if (process.env.DEBUG === 'true') {
                    console.log(`🏦 Found Bank Yahav credit column: "${col}" with value: "${val}"`);
                }
                const creditAmount = this.parseAmount(val);
                if (creditAmount && creditAmount > 0) {
                    df.amount = creditAmount; // Credit amounts are positive
                    console.log(`💰 Set Bank Yahav credit amount: ${df.amount}`);
                }
                continue;
            }
        }

        if (lc.includes('אמצעי') && lc.includes('תשלום')) {
            df.payment_method = val;
            continue;
        }

        if (lc.includes('4 ספרות') || lc.includes('אמצעי זיהוי התשלום') || lc.includes('אמצעי זיהוי')) {
            if (val && val !== 'NaN' && val !== '') {
                const last4 = String(val).replace(/\D/g, '').slice(-4);
                df.payment_identifier = last4.padStart(4, '0');
            }
            continue;
        }

        if (lc.includes('מטבע מקור')) {
            df.original_currency = this.convertCurrencySymbolToCode(val);
            continue;
        }

        if (lc.includes('מטבע') && !lc.includes('מקור')) {
            df.currency = this.convertCurrencySymbolToCode(val);
            continue;
        }

        if (lc.includes('currency')) {
            df.currency = this.convertCurrencySymbolToCode(val);
            continue;
        }

        if (lc.includes('מספר') && (lc.includes('תשלום') || lc.includes('installment'))) {
            df.payment_number = val;
            continue;
        }

        if (lc.includes('תשלומים') || lc.includes('total')) {
            df.total_payments = val;
            continue;
        }

        if (lc.includes('אופן ביצוע ההעסקה')) {
            console.log(`🏷️ Found execution method column: "${col}" with value: "${val}"`);
            df.execution_method = val;
            continue;
        }

        if (lc.includes('קטגוריה בתזרים')) {
            console.log(`🏷️ Found BudgetLens category column (קטגוריה בתזרים): "${col}" with value: "${val}"`);
            df.category_name = val;
            continue;
        }
        
        if (lc.includes('קטגוריה') && !lc.includes('תזרים')) {
            console.log(`🏷️ Found source category column (קטגוריה): "${col}" with value: "${val}"`);
            df.source_category = val;
            continue;
        }

        if (lc.includes('ענף')) {
            console.log(`🏷️ Found source category column (ענף): "${col}" with value: "${val}"`);
            console.log(`🏷️ Setting df.source_category = "${val}"`);
            logger.info('UPLOAD', 'Found ענף column in processRow', {
                columnName: col,
                columnLowercase: lc,
                value: val,
                willSet: 'df.source_category'
            });
            df.source_category = val;
            continue;
        }
        
        // Debug check if column is exactly 'ענף'
        if (col.trim() === 'ענף') {
            console.log(`🎯 Exact match for 'ענף' column found: "${col}" with value: "${val}"`);
            df.source_category = val;
            continue;
        }

        if (lc.includes('category')) {
            df.category_name = val;
            continue;
        }

        if (lc.includes('הערות') || lc.includes('notes')) {
            if (process.env.DEBUG === 'true') {
                console.log(`📝 Found notes column: "${col}" with value: "${val}"`);
            }
            df.notes = val;
            continue;
        }

        if (lc.includes('סוג עסקה')) {
            console.log(`🏷️ Found transaction type column: "${col}" with value: "${val}"`);
            df.transaction_type = val;
            continue;
        }

        if (lc.includes('כמות') || lc.includes('quantity')) {
            df.quantity = parseFloat(String(val).replace(/,/g, ''));
            continue;
        }
        
        // Handle flow_month from CSV (specifically for BudgetLens files)
        if (lc.includes('שייך לתזרים חודש') || lc.includes('flow_month')) {
            if (val && String(val).trim()) {
                df.flow_month = String(val).trim();
                console.log(`🔍 [WorkingExcelService] Found flow_month in CSV: ${df.flow_month}`);
            }
            continue;
        }
    }

    // Always parse and validate the payment date
    if (process.env.DEBUG === 'true') {
        console.log(`🔄 About to parse payment_date: "${df.payment_date}" (type: ${typeof df.payment_date})`);
    }
    df.payment_date = this.parseDate(df.payment_date);
    if (process.env.DEBUG === 'true') {
        console.log(`🔄 After parsing payment_date: "${df.payment_date}"`);
    }
    
    // Set and parse charge_date if not already set - do this BEFORE flow_month calculation
    if (!df.charge_date) {
        df.charge_date = df.payment_date;
    } else {
        df.charge_date = this.parseDate(df.charge_date);
    }
    
    // Extract month and year from the validated date
    const paymentDate = moment(df.payment_date, 'YYYY-MM-DD', true);
    if (paymentDate.isValid()) {
        df.payment_month = paymentDate.month() + 1;
        df.payment_year = paymentDate.year();
        
        // Calculate flow_month based on charge_date minus one month (for Max format)
        if (!df.flow_month) {
            if (df.charge_date && formatDetection.format && formatDetection.format.toLowerCase() === 'max') {
                const chargeDate = moment(df.charge_date, ['DD-MM-YYYY', 'YYYY-MM-DD'], true);
                if (chargeDate.isValid()) {
                    // Calculate flow_month as one month before charge_date
                    const flowMonth = chargeDate.subtract(1, 'month').format('YYYY-MM');
                    df.flow_month = flowMonth;
                    console.log(`🔍 [WorkingExcelService] Calculated flow_month for Max: ${df.flow_month} from charge_date: ${df.charge_date}`);
                    
                    // CRITICAL: Fix payment_date for Max installments
                    if (df.transaction_type && df.transaction_type.includes('תשלומים')) {
                        const originalPaymentDate = moment(df.payment_date, 'YYYY-MM-DD', true);
                        const flowMonthDate = moment(flowMonth + '-01', 'YYYY-MM-DD');
                        
                        console.log(`💳 [MAX] Installment detected for ${df.business_name}:`);
                        console.log(`   Original payment date: ${df.payment_date}`);
                        console.log(`   Charge date: ${df.charge_date}`);
                        console.log(`   Flow month: ${flowMonth}`);
                        
                        // Check if payment_date month is different from flow month
                        if (originalPaymentDate.format('YYYY-MM') !== flowMonth) {
                            // Keep same day, but change to flow month
                            const adjustedDate = moment(flowMonth + '-' + originalPaymentDate.format('DD'), 'YYYY-MM-DD');
                            df.payment_date = adjustedDate.format('YYYY-MM-DD');
                            console.log(`   ✅ Adjusted payment date: ${df.payment_date}`);
                        } else {
                            console.log(`   ✅ Payment date already in correct month, no adjustment needed`);
                        }
                    }
                } else {
                    // Fallback to payment_date if charge_date is invalid
                    df.flow_month = paymentDate.format('YYYY-MM');
                    console.log(`🔍 [WorkingExcelService] Fallback flow_month: ${df.flow_month} from payment_date (invalid charge_date)`);
                }
            } else {
                // For non-Max formats, use payment_date as before
                df.flow_month = paymentDate.format('YYYY-MM');
                console.log(`🔍 [WorkingExcelService] Calculated flow_month: ${df.flow_month} from payment_date: ${df.payment_date}`);
            }
        } else {
            console.log(`🔍 [WorkingExcelService] Preserving CSV flow_month: ${df.flow_month} for payment_date: ${df.payment_date}`);
        }
    } else {
        // Invalid date - return null to indicate this transaction should be skipped
        console.warn(`Transaction with invalid payment_date will be skipped: ${df.business_name || 'Unknown'}`);
        return null;
    }

    df.payment_method = df.payment_method || null;
    df.payment_identifier = df.payment_identifier || paymentIdentifier;
    df.currency = df.currency || 'ILS';
    df.payment_number = df.payment_number || 1;
    df.total_payments = df.total_payments || 1;
    df.excluded_from_flow = df.excluded_from_flow || false;

    if (formatDetection.format) {
        if (formatDetection.format.toLowerCase() === 'isracard') {
            // Try to find category based on business name from existing transactions
            if (df.business_name) {
                df.category_name = await this.getCategoryByBusinessName(df.business_name, df.amount, formatDetection.format, userId) || 'הוצאות משתנות';
            } else {
                df.category_name = 'הוצאות משתנות';
            }
        } else if (formatDetection.format.toLowerCase() === 'max') {
            // For Max files, use auto-categorization based on business name with 90% confidence
            if (df.business_name) {
                df.category_name = await this.getCategoryByBusinessName(df.business_name, df.amount, formatDetection.format, userId) || 'הוצאות משתנות';
            } else {
                df.category_name = 'הוצאות משתנות';
            }
        } else if (formatDetection.format.toLowerCase() === 'cal') {
            // For Cal files, use auto-categorization based on business name with 90% confidence
            if (df.business_name) {
                df.category_name = await this.getCategoryByBusinessName(df.business_name, df.amount, formatDetection.format, userId) || 'הוצאות משתנות';
            } else {
                df.category_name = 'הוצאות משתנות';
            }
        } else if (formatDetection.format.toLowerCase() === 'bank_yahav') {
            // For Bank Yahav files, use auto-categorization based on business name
            if (df.business_name) {
                df.category_name = await this.getCategoryByBusinessName(df.business_name, df.amount, formatDetection.format, userId) || 'הוצאות משתנות';
            } else {
                df.category_name = 'הוצאות משתנות';
            }
        } else if (formatDetection.format.toLowerCase() !== 'budgetlens') {
            // Apply auto-categorization for all non-BudgetLens files
            if (df.business_name) {
                df.category_name = await this.getCategoryByBusinessName(df.business_name, df.amount, formatDetection.format, userId) || 'הוצאות משתנות';
            } else {
                df.category_name = 'הוצאות משתנות';
            }
        }

        // Use the payment method provided by user, or fall back to format
        if (paymentMethod && paymentMethod !== 'creditCard') {
            // For CAL format, use the payment identifier as the payment method
            if (formatDetection.format.toLowerCase() === 'cal' && paymentIdentifier) {
                df.payment_method = paymentIdentifier;
                df.payment_identifier = null; // Set payment_identifier to null for CAL
            } else if (formatDetection.format.toLowerCase() === 'max') {
                // For Max format, payment_identifier comes from the file, use 'max' as payment method
                df.payment_method = 'max';
                // payment_identifier was already set from the '4 ספרות אחרונות של כרטיס האשראי' column
            } else {
                df.payment_method = paymentMethod;
                df.payment_identifier = paymentIdentifier;
            }
        } else if (formatDetection.format.toLowerCase() !== 'other' && !df.payment_method) {
            df.payment_method = formatDetection.format.toLowerCase();
        }
        
        // Set payment_identifier if not already set and not CAL format
        if (!df.payment_identifier && formatDetection.format.toLowerCase() !== 'cal') {
            df.payment_identifier = paymentIdentifier;
        }
    }
    
    const required = [
      "flow_month", "business_name", "payment_method", "payment_identifier",
      "payment_date", "payment_month", "payment_year", "charge_date", "amount",
      "currency", "payment_number", "total_payments", "category_name",
      "excluded_from_flow", "notes", "source_type", "original_amount",
      "source_category", "transaction_type", "execution_method"
    ];

    const transaction = { id: uuidv4() };
    for (const col of required) {
        transaction[col] = df[col] !== undefined ? df[col] : null;
    }
    
    // Debug logging for source_category specifically
    if (process.env.DEBUG === 'true') {
        console.log(`🔍 Final transaction source_category: "${transaction.source_category}" (from df.source_category: "${df.source_category}")`);  
    }
    logger.info('UPLOAD', 'Final transaction source_category check', {
        df_source_category: df.source_category,
        transaction_source_category: transaction.source_category,
        business_name: transaction.business_name
    });
    if (df.source_category) {
        if (process.env.DEBUG === 'true') {
            console.log(`✅ source_category is set: "${df.source_category}"`);
        }
    } else {
        if (process.env.DEBUG === 'true') {
            console.log(`❌ source_category is missing or null`);
        }
    }
    
    // CRITICAL DEBUG - Log the complete transaction object structure
    if (process.env.DEBUG === 'true') {
        console.log(`🔍 [CRITICAL DEBUG] Complete transaction object for ${transaction.business_name}:`, {
            id: transaction.id,
            business_name: transaction.business_name,
            source_category: transaction.source_category,
            hasSourceCategory: transaction.hasOwnProperty('source_category'),
            allKeys: Object.keys(transaction)
        });
    }
    
    // Final validation to prevent database errors
    // Ensure amount is a valid number
    if (transaction.amount === null || isNaN(transaction.amount) || !isFinite(transaction.amount)) {
        console.warn(`⚠️ Invalid amount detected, setting to 0 for transaction: ${transaction.business_name}`);
        transaction.amount = 0;
    }
    
    // Ensure original_amount is valid
    if (transaction.original_amount === null || isNaN(transaction.original_amount) || !isFinite(transaction.original_amount)) {
        transaction.original_amount = 0;
    }
    
    // Ensure payment_date is valid YYYY-MM-DD format
    if (!transaction.payment_date || !moment(transaction.payment_date, 'YYYY-MM-DD', true).isValid()) {
        console.warn(`⚠️ Invalid payment_date detected, skipping transaction: ${transaction.business_name}`);
        return null; // Skip this transaction if payment_date is invalid
    }
    
    // Ensure charge_date is valid
    if (!transaction.charge_date || !moment(transaction.charge_date, 'YYYY-MM-DD', true).isValid()) {
        transaction.charge_date = transaction.payment_date;
    }
    
    // Ensure numeric fields are valid
    transaction.payment_number = !isNaN(transaction.payment_number) ? transaction.payment_number : 1;
    transaction.total_payments = !isNaN(transaction.total_payments) ? transaction.total_payments : 1;
    transaction.payment_month = !isNaN(transaction.payment_month) ? transaction.payment_month : 1;
    transaction.payment_year = !isNaN(transaction.payment_year) ? transaction.payment_year : 2000;
    
    // Ensure boolean field is properly set
    transaction.excluded_from_flow = Boolean(transaction.excluded_from_flow);
    
    // Ensure string fields are not null
    transaction.business_name = transaction.business_name || 'Unknown Business';
    transaction.currency = transaction.currency || 'ILS';
    transaction.category_name = transaction.category_name || 'הוצאות משתנות';
    transaction.notes = transaction.notes || '';
    transaction.flow_month = transaction.flow_month || '2000-01';
    
    // Extract recipient_name from notes if pattern exists
    this.extractRecipientFromNotes(transaction);
    
    // Debug: Log recipient_name after extraction
    if (transaction.recipient_name) {
      console.log(`✅ [RECIPIENT PRESERVED] Transaction ${transaction.business_name} has recipient_name: "${transaction.recipient_name}"`);
    }
    
    transaction.transaction_hash = SupabaseService.generateTransactionHash(transaction);
    
    // Debug: Final check that recipient_name is still there
    if (transaction.recipient_name) {
      console.log(`🔧 [FINAL CHECK] Transaction ${transaction.business_name} still has recipient_name: "${transaction.recipient_name}" before return`);
    }

    return transaction;
  }

  extractRecipientFromNotes(transaction) {
    if (!transaction.notes || typeof transaction.notes !== 'string') {
      return;
    }
    
    const notes = transaction.notes.trim();
    if (!notes) {
      return;
    }
    
    // Debug: Log the notes we're trying to extract from
    console.log(`🔍 [EXTRACTION DEBUG] Processing notes: "${notes}" for business: "${transaction.business_name}"`);
    console.log(`🔍 [EXTRACTION DEBUG] Notes length: ${notes.length}, Contains ל-: ${notes.includes('ל-')}`);
    console.log(`🔍 [EXTRACTION DEBUG] Notes includes שוברים: ${notes.includes('שוברים')}, שובר: ${notes.includes('שובר')}`);
    console.log(`🔍 [EXTRACTION DEBUG] Notes includes למי: ${notes.includes('למי:')}`);
    
    
    // Pattern 1: "למי: [name]" - capture the full name until end of line or string
    let recipientMatch = notes.match(/למי:\s*(.+?)(?:\n|$)/);
    if (recipientMatch) {
      const recipientName = recipientMatch[1].trim();
      transaction.recipient_name = recipientName;
      // Remove the entire "למי: [name]" pattern from notes
      transaction.notes = notes.replace(/למי:\s*.+?(?:\n|$)/g, '').trim() || null;
      console.log(`🎯 [SERVER EXTRACTION] Found recipient with "למי:" pattern: "${recipientName}"`);
      return;
    }
    
    // Pattern 2: "שובר ל-[name]" or "שוברים ל-[name]" or "שוברים לקניה ב-[name]"
    recipientMatch = notes.match(/שוברי?ם?\s*ל(?:קניה\s+ב)?-(.+?)(?:\s|$)/);
    if (recipientMatch) {
      const recipientName = recipientMatch[1].trim();
      transaction.recipient_name = recipientName;
      // Remove the entire pattern from notes  
      transaction.notes = notes.replace(/שוברי?ם?\s*ל(?:קניה\s+ב)?-.+?(?:\s|$)/g, '').trim() || null;
      console.log(`🎯 [SERVER EXTRACTION] Found recipient with "שובר/שוברים ל-" pattern: "${recipientName}"`);
      console.log(`🎯 [SERVER EXTRACTION] Original notes: "${notes}"`);
      console.log(`🎯 [SERVER EXTRACTION] Updated notes: "${transaction.notes}"`);
      return;
    }
    
    // Pattern 3: "שובר מ-[name]" or "שוברים מ-[name]"
    recipientMatch = notes.match(/שוברי?ם?\s*מ-(.+?)(?:\s|$)/);
    if (recipientMatch) {
      const recipientName = recipientMatch[1].trim();
      transaction.recipient_name = recipientName;
      // Remove the entire pattern from notes
      transaction.notes = notes.replace(/שוברי?ם?\s*מ-.+?(?:\s|$)/g, '').trim() || null;
      console.log(`🎯 [SERVER EXTRACTION] Found recipient with "שובר/שוברים מ-" pattern: "${recipientName}"`);
      console.log(`🎯 [SERVER EXTRACTION] Original notes: "${notes}"`);
      console.log(`🎯 [SERVER EXTRACTION] Updated notes: "${transaction.notes}"`);
      return;
    }
  }

  findColumnValue(row, possibleColumns) {
    for (const col of possibleColumns) {
      for (const [key, value] of Object.entries(row)) {
        if (key.includes(col) || col.includes(key)) {
          return value;
        }
      }
    }
    return null;
  }

  parseDate(dateStr) {
    return this.ensureDateFormat(dateStr);
  }

  // Exact implementation of Flask's ensure_date_format function
  ensureDateFormat(dateStr) {
    if (!dateStr) return null;
    
    const dateString = String(dateStr);
    if (process.env.DEBUG === 'true') {
        console.log(`🔍 ensureDateFormat input: "${dateStr}" -> string: "${dateString}"`);
    }
    
    // Use static cache to avoid re-converting same dates
    if (!WorkingExcelService.dateCache) {
      WorkingExcelService.dateCache = new Map();
    }
    
    if (WorkingExcelService.dateCache.has(dateString)) {
      return WorkingExcelService.dateCache.get(dateString);
    }
    
    try {
      // Check if the date is already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        WorkingExcelService.dateCache.set(dateString, dateString);
        return dateString;
      }

      // Check for DD/MM/YYYY format (common in European/Israeli dates) - MOVED BEFORE EXCEL SERIAL CHECK
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        const [day, month, year] = dateString.split('/');
        const paddedMonth = String(parseInt(month)).padStart(2, '0');
        const paddedDay = String(parseInt(day)).padStart(2, '0');
        const result = `${year}-${paddedMonth}-${paddedDay}`;
        if (process.env.DEBUG === 'true') {
            console.log(`📅 DD/MM/YYYY format: ${dateString} -> ${result}`);
        }
        WorkingExcelService.dateCache.set(dateString, result);
        return result;
      }

      // Check for DD/MM/YY format (2-digit year)
      if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateString)) {
        const [day, month, year] = dateString.split('/');
        const paddedMonth = String(parseInt(month)).padStart(2, '0');
        const paddedDay = String(parseInt(day)).padStart(2, '0');
        // Convert 2-digit year to 4-digit (assuming 20xx for years 00-49, 19xx for 50-99)
        const fullYear = parseInt(year) <= 49 ? `20${year}` : `19${year}`;
        const result = `${fullYear}-${paddedMonth}-${paddedDay}`;
        if (process.env.DEBUG === 'true') {
            console.log(`📅 DD/MM/YY format: ${dateString} -> ${result}`);
        }
        WorkingExcelService.dateCache.set(dateString, result);
        return result;
      }

      // Check for DD-MM-YYYY format - MOVED BEFORE EXCEL SERIAL CHECK
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateString)) {
        const [day, month, year] = dateString.split('-');
        const paddedMonth = String(parseInt(month)).padStart(2, '0');
        const paddedDay = String(parseInt(day)).padStart(2, '0');
        const result = `${year}-${paddedMonth}-${paddedDay}`;
        WorkingExcelService.dateCache.set(dateString, result);
        return result;
      }

      // Handle Excel serial date numbers (like 44927 or 45857)
      // Exclude years (1900-2100) to prevent misinterpreting years as serial dates
      const serialNum = parseInt(dateString);
      console.log(`🔍 Testing Excel serial: ${serialNum}, isNaN: ${isNaN(serialNum)}, > 1: ${serialNum > 1}, < 100000: ${serialNum < 100000}, not year: ${!(serialNum >= 1900 && serialNum <= 2100)}`);
      if (!isNaN(serialNum) && serialNum >= 40000 && serialNum <= 50000) {
        console.log(`✅ Processing as Excel serial date: ${serialNum}`);
        // Excel epoch starts from 1900-01-01 (but Excel incorrectly treats 1900 as leap year)
        // Add 1 day because Excel treats 1900-01-01 as day 1 not day 0
        const excelEpoch = new Date(1900, 0, 1);
        let adjustedSerial = serialNum;
        
        // CAL format has an off-by-one error in date serialization - subtract 1 day
        if (this.currentFormatDetection && this.currentFormatDetection.format === 'cal') {
          adjustedSerial = serialNum - 1;
          console.log(`🔧 CAL format detected, adjusting serial from ${serialNum} to ${adjustedSerial}`);
        }
        
        const daysSinceEpoch = adjustedSerial - 1;
        const convertedDate = new Date(excelEpoch.getTime() + (daysSinceEpoch * 24 * 60 * 60 * 1000));
        
        if (!isNaN(convertedDate.getTime())) {
          const year = convertedDate.getFullYear();
          const month = String(convertedDate.getMonth() + 1).padStart(2, '0');
          const day = String(convertedDate.getDate()).padStart(2, '0');
          const result = `${year}-${month}-${day}`;
          console.log(`✅ Excel serial ${serialNum} converted to: ${result}`);
          WorkingExcelService.dateCache.set(dateString, result);
          return result;
        }
      }

      // Handle standalone year values (convert to first day of year)
      if (/^\d{4}$/.test(dateString) && serialNum >= 1900 && serialNum <= 2100) {
        const result = `${serialNum}-01-01`;
        WorkingExcelService.dateCache.set(dateString, result);
        return result;
      }

      // For other formats, try to parse with moment, but EXPLICITLY format the result
      // Try with day first (European format)
      let dateObj = moment(dateString, moment.ISO_8601, true);
      if (!dateObj.isValid()) {
        dateObj = moment(dateString, ['DD/MM/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY'], true);
      }
      
      if (!dateObj.isValid()) {
        // Try with year first as a fallback
        dateObj = moment(dateString, ['YYYY-MM-DD', 'YYYY/MM/DD', 'MM/DD/YYYY'], true);
      }

      if (dateObj.isValid()) {
        // Format to YYYY-MM-DD
        const result = dateObj.format('YYYY-MM-DD');
        WorkingExcelService.dateCache.set(dateString, result);
        return result;
      }

      // If all parsing fails, return null instead of fallback date
      console.warn(`❌ Unable to parse date: ${dateString} (original: ${dateStr})`);
      WorkingExcelService.dateCache.set(dateString, null);
      return null;
    } catch (error) {
      console.error(`Error formatting date ${dateStr}:`, error);
      return null;
    }
  }

  // Exact implementation of Flask's ensure_proper_amount function
  ensureProperAmount(transaction) {
    if (!transaction || typeof transaction !== 'object') return;
    
    // Ensure amount field exists and is numeric
    if (transaction.amount === null || transaction.amount === undefined || 
        isNaN(transaction.amount) || !isFinite(transaction.amount)) {
      console.warn(`⚠️ Invalid amount detected, setting to 0 for transaction: ${transaction.business_name || 'Unknown'}`);
      transaction.amount = 0;
    }
    
    // Ensure original_amount field is numeric
    if (transaction.original_amount !== null && transaction.original_amount !== undefined &&
        (isNaN(transaction.original_amount) || !isFinite(transaction.original_amount))) {
      transaction.original_amount = 0;
    }
    
    // Convert to proper numbers
    transaction.amount = parseFloat(transaction.amount) || 0;
    if (transaction.original_amount !== null && transaction.original_amount !== undefined) {
      transaction.original_amount = parseFloat(transaction.original_amount) || 0;
    }
  }

  parseAmount(value) {
    if (!value || value === null || value === undefined || value === '' || value === 'NaN') return null;
    
    let valStr = String(value).trim();
    if (valStr === '' || valStr === '-' || valStr === 'NaN' || valStr === 'nan') return null;

    // Check for Euro symbol to handle negative values correctly
    const hasEuro = valStr.includes('€');
    const hasMinus = valStr.includes('-');

    // Remove currency symbols and clean
    valStr = valStr
      .replace(/[€$₪£¥₹₩]/g, '')
      .replace(/,/g, '.') // Convert commas to dots for European format
      .replace(/[^\d.\-]/g, '') // Keep only digits, dots, and minus
      .trim();

    if (!/\d/.test(valStr)) return null;

    try {
      let amount = parseFloat(valStr);
      if (isNaN(amount) || !isFinite(amount)) return null;
      
      // Handle Euro negative values logic from Flask
      // Only convert to negative if this is explicitly an expense transaction
      // For BudgetLens format, preserve original signs
      if (hasEuro && !hasMinus && amount > 0 && this.fileSource !== 'budgetlens') {
        amount = -amount;
      }
      
      return amount;
    } catch (error) {
      return null;
    }
  }

  parseCurrency(value) {
    if (!value) return null;
    
    const valStr = String(value).trim();
    
    // Check for currency symbols
    for (const [symbol, code] of Object.entries(this.CURRENCY_SYMBOLS)) {
      if (valStr.includes(symbol)) {
        return code;
      }
    }

    // Check for ISO codes
    if (/^[A-Z]{3}$/.test(valStr)) {
      return valStr;
    }

    return null;
  }

  groupByCurrency(transactions) {
    const groups = {};
    
    for (const transaction of transactions) {
      const currency = transaction.currency || 'ILS';
      
      if (!groups[currency]) {
        groups[currency] = {
          currency: currency,
          transactions: [],
          totalAmount: 0,
          count: 0
        };
      }
      
      groups[currency].transactions.push(transaction);
      groups[currency].totalAmount += Math.abs(transaction.amount || 0);
      groups[currency].count++;
      
      // Debug: Check if recipient_name survives groupByCurrency
      if (transaction.recipient_name) {
        console.log(`📦 [GROUP BY CURRENCY] Transaction ${transaction.business_name} has recipient_name: "${transaction.recipient_name}"`);
      }
    }

    console.log('💱 Currency grouping complete:', 
      Object.keys(groups).map(curr => `${curr}: ${groups[curr].count} transactions`)
    );
    
    return groups;
  }

  async processTransactionsInBatches(transactions, userId, cashFlowId = null, progressCallback = null, checkDuplicates = false) {
    const BATCH_SIZE = 500; // Process 500 transactions at a time
    const result = {
      success: true,
      imported: 0,
      duplicates: 0,
      errors: 0,
      error_details: [],
    };

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      
      // CRITICAL DEBUG - Check source_category before sending to batch
      console.log(`🔍 [BATCH SEND DEBUG] Sending batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batch.length} transactions:`);
      batch.forEach((tx, idx) => {
        if (idx < 3) { // Log first 3 transactions in each batch
          console.log(`   Transaction ${idx}: ${tx.business_name} -> source_category: "${tx.source_category}" (has property: ${tx.hasOwnProperty('source_category')})`);
        }
      });
      
      if (progressCallback) {
        progressCallback('processing_batch', {
          status: `Processing batch ${i / BATCH_SIZE + 1}`,
          progress: (i / transactions.length) * 100,
        });
      }

      const batchResult = await SupabaseService.createTransactionsBatch(batch, !checkDuplicates);
      
      result.imported += batchResult.imported;
      result.duplicates += batchResult.duplicates;
      result.errors += batchResult.errors;
      if (batchResult.error) {
        result.error_details.push(batchResult.error);
      }
    }

    return result;
  }

  // Exact implementation of Flask's process_transactions_one_by_one function
  async processTransactionsOneByOne(transactions, userId, cashFlowId = null, progressCallback = null, checkDuplicates = false) {
    const fs = require('fs');
    const path = require('path');

    // Set up initial result structure
    const result = {
      success: true,
      imported: 0,
      errors: 0,
      duplicates: [],
      error_details: [],
      retried_transactions: []
    };

    // Track potential duplicates
    const potentialDuplicates = [];
    const processedTransactionHashes = new Set();

    // Always group by currency
    const currencyGroups = {};

    // Get cash flow currency for information purposes
    let cashFlowCurrency = 'ILS';
    if (cashFlowId) {
      try {
        const cashFlow = await SupabaseService.getCashFlow(cashFlowId);
        cashFlowCurrency = (cashFlow || {}).currency || 'ILS';
      } catch (error) {
        cashFlowCurrency = 'ILS';
      }
    }

    const progressTotal = transactions.length;
    result.start_time = Date.now();

    // Batch check for existing duplicates in database (much faster than individual queries)
    let existingHashesSet = new Set();
    if (checkDuplicates) {
      if (progressCallback) {
        progressCallback('checking_duplicates', {
          status: 'בודק כפילויות במסד נתונים...',
          progress: 15
        });
      }

      const allHashes = transactions.map(t => t.transaction_hash).filter(Boolean);
      console.log(`🔍 [בדיקת כפילויות] בודק ${allHashes.length} hashes במסד נתונים באצווה...`);
      
      const existingHashes = await SupabaseService.getExistingHashesBatch(userId, allHashes, cashFlowId);
      existingHashesSet = new Set(existingHashes);
      console.log(`📊 [תוצאות בדיקת כפילויות] נמצאו ${existingHashes.length} כפילויות במסד נתונים`);
    }

    // First pass: prepare transactions and group by currency
    console.log(`📋 [התחלת עיבוד] סה״כ עסקאות לעיבוד: ${progressTotal} | בדיקת כפילויות: ${checkDuplicates}`);
    
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      
      if (i % 10 === 0 && progressCallback) {
        const progressPercent = 20 + (i / progressTotal * 30);
        progressCallback('processing_transactions', {
          status: `Preparing transaction ${i + 1} of ${progressTotal}`,
          progress: Math.min(50, progressPercent),
          current: i + 1,
          total: progressTotal
        });
      }

      // Yield control every 50 transactions to prevent blocking
      if (i % 50 === 0 && i > 0) {
        await new Promise(resolve => setImmediate(resolve));
      }

      try {
        // Add necessary fields if not present
        if (!transaction.user_id) transaction.user_id = userId;
        if (cashFlowId && !transaction.cash_flow_id) transaction.cash_flow_id = cashFlowId;
        
        this.ensureProperAmount(transaction);
        
        if (transaction.payment_date) {
          const formattedPaymentDate = this.ensureDateFormat(transaction.payment_date);
          if (formattedPaymentDate) {
            transaction.payment_date = formattedPaymentDate;
          } else {
            console.warn(`Invalid payment_date for transaction: ${transaction.business_name || 'Unknown'}, removing transaction`);
            return; // Skip this transaction if payment_date is invalid
          }
        }
        if (transaction.charge_date) {
          const formattedChargeDate = this.ensureDateFormat(transaction.charge_date);
          transaction.charge_date = formattedChargeDate; // charge_date can be null
        }
        
        if (!transaction.payment_number) transaction.payment_number = 1;
        if (!transaction.total_payments) transaction.total_payments = 1;
        if (transaction.excluded_from_flow === undefined) transaction.excluded_from_flow = false;
        
        if (!transaction.source_type) {
          if (transaction.source) {
            transaction.source_type = transaction.source;
          } else {
            transaction.source_type = 'file_import';
          }
        }
        
        if (!transaction.currency) transaction.currency = 'ILS';

        // Generate transaction hash
        if (!transaction.transaction_hash) {
          transaction.transaction_hash = SupabaseService.generateTransactionHash(transaction);
        }

        if (!transaction.created_at) {
          transaction.created_at = new Date().toISOString();
        }
        if (!transaction.updated_at) {
          transaction.updated_at = new Date().toISOString();
        }

        // Filter: Only send valid DB columns
        const validColumns = new Set([
          'id', 'user_id', 'business_name', 'payment_date', 'amount', 'currency',
          'payment_method', 'payment_identifier', 'category_id', 'payment_month',
          'payment_year', 'flow_month', 'charge_date', 'notes', 'excluded_from_flow',
          'source_type', 'original_amount', 'transaction_hash', 'created_at',
          'updated_at', 'cash_flow_id', 'is_transfer', 'linked_transaction_id',
          'category_name', 'payment_number', 'total_payments', 'original_currency',
          'exchange_rate', 'exchange_date', 'quantity', 'source_category'
        ]);

        // Remove 'category' field if present (not in DB)
        if (transaction.category) delete transaction.category;
        
        // Remove any keys not in valid_columns
        Object.keys(transaction).forEach(key => {
          if (!validColumns.has(key)) {
            delete transaction[key];
          }
        });

        // Final ensure: Fix date format before DB insert
        if (transaction.payment_date) {
          const formattedPaymentDate = this.ensureDateFormat(transaction.payment_date);
          if (formattedPaymentDate) {
            transaction.payment_date = formattedPaymentDate;
          } else {
            console.warn(`Invalid payment_date for transaction: ${transaction.business_name || 'Unknown'}, removing transaction`);
            return; // Skip this transaction if payment_date is invalid
          }
        }
        if (transaction.charge_date) {
          const formattedChargeDate = this.ensureDateFormat(transaction.charge_date);
          transaction.charge_date = formattedChargeDate; // charge_date can be null
        }

        // Group by currency
        const currency = (transaction.currency || 'ILS').toUpperCase();
        if (!currencyGroups[currency]) {
          currencyGroups[currency] = [];
        }

        // Add to currency group
        currencyGroups[currency].push(transaction);

        // If checking for duplicates, do it here
        if (checkDuplicates) {
          const businessName = transaction.business_name || 'Unknown';
          const amount = transaction.amount || 'Unknown';
          const paymentDate = transaction.payment_date || 'Unknown';
          const transactionHash = transaction.transaction_hash || 'No Hash';

          console.log(`🔍 [שלב ראשוני] בודק עסקה: ${businessName} | סכום: ${amount} | תאריך: ${paymentDate}`);
          
          if (businessName.toUpperCase().includes('BRUSSELS')) {
            console.warn(`🛩️ [BRUSSELS AIRLINES זוהה] Hash מלא: ${transactionHash} | עסקה #${i + 1}`);
          }

          // Fast check for duplicates in database using pre-loaded set
          if (existingHashesSet.has(transaction.transaction_hash)) {
            // Found duplicate in database - add to duplicates for review
            console.warn(`❌ [שלב ראשוני] כפילות במסד נתונים: ${businessName}`);
            potentialDuplicates.push({
              existing: { transaction_hash: transaction.transaction_hash }, // Minimal info for duplicate
              new: transaction,
              transaction_hash: transaction.transaction_hash,
              is_batch_duplicate: false
            });
            continue;
          }

          // Check for duplicates within the current batch ONLY
          console.log(`🔍 [בדיקת כפילויות פנימיות] Hash: ${transaction.transaction_hash.substring(0, 8)}... | נמצא ב-processed: ${processedTransactionHashes.has(transaction.transaction_hash)}`);
          
          if (processedTransactionHashes.has(transaction.transaction_hash)) {
            console.warn(`🔄 [זוהתה כפילות פנימית] Hash: ${transaction.transaction_hash.substring(0, 8)}... | מחפש עסקה קיימת...`);
            
            // Find the existing transaction in the batch that has the same hash
            let existingTransaction = null;
            for (const existingTx of currencyGroups[currency] || []) {
              if (existingTx.transaction_hash === transaction.transaction_hash && existingTx !== transaction) {
                existingTransaction = existingTx;
                console.log(`✅ [נמצאה עסקה קיימת] ${existingTx.business_name || 'Unknown'}`);
                break;
              }
            }

            if (existingTransaction) {
              // Add to duplicates for review - this is a within-file duplicate
              console.warn(`🔄 [שלב ראשוני] כפילות בתוך הקובץ: ${businessName}`);
              potentialDuplicates.push({
                existing: existingTransaction,
                new: transaction,
                transaction_hash: transaction.transaction_hash,
                is_batch_duplicate: true
              });
            }
            continue;
          }

          // Add to processed hashes only if not a duplicate
          console.log(`✅ [שלב ראשוני] עסקה ייחודית: ${businessName}`);
          console.log(`➕ [הוספת Hash לprocessed] Hash: ${transaction.transaction_hash.substring(0, 8)}... | גודל processed כעת: ${processedTransactionHashes.size}`);
          processedTransactionHashes.add(transaction.transaction_hash);
        }

      } catch (error) {
        result.errors += 1;
        const errorMsg = error.message;
        result.error_details.push({
          business_name: transaction.business_name || 'Unknown',
          error: errorMsg
        });
      }
    }

    if (progressCallback) {
      progressCallback('currency_grouping_complete', {
        status: `Grouped transactions by currency: ${Object.keys(currencyGroups).join(', ')}`,
        progress: 60,
        currency_count: Object.keys(currencyGroups).length
      });
    }

    // If we've checked for duplicates, add them to the result
    console.warn(`🔍 [Final Duplicate Count] Found ${potentialDuplicates.length} duplicates, check_duplicates=${checkDuplicates}`);
    
    if (checkDuplicates && potentialDuplicates.length > 0) {
      result.duplicates = potentialDuplicates;
      const tempId = uuidv4();
      result.temp_duplicates_id = tempId;
      result.has_duplicates = true;
      console.warn(`✅ [Duplicates Saved] Saved ${potentialDuplicates.length} duplicates with temp_id: ${tempId}`);

      // Save the duplicates to a file for future use
      const uploadFolder = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadFolder)) {
        fs.mkdirSync(uploadFolder, { recursive: true });
      }

      const duplicatesFilePath = path.join(uploadFolder, `temp_duplicates_${tempId}.json`);

      // Format duplicates data for the file
      const duplicatesData = {
        duplicates: potentialDuplicates,
        cash_flow_id: cashFlowId,
        created_at: new Date().toISOString(),
        user_id: userId
      };

      // Save the duplicates file
      fs.writeFileSync(duplicatesFilePath, JSON.stringify(duplicatesData, null, 2), 'utf8');

      // Append values to result for easier detection
      result.duplicates_file_path = duplicatesFilePath;
    } else {
      result.has_duplicates = false;
    }

    // Always save currency groups, even if there's only one
    const tempId = uuidv4();
    const uploadFolder = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadFolder)) {
      fs.mkdirSync(uploadFolder, { recursive: true });
    }

    // Format currency groups data
    const formattedCurrencyGroups = {};
    Object.keys(currencyGroups).forEach(currency => {
      const transactionsList = currencyGroups[currency];
      formattedCurrencyGroups[currency] = {
        transactions: transactionsList,
        count: transactionsList.length,
        primary: currency === cashFlowCurrency
      };
    });

    // Save to temp file
    const tempFilePath = path.join(uploadFolder, `currency_groups_${tempId}.json`);
    const currencyGroupsData = {
      currencies: formattedCurrencyGroups,
      cash_flow_id: cashFlowId,
      cash_flow_currency: cashFlowCurrency,
      user_id: userId,
      created_at: new Date().toISOString()
    };

    fs.writeFileSync(tempFilePath, JSON.stringify(currencyGroupsData, null, 2), 'utf8');

    // Update result
    result.multiple_currencies = true; // Force currency review screen
    result.currency_groups = formattedCurrencyGroups;
    result.currency_groups_temp_id = tempId;
    result.processing_time = Date.now() - result.start_time;
    result.total = progressTotal;

    const msg = `[PROCESS SUMMARY] Processed ${transactions.length} transactions across ${Object.keys(currencyGroups).length} currencies. Found ${result.duplicates.length} duplicates. Ready for currency groups review.`;
    console.log(msg);

    if (progressCallback) {
      progressCallback('currency_groups_ready', {
        status: 'Currency groups ready for review',
        progress: 95,
        currency_groups_temp_id: tempId,
        currency_count: Object.keys(currencyGroups).length
      });
    }

    return result;
  }

  // Detect file type from extension
  detectFileType(filePath) {
    const path = require('path');
    const fs = require('fs');

    // Check if path is a directory
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory()) {
      return 'directory';
    }

    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) {
      return 'excel';
    } else if (ext === '.csv') {
      return 'csv';
    } else {
      return 'unknown';
    }
  }

  // Generate transaction hash (delegate to SupabaseService)
  generateTransactionHash(transaction) {
    return SupabaseService.generateTransactionHash(transaction);
  }

  // Exact implementation of Flask's process_directory_files function
  async processDirectoryFiles(directoryPath, userId, cashFlowId = null, fileSource = null, 
                              paymentMethod = null, paymentIdentifier = null, 
                              progressCallback = null, combineFiles = true, 
                              skipDuplicates = true, paymentMethodOverride = '', 
                              paymentIdentifierOverride = '') {
    const startTime = Date.now();
    const fs = require('fs');
    const path = require('path');
    const glob = require('glob');

    // Initialize variables
    let allTransactions = [];
    const fileResults = [];
    let allFiles = [];
    let importedCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    // Progress tracking variables
    let totalFilesProcessed = 0;

    // Find all supported files in the directory
    const extensions = ['.xlsx', '.xls', '.csv'];
    for (const ext of extensions) {
      const pattern = path.join(directoryPath, `*${ext}`);
      const matchingFiles = glob.sync(pattern);
      allFiles = allFiles.concat(matchingFiles);
    }

    // Sort files by name for consistent processing
    allFiles.sort();
    const totalFiles = allFiles.length;

    // Check if we found any files
    if (allFiles.length === 0) {
      const errorMsg = `No supported files found in directory: ${directoryPath}`;
      console.error(errorMsg);
      if (progressCallback) {
        progressCallback('error', { status: errorMsg, progress: 0 });
      }
      return { success: false, message: errorMsg, files_found: 0 };
    }

    // Initial progress update
    if (progressCallback) {
      progressCallback('directory_scan', {
        status: `Found ${totalFiles} files to process`,
        progress: 5,
        files_found: totalFiles
      });
    }

    // Process each file individually
    for (let fileIndex = 0; fileIndex < allFiles.length; fileIndex++) {
      const filePath = allFiles[fileIndex];
      const fileName = path.basename(filePath);

      // Update progress
      if (progressCallback) {
        const fileProgress = 5 + (fileIndex / totalFiles * 45); // 5% to 50% is for individual file processing
        progressCallback('processing_file', {
          status: `Processing file ${fileIndex + 1}/${totalFiles}: ${fileName}`,
          progress: Math.round(fileProgress),
          current_file: fileIndex + 1,
          total_files: totalFiles
        });
      }

      try {
        // Create a more limited progress callback for individual files
        const fileProgressCallback = (eventType, data) => {
          if (progressCallback) {
            // Scale down the individual file progress to fit within our overall progress
            if (data.progress !== undefined) {
              // Scale progress to fit between fileProgress and fileProgress + (45/totalFiles)
              const fileProgressRange = 45 / totalFiles;
              const scaledProgress = fileProgress + (data.progress / 100) * fileProgressRange;
              data.progress = Math.round(scaledProgress);
            }

            // Add file context to events
            data.current_file = fileIndex + 1;
            data.total_files = totalFiles;
            data.file_name = fileName;

            // Forward to main progress callback
            progressCallback(`file_${eventType}`, data);
          }
        };

        try {
          // Detect file type
          const fileType = this.detectFileType(filePath);

          // Convert the file to a standard DataFrame equivalent (array of objects)
          const conversionResult = await this.convert_file_to_df_large(
            filePath,
            fileSource,
            paymentMethodOverride,
            paymentIdentifierOverride,
            fileProgressCallback,
            null, // uploadId
            {}, // dateFilterOptions
            userId
          );

          if (!conversionResult.success) {
            throw new Error(conversionResult.error);
          }

          let fileTransactions = conversionResult.data || [];

          // Check for empty transactions
          if (fileTransactions.length === 0) {
            errorCount += 1;
            fileResults.push({
              file_name: fileName,
              status: 'error',
              message: 'No valid data found in file',
              transaction_count: 0
            });
            continue;
          }

          // Add necessary fields to each transaction
          for (const transaction of fileTransactions) {
            // Add user ID and cash flow ID
            transaction.user_id = userId;
            if (cashFlowId) {
              transaction.cash_flow_id = cashFlowId;
            }

            // Make sure category_name is preserved from category if present
            if (transaction.category && !transaction.category_name) {
              transaction.category_name = transaction.category;
            }

            // Clean up null values for numeric fields
            for (const field of ['amount', 'original_amount']) {
              if (transaction[field] === null || transaction[field] === undefined || 
                  isNaN(transaction[field])) {
                transaction[field] = 0.0;
              }
            }

            // Clean up null values for string fields
            for (const field of ['business_name', 'currency', 'payment_method', 'category', 'category_name', 'notes']) {
              if (transaction[field] === null || transaction[field] === undefined) {
                transaction[field] = '';
              }
            }

            // Generate transaction hash
            transaction.transaction_hash = this.generateTransactionHash(transaction);

            // Add timestamps
            transaction.created_at = new Date().toISOString();
            transaction.updated_at = new Date().toISOString();

            // Add source file info
            transaction._source_file = fileName;
          }

          // If combining files, add to master list, otherwise process individually
          if (combineFiles) {
            allTransactions = allTransactions.concat(fileTransactions);
          } else {
            // For individual processing, we would handle each file separately
            // This branch is not currently used but included for future flexibility
            console.log(`Individual processing not implemented for file: ${fileName}`);
          }

          // Record success
          fileResults.push({
            file_name: fileName,
            status: 'success',
            transaction_count: fileTransactions.length
          });

          // Update counters
          importedCount += fileTransactions.length;
          totalFilesProcessed += 1;

        } catch (error) {
          console.error(`Error processing file ${fileName}:`, error);
          errorCount += 1;
          fileResults.push({
            file_name: fileName,
            status: 'error',
            message: error.message
          });
        }
      } catch (error) {
        console.error(`Unexpected error processing file ${fileName}:`, error);
        errorCount += 1;
        fileResults.push({
          file_name: fileName,
          status: 'error',
          message: `Unexpected error: ${error.message}`
        });
      }
    }

    // After processing all files, combine if needed
    if (combineFiles && allTransactions.length > 0) {
      if (progressCallback) {
        progressCallback('combining_files', {
          status: `Combining ${allTransactions.length} transactions from ${totalFilesProcessed} files`,
          progress: 55,
          transaction_count: allTransactions.length
        });
      }

      // Check for multiple currencies in the combined dataset
      const currencies = {};
      for (const transaction of allTransactions) {
        const currency = (transaction.currency || 'ILS').toUpperCase();
        if (!currencies[currency]) {
          currencies[currency] = [];
        }
        currencies[currency].push(transaction);
      }

      // If multiple currencies found
      if (Object.keys(currencies).length > 1) {
        console.log(`Multiple currencies detected in combined dataset: ${Object.keys(currencies)}`);

        // Create a temporary file with the currency groups data
        const tempId = uuidv4();
        const tempDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Format for the currency_groups format
        const formattedCurrencyGroups = {};
        Object.keys(currencies).forEach(currency => {
          const transactionsList = currencies[currency];
          formattedCurrencyGroups[currency] = {
            transactions: transactionsList,
            count: transactionsList.length,
            primary: false // Will be determined by backend
          };
        });

        // Determine cash flow currency if possible
        let cashFlowCurrency = 'ILS'; // Default
        if (cashFlowId) {
          try {
            const cashFlow = await SupabaseService.getCashFlow(cashFlowId);
            if (cashFlow) {
              cashFlowCurrency = cashFlow.currency || 'ILS';
              // Mark the matching currency as primary
              if (formattedCurrencyGroups[cashFlowCurrency]) {
                formattedCurrencyGroups[cashFlowCurrency].primary = true;
              }
            }
          } catch (error) {
            console.error('Error determining cash flow currency:', error);
          }
        }

        // Save to temporary file
        const tempFilePath = path.join(tempDir, `currency_groups_${tempId}.json`);
        const currencyGroupsData = {
          currencies: formattedCurrencyGroups,
          cash_flow_id: cashFlowId,
          cash_flow_currency: cashFlowCurrency,
          user_id: userId,
          is_folder_upload: true,
          files_processed: allFiles.map(f => path.basename(f)),
          created_at: new Date().toISOString()
        };

        fs.writeFileSync(tempFilePath, JSON.stringify(currencyGroupsData, null, 2), 'utf8');

        if (progressCallback) {
          progressCallback('currency_groups_ready', {
            status: `Found multiple currencies: ${Object.keys(currencies)}`,
            progress: 90,
            currency_groups_temp_id: tempId,
            currencies: Object.keys(currencies)
          });
        }

        // Return result with currency groups info
        return {
          success: true,
          message: 'Multiple currencies detected',
          files_processed: totalFilesProcessed,
          files_with_errors: errorCount,
          total_files: totalFiles,
          file_results: fileResults,
          transactions_extracted: allTransactions.length,
          duplicates_found: duplicateCount,
          multiple_currencies: true,
          currency_groups_temp_id: tempId,
          temp_id: tempId, // For backwards compatibility
          currencies: Object.keys(currencies),
          processing_time: Date.now() - startTime
        };
      }

      // No multiple currencies, continue with normal flow
      try {
        // Process the combined transactions using the new batch processing method
        if (progressCallback) {
          progressCallback('processing_combined', {
            status: 'Processing combined transactions in batch mode',
            progress: 65,
            transaction_count: allTransactions.length
          });
        }

        // Create a special progress callback for the final combined processing
        const combinedProgressCallback = (eventType, data) => {
          if (progressCallback) {
            // Scale progress to range from 65% to 95%
            if (data.progress !== undefined) {
              const scaledProgress = 65 + (data.progress / 100) * 30;
              data.progress = Math.round(scaledProgress);
            }

            // Add combined file context
            data.combined_file = true;
            data.transaction_count = allTransactions.length;

            // Forward to main progress callback
            progressCallback(`combined_${eventType}`, data);
          }
        };

        // Process the combined transactions using new batch processing
        const combinedResult = await this.processTransactionsBatch(
          allTransactions,
          userId,
          cashFlowId,
          combinedProgressCallback,
          true // Check for duplicates
        );

        // Update the combined result with additional info
        combinedResult.files_processed = totalFilesProcessed;
        combinedResult.files_with_errors = errorCount;
        combinedResult.total_files = totalFiles;
        combinedResult.file_results = fileResults;
        combinedResult.duplicates_removed_during_combination = duplicateCount;

        // Final progress update
        if (progressCallback) {
          progressCallback('directory_processing_complete', {
            status: 'Directory processing complete',
            progress: 100,
            result: combinedResult
          });
        }

        return combinedResult;

      } catch (error) {
        console.error('Error creating or processing combined transactions:', error);

        // Return partial results
        const result = {
          success: false,
          message: `Error combining files: ${error.message}`,
          files_processed: totalFilesProcessed,
          files_with_errors: errorCount,
          total_files: totalFiles,
          file_results: fileResults,
          transactions_extracted: allTransactions.length,
          duplicates_found: duplicateCount
        };

        if (progressCallback) {
          progressCallback('error', {
            status: `Error combining files: ${error.message}`,
            progress: 80,
            result: result
          });
        }

        return result;
      }
    }

    // If not combining or no transactions found
    const elapsed = Date.now() - startTime;

    let result;
    if (allTransactions.length === 0) {
      result = {
        success: false,
        message: 'No valid transactions found in any files',
        files_processed: totalFilesProcessed,
        files_with_errors: errorCount,
        total_files: totalFiles,
        file_results: fileResults,
        processing_time: elapsed
      };
    } else {
      result = {
        success: true,
        message: `Processed ${totalFilesProcessed} files individually`,
        files_processed: totalFilesProcessed,
        files_with_errors: errorCount,
        total_files: totalFiles,
        file_results: fileResults,
        transactions_extracted: allTransactions.length,
        processing_time: elapsed
      };
    }

    if (progressCallback) {
      progressCallback('directory_processing_complete', {
        status: 'Directory processing complete',
        progress: 100,
        result: result
      });
    }

    return result;
  }

  // Exact implementation of Flask's export_processed_data function
  exportProcessedData(transactions, originalFilePath, userId = null, exportFormat = 'csv') {
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');

    // Generate export filename based on original filename
    const filenameBase = path.parse(originalFilePath).name;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];

    // Use fixed export directory specific to your project
    const exportDir = path.join(__dirname, '../../../exports');

    // Create export directory if it doesn't exist
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Add user info to filename for better organization
    const userPart = userId ? `_user_${userId}` : '';

    let exportPath;
    
    // Create and save file based on format
    if (exportFormat.toLowerCase() === 'excel') {
      exportPath = path.join(exportDir, `${filenameBase}${userPart}_processed_${timestamp}.xlsx`);
      
      // Convert transactions to worksheet
      const ws = XLSX.utils.json_to_sheet(transactions);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
      XLSX.writeFile(wb, exportPath);
    } else {
      // Default to CSV
      exportPath = path.join(exportDir, `${filenameBase}${userPart}_processed_${timestamp}.csv`);
      
      // Convert to CSV with Hebrew support
      const csvContent = this.transactionsToCsv(transactions);
      fs.writeFileSync(exportPath, '\uFEFF' + csvContent, 'utf8'); // BOM for Hebrew support
    }

    return exportPath;
  }

  // Helper function to convert transactions to CSV
  transactionsToCsv(transactions) {
    if (!transactions || transactions.length === 0) {
      return '';
    }

    // Get all unique keys from all transactions
    const allKeys = new Set();
    transactions.forEach(transaction => {
      Object.keys(transaction).forEach(key => allKeys.add(key));
    });

    const headers = Array.from(allKeys);
    
    // Create CSV content
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.map(header => this.escapeCsvValue(header)).join(','));
    
    // Add data rows
    transactions.forEach(transaction => {
      const row = headers.map(header => {
        const value = transaction[header];
        return this.escapeCsvValue(value);
      });
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  // Helper function to escape CSV values
  escapeCsvValue(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // If the value contains comma, newline, or quotes, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
  }

  // Exact implementation of Flask's process_multiple_files_standalone function
  async processMultipleFilesStandalone(filesList, fileSource, paymentMethodOverride = null, 
                                      paymentIdentifierOverride = null, removeDuplicates = false, userId = null) {
    const path = require('path');
    const fs = require('fs');

    console.log('\n' + '='.repeat(60));
    console.log(`[process_multiple_files_standalone] התחלת עיבוד ${filesList.length} קבצים`);
    console.log(`[process_multiple_files_standalone] הגדרות כלליות:`);
    console.log(`  - file_source: ${fileSource}`);
    console.log(`  - payment_method_override: ${paymentMethodOverride}`);
    console.log(`  - payment_identifier_override: ${paymentIdentifierOverride}`);
    console.log('='.repeat(60));

    const allDataframes = [];
    const successfulFiles = [];
    const failedFiles = [];

    for (let i = 0; i < filesList.length; i++) {
      const filePath = filesList[i];
      console.log(`\n[process_multiple_files_standalone] מעבד קובץ ${i + 1}/${filesList.length}`);
      console.log(`[process_multiple_files_standalone] נתיב: ${filePath}`);

      try {
        // בדיקה שהקובץ קיים
        if (!fs.existsSync(filePath)) {
          throw new Error(`הקובץ לא נמצא: ${filePath}`);
        }

        // עיבוד הקובץ עם ההגדרות הכלליות
        const conversionResult = await this.convert_file_to_df_large(
          filePath,
          fileSource,
          paymentMethodOverride,
          paymentIdentifierOverride,
          null, // progressCallback
          null, // uploadId
          {}, // dateFilterOptions
          userId
        );

        if (!conversionResult.success) {
          throw new Error(conversionResult.error);
        }

        const transactionsArray = conversionResult.data || [];

        if (transactionsArray.length > 0) {
          // הוספת מידע נוסף על מקור הקובץ הספציפי
          transactionsArray.forEach(transaction => {
            transaction.source_file = path.basename(filePath);
          });
          
          allDataframes.push(transactionsArray);
          successfulFiles.push(filePath);
          console.log(`[process_multiple_files_standalone] ✅ הקובץ עובד בהצלחה: ${path.basename(filePath)}`);
          console.log(`[process_multiple_files_standalone] נוספו ${transactionsArray.length} שורות`);
        } else {
          console.log(`[process_multiple_files_standalone] ⚠️ הקובץ ריק: ${path.basename(filePath)}`);
        }

      } catch (error) {
        const errorMsg = `שגיאה בעיבוד הקובץ ${filePath}: ${error.message}`;
        console.log(`[process_multiple_files_standalone] ❌ ${errorMsg}`);
        failedFiles.push({
          file: filePath,
          error: error.message
        });
        continue;
      }
    }

    // סיכום העיבוד
    console.log('\n' + '='.repeat(60));
    console.log(`[process_multiple_files_standalone] סיכום עיבוד:`);
    console.log(`[process_multiple_files_standalone] קבצים שעובדו בהצלחה: ${successfulFiles.length}`);
    console.log(`[process_multiple_files_standalone] קבצים שנכשלו: ${failedFiles.length}`);
    console.log('='.repeat(60));

    if (failedFiles.length > 0) {
      console.log(`\n[process_multiple_files_standalone] שגיאות:`);
      failedFiles.forEach(fail => {
        console.log(`  ❌ ${path.basename(fail.file)}: ${fail.error}`);
      });
    }

    if (successfulFiles.length > 0) {
      console.log(`\n[process_multiple_files_standalone] קבצים שעובדו בהצלחה:`);
      successfulFiles.forEach(success => {
        console.log(`  ✅ ${path.basename(success)}`);
      });
    }

    if (allDataframes.length === 0) {
      throw new Error('לא נמצאו נתונים תקינים באף אחד מהקבצים');
    }

    // איחוד כל ה-arrays
    console.log(`\n[process_multiple_files_standalone] מאחד ${allDataframes.length} arrays...`);
    let combinedTransactions = [];
    allDataframes.forEach(transactions => {
      combinedTransactions = combinedTransactions.concat(transactions);
    });
    console.log(`[process_multiple_files_standalone] הושגה תוצאה ראשונית עם ${combinedTransactions.length} שורות`);

    // הסרת כפילויות אם נדרש
    if (removeDuplicates) {
      console.log(`[process_multiple_files_standalone] מסיר כפילויות...`);
      const originalCount = combinedTransactions.length;
      
      // הסרת כפילויות לפי עמודות מפתח
      const duplicateFields = ['business_name', 'payment_date', 'amount'];
      const seen = new Set();
      const uniqueTransactions = [];
      
      combinedTransactions.forEach(transaction => {
        // Create a key from the duplicate fields
        const key = duplicateFields.map(field => transaction[field] || '').join('|');
        if (!seen.has(key)) {
          seen.add(key);
          uniqueTransactions.push(transaction);
        }
      });
      
      combinedTransactions = uniqueTransactions;
      const removedCount = originalCount - combinedTransactions.length;
      console.log(`[process_multiple_files_standalone] הוסרו ${removedCount} כפילויות`);
    }

    // הוספת מידע נוסף
    combinedTransactions.forEach(transaction => {
      transaction.processed_timestamp = new Date().toISOString();
      transaction.total_files_processed = successfulFiles.length;
    });

    console.log(`\n[process_multiple_files_standalone] Array סופי:`);
    console.log(`[process_multiple_files_standalone] מספר שורות: ${combinedTransactions.length}`);
    console.log(`[process_multiple_files_standalone] מספר עמודות: ${combinedTransactions.length > 0 ? Object.keys(combinedTransactions[0]).length : 0}`);
    
    if (combinedTransactions.length > 0) {
      console.log(`[process_multiple_files_standalone] עמודות: ${Object.keys(combinedTransactions[0])}`);
      console.log(`\n[process_multiple_files_standalone] דוגמה מהנתונים:`);
      console.log(combinedTransactions.slice(0, 3));

      // סטטיסטיקות בסיסיות
      console.log(`\n[process_multiple_files_standalone] סטטיסטיקות:`);
      
      // התפלגות לפי קובץ מקור
      const sourceFileDistribution = {};
      combinedTransactions.forEach(transaction => {
        const sourceFile = transaction.source_file || 'Unknown';
        sourceFileDistribution[sourceFile] = (sourceFileDistribution[sourceFile] || 0) + 1;
      });
      console.log('התפלגות לפי קובץ מקור:');
      Object.entries(sourceFileDistribution).forEach(([file, count]) => {
        console.log(`  ${file}: ${count}`);
      });

      // התפלגות לפי חודש
      const flowMonthDistribution = {};
      combinedTransactions.forEach(transaction => {
        const flowMonth = transaction.flow_month || 'Unknown';
        flowMonthDistribution[flowMonth] = (flowMonthDistribution[flowMonth] || 0) + 1;
      });
      console.log('\nהתפלגות לפי חודש:');
      Object.entries(flowMonthDistribution).sort().forEach(([month, count]) => {
        console.log(`  ${month}: ${count}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log(`[process_multiple_files_standalone] העיבוד הושלם בהצלחה!`);
    console.log('='.repeat(60) + '\n');

    return combinedTransactions;
  }

  // Exact implementation of Flask's process_multiple_financial_files function
  async processMultipleFinancialFiles(filePaths, userId, cashFlowId = null, fileSource = null,
                                     paymentMethod = null, paymentIdentifier = null,
                                     progressCallback = null, combineFiles = true) {
    const path = require('path');

    if (!filePaths || filePaths.length === 0) {
      return { success: false, message: 'No files provided' };
    }

    try {
      if (progressCallback) {
        progressCallback('multiple_files_started', {
          status: `Processing ${filePaths.length} files...`,
          progress: 10,
          total_files: filePaths.length
        });
      }

      // Use the standalone function to process and combine all files
      console.log(`[process_multiple_financial_files] Using standalone processor for ${filePaths.length} files`);
      const combinedTransactions = await this.processMultipleFilesStandalone(
        filePaths,
        fileSource,
        paymentMethod,
        paymentIdentifier,
        false, // Don't remove duplicates here - let the review step handle it
        userId
      );

      if (progressCallback) {
        progressCallback('files_combined', {
          status: `Combined ${filePaths.length} files into ${combinedTransactions.length} transactions`,
          progress: 50,
          total_transactions: combinedTransactions.length
        });
      }

      if (combinedTransactions.length === 0) {
        return {
          success: false,
          message: 'No valid transactions found in any files',
          transactions: []
        };
      }

      // Add necessary fields for each transaction
      console.log(`[process_multiple_financial_files] Converting ${combinedTransactions.length} rows to transactions`);
      
      combinedTransactions.forEach(transaction => {
        // Add user ID and cash flow ID
        transaction.user_id = userId;
        if (cashFlowId) {
          transaction.cash_flow_id = cashFlowId;
        }

        // Clean up null values for numeric fields
        ['amount', 'original_amount'].forEach(field => {
          if (transaction[field] === null || transaction[field] === undefined || 
              isNaN(transaction[field])) {
            transaction[field] = 0.0;
          }
        });

        // Clean up null values for string fields
        ['business_name', 'currency', 'payment_method', 'category', 'category_name', 'notes'].forEach(field => {
          if (transaction[field] === null || transaction[field] === undefined) {
            transaction[field] = '';
          }
        });

        // Generate transaction hash
        transaction.transaction_hash = this.generateTransactionHash(transaction);

        // Add timestamps
        transaction.created_at = new Date().toISOString();
        transaction.updated_at = new Date().toISOString();
      });

      if (progressCallback) {
        progressCallback('transactions_prepared', {
          status: `Prepared ${combinedTransactions.length} transactions for processing`,
          progress: 75,
          total_transactions: combinedTransactions.length
        });
      }

      // Now process the combined transactions using the new batch processor
      console.log(`[process_multiple_financial_files] Processing ${combinedTransactions.length} combined transactions in batch mode`);
      const result = await this.processTransactionsBatch(
        combinedTransactions,
        userId,
        cashFlowId,
        progressCallback,
        true // Check for duplicates
      );

      // Add source file information to the result
      result.source_files = filePaths.map(fp => path.basename(fp));
      result.total_files_processed = filePaths.length;

      if (progressCallback) {
        progressCallback('multiple_files_completed', {
          status: `Completed processing ${filePaths.length} files`,
          progress: 100,
          result: result
        });
      }

      return result;

    } catch (error) {
      const errorMsg = `Error in multiple files processing: ${error.message}`;
      console.log(`[process_multiple_financial_files] ERROR: ${errorMsg}`);
      console.error(error);

      if (progressCallback) {
        progressCallback('multiple_files_error', {
          status: errorMsg,
          progress: 0,
          error: error.message
        });
      }

      return {
        success: false,
        message: errorMsg,
        transactions: []
      };
    }
  }

  // Multi-step processing function optimized for large files
  async processFinancialFileMultiStep(filePath, userId, cashFlowId, fileSource, paymentMethod, paymentIdentifier, progressCallback, forceImport = false, uploadId = null, dateFilterOptions = {}) {
    try {
      console.log('🚀 [ENTRY POINT] processFinancialFileMultiStep called with:', {
        fileSource,
        forceImport,
        uploadId
      });
      console.log('🚀 Starting multi-step processing with working logic for large files');
      
      if (progressCallback) {
        progressCallback('processing', { progress: 5, status: 'מתחיל עיבוד קובץ גדול...' });
      }

      // Step 1: Convert file to structured data with progress tracking
      const conversionResult = await this.convert_file_to_df_large(filePath, fileSource, paymentMethod, paymentIdentifier, progressCallback, uploadId, dateFilterOptions, userId);
      
      if (!conversionResult.success) {
        throw new Error(conversionResult.error);
      }

      if (progressCallback) {
        progressCallback('analyzing', { progress: 70, status: 'מנתח נתונים...' });
      }

      // Step 2: Process currency groups
      const { currencyGroups, data: transactions, detectedFormat } = conversionResult;
      
      if (progressCallback) {
        progressCallback('grouping', { progress: 85, status: 'מקבץ לפי מטבעות...' });
      }

      // Step 3: Validate and prepare results
      let finalCurrencyGroups = currencyGroups;
      if (!currencyGroups || Object.keys(currencyGroups).length === 0) {
        console.warn('⚠️ No currency groups found, creating default ILS group');
        finalCurrencyGroups = {
          'ILS': {
            currency: 'ILS',
            transactions: transactions.map(t => ({ ...t, currency: 'ILS' })),
            totalAmount: transactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0),
            count: transactions.length
          }
        };
      }

      // Step 3: Process transactions and check for duplicates
      if (progressCallback) {
        progressCallback('checking_duplicates', { progress: 90, status: 'בודק כפילויות...' });
      }

      let duplicatesFound = [];
      let hasMultipleCurrencies = Object.keys(finalCurrencyGroups).length > 1;
      
      // If multiple currencies, return for currency selection first
      if (hasMultipleCurrencies && !forceImport) {
        console.log('🔄 Multiple currencies detected, returning for currency selection');
        return {
          success: true,
          multiple_currencies: true,
          has_duplicates: false,
          currencyGroups: finalCurrencyGroups,
          transactions: transactions,
          fileFormat: detectedFormat,
          totalRows: conversionResult.totalRows,
          processedTransactions: conversionResult.processedTransactions
        };
      }
      
      // Process transactions for single currency or when forced using batch processing
      console.log('🔄 Processing transactions for duplicate detection in batch mode...');
      const processingResult = await this.processTransactionsBatch(
        transactions,
        userId,
        cashFlowId,
        progressCallback,
        true // Enable duplicate checking
      );
      
      // Debug all variables before condition checks
      console.log('🔍 [DEBUG FINAL CONDITIONS]', {
        has_duplicates: processingResult.has_duplicates,
        duplicates_length: processingResult.duplicates?.length || 0,
        detectedFormat,
        forceImport,
        transactions_count: transactions.length,
        should_check_transaction_review: detectedFormat && detectedFormat.toLowerCase() !== 'budgetlens' && !forceImport
      });

      // Check if duplicates were found
      if (processingResult.has_duplicates && processingResult.duplicates.length > 0) {
        console.log(`⚠️ Found ${processingResult.duplicates.length} duplicates!`);
        return {
          success: true,
          has_duplicates: true,
          duplicates: processingResult.duplicates,
          temp_duplicates_id: processingResult.temp_duplicates_id,
          duplicates_data: processingResult.duplicates_data,
          currencyGroups: finalCurrencyGroups,
          transactions: transactions,
          fileFormat: detectedFormat,
          totalRows: conversionResult.totalRows,
          processedTransactions: conversionResult.processedTransactions,
          imported: processingResult.imported || 0,
          errors: processingResult.errors || 0,
          processing_result: processingResult
        };
      }
      
      // Check if this is a non-BudgetLens file that needs transaction review
      console.log('🔍 [TRANSACTION REVIEW CHECK]', {
        detectedFormat,
        forceImport,
        transactionsCount: transactions.length,
        shouldShowReview: detectedFormat && detectedFormat.toLowerCase() !== 'budgetlens' && !forceImport
      });
      
      if (detectedFormat && detectedFormat.toLowerCase() !== 'budgetlens' && !forceImport) {
        console.log('🔄 Non-BudgetLens file detected, returning for transaction review');
        return {
          success: true,
          needs_transaction_review: true,
          has_duplicates: false,
          currencyGroups: finalCurrencyGroups,
          transactions: transactions,
          fileFormat: detectedFormat,
          fileSource: fileSource || 'other',
          totalRows: conversionResult.totalRows,
          processedTransactions: conversionResult.processedTransactions,
          imported: 0, // Not imported yet, pending review
          errors: processingResult.errors || 0,
          processing_result: processingResult
        };
      }
      
      // No duplicates found and either BudgetLens or forceImport is true
      const result = {
        success: true,
        has_duplicates: false,
        currencyGroups: finalCurrencyGroups,
        transactions: transactions,
        duplicates: processingResult.duplicates || [],
        fileFormat: detectedFormat,
        totalRows: conversionResult.totalRows,
        processedTransactions: conversionResult.processedTransactions,
        imported: processingResult.imported || 0,
        errors: processingResult.errors || 0
      };

      if (progressCallback) {
        progressCallback('completed', { progress: 100, status: `הושלם בהצלחה! עובדו ${transactions.length} רשומות` });
      }

      console.log('✅ Multi-step processing completed successfully for large file');
      return result;

    } catch (error) {
      console.error('❌ Multi-step processing failed:', error);
      
      if (progressCallback) {
        progressCallback('error', { progress: 0, status: 'שגיאה בעיבוד הקובץ', error: error.message });
      }

      return {
        success: false,
        has_duplicates: false,
        error: error.message
      };
    }
  }

  // Optimized conversion for large files with batch processing
  async convert_file_to_df_large(filePath, fileSource = 'other', paymentMethod = null, paymentIdentifier = null, progressCallback = null, uploadId = null, dateFilterOptions = {}, userId = null) {
    try {
      console.log('🔄 Starting large file conversion...', { filePath, fileSource });
      
      // Special handling for American Express files
      if (fileSource === 'americanexpress') {
        console.log('🇺🇸 Using dedicated American Express service...');
        if (progressCallback) {
          progressCallback('reading', { progress: 15, status: 'קורא קובץ American Express...' });
        }
        
        const amexResult = await AmericanExpressService.parseAmericanExpressExcel(filePath);
        
        if (!amexResult.success) {
          throw new Error(amexResult.error);
        }
        
        if (progressCallback) {
          progressCallback('processing', { progress: 60, status: 'מעבד נתונים American Express...' });
        }
        
        let processedData = amexResult.data;
        
        // Apply date filtering if enabled
        if (dateFilterOptions.dateFilterEnabled && dateFilterOptions.startDate) {
          const startDate = moment(dateFilterOptions.startDate);
          const endDate = dateFilterOptions.endDate ? moment(dateFilterOptions.endDate) : null;
          
          processedData = processedData.filter(transaction => {
            const transactionDate = moment(transaction.payment_date);
            const afterStart = transactionDate.isSameOrAfter(startDate, 'day');
            const beforeEnd = !endDate || transactionDate.isSameOrBefore(endDate, 'day');
            return afterStart && beforeEnd;
          });
        }
        
        // Group by currency
        const currencyGroups = this.groupByCurrency(processedData);
        
        if (progressCallback) {
          progressCallback('grouping', { progress: 90, status: 'מסיים עיבוד American Express...' });
        }
        
        return {
          success: true,
          data: processedData,
          currencyGroups: currencyGroups,
          detectedFormat: 'americanexpress',
          totalRows: amexResult.data.length,
          processedTransactions: processedData.length
        };
      }
      
      if (progressCallback) {
        progressCallback('reading', { progress: 10, status: 'קורא קובץ...' });
      }

      // Read file based on extension
      const ext = path.extname(filePath).toLowerCase();
      let rawData;
      
      if (ext === '.csv') {
        rawData = await this.readCSVFileOptimized(filePath, progressCallback);
      } else if (ext === '.xlsx' || ext === '.xls') {
        rawData = await this.readExcelFileOptimized(filePath, progressCallback);
      } else {
        throw new Error('Unsupported file format');
      }

      console.log('📊 Raw data loaded:', { rows: rawData.length, columns: Object.keys(rawData[0] || {}).length });
      console.log('📋 File processing summary: Processing', rawData.length, 'rows from uploaded file');

      if (progressCallback) {
        progressCallback('detecting', { progress: 25, status: 'מזהה פורמט...' });
      }

      // Detect format
      const formatDetection = this.detectFormat(rawData, fileSource);
      console.log('🎯 Format detected:', formatDetection);

      if (progressCallback) {
        progressCallback('processing', { progress: 40, status: 'מעבד רשומות...' });
      }

      // Process in batches for large files
      const batchSize = 1000;
      const totalBatches = Math.ceil(rawData.length / batchSize);
      let processedData = [];

      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, rawData.length);
        const batch = rawData.slice(start, end);
        
        const batchProcessed = await this.applyFormatProcessing(batch, formatDetection, paymentMethod, paymentIdentifier, userId);
        processedData = processedData.concat(batchProcessed);
        
        // Update progress
        const batchProgress = 40 + (i / totalBatches) * 25;
        if (progressCallback) {
          progressCallback('processing', { 
            progress: Math.round(batchProgress), 
            status: `מעבד רשומות... ${i + 1}/${totalBatches} קבוצות` 
          });
        }
        
        // Allow event loop to process other tasks
        await new Promise(resolve => setImmediate(resolve));
      }

      if (progressCallback) {
        progressCallback('grouping', { progress: 65, status: 'מקבץ לפי מטבעות...' });
      }

      // Apply date filtering if enabled
      let filteredData = processedData;
      if (dateFilterOptions.dateFilterEnabled && dateFilterOptions.startDate) {
        if (progressCallback) {
          progressCallback('filtering', { progress: 67, status: 'מסנן לפי תאריך...' });
        }
        
        const startDate = new Date(dateFilterOptions.startDate);
        const endDate = dateFilterOptions.endDate ? new Date(dateFilterOptions.endDate) : null;
        
        console.log('📅 Applying date filter:', {
          startDate: startDate.toISOString(),
          endDate: endDate ? endDate.toISOString() : 'no end date',
          originalCount: processedData.length
        });
        
        // Detailed analysis of all data before filtering
        console.log('🔎 DETAILED DATA ANALYSIS:');
        console.log(`📊 Total processed rows: ${processedData.length}`);
        
        // Count rows with valid dates vs invalid dates
        const validDates = [];
        const invalidDates = [];
        const emptyDates = [];
        
        processedData.forEach((row, index) => {
          if (!row.payment_date) {
            emptyDates.push({ index, row: row });
          } else {
            const testDate = new Date(row.payment_date);
            if (isNaN(testDate.getTime())) {
              invalidDates.push({ 
                index, 
                payment_date: row.payment_date,
                type: typeof row.payment_date
              });
            } else {
              validDates.push({ 
                index, 
                payment_date: row.payment_date,
                parsedDate: testDate.toISOString()
              });
            }
          }
        });
        
        console.log(`✅ Rows with VALID dates: ${validDates.length}`);
        console.log(`❌ Rows with INVALID dates: ${invalidDates.length}`);
        console.log(`⚪ Rows with EMPTY dates: ${emptyDates.length}`);
        
        if (validDates.length > 0) {
          console.log('📅 Sample VALID dates:', validDates.slice(0, 5).map(d => ({
            payment_date: d.payment_date,
            parsedDate: d.parsedDate
          })));
        }
        
        if (invalidDates.length > 0) {
          console.log('🚫 Sample INVALID dates:', invalidDates.slice(0, 5));
        }
        
        if (emptyDates.length > 0) {
          console.log('⚪ Sample rows with EMPTY dates:', emptyDates.slice(0, 3).map(d => ({
            index: d.index,
            allKeys: Object.keys(d.row),
            sampleData: Object.fromEntries(Object.entries(d.row).slice(0, 3))
          })));
        }
        
        let filteredOutByDate = [];
        let filteredOutByNoDate = 0;
        
        filteredData = processedData.filter(transaction => {
          if (!transaction.payment_date) {
            filteredOutByNoDate++;
            return false;
          }
          
          const transactionDate = new Date(transaction.payment_date);
          
          // Check if transaction date is >= start date
          if (transactionDate < startDate) {
            filteredOutByDate.push({
              payment_date: transaction.payment_date,
              reason: 'before_start_date',
              transactionDate: transactionDate.toISOString(),
              startDate: startDate.toISOString()
            });
            return false;
          }
          
          // Check if transaction date is <= end date (if provided)
          if (endDate && transactionDate > endDate) {
            filteredOutByDate.push({
              payment_date: transaction.payment_date,
              reason: 'after_end_date',
              transactionDate: transactionDate.toISOString(),
              endDate: endDate.toISOString()
            });
            return false;
          }
          
          return true;
        });
        
        console.log('🎯 DATE FILTERING CRITERIA:');
        console.log(`📅 Start Date: ${startDate.toISOString()} (${startDate.toLocaleDateString('he-IL')})`);
        console.log(`📅 End Date: ${endDate ? endDate.toISOString() + ` (${endDate.toLocaleDateString('he-IL')})` : 'No end date limit'}`);
        
        console.log('🔍 FILTERING RESULTS SUMMARY:');
        console.log(`❌ Filtered out (no date): ${filteredOutByNoDate} rows`);
        console.log(`❌ Filtered out (date criteria): ${filteredOutByDate.length} rows`);
        console.log(`✅ Remaining after filter: ${filteredData.length} rows`);
        console.log(`📊 Original total: ${processedData.length} rows`);
        
        if (filteredOutByDate.length > 0) {
          const beforeStart = filteredOutByDate.filter(d => d.reason === 'before_start_date').length;
          const afterEnd = filteredOutByDate.filter(d => d.reason === 'after_end_date').length;
          console.log(`   📉 Before start date: ${beforeStart} rows`);
          console.log(`   📈 After end date: ${afterEnd} rows`);
          
          console.log('🚫 Sample filtered out dates:', filteredOutByDate.slice(0, 3));
        }
        
        if (filteredData.length > 0) {
          console.log('✅ Sample dates that PASSED filter:', filteredData.slice(0, 3).map(t => ({
            payment_date: t.payment_date,
            parsedDate: new Date(t.payment_date).toISOString()
          })));
        } else {
          console.log('⚠️  NO ROWS PASSED THE DATE FILTER! Check your date criteria.');
        }
      }

      // Group by currency
      const currencyGroups = this.groupByCurrency(filteredData);
      console.log('💱 Currency groups:', Object.keys(currencyGroups));

      return {
        success: true,
        data: filteredData,
        currencyGroups: currencyGroups,
        detectedFormat: formatDetection.format,
        totalRows: rawData.length,
        processedTransactions: filteredData.length
      };

    } catch (error) {
      console.error('❌ Large file conversion error:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  async readCSVFileOptimized(filePath, progressCallback) {
    return new Promise((resolve, reject) => {
      const results = [];
      let rowCount = 0;
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          results.push(data);
          rowCount++;
          
          // Update progress every 1000 rows
          if (rowCount % 1000 === 0 && progressCallback) {
            progressCallback('reading', { 
              progress: 10 + Math.min((rowCount / 100000) * 10, 10), 
              status: `קורא שורה ${rowCount.toLocaleString()}...` 
            });
          }
        })
        .on('end', () => {
          console.log(`📄 CSV file read: ${rowCount} rows (actual data rows, excluding header)`);
          console.log(`📊 CSV reading validation: Expected ~${rowCount} rows for processing`);
          resolve(results);
        })
        .on('error', reject);
    });
  }

  async readExcelFileOptimized(filePath, progressCallback) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (progressCallback) {
        progressCallback('reading', { progress: 15, status: 'מעבד גיליון אלקטרוני...' });
      }
      
      // First try to read with header detection
      let data = XLSX.utils.sheet_to_json(worksheet);
      console.log(`📊 Excel file read: ${data.length} rows`);
      console.log(`📊 Raw data loaded: { rows: ${data.length}, columns: ${Object.keys(data[0] || {}).length} }`);
      console.log(`🔍 Headers found:`, Object.keys(data[0] || {}));
      
      // Check if this looks like an Isracard/Max file by examining the structure
      if (data.length > 0) {
        const firstRowKeys = Object.keys(data[0]);
        console.log(`🔍 First row keys:`, firstRowKeys);
        
        const hasIsracardIndicators = firstRowKeys.some(key => 
          key.includes('פירוט עסקאות') || 
          key.includes('גולד') || 
          key.includes('מסטרקארד') ||
          key.includes('__EMPTY') ||
          key.includes('כל המשתמשים') ||
          key === '' // Empty column names are common in Max files
        );
        
        // Check for Bank Yahav indicators
        const hasBankYahavIndicators = firstRowKeys.some(key => 
          key.includes('תנועות עו"ש') ||
          key.includes('תנועות זמניות') ||
          key.includes('Bank Yahav') ||
          key.includes('יהב') ||
          key.includes('בנק יהב')
        ) || 
        // Check if first row doesn't contain proper Bank Yahav headers (indicating header is later)
        (firstRowKeys.length > 0 && !firstRowKeys.some(key => 
          key.includes('תאריך') || key.includes('אסמכתא') || key.includes('תיאור פעולה') || key.includes('חובה') || key.includes('זכות')
        )) ||
        firstRowKeys.length < 4; // If too few columns, likely not the header row
        
        console.log(`🔍 Has Isracard indicators:`, hasIsracardIndicators);
        console.log(`🔍 Has Bank Yahav indicators:`, hasBankYahavIndicators);
        console.log(`🔍 Specific checks:`, {
          hasEmpty: firstRowKeys.some(key => key.includes('__EMPTY')),
          hasUsers: firstRowKeys.some(key => key.includes('כל המשתמשים')),
          hasEmptyString: firstRowKeys.some(key => key === ''),
          firstRowKeys: firstRowKeys
        });
        
        if (hasIsracardIndicators || hasBankYahavIndicators) {
          console.log('🏦 Detected special file structure (Isracard/Max/Bank Yahav), attempting enhanced parsing...');
          
          // Try to read the raw data including all rows and find the actual header
          const rawSheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          console.log(`📋 Raw sheet data: ${rawSheetData.length} rows`);
          
          // Define expected Cal/Isracard/Max/Bank Yahav headers for better detection
          const expectedHeaders = [
            // Cal/Isracard headers
            "תאריך עסקה", "שם בית עסק", "סכום עסקה", "סכום חיוב", "סוג עסקה", "ענף", "הערות",
            "תאריך רכישה", "תאריך חיוב בבנק", "שם בית העסק", "מטבע מקור", "מטבע", "מס' שובר",
            // Max bank headers
            "קטגוריה", "4 ספרות אחרונות של כרטיס האשראי", "מטבע חיוב", "סכום עסקה מקורי", 
            "תאריך חיוב", "אופן ביצוע ההעסקה",
            // Bank Yahav headers
            "תאריך", "אסמכתא", "תיאור פעולה", "שם הפעולה", "חובה(₪)", "זכות(₪)", "תאריך ערך", "יתרה משוערכת(₪)"
          ];
          
          // Look for the actual header row with transaction data
          let headerRowIndex = -1;
          console.log('🔍 Searching for header row in first 20 rows...');
          for (let i = 0; i < Math.min(rawSheetData.length, 20); i++) {
            const row = rawSheetData[i];
            if (row && Array.isArray(row)) {
              const rowStr = row.join(' ');
              console.log(`Row ${i}:`, row);
              console.log(`Row ${i} as string:`, rowStr);
              
              // Enhanced header detection: check if row contains most expected headers
              const foundHeaders = expectedHeaders.filter(header => 
                row.some(cell => cell && cell.toString().includes(header))
              );
              
              // Special check for Max format - look for key Max headers
              const maxKeyHeaders = ['תאריך עסקה', 'שם בית העסק', 'קטגוריה', 'סכום חיוב'];
              const maxHeadersFound = maxKeyHeaders.filter(header => 
                row.some(cell => cell && cell.toString().includes(header))
              );
              
              // Special check for Bank Yahav format - look for key Bank Yahav headers
              const yahavKeyHeaders = ['תאריך', 'אסמכתא', 'תיאור פעולה', 'שם הפעולה', 'חובה(₪)', 'זכות(₪)', 'חובה', 'זכות'];
              const yahavHeadersFound = yahavKeyHeaders.filter(header => 
                row.some(cell => cell && cell.toString().includes(header))
              );
              
              // Enhanced Bank Yahav detection - check for exact matches
              const yahavExactMatches = row.filter(cell => {
                if (!cell) return false;
                const cellStr = cell.toString().trim();
                return cellStr === 'תאריך' || cellStr === 'אסמכתא' || 
                       cellStr === 'תיאור פעולה' || cellStr === 'שם הפעולה' ||
                       cellStr === 'חובה(₪)' || cellStr === 'זכות(₪)' ||
                       cellStr === 'חובה' || cellStr === 'זכות';
              });
              
              console.log(`🔍 Row ${i} Bank Yahav check:`, {
                yahavHeadersFound: yahavHeadersFound.length,
                yahavExactMatches: yahavExactMatches.length,
                headers: yahavHeadersFound,
                exactCells: yahavExactMatches
              });
              
              // If we found at least 4 out of the expected headers, this is likely the header row
              if (foundHeaders.length >= 4 || maxHeadersFound.length >= 3 || yahavHeadersFound.length >= 3 || yahavExactMatches.length >= 3) {
                headerRowIndex = i;
                console.log(`🎯 Found header row at index ${i}:`, row);
                console.log(`🎯 Matched headers: ${foundHeaders.join(', ')}`);
                if (maxHeadersFound.length >= 3) {
                  console.log(`🏦 Detected Max format with headers: ${maxHeadersFound.join(', ')}`);
                } else if (yahavHeadersFound.length >= 3 || yahavExactMatches.length >= 3) {
                  console.log(`🏦 Detected Bank Yahav format with headers: ${yahavHeadersFound.join(', ')}`);
                  console.log(`🏦 Bank Yahav exact matches: ${yahavExactMatches.join(', ')}`);
                }
                break;
              }
              
              // Fallback to original detection for partial matches (Cal/Max/Bank Yahav formats)  
              const hasDateHeader = rowStr.includes('תאריך עסקה') || rowStr.includes('תאריך רכישה') || rowStr.includes('תאריך');
              const hasBusinessHeader = rowStr.includes('שם בית עסק') || rowStr.includes('שם בית העסק') || rowStr.includes('תיאור פעולה');
              const hasAmountHeader = rowStr.includes('סכום עסקה') || rowStr.includes('סכום חיוב');
              const hasMaxSpecific = rowStr.includes('קטגוריה') || rowStr.includes('4 ספרות אחרונות') || rowStr.includes('מטבע חיוב');
              const hasYahavSpecific = rowStr.includes('אסמכתא') || rowStr.includes('חובה(₪)') || rowStr.includes('זכות(₪)');
              
              if (hasDateHeader || 
                  hasBusinessHeader ||
                  hasAmountHeader ||
                  rowStr.includes('סוג עסקה') ||
                  rowStr.includes('ענף') ||
                  rowStr.includes('תאריך חיוב בבנק') ||
                  hasMaxSpecific ||
                  hasYahavSpecific ||
                  rowStr.includes('אופן ביצוע ההעסקה') ||
                  (rowStr.includes('תאריך') && rowStr.includes('סכום')) ||
                  (row.length >= 5 && row.some(cell => cell && cell.toString().includes('תאריך')))) {
                headerRowIndex = i;
                console.log(`🎯 Found header row at index ${i} (fallback detection):`, row);
                console.log(`🎯 Detection flags: date=${hasDateHeader}, business=${hasBusinessHeader}, amount=${hasAmountHeader}, max=${hasMaxSpecific}`);
                break;
              }
            }
          }
          
          if (headerRowIndex >= 0) {
            // Extract data starting from header row with proper header mapping
            const dataStartRow = headerRowIndex + 1; // Data starts after header row
            const headerRow = rawSheetData[headerRowIndex];
            
            // Convert raw data to JSON format using the correct headers
            data = [];
            for (let i = dataStartRow; i < rawSheetData.length; i++) {
              const row = rawSheetData[i];
              if (row && row.length > 0) {
                const rowObj = {};
                for (let j = 0; j < Math.min(headerRow.length, row.length); j++) {
                  if (headerRow[j] && headerRow[j].toString().trim()) {
                    // Clean header names: remove \r\n and extra whitespace
                    const cleanHeader = headerRow[j].toString().replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();
                    rowObj[cleanHeader] = row[j];
                  }
                }
                // Only add row if it has meaningful data
                if (Object.keys(rowObj).length > 0 && Object.values(rowObj).some(val => val && val.toString().trim())) {
                  data.push(rowObj);
                }
              }
            }
            
            console.log(`✅ Parsed Isracard data starting from row ${headerRowIndex}: ${data.length} transactions`);
            console.log(`✅ Using correct headers:`, headerRow);
          } else {
            console.log('❌ Could not find valid header row in Isracard file');
          }
        }
      }
      
      return data;
    } catch (error) {
      console.error('Excel read error:', error);
      throw error;
    }
  }

  // NEW BATCH PROCESSING FUNCTION - replaces processTransactionsOneByOne
  // Based on the old Python project's batch processing approach
  async processTransactionsBatch(transactions, userId, cashFlowId = null, progressCallback = null, checkDuplicates = false) {
    const fs = require('fs');
    const path = require('path');

    console.log(`🚀 [BATCH PROCESSING] Starting batch processing for ${transactions.length} transactions`);
    console.log(`🔧 [BATCH PROCESSING] checkDuplicates=${checkDuplicates}, userId=${userId}, cashFlowId=${cashFlowId}`);

    // Set up initial result structure
    const result = {
      success: true,
      imported: 0,
      errors: 0,
      duplicates: [],
      error_details: [],
      batch_processing: true,
      start_time: Date.now()
    };

    // Group by currency first
    const currencyGroups = {};
    let cashFlowCurrency = 'ILS';
    
    if (cashFlowId) {
      try {
        const cashFlow = await SupabaseService.getCashFlow(cashFlowId);
        cashFlowCurrency = (cashFlow || {}).currency || 'ILS';
      } catch (error) {
        cashFlowCurrency = 'ILS';
      }
    }

    if (progressCallback) {
      progressCallback('batch_grouping', {
        status: 'Grouping transactions by currency...',
        progress: 10,
        total: transactions.length
      });
    }

    // Step 1: Prepare and group transactions by currency
    console.log(`📋 [BATCH STEP 1] Preparing ${transactions.length} transactions`);
    
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      
      // CRITICAL DEBUG - Check source_category at start of batch processing
      if (i < 3) { // Log first 3 transactions
        console.log(`🔍 [BATCH PROCESS START] Transaction ${i} (${transaction.business_name}):`, {
          source_category: transaction.source_category,
          hasProperty: transaction.hasOwnProperty('source_category'),
          allKeys: Object.keys(transaction)
        });
      }
      
      try {
        // Add necessary fields if not present
        if (!transaction.user_id) transaction.user_id = userId;
        if (cashFlowId && !transaction.cash_flow_id) transaction.cash_flow_id = cashFlowId;
        
        this.ensureProperAmount(transaction);
        
        if (transaction.payment_date) {
          const formattedPaymentDate = this.ensureDateFormat(transaction.payment_date);
          if (formattedPaymentDate) {
            transaction.payment_date = formattedPaymentDate;
          } else {
            console.warn(`Invalid payment_date for transaction: ${transaction.business_name || 'Unknown'}, removing transaction`);
            return; // Skip this transaction if payment_date is invalid
          }
        }
        if (transaction.charge_date) {
          const formattedChargeDate = this.ensureDateFormat(transaction.charge_date);
          transaction.charge_date = formattedChargeDate; // charge_date can be null
        }
        
        if (!transaction.payment_number) transaction.payment_number = 1;
        if (!transaction.total_payments) transaction.total_payments = 1;
        if (transaction.excluded_from_flow === undefined) transaction.excluded_from_flow = false;
        
        if (!transaction.source_type) {
          transaction.source_type = transaction.source || 'batch_import';
        }
        
        if (!transaction.currency) transaction.currency = 'ILS';

        // Generate transaction hash
        if (!transaction.transaction_hash) {
          transaction.transaction_hash = SupabaseService.generateTransactionHash(transaction);
        }

        if (!transaction.created_at) {
          transaction.created_at = new Date().toISOString();
        }
        if (!transaction.updated_at) {
          transaction.updated_at = new Date().toISOString();
        }

        // Filter: Only keep valid DB columns
        const validColumns = new Set([
          'id', 'user_id', 'business_name', 'payment_date', 'amount', 'currency',
          'payment_method', 'payment_identifier', 'category_id', 'payment_month',
          'payment_year', 'flow_month', 'charge_date', 'notes', 'excluded_from_flow',
          'source_type', 'original_amount', 'transaction_hash', 'created_at',
          'updated_at', 'cash_flow_id', 'is_transfer', 'linked_transaction_id',
          'category_name', 'payment_number', 'total_payments', 'original_currency',
          'exchange_rate', 'exchange_date', 'quantity', 'transaction_type', 'business_category',
          'source_category', 'business_country', 'execution_method'
        ]);

        // Remove invalid columns
        Object.keys(transaction).forEach(key => {
          if (!validColumns.has(key)) {
            delete transaction[key];
          }
        });

        // Group by currency
        const currency = (transaction.currency || 'ILS').toUpperCase();
        if (!currencyGroups[currency]) {
          currencyGroups[currency] = [];
        }
        currencyGroups[currency].push(transaction);

      } catch (error) {
        result.errors += 1;
        result.error_details.push({
          business_name: transaction.business_name || 'Unknown',
          error: error.message
        });
      }
    }

    console.log(`📊 [BATCH STEP 1] Grouped into currencies: ${Object.keys(currencyGroups).join(', ')}`);

    if (progressCallback) {
      progressCallback('batch_duplicate_check', {
        status: 'Checking for duplicates in batch...',
        progress: 30,
        currency_count: Object.keys(currencyGroups).length
      });
    }

    // Step 2: Batch duplicate detection (much faster than one-by-one)
    const potentialDuplicates = [];
    if (checkDuplicates) {
      console.log(`🔍 [BATCH STEP 2] Starting batch duplicate detection`);
      
      // Get all transaction hashes for batch lookup
      const allTransactions = Object.values(currencyGroups).flat();
      const allHashes = allTransactions.map(t => t.transaction_hash).filter(Boolean);
      
      console.log(`🔍 [BATCH DUPLICATE CHECK] Checking ${allHashes.length} hashes in database`);
      const existingHashes = await SupabaseService.getExistingHashesBatch(userId, allHashes, cashFlowId);
      const existingHashesSet = new Set(existingHashes);
      
      console.log(`📊 [BATCH DUPLICATE RESULTS] Found ${existingHashes.length} existing duplicates in database`);
      
      // Fetch full transaction details for existing duplicates
      const existingTransactionsByHash = {};
      if (existingHashes.length > 0) {
        const existingTransactions = await SupabaseService.getTransactionsByHashes(userId, existingHashes, cashFlowId);
        existingTransactions.forEach(transaction => {
          existingTransactionsByHash[transaction.transaction_hash] = transaction;
        });
        console.log(`📊 [BATCH TRANSACTION DETAILS] Fetched details for ${existingTransactions.length} existing transactions`);
      }

      // Check for duplicates within the batch itself and against database
      const processedHashes = new Set();
      
      for (const transaction of allTransactions) {
        const hash = transaction.transaction_hash;
        
        // Check if duplicate exists in database
        if (existingHashesSet.has(hash)) {
          const existingTransaction = existingTransactionsByHash[hash];
          potentialDuplicates.push({
            existing: existingTransaction || { transaction_hash: hash },
            new: transaction,
            transaction_hash: hash,
            is_batch_duplicate: false
          });
          continue;
        }
        
        // Check for duplicates within current batch
        if (processedHashes.has(hash)) {
          // Find the existing transaction in batch
          const existingTransaction = allTransactions.find(t => 
            t.transaction_hash === hash && t !== transaction
          );
          
          if (existingTransaction) {
            potentialDuplicates.push({
              existing: existingTransaction,
              new: transaction,
              transaction_hash: hash,
              is_batch_duplicate: true
            });
          }
          continue;
        }
        
        processedHashes.add(hash);
      }
      
      console.log(`🔍 [BATCH DUPLICATE RESULTS] Found ${potentialDuplicates.length} total duplicates (DB + batch)`);
    }

    if (progressCallback) {
      progressCallback('batch_saving', {
        status: 'Saving currency groups...',
        progress: 70,
        duplicates_found: potentialDuplicates.length
      });
    }

    // Step 3: Handle duplicates - if found, don't import anything automatically
    const allTransactions = Object.values(currencyGroups).flat();
    
    // Debug: Check for undefined transactions
    const undefinedCount = allTransactions.filter(t => !t).length;
    if (undefinedCount > 0) {
      console.log(`⚠️ [UNDEFINED CHECK] Found ${undefinedCount} undefined transactions out of ${allTransactions.length} total`);
    }
    
    // Debug: Check if recipient_name survives the flattening process
    const recipientTransactionsAfterFlat = allTransactions.filter(t => t && t.recipient_name);
    console.log(`🚨 [AFTER FLAT] Found ${recipientTransactionsAfterFlat.length} transactions with recipient_name after flattening:`, 
      recipientTransactionsAfterFlat.map(t => ({ business_name: t.business_name, recipient_name: t.recipient_name })));
    
    const duplicateHashes = new Set(potentialDuplicates.map(d => d.transaction_hash));
    const nonDuplicateTransactions = allTransactions.filter(t => t && !duplicateHashes.has(t.transaction_hash));
    
    console.log(`📊 [BATCH IMPORT] Found ${nonDuplicateTransactions.length} non-duplicate transactions out of ${allTransactions.length} total`);
    console.log(`📋 Batch transaction analysis: ${allTransactions.length} total transactions processed from ${Object.keys(currencyGroups).length} currency groups`);
    
    // Don't import anything automatically - let the finalize step handle imports
    // This prevents double imports that were causing all transactions to appear as duplicates
    let importedCount = 0;
    if (checkDuplicates && potentialDuplicates.length > 0) {
      console.log(`⚠️ [BATCH PROCESSING] Found ${potentialDuplicates.length} duplicates - will show duplicate review interface`);
    } else {
      console.log(`✅ [BATCH PROCESSING] No duplicates found - ${nonDuplicateTransactions.length} transactions ready for import`);
    }
    
    // Set imported count to 0 since we're not importing here anymore
    result.imported = importedCount;

    // Handle duplicates if found
    if (checkDuplicates && potentialDuplicates.length > 0) {
      result.duplicates = potentialDuplicates;
      const tempId = uuidv4();
      result.temp_duplicates_id = tempId;
      result.has_duplicates = true;
      // Include non-duplicate transactions with recipient_name for modal review
      result.nonDuplicateTransactions = nonDuplicateTransactions;
      
      console.log(`✅ [BATCH DUPLICATES] Found ${potentialDuplicates.length} duplicates with temp_id: ${tempId}`);

      // Save the duplicates data to file for user decision
      const uploadFolder = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadFolder)) {
        fs.mkdirSync(uploadFolder, { recursive: true });
      }
      
      // Debug: Check if recipient_name is preserved in allTransactions
      const recipientTransactions = allTransactions.filter(t => t && t.recipient_name);
      if (recipientTransactions.length > 0) {
        console.log(`🎯 [DUPLICATES DEBUG] Found ${recipientTransactions.length} transactions with recipient_name:`, 
          recipientTransactions.map(t => ({ business_name: t.business_name, recipient_name: t.recipient_name })));
      }

      const duplicatesData = {
        duplicates: potentialDuplicates,
        transactions: allTransactions, // Include ALL transactions for user decision
        cash_flow_id: cashFlowId,
        created_at: new Date().toISOString(),
        user_id: userId,
        batch_processing: true
      };

      // Save to temp file for frontend access
      const duplicatesFilePath = path.join(uploadFolder, `temp_duplicates_${tempId}.json`);
      fs.writeFileSync(duplicatesFilePath, JSON.stringify(duplicatesData, null, 2), 'utf8');
      
      // Store in result for the upload handler to process
      result.duplicates_data = duplicatesData;
      result.duplicates_file_path = duplicatesFilePath;
    } else {
      result.has_duplicates = false;
    }

    // Step 4: Save currency groups for review
    const tempId = uuidv4();
    const uploadFolder = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadFolder)) {
      fs.mkdirSync(uploadFolder, { recursive: true });
    }

    const formattedCurrencyGroups = {};
    Object.keys(currencyGroups).forEach(currency => {
      const transactionsList = currencyGroups[currency];
      formattedCurrencyGroups[currency] = {
        transactions: transactionsList,
        count: transactionsList.length,
        primary: currency === cashFlowCurrency
      };
    });

    const tempFilePath = path.join(uploadFolder, `currency_groups_${tempId}.json`);
    const currencyGroupsData = {
      currencies: formattedCurrencyGroups,
      cash_flow_id: cashFlowId,
      cash_flow_currency: cashFlowCurrency,
      user_id: userId,
      created_at: new Date().toISOString(),
      batch_processing: true
    };

    fs.writeFileSync(tempFilePath, JSON.stringify(currencyGroupsData, null, 2), 'utf8');

    // Update result
    result.multiple_currencies = true;
    result.currency_groups = formattedCurrencyGroups;
    result.currency_groups_temp_id = tempId;
    result.processing_time = Date.now() - result.start_time;
    result.total = transactions.length;

    const msg = `[BATCH SUMMARY] Processed ${transactions.length} transactions across ${Object.keys(currencyGroups).length} currencies in batch mode. Found ${result.duplicates.length} duplicates. Ready for currency groups review.`;
    console.log(msg);

    if (progressCallback) {
      progressCallback('batch_complete', {
        status: 'Batch processing complete - ready for review',
        progress: 100,
        currency_groups_temp_id: tempId,
        currency_count: Object.keys(currencyGroups).length,
        batch_processing: true
      });
    }

    return result;
  }

  // Process file for export only (without saving to database)
  async processFileForExport(filePath, userId, cashFlowId, fileSource = 'other', paymentMethod = null, paymentIdentifier = null) {
    try {
      console.log('🔄 Processing file for export only:', { filePath, fileSource });

      // Read and process the file
      const conversionResult = await this.convert_file_to_df_large(filePath, fileSource, paymentMethod, paymentIdentifier, null, null, {}, userId);
      
      if (!conversionResult.success) {
        throw new Error(conversionResult.error);
      }

      const { data: transactions, detectedFormat } = conversionResult;

      // Validate and clean transactions
      const validTransactions = transactions.filter(transaction => {
        // Basic validation
        if (!transaction.payment_date || !transaction.business_name) {
          return false;
        }

        // Clean and format transaction
        transaction.payment_date = this.ensureDateFormat(transaction.payment_date);
        if (transaction.charge_date) {
          transaction.charge_date = this.ensureDateFormat(transaction.charge_date);
        }

        // Set defaults
        if (!transaction.payment_number) transaction.payment_number = 1;
        if (!transaction.total_payments) transaction.total_payments = 1;
        if (!transaction.currency) transaction.currency = 'ILS';
        if (!transaction.source_type) transaction.source_type = 'export';

        // Add payment method and identifier if provided
        if (paymentMethod) transaction.payment_method = paymentMethod;
        if (paymentIdentifier) transaction.payment_identifier = paymentIdentifier;

        return true;
      });

      console.log(`✅ Processed ${validTransactions.length} valid transactions for export`);

      return {
        success: true,
        transactions: validTransactions,
        fileFormat: detectedFormat,
        totalRows: conversionResult.totalRows,
        processedTransactions: validTransactions.length
      };

    } catch (error) {
      console.error('❌ Export processing error:', error);
      return {
        success: false,
        error: error.message,
        transactions: []
      };
    }
  }
}

module.exports = WorkingExcelService;