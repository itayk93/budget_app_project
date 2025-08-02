const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const SupabaseService = require('../services/supabaseService');
const { supabase } = require('../config/supabase');
const ExcelService = require('../services/excelService');
const ComprehensiveExcelService = require('../services/comprehensiveExcelService');
const WorkingExcelService = require('../services/workingExcelService');
const blinkProcessor = require('../services/blinkProcessor');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

// File filter to only allow specific file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv'
  ];
  
  const allowedExtensions = ['.xls', '.xlsx', '.csv'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel (.xls, .xlsx) and CSV files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// ===== UPLOAD ENDPOINTS =====

// Store for multi-step upload sessions
const uploadSessions = new Map();

// Persist sessions to survive server restarts
const SESSIONS_FILE = path.join(__dirname, '../temp/upload_sessions.json');

// Load existing sessions on startup
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const sessions = JSON.parse(data);
      for (const [id, session] of Object.entries(sessions)) {
        uploadSessions.set(id, session);
      }
      console.log(`Loaded ${uploadSessions.size} upload sessions from persistent storage`);
    }
  } catch (error) {
    console.warn('Failed to load upload sessions:', error);
  }
}

// Save sessions to file
function saveSessions() {
  try {
    const sessionsObj = {};
    for (const [id, session] of uploadSessions.entries()) {
      sessionsObj[id] = session;
    }
    
    // Ensure temp directory exists
    const tempDir = path.dirname(SESSIONS_FILE);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsObj, null, 2));
  } catch (error) {
    console.warn('Failed to save upload sessions:', error);
  }
}

// Load sessions on startup
loadSessions();

// Resume any stuck processing sessions
async function resumeStuckSessions() {
  const now = new Date();
  for (const [uploadId, session] of uploadSessions.entries()) {
    const sessionAge = now - new Date(session.createdAt);
    
    // If session is stuck in processing stage for more than 5 minutes, and not already being processed
    if (session.status === 'checking_duplicates' && 
        sessionAge > 5 * 60 * 1000 && 
        !session.isProcessing) {
      console.log(`🔄 Resuming stuck session: ${uploadId}`);
      
      // Mark as being processed to prevent double processing
      session.isProcessing = true;
      session.status = 'processing';
      session.percentage = 0;
      session.message = 'מתחיל מחדש...';
      
      // Restart processing
      processUploadAsync(uploadId).catch(error => {
        console.error('Error resuming session:', error);
        session.status = 'error';
        session.error = error.message;
        session.isProcessing = false;
        saveSessions();
      });
    }
  }
}

// Run resume check after loading sessions
setTimeout(resumeStuckSessions, 5000);

// Clean up old sessions periodically (every 30 minutes)
setInterval(() => {
  const now = new Date();
  for (const [uploadId, session] of uploadSessions.entries()) {
    const sessionAge = now - new Date(session.createdAt);
    // Remove sessions older than 2 hours
    if (sessionAge > 2 * 60 * 60 * 1000) {
      console.log(`Cleaning up old upload session: ${uploadId}`);
      
      // Clean up file if it still exists
      if (session.filePath && fs.existsSync(session.filePath)) {
        try {
          fs.unlinkSync(session.filePath);
        } catch (error) {
          console.warn('Failed to cleanup file during session cleanup:', error);
        }
      }
      
      uploadSessions.delete(uploadId);
    }
  }
  // Save after cleanup
  if (uploadSessions.size > 0) {
    saveSessions();
  }
}, 30 * 60 * 1000); // Run every 30 minutes

// Multi-step upload: Step 1 - Initiate upload and process file
router.post('/initiate', authenticateToken, upload.single('file'), async (req, res) => {
  const requestId = logger.setRequestContext(req);
  logger.info('UPLOAD', 'Upload initiate endpoint hit', { requestId });
  
  try {
    if (!req.file) {
      logger.error('UPLOAD', 'No file uploaded', { requestId });
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { cash_flow_id, force_import, file_source, payment_method, payment_identifier, date_filter_enabled, start_date, end_date } = req.body;
    const userId = req.user.id;

    // Generate upload session ID early
    const uploadId = Date.now() + '-' + Math.round(Math.random() * 1E9);

    logger.uploadStart(uploadId, req.file.originalname, req.file.size, userId);
    
    logger.info('UPLOAD', 'Upload session initiated', {
      uploadId,
      requestId,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      userId: userId,
      cashFlowId: cash_flow_id,
      fileSource: file_source,
      paymentMethod: payment_method,
      paymentIdentifier: payment_identifier
    });

    // Validate cash flow ID
    if (!cash_flow_id) {
      return res.status(400).json({ error: 'Cash flow ID is required' });
    }

    // Verify cash flow belongs to user
    const cashFlow = await SupabaseService.getCashFlow(cash_flow_id);
    if (!cashFlow || cashFlow.user_id !== userId) {
      return res.status(404).json({ error: 'Cash flow not found' });
    }
    
    // Store session data
    uploadSessions.set(uploadId, {
      userId,
      cashFlowId: cash_flow_id,
      filePath: req.file.path,
      filename: req.file.originalname,
      forceImport: force_import === 'true' || force_import === true,
      fileSource: file_source || 'other',
      paymentMethod: payment_method || null,
      paymentIdentifier: payment_identifier || null,
      dateFilterEnabled: date_filter_enabled === 'true' || date_filter_enabled === true,
      startDate: start_date || null,
      endDate: end_date || null,
      status: 'processing',
      isProcessing: false, // Initialize as not processing
      createdAt: new Date()
    });
    
    // Persist session to survive server restarts
    saveSessions();

    // Start async processing
    processUploadAsync(uploadId).catch(error => {
      console.error('Async processing error:', error);
      const session = uploadSessions.get(uploadId);
      if (session) {
        session.status = 'error';
        session.error = error.message;
        saveSessions();
      }
    });

    res.json({
      uploadId,
      message: 'Upload initiated successfully'
    });

  } catch (error) {
    console.error('Upload initiation error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup file after error:', cleanupError.message);
      }
    }

    res.status(500).json({
      error: 'Upload initiation failed',
      details: error.message
    });
  }
});

// Multi-step upload: Step 2 - Get progress via JSON API
router.get('/progress/:uploadId', authenticateToken, (req, res) => {
  const { uploadId } = req.params;
  const session = uploadSessions.get(uploadId);

  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Upload session not found' });
  }

  // Return current session status as JSON
  const response = {
    stage: session.status || 'processing',
    percentage: session.percentage || 0,
    message: session.message || 'מעבד...',
    details: session.details || null
  };

  // Add result or error if completed
  if (session.status === 'completed' || session.status === 'needs_currency_selection' || session.status === 'needs_duplicates_review') {
    response.result = session.result;
  } else if (session.status === 'error') {
    response.error = session.error;
  }

  res.json(response);
});

// Multi-step upload: Get duplicates data for review
router.get('/duplicates/:tempId', authenticateToken, (req, res) => {
  try {
    const { tempId } = req.params;
    const duplicatesSession = currencyGroupsSessions.get(tempId);

    if (!duplicatesSession || duplicatesSession.userId !== req.user.id) {
      return res.status(404).json({ error: 'Duplicates session not found' });
    }

    if (duplicatesSession.type !== 'duplicates_review') {
      return res.status(400).json({ error: 'Invalid session type' });
    }

    res.json({
      duplicates: duplicatesSession.duplicates,
      totalDuplicates: duplicatesSession.duplicates.length,
      originalDetails: duplicatesSession.originalDetails
    });

  } catch (error) {
    console.error('Get duplicates error:', error);
    res.status(500).json({
      error: 'Failed to get duplicates data',
      details: error.message
    });
  }
});

