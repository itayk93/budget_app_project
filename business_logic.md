# Business Logic

This document outlines the core business logic of the application, focusing on how financial calculations are performed.

## Stock Price Calculation

The application retrieves stock prices from external APIs to ensure data is up-to-date.

- **Data Sources:** A unified service (`stockPriceService`) fetches stock price data.
  - **Primary Source:** Yahoo Finance is used for its speed and higher rate limits.
  - **Fallback Source:** Alpha Vantage is used if the primary source fails.

- **Data Storage:** Historical price data (open, high, low, close) is stored in the `stock_prices` table to minimize API calls and for historical analysis.

- **Current Price:** The current market price is used to calculate the real-time value of stock holdings.

## Portfolio and Holding Valuation

The value of a user's stock portfolio is calculated based on their holdings and the current market prices.

- **Identifying Holdings:** The system determines a user's stock holdings using two methods:
  1.  **Primary Method:** Reading from the `stock_holdings` summary table, which provides a quick overview of all stocks owned.
  2.  **Fallback Method:** If the primary method fails, the system reconstructs holdings by analyzing the `transactions` table. It identifies "buy" and "sell" transactions to calculate the net quantity of each stock.

- **Cost Basis Calculation (FIFO):**
  To accurately calculate profit and loss, the system determines the cost basis of the currently held shares using a **First-In, First-Out (FIFO)** accounting method.
  - When shares are sold, the system assumes the oldest shares purchased were the ones sold.
  - The `total_invested` amount for a holding reflects the cost of only the shares that are still owned.

- **Key Metrics Calculation:**
  - **Market Value:** `quantity` of shares × `current_price`.
  - **Unrealized Gain/Loss:** `market_value` - `total_invested`. This represents the potential profit or loss if the holding were sold at the current price.

## Transaction Processing (Not an "Order Approval" System)

The application does not have an "order approval process" in the traditional sense (e.g., for e-commerce). Instead, it processes and interprets financial transactions that have already occurred.

- **Transaction Source:** Transactions are imported from bank data (via scraper) or file uploads.
- **Logic:** The system's logic is focused on categorizing transactions, identifying stock trades, and summarizing financial activity to provide insights into spending, income, and investment performance.
