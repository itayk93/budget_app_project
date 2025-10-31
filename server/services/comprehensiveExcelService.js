const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const SupabaseService = require('./supabaseService');

class ComprehensiveExcelService {
  constructor() {
    // Maximum records allowed per upload
    this.MAX_RECORDS_PER_FILE = 400;
    
    // Currency symbol mapping to ISO codes
    this.CURRENCY_SYMBOL_MAP = {
      '€': 'EUR',
      '$': 'USD',
      '£': 'GBP',
      '₪': 'ILS',
      '¥': 'JPY',
      '₹': 'INR',
      '₩': 'KRW'
    };

    // Required fields in the output
    this.REQUIRED_FIELDS = [
      'flow_month',
      'business_name',
      'payment_method',
      'payment_identifier',
      'payment_date',
      'payment_month',
      'payment_year',
      'charge_date',
      'amount',
      'currency',
      'payment_number',
      'total_payments',
      'category_name',
      'excluded_from_flow',
      'notes',
      'source_type',
      'original_amount'
    ];

    // Hebrew to English column mappings
    this.HEBREW_MAPPINGS = {
      'שייך לתזרים חודש': 'flow_month',
      'שם העסק': 'business_name',
      'שם בית העסק': 'business_name',
      'אמצעי התשלום': 'payment_method',
      'אמצעי זיהוי התשלום': 'payment_identifier',
      'תאריך התשלום': 'payment_date',
      'חודש תאריך התשלום': 'payment_month',
      'שנת תאריך התשלום': 'payment_year',
      'תאריך החיוב בחשבון': 'charge_date',
      'סכום': 'amount',
      'מטבע חיוב': 'currency',
      'מספר התשלום': 'payment_number',
      'מספר תשלומים כולל': 'total_payments',
      'קטגוריה בתזרים': 'category_name',
      'האם מוחרג מהתזרים?': 'excluded_from_flow',
      'הערות': 'notes',
      'סוג מקור': 'source_type',
      'סכום מקורי': 'original_amount'
    };

    // Header detection keywords
    this.HEADER_KEYWORDS = [
      'תאריך', 'סכום', 'שם', 'עסק', 'עסקה', 'חיוב', 'ענף',
      'date', 'amount', 'business', 'payment', 'category'
    ];
  }

  // ===== UTILITY METHODS =====

  /**
   * Normalize currency symbol to ISO code
   */
  normalizeCurrency(val) {
    if (!val || val === null || val === undefined) return '';
    
    const s = String(val).trim();
    
    // Search for known symbols
    for (const [sym, code] of Object.entries(this.CURRENCY_SYMBOL_MAP)) {
      if (s.includes(sym)) return code;
    }
    
    // If already ISO
    if (/^[A-Z]{3}$/.test(s)) return s;
    
    // Default
    return s;
  }

  /**
   * Normalize column header by removing excess whitespace
   */
  normalizeHeader(col) {
    if (!col || col === null || col === undefined) return '';
    return String(col).replace(/\s+/g, ' ').trim();
  }

  /**
   * Check if a series appears to contain date values
   */
  looksLikeDate(values) {
    if (!values || values.length === 0) return false;
    
    let dateCount = 0;
    const sampleSize = Math.min(values.length, 20);
    
    for (let i = 0; i < sampleSize; i++) {
      if (values[i] && this.parseDate(values[i])) {
        dateCount++;
      }
    }
    
    return (dateCount / sampleSize) >= 0.8;
  }

  /**
   * Check if a series appears to contain numeric values
   */
  looksLikeNumeric(values) {
    if (!values || values.length === 0) return false;
    
    let numericCount = 0;
    const sampleSize = Math.min(values.length, 20);
    
    for (let i = 0; i < sampleSize; i++) {
      if (values[i] && this.parseAmount(values[i]) !== null) {
        numericCount++;
      }
    }
    
    return (numericCount / sampleSize) >= 0.8;
  }

  /**
   * Extract the last 4 digits from a string or number
   */
  extractLast4(val) {
    if (!val || val === null || val === undefined) return '';
    
    try {
      const num = parseInt(parseFloat(val));
      return String(num).padStart(4, '0').slice(-4);
    } catch (error) {
      const s = String(val).replace(/\D/g, '');
      return s.slice(-4).padStart(4, '0') || '';
    }
  }

