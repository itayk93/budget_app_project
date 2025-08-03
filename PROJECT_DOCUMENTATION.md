# BudgetLens - Personal Finance Management App

## Project Overview
BudgetLens is a comprehensive personal finance management application built with React (frontend) and Node.js/Express (backend). The application provides features for expense tracking, budgeting, stock portfolio management, and financial reporting.

## System Architecture

### Technology Stack
- **Frontend**: React.js with CSS modules
- **Backend**: Node.js with Express.js framework
- **Database**: SQLite (local), Supabase (cloud)
- **Authentication**: JWT tokens with bcryptjs for password hashing
- **File Processing**: Multer for uploads, XLSX for Excel processing
- **Email Service**: Brevo for email notifications
- **Stock Data**: Alpha Vantage and Yahoo Finance APIs
- **AI Integration**: OpenAI GPT-4 Vision for screenshot processing

### Project Structure
```
budget_app_project_new/
├── client/                 # React frontend application
├── server/                 # Express backend application
├── uploads/               # File upload storage
├── logs/                  # Application logs
├── sql/                   # Database migration scripts
├── new_features/          # Feature documentation
└── package.json          # Root package configuration
```

## Base URLs and Environment

### Development Environment
- **Frontend URL**: http://localhost:3000 or http://localhost:4000
- **Backend URL**: http://localhost:5001
- **Static Files**: `/uploads/*` served statically

### Production Environment
- **Frontend**: Served as static files from `/client/build`
- **Backend**: Same port as development (configurable via PORT env var)
- **Static Files**: Same static serving configuration

## API Endpoints Documentation

All API endpoints are prefixed with `/api/` and most require authentication via JWT token.

### 1. Authentication Routes (`/api/auth`)

#### User Registration & Authentication
- **POST** `/api/auth/register`
  - Creates a new user account with email verification
  - Body: `{ email, password, firstName, lastName }`
  - Returns: User object and JWT token

- **POST** `/api/auth/login`
  - Authenticates user credentials and returns JWT token
  - Body: `{ email, password }`
  - Returns: User object and JWT token

- **POST** `/api/auth/logout`
  - Logs out the current user (clears session)
  - Requires: Authentication
  - Returns: Success message

- **GET** `/api/auth/me`
  - Retrieves current authenticated user profile
  - Requires: Authentication
  - Returns: User profile object

- **GET** `/api/auth/verify`
  - Verifies JWT token validity
  - Requires: Authentication
  - Returns: Token verification status

#### Password Management
- **POST** `/api/auth/forgot-password`
  - Initiates password reset process via email
  - Body: `{ email }`
  - Returns: Success message

- **POST** `/api/auth/reset-password`
  - Resets password using reset token from email
  - Body: `{ token, newPassword }`
  - Returns: Success message

- **POST** `/api/auth/change-password`
  - Changes password for authenticated user
  - Requires: Authentication
  - Body: `{ currentPassword, newPassword }`
  - Returns: Success message

#### Email Verification
- **POST** `/api/auth/send-verification`
  - Sends email verification link to user
  - Requires: Authentication
  - Returns: Success message

- **POST** `/api/auth/verify-email`
  - Verifies email using token from verification email
  - Body: `{ token }`
  - Returns: Success message

#### Profile Management
- **PUT** `/api/auth/profile`
  - Updates user profile information
  - Requires: Authentication
  - Body: Profile fields to update
  - Returns: Updated user object

- **POST** `/api/auth/verify-email-change`
  - Verifies email change using token
  - Body: `{ token }`
  - Returns: Success message

### 2. User Management Routes (`/api/users`)

#### Profile Operations
- **GET** `/api/users/profile`
  - Retrieves user profile with additional details
  - Requires: Authentication
  - Returns: Detailed user profile object

- **PUT** `/api/users/profile`
  - Updates comprehensive user profile information
  - Requires: Authentication
  - Body: Profile update fields
  - Returns: Updated profile object

