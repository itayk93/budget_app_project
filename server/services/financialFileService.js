const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const WorkingExcelService = require('./workingExcelService');
const SupabaseService = require('./supabaseService');

class FinancialFileService {
  constructor() {
    this.workingExcelService = new WorkingExcelService();
  }

  // Exact implementation of Flask's process_financial_file function
  async processFinancialFile(filePath, userId, cashFlowId = null, fileSource = null,
                            paymentMethod = null, paymentIdentifier = null,
                            progressCallback = null, exportBeforeUpload = false,
                            exportFormat = 'csv', projectDir = null) {
    const startTime = Date.now();

    if (progressCallback) {
      progressCallback('process_started', {
        status: `Starting file processing: ${path.basename(filePath)}`,
        progress: 0
      });
    }

    // Initialize variables to track state
    let hasRequestContext = false;
    let supabaseService = null;

    // Step 1: Check if running in request context and can connect to Supabase
    try {
      // Test the connection
      try {
        const testResult = await SupabaseService.testConnection();
        if (testResult) {
          hasRequestContext = true;
          supabaseService = SupabaseService;
        } else {
          hasRequestContext = false;
        }
      } catch (error) {
        console.error('Error testing Supabase connection:', error);
        hasRequestContext = false;
      }
    } catch (error) {
      console.error('Error during Supabase connection setup:', error);
      hasRequestContext = false;
    }

    try {
      // Step 2: Validate inputs
      if (!fs.existsSync(filePath)) {
        const errorMsg = `File not found: ${filePath}`;
        console.error(errorMsg);
        if (progressCallback) {
          progressCallback('error', { status: `Error: ${errorMsg}`, progress: 0 });
        }
        return { success: false, message: errorMsg, imported: 0, errors: 1 };
      }

      if (!userId) {
        const errorMsg = 'No user_id provided';
        console.error(errorMsg);
        if (progressCallback) {
          progressCallback('error', { status: `Error: ${errorMsg}`, progress: 0 });
        }
        return { success: false, message: errorMsg, imported: 0, errors: 1 };
      }

      // Step 3: Detect file type
      if (progressCallback) {
        progressCallback('detecting_type', { status: 'Detecting file type', progress: 2 });
      }

      const fileType = this.workingExcelService.detectFileType(filePath);

      if (progressCallback) {
        progressCallback('file_type_detected', {
          status: `Detected file type: ${fileType}`,
          progress: 3
        });
      }

      // Check if file type is supported
      if (fileType === 'unknown') {
        const errorMsg = `Unsupported file type: ${path.extname(filePath)}`;
        console.error(errorMsg);
        if (progressCallback) {
          progressCallback('error', { status: `Error: ${errorMsg}`, progress: 0 });
        }
        return { success: false, message: errorMsg, imported: 0, errors: 1 };
      }

      // Step 4: Process file with multi-step processing (includes conversion, duplicate detection, etc.)
      if (progressCallback) {
        progressCallback('processing_file', {
          status: 'Processing file with multi-step approach',
          progress: 10
        });
      }

      // Step 5: Process transactions based on context
      console.log(`[process_financial_file] About to process file with multi-step approach`);
      console.log(`[process_financial_file] has_request_context: ${hasRequestContext}`);

      let result;
      try {
        if (hasRequestContext) {
          console.log(`[process_financial_file] Processing with database context using multi-step processing...`);
          result = await this.workingExcelService.processFinancialFileMultiStep(
            filePath, userId, cashFlowId, fileSource, paymentMethod, paymentIdentifier, progressCallback, exportBeforeUpload
          );
          console.log(`[process_financial_file] multi-step processing result:`, result);
          // The result already contains all needed fields from multi-step processing
          if (!result.success) {
            console.log(`[process_financial_file] multi-step processing failed: ${result.error || result.message}`);
          }
        } else {
          // Simulation mode - return basic info without processing
          result = {
            success: true,
            imported: 0,
            errors: 0,
            duplicates: [],
            total: 0,
            error_details: [],
            cash_flow_id: cashFlowId,
            processing_time: Date.now() - startTime,
            has_request_context: false,
            message: 'File processed successfully but data could not be saved to database (simulation mode).',
            processed_transactions: [],
            processed_count: 0,
            transactions: []
          };
          console.log(`[process_financial_file] Simulation mode - no actual processing done`);
        }
      } catch (processingError) {
        console.log(`[process_financial_file] ERROR during transaction processing: ${processingError}`);
        console.error(processingError);
        result = {
          success: false,
          message: `Error processing transactions: ${processingError.message}`,
          imported: 0,
          errors: 1,
          transactions: []
        };
      }

      console.log(`[process_financial_file] After processing context, result keys: ${Object.keys(result || {})}`);
      if (result && result.transactions) {
        console.log(`[process_financial_file] Result contains ${result.transactions.length} transactions`);
      } else {
        console.log(`[process_financial_file] Result does NOT contain transactions field`);
      }

      // Step 6: Finalize result
      result.file_type = fileType;
      result.file_name = path.basename(filePath);
      result.file_source = fileSource;
      result.processing_time = Date.now() - startTime;

      // Add currencies from transactions if available
      if (result.transactions && result.transactions.length > 0) {
        const uniqueCurrencies = new Set();
        result.transactions.forEach(tx => {
          const currency = tx.currency || 'ILS';
          if (currency) {
            uniqueCurrencies.add(currency);
          }
        });
        result.currencies = Array.from(uniqueCurrencies).sort();
        console.log(`[process_financial_file] Found currencies: ${result.currencies}`);
      } else {
        result.currencies = [];
      }

      // Add export path to result if available
      if (exportPath) {
        result.export_path = exportPath;
      }

      const totalElapsed = Date.now() - startTime;

      // Final progress update
      if (progressCallback) {
        let finalStatus = 'Processing complete';
        if (!hasRequestContext) {
          finalStatus += ' (SIMULATION MODE - no database operations performed)';
        }
        progressCallback('complete', {
          status: finalStatus,
          progress: 100,
          elapsed: Math.round(totalElapsed / 1000),
          result: result
        });
      }

      return result;

    } catch (error) {
      // Step 9: Handle any unhandled exceptions
      const totalElapsed = Date.now() - startTime;
      console.error(`Unhandled error in process_financial_file after ${totalElapsed}ms: ${error}`);
      console.error(error);
      if (progressCallback) {
        progressCallback('error', { status: `Critical error: ${error.message}`, progress: 0 });
      }
      return { success: false, message: error.message, imported: 0, errors: 1 };
    }
  }

