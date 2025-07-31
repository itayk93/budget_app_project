# Project Structure - Budget App

This document provides a complete overview of all files and directories in the budget app project.

## Root Directory
```
/Users/itaykarkason/Python Projects/budget_app_project/
```

## Project Architecture
This is a **full-stack Node.js/React application** using **Supabase** as the database backend.

## Project Files Structure

### Configuration & Documentation Files
- `.DS_Store` - macOS system file
- `.env` - Environment variables configuration (includes Supabase credentials)
- `.gitignore` - Git ignore rules
- `CLAUDE.md` - Claude AI instructions and guidelines
- `FEATURES.md` - Feature documentation
- `PROJECT_DOCUMENTATION.md` - Comprehensive project documentation
- `README.md` - Project readme file
- `package.json` - Server-side NPM configuration
- `package-lock.json` - Server-side NPM lock file

### Database & Migrations
- `budget_db.sqlite` - Legacy SQLite file (not used - project uses Supabase)
- `check_tables.js` - Database table verification script
- `migrate_hashes.js` - Database migration script

#### SQL Files (`/sql/`)
- `add_email_verification_columns.sql` - Email verification schema
- `add_monthly_target_column.sql` - Monthly target functionality
- `add_monthly_targets_last_update_column.sql` - Target update tracking
- `add_quantity_column_to_transactions.sql` - Transaction quantity field
- `add_source_category_column.sql` - Source category tracking
- `add_weekly_display_column.sql` - Weekly display options
- `create_category_order_table.sql` - Category ordering system
- `create_monthly_goals_table.sql` - Monthly goals feature
- `create_stock_alerts_table.sql` - Stock alert system
- `create_stock_system_tables.sql` - Complete stock system
- `initialize_monthly_targets.sql` - Monthly target initialization

#### Database Migrations (`/database_migrations/`)
- `add_shared_category_targets.sql` - Shared category targets feature

### Server Application (`/server/`)

#### Main Server File
- `index.js` - Express.js server entry point

#### Configuration (`/server/config/`)
- `supabase.js` - Supabase client configuration and connection

#### Middleware (`/server/middleware/`)
- `auth.js` - Authentication middleware for protected routes

#### API Routes (`/server/routes/`)
- `alerts.js` - Stock alerts management
- `auth.js` - Authentication endpoints (login, register, etc.)
- `budgets.js` - Budget management endpoints
- `cashflows.js` - Cash flow tracking endpoints
- `categories.js` - Category management endpoints
- `dashboard.js` - Dashboard data endpoints
- `monthlyGoals.js` - Monthly goals management
- `reports.js` - Financial reports generation
- `stocks.js` - Stock portfolio management
- `transactions.js` - Transaction CRUD operations
- `upload.js` - File upload handling
- `users.js` - User management endpoints

#### Services (`/server/services/`)
- `alphaVantageService.js` - Alpha Vantage API integration for stock data
- `blinkProcessor.js` - Bank statement processing (Blink integration)
- `blinkScreenshotService.js` - Screenshot processing for bank data
- `comprehensiveExcelService.js` - Comprehensive Excel file processing
- `emailService.js` - Email notification service (Brevo integration)
- `excelService.js` - Excel file import/export functionality
- `financialFileService.js` - Financial file processing
- `stockPriceService.js` - Stock price tracking service
- `stockService.js` - Stock portfolio management service
- `supabaseService.js` - Main Supabase database service layer
- `tokenService.js` - JWT token management
- `transactionBasedStockService.js` - Transaction-based stock tracking
- `workingExcelService.js` - Working Excel processing service
- `yahooFinanceService.js` - Yahoo Finance API integration

#### Utilities (`/server/utils/`)
- `logger.js` - Application logging utility

### New Features (`/new_features/`)
- `monthly_goal_feature.md` - Monthly goals feature specification

### Client Application (`/client/`)

#### Root Files
- `package.json` - NPM package configuration
- `package-lock.json` - NPM lock file
- `public/` - Static assets directory
  - `favicon.svg` - Website favicon
  - `index.html` - Main HTML file
  - `logo.svg` - Application logo
  - `manifest.json` - Web app manifest

#### Source Code (`/client/src/`)
- `index.js` - Main React entry point
- `App.js` - Main React component
- `index.css` - Global styles
- `App.css` - App component styles
- `reportWebVitals.js` - Performance monitoring

#### Components (`/client/src/components/`)
- `AddExpense.js` - Add expense form component
- `AddExpense.css` - Add expense component styles
- `BudgetGraph.js` - Budget visualization component
- `ExpenseList.js` - Expense list display component
- `ExpenseList.css` - Expense list component styles
- `ExpensesByCategory.js` - Category-based expense view
- `ExpensesByCategory.css` - Category expenses component styles
- `ExpenseFilter.js` - Expense filtering component
- `ExpenseFilter.css` - Expense filter component styles
- `Header.js` - Application header component
- `Header.css` - Header component styles
- `IncomeTracker.js` - Income tracking component
- `IncomeTracker.css` - Income tracker component styles
- `MonthlyBudget.js` - Monthly budget management component
- `MonthlyBudget.css` - Monthly budget component styles
- `Navigation.js` - Navigation menu component
- `Navigation.css` - Navigation component styles
- `SavingsGoals.js` - Savings goals component
- `SavingsGoals.css` - Savings goals component styles

#### Utilities (`/client/src/utils/`)
- `api.js` - API communication utilities

#### Build Output (`/client/build/`)
- `asset-manifest.json` - Build assets manifest
- `favicon.svg` - Built favicon
- `index.html` - Built main HTML file
- `logo.svg` - Built logo
- `static/` - Built static assets
  - `css/` - Compiled CSS files
    - `main.d67bd1bc.css` - Main CSS bundle
    - `main.d67bd1bc.css.map` - CSS source map
  - `js/` - Compiled JavaScript files
    - `main.4b5469de.js` - Main JavaScript bundle
    - `main.4b5469de.js.LICENSE.txt` - License file
    - `main.4b5469de.js.map` - JavaScript source map

#### Node Modules (`/client/node_modules/`)
The `node_modules` directory contains thousands of dependency files and cache files. Due to the extensive nature of this directory, individual files are not listed here, but it includes:
- All NPM package dependencies
- Babel loader cache files (`.cache/babel-loader/`)
- Various package directories for React, build tools, and other dependencies

### Total Project Size
The project contains several thousand files when including all node_modules dependencies, build artifacts, and cache files. The core application files (excluding node_modules and build artifacts) consist of approximately 30-40 files.

## Key Technologies Used
- **Backend**: Node.js with Express.js
- **Frontend**: React.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT tokens
- **External APIs**: Alpha Vantage, Yahoo Finance, Brevo Email
- **File Processing**: Excel import/export, Bank statement processing

## Key Directories Summary
1. **Root** - Configuration, documentation, and legacy database files
2. **Server** - Node.js/Express.js backend API with Supabase integration
3. **Client** - React frontend application
4. **SQL** - Database schema and migration files
5. **New Features** - Feature specifications and documentation

## Database Architecture
The application uses **Supabase** (PostgreSQL) as the primary database with tables for:
- Users and authentication
- Transactions and categories  
- Budgets and monthly goals
- Stock portfolio and alerts
- Cash flow tracking