  /**
   * Parse amount from various formats including currency symbols
   */
  parseAmount(value) {
    if (!value || value === null || value === undefined || value === '') return null;
    
    let valStr = String(value).trim();
    
    // Return null for empty strings after trimming
    if (valStr === '' || valStr === '-' || valStr === '.') return null;
    
    // Check for currency symbols and negative indicators
    const hasEuro = valStr.includes('€');
    const hasMinus = valStr.includes('-');
    
    // Remove currency symbols and format
    valStr = valStr
      .replace(/[€$₪£¥₹₩]/g, '')
      .replace(/,/g, '.')
      .replace(/[^\d.\-]/g, '')
      .trim();
    
    // Return null if no digits remain
    if (!/\d/.test(valStr)) return null;
    
    try {
      let amount = parseFloat(valStr);
      
      if (isNaN(amount) || !isFinite(amount)) return null;
      
      // Handle Euro expenses (should be negative)
      if (hasEuro && !hasMinus && amount > 0) {
        amount = -amount;
      }
      
      return amount;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse date from various formats
   */
  parseDate(value) {
    if (!value || value === null || value === undefined || value === '') return null;
    
    try {
      const dateStr = String(value).trim();
      
      // Return null for empty strings
      if (dateStr === '') return null;
      
      // Try different date formats common in Israeli banks
      const formats = [
        'DD/MM/YYYY',
        'DD-MM-YYYY',
        'DD.MM.YYYY',
        'YYYY-MM-DD',
        'MM/DD/YYYY',
        'DD/MM/YY',
        'DD-MM-YY'
      ];
      
      for (const format of formats) {
        const parsed = moment(dateStr, format, true);
        if (parsed.isValid() && parsed.year() >= 1900 && parsed.year() <= 2100) {
          return parsed.format('YYYY-MM-DD');
        }
      }
      
      // Try general parsing with day first preference
      const parsed = moment(dateStr, moment.ISO_8601, true);
      if (parsed.isValid() && parsed.year() >= 1900 && parsed.year() <= 2100) {
        return parsed.format('YYYY-MM-DD');
      }
      
      // Last resort - try JavaScript Date parsing with validation
      const jsDate = new Date(dateStr);
      if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() >= 1900 && jsDate.getFullYear() <= 2100) {
        return moment(jsDate).format('YYYY-MM-DD');
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate transaction hash for duplicate detection
   */
  generateTransactionHash(transaction) {
    const hashData = [
      transaction.business_name || '',
      String(transaction.amount || 0),
      transaction.payment_date || '',
      transaction.currency || 'ILS'
    ].join('|');
    
    return crypto.createHash('md5').update(hashData).digest('hex');
  }

  // ===== FILE TYPE DETECTION =====

  /**
   * Detect file type from extension or content
   */
  detectFileType(filePath) {
    if (fs.statSync(filePath).isDirectory()) {
      return 'directory';
    }
    
    const ext = path.extname(filePath).toLowerCase();
    
    if (['.xlsx', '.xls'].includes(ext)) return 'excel';
    if (ext === '.csv') return 'csv';
    
    return 'unknown';
  }

  // ===== HEADER DETECTION =====

  /**
   * Find the header row in raw data
   */
  findHeaderRow(rawData) {
    if (!rawData || rawData.length === 0) return null;
    
    // Method 1: Look for rows with multiple keywords
    for (let i = 0; i < rawData.length && i < 10; i++) {
      const row = rawData[i];
      if (!row) continue;
      
      const rowText = row.join(' ').toLowerCase();
      const keywordCount = this.HEADER_KEYWORDS.filter(kw => rowText.includes(kw)).length;
      
      if (keywordCount >= 2 && i < rawData.length - 1) {
        const currentRowCellCount = row.filter(cell => cell !== null && cell !== undefined && cell !== '').length;
        const nextRowCellCount = rawData[i + 1] ? rawData[i + 1].filter(cell => cell !== null && cell !== undefined && cell !== '').length : 0;
        
        if (currentRowCellCount >= 3 && nextRowCellCount >= 3) {
          return i;
        }
      }
    }
    
    // Method 2: Look for consistent data patterns
    for (let i = 0; i < rawData.length && i < 10; i++) {
      const row = rawData[i];
      if (!row) continue;
      
      const currentRowCellCount = row.filter(cell => cell !== null && cell !== undefined && cell !== '').length;
      
      if (currentRowCellCount >= 3 && i < rawData.length - 3) {
        const nextRowCounts = [];
        for (let j = 1; j <= 3; j++) {
          if (rawData[i + j]) {
            const count = rawData[i + j].filter(cell => cell !== null && cell !== undefined && cell !== '').length;
            nextRowCounts.push(count);
          }
        }
        
        if (nextRowCounts.length >= 3 && Math.min(...nextRowCounts) >= 3 && Math.max(...nextRowCounts) - Math.min(...nextRowCounts) <= 2) {
          return i;
        }
      }
    }
    
    return null;
  }

  // ===== CSV PROCESSING =====

  /**
   * Read CSV file with Hebrew headers and various encodings
   */
  async readCsvWithHebrewHeaders(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      let headers = null;
      
      fs.createReadStream(filePath)
        .pipe(csv({ 
          headers: false,
          skipEmptyLines: true,
          encoding: 'utf8'
        }))
        .on('data', (data) => {
          const row = Object.values(data);
          if (!headers) {
            headers = row.map(h => this.normalizeHeader(h));
            return;
          }
          results.push(row);
        })
        .on('end', () => {
          // Apply Hebrew mappings to headers
          const mappedHeaders = headers.map(header => 
            this.HEBREW_MAPPINGS[header] || header
          );
          
          // Convert to object format
          const processedData = results.map(row => {
            const obj = {};
            mappedHeaders.forEach((header, index) => {
              obj[header] = row[index];
            });
            return obj;
          });
          
          resolve(this.processCsvData(processedData, headers));
        })
        .on('error', (error) => {
          // Try with different encoding
          this.readCsvWithAlternativeEncoding(filePath)
            .then(resolve)
            .catch(reject);
        });
    });
  }

  /**
   * Try reading CSV with alternative encoding
   */
  async readCsvWithAlternativeEncoding(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      let headers = null;
      
      fs.createReadStream(filePath)
        .pipe(csv({ 
          headers: false,
          skipEmptyLines: true,
          encoding: 'utf8'
        }))
        .on('data', (data) => {
          const row = Object.values(data);
          if (!headers) {
            headers = row.map(h => this.normalizeHeader(h));
            return;
          }
          results.push(row);
        })
        .on('end', () => {
          const mappedHeaders = headers.map(header => 
            this.HEBREW_MAPPINGS[header] || header
          );
          
          const processedData = results.map(row => {
            const obj = {};
            mappedHeaders.forEach((header, index) => {
              obj[header] = row[index];
            });
            return obj;
          });
          
          resolve(this.processCsvData(processedData, headers));
        })
        .on('error', reject);
    });
  }

