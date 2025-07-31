const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logsDir = path.join(__dirname, '../../logs');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    getTimestamp() {
        return new Date().toISOString();
    }

    formatLogEntry(level, category, message, data = null, context = {}) {
        const entry = {
            timestamp: this.getTimestamp(),
            level,
            category,
            message,
            ...(data && { data }),
            ...(Object.keys(context).length > 0 && { context }),
            pid: process.pid
        };
        return JSON.stringify(entry);
    }

    writeToFile(filename, entry) {
        const filePath = path.join(this.logsDir, filename);
        fs.appendFileSync(filePath, entry + '\n');
    }

    logToConsole(level, category, message, data) {
        const emoji = {
            ERROR: '❌',
            WARN: '⚠️',
            INFO: '📝',
            DEBUG: '🔍',
            SUCCESS: '✅'
        };
        
        const prefix = `${emoji[level] || '📝'} [${category}]`;
        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    log(level, category, message, data = null, context = {}) {
        const entry = this.formatLogEntry(level, category, message, data, context);
        
        // Always log to console
        this.logToConsole(level, category, message, data);
        
        // Log to appropriate files
        this.writeToFile('app.log', entry);
        
        // Category-specific log files
        if (category === 'UPLOAD') {
            this.writeToFile('upload.log', entry);
        } else if (category === 'AUTH') {
            this.writeToFile('auth.log', entry);
        } else if (category === 'DATABASE') {
            this.writeToFile('database.log', entry);
        } else if (category === 'ERROR') {
            this.writeToFile('error.log', entry);
        }
    }

    // Convenience methods
    info(category, message, data = null, context = {}) {
        this.log('INFO', category, message, data, context);
    }

    error(category, message, data = null, context = {}) {
        this.log('ERROR', category, message, data, context);
        this.writeToFile('error.log', this.formatLogEntry('ERROR', category, message, data, context));
    }

    warn(category, message, data = null, context = {}) {
        this.log('WARN', category, message, data, context);
    }

    debug(category, message, data = null, context = {}) {
        this.log('DEBUG', category, message, data, context);
    }

    success(category, message, data = null, context = {}) {
        this.log('SUCCESS', category, message, data, context);
    }

    // Upload-specific logging methods
    uploadStart(uploadId, filename, fileSize, userId) {
        this.info('UPLOAD', 'Upload session started', {
            uploadId,
            filename,
            fileSize,
            userId
        });
    }

    uploadProgress(uploadId, step, progress, details = {}) {
        this.info('UPLOAD', `Upload progress: ${step}`, {
            uploadId,
            step,
            progress,
            ...details
        });
    }

    uploadComplete(uploadId, result) {
        this.success('UPLOAD', 'Upload completed successfully', {
            uploadId,
            result
        });
    }

    uploadError(uploadId, step, error, context = {}) {
        this.error('UPLOAD', `Upload failed at step: ${step}`, {
            uploadId,
            step,
            error: error.message || error,
            stack: error.stack,
            ...context
        });
    }

    // Column mapping logging
    columnMapping(uploadId, originalColumns, mappedColumns, unmappedColumns = []) {
        this.info('UPLOAD', 'Column mapping completed', {
            uploadId,
            originalColumns,
            mappedColumns,
            unmappedColumns,
            mappingSuccess: unmappedColumns.length === 0
        });
    }

    // Source category logging
    sourceCategoryProcessing(uploadId, rowIndex, sourceCategory, businessName) {
        this.debug('UPLOAD', 'Processing source_category', {
            uploadId,
            rowIndex,
            sourceCategory,
            businessName
        });
    }

    // Database operation logging
    dbOperation(operation, table, data, result = null) {
        this.info('DATABASE', `${operation} operation on ${table}`, {
            operation,
            table,
            dataKeys: data ? Object.keys(data) : null,
            success: result !== null,
            result: result ? (typeof result === 'object' ? Object.keys(result) : result) : null
        });
    }

    // Request correlation
    setRequestContext(req) {
        if (!req.requestId) {
            req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        return req.requestId;
    }
}

// Singleton instance
const logger = new Logger();

module.exports = logger;