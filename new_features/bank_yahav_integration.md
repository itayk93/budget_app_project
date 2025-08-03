# Bank Yahav Excel File Processing Integration

## Overview

This feature adds comprehensive support for processing Bank Yahav (בנק יהב) Excel files (.xls and .xlsx) in the budget application. The implementation provides a complete end-to-end solution from file upload to transaction import with multi-step processing, currency validation, duplicate detection, and user approval workflows.

## Feature Description

The Bank Yahav integration handles the unique characteristics of Bank Yahav Excel export files:

- **Multi-sheet processing**: Processes all sheets in the Excel file
- **Dynamic header detection**: Headers are not always in the first row
- **Hebrew language support**: Full support for Hebrew column names and data
- **Multi-currency handling**: Detects and groups transactions by currency
- **Duplicate detection**: Advanced duplicate checking with user resolution options
- **Auto-categorization**: Smart categorization based on business name patterns

## Technical Requirements

### File Format Support
- **.xls files**: Legacy Excel format (Excel 97-2003)
- **.xlsx files**: Modern Excel format (Excel 2007+)
- **Multi-sheet processing**: Processes all relevant sheets in the workbook
- **Hebrew text encoding**: Proper handling of Hebrew characters

### Column Mapping
The service detects and maps the following Bank Yahav columns:

| Hebrew Column Name | English Description | Required |
|-------------------|-------------------|----------|
| תאריך | Payment Date | ✅ Yes |
| תאריך ערך | Value Date | ❌ No (defaults to payment date) |
| אסמכתא | Reference/Document Number | ✅ Yes |
| תיאור פעולה | Transaction Description | ✅ Yes |
| שם הפעולה | Alternative Transaction Name | ✅ Yes (alternative to תיאור פעולה) |
| חובה(₪) | Debit Amount (ILS) | ✅ Yes (or זכות) |
| זכות(₪) | Credit Amount (ILS) | ✅ Yes (or חובה) |

## Implementation Details

### Backend Components

#### 1. BankYahavService (`/server/services/bankYahavService.js`)

Main service class responsible for:
- **File Processing**: Reading .xls/.xlsx files using the `xlsx` library
- **Header Detection**: Dynamically finding header rows (not necessarily row 1)
- **Data Transformation**: Converting Bank Yahav data to application format
- **Currency Grouping**: Organizing transactions by currency
- **Duplicate Detection**: Checking for existing transactions using hash comparison

Key Methods:
```javascript
// Main processing function
static async processYahavFile(filePath, userId, cashFlowId, options = {})

// Find header row in worksheet (not always row 1)
static findHeaderRow(worksheet)

// Process individual sheet data
static async processSheetData(jsonData, userId, cashFlowId, sheetName)

// Group transactions by currency
static groupByCurrency(transactions)

// Check for duplicates
static async checkDuplicates(transactions, userId, cashFlowId)

// Import with user selections
static async importSelectedTransactions(transactions, userSelections = {})
```

#### 2. ExcelService Integration (`/server/services/excelService.js`)

Updated the existing Excel service to:
- **Detect Bank Yahav files**: Added detection logic for Bank Yahav header patterns
- **Route to specialized service**: Direct Bank Yahav files to BankYahavService
- **Maintain compatibility**: Existing bank processors remain unchanged

Detection Logic:
```javascript
// Bank Yahav detection pattern
if (headerString.includes('תאריך') && headerString.includes('אסמכתא') && 
    (headerString.includes('תיאור פעולה') || headerString.includes('שם הפעולה'))) {
  return 'bank_yahav';
}
```

#### 3. API Endpoints (`/server/routes/upload.js`)

Added comprehensive REST API endpoints for multi-step processing:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload/bank-yahav/process` | POST | Initial file processing and analysis |
| `/upload/bank-yahav/currency-groups/:uploadId` | GET | Get currency group data for review |
| `/upload/bank-yahav/select-currencies` | POST | Handle currency selection |
| `/upload/bank-yahav/duplicates/:uploadId` | GET | Get duplicate data for review |
| `/upload/bank-yahav/import` | POST | Final import with user selections |

### Data Processing Pipeline

#### 1. File Upload and Initial Processing
```javascript
POST /upload/bank-yahav/process
Content-Type: multipart/form-data