  /**
   * Process CSV data and normalize
   */
  processCsvData(data, originalHeaders) {
    if (!data || data.length === 0) return [];
    
    return data.map(row => {
      const processedRow = { ...row };
      
      // Set defaults
      if (!processedRow.currency) processedRow.currency = 'ILS';
      if (!processedRow.source_type) processedRow.source_type = 'creditCard';
      
      // Normalize currency
      if (processedRow.currency) {
        processedRow.currency = this.normalizeCurrency(processedRow.currency);
      }
      
      // Process payment dates and derive month/year
      if (processedRow.payment_date) {
        const parsedDate = this.parseDate(processedRow.payment_date);
        if (parsedDate) {
          processedRow.payment_date = parsedDate;
          const dateMoment = moment(parsedDate);
          
          if (!processedRow.payment_month) {
            processedRow.payment_month = dateMoment.month() + 1;
          }
          if (!processedRow.payment_year) {
            processedRow.payment_year = dateMoment.year();
          }
          if (!processedRow.flow_month) {
            processedRow.flow_month = dateMoment.format('YYYY-MM');
          }
        }
      }
      
      // Ensure we have a business_name
      if (!processedRow.business_name && originalHeaders) {
        const possibleNameCols = originalHeaders.filter(col => 
          col.includes('שם') || col.includes('עסק') || col.includes('תיאור')
        );
        
        for (const col of possibleNameCols) {
          if (row[col]) {
            processedRow.business_name = row[col];
            break;
          }
        }
      }
      
      return processedRow;
    }).filter(row => row.business_name && row.payment_date && row.flow_month);
  }

  // ===== SHEET MAPPING =====