- **PUT** `/api/users/password`
  - Changes user password with current password verification
  - Requires: Authentication
  - Body: `{ currentPassword, newPassword }`
  - Returns: Success message

- **DELETE** `/api/users/account`
  - Permanently deletes user account and all associated data
  - Requires: Authentication
  - Returns: Success message

### 3. Transaction Routes (`/api/transactions`)

#### CRUD Operations
- **GET** `/api/transactions`
  - Retrieves transactions with advanced filtering and pagination
  - Requires: Authentication
  - Query parameters:
    - `year` - Filter by year
    - `month` - Filter by month
    - `flow_month` - Filter by flow month (YYYY-MM)
    - `cash_flow_id` - Filter by cash flow
    - `category_id` - Filter by category
    - `page` - Page number for pagination
    - `per_page` - Results per page
    - `q` - Search query for description
    - `notes` - Search in notes field
    - `no_category` - Show uncategorized transactions
    - `show_all` - Bypass pagination
  - Returns: Paginated transactions array with metadata

- **GET** `/api/transactions/:id`
  - Retrieves specific transaction by ID
  - Requires: Authentication
  - Returns: Transaction object

- **POST** `/api/transactions`
  - Creates new transaction entry
  - Requires: Authentication
  - Body: Transaction object with required fields
  - Returns: Created transaction object

- **PUT** `/api/transactions/:id`
  - Updates existing transaction
  - Requires: Authentication
  - Body: Transaction fields to update
  - Returns: Updated transaction object

- **DELETE** `/api/transactions/:id`
  - Deletes specific transaction
  - Requires: Authentication
  - Returns: Success message

#### Batch Operations
- **PATCH** `/api/transactions/batch`
  - Updates multiple transactions simultaneously
  - Requires: Authentication
  - Body: `{ transactionIds: [], updateData: {} }`
  - Returns: Success message with count

- **DELETE** `/api/transactions/batch`
  - Deletes multiple transactions simultaneously
  - Requires: Authentication
  - Body: `{ transactionIds: [] }`
  - Returns: Success message with count

#### Flow Month Operations
- **PATCH** `/api/transactions/:id/flow-month`
  - Updates flow month for specific transaction
  - Requires: Authentication
  - Body: `{ flowMonth: "YYYY-MM" }`
  - Returns: Updated transaction

#### Analytics
- **GET** `/api/transactions/analytics/by-category`
  - Retrieves transactions grouped by category for analytics
  - Requires: Authentication
  - Returns: Category-grouped transaction data

- **GET** `/api/transactions/analytics/stats`
  - Retrieves transaction statistics and summaries
  - Requires: Authentication
  - Returns: Statistical data object

#### Duplicate Detection
- **GET** `/api/transactions/duplicates`
  - Identifies potential duplicate transactions
  - Requires: Authentication
  - Returns: Array of potential duplicates

#### Legacy API Compatibility
- **POST** `/api/transactions/api/transactions/record-as-income`
  - Records transaction as income in different cash flow
  - Requires: Authentication
  - Returns: Success message

- **GET** `/api/transactions/api/transactions/unique_categories`
  - Retrieves list of unique category names
  - Requires: Authentication
  - Returns: Array of category names

- **POST** `/api/transactions/api/transactions/batch_categorize`
  - Applies category to multiple transactions
  - Requires: Authentication
  - Body: Categorization rules
  - Returns: Success message

- **POST** `/api/transactions/api/transactions/delete_by_cash_flow`
  - Deletes all transactions belonging to specific cash flow
  - Requires: Authentication
  - Body: `{ cashFlowId }`
  - Returns: Success message

### 4. Category Routes (`/api/categories`)

#### Basic Operations
- **GET** `/api/categories`
  - Retrieves all user categories with optional type filtering
  - Requires: Authentication
  - Returns: Array of category objects

- **GET** `/api/categories/type/:type`
  - Retrieves categories filtered by type (income/expense)
  - Requires: Authentication
  - Returns: Array of filtered categories

