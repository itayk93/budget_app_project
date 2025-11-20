# Credit Card Scraper Pending Transactions Fix

## Problem Description
The CAL (Visa Cal) and other credit card scrapers were including unauthorized transactions in the pending approval queue. These unauthorized transactions include:

1. Transactions with `status='pending'` - indicating they haven't been authorized yet
2. Transactions with `charged_amount=0` or negative amounts - representing pending authorizations that haven't been finalized

This resulted in users seeing transactions in their pending queue that were not yet authorized and should not be processed as real expenses.

## Root Cause
In the `convertScrapedTransactionsToMainFormat` function in `server/services/israeliBankScraperService.js`, the code was fetching all scraped transactions without filtering out unauthorized/pending ones. The same query was used for both credit cards and bank accounts, but the filtering requirements are different:

- Credit cards: Should exclude unauthorized/pending transactions
- Bank accounts: Should include all transactions (since they're already settled)

## Solution
Added conditional filtering based on the bank type:

- For credit card banks (visaCal, max, isracard, amex): Exclude transactions with `status='pending'` OR `charged_amount <= 0`
- For bank accounts: Include all transactions

## Changes Made

### File: `server/services/israeliBankScraperService.js`
- Modified the `convertScrapedTransactionsToMainFormat` function (around line 1165)
- Added conditional filtering based on bank type
- For credit cards: Added `.neq('status', 'pending')` and `.gt('charged_amount', 0)` filters
- For bank accounts: Continue to include all transactions

```javascript
// For credit cards: exclude pending status AND zero/negative charged amount (unauthorized transactions)
const result = await supabase
    .from('bank_scraper_transactions')
    .select('*')
    .eq('config_id', configId)
    .neq('status', 'pending')  // Exclude pending status transactions
    .gt('charged_amount', 0)   // Only include positive amounts
    .order('transaction_date', { ascending: false });

// For bank accounts: get all transactions
const result = await supabase
    .from('bank_scraper_transactions')
    .select('*')
    .eq('config_id', configId)
    .order('transaction_date', { ascending: false });
```

## Impact
- Unauthorized/pending credit card transactions will no longer appear in the pending approval queue
- All bank account transactions will continue to be processed normally
- Only authorized credit card transactions with positive charged amounts will be processed
- Maintains data integrity while preserving functionality for different account types

## Testing
The fix applies conditional filtering at the database query level, preventing unauthorized credit card transactions from being converted to the main format and entering the approval queue, while preserving normal operation for bank accounts. This addresses the core issue without breaking other functionality.