// Multi-step upload: Handle duplicates resolution
router.post('/handle-duplicates', authenticateToken, async (req, res) => {
  try {
    const { tempId, resolutions, cashFlowId } = req.body;
    console.log('[handle-duplicates] Received request with tempId:', tempId, 'and cashFlowId:', cashFlowId);
    console.log('[handle-duplicates] Resolutions:', JSON.stringify(resolutions, null, 2));

    const duplicatesSession = currencyGroupsSessions.get(tempId);

    if (!duplicatesSession || duplicatesSession.userId !== req.user.id) {
      return res.status(404).json({ error: 'Duplicates session not found' });
    }

    if (duplicatesSession.type !== 'duplicates_review') {
      return res.status(400).json({ error: 'Invalid session type' });
    }

    // Debug: Let's see the structure of duplicatesSession
    if (process.env.DEBUG === 'true') {
        console.log('🔍 [DEBUG] duplicatesSession structure:');
        console.log('  - type:', duplicatesSession.type);
        console.log('  - duplicates length:', duplicatesSession.duplicates ? duplicatesSession.duplicates.length : 'null');
        console.log('  - transactions length:', duplicatesSession.transactions ? duplicatesSession.transactions.length : 'null');
        
        if (duplicatesSession.duplicates && duplicatesSession.duplicates.length > 0) {
          console.log('🔍 [DEBUG] First duplicate entry:');
          console.log(JSON.stringify(duplicatesSession.duplicates[0], null, 2));
        }
    }

    // Apply resolutions to transactions
    const allTransactions = duplicatesSession.transactions || [];
    let transactionsToImport = [];
    const duplicateResolutions = resolutions || {};
    let duplicatesSkipped = 0;

    if (process.env.DEBUG === 'true') {
        console.log('🔍 [RESOLUTION DEBUG] All available resolution keys:', Object.keys(duplicateResolutions));
    }
    
    // Create a mapping from NEW transaction ID to transaction hash
    const newIdToHashMap = {};
    
    // Check if we have duplicates data to create the mapping
    if (duplicatesSession.duplicates && Array.isArray(duplicatesSession.duplicates)) {
      duplicatesSession.duplicates.forEach((duplicate, index) => {
        if (process.env.DEBUG === 'true') {
            console.log(`🔍 [DEBUG] Duplicate ${index}:`, {
              existing_id: duplicate.existing?.id,
              existing_hash: duplicate.existing?.transaction_hash,
              new_id: duplicate.new?.id,
              new_hash: duplicate.new?.transaction_hash || duplicate.transaction_hash,
              is_batch_duplicate: duplicate.is_batch_duplicate
            });
        }
        
        const newId = duplicate.new?.id;
        const newTransactionHash = duplicate.new?.transaction_hash || duplicate.transaction_hash;
        
        if (newId && newTransactionHash) {
          newIdToHashMap[newId] = {
            hash: newTransactionHash,
            existingId: duplicate.existing?.id
          };
          if (process.env.DEBUG === 'true') {
              console.log(`🔗 [MAPPING] Mapped new ID ${newId} to hash ${newTransactionHash} (existing: ${duplicate.existing?.id})`);
          }
        }
      });
    }
    
    if (process.env.DEBUG === 'true') {
        console.log('🔍 [DEBUG] Final mapping:', newIdToHashMap);
    }
    
    for (const tx of allTransactions) {
      if (process.env.DEBUG === 'true') {
          console.log(`🔍 [RESOLUTION DEBUG] Processing transaction with hash: ${tx.transaction_hash}, business_name: ${tx.business_name}`);
      }
      
      // Look for resolution using the mapping we created
      let resolution = null;
      let existingTxId = null;
      
      // Check if we can find this transaction's hash in our mapping
      for (const [newId, mappingInfo] of Object.entries(newIdToHashMap)) {
        if (mappingInfo.hash === tx.transaction_hash && duplicateResolutions[newId]) {
          resolution = duplicateResolutions[newId];
          existingTxId = mappingInfo.existingId;
          console.log(`🔗 [FOUND MAPPING] Transaction ${tx.business_name} mapped from new ID ${newId} to resolution ${resolution} (existing: ${existingTxId})`);
          break;
        }
      }
      
      // Fallback: check direct hash lookup
      if (!resolution) {
        resolution = duplicateResolutions[tx.transaction_hash];
      }
      
      if (process.env.DEBUG === 'true') {
          console.log(`🔍 [RESOLUTION DEBUG] Resolution for ${tx.business_name}: ${resolution}`);
      }
      
      if (resolution === 'skip' || resolution === 'keep_existing') {
        duplicatesSkipped++;
        continue;
      }
      
      if (resolution === 'import_new' || resolution === 'import') {
        // Flag the transaction to be force-imported.
        tx.forceImport = true;
        if (process.env.DEBUG === 'true') {
            console.log(`✅ [RESOLUTION DEBUG] Set forceImport=true for ${tx.business_name}`);
        }
        
        // Add note about the duplicate
        if (existingTxId) {
          const originalNote = tx.notes ? `${tx.notes}\n` : '';
          tx.notes = `${originalNote}כפילות של עסקה ${existingTxId}`;
          if (process.env.DEBUG === 'true') {
              console.log(`📝 [DUPLICATE NOTE] Added note for ${tx.business_name}: ${tx.notes}`);
          }
        }
      }
      
      // Add all transactions (we'll let the import logic handle them)
      transactionsToImport.push(tx);
    }

    console.log(`📋 Processing ${transactionsToImport.length} transactions after duplicate resolution`);
    
    // Log forceImport flags before mapping
    transactionsToImport.forEach(tx => {
      if (process.env.DEBUG === 'true') {
          console.log(`🔍 [BEFORE MAPPING] Transaction ${tx.business_name}: forceImport=${tx.forceImport}`);
      }
    });

    // Ensure all transactions have user_id and cash_flow_id
    transactionsToImport = transactionsToImport.map(transaction => ({
      ...transaction,
      user_id: duplicatesSession.userId,
      cash_flow_id: cashFlowId || transaction.cash_flow_id,
      forceImport: transaction.forceImport // Preserve the forceImport flag
    }));

    // Log forceImport flags after mapping
    transactionsToImport.forEach(tx => {
      if (process.env.DEBUG === 'true') {
          console.log(`🔍 [AFTER MAPPING] Transaction ${tx.business_name}: forceImport=${tx.forceImport}`);
      }
    });

    // Import the final transactions using the forceImport flag on each transaction
    const ExcelService = require('../services/excelService');
    const importResult = await ExcelService.importTransactions(transactionsToImport, false);

    // Clean up session
    currencyGroupsSessions.delete(tempId);

    res.json({
      success: true,
      message: 'Duplicates handled successfully',
      stats: {
        totalOriginal: (duplicatesSession.transactions || []).length,
        totalAfterResolution: transactionsToImport.length,
        imported: importResult.success || 0,
        duplicatesSkipped: duplicatesSkipped,
        errors: importResult.errors || 0
      },
      importResult: importResult
    });

  } catch (error) {
    console.error('Handle duplicates error:', error);
    res.status(500).json({
      error: 'Failed to handle duplicates',
      details: error.message
    });
  }
});

// Multi-step upload: Step 3 - Check duplicates for selected currency
router.post('/check-duplicates', authenticateToken, async (req, res) => {
  try {
    const { uploadId, selectedCurrency, cashFlowId } = req.body;
    const session = uploadSessions.get(uploadId);

    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Get processed data for selected currency
    const processedData = session.processedData;
    if (!processedData || !processedData.currencyGroups[selectedCurrency]) {
      return res.status(400).json({ error: 'Invalid currency selection' });
    }

    const transactions = processedData.currencyGroups[selectedCurrency].transactions;

    // Check for duplicates
    const duplicates = await ExcelService.checkDuplicates(transactions, req.user.id, cashFlowId);

    res.json({
      duplicates: duplicates || {}
    });

  } catch (error) {
    console.error('Duplicate check error:', error);
    res.status(500).json({
      error: 'Failed to check duplicates',
      details: error.message
    });
  }
});