- **GET** `/api/categories/default`
  - Retrieves system default categories
  - Requires: Authentication
  - Returns: Array of default categories

- **POST** `/api/categories`
  - Creates new category
  - Requires: Authentication
  - Body: Category object with name, type, etc.
  - Returns: Created category object

- **PUT** `/api/categories/:id`
  - Updates existing category
  - Requires: Authentication
  - Body: Category fields to update
  - Returns: Updated category object

- **DELETE** `/api/categories/:id`
  - Deletes category (moves transactions to uncategorized)
  - Requires: Authentication
  - Returns: Success message

#### Category Transactions
- **GET** `/api/categories/:id/transactions`
  - Retrieves category with associated transactions
  - Requires: Authentication
  - Returns: Category object with transactions array

#### Category Management
- **GET** `/api/categories/order`
  - Retrieves category display order settings
  - Requires: Authentication
  - Returns: Category order configuration

- **POST** `/api/categories/reorder`
  - Updates category display order
  - Requires: Authentication
  - Body: `{ categoryOrders: [] }`
  - Returns: Success message

- **POST** `/api/categories/update-shared-category`
  - Updates shared category properties
  - Requires: Authentication
  - Body: Shared category data
  - Returns: Updated category

- **POST** `/api/categories/update-weekly-display`
  - Updates weekly display setting for category
  - Requires: Authentication
  - Body: `{ categoryId, weeklyDisplay }`
  - Returns: Success message

#### Business Mappings
- **GET** `/api/categories/business-mappings`
  - Retrieves business-to-category automatic mappings
  - Requires: Authentication
  - Returns: Mapping rules array

- **POST** `/api/categories/import-mappings`
  - Imports category mappings from CSV file
  - Requires: Authentication
  - Body: CSV data with mappings
  - Returns: Import results

#### Monthly Targets
- **POST** `/api/categories/calculate-monthly-target`
  - Calculates suggested monthly target based on historical spending
  - Requires: Authentication
  - Body: `{ categoryId }`
  - Returns: Calculated target amount

- **POST** `/api/categories/update-monthly-target`
  - Updates monthly spending target for category
  - Requires: Authentication
  - Body: `{ categoryId, monthlyTarget }`
  - Returns: Success message

- **GET** `/api/categories/monthly-spending/:categoryName`
  - Retrieves current month spending data for category
  - Requires: Authentication
  - Returns: Spending data object

- **GET** `/api/categories/spending-history/:categoryName`
  - Retrieves historical spending data for category visualization
  - Requires: Authentication
  - Returns: Historical spending array

- **GET** `/api/categories/should-refresh-targets`
  - Checks if monthly targets need refreshing for new month
  - Requires: Authentication
  - Returns: Boolean refresh status

- **POST** `/api/categories/refresh-monthly-targets`
  - Refreshes all monthly targets for new month
  - Requires: Authentication
  - Returns: Success message

### 5. Budget Routes (`/api/budgets`)

#### Budget Management
- **GET** `/api/budgets`
  - Retrieves all user budgets
  - Requires: Authentication
  - Returns: Array of budget objects

- **GET** `/api/budgets/monthly/:year/:month`
  - Retrieves monthly budgets for specific period
  - Requires: Authentication
  - Returns: Monthly budget objects

- **POST** `/api/budgets`
  - Creates or updates budget
  - Requires: Authentication
  - Body: Budget object with amount, category, period
  - Returns: Created/updated budget object

- **POST** `/api/budgets/monthly`
  - Creates or updates monthly budget
  - Requires: Authentication
  - Body: Monthly budget data
  - Returns: Monthly budget object

#### Budget Queries
- **GET** `/api/budgets/category/:categoryId`
  - Retrieves budget for specific category
  - Requires: Authentication
  - Returns: Category budget object

- **GET** `/api/budgets/monthly/:year/:month/:categoryId`
  - Retrieves monthly budget for specific category and period
  - Requires: Authentication
  - Returns: Monthly category budget

- **DELETE** `/api/budgets/:id`
  - Deletes budget
  - Requires: Authentication
  - Returns: Success message