  /**
   * Map raw sheet data to standardized structure
   */
  mapSheet(rawData, fileSource = null) {
    if (!rawData || rawData.length === 0) return [];
    
    const result = rawData.map((row, index) => {
      const mappedRow = {};
      mappedRow.source_type = 'creditCard';
      
      // Process each column
      Object.keys(row).forEach(col => {
        const colLower = String(col).toLowerCase();
        const value = row[col];
        
        // Handle dates
        if (colLower.includes('תאריך') || colLower.includes('date') || this.looksLikeDate([value])) {
          if (!mappedRow.payment_date) {
            mappedRow.payment_date = this.parseDate(value);
          } else if (!mappedRow.charge_date) {
            mappedRow.charge_date = this.parseDate(value);
          }
          return;
        }
        
        // Handle amounts
        if (
          colLower.includes('סכום חיוב') ||
          colLower.includes('amount') ||
          ['סכום', 'amount', 'charge'].some(word => colLower.includes(word))
        ) {
          let amount = this.parseAmount(value);
          
          if (amount !== null) {
            // Handle credit card specifics
            if (fileSource && ['isracard', 'gold', 'mastercard', 'visa'].includes(fileSource.toLowerCase())) {
              // For credit cards, expenses are typically positive but should be negative
              if (amount > 0) amount = -Math.abs(amount);
            }
            
            // Reverse the sign as per original logic
            mappedRow.amount = amount * -1;
          }
          return;
        }
        
        // Handle original amount
        if (colLower.includes('סכום מקורי') || colLower.includes('original')) {
          mappedRow.original_amount = this.parseAmount(value);
          return;
        }
        
        // Handle payment identifier
        if (colLower.includes('4 ספרות')) {
          mappedRow.payment_identifier = this.extractLast4(value);
          return;
        }
        
        // Special handling for Isracard currency
        if (fileSource && fileSource.toLowerCase() === 'isracard' && colLower === 'מטבע מקור') {
          mappedRow.currency = this.normalizeCurrency(value);
          return;
        }
        
        // Handle currency
        if (colLower.includes('מטבע') || colLower.includes('currency')) {
          mappedRow.currency = this.normalizeCurrency(value);
          return;
        }
        
        // Handle business name
        if (
          colLower.includes('שם') || colLower.includes('עסק') || colLower.includes('תיאור') ||
          colLower.includes('business') || colLower.includes('merchant') || colLower.includes('description')
        ) {
          if (!mappedRow.business_name) {
            mappedRow.business_name = String(value).trim();
          }
          return;
        }
        
        // Handle payment method
        if (colLower.includes('אמצעי') || colLower.includes('payment_method')) {
          mappedRow.payment_method = String(value).trim();
          return;
        }
        
        // Handle category
        if (colLower.includes('קטגוריה') || colLower.includes('ענף') || colLower.includes('category')) {
          mappedRow.category_name = String(value).trim();
          return;
        }
        
        // Handle notes
        if (colLower.includes('הערות') || colLower.includes('notes')) {
          mappedRow.notes = String(value).trim();
          return;
        }
      });
      
      // Set missing required fields to null
      this.REQUIRED_FIELDS.forEach(field => {
        if (!(field in mappedRow)) {
          mappedRow[field] = null;
        }
      });
      
      // Override category for different file sources
      if (fileSource) {
        if (fileSource.toLowerCase() === 'budgetlens') {
          // Keep original categories for BudgetLens - do nothing
          // The category was already correctly mapped from "קטגוריה בתזרים"
        } else if (fileSource.toLowerCase() === 'isracard') {
          mappedRow.category_name = 'הוצאות תזרימיות';
        } else {
          mappedRow.category_name = 'הוצאות משתנות';
        }
        
        // Set payment_method to file_source unless it's 'other'
        if (fileSource.toLowerCase() !== 'other' && !mappedRow.payment_method) {
          mappedRow.payment_method = fileSource;
        }
      }
      
      // Derive additional fields from payment_date
      if (mappedRow.payment_date) {
        const dateMoment = moment(mappedRow.payment_date);
        if (dateMoment.isValid()) {
          if (!mappedRow.payment_month) mappedRow.payment_month = dateMoment.month() + 1;
          if (!mappedRow.payment_year) mappedRow.payment_year = dateMoment.year();
          if (!mappedRow.flow_month) mappedRow.flow_month = dateMoment.format('YYYY-MM');
        }
      }
      
      return mappedRow;
    });
    
    return result;
  }

  // ===== FILE CONVERSION =====

