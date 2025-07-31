# Feature Specification: Multi-Currency Support

## Feature Description
Enable users to manage finances in multiple currencies with automatic conversion to a primary currency for unified reporting and analysis.

## Requirements

### Functional Requirements
1. **Primary Currency Setting**: Users can set their primary currency for unified reporting
2. **Transaction Currency**: Each transaction can be recorded in its original currency
3. **Automatic Conversion**: Real-time currency conversion using external exchange rates
4. **Unified Reporting**: All summaries and reports display in primary currency
5. **Exchange Rate Management**: Background service to fetch and cache current rates

### Technical Requirements
- **External API**: Integration with reliable exchange rate service
- **Caching**: Cache exchange rates to minimize API calls
- **Data Integrity**: Preserve original transaction amounts and currencies
- **Performance**: Efficient conversion calculations
- **Fallback**: Handle API service downtime gracefully

## Technical Specifications

### Backend Components

#### 1. Exchange Rate Service
- **Provider**: Integration with free/reliable exchange rate API (e.g., exchangerate-api.com)
- **Frequency**: Update rates every 4 hours
- **Cache**: Store rates in Redis or database with TTL
- **Fallback**: Use last known rates if API unavailable

#### 2. Currency Conversion Engine
- **Function**: Convert amounts between currencies
- **Input**: Amount, source currency, target currency, date
- **Output**: Converted amount with exchange rate used
- **History**: Store historical rates for accurate reporting

#### 3. API Endpoints
- `GET /api/currencies` - Get supported currencies list
- `GET /api/exchange-rates` - Get current exchange rates
- `POST /api/user/primary-currency` - Set user's primary currency
- `GET /api/conversion/{amount}/{from}/{to}` - Convert amount between currencies

### Frontend Components

#### 1. User Profile Enhancement
- **Location**: Profile page (/profile)
- **Addition**: Primary currency selector
- **Options**: Common currencies (ILS, USD, EUR, GBP, etc.)
- **Default**: ILS for new users

#### 2. Transaction Form Enhancement
- **Location**: Add/Edit transaction pages
- **Addition**: Currency selector for each transaction
- **Default**: User's primary currency
- **Display**: Show converted amount in primary currency as preview

#### 3. Dashboard and Reports Enhancement
- **Location**: Dashboard (/dashboard) and Reports (/reports)
- **Display**: All amounts in primary currency
- **Indicator**: Small currency symbol/code next to amounts
- **Tooltip**: Show original currency and amount on hover

### Database Schema

#### Enhanced Table: user_settings
```sql
-- Create user_settings table if not exists, or add column if exists
CREATE TABLE IF NOT EXISTS user_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    primary_currency TEXT NOT NULL DEFAULT 'ILS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
```

#### Enhanced Table: transactions
```sql
-- Add new columns to existing transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ILS',
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,6),
ADD COLUMN IF NOT EXISTS rate_date DATE;

-- Update existing records
UPDATE transactions 
SET original_amount = amount, 
    currency = 'ILS', 
    exchange_rate = 1.0,
    rate_date = date_trunc('day', created_at)::date
WHERE original_amount IS NULL;

-- Add constraints
ALTER TABLE transactions 
ALTER COLUMN original_amount SET NOT NULL,
ALTER COLUMN currency SET NOT NULL,
ALTER COLUMN exchange_rate SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(currency);
```

#### New Table: exchange_rates
```sql
CREATE TABLE exchange_rates (
    id BIGSERIAL PRIMARY KEY,
    base_currency TEXT NOT NULL,
    target_currency TEXT NOT NULL,
    rate NUMERIC(10,6) NOT NULL,
    rate_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(base_currency, target_currency, rate_date)
);

CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(base_currency, target_currency);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(rate_date);
```

## Implementation Plan

### Phase 1: Database Setup
1. Create/modify database tables
2. Add new columns to transactions table
3. Set up migration scripts
4. Update existing data with default values

### Phase 2: Exchange Rate Service
1. Choose and integrate exchange rate API
2. Implement rate fetching service
3. Set up caching mechanism
4. Create background job for rate updates

### Phase 3: Backend Logic
1. Implement currency conversion functions
2. Create user settings management
3. Update transaction handling to support currencies
4. Modify reporting calculations

### Phase 4: Frontend Updates
1. Add currency selector to user profile
2. Enhance transaction forms with currency options
3. Update dashboard and reports display
4. Add currency indicators and tooltips

### Phase 5: Testing and Migration
1. Test conversion accuracy
2. Verify data migration
3. Performance testing with multiple currencies
4. User acceptance testing

## Currency Conversion Logic

### Conversion Process
1. **On Transaction Creation**:
   - Store original amount and currency
   - Get exchange rate for transaction date
   - Calculate amount in primary currency
   - Store both original and converted amounts

2. **For Reporting**:
   - Use converted amounts for calculations
   - Display in primary currency
   - Provide original currency context

### Exchange Rate API Integration
```javascript
// Example API integration
const fetchExchangeRates = async (baseCurrency = 'ILS') => {
  try {
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
    const data = await response.json();
    return data.rates;
  } catch (error) {
    // Use cached rates or default to 1.0
    return getCachedRates(baseCurrency);
  }
};
```

## Supported Currencies
Initial support for major currencies:
- ILS (Israeli Shekel) - Default
- USD (US Dollar)
- EUR (Euro)
- GBP (British Pound)
- JPY (Japanese Yen)
- CAD (Canadian Dollar)
- AUD (Australian Dollar)
- CHF (Swiss Franc)

## Error Handling
- **API Failures**: Use cached rates or prompt user to retry
- **Invalid Currencies**: Validate currency codes before processing
- **Rate Unavailable**: Use approximate rates or manual input option
- **Data Inconsistency**: Audit tools to detect and fix conversion errors

## Performance Considerations
- Cache exchange rates to reduce API calls
- Batch update historical rates
- Optimize database queries for multi-currency reports
- Use efficient number handling for precise calculations

## Security Considerations
- Validate all currency inputs
- Secure API keys for exchange rate services
- Audit currency conversion changes
- Prevent currency manipulation attacks

## Migration Strategy
1. **Backward Compatibility**: Ensure existing transactions work without modification
2. **Default Values**: Set ILS as default for existing users
3. **Data Validation**: Verify all existing amounts are properly converted
4. **Rollback Plan**: Ability to revert changes if issues arise

## Future Enhancements
- Support for cryptocurrency rates
- Historical exchange rate charts
- Currency conversion alerts
- Multi-currency budget targets
- Real-time rate notifications
- Support for more exotic currencies