  // Exact implementation of Flask's handle_duplicates_background function
  handleDuplicatesBackground(duplicates, cashFlowId, uploadFolder) {
    if (!duplicates || duplicates.length === 0) {
      return null;
    }

    try {
      // Format duplicates for storage
      const formattedDuplicates = duplicates.map(dup => {
        // Format existing transaction data
        const existingData = {
          id: dup.existing.id,
          business_name: dup.existing.business_name || 'Unknown',
          payment_date: this.workingExcelService.ensureDateFormat(dup.existing.payment_date) || '',
          amount: dup.existing.amount || 0,
          category_name: dup.existing.category_name || '',
          notes: dup.existing.notes || ''
        };

        // Format new transaction data
        const newData = {
          id: dup.new.id || `new_${uuidv4()}`,
          business_name: dup.new.business_name || 'Unknown',
          payment_date: this.workingExcelService.ensureDateFormat(dup.new.payment_date) || '',
          amount: dup.new.amount || 0,
          category_name: dup.new.category_name || '',
          notes: dup.new.notes || '',
          transaction_hash: dup.transaction_hash || '',
          cash_flow_id: dup.new.cash_flow_id || cashFlowId
        };

        return {
          existing: existingData,
          new: newData,
          transaction_hash: dup.transaction_hash || ''
        };
      });

      // Generate a unique ID for this duplicate set
      const tempId = uuidv4();

      // Create temp directory if it doesn't exist
      if (!fs.existsSync(uploadFolder)) {
        fs.mkdirSync(uploadFolder, { recursive: true });
      }

      // Save to temp file
      const tempFilePath = path.join(uploadFolder, `temp_duplicates_${tempId}.json`);
      const duplicatesData = {
        duplicates: formattedDuplicates,
        cash_flow_id: cashFlowId,
        created_at: new Date().toISOString()
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(duplicatesData, null, 2), 'utf8');

      return tempId;
    } catch (error) {
      console.error('Error handling duplicates:', error);
      return null;
    }
  }

  // Exact implementation of Flask's handle_currency_mismatches function
  handleCurrencyMismatches(transactions, userId, cashFlowId, uploadFolder) {
    if (!transactions || transactions.length === 0) {
      return null;
    }

    try {
      // Sort transactions by currency
      const currencies = {};
      transactions.forEach(tx => {
        const currency = tx.currency || 'ILS';
        if (!currencies[currency]) {
          currencies[currency] = {
            transactions: [],
            count: 0,
            primary: currency === 'ILS' // Set ILS as primary by default
          };
        }

        currencies[currency].transactions.push(tx);
        currencies[currency].count += 1;
      });

      // Generate temp ID and create file path
      const tempId = uuidv4();
      if (!fs.existsSync(uploadFolder)) {
        fs.mkdirSync(uploadFolder, { recursive: true });
      }

      const tempFilePath = path.join(uploadFolder, `currency_groups_${tempId}.json`);

      // Determine file source and other metadata from the first transaction
      const sampleTx = transactions[0] || {};
      const fileSource = sampleTx.file_source || 'unknown';
      const paymentMethod = sampleTx.payment_method || '';
      const paymentIdentifier = sampleTx.payment_identifier || '';

      // Write group data to file
      const currencyGroupsData = {
        currencies: currencies,
        user_id: userId,
        cash_flow_id: cashFlowId,
        file_source: fileSource,
        payment_method: paymentMethod,
        payment_identifier: paymentIdentifier,
        original_file: 'currency_detection'
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(currencyGroupsData, null, 2), 'utf8');

      return tempId;

    } catch (error) {
      console.error('Error handling currency groups:', error);
      return null;
    }
  }
}

module.exports = FinancialFileService;