// Multi-step upload: Step 4 - Finalize import
router.post('/finalize', authenticateToken, async (req, res) => {
  try {
    const { uploadId, selectedCurrency, duplicateResolutions, cashFlowId, transactions: reviewedTransactions, deletedIndices, fileSource } = req.body;
    const session = uploadSessions.get(uploadId);

    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Prevent double finalization
    if (session.status === 'finalized') {
      console.log(`⏭️ Session ${uploadId} is already finalized, skipping`);
      return res.status(400).json({ error: 'Upload already finalized' });
    }

    // Prevent finalization while still processing
    if (session.isProcessing || session.status === 'processing') {
      console.log(`⏳ Session ${uploadId} is still processing, please wait`);
      return res.status(400).json({ error: 'Upload still processing, please wait' });
    }

    // Prevent double finalization
    if (session.isFinalizingImport) {
      console.log(`⏭️ Session ${uploadId} is already being finalized, skipping`);
      return res.status(400).json({ error: 'Upload already being finalized' });
    }

    // Mark as being finalized
    session.isFinalizingImport = true;

    // Get processed data
    const processedData = session.processedData;
    let transactions;

    // Check if we have reviewed transactions from the modal
    if (reviewedTransactions && Array.isArray(reviewedTransactions)) {
      console.log('🔄 Using reviewed transactions from modal:', reviewedTransactions.length);
      transactions = reviewedTransactions;
    } else if (selectedCurrency && processedData.currencyGroups) {
      transactions = processedData.currencyGroups[selectedCurrency].transactions;
    } else {
      transactions = processedData.transactions;
    }

    // Apply duplicate resolutions (only if not from modal)
    let finalTransactions = transactions;
    if (duplicateResolutions && !reviewedTransactions) {
      finalTransactions = ExcelService.applyDuplicateResolutions(transactions, duplicateResolutions);
    }

    // Ensure all transactions have user_id and cash_flow_id
    finalTransactions = finalTransactions.map(transaction => ({
      ...transaction,
      user_id: session.userId,
      cash_flow_id: session.cashFlowId
    }));

    console.log('🔧 Final transactions before import:', {
      count: finalTransactions.length,
      sample_user_id: finalTransactions[0]?.user_id,
      sample_cash_flow_id: finalTransactions[0]?.cash_flow_id,
      sample_business_name: finalTransactions[0]?.business_name
    });

    // Import transactions
    const importResult = await ExcelService.importTransactions(
      finalTransactions, 
      session.forceImport
    );

    // Clean up file
    try {
      if (fs.existsSync(session.filePath)) {
        fs.unlinkSync(session.filePath);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file:', cleanupError.message);
    }

    // Mark session as completed but don't delete it immediately
    // It will be cleaned up by the periodic cleanup process
    session.status = 'finalized';
    session.isFinalizingImport = false; // Mark finalization as complete
    session.completedAt = new Date();

    res.json({
      success: true,
      message: 'Import completed successfully',
      fileFormat: processedData.fileFormat,
      stats: {
        totalRows: processedData.totalRows,
        processedTransactions: transactions.length,
        imported: importResult.success,
        duplicates: importResult.duplicates,
        errors: importResult.errors
      }
    });

  } catch (error) {
    console.error('Finalize import error:', error);
    
    // Mark finalization as complete even on error
    if (session) {
      session.isFinalizingImport = false;
    }
    
    res.status(500).json({
      error: 'Failed to finalize import',
      details: error.message
    });
  }
});

// Async processing function
async function processUploadAsync(uploadId) {
  const session = uploadSessions.get(uploadId);
  if (!session) {
    logger.error('UPLOAD', 'Upload session not found for async processing', { uploadId });
    return;
  }

  // Prevent double processing
  if (session.isProcessing) {
    logger.warn('UPLOAD', 'Session already being processed, skipping', { uploadId });
    return;
  }

  // Mark as being processed
  session.isProcessing = true;
  logger.uploadProgress(uploadId, 'processing_start', 0, {
    filename: session.filename,
    fileSource: session.fileSource
  });

  try {
    // Create progress callback to update session
    const progressCallback = (stage, data) => {
      session.status = stage;
      session.percentage = data.progress || 0;
      session.message = data.status || 'מעבד...';
      session.details = data.details || null;
      saveSessions(); // Persist progress updates
    };

    let result;
    
    // Check if this is a Blink file and use appropriate processor
    if (session.fileSource === 'blink') {
      logger.uploadProgress(uploadId, 'file_processing', 10, {
        service: 'BlinkProcessor',
        fileSource: session.fileSource,
        forceImport: session.forceImport
      });

      // Process Blink file using specialized processor
      result = await blinkProcessor.processBlinkFile(
        session.filePath,
        session.userId,
        session.cashFlowId,
        progressCallback,
        uploadId,
        {
          dateFilterEnabled: session.dateFilterEnabled,
          startDate: session.startDate,
          endDate: session.endDate
        }
      );
    } else {
      // Initialize working Excel service for non-Blink files
      const excelService = new WorkingExcelService();

      logger.uploadProgress(uploadId, 'file_processing', 10, {
        service: 'WorkingExcelService',
        fileSource: session.fileSource,
        forceImport: session.forceImport
      });

      // Process the file with working service
      result = await excelService.processFinancialFileMultiStep(
        session.filePath,
        session.userId,
        session.cashFlowId,
        session.fileSource || 'other',
        session.paymentMethod || null,
        session.paymentIdentifier || null,
        progressCallback,
        session.forceImport,
        uploadId, // Pass uploadId for logging
        {
          dateFilterEnabled: session.dateFilterEnabled,
          startDate: session.startDate,
          endDate: session.endDate
        }
      );
    }

    if (!result.success) {
      logger.uploadError(uploadId, 'file_processing', new Error(result.error || result.message), {
        result
      });
      throw new Error(result.error || result.message);
    }

    // Store processed data
    session.processedData = result;
    session.percentage = 100;
    session.status = 'completed';
    session.isProcessing = false; // Mark processing as complete
    saveSessions();

    logger.uploadProgress(uploadId, 'processing_complete', 100, {
      totalRows: result.totalRows,
      processedTransactions: result.processedTransactions,
      hasDuplicates: result.has_duplicates,
      multipleCurrencies: result.multiple_currencies
    });
    
    // Handle different result types
    let currency_groups_temp_id = null;
    let duplicates_temp_id = null;
    
    // Debug logging for result analysis
    console.log('🔍 Processing result analysis:', {
      has_duplicates: result.has_duplicates,
      duplicates_count: result.duplicates?.length || 0,
      multiple_currencies: result.multiple_currencies,
      currency_groups_keys: Object.keys(result.currencyGroups || {}),
      total_rows: result.totalRows,
      processed_transactions: result.processedTransactions
    });
    
    // Check for multiple currencies
    if (result.multiple_currencies && result.currencyGroups && Object.keys(result.currencyGroups).length > 1) {
      console.log('🔄 Multiple currencies found, creating currency groups session');
      currency_groups_temp_id = Date.now() + '-' + Math.round(Math.random() * 1E9);
      
      currencyGroupsSessions.set(currency_groups_temp_id, {
        userId: session.userId,
        currencyGroups: result.currencyGroups,
        originalDetails: {
          original_file: result.fileName || 'uploaded_file',
          total_transactions: result.totalRows
        },
        type: 'currency_groups',
        createdAt: new Date()
      });
      
      session.status = 'needs_currency_selection';
      session.isProcessing = false; // Mark processing as complete
      saveSessions();
    }
    // Check for duplicates - fix the condition to check actual duplicate count
    else if ((result.has_duplicates && result.duplicates && result.duplicates.length > 0) || 
             (result.duplicates && result.duplicates.length > 0)) {
      console.log(`⚠️ Duplicates found: ${result.duplicates.length}, using temp_id: ${result.temp_duplicates_id}`);
      duplicates_temp_id = result.temp_duplicates_id;
      
      // Store duplicates session for review
      currencyGroupsSessions.set(duplicates_temp_id, {
        userId: session.userId,
        duplicates: result.duplicates,
        transactions: result.duplicates_data?.transactions || result.transactions,
        currencyGroups: result.currencyGroups || { 'ILS': { transactions: result.transactions } },
        originalDetails: {
          original_file: result.file_name || result.fileName || 'uploaded_file',
          total_transactions: result.totalRows || result.processedTransactions
        },
        type: 'duplicates_review',
        createdAt: new Date()
      });
      
      session.status = 'needs_duplicates_review';
      session.isProcessing = false; // Mark processing as complete
      saveSessions();
    }
    else {
      // No special handling needed
      console.log('✅ No duplicates or multiple currencies found - processing completed');
      session.status = 'completed';
      session.isProcessing = false; // Mark processing as complete
      saveSessions();
    }
    
    session.result = {
      currencyGroups: result.currencyGroups,
      duplicates: result.duplicates || [],
      fileFormat: result.fileFormat || result.detectedFormat,
      totalRows: result.totalRows,
      processedTransactions: result.processedTransactions,
      currency_groups_temp_id: currency_groups_temp_id,
      duplicates_temp_id: duplicates_temp_id,
      temp_duplicates_id: result.temp_duplicates_id || duplicates_temp_id,
      multiple_currencies: currency_groups_temp_id !== null,
      has_duplicates: result.has_duplicates || false,
      imported: result.imported || 0,
      errors: result.errors || 0,
      file_name: result.file_name,
      file_source: result.file_source,
      processing_time: result.processing_time
    };

  } catch (error) {
    logger.uploadError(uploadId, 'processing_error', error, {
      sessionData: {
        filename: session?.filename,
        fileSource: session?.fileSource,
        userId: session?.userId
      }
    });
    
    session.status = 'error';
    session.error = error.message;
    session.isProcessing = false; // Mark processing as complete even on error
    saveSessions();
  }
}

// Process Blink Excel file specifically for stock transactions
router.post('/blink-stocks', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { cash_flow_id, force_import } = req.body;
    const userId = req.user.id;

    console.log('📁 Blink stock file uploaded:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      userId: userId,
      cashFlowId: cash_flow_id
    });

    // Validate cash flow ID
    if (!cash_flow_id) {
      return res.status(400).json({ error: 'Cash flow ID is required' });
    }

    // Verify cash flow belongs to user
    const cashFlow = await SupabaseService.getCashFlow(cash_flow_id);
    if (!cashFlow || cashFlow.user_id !== userId) {
      return res.status(404).json({ error: 'Cash flow not found' });
    }

    // Process Blink file and save to database
    const result = await blinkProcessor.processAndSaveBlinkFile(
      req.file.path,
      userId,
      cash_flow_id,
      force_import !== 'true' && force_import !== true // Check duplicates unless force import
    );

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file:', cleanupError.message);
    }

    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to process Blink file',
        details: result.error
      });
    }

    res.json({
      success: true,
      message: result.message,
      stats: {
        fileProcessed: result.file_processed,
        transactionsProcessed: result.transactions_processed,
        transactionsSaved: result.transactions_saved,
        duplicatesFound: result.duplicates_found,
        errors: result.errors?.length || 0
      },
      currencyGroups: result.currency_groups,
      errors: result.errors
    });

  } catch (error) {
    console.error('Blink upload error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup file after error:', cleanupError.message);
      }
    }

    res.status(500).json({
      error: 'Blink file upload failed',
      details: error.message
    });
  }
});

// Legacy single-step upload and process Excel/CSV file
router.post('/transactions', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { cash_flow_id, force_import } = req.body;
    const userId = req.user.id;

    console.log('📁 File uploaded:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      userId: userId,
      cashFlowId: cash_flow_id
    });

    // Validate cash flow ID
    if (!cash_flow_id) {
      return res.status(400).json({ error: 'Cash flow ID is required' });
    }

    // Verify cash flow belongs to user
    const cashFlow = await SupabaseService.getCashFlow(cash_flow_id);
    if (!cashFlow || cashFlow.user_id !== userId) {
      return res.status(404).json({ error: 'Cash flow not found' });
    }

    // Detect if this is an Isracard file and use appropriate service
    let result;
    try {
      // First check if it's an Isracard file by checking the filename or doing a quick read
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      let isIsracardFile = false;
      
      // Quick check for Isracard indicators in filename or file content
      if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        try {
          const XLSX = require('xlsx');
          const workbook = XLSX.readFile(req.file.path);
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const firstRowData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 });
          
          // Check first few rows for Isracard indicators
          const firstRows = firstRowData.slice(0, 5).flat().join(' ').toLowerCase();
          isIsracardFile = firstRows.includes('גולד') || 
                          firstRows.includes('מסטרקארד') || 
                          firstRows.includes('תאריך רכישה') ||
                          firstRows.includes('ישראכרט');
        } catch (e) {
          // If detection fails, fall back to regular service
          console.warn('Failed to detect Isracard file, using regular service');
        }
      }
      
      if (isIsracardFile) {
        console.log('🏦 Detected Isracard file, using WorkingExcelService');
        // Use WorkingExcelService for Isracard files
        result = await WorkingExcelService.processFinancialFileMultiStep(
          req.file.path,
          userId,
          cash_flow_id,
          'isracard', // fileSource
          null, // paymentMethod
          null, // paymentIdentifier
          null, // progressCallback
          force_import === 'true' || force_import === true // forceImport
        );
      } else {
        console.log('📊 Using regular ExcelService');
        // Use regular ExcelService for other files
        result = await ExcelService.processExcelFile(
          req.file.path,
          userId,
          cash_flow_id,
          {
            forceImport: force_import === 'true' || force_import === true
          }
        );
      }
    } catch (serviceError) {
      console.error('Service processing error:', serviceError);
      throw serviceError;
    }

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file:', cleanupError.message);
    }

    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to process file',
        details: result.error
      });
    }

    res.json({
      message: 'File processed successfully',
      fileFormat: result.fileFormat,
      stats: {
        totalRows: result.totalRows,
        processedTransactions: result.processedTransactions,
        imported: result.importResults.success,
        duplicates: result.importResults.duplicates,
        errors: result.importResults.errors
      },
      details: result.importResults.details
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup file after error:', cleanupError.message);
      }
    }

    res.status(500).json({
      error: 'File upload failed',
      details: error.message
    });
  }
});