- **DELETE** `/api/budgets/monthly/:id`
  - Deletes monthly budget
  - Requires: Authentication
  - Returns: Success message

#### Analytics
- **GET** `/api/budgets/category/:categoryId/average/:year/:month`
  - Calculates average spending for category to suggest budget
  - Requires: Authentication
  - Returns: Average spending data

### 6. Cash Flow Routes (`/api/cashflows`)

#### Cash Flow Management
- **GET** `/api/cashflows`
  - Retrieves all user cash flows (accounts/credit cards)
  - Requires: Authentication
  - Returns: Array of cash flow objects

- **GET** `/api/cashflows/default`
  - Retrieves user's default cash flow
  - Requires: Authentication
  - Returns: Default cash flow object

- **POST** `/api/cashflows`
  - Creates new cash flow (bank account, credit card, etc.)
  - Requires: Authentication
  - Body: Cash flow object with name, type, etc.
  - Returns: Created cash flow object

- **PUT** `/api/cashflows/:id`
  - Updates existing cash flow
  - Requires: Authentication
  - Body: Cash flow fields to update
  - Returns: Updated cash flow object

- **PUT** `/api/cashflows/:id/default`
  - Sets cash flow as user's default
  - Requires: Authentication
  - Returns: Success message

- **DELETE** `/api/cashflows/:id`
  - Deletes cash flow and associated transactions
  - Requires: Authentication
  - Returns: Success message

### 7. Reports Routes (`/api/reports`)

#### Report Generation
- **GET** `/api/reports/monthly/:year/:month`
  - Generates comprehensive monthly financial report
  - Requires: Authentication
  - Returns: Monthly report with income/expense breakdowns

- **GET** `/api/reports/yearly/:year`
  - Generates yearly financial summary report
  - Requires: Authentication
  - Returns: Yearly report with trends and comparisons

- **GET** `/api/reports/category-trends/:categoryId`
  - Analyzes spending trends for specific category
  - Requires: Authentication
  - Returns: Trend analysis data

- **GET** `/api/reports/cash-flows-comparison/:year/:month`
  - Compares performance across different cash flows
  - Requires: Authentication
  - Returns: Cash flow comparison data

- **GET** `/api/reports/monthly-balance`
  - Retrieves monthly balance data for chart visualization
  - Requires: Authentication
  - Returns: Balance progression data

### 8. File Upload Routes (`/api/upload`)

#### Multi-step Upload Process
- **POST** `/api/upload/initiate`
  - Initiates file upload and begins processing
  - Requires: Authentication
  - Body: FormData with file and metadata
  - Returns: Upload session ID and initial progress

- **GET** `/api/upload/progress/:uploadId`
  - Retrieves upload progress via JSON API
  - Requires: Authentication
  - Returns: Progress percentage and status

- **POST** `/api/upload/check-duplicates`
  - Checks for duplicate transactions in selected currency
  - Requires: Authentication
  - Body: Currency selection and upload data
  - Returns: Duplicate detection results

- **POST** `/api/upload/finalize`
  - Finalizes import process and saves to database
  - Requires: Authentication
  - Body: Final import confirmation data
  - Returns: Import completion status

#### Duplicate Handling
- **GET** `/api/upload/duplicates/:tempId`
  - Retrieves duplicate transaction data for user review
  - Requires: Authentication
  - Returns: Duplicate transactions array

- **POST** `/api/upload/handle-duplicates`
  - Processes user decisions on duplicate transactions
  - Requires: Authentication
  - Body: Duplicate resolution decisions
  - Returns: Processing results

#### Legacy Upload
- **POST** `/api/upload/transactions`
  - Legacy single-step upload and process for Excel/CSV files
  - Requires: Authentication
  - Body: FormData with file
  - Returns: Processing results

- **POST** `/api/upload/blink-stocks`
  - Processes Blink Excel file specifically for stock transactions
  - Requires: Authentication
  - Body: FormData with Blink file
  - Returns: Stock transaction processing results