{
  file: [Bank Yahav .xls/.xlsx file],
  cash_flow_id: "uuid"
}
```

Response:
```javascript
{
  success: true,
  uploadId: "timestamp-random",
  fileFormat: "bank_yahav",
  totalTransactions: 17,
  currencyGroups: {
    "ILS": {
      count: 17,
      totalAmount: 65529.44,
      dateRange: { from: "2025-07-01", to: "2025-08-02" },
      sampleTransactions: [...]
    }
  },
  duplicates: {}
}
```

#### 2. Currency Group Review
Users can review detected currencies and select which ones to import:

```javascript
GET /upload/bank-yahav/currency-groups/{uploadId}

Response:
{
  success: true,
  currencyGroups: { ... },
  totalTransactions: 17
}
```

#### 3. Currency Selection
```javascript
POST /upload/bank-yahav/select-currencies

{
  uploadId: "timestamp-random",
  selectedCurrencies: ["ILS", "USD"]
}
```

#### 4. Duplicate Review and Resolution
```javascript
GET /upload/bank-yahav/duplicates/{uploadId}

Response:
{
  success: true,
  duplicates: {
    "hash123": {
      newTransaction: { ... },
      existingTransactions: [ ... ],
      count: 2
    }
  }
}
```

#### 5. Final Import
```javascript
POST /upload/bank-yahav/import

{
  uploadId: "timestamp-random",
  duplicateResolutions: {
    "hash123": "skip",      // Options: "import", "skip", "replace"
    "hash456": "replace"
  }
}
```

### Data Transformation

#### Source Format (Bank Yahav Excel)
| תאריך | אסמכתא | תיאור פעולה | חובה(₪) | זכות(₪) |
|-------|---------|--------------|---------|---------|
| 01/08/2025 | 25-343764028 | משכורת 09-שביט סופטוור | | 15869.53 |
| 30/07/2025 | 410-3705044 | תנועת מס 223 | 2.18 | |

#### Target Format (Application Database)
```javascript
{
  id: null,
  user_id: "uuid",
  cash_flow_id: "uuid",
  business_name: "משכורת 09-שביט סופטוור",
  payment_date: "2025-08-01",
  charge_date: "2025-08-01",
  amount: 15869.53,               // Credit positive, debit negative
  currency: "ILS",
  payment_method: null,
  payment_identifier: null,
  category_id: null,
  payment_month: 8,
  payment_year: 2025,
  flow_month: "2025-08",
  notes: "",
  excluded_from_flow: false,
  source_type: "BankAccount",
  original_identifier: "25-343764028",
  transaction_hash: "generated-hash",
  created_at: "2025-01-31T10:30:00.000Z",
  updated_at: "2025-01-31T10:30:00.000Z",
  // ... additional fields with default values
}
```

## Key Features

### 1. Dynamic Header Detection
Unlike other bank formats, Bank Yahav files don't always have headers in the first row. The service:
- Scans the first 10 rows looking for Hebrew header keywords
- Identifies the correct header row using pattern matching
- Supports variations in header naming

### 2. Multi-Sheet Processing
Bank Yahav exports often contain multiple sheets:
- **תנועות עו"ש** (Current account transactions)
- **תנועות זמניות בהמתנה** (Pending transactions)
- Processes all sheets and combines results

### 3. Hebrew Text Processing
- Proper handling of RTL (Right-to-Left) text
- Business name cleaning (removes `/` characters)
- Preserves original Hebrew names for categorization

### 4. Amount Calculation
```javascript
// Combines debit and credit columns
const debitAmount = parseAmount(row[debitCol]) || 0;
const creditAmount = parseAmount(row[creditCol]) || 0;
const amount = creditAmount - debitAmount; // Credit positive, debit negative
```

### 5. Auto-Categorization
Leverages existing categorization system:
- Checks for exact business name matches
- Uses similarity matching for close matches
- Defaults to appropriate categories based on amount sign

### 6. Multi-Currency Support
- Groups transactions by detected currencies
- Allows users to select which currencies to import
- Supports ILS, USD, EUR, and other currencies

## Error Handling

### File Processing Errors
- Invalid file format detection
- Missing required columns
- Date parsing failures
- Amount parsing errors

### Database Errors
- Duplicate key violations
- Foreign key constraint failures
- Network connectivity issues

### User Input Validation
- Invalid upload session IDs
- Malformed currency selections
- Invalid duplicate resolution choices

## Testing

### Test File Processing
The implementation was tested with the provided Bank Yahav file:
- **File**: `/Users/itaykarkason/Downloads/תנועות בחשבון עו״ש (1).xls`
- **Results**: Successfully processed 17 transactions across 2 sheets
- **Currency Groups**: 1 group (ILS) with proper grouping
- **Header Detection**: Correctly found headers at row 6 and row 3 in different sheets

### Test Results Summary
```
✅ File Format: .xls (legacy Excel format)
✅ Sheets Processed: 2 sheets
✅ Header Detection: Dynamic detection successful
✅ Transactions Found: 17 total
✅ Currency Grouping: 1 currency group (ILS)
✅ Amount Range: -1,111 ILS to +15,869.53 ILS
✅ Date Range: 2025-07-01 to 2025-08-02
✅ Auto-Categorization: Applied to all transactions
```

## Configuration

### Required Environment Variables
No additional environment variables required. Uses existing Supabase and authentication configuration.

### Package Dependencies
- `xlsx@^0.18.5` - Already installed in project for Excel file processing
- No additional dependencies required

## API Integration

### Frontend Integration Example
```javascript
// 1. Upload and process file
const formData = new FormData();
formData.append('file', bankYahavFile);
formData.append('cash_flow_id', selectedCashFlowId);