  /**
   * Convert file to standardized DataFrame equivalent
   */
  async convertFileToDataFrame(
    srcPath,
    fileSource = null,
    paymentMethodOverride = null,
    paymentIdentifierOverride = null
  ) {
    console.log(`[convertFileToDataFrame] Starting conversion of: ${path.basename(srcPath)}`);
    console.log(`[convertFileToDataFrame] File source: ${fileSource}`);
    console.log(`[convertFileToDataFrame] Payment method override: ${paymentMethodOverride}`);
    
    const fileType = this.detectFileType(srcPath);
    console.log(`[convertFileToDataFrame] Detected file type: ${fileType}`);
    
    let processedData = [];
    
    if (fileType === 'excel') {
      console.log(`[convertFileToDataFrame] Processing Excel file...`);
      
      const workbook = XLSX.readFile(srcPath);
      const allFrames = [];
      
      console.log(`[convertFileToDataFrame] Sheet names: ${workbook.SheetNames}`);
      
      for (const sheetName of workbook.SheetNames) {
        console.log(`[convertFileToDataFrame] Processing sheet: ${sheetName}`);
        
        // Read raw data
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        console.log(`[convertFileToDataFrame] Raw sheet shape: ${rawData.length} rows`);
        
        const headerRow = this.findHeaderRow(rawData);
        console.log(`[convertFileToDataFrame] Found header at row: ${headerRow}`);
        
        if (headerRow === null) {
          console.log(`[convertFileToDataFrame] No header found, skipping sheet ${sheetName}`);
          continue;
        }
        
        // Adjust header to always be at least 2 (row 3)
        const adjustedHeader = Math.max(headerRow, 2);
        
        // Read with proper header
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { 
          header: adjustedHeader,
          defval: null
        });
        
        console.log(`[convertFileToDataFrame] After header processing, shape: ${sheetData.length} rows`);
        
        if (sheetData.length > 0) {
          console.log(`[convertFileToDataFrame] Original columns: ${Object.keys(sheetData[0])}`);
          
          // Normalize headers
          const normalizedData = sheetData.map(row => {
            const normalizedRow = {};
            Object.keys(row).forEach(key => {
              const normalizedKey = this.normalizeHeader(key);
              normalizedRow[normalizedKey] = row[key];
            });
            return normalizedRow;
          });
          
          console.log(`[convertFileToDataFrame] Normalized columns: ${Object.keys(normalizedData[0] || {})}`);
          
          const mappedSheet = this.mapSheet(normalizedData, fileSource);
          console.log(`[convertFileToDataFrame] Mapped sheet shape: ${mappedSheet.length} rows`);
          
          allFrames.push(...mappedSheet);
        }
      }
      
      if (allFrames.length === 0) {
        console.log(`[convertFileToDataFrame] ERROR: No usable sheets found in file`);
        throw new Error('No usable sheets found in file');
      }
      
      console.log(`[convertFileToDataFrame] Combined ${allFrames.length} rows from all sheets`);
      processedData = allFrames;
      
    } else if (fileType === 'csv') {
      const logger = require('../utils/logger');
      logger.debug('COMPREHENSIVE_EXCEL', 'Processing CSV file...');
      processedData = await this.readCsvWithHebrewHeaders(srcPath);
      logger.debug('COMPREHENSIVE_EXCEL', 'CSV processing complete', { rows: processedData.length });
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
    
    // Validate and clean data before filtering
    const logger = require('../utils/logger');
    logger.debug('COMPREHENSIVE_EXCEL', 'Before data validation', { rows: processedData.length });
    processedData = processedData.map(row => {
      // Ensure amount is valid number or null
      if (row.amount !== null && row.amount !== undefined) {
        const validAmount = this.parseAmount(row.amount);
        row.amount = validAmount;
      }
      
      // Ensure payment_date is valid or null
      if (row.payment_date) {
        const validDate = this.parseDate(row.payment_date);
        row.payment_date = validDate;
      }
      
      // Ensure charge_date is valid or null
      if (row.charge_date) {
        const validChargeDate = this.parseDate(row.charge_date);
        row.charge_date = validChargeDate;
      }
      
      // Ensure business_name is string or null
      if (row.business_name && typeof row.business_name !== 'string') {
        row.business_name = String(row.business_name).trim() || null;
      }
      
      // Calculate flow_month if payment_date is valid (but preserve existing CSV values)
      if (row.payment_date) {
        const dateMoment = moment(row.payment_date);
        if (dateMoment.isValid()) {
          // Only calculate flow_month if not already set from CSV
          if (!row.flow_month) {
            row.flow_month = dateMoment.format('YYYY-MM');
            const logger = require('../utils/logger');
            logger.debug('COMPREHENSIVE_EXCEL', 'Calculated flow_month from payment_date', { flow_month: row.flow_month, payment_date: row.payment_date });
          } else {
            const logger = require('../utils/logger');
            logger.debug('COMPREHENSIVE_EXCEL', 'Preserving CSV flow_month', { flow_month: row.flow_month, payment_date: row.payment_date });
          }
          row.payment_month = dateMoment.month() + 1;
          row.payment_year = dateMoment.year();
        }
      }
      
      return row;
    });
    
    // Filter out rows with missing essential data
    logger.debug('COMPREHENSIVE_EXCEL', 'Before filtering missing data', { rows: processedData.length });
    processedData = processedData.filter(row => 
      row.business_name && 
      row.payment_date && 
      row.flow_month && 
      row.amount !== null && 
      row.amount !== undefined &&
      !isNaN(row.amount)
    );
    logger.debug('COMPREHENSIVE_EXCEL', 'After filtering missing data', { rows: processedData.length });
    
    // Apply overrides based on file source
    const isBudgetLens = fileSource && fileSource.toLowerCase() === 'budgetlens';
    logger.debug('COMPREHENSIVE_EXCEL', 'Is BudgetLens file', { isBudgetLens });
    
    if (!isBudgetLens) {
      // For non-BudgetLens files, apply overrides if provided
      if (paymentMethodOverride) {
        logger.debug('COMPREHENSIVE_EXCEL', 'Applying payment method override', { paymentMethodOverride });
        processedData.forEach(row => {
          row.payment_method = paymentMethodOverride;
        });
      }
      
      if (paymentIdentifierOverride) {
        logger.debug('COMPREHENSIVE_EXCEL', 'Applying payment identifier override', { paymentIdentifierOverride });
        processedData.forEach(row => {
          row.payment_identifier = paymentIdentifierOverride;
        });
      }
    }
    
    // Generate transaction hashes
    processedData.forEach(row => {
      row.transaction_hash = this.generateTransactionHash(row);
    });
    
    return processedData;
  }

  // ===== FILE SIZE AND CHUNKING =====

  /**
   * Check file size and return metadata
   */
  checkFileSize(filePath) {
    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
    
    return {
      path: filePath,
      sizeBytes: fileSizeInBytes,
      sizeMB: Math.round(fileSizeInMB * 100) / 100,
      isLarge: fileSizeInMB > 10,
      needsChunking: fileSizeInMB > 20
    };
  }