#### Bank Yahav Specific Processing
- **POST** `/api/upload/bank-yahav/process`
  - Initiates Bank Yahav file processing with multi-step workflow
  - Requires: Authentication
  - Body: FormData with Bank Yahav .xls/.xlsx file and cash_flow_id
  - Returns: Upload session ID, currency groups, and duplicate detection results
  - Features: Dynamic header detection, multi-sheet processing, Hebrew text support

- **GET** `/api/upload/bank-yahav/currency-groups/:uploadId`
  - Retrieves Bank Yahav currency groups for user review
  - Requires: Authentication
  - Returns: Currency groups with transaction counts, date ranges, and sample transactions

- **POST** `/api/upload/bank-yahav/select-currencies`
  - Processes user currency selection and re-checks duplicates
  - Requires: Authentication
  - Body: { uploadId, selectedCurrencies: ["ILS", "USD"] }
  - Returns: Selected transaction count and duplicate detection results

- **GET** `/api/upload/bank-yahav/duplicates/:uploadId`
  - Retrieves Bank Yahav duplicate transactions for user review
  - Requires: Authentication
  - Returns: Duplicate groups with existing and new transaction details

- **POST** `/api/upload/bank-yahav/import`
  - Finalizes Bank Yahav import with user duplicate resolutions
  - Requires: Authentication
  - Body: { uploadId, duplicateResolutions: { "hash": "import|skip|replace" } }
  - Returns: Import results with success, duplicate, error, and skipped counts

#### File Formats & Templates
- **GET** `/api/upload/formats`
  - Retrieves list of supported file formats and their specifications
  - Requires: Authentication
  - Returns: File format specifications

- **GET** `/api/upload/templates/:bank`
  - Downloads template or example file for specific bank format
  - Requires: Authentication
  - Returns: Template file download

#### Currency Groups
- **GET** `/api/upload/review_currency_groups/:temp_id`
  - Retrieves currency groups data for user review
  - Requires: Authentication
  - Returns: Currency grouping data

- **POST** `/api/upload/handle_currency_groups`
  - Processes user decisions on currency group separation
  - Requires: Authentication
  - Body: Currency group decisions
  - Returns: Processing results

- **GET** `/api/upload/currency_groups_progress/:temp_id/stream`
  - Real-time progress tracking with Server-Sent Events
  - Requires: Authentication
  - Returns: SSE stream with progress updates

- **GET** `/api/upload/currency_groups_progress/:temp_id`
  - Retrieves currency groups processing progress as JSON
  - Requires: Authentication
  - Returns: Progress status object

#### Export Functionality
- **GET** `/api/upload/export/transactions`
  - Exports user transactions to Excel file
  - Requires: Authentication
  - Query parameters: Date ranges, filters
  - Returns: Excel file download

- **GET** `/api/upload/export/cash-flow-data`
  - Exports all data for a specific cash flow to Excel file
  - Requires: Authentication
  - Query parameters: `cash_flow_id` (required)
  - Returns: Multi-sheet Excel file with transactions, categories, monthly summary, and budgets
  - File includes: All transactions, category spending analysis, monthly summaries, and budget information
  - Generated filename format: `נתוני_תזרים_{cashFlowName}_{date}.xlsx`

- **POST** `/api/upload/process-single-for-export`
  - Processes single file for export with currency separation
  - Requires: Authentication
  - Body: File and processing options
  - Returns: Processed data for export

- **POST** `/api/upload/process-for-export`
  - Processes uploaded file for export functionality
  - Requires: Authentication
  - Body: File and export settings
  - Returns: Export-ready data

- **POST** `/api/upload/create-merged-excel`
  - Creates merged BudgetLens Excel file from multiple sources
  - Requires: Authentication
  - Body: Merge configuration
  - Returns: Merged Excel file

#### Utility Routes
- **GET** `/api/upload/history`
  - Retrieves upload history and statistics for user
  - Requires: Authentication
  - Returns: Upload history array

