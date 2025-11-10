# Database Schema

The database schema is designed to support a personal finance and budget management application. It includes tables for managing categories, goals, stocks, and scraped bank transactions.

## Core Tables

### `transactions` (Implicit)
While not explicitly defined in the provided SQL files, a `transactions` table is referenced by other tables (e.g., `stock_transactions_summary`). This table likely stores all financial transactions, including purchases, income, and expenses.

### `users` (Implicit)
A `users` table (likely `auth.users` from Supabase) is referenced by many tables. It stores user information and is the primary key for data ownership.

### `cash_flows` (Implicit)
A `cash_flows` table is referenced, suggesting that users can manage multiple financial contexts or accounts (e.g., personal, business).

## Main Tables

### `category_order`
- **Purpose:** Stores the user-defined order for displaying categories.
- **Key Columns:** `user_id`, `category_name`, `display_order`.
- **Relationships:** Linked to a user.

### `monthly_goals`
- **Purpose:** Stores monthly savings goals for users.
- **Key Columns:** `user_id`, `cash_flow_id`, `year`, `month`, `amount`.
- **Relationships:** Linked to a user and a cash flow.

### `user_empty_categories_display`
- **Purpose:** Tracks which empty categories a user wants to display for a specific month.
- **Key Columns:** `user_id`, `cash_flow_id`, `category_name`, `year`, `month`.
- **Relationships:** Linked to a user and a cash flow.

## Stock Management

### `stocks`
- **Purpose:** Stores basic information about stocks (e.g., symbol, company name).
- **Key Columns:** `symbol`, `company_name`, `sector`.

### `stock_holdings`
- **Purpose:** Tracks the stocks a user currently holds.
- **Key Columns:** `user_id`, `stock_symbol`, `quantity`, `average_cost`.
- **Relationships:** Linked to a user and a stock.

### `stock_prices`
- **Purpose:** Stores historical price data for stocks.
- **Key Columns:** `stock_symbol`, `price_date`, `close_price`.
- **Relationships:** Linked to a stock.

### `stock_transactions_summary`
- **Purpose:** A clean summary of stock-related transactions (buy, sell, dividend).
- **Key Columns:** `user_id`, `stock_symbol`, `transaction_type`, `quantity`, `price_per_share`.
- **Relationships:** Linked to a user and a stock.

### `stock_alerts`
- **Purpose:** Stores user-defined alerts for stocks (e.g., price targets).
- **Key Columns:** `user_id`, `stock_symbol`, `alert_type`, `target_value`.
- **Relationships:** Linked to a user and a stock.

### `stock_alert_history`
- **Purpose:** Logs triggered stock alerts.
- **Key Columns:** `alert_id`, `user_id`, `triggered_at`.
- **Relationships:** Linked to a stock alert and a user.

### `daily_portfolio_performance`
- **Purpose:** Stores daily snapshots of a user's portfolio performance.
- **Key Columns:** `user_id`, `performance_date`, `total_market_value`, `total_gain_loss`.
- **Relationships:** Linked to a user.

### `watchlist`
- **Purpose:** Stores stocks that a user wants to track without necessarily owning them.
- **Key Columns:** `user_id`, `stock_symbol`.
- **Relationships:** Linked to a user and a stock.

## Bank Scraper

### `bank_scraper_configs`
- **Purpose:** Stores configurations for connecting to bank accounts via a scraper.
- **Key Columns:** `user_id`, `bank_type`, `credentials_encrypted`.
- **Relationships:** Linked to a user.

### `bank_scraper_transactions`
-. **Purpose:** Stores transactions scraped from bank accounts.
- **Key Columns:** `config_id`, `transaction_date`, `original_amount`, `description`.
- **Relationships:** Linked to a bank scraper configuration.

### `bank_scraper_accounts`
- **Purpose:** Stores account balances from scraped data.
- **Key Columns:** `config_id`, `account_number`, `account_balance`.
- **Relationships:** Linked to a bank scraper configuration.

### `bank_scraper_logs`
- **Purpose:** Logs the activity and success/failure of the bank scraping process.
- **Key Columns:** `config_id`, `scrape_date`, `success`, `error_message`.
- **Relationships:** Linked to a bank scraper configuration.