  /**
   * Split large file into smaller chunks
   */
  async splitFileToChunks(filePath, maxRecords = this.MAX_RECORDS_PER_FILE) {
    const fileType = this.detectFileType(filePath);
    const splitFiles = [];
    
    try {
      if (fileType === 'excel') {
        // Read the entire Excel file
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        const totalRecords = data.length;
        const chunksNeeded = Math.ceil(totalRecords / maxRecords);
        
        for (let i = 0; i < chunksNeeded; i++) {
          const startIdx = i * maxRecords;
          const endIdx = Math.min((i + 1) * maxRecords, totalRecords);
          const chunkData = data.slice(startIdx, endIdx);
          
          // Create new workbook for chunk
          const newWorkbook = XLSX.utils.book_new();
          const newWorksheet = XLSX.utils.json_to_sheet(chunkData);
          XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Sheet1');
          
          // Save chunk file
          const chunkPath = filePath.replace(/\.xlsx?$/, `_chunk_${i + 1}.xlsx`);
          XLSX.writeFile(newWorkbook, chunkPath);
          splitFiles.push(chunkPath);
        }
        
      } else if (fileType === 'csv') {
        // Read CSV and split
        const csvData = await this.readCsvWithHebrewHeaders(filePath);
        const totalRecords = csvData.length;
        const chunksNeeded = Math.ceil(totalRecords / maxRecords);
        
        for (let i = 0; i < chunksNeeded; i++) {
          const startIdx = i * maxRecords;
          const endIdx = Math.min((i + 1) * maxRecords, totalRecords);
          const chunkData = csvData.slice(startIdx, endIdx);
          
          // Convert to Excel for consistency
          const workbook = XLSX.utils.book_new();
          const worksheet = XLSX.utils.json_to_sheet(chunkData);
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
          
          const chunkPath = filePath.replace(/\.csv$/, `_chunk_${i + 1}.xlsx`);
          XLSX.writeFile(workbook, chunkPath);
          splitFiles.push(chunkPath);
        }
      }
      
      return splitFiles;
    } catch (error) {
      console.error('Error splitting file:', error);
      throw error;
    }
  }

  // ===== MULTI-STEP PROCESSING =====

  /**
   * Process transactions one by one with progress tracking
   */
  async processTransactionsOneByOne(
    transactions,
    userId,
    cashFlowId,
    progressCallback = null,
    userDefaultCurrency = 'ILS'
  ) {
    const results = {
      totalTransactions: transactions.length,
      processedTransactions: 0,
      successfulImports: 0,
      duplicates: [],
      currencyMismatches: [],
      errors: [],
      processingTime: 0
    };
    
    const startTime = Date.now();
    
    console.log(`[processTransactionsOneByOne] Starting processing of ${transactions.length} transactions`);
    
    if (progressCallback) {
      progressCallback('processing_started', {
        status: 'Started processing transactions',
        progress: 0,
        currentTransaction: 0,
        totalTransactions: transactions.length
      });
    }
    
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      
      try {
        // Add required fields
        transaction.user_id = userId;
        transaction.cash_flow_id = cashFlowId;
        transaction.id = uuidv4();
        
        console.log('🏷️ Setting transaction user_id:', {
          userId: userId,
          transaction_user_id: transaction.user_id,
          business_name: transaction.business_name
        });
        
        // Ensure proper amount format
        const amount = this.ensureProperAmount(transaction);
        if (amount === null || amount === undefined || amount === "" || isNaN(amount)) {
          console.warn(`Skipping transaction with invalid amount: ${JSON.stringify(transaction.amount)}`);
          continue;
        }
        transaction.amount = amount;
        
        // Ensure proper date format
        transaction.payment_date = this.ensureDateFormat(transaction.payment_date);
        transaction.charge_date = this.ensureDateFormat(transaction.charge_date);
        
        // Check for currency mismatch
        if (transaction.currency && transaction.currency !== userDefaultCurrency) {
          results.currencyMismatches.push({
            transaction,
            userCurrency: userDefaultCurrency,
            transactionCurrency: transaction.currency
          });
        }
        
        // Check for duplicates
        const existingTransactions = await SupabaseService.getTransactionsByHash(
          transaction.transaction_hash,
          userId
        );
        
        if (existingTransactions && existingTransactions.length > 0) {
          results.duplicates.push({
            newTransaction: transaction,
            existingTransactions: existingTransactions,
            count: existingTransactions.length + 1
          });
          
          console.log(`[processTransactionsOneByOne] Duplicate found for transaction ${i + 1}`);
        } else {
          // Import transaction
          const importResult = await SupabaseService.createTransaction(transaction);
          
          if (importResult.success) {
            results.successfulImports++;
            console.log(`[processTransactionsOneByOne] Successfully imported transaction ${i + 1}`);
          } else if (importResult.invalid_amount) {
            // Skip transactions with invalid amounts instead of counting as errors
            console.warn(`[processTransactionsOneByOne] Skipping transaction ${i + 1} with invalid amount: ${transaction.amount}`);
          } else {
            results.errors.push({
              transaction,
              error: importResult.error || 'Unknown error during import'
            });
            console.log(`[processTransactionsOneByOne] Error importing transaction ${i + 1}: ${importResult.error}`);
          }
        }
        
        results.processedTransactions++;
        
        // Update progress
        if (progressCallback && (i + 1) % 10 === 0) {
          const progress = Math.round(((i + 1) / transactions.length) * 100);
          progressCallback('processing_progress', {
            status: `Processing transaction ${i + 1} of ${transactions.length}`,
            progress,
            currentTransaction: i + 1,
            totalTransactions: transactions.length,
            successfulImports: results.successfulImports,
            duplicates: results.duplicates.length,
            errors: results.errors.length
          });
        }
        
      } catch (error) {
        results.errors.push({
          transaction,
          error: error.message || 'Unknown processing error'
        });
        console.error(`[processTransactionsOneByOne] Error processing transaction ${i + 1}:`, error);
      }
    }
    