- **POST** `/api/upload/migrate_transaction_hashes`
  - Utility to migrate existing transactions to add transaction_hash field
  - Requires: Authentication
  - Returns: Migration results

- **GET** `/api/upload/distinct-source-types`
  - Retrieves distinct source types for dropdown population
  - Requires: Authentication
  - Returns: Array of source types

- **GET** `/api/upload/distinct-payment-methods`
  - Retrieves distinct payment methods for dropdown population
  - Requires: Authentication
  - Returns: Array of payment methods

### 9. Stock Routes (`/api/stocks`)

#### Portfolio & Holdings
- **GET** `/api/stocks/dashboard`
  - Retrieves comprehensive stock portfolio dashboard data
  - Requires: Authentication
  - Returns: Portfolio summary, performance, holdings

- **GET** `/api/stocks/holdings`
  - Retrieves user's current stock holdings
  - Requires: Authentication
  - Returns: Holdings array with current values

- **GET** `/api/stocks/portfolio-summary`
  - Retrieves portfolio performance summary
  - Requires: Authentication
  - Returns: Total value, gains/losses, percentages

- **POST** `/api/stocks/holdings`
  - Adds or updates a stock holding
  - Requires: Authentication
  - Body: Holding data with symbol, quantity, price
  - Returns: Updated holding object

#### Transactions & History
- **GET** `/api/stocks/transactions`
  - Retrieves complete stock transaction history
  - Requires: Authentication
  - Returns: Transaction history array

- **GET** `/api/stocks/recent-transactions`
  - Retrieves recent stock transactions for quick overview
  - Requires: Authentication
  - Returns: Recent transactions array

#### Stock Prices & Data
- **POST** `/api/stocks/update-prices`
  - Updates stock prices for user's entire portfolio
  - Requires: Authentication
  - Returns: Price update results

- **GET** `/api/stocks/chart-data/:symbol`
  - Retrieves historical chart data for specific stock
  - Requires: Authentication
  - Returns: Chart data points array

- **GET** `/api/stocks/price/:symbol`
  - Retrieves current price for specific stock symbol
  - Requires: Authentication
  - Returns: Current price object

- **GET** `/api/stocks/prices-from-db/:symbol`
  - Retrieves latest cached price from database
  - Requires: Authentication
  - Returns: Cached price data

- **POST** `/api/stocks/refresh-prices`
  - Refreshes current prices for multiple symbols
  - Requires: Authentication
  - Body: Array of symbols
  - Returns: Updated prices

- **GET** `/api/stocks/current-prices`
  - Retrieves current prices for all user's stocks from database
  - Requires: Authentication
  - Returns: All current prices object

- **POST** `/api/stocks/update-all-prices`
  - Updates historical prices for all user's stocks
  - Requires: Authentication
  - Returns: Bulk update results

#### Alerts & Watchlist
- **GET** `/api/stocks/alerts`
  - Retrieves user's active stock price alerts
  - Requires: Authentication
  - Returns: Alerts array

- **POST** `/api/stocks/alerts`
  - Creates new stock price alert
  - Requires: Authentication
  - Body: Alert configuration
  - Returns: Created alert object

- **GET** `/api/stocks/watchlist`
  - Retrieves user's stock watchlist
  - Requires: Authentication
  - Returns: Watchlist array

- **POST** `/api/stocks/watchlist`
  - Adds stock to user's watchlist
  - Requires: Authentication
  - Body: `{ symbol, name }`
  - Returns: Updated watchlist

- **DELETE** `/api/stocks/watchlist/:symbol`
  - Removes stock from watchlist
  - Requires: Authentication
  - Returns: Success message

#### Blink Integration
- **POST** `/api/stocks/process-blink`
  - Processes uploaded Blink Excel file for stock transactions
  - Requires: Authentication
  - Body: FormData with Blink file
  - Returns: Processing results

- **POST** `/api/stocks/sync-blink-transactions`
  - Synchronizes Blink transactions to create/update stock holdings
  - Requires: Authentication
  - Body: Sync configuration
  - Returns: Sync results