// Get supported file formats
router.get('/formats', authenticateToken, (req, res) => {
  res.json({
    supported_formats: [
      {
        name: 'Isracard',
        description: 'Israeli credit card statements',
        file_types: ['xlsx', 'xls', 'csv'],
        required_columns: ['תיאור עסקה', 'תאריך עסקה', 'סכום']
      },
      {
        name: 'Bank Leumi',
        description: 'Bank Leumi account statements',
        file_types: ['xlsx', 'xls', 'csv'],
        required_columns: ['תאריך', 'תיאור', 'זכות/חובה']
      },
      {
        name: 'Bank Hapoalim',
        description: 'Bank Hapoalim account statements', 
        file_types: ['xlsx', 'xls', 'csv'],
        required_columns: ['תאריך ביצוע', 'פירוט נוסף', 'סכום']
      },
      {
        name: 'BudgetLens Export',
        description: 'BudgetLens exported data',
        file_types: ['xlsx', 'csv'],
        required_columns: ['business_name', 'payment_date', 'amount']
      },
      {
        name: 'Generic',
        description: 'Generic spreadsheet format',
        file_types: ['xlsx', 'xls', 'csv'],
        required_columns: ['description/business', 'date', 'amount']
      }
    ]
  });
});

// ===== CURRENCY GROUPS ROUTES =====

// Store for currency groups temporary data
const currencyGroupsSessions = new Map();

// Get currency groups data for review
router.get('/review_currency_groups/:temp_id', authenticateToken, async (req, res) => {
  try {
    const { temp_id } = req.params;
    const userId = req.user.id;

    // Get session data
    const sessionData = currencyGroupsSessions.get(temp_id);
    if (!sessionData || sessionData.userId !== userId) {
      return res.status(404).json({ error: 'Currency groups session not found' });
    }

    // Get user's cash flows for the selection
    const { cashFlows } = await SupabaseService.getCashFlows(userId);

    res.json({
      success: true,
      temp_id,
      currency_data: sessionData.currencyGroups,
      user_cash_flows: cashFlows,
      original_details: sessionData.originalDetails || {}
    });

  } catch (error) {
    console.error('Currency groups review error:', error);
    res.status(500).json({
      error: 'Failed to get currency groups data',
      details: error.message
    });
  }
});

// Handle currency groups decisions
router.post('/handle_currency_groups', authenticateToken, async (req, res) => {
  try {
    const { temp_id, decisions } = req.body;
    const userId = req.user.id;

    if (!temp_id || !decisions) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    // Get session data
    const sessionData = currencyGroupsSessions.get(temp_id);
    if (!sessionData || sessionData.userId !== userId) {
      return res.status(404).json({ 
        success: false, 
        message: 'Currency groups session not found' 
      });
    }

    // Process each currency decision
    let importedCount = 0;
    let skippedCount = 0;
    let duplicates = [];
    
    for (const [currency, decision] of Object.entries(decisions)) {
      if (decision.action === 'skip') {
        const currencyTransactions = sessionData.currencyGroups[currency]?.transactions || [];
        skippedCount += currencyTransactions.length;
        continue;
      }

      if (decision.action === 'import' && decision.cash_flow_id) {
        const currencyTransactions = sessionData.currencyGroups[currency]?.transactions || [];
        
        // Add cash_flow_id to each transaction
        const updatedTransactions = currencyTransactions.map(transaction => ({
          ...transaction,
          cash_flow_id: decision.cash_flow_id,
          user_id: userId
        }));

        // Check for duplicates first
        const duplicateCheck = await ExcelService.checkDuplicates(
          updatedTransactions, 
          userId, 
          decision.cash_flow_id
        );

        if (duplicateCheck && Object.keys(duplicateCheck).length > 0) {
          // Convert duplicates format and add to global duplicates array
          for (const [originalId, duplicateTransactions] of Object.entries(duplicateCheck)) {
            duplicates.push(...duplicateTransactions.map(dup => ({
              existing: { id: originalId },
              new: dup,
              transaction_hash: dup.transaction_hash || ''
            })));
          }
        }

        // Import non-duplicate transactions
        try {
          const importResult = await ExcelService.importTransactions(
            updatedTransactions, 
            false // Don't force import to catch duplicates
          );
          importedCount += importResult.success || 0;
        } catch (importError) {
          console.error('Error importing transactions:', importError);
        }
      }
    }

    // Handle duplicates if found
    let temp_duplicates_id = null;
    if (duplicates.length > 0) {
      // Store duplicates in temporary session
      temp_duplicates_id = Date.now() + '-' + Math.round(Math.random() * 1E9);
      
      // Store duplicates data
      currencyGroupsSessions.set(temp_duplicates_id, {
        userId,
        duplicates,
        type: 'duplicates',
        createdAt: new Date()
      });
    }

    // Clean up currency groups session
    currencyGroupsSessions.delete(temp_id);

    const response = {
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      duplicates: duplicates.length,
      has_duplicates: duplicates.length > 0,
      message: `Processing completed. Imported: ${importedCount}, Skipped: ${skippedCount}, Duplicates: ${duplicates.length}`
    };

    if (temp_duplicates_id) {
      response.temp_duplicates_id = temp_duplicates_id;
      response.redirect_url = '/upload/review_duplicates';
    } else {
      response.redirect_url = '/transactions';
    }

    res.json(response);

  } catch (error) {
    console.error('Handle currency groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process currency groups',
      details: error.message
    });
  }
});

// Progress tracking for currency groups with SSE
router.get('/currency_groups_progress/:temp_id/stream', authenticateToken, (req, res) => {
  const { temp_id } = req.params;
  
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial message
  res.write('data: {"status": "Connected to progress stream", "progress": 0}\n\n');

  // Set up progress monitoring
  const progressInterval = setInterval(() => {
    const sessionData = currencyGroupsSessions.get(temp_id);
    if (sessionData && sessionData.progress) {
      res.write(`data: ${JSON.stringify(sessionData.progress)}\n\n`);
      
      // Stop if completed
      if (sessionData.progress.progress >= 100) {
        clearInterval(progressInterval);
        res.end();
      }
    } else {
      // Send keepalive
      res.write(': keepalive\n\n');
    }
  }, 1000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(progressInterval);
  });
});

// Get currency groups progress (JSON endpoint)
router.get('/currency_groups_progress/:temp_id', authenticateToken, (req, res) => {
  const { temp_id } = req.params;
  const sessionData = currencyGroupsSessions.get(temp_id);
  
  if (sessionData && sessionData.progress) {
    res.json(sessionData.progress);
  } else {
    res.json({
      status: 'Processing...',
      progress: 50,
      message: 'מעבד את הבקשה...'
    });
  }
});

// ===== DUPLICATES ROUTES =====

// Get duplicates data for review
router.get('/review_duplicates/:temp_id?', authenticateToken, async (req, res) => {
  try {
    const temp_id = req.params.temp_id;
    const userId = req.user.id;

    let duplicatesData;
    
    if (temp_id) {
      // Get from session using temp_id
      const sessionData = currencyGroupsSessions.get(temp_id);
      if (!sessionData || sessionData.userId !== userId) {
        return res.status(404).json({ error: 'Duplicates session not found' });
      }
      duplicatesData = sessionData.duplicates;
    } else {
      // Try to get from any recent session for this user
      for (const [sessionId, sessionData] of currencyGroupsSessions.entries()) {
        if (sessionData.userId === userId && sessionData.type === 'duplicates') {
          duplicatesData = sessionData.duplicates;
          break;
        }
      }
    }

    if (!duplicatesData || duplicatesData.length === 0) {
      return res.status(404).json({ 
        error: 'No duplicates found',
        message: 'לא נמצאו עסקאות כפולות לבדיקה'
      });
    }

    res.json({
      success: true,
      duplicates: duplicatesData,
      count: duplicatesData.length
    });

  } catch (error) {
    console.error('Duplicates review error:', error);
    res.status(500).json({
      error: 'Failed to get duplicates data',
      details: error.message
    });
  }
});

// Handle duplicates decisions
router.post('/handle_duplicates', authenticateToken, async (req, res) => {
  try {
    const { decisions } = req.body;
    const userId = req.user.id;

    if (!decisions || !Array.isArray(decisions)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid decisions format' 
      });
    }

    let importedCount = 0;
    let skippedCount = 0;

    // Process each decision
    for (const decision of decisions) {
      if (decision.import === true) {
        // Import this transaction
        try {
          const transaction = {
            ...decision,
            user_id: userId
          };
          
          const importResult = await ExcelService.importTransactions([transaction], true);
          if (importResult.success) {
            importedCount++;
          }
        } catch (importError) {
          console.error('Error importing duplicate transaction:', importError);
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    // Clean up duplicates sessions for this user
    for (const [sessionId, sessionData] of currencyGroupsSessions.entries()) {
      if (sessionData.userId === userId && sessionData.type === 'duplicates') {
        currencyGroupsSessions.delete(sessionId);
      }
    }

    res.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      message: `בוצע בהצלחה. יובאו: ${importedCount}, דולגו: ${skippedCount}`,
      redirect_url: '/transactions'
    });

  } catch (error) {
    console.error('Handle duplicates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process duplicates',
      details: error.message
    });
  }
});