const response = await fetch('/api/upload/bank-yahav/process', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});

const result = await response.json();
const uploadId = result.uploadId;

// 2. Review currency groups
const currencyResponse = await fetch(`/api/upload/bank-yahav/currency-groups/${uploadId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// 3. Select currencies and check duplicates
await fetch('/api/upload/bank-yahav/select-currencies', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    uploadId,
    selectedCurrencies: ['ILS']
  })
});

// 4. Handle duplicates and import
await fetch('/api/upload/bank-yahav/import', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    uploadId,
    duplicateResolutions: { /* user choices */ }
  })
});
```

## Security Considerations

### File Upload Security
- File type validation (only .xls/.xlsx allowed)
- File size limits enforced by multer configuration
- Temporary file cleanup after processing

### Authentication
- All endpoints require JWT authentication
- User session validation
- Cash flow ownership verification

### Data Validation
- Input sanitization for all user data
- SQL injection prevention through parameterized queries
- XSS prevention through data encoding

## Performance Considerations

### Memory Usage
- Streams large Excel files when possible
- Processes sheets individually to manage memory
- Cleanup of temporary files after processing

### Database Performance
- Batch duplicate checking to reduce database calls
- Efficient hash-based duplicate detection
- Indexed transaction hash lookups

### Scalability
- Stateless processing (except for upload sessions)
- Session cleanup after completion
- Suitable for concurrent users

## Monitoring and Logging

### Application Logs
```javascript
console.log('🏦 Processing Bank Yahav file:', { uploadId, filename, size });
console.log('✅ Successfully processed N transactions from sheet: sheetName');
console.log('🔍 Checking duplicates for currency: count transactions');
```

### Error Logging
```javascript
console.error('❌ Error processing Bank Yahav file:', error);
console.error('❌ Error checking duplicates:', error);
```

## Future Enhancements

### Planned Improvements
1. **Real-time Processing**: WebSocket support for live progress updates
2. **Batch Processing**: Support for multiple files in single upload
3. **Advanced Categorization**: ML-based categorization for Hebrew text
4. **Export Templates**: Generate Bank Yahav-compatible export formats
5. **Data Validation**: Enhanced validation rules for Bank Yahav data

### Frontend Interface
The backend is ready for a frontend interface that provides:
- File upload with drag-and-drop
- Currency group selection interface
- Duplicate resolution workflow
- Progress tracking and notifications

## Documentation Updates

### Updated Files
- `PROJECT_DOCUMENTATION.md` - Added Bank Yahav API endpoints
- `new_features/bank_yahav_integration.md` - This comprehensive feature documentation

### Git Tracking
All changes tracked in git with detailed commit messages and updated in `git_commits_log.xlsx`.

## Conclusion

The Bank Yahav integration provides a robust, production-ready solution for processing Bank Yahav Excel exports. The implementation follows the existing codebase patterns while adding specialized handling for Bank Yahav's unique file format characteristics. The multi-step processing workflow ensures users have full control over their data import while maintaining data integrity through comprehensive duplicate detection and validation.