- **POST** `/api/stocks/process-blink-screenshot`
  - Processes Blink screenshot using OpenAI GPT-4 Vision
  - Requires: Authentication
  - Body: FormData with screenshot image
  - Returns: Extracted data from screenshot

- **POST** `/api/stocks/import-blink-transactions`
  - Imports confirmed Blink transactions to database
  - Requires: Authentication
  - Body: Confirmed transaction data
  - Returns: Import results

#### Utilities
- **POST** `/api/stocks/migrate-holdings`
  - Utility to migrate holdings from transactions table
  - Requires: Authentication
  - Returns: Migration results

- **POST** `/api/stocks/update-symbol/:symbol`
  - Updates price data for specific symbol
  - Requires: Authentication
  - Returns: Update results

- **GET** `/api/stocks/market-summary`
  - Retrieves general market summary information
  - Requires: Authentication
  - Returns: Market summary data

- **GET** `/api/stocks/investment-cash-flows`
  - Retrieves investment-related cash flows for user
  - Requires: Authentication
  - Returns: Investment cash flows array

- **GET** `/api/stocks/service-status`
  - Checks status of stock price data services
  - Requires: Authentication
  - Returns: Service status object

### 10. Alerts Routes (`/api/alerts`)

#### Alert Management
- **GET** `/api/alerts`
  - Retrieves all alerts for authenticated user
  - Requires: Authentication
  - Returns: User's alerts array

- **POST** `/api/alerts`
  - Creates new alert with specified criteria
  - Requires: Authentication
  - Body: Alert configuration object
  - Returns: Created alert object

- **PUT** `/api/alerts/:id`
  - Updates existing alert configuration
  - Requires: Authentication
  - Body: Alert fields to update
  - Returns: Updated alert object

- **DELETE** `/api/alerts/:id`
  - Deletes specified alert
  - Requires: Authentication
  - Returns: Success message

### 11. Dashboard Routes (`/api/dashboard`)

#### Dashboard Data
- **GET** `/api/dashboard`
  - Retrieves main dashboard data with financial overview
  - Requires: Authentication
  - Query parameters:
    - `flow_month` - Specific flow month filter (YYYY-MM)
    - `cash_flow` - Cash flow ID filter
    - `all_time` - Include all-time data
    - `year` - Specific year filter
    - `month` - Specific month filter
    - `format` - Response format preference
  - Returns: Dashboard data object with summaries, charts, recent transactions

- **POST** `/api/dashboard/api/change_flow_month`
  - Updates flow month for dashboard transactions
  - Requires: Authentication
  - Body: Flow month change data
  - Returns: Update results

- **GET** `/api/dashboard/month/:year/:month`
  - Retrieves dashboard data for specific month navigation
  - Requires: Authentication
  - Returns: Month-specific dashboard data

### 12. Monthly Goals Routes (`/api/monthly-goals`)

#### Goal Management
- **GET** `/api/monthly-goals/:year/:month`
  - Retrieves monthly financial goal for specified period
  - Requires: Authentication
  - Returns: Monthly goal object

- **POST** `/api/monthly-goals`
  - Creates or updates monthly financial goal
  - Requires: Authentication
  - Body: `{ year, month, targetAmount, description }`
  - Returns: Created/updated goal object

- **DELETE** `/api/monthly-goals/:year/:month`
  - Deletes monthly goal for specified period
  - Requires: Authentication
  - Returns: Success message

## Frontend Routes (React Router)

The React application uses client-side routing with the following main routes:

### Public Routes (No Authentication Required)
- `/login` - User login page
- `/register` - User registration page  
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset with token
- `/verify-email` - Email verification with token

### Protected Routes (Authentication Required)
- `/` - Dashboard home page
- `/transactions` - Transaction management page
- `/upload` - File upload and processing
- `/categories` - Category management
- `/profile` - User profile settings
- `/reports` - Financial reports and analytics
- `/stocks` - Stock portfolio management
- `/stocks/dashboard` - Stock dashboard
- `/stocks/transactions` - Stock transaction history
- `/stocks/alerts` - Stock price alerts