    results.processingTime = Date.now() - startTime;
    
    console.log(`[processTransactionsOneByOne] Processing complete:`, {
      totalTransactions: results.totalTransactions,
      successfulImports: results.successfulImports,
      duplicates: results.duplicates.length,
      currencyMismatches: results.currencyMismatches.length,
      errors: results.errors.length,
      processingTimeMs: results.processingTime
    });
    
    if (progressCallback) {
      progressCallback('processing_complete', {
        status: 'Processing complete',
        progress: 100,
        results
      });
    }
    
    return results;
  }

  /**
   * Ensure proper amount format
   */
  ensureProperAmount(transaction) {
    console.log('🔍 ensureProperAmount input:', {
      business_name: transaction?.business_name,
      amount: transaction?.amount,
      amount_type: typeof transaction?.amount,
      amount_string_repr: JSON.stringify(transaction?.amount)
    });

    if (!transaction || !transaction.amount) {
      console.log('❌ No transaction or amount, returning null');
      return null;
    }
    
    let amount = transaction.amount;
    
    // Convert to number if string
    if (typeof amount === 'string') {
      console.log('🔄 Converting string amount:', amount);
      amount = this.parseAmount(amount);
      console.log('🔄 After parseAmount:', amount);
    }
    
    // Ensure it's a valid number
    if (isNaN(amount) || amount === null) {
      console.log('❌ Invalid amount, returning null:', amount);
      return null;
    }
    
    const result = Number(amount);
    console.log('✅ Final amount:', result);
    return result;
  }

  /**
   * Ensure proper date format (YYYY-MM-DD)
   */
  ensureDateFormat(dateStr) {
    if (!dateStr) return null;
    
    const parsed = this.parseDate(dateStr);
    return parsed;
  }

  /**
   * Group transactions by currency
   */
  groupByCurrency(transactions) {
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

  /**
   * Check for duplicates in all currency groups
   */
  async checkDuplicatesForGroups(currencyGroups, userId, cashFlowId) {
    const allDuplicates = {};
    
    for (const [currency, group] of Object.entries(currencyGroups)) {
      const duplicates = await this.checkDuplicates(group.transactions, userId, cashFlowId);
      if (Object.keys(duplicates).length > 0) {
        Object.assign(allDuplicates, duplicates);
      }
    }
    
    return allDuplicates;
  }

  /**
   * Check for duplicates in transactions
   */
  async checkDuplicates(transactions, userId, cashFlowId) {
    const duplicates = {};
    
    for (const transaction of transactions) {
      try {
        // Generate transaction hash
        transaction.transaction_hash = SupabaseService.generateTransactionHash(transaction);
        
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

  // ===== MAIN PROCESSING FUNCTIONS =====

  /**
   * Process financial file for multi-step upload (without importing)
   */
  async processFinancialFileMultiStep(
    filePath,
    userId,
    cashFlowId,
    fileSource = null,
    paymentMethodOverride = null,
    paymentIdentifierOverride = null,
    progressCallback = null
  ) {
    try {
      if (progressCallback) {
        progressCallback('reading_file', { status: 'מתחיל קריאת הקובץ...', progress: 10 });
      }

      // Convert file to DataFrame
      const transactions = await this.convertFileToDataFrame(
        filePath,
        fileSource,
        paymentMethodOverride,
        paymentIdentifierOverride
      );

      if (progressCallback) {
        progressCallback('detecting_currency', { status: 'מזהה מטבעות...', progress: 40 });
      }

      // Group by currency
      const currencyGroups = this.groupByCurrency(transactions);

      if (progressCallback) {
        progressCallback('checking_duplicates', { status: 'בודק כפילויות...', progress: 70 });
      }

      // Check for duplicates
      const duplicates = await this.checkDuplicatesForGroups(currencyGroups, userId, cashFlowId);

      if (progressCallback) {
        progressCallback('completed', { status: 'העיבוד הושלם!', progress: 100 });
      }

      return {
        success: true,
        detectedFormat: this.detectFileType(filePath),
        totalRows: transactions.length,
        processedTransactions: transactions.length,
        transactions,
        currencyGroups,
        duplicates
      };

    } catch (error) {
      console.error('[processFinancialFileMultiStep] Error:', error);
      if (progressCallback) {
        progressCallback('error', { status: `שגיאה: ${error.message}`, progress: 0 });
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process financial file with comprehensive handling
   */
  async processFinancialFile(
    filePath,
    userId,
    cashFlowId = null,
    fileSource = null,
    paymentMethod = null,
    paymentIdentifier = null,
    progressCallback = null,
    exportBeforeUpload = false,
    exportFormat = 'csv',
    projectDir = null
  ) {
    const startTime = Date.now();
    
    if (progressCallback) {
      progressCallback('process_started', {
        status: `Starting file processing: ${path.basename(filePath)}`,
        progress: 0
      });
    }
    
    try {
      console.log(`[processFinancialFile] Starting processing of: ${filePath}`);
      console.log(`[processFinancialFile] User ID: ${userId}`);
      console.log(`[processFinancialFile] Cash Flow ID: ${cashFlowId}`);
      console.log(`[processFinancialFile] File Source: ${fileSource}`);
      
      // Step 1: Check file size
      const fileInfo = this.checkFileSize(filePath);
      console.log(`[processFinancialFile] File info:`, fileInfo);
      
      if (progressCallback) {
        progressCallback('file_analysis', {
          status: 'Analyzing file...',
          progress: 10,
          fileInfo
        });
      }
      
      // Step 2: Split file if needed
      let filesToProcess = [filePath];
      if (fileInfo.needsChunking) {
        console.log(`[processFinancialFile] File is large, splitting into chunks...`);
        filesToProcess = await this.splitFileToChunks(filePath);
        
        if (progressCallback) {
          progressCallback('file_split', {
            status: `File split into ${filesToProcess.length} chunks`,
            progress: 20,
            chunks: filesToProcess.length
          });
        }
      }
      
      // Step 3: Process each file/chunk
      let allTransactions = [];
      
      for (let i = 0; i < filesToProcess.length; i++) {
        const currentFile = filesToProcess[i];
        console.log(`[processFinancialFile] Processing file ${i + 1}/${filesToProcess.length}: ${currentFile}`);
        
        if (progressCallback) {
          progressCallback('processing_chunk', {
            status: `Processing chunk ${i + 1} of ${filesToProcess.length}`,
            progress: 20 + (i / filesToProcess.length) * 30
          });
        }
        
        const chunkTransactions = await this.convertFileToDataFrame(
          currentFile,
          fileSource,
          paymentMethod,
          paymentIdentifier
        );
        
        allTransactions.push(...chunkTransactions);
      }
      
      console.log(`[processFinancialFile] Total transactions extracted: ${allTransactions.length}`);
      
      if (progressCallback) {
        progressCallback('data_extracted', {
          status: `Extracted ${allTransactions.length} transactions`,
          progress: 50,
          transactionCount: allTransactions.length
        });
      }
      
      // Step 4: Process transactions one by one
      const processingResults = await this.processTransactionsOneByOne(
        allTransactions,
        userId,
        cashFlowId,
        (stage, data) => {
          if (progressCallback) {
            progressCallback(stage, {
              ...data,
              progress: 50 + (data.progress || 0) * 0.4 // Scale to 50-90%
            });
          }
        }
      );
      
      // Step 5: Clean up temporary files
      if (filesToProcess.length > 1) {
        for (const tempFile of filesToProcess) {
          if (tempFile !== filePath && fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        }
      }
      
      const totalTime = Date.now() - startTime;
      
      const finalResults = {
        success: true,
        fileInfo,
        chunksProcessed: filesToProcess.length,
        totalTransactions: allTransactions.length,
        processingResults,
        processingTimeMs: totalTime,
        filePath: path.basename(filePath),
        fileSource
      };
      
      console.log(`[processFinancialFile] Processing complete:`, {
        success: true,
        totalTransactions: allTransactions.length,
        successfulImports: processingResults.successfulImports,
        duplicates: processingResults.duplicates.length,
        errors: processingResults.errors.length,
        totalTimeMs: totalTime
      });
      
      if (progressCallback) {
        progressCallback('process_complete', {
          status: 'Processing complete',
          progress: 100,
          results: finalResults
        });
      }
      
      return finalResults;
      
    } catch (error) {
      console.error(`[processFinancialFile] Error processing file:`, error);
      
      const errorResult = {
        success: false,
        error: error.message,
        filePath: path.basename(filePath),
        processingTimeMs: Date.now() - startTime
      };
      
      if (progressCallback) {
        progressCallback('process_error', {
          status: `Error: ${error.message}`,
          progress: 0,
          error: error.message
        });
      }
      
      return errorResult;
    }
  }

  // ===== EXPORT METHODS =====

  /**
   * Export processed data to various formats
   */
  async exportProcessedData(data, outputPath, format = 'csv') {
    try {
      if (format === 'excel' || format === 'xlsx') {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
        XLSX.writeFile(workbook, outputPath);
      } else if (format === 'csv') {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
        XLSX.writeFile(workbook, outputPath.replace('.csv', '.xlsx'));
      }
      
      return {
        success: true,
        outputPath,
        recordCount: data.length
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ComprehensiveExcelService;
