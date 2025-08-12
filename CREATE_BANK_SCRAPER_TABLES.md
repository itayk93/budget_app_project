# יצירת טבלאות Israeli Bank Scraper ב-Supabase

## שלב 1: התחברות לSupabase Dashboard

1. גש לאתר [https://app.supabase.com](https://app.supabase.com)
2. התחבר עם החשבון שלך
3. בחר את הפרויקט שלך: `wgwjfypfkfggwvbwxakp`

## שלב 2: פתיחת SQL Editor

1. בתפריט הצד, לחץ על **"SQL Editor"**
2. לחץ על **"New Query"**

## שלב 3: הרצת הSQL

העתק והדבק את הקוד הבא ב-SQL Editor:

```sql
-- Israeli Bank Scraper Tables - Completely separate from existing budget app
-- Created for israeli-bank-scrapers integration

-- Table to store bank connection configurations
CREATE TABLE IF NOT EXISTS bank_scraper_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    config_name VARCHAR(100) NOT NULL,
    bank_type VARCHAR(50) NOT NULL, -- leumi, hapoalim, discount, etc.
    credentials_encrypted TEXT NOT NULL, -- encrypted JSON of credentials
    is_active BOOLEAN DEFAULT true,
    last_scrape_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to store scraped transactions
CREATE TABLE IF NOT EXISTS bank_scraper_transactions (
    id SERIAL PRIMARY KEY,
    config_id INTEGER REFERENCES bank_scraper_configs(id) ON DELETE CASCADE,
    transaction_identifier VARCHAR(100),
    account_number VARCHAR(50) NOT NULL,
    transaction_date DATE NOT NULL,
    processed_date DATE,
    original_amount DECIMAL(12, 2) NOT NULL,
    original_currency VARCHAR(3) DEFAULT 'ILS',
    charged_amount DECIMAL(12, 2) NOT NULL,
    description TEXT NOT NULL,
    memo TEXT,
    transaction_type VARCHAR(20) DEFAULT 'normal', -- 'normal' or 'installments'
    status VARCHAR(20) DEFAULT 'completed', -- 'completed' or 'pending'
    installment_number INTEGER,
    total_installments INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(config_id, transaction_identifier, account_number, transaction_date)
);

-- Table to store account balances from scraping
CREATE TABLE IF NOT EXISTS bank_scraper_accounts (
    id SERIAL PRIMARY KEY,
    config_id INTEGER REFERENCES bank_scraper_configs(id) ON DELETE CASCADE,
    account_number VARCHAR(50) NOT NULL,
    account_balance DECIMAL(12, 2),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(config_id, account_number)
);

-- Table to store scraping logs
CREATE TABLE IF NOT EXISTS bank_scraper_logs (
    id SERIAL PRIMARY KEY,
    config_id INTEGER REFERENCES bank_scraper_configs(id) ON DELETE CASCADE,
    scrape_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL,
    error_type VARCHAR(50), -- INVALID_PASSWORD, CHANGE_PASSWORD, ACCOUNT_BLOCKED, etc.
    error_message TEXT,
    transactions_count INTEGER DEFAULT 0,
    execution_time_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bank_scraper_configs_user_id ON bank_scraper_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_scraper_transactions_config_id ON bank_scraper_transactions(config_id);
CREATE INDEX IF NOT EXISTS idx_bank_scraper_transactions_date ON bank_scraper_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_scraper_accounts_config_id ON bank_scraper_accounts(config_id);
CREATE INDEX IF NOT EXISTS idx_bank_scraper_logs_config_id ON bank_scraper_logs(config_id);
```

## שלב 4: הרצה

1. לחץ על כפתור **"Run"** (או `Ctrl+Enter`)
2. אם הכל הצליח, תראה הודעת הצלחה ירוקה
3. הטבלאות נוצרו בהצלחה!

## שלב 5: וידוא

בדוק שהטבלאות נוצרו:
1. עבור ל**"Table Editor"** בתפריט הצד
2. אמור לראות 4 טבלאות חדשות:
   - `bank_scraper_configs`
   - `bank_scraper_transactions` 
   - `bank_scraper_accounts`
   - `bank_scraper_logs`

## אחרי יצירת הטבלאות

לאחר יצירת הטבלאות, הרץ מחדש את השרת:

```bash
cd /Users/itaykarkason/Python\ Projects/budget_app_project
npm start
```

הכלי יעבוד כעת בלי בעיות! ✅