## Authentication & Security

### Authentication Flow
1. User registers/logs in with email and password
2. Server generates JWT token containing user ID and expiration
3. Client stores JWT token (localStorage/cookies)
4. Client includes token in Authorization header for API requests
5. Server validates token on protected routes using `authenticateToken` middleware

### Security Measures
- **Helmet.js**: Security headers and CSP configuration
- **Rate Limiting**: 500 requests per 15-minute window
- **CORS**: Configured for specific origins
- **Password Hashing**: bcryptjs with salt rounds
- **JWT Tokens**: Signed tokens with expiration
- **Input Validation**: Server-side validation on all endpoints
- **File Upload Security**: File type and size restrictions
- **Session Management**: Express sessions with security options

### Environment Variables
- `JWT_SECRET` - Secret key for signing JWT tokens
- `SESSION_SECRET` - Secret for session encryption
- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Server port (default: 5001)
- `FRONTEND_URL` - Frontend URL for CORS in production
- `SUPABASE_URL` - Supabase database URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key

## Database Schema

### Core Tables
- **users** - User accounts and profiles
- **cash_flows** - Bank accounts, credit cards, cash accounts
- **categories** - Expense and income categories
- **transactions** - Financial transactions
- **budgets** - Budget definitions and limits
- **monthly_budgets** - Month-specific budget entries
- **monthly_goals** - Monthly financial goals
- **category_order** - Category display order preferences

### Stock System Tables
- **stock_holdings** - Current stock positions
- **stock_transactions** - Stock buy/sell history
- **stock_prices** - Historical stock price data
- **stock_alerts** - Price alert configurations
- **watchlist** - User stock watchlists

## File Processing

### Supported File Formats
- **Excel** (.xlsx, .xls) - Bank statements, Blink reports
- **CSV** - Bank exports, transaction data
- **Images** (.png, .jpg) - Blink screenshots for OCR processing

### Upload Process Flow
1. File upload validation (size, type, authentication)
2. File parsing and data extraction
3. Currency detection and grouping
4. Duplicate detection against existing transactions
5. User review and confirmation
6. Data transformation and categorization
7. Database insertion with transaction hashing

### Processing Features
- **Multi-currency Support** - Automatic currency detection and grouping
- **Duplicate Prevention** - Hash-based duplicate detection
- **Bank Format Recognition** - Support for multiple bank statement formats
- **OCR Processing** - OpenAI GPT-4 Vision for screenshot text extraction
- **Progress Tracking** - Real-time progress updates via SSE and polling

## External Integrations

### Stock Price Services
- **Alpha Vantage** - Real-time and historical stock prices
- **Yahoo Finance** - Alternative price data source
- **Market Data APIs** - General market information

### Email Service
- **Brevo (Sendinblue)** - Transactional emails for:
  - Welcome emails
  - Email verification
  - Password reset
  - Account notifications

### AI Services
- **OpenAI GPT-4 Vision** - Screenshot text extraction and processing

## Deployment Configuration

### Production Build Process
1. `npm run build` - Builds React frontend
2. Static files served from `client/build`
3. Express serves both API and static assets
4. Single port deployment (backend serves frontend)

### Environment Setup
- Development: Separate frontend (port 3000/4000) and backend (5001)
- Production: Unified deployment on single port
- Environment-specific CORS and security configurations

## Logging & Monitoring

### Log Files
- `logs/app.log` - General application logs
- `logs/upload.log` - File upload and processing logs
- Console logging with Morgan middleware

### Error Handling
- Global error handling middleware
- Environment-specific error detail exposure
- Structured error responses with status codes

## API Response Formats

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information (development only)"
}
```

### Pagination Response
```json
{
  "data": [ /* paginated results */ ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

This comprehensive documentation covers all major aspects of the BudgetLens application including its architecture, API endpoints, authentication, security, and deployment considerations.