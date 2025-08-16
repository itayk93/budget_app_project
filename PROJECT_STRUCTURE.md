# Project Structure

## Frontend (React)

### Main Components
```
client/src/components/
├── Upload/
│   ├── TransactionReviewModal.js          # Main modal component (refactored)
│   ├── TransactionReviewModal.backup.js   # Original backup file  
│   ├── CategoryDropdown.js                # Category selection dropdown
│   ├── TransactionReviewModal.css         # Modal styling
│   └── services/                          # Service layer (NEW - modular)
│       ├── CategoryService.js             # Category management and hierarchy
│       ├── DuplicateService.js            # Duplicate transaction handling
│       ├── ForeignCurrencyService.js      # Foreign currency detection/conversion
│       └── TransactionProcessingService.js # Transaction processing and PAYBOX extraction
├── Dashboard/
│   ├── TransactionsTable.js              # Main transactions display
│   ├── TransactionCard.js                # Individual transaction card
│   ├── CategoryFilter.js                 # Category filtering
│   ├── FiltersPanel.js                   # Date/amount filters
│   └── SearchPanel.js                    # Search functionality
├── Common/
│   ├── Modal.js                          # Reusable modal component
│   ├── LoadingSpinner.js                 # Loading indicator
│   └── DateRangePicker.js                # Date selection
└── Auth/
    ├── LoginForm.js                      # User authentication
    └── ProtectedRoute.js                 # Route protection
```

### Services
```
client/src/services/
├── api.js                               # Main API service
├── supabaseClient.js                    # Supabase configuration
├── uploadService.js                     # File upload handling
└── categoriesService.js                # Category management API
```

### Pages
```
client/src/pages/
├── Upload/
│   └── UploadPage.js                    # File upload interface
├── Dashboard/
│   └── DashboardPage.js                 # Main dashboard
├── Stocks/
│   └── StocksDashboard.js               # Stock tracking
└── Auth/
    ├── LoginPage.js                     # Login interface
    └── RegisterPage.js                  # Registration
```

## Backend (Node.js/Express)

### Server Structure
```
server/
├── server.js                           # Main server file
├── middleware/
│   ├── auth.js                         # Authentication middleware
│   ├── cors.js                         # CORS configuration
│   └── rateLimiting.js                 # Rate limiting
├── routes/
│   ├── auth.js                         # Authentication routes
│   ├── transactions.js                 # Transaction management
│   ├── categories.js                   # Category operations
│   ├── upload.js                       # File upload handling
│   ├── dashboard.js                    # Dashboard data
│   └── bank-scraper.js                 # Bank integration
└── services/
    └── supabase-modules/               # Modular Supabase services
        ├── CategoryService.js          # Category operations
        ├── TransactionService.js       # Transaction CRUD
        ├── UserService.js              # User management
        └── CashFlowService.js          # Cash flow operations
```

## Refactoring Summary

### TransactionReviewModal Refactoring
The main `TransactionReviewModal.js` component (1,291 lines) has been refactored into:

1. **CategoryService.js** (139 lines)
   - Category loading from API
   - Category hierarchy building
   - Category filtering logic

2. **DuplicateService.js** (128 lines)
   - Duplicate transaction detection
   - Duplicate action management
   - Delete transaction handling

3. **ForeignCurrencyService.js** (169 lines)
   - Foreign currency detection
   - Currency conversion modal
   - Exchange rate calculations

4. **TransactionProcessingService.js** (198 lines)
   - Transaction initialization
   - PAYBOX recipient extraction
   - Auto-category suggestions
   - Transaction data processing

5. **TransactionReviewModal.js** (REFACTORED - ~800 lines)
   - Main React component
   - UI rendering and state management
   - Orchestrates all services

### Benefits of Refactoring
- **Maintainability**: Each service handles one responsibility
- **Testability**: Services can be tested independently
- **Reusability**: Services can be used in other components
- **Readability**: Smaller, focused files are easier to understand
- **Scalability**: Easy to add new features to specific services

### File Organization
```
Original: 1 file (1,291 lines)
Refactored: 5 files (139 + 128 + 169 + 198 + ~800 = ~1,434 total lines)
```

The slight increase in total lines is due to:
- Service class structure and exports
- Better code organization and spacing
- Improved documentation and logging
- Separation of concerns leading to clearer code

## Database Schema

### Main Tables
- `users` - User authentication and profiles
- `cash_flows` - User's financial accounts
- `transactions` - All financial transactions
- `categories` - Transaction categories
- `category_order` - Category display ordering
- `user_preferences` - User settings

### Key Relationships
- Users → Cash Flows (1:many)
- Cash Flows → Transactions (1:many)
- Categories → Transactions (1:many)
- Users → Preferences (1:1)

## Development Workflow

### Frontend Development
```bash
cd client
npm start                    # Development server
npm run build               # Production build
npm test                    # Run tests
```

### Backend Development
```bash
npm start                   # Start server
npm run dev                 # Development with nodemon
npm test                    # Run tests
```

### Full Stack
```bash
npm run dev                 # Start both client and server
```

## Key Features

### Upload System
- CSV/Excel file parsing
- Bank statement integration
- Duplicate detection
- Category auto-suggestion
- Foreign currency handling

### Dashboard
- Transaction filtering and search
- Category-based visualization
- Date range selection
- Real-time updates

### Bank Integration
- Israeli bank scraper support
- Automated transaction import
- Statement parsing
- Currency conversion

### Security
- JWT-based authentication
- Row-level security in Supabase
- Input validation and sanitization
- Rate limiting

This modular structure makes the codebase more maintainable and allows for easier feature development and testing.