// Check duplicate file status
router.post('/api/check_duplicate_file_status', authenticateToken, async (req, res) => {
  try {
    const { temp_id, check_type } = req.body;
    const userId = req.user.id;

    // Check if there are any duplicates sessions for this user
    let hasDuplicates = false;
    let tempDuplicatesId = null;

    if (temp_id) {
      const sessionData = currencyGroupsSessions.get(temp_id);
      if (sessionData && sessionData.userId === userId && sessionData.duplicates) {
        hasDuplicates = sessionData.duplicates.length > 0;
        tempDuplicatesId = temp_id;
      }
    } else {
      // Check any duplicates session for this user
      for (const [sessionId, sessionData] of currencyGroupsSessions.entries()) {
        if (sessionData.userId === userId && sessionData.type === 'duplicates') {
          hasDuplicates = sessionData.duplicates && sessionData.duplicates.length > 0;
          tempDuplicatesId = sessionId;
          break;
        }
      }
    }

    const response = {
      has_duplicates: hasDuplicates,
      temp_duplicates_id: tempDuplicatesId
    };

    if (hasDuplicates) {
      response.redirect_url = '/upload/review_duplicates';
    } else {
      response.redirect_url = '/transactions';
    }

    res.json(response);

  } catch (error) {
    console.error('Check duplicate file status error:', error);
    res.status(500).json({
      error: 'Failed to check duplicate status',
      details: error.message
    });
  }
});

// Export transactions to Excel
router.get('/export/transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      cash_flow_id, 
      year, 
      month, 
      flow_month, 
      category_id,
      format = 'xlsx'
    } = req.query;

    // Build filters
    const filters = {};
    if (cash_flow_id) filters.cash_flow_id = cash_flow_id;
    if (year && month) {
      filters.year = year;
      filters.month = month;
    } else if (flow_month) {
      filters.flow_month = flow_month;
    }
    if (category_id) filters.category_id = category_id;
    
    // Always export all transactions (no pagination)
    filters.show_all = true;

    // Get transactions
    const { transactions } = await SupabaseService.getTransactions(userId, filters);

    if (transactions.length === 0) {
      return res.status(404).json({ error: 'No transactions found to export' });
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `transactions-export-${timestamp}.${format}`;
    const filePath = path.join(__dirname, '../../uploads', filename);

    // Export to Excel
    const exportResult = await ExcelService.exportTransactionsToExcel(transactions, filePath);

    if (!exportResult.success) {
      return res.status(500).json({ 
        error: 'Export failed', 
        details: exportResult.error 
      });
    }

    // Send file for download
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
      }
      
      // Clean up file after download
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (cleanupError) {
          console.warn('Failed to cleanup export file:', cleanupError.message);
        }
      }, 5000); // 5 second delay to ensure download completes
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Export failed',
      details: error.message
    });
  }
});

// Upload transaction templates/examples
router.get('/templates/:bank', authenticateToken, (req, res) => {
  const { bank } = req.params;
  
  const templates = {
    isracard: {
      name: 'Isracard Template',
      description: 'Template for Isracard credit card statements',
      headers: ['תאריך עסקה', 'תאריך חיוב', 'תיאור עסקה', 'סכום', 'מטבע', 'אמצעי תשלום'],
      example_row: ['15/01/2024', '01/02/2024', 'קנייה באינטרנט', '-150.00', 'ILS', 'אשראי']
    },
    leumi: {
      name: 'Bank Leumi Template',
      description: 'Template for Bank Leumi account statements',
      headers: ['תאריך', 'תיאור', 'זכות', 'חובה', 'יתרה'],
      example_row: ['15/01/2024', 'העברה בנקאית', '1000.00', '', '5000.00']
    },
    hapoalim: {
      name: 'Bank Hapoalim Template', 
      description: 'Template for Bank Hapoalim account statements',
      headers: ['תאריך ביצוע', 'פירוט נוסף', 'סכום', 'זכות/חובה'],
      example_row: ['15/01/2024', 'משכורת', '8000.00', 'זכות']
    }
  };

  const template = templates[bank.toLowerCase()];
  
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json(template);
});

// Export all data for current cash flow
router.get('/export/cash-flow-data', authenticateToken, async (req, res) => {
  try {
    const { cash_flow_id } = req.query;
    const userId = req.user.id;

    console.log(`📊 Starting export for cash flow ${cash_flow_id} for user ${userId}`);

    if (!cash_flow_id) {
      console.error('❌ No cash_flow_id provided');
      return res.status(400).json({ error: 'cash_flow_id is required' });
    }

    console.log(`📊 Exporting all data for cash flow ${cash_flow_id} for user ${userId}`);

    // Get cash flow details
    console.log('🔍 Fetching cash flow details...');
    const { data: cashFlowData, error: cashFlowError } = await supabase
      .from('cash_flows')
      .select('*')
      .eq('id', cash_flow_id)
      .eq('user_id', userId)
      .single();

    console.log('🔍 Cash flow query result:', { cashFlowData, cashFlowError });

    if (cashFlowError || !cashFlowData) {
      console.error('❌ Cash flow not found:', cashFlowError);
      return res.status(404).json({ error: 'Cash flow not found' });
    }

    const cashFlow = cashFlowData;
    console.log(`✅ Found cash flow: ${cashFlow.name}`);

    // Get all transactions for this cash flow
    console.log('🔍 Fetching transactions...');
    
    // First get the count
    const { count: totalTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('cash_flow_id', cash_flow_id)
      .eq('user_id', userId);

    console.log(`🔍 Total transactions found: ${totalTransactions}`);

    // Fetch all transactions (Supabase has a 1000 limit by default, so we need to paginate)
    let allTransactions = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: pageTransactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('cash_flow_id', cash_flow_id)
        .eq('user_id', userId)
        .order('payment_date', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (transactionsError) {
        console.error('❌ Error fetching transactions page:', transactionsError);
        break;
      }

      if (pageTransactions && pageTransactions.length > 0) {
        allTransactions = allTransactions.concat(pageTransactions);
        console.log(`📊 Fetched page ${page + 1}: ${pageTransactions.length} transactions (total: ${allTransactions.length})`);
      }

      // Check if we have more pages
      hasMore = pageTransactions && pageTransactions.length === pageSize;
      page++;
    }

    const transactions = allTransactions;
    const transactionsError = null;

    console.log('🔍 Transactions query result:', { 
      transactionsCount: transactions?.length || 0, 
      transactionsError 
    });

    if (transactionsError) {
      console.error('❌ Error fetching transactions:', transactionsError);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }
    
    // Get all categories from transactions (like the dashboard does)
    console.log('🔍 Extracting categories from transactions...');
    const categoryNames = [...new Set((transactions || [])
      .map(t => t.category_name)
      .filter(name => name && name.trim() !== '')
    )].sort();
    
    const categories = categoryNames.map(name => ({ name }));
    
    console.log('🔍 Categories extracted from transactions:', { 
      categoriesCount: categories?.length || 0, 
      categoryNames: categoryNames.slice(0, 10) // Show first 10 for logging
    });
    
    // Get all budgets for this cash flow
    console.log('🔍 Fetching budgets...');
    const { data: budgets, error: budgetsError } = await supabase
      .from('budgets')
      .select('*, categories(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    console.log('🔍 Budgets query result:', { 
      budgetsCount: budgets?.length || 0, 
      budgetsError 
    });

    if (budgetsError) {
      console.error('❌ Error fetching budgets:', budgetsError);
    }
    
    // Get monthly goals for this cash flow (if any)
    console.log('🔍 Fetching monthly goals...');
    const { data: monthlyGoals, error: monthlyGoalsError } = await supabase
      .from('monthly_goals')
      .select('*')
      .eq('cash_flow_id', cash_flow_id)
      .eq('user_id', userId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    console.log('🔍 Monthly goals query result:', { 
      monthlyGoalsCount: monthlyGoals?.length || 0, 
      monthlyGoalsError 
    });

    if (monthlyGoalsError) {
      console.error('❌ Error fetching monthly goals:', monthlyGoalsError);
    }

    console.log(`📊 Found ${transactions?.length || 0} transactions, ${categories?.length || 0} categories, ${budgets?.length || 0} budgets`);

    // Create Excel workbook with multiple sheets
    console.log('📝 Creating Excel workbook...');
    const XLSX = require('xlsx');
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Transactions
    console.log('📝 Creating transactions sheet...');
    if (transactions && transactions.length > 0) {
      console.log(`📊 Processing ${transactions.length} transactions for sheet`);
      const transactionsData = transactions.map(transaction => {
        const paymentDate = transaction.payment_date ? new Date(transaction.payment_date) : null;
        const chargeDate = transaction.charge_date ? new Date(transaction.charge_date) : null;
        
        return {
          // עמודות RiseUp סטנדרטיות
          'תזרים חודש': transaction.flow_month || '',
          'שם העסק': transaction.business_name || '',
          'אמצעי התשלום': transaction.payment_method || '',
          'אמצעי זיהוי התשלום': transaction.payment_identifier || '',
          'תאריך התשלום': paymentDate ? paymentDate.toLocaleDateString('he-IL') : '',
          'חודש תאריך התשלום': paymentDate ? (paymentDate.getMonth() + 1).toString().padStart(2, '0') : '',
          'שנת תאריך התשלום': paymentDate ? paymentDate.getFullYear().toString() : '',
          'תאריך החיוב בחשבון': chargeDate ? chargeDate.toLocaleDateString('he-IL') : '',
          'סכום': parseFloat(transaction.amount || 0),
          'מטבע חיוב': transaction.currency || 'ILS',
          'מספר התשלום': transaction.payment_number || '',
          'מספר תשלומים כולל': transaction.total_payments || '',
          'קטגוריה בתזרים': transaction.category_name || 'ללא קטגוריה',
          'האם מוחרג מהתזרים?': transaction.excluded_from_flow === true ? 'true' : 'false',
          'הערות': transaction.notes || '',
          'סוג מקור': transaction.source_type || '',
          'סכום מקורי': parseFloat(transaction.original_amount || transaction.amount || 0),
          
          // עמודות נוספות שקיימות במסד הנתונים שלך
          'מזהה טרנזקציה': transaction.id || '',
          'מזהה משתמש': transaction.user_id || '',
          'מזהה תזרים מזומנים': transaction.cash_flow_id || '',
          'תאריך יצירה במערכת': transaction.created_at ? new Date(transaction.created_at).toLocaleDateString('he-IL') + ' ' + new Date(transaction.created_at).toLocaleTimeString('he-IL') : '',
          'תאריך עדכון אחרון': transaction.updated_at ? new Date(transaction.updated_at).toLocaleDateString('he-IL') + ' ' + new Date(transaction.updated_at).toLocaleTimeString('he-IL') : '',
          'האם העברה': transaction.is_transfer === true ? 'true' : 'false',
          'מזהה טרנזקציה מקושרת': transaction.linked_transaction_id || '',
          'מטבע מקורי': transaction.original_currency || '',
          'שער החלפה': transaction.exchange_rate || '',
          'תאריך החלפה': transaction.exchange_date ? new Date(transaction.exchange_date).toLocaleDateString('he-IL') : '',
          'מדינת העסק': transaction.business_country || '',
          'כמות': transaction.quantity || '',
          'קטגוריה מקור': transaction.source_category || '',
          'סוג עסקה': transaction.transaction_type || '',
          'שיטת ביצוע': transaction.execution_method || '',
          'חודש תשלום': transaction.payment_month || '',
          'שנת תשלום': transaction.payment_year || '',
          'האש טרנזקציה': transaction.transaction_hash || ''
        };
      });
      
      const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
      XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'עסקאות');
      console.log('✅ Transactions sheet created');
    } else {
      console.log('⚠️ No transactions found, skipping transactions sheet');
    }

    // Sheet 2: Categories Summary
    console.log('📝 Creating categories sheet...');
    if (categories && categories.length > 0) {
      console.log(`📊 Processing ${categories.length} categories for sheet`);
      // Calculate spending per category
      const categorySpending = {};
      (transactions || []).forEach(transaction => {
        const categoryName = transaction.category_name || 'ללא קטגוריה';
        if (!categorySpending[categoryName]) {
          categorySpending[categoryName] = {
            total: 0,
            count: 0,
            type: 'expense'
          };
        }
        categorySpending[categoryName].total += parseFloat(transaction.amount || 0);
        categorySpending[categoryName].count += 1;
      });

      const categoriesData = categories.map(category => ({
        'שם קטגוריה': category.name,
        'סוג': category.type === 'income' ? 'הכנסה' : 'הוצאה',
        'סה"כ הוצאה/הכנסה': categorySpending[category.name]?.total || 0,
        'מספר עסקאות': categorySpending[category.name]?.count || 0,
        'יעד חודשי': category.monthly_target || 0,
        'תיאור': category.description || ''
      }));

      const categoriesSheet = XLSX.utils.json_to_sheet(categoriesData);
      XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'קטגוריות');
      console.log('✅ Categories sheet created');
    } else {
      console.log('⚠️ No categories found, skipping categories sheet');
    }

    // Sheet 3: Monthly Summary
    console.log('📝 Creating monthly summary sheet...');
    const monthlyData = {};
    (transactions || []).forEach(transaction => {
      const flowMonth = transaction.flow_month || 'לא מוגדר';
      if (!monthlyData[flowMonth]) {
        monthlyData[flowMonth] = {
          income: 0,
          expenses: 0,
          count: 0
        };
      }
      const amount = parseFloat(transaction.amount || 0);
      if (amount > 0) {
        monthlyData[flowMonth].income += amount;
      } else {
        monthlyData[flowMonth].expenses += Math.abs(amount);
      }
      monthlyData[flowMonth].count += 1;
    });

    const monthlySummaryData = Object.entries(monthlyData).map(([month, data]) => ({
      'חודש': month,
      'הכנסות': data.income,
      'הוצאות': data.expenses,
      'מאזן': data.income - data.expenses,
      'מספר עסקאות': data.count
    }));

    const monthlySheet = XLSX.utils.json_to_sheet(monthlySummaryData);
    XLSX.utils.book_append_sheet(workbook, monthlySheet, 'סיכום חודשי');

    // Sheet 4: Budgets (if any)
    if (budgets && budgets.length > 0) {
      const budgetsData = budgets.map(budget => ({
        'קטגוריה': budget.categories?.name || 'כלל',
        'סכום תקציב': budget.amount || 0,
        'תקופה': budget.period || 'חודשי',
        'תאריך יצירה': budget.created_at ? new Date(budget.created_at).toLocaleDateString('he-IL') : ''
      }));

      const budgetsSheet = XLSX.utils.json_to_sheet(budgetsData);
      XLSX.utils.book_append_sheet(workbook, budgetsSheet, 'תקציבים');
      console.log('✅ Budgets sheet created');
    } else {
      console.log('⚠️ No budgets found, skipping budgets sheet');
    }

    // Sheet 5: Monthly Goals (if any)
    if (monthlyGoals && monthlyGoals.length > 0) {
      console.log('📝 Creating monthly goals sheet...');
      const monthlyGoalsData = monthlyGoals.map(goal => ({
        'שנה': goal.year,
        'חודש': goal.month,
        'סכום יעד': goal.amount || 0,
        'תיאור': goal.description || '',
        'תאריך יצירה': goal.created_at ? new Date(goal.created_at).toLocaleDateString('he-IL') : ''
      }));

      const monthlyGoalsSheet = XLSX.utils.json_to_sheet(monthlyGoalsData);
      XLSX.utils.book_append_sheet(workbook, monthlyGoalsSheet, 'יעדים חודשיים');
      console.log('✅ Monthly goals sheet created');
    } else {
      console.log('⚠️ No monthly goals found, skipping monthly goals sheet');
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const safeCashFlowName = cashFlow.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const serverFilename = `cashflow_data_${safeCashFlowName}_${timestamp}.xlsx`; // Safe name for server
    const downloadFilename = `נתוני_תזרים_${cashFlow.name}_${timestamp}.xlsx`; // Hebrew name for download
    const filePath = path.join(__dirname, '../../uploads', serverFilename);
    
    console.log(`📝 Generated server filename: ${serverFilename}`);
    console.log(`📝 Download filename will be: ${downloadFilename}`);

    console.log(`📝 Writing Excel file to: ${filePath}`);
    console.log(`📝 Workbook has ${workbook.SheetNames.length} sheets:`, workbook.SheetNames);

    // Write Excel file
    try {
      XLSX.writeFile(workbook, filePath);
      console.log(`✅ Excel file written successfully`);
      
      // Check if file exists and get its size
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const fileSizeKB = (stats.size / 1024).toFixed(2);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`📊 ==== FILE EXPORT SUMMARY ====`);
        console.log(`📁 Server File Name: ${serverFilename}`);
        console.log(`📁 Download File Name: ${downloadFilename}`);
        console.log(`📄 File Type: Excel (.xlsx)`);
        console.log(`📦 File Size: ${stats.size} bytes (${fileSizeKB} KB / ${fileSizeMB} MB)`);
        console.log(`📋 Sheets Count: ${workbook.SheetNames.length}`);
        console.log(`📋 Sheet Names: ${workbook.SheetNames.join(', ')}`);
        console.log(`📍 Full Path: ${filePath}`);
        console.log(`📊 Data Summary:`);
        console.log(`   - Transactions: ${transactions?.length || 0}`);
        console.log(`   - Categories: ${categories?.length || 0}`);
        console.log(`   - Budgets: ${budgets?.length || 0}`);
        console.log(`   - Monthly Goals: ${monthlyGoals?.length || 0}`);
        console.log(`📊 ===============================`);
      } else {
        console.error('❌ File was not created!');
        return res.status(500).json({ error: 'Failed to create Excel file' });
      }
    } catch (writeError) {
      console.error('❌ Error writing Excel file:', writeError);
      return res.status(500).json({ error: 'Failed to write Excel file', details: writeError.message });
    }

    console.log(`✅ Created Excel export file successfully!`);

    // Send file for download with proper headers
    console.log(`📤 Sending file for download: ${downloadFilename}`);
    console.log(`📁 File exists before download:`, fs.existsSync(filePath));
    console.log(`📊 File stats:`, fs.existsSync(filePath) ? fs.statSync(filePath) : 'File not found');
    
    // Read file and send as buffer to ensure proper blob handling
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const stats = fs.statSync(filePath);
      const fileSizeKB = (stats.size / 1024).toFixed(2);
      
      // Set headers manually
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      console.log(`📤 Sending file buffer: ${fileBuffer.length} bytes`);
      
      // Send the file buffer directly
      res.end(fileBuffer);
      
      console.log(`✅ File sent completed: ${downloadFilename} (${fileSizeKB} KB sent to client)`);
      console.log(`✅ Response headers sent successfully`);
      
      // Clean up file after sending
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Cleaned up temporary file: ${serverFilename}`);
          }
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup export file:', cleanupError.message);
        }
      }, 5000);
      
    } catch (fileError) {
      console.error('❌ Error reading file:', fileError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to read export file' });
      }
    }

  } catch (error) {
    console.error('❌ Error exporting cash flow data:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      error: 'Export failed',
      details: error.message
    });
  }
});

// Process single file for export with currency separation (without saving to database)
router.post('/process-single-for-export', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { file_source, payment_method, payment_identifier } = req.body;
    const userId = req.user.id;

    console.log('📁 Single file processing for export:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      userId: userId,
      fileSource: file_source
    });

    // Process the file using WorkingExcelService for export
    const result = await WorkingExcelService.processFileForExport(
      req.file.path,
      userId,
      null, // no cashFlowId for export
      file_source || 'other',
      payment_method,
      payment_identifier
    );

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file:', cleanupError.message);
    }

    if (!result.transactions || result.transactions.length === 0) {
      return res.status(400).json({
        error: 'No transactions found in file',
        details: 'File may be empty or in unsupported format'
      });
    }

    console.log(`✅ File processing completed: ${result.transactions.length} transactions found`);
    
    // Convert transactions to BudgetLens format
    const budgetLensTransactions = result.transactions.map(transaction => {
      const paymentDate = transaction.payment_date;
      const chargeDate = transaction.charge_date || transaction.payment_date;
      
      // Extract month from payment date for flow month
      let flowMonth = '';
      let paymentMonth = '';
      let paymentYear = '';
      if (paymentDate) {
        try {
          const date = new Date(paymentDate);
          flowMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          paymentMonth = String(date.getMonth() + 1).padStart(2, '0');
          paymentYear = String(date.getFullYear());
        } catch (e) {
          console.warn('Failed to extract flow month from date:', paymentDate);
        }
      }
      
      return {
        'שייך לתזרים חודש': transaction.flow_month || flowMonth,
        'שם העסק': transaction.business_name || transaction.description || '',
        'אמצעי התשלום': getPaymentMethodForBudgetLens(file_source),
        'אמצעי זיהוי התשלום': transaction.payment_identifier || payment_identifier || '',
        'תאריך התשלום': formatDateForBudgetLens(paymentDate),
        'חודש תאריך התשלום': paymentMonth,
        'שנת תאריך התשלום': paymentYear,
        'תאריך החיוב בחשבון': formatDateForBudgetLens(chargeDate),
        'סכום': transaction.amount || 0,
        'מטבע חיוב': transaction.currency || 'ILS',
        'מספר התשלום': transaction.installment_number || '',
        'מספר תשלומים כולל': transaction.total_installments || '',
        'קטגוריה בתזרים': transaction.category_name || '',
        'האם מוחרג מהתזרים?': 'FALSE', // Default to FALSE
        'הערות': transaction.notes || '',
        'סוג מקור': getSourceTypeForBudgetLens(file_source),
        'סכום מקורי': transaction.original_amount || transaction.amount || 0
      };
    });

    // Group transactions by currency
    const transactionsByCurrency = {};
    budgetLensTransactions.forEach(transaction => {
      const currency = transaction['מטבע חיוב'] || 'ILS'; // Default to ILS if no currency
      if (!transactionsByCurrency[currency]) {
        transactionsByCurrency[currency] = [];
      }
      transactionsByCurrency[currency].push(transaction);
    });

    console.log(`💱 Currency groups found:`, Object.keys(transactionsByCurrency));
    Object.keys(transactionsByCurrency).forEach(currency => {
      console.log(`💱 ${currency}: ${transactionsByCurrency[currency].length} transactions`);
    });

    // Create CSV files for each currency
    const XLSX = require('xlsx');
    const timestamp = new Date().toISOString().split('T')[0];
    const createdFiles = [];

    for (const [currency, transactions] of Object.entries(transactionsByCurrency)) {
      // Generate filename for this currency  
      const currencyFilename = `ישראכרט-${currency}-${timestamp}.csv`;
      const filePath = path.join(__dirname, '../../uploads', currencyFilename);

      // Convert transactions to CSV
      if (transactions.length > 0) {
        const ws = XLSX.utils.json_to_sheet(transactions);
        const csvContent = XLSX.utils.sheet_to_csv(ws);
        
        // Write CSV file
        fs.writeFileSync(filePath, csvContent, 'utf8');
      }
      
      createdFiles.push({
        currency: currency,
        filename: currencyFilename,
        filePath: filePath,
        transactionCount: transactions.length
      });
      
      console.log(`✅ Created ${currency} CSV file: ${currencyFilename} (${transactions.length} transactions)`);
    }

    // If only one currency, send that file directly
    if (createdFiles.length === 1) {
      const singleFile = createdFiles[0];
      res.download(singleFile.filePath, singleFile.filename, (err) => {
        if (err) {
          console.error('Download error:', err);
          res.status(500).json({ error: 'Failed to download file' });
        }
        
        // Clean up file after download
        setTimeout(() => {
          try {
            if (fs.existsSync(singleFile.filePath)) {
              fs.unlinkSync(singleFile.filePath);
            }
          } catch (cleanupError) {
            console.warn('Failed to cleanup export file:', cleanupError.message);
          }
        }, 10000); // 10 second delay to ensure download completes
      });
    } else {
      // Multiple currencies - create a ZIP file with all CSV files
      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      const zipFilename = `ישראכרט-by-currency-${timestamp}.zip`;
      const zipFilePath = path.join(__dirname, '../../uploads', zipFilename);
      const output = fs.createWriteStream(zipFilePath);
      
      archive.pipe(output);
      
      // Add each currency file to the ZIP
      createdFiles.forEach(file => {
        archive.file(file.filePath, { name: file.filename });
      });
      
      archive.finalize();
      
      output.on('close', () => {
        console.log(`📦 Created ZIP file: ${zipFilename} (${archive.pointer()} bytes)`);
        
        // Send ZIP file for download
        res.download(zipFilePath, zipFilename, (err) => {
          if (err) {
            console.error('ZIP download error:', err);
            res.status(500).json({ error: 'Failed to download ZIP file' });
          }
          
          // Clean up all files after download
          setTimeout(() => {
            try {
              // Remove ZIP file
              if (fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
              }
              // Remove individual CSV files
              createdFiles.forEach(file => {
                if (fs.existsSync(file.filePath)) {
                  fs.unlinkSync(file.filePath);
                }
              });
            } catch (cleanupError) {
              console.warn('Failed to cleanup files:', cleanupError.message);
            }
          }, 10000);
        });
      });
      
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        res.status(500).json({ error: 'Failed to create ZIP file' });
      });
    }

  } catch (error) {
    console.error('Single file export error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup file after error:', cleanupError.message);
      }
    }

    res.status(500).json({
      error: 'Export failed',
      details: error.message
    });
  }
});

// Process file for export (without saving to database)
router.post('/process-for-export', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { file_source, payment_method, payment_identifier } = req.body;
    const userId = req.user.id;

    console.log('📁 Processing file for export:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      userId: userId,
      fileSource: file_source
    });

    // Initialize working Excel service
    const excelService = new WorkingExcelService();

    // Process the file without saving to database
    const result = await excelService.processFileForExport(
      req.file.path,
      userId,
      null, // No cash flow ID needed for export
      file_source || 'other',
      payment_method || null,
      payment_identifier || null
    );

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file:', cleanupError.message);
    }

    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to process file for export',
        details: result.error
      });
    }

    console.log(`✅ File processing completed: ${result.transactions.length} transactions found`);
    
    // Convert transactions to BudgetLens format
    const budgetLensTransactions = result.transactions.map(transaction => {
      const paymentDate = transaction.payment_date;
      const chargeDate = transaction.charge_date || transaction.payment_date;
      
      // Extract month from payment date for flow month
      let flowMonth = '';
      let paymentMonth = '';
      let paymentYear = '';
      if (paymentDate) {
        try {
          const date = new Date(paymentDate);
          flowMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          paymentMonth = String(date.getMonth() + 1).padStart(2, '0');
          paymentYear = String(date.getFullYear());
        } catch (e) {
          console.warn('Failed to extract flow month from date:', paymentDate);
        }
      }
      
      return {
        'שייך לתזרים חודש': transaction.flow_month || flowMonth,
        'שם העסק': transaction.business_name || transaction.description || '',
        'אמצעי התשלום': getPaymentMethodForBudgetLens(file_source),
        'אמצעי זיהוי התשלום': transaction.payment_identifier || payment_identifier || '',
        'תאריך התשלום': formatDateForBudgetLens(paymentDate),
        'חודש תאריך התשלום': paymentMonth,
        'שנת תאריך התשלום': paymentYear,
        'תאריך החיוב בחשבון': formatDateForBudgetLens(chargeDate),
        'סכום': transaction.amount || 0,
        'מטבע חיוב': transaction.currency || 'ILS',
        'מספר התשלום': transaction.installment_number || '',
        'מספר תשלומים כולל': transaction.total_installments || '',
        'קטגוריה בתזרים': transaction.category_name || '',
        'האם מוחרג מהתזרים?': 'FALSE', // Default to FALSE
        'הערות': transaction.notes || '',
        'סוג מקור': getSourceTypeForBudgetLens(file_source),
        'סכום מקורי': transaction.original_amount || transaction.amount || 0
      };
    });

    console.log(`📊 Returning ${budgetLensTransactions.length} formatted transactions to client`);

    res.json({
      success: true,
      message: 'File processed successfully for export',
      transactions: budgetLensTransactions,
      originalTransactions: result.transactions,
      fileFormat: result.fileFormat,
      stats: {
        totalRows: result.totalRows,
        processedTransactions: result.transactions.length,
        fileSource: file_source
      }
    });

  } catch (error) {
    console.error('Process for export error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup file after error:', cleanupError.message);
      }
    }

    res.status(500).json({
      error: 'File processing for export failed',
      details: error.message
    });
  }
});

// Helper function to format dates for BudgetLens
function formatDateForBudgetLens(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    // Return in DD/MM/YYYY format like in the example
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function getPaymentMethodForBudgetLens(fileSource) {
  switch (fileSource?.toLowerCase()) {
    case 'isracard':
      return 'creditCard';
    case 'yahavbank':
    case 'bank':
      return 'checkingAccount';
    case 'leumicard':
      return 'creditCard';
    case 'cal':
      return 'creditCard';
    default:
      return 'creditCard';
  }
}

function getSourceTypeForBudgetLens(fileSource) {
  switch (fileSource?.toLowerCase()) {
    case 'isracard':
      return 'creditCard';
    case 'yahavbank':
    case 'bank':
      return 'checkingAccount';
    case 'leumicard':
      return 'creditCard';
    case 'cal':
      return 'creditCard';
    default:
      return 'creditCard';
  }
}

// Create merged BudgetLens Excel file from multiple processed files
router.post('/create-merged-excel', authenticateToken, async (req, res) => {
  try {
    const { processedFiles, filename } = req.body;
    
    console.log('📊 Create merged Excel request:', {
      filesCount: processedFiles?.length || 0,
      filename: filename
    });
    
    if (!processedFiles || !Array.isArray(processedFiles)) {
      console.error('❌ Invalid processed files data:', typeof processedFiles);
      return res.status(400).json({ error: 'Invalid processed files data' });
    }

    // Log each file's transaction count
    processedFiles.forEach((file, index) => {
      console.log(`📁 File ${index + 1}: ${file.filename || 'Unknown'} - ${file.transactions?.length || 0} transactions`);
    });

    // Merge all transactions
    const allTransactions = processedFiles.flatMap(file => file.transactions || []);
    
    console.log(`🔄 Total transactions after merge: ${allTransactions.length}`);
    
    if (allTransactions.length === 0) {
      console.error('❌ No transactions to export - all files were empty');
      return res.status(400).json({ error: 'No transactions to export' });
    }

    // Group transactions by currency
    const transactionsByCurrency = {};
    allTransactions.forEach(transaction => {
      const currency = transaction['מטבע חיוב'] || 'ILS'; // Default to ILS if no currency
      if (!transactionsByCurrency[currency]) {
        transactionsByCurrency[currency] = [];
      }
      transactionsByCurrency[currency].push(transaction);
    });

    console.log(`💱 Currency groups found:`, Object.keys(transactionsByCurrency));
    Object.keys(transactionsByCurrency).forEach(currency => {
      console.log(`💱 ${currency}: ${transactionsByCurrency[currency].length} transactions`);
    });

    // Create CSV files for each currency
    const XLSX = require('xlsx');
    const timestamp = new Date().toISOString().split('T')[0];
    const createdFiles = [];

    for (const [currency, transactions] of Object.entries(transactionsByCurrency)) {
      // Generate filename for this currency
      const currencyFilename = `ישראכרט-${currency}-${timestamp}.csv`;
      const filePath = path.join(__dirname, '../../uploads', currencyFilename);

      // Convert transactions to CSV
      if (transactions.length > 0) {
        const ws = XLSX.utils.json_to_sheet(transactions);
        const csvContent = XLSX.utils.sheet_to_csv(ws);
        
        // Write CSV file
        fs.writeFileSync(filePath, csvContent, 'utf8');
      }
      
      createdFiles.push({
        currency: currency,
        filename: currencyFilename,
        filePath: filePath,
        transactionCount: transactions.length
      });
      
      console.log(`✅ Created ${currency} CSV file: ${currencyFilename} (${transactions.length} transactions)`);
    }

    // If only one currency, send that file directly
    if (createdFiles.length === 1) {
      const singleFile = createdFiles[0];
      res.download(singleFile.filePath, singleFile.filename, (err) => {
        if (err) {
          console.error('Download error:', err);
          res.status(500).json({ error: 'Failed to download file' });
        }
        
        // Clean up file after download
        setTimeout(() => {
          try {
            if (fs.existsSync(singleFile.filePath)) {
              fs.unlinkSync(singleFile.filePath);
            }
          } catch (cleanupError) {
            console.warn('Failed to cleanup export file:', cleanupError.message);
          }
        }, 10000); // 10 second delay to ensure download completes
      });
    } else {
      // Multiple currencies - create a ZIP file with all Excel files
      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      const zipFilename = `ישראכרט-by-currency-${timestamp}.zip`;
      const zipFilePath = path.join(__dirname, '../../uploads', zipFilename);
      const output = fs.createWriteStream(zipFilePath);
      
      archive.pipe(output);
      
      // Add each currency file to the ZIP
      createdFiles.forEach(file => {
        archive.file(file.filePath, { name: file.filename });
      });
      
      archive.finalize();
      
      output.on('close', () => {
        console.log(`📦 Created ZIP file: ${zipFilename} (${archive.pointer()} bytes)`);
        
        // Send ZIP file for download
        res.download(zipFilePath, zipFilename, (err) => {
          if (err) {
            console.error('ZIP download error:', err);
            res.status(500).json({ error: 'Failed to download ZIP file' });
          }
          
          // Clean up all files after download
          setTimeout(() => {
            try {
              // Remove ZIP file
              if (fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
              }
              // Remove individual Excel files
              createdFiles.forEach(file => {
                if (fs.existsSync(file.filePath)) {
                  fs.unlinkSync(file.filePath);
                }
              });
            } catch (cleanupError) {
              console.warn('Failed to cleanup files:', cleanupError.message);
            }
          }, 10000);
        });
      });
      
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        res.status(500).json({ error: 'Failed to create ZIP file' });
      });
    }

  } catch (error) {
    console.error('Create merged Excel error:', error);
    res.status(500).json({
      error: 'Failed to create merged Excel file',
      details: error.message
    });
  }
});

// Get upload history/statistics
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    // Get recent imports by source_type
    const { transactions } = await SupabaseService.getTransactions(
      userId, 
      { source_type: 'import' }, 
      1, 
      parseInt(limit)
    );

    // Group by import session (by created_at date)
    const importSessions = {};
    transactions.forEach(transaction => {
      const importDate = transaction.created_at.split('T')[0];
      const sourceType = transaction.source_type || 'manual';
      
      const sessionKey = `${importDate}-${sourceType}`;
      
      if (!importSessions[sessionKey]) {
        importSessions[sessionKey] = {
          date: importDate,
          source_type: sourceType,
          count: 0,
          total_amount: 0,
          transactions: []
        };
      }
      
      importSessions[sessionKey].count++;
      importSessions[sessionKey].total_amount += parseFloat(transaction.amount || 0);
      importSessions[sessionKey].transactions.push(transaction);
    });

    const history = Object.values(importSessions)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, parseInt(limit));

    res.json({
      upload_history: history,
      total_sessions: history.length
    });

  } catch (error) {
    console.error('Upload history error:', error);
    res.status(500).json({
      error: 'Failed to get upload history',
      details: error.message
    });
  }
});

// ===== MIGRATION ROUTES =====

// Migrate existing transactions to add transaction_hash
router.post('/migrate_transaction_hashes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('🔄 Starting transaction hash migration for user:', userId);
    
    // Get all transactions for the user that don't have transaction_hash
    const { data: transactions, error: fetchError } = await require('../config/supabase')
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .is('transaction_hash', null);
    
    if (fetchError) {
      throw new Error(`Failed to fetch transactions: ${fetchError.message}`);
    }
    
    if (!transactions || transactions.length === 0) {
      return res.json({
        success: true,
        message: 'No transactions need hash migration',
        updated_count: 0
      });
    }
    
    console.log(`📊 Found ${transactions.length} transactions without hash`);
    
    let updated_count = 0;
    let error_count = 0;
    const batch_size = 100;
    
    // Process in batches to avoid overwhelming the database
    for (let i = 0; i < transactions.length; i += batch_size) {
      const batch = transactions.slice(i, i + batch_size);
      
      const updates = batch.map(transaction => {
        try {
          const transaction_hash = SupabaseService.generateTransactionHash(transaction);
          return {
            id: transaction.id,
            transaction_hash: transaction_hash
          };
        } catch (error) {
          console.error(`Error generating hash for transaction ${transaction.id}:`, error);
          error_count++;
          return null;
        }
      }).filter(update => update !== null);
      
      if (updates.length > 0) {
        // Update transactions in database
        for (const update of updates) {
          try {
            const { error: updateError } = await require('../config/supabase')
              .from('transactions')
              .update({ transaction_hash: update.transaction_hash })
              .eq('id', update.id);
            
            if (updateError) {
              console.error(`Error updating transaction ${update.id}:`, updateError);
              error_count++;
            } else {
              updated_count++;
            }
          } catch (error) {
            console.error(`Exception updating transaction ${update.id}:`, error);
            error_count++;
          }
        }
      }
      
      console.log(`✅ Processed batch ${Math.floor(i / batch_size) + 1}/${Math.ceil(transactions.length / batch_size)}`);
    }
    
    console.log(`🎉 Migration completed: ${updated_count} updated, ${error_count} errors`);
    
    res.json({
      success: true,
      message: 'Transaction hash migration completed',
      total_transactions: transactions.length,
      updated_count: updated_count,
      error_count: error_count
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({
      error: 'Migration failed',
      details: error.message
    });
  }
});

// Get duplicates data by temp ID
router.get('/duplicates/:tempId', authenticateToken, async (req, res) => {
  try {
    const { tempId } = req.params;
    const duplicatesFilePath = path.join(__dirname, '../../uploads', `temp_duplicates_${tempId}.json`);
    
    if (!fs.existsSync(duplicatesFilePath)) {
      return res.status(404).json({ error: 'Duplicates data not found' });
    }
    
    const duplicatesData = JSON.parse(fs.readFileSync(duplicatesFilePath, 'utf8'));
    
    // Verify user has access to this data
    if (duplicatesData.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(duplicatesData);
    
  } catch (error) {
    console.error('Error loading duplicates:', error);
    res.status(500).json({
      error: 'Failed to load duplicates data',
      details: error.message
    });
  }
});

// Get distinct source types for dropdown
router.get('/distinct-source-types', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data: sourceTypes, error } = await require('../config/supabase').supabase
      .from('transactions')
      .select('source_type')
      .eq('user_id', userId)
      .not('source_type', 'is', null);
    
    if (error) {
      throw new Error(error.message);
    }
    
    // Get distinct values
    const distinctSourceTypes = [...new Set(sourceTypes.map(row => row.source_type))].filter(Boolean);
    
    res.json({
      success: true,
      sourceTypes: distinctSourceTypes
    });
    
  } catch (error) {
    console.error('Error fetching distinct source types:', error);
    res.status(500).json({
      error: 'Failed to fetch source types',
      details: error.message
    });
  }
});

// Get distinct payment methods for dropdown
router.get('/distinct-payment-methods', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data: paymentMethods, error } = await require('../config/supabase').supabase
      .from('transactions')
      .select('payment_method')
      .eq('user_id', userId)
      .not('payment_method', 'is', null);
    
    if (error) {
      throw new Error(error.message);
    }
    
    // Get distinct values
    const distinctPaymentMethods = [...new Set(paymentMethods.map(row => row.payment_method))].filter(Boolean);
    
    res.json({
      success: true,
      paymentMethods: distinctPaymentMethods
    });
    
  } catch (error) {
    console.error('Error fetching distinct payment methods:', error);
    res.status(500).json({
      error: 'Failed to fetch payment methods',
      details: error.message
    });
  }
});

module.exports = router;