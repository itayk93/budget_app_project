# Feature Specification: Cash Flow Prediction

## Feature Description
A visual tool that shows users a prediction of their account balance in the near future based on expected income, subscriptions, and spending patterns.

## Requirements

### Functional Requirements
1. **Balance Prediction**: Calculate future account balance based on historical data
2. **Visual Representation**: Line chart showing predicted balance over time
3. **Event Timeline**: List of future financial events influencing the prediction
4. **Multiple Scenarios**: Show optimistic, realistic, and pessimistic projections
5. **Interactive Interface**: Allow users to adjust parameters and see updated predictions

### Technical Requirements
- **Real-time Calculations**: Compute predictions on-demand using existing data
- **Historical Analysis**: Use past transaction patterns for accuracy
- **Integration**: Leverage subscription data and recurring transactions
- **Performance**: Efficient calculation for responsive user experience

## Technical Specifications

### Backend Components

#### 1. Prediction Engine
- **Input Data Sources**:
  - Current account balance
  - Active subscriptions from subscriptions table
  - Historical transaction patterns
  - Recurring income transactions
  - Average monthly spending by category
- **Calculation Period**: 3-6 months prediction window
- **Update Frequency**: Real-time calculation on page load

#### 2. Prediction Algorithm
```
1. Base Calculation:
   - Start with current balance
   - Add expected income (recurring patterns)
   - Subtract confirmed subscriptions
   - Subtract predicted expenses (based on historical averages)

2. Pattern Analysis:
   - Identify seasonal spending patterns
   - Account for irregular large expenses
   - Factor in spending trends (increasing/decreasing)

3. Scenario Generation:
   - Optimistic: 80% of average spending
   - Realistic: 100% of average spending
   - Pessimistic: 120% of average spending
```

#### 3. API Endpoints
- `GET /api/cash-flow/prediction` - Get cash flow prediction data
- `GET /api/cash-flow/events` - Get future financial events
- `POST /api/cash-flow/simulate` - Simulate custom scenarios

### Frontend Components

#### 1. Cash Flow Prediction Page
- **Location**: New tab in Reports page (/reports) called "תחזית תזרים"
- **Main Chart**: Line chart showing predicted balance over time
- **Time Controls**: Toggle between 3, 6, 12 month predictions
- **Scenario Toggle**: Switch between optimistic/realistic/pessimistic views

#### 2. Future Events Timeline
- **Location**: Below main chart
- **Content**: Chronological list of upcoming financial events
- **Event Types**:
  - Subscription payments
  - Predicted large expenses
  - Expected income
  - Account balance milestones (e.g., "Balance drops below ₪1000")

#### 3. Interactive Controls
- **Parameters Panel**: Allow users to adjust:
  - Expected income changes
  - Subscription modifications
  - One-time expense additions
  - Spending multipliers
- **Real-time Updates**: Chart updates immediately when parameters change

### Data Structure

#### Prediction Response Format
```json
{
  "current_balance": 5000.00,
  "currency": "ILS",
  "prediction_period": {
    "start_date": "2024-01-01",
    "end_date": "2024-06-30"
  },
  "scenarios": {
    "optimistic": [
      {"date": "2024-01-01", "balance": 5000.00},
      {"date": "2024-01-15", "balance": 4800.00},
      // ... more data points
    ],
    "realistic": [
      {"date": "2024-01-01", "balance": 5000.00},
      {"date": "2024-01-15", "balance": 4600.00},
      // ... more data points
    ],
    "pessimistic": [
      {"date": "2024-01-01", "balance": 5000.00},
      {"date": "2024-01-15", "balance": 4400.00},
      // ... more data points
    ]
  },
  "future_events": [
    {
      "date": "2024-01-05",
      "type": "subscription",
      "description": "Netflix חיוב חודשי",
      "amount": -55.00,
      "confidence": "high"
    },
    {
      "date": "2024-01-15",
      "type": "income",
      "description": "משכורת צפויה",
      "amount": 8000.00,
      "confidence": "high"
    },
    {
      "date": "2024-02-01",
      "type": "predicted_expense",
      "description": "הוצאות מסעדות (חזוי)",
      "amount": -600.00,
      "confidence": "medium"
    }
  ],
  "insights": [
    "היתרה שלך צפויה לרדת מתחת ל-₪1000 בתאריך 15/03",
    "השורה התחתונה: הוצאות המנויים מהוות 15% מההכנסה החודשית"
  ]
}
```

## Implementation Plan

### Phase 1: Data Analysis
1. Analyze existing transaction patterns
2. Identify recurring income and expense patterns
3. Calculate category spending averages
4. Implement basic prediction algorithm

### Phase 2: Backend Development
1. Create prediction engine
2. Implement scenario calculations
3. Develop future events detection
4. Create API endpoints

### Phase 3: Frontend Development
1. Create cash flow prediction page
2. Implement interactive chart (using Chart.js or similar)
3. Build future events timeline
4. Add interactive controls and real-time updates

### Phase 4: Advanced Features
1. Add scenario simulation
2. Implement warning system for low balance predictions
3. Create export functionality
4. Add prediction accuracy tracking

## Prediction Logic Details

### Income Prediction
```javascript
// Identify recurring income patterns
const predictIncome = (transactions, months) => {
  const incomeTransactions = transactions.filter(t => t.amount > 0);
  const monthlyIncome = calculateMonthlyAverage(incomeTransactions);
  const growthRate = calculateTrend(incomeTransactions);
  
  return generateMonthlyIncome(monthlyIncome, growthRate, months);
};
```

### Expense Prediction
```javascript
// Predict expenses by category
const predictExpenses = (transactions, subscriptions, months) => {
  const recurringExpenses = subscriptions.filter(s => s.status === 'active');
  const variableExpenses = calculateCategoryAverages(transactions);
  
  return combineExpensePredictions(recurringExpenses, variableExpenses, months);
};
```

### Balance Calculation
```javascript
// Calculate future balance points
const calculateFutureBalance = (currentBalance, income, expenses) => {
  let balance = currentBalance;
  const balancePoints = [];
  
  for (const event of sortedEvents) {
    balance += event.amount;
    balancePoints.push({
      date: event.date,
      balance: balance,
      event: event
    });
  }
  
  return balancePoints;
};
```

## Chart Implementation

### Chart Configuration
- **Library**: Chart.js or D3.js for interactive charts
- **Chart Type**: Multi-line chart with area fill
- **X-Axis**: Time (daily/weekly intervals)
- **Y-Axis**: Balance amount in primary currency
- **Colors**: 
  - Green for optimistic scenario
  - Blue for realistic scenario
  - Red for pessimistic scenario

### Interactive Features
- **Hover**: Show exact balance and contributing events
- **Zoom**: Allow users to focus on specific time periods
- **Export**: Save chart as image or PDF
- **Responsive**: Mobile-friendly chart interactions

## Performance Considerations
- Cache calculation results for common scenarios
- Optimize database queries for historical data
- Use efficient date calculations
- Implement lazy loading for extended time periods

## Error Handling
- Handle insufficient historical data gracefully
- Provide fallbacks for missing subscription data
- Display confidence levels for predictions
- Clear messaging when predictions are uncertain

## Security Considerations
- Validate all user inputs for simulation parameters
- Ensure prediction data is user-specific
- Implement proper authentication for API endpoints
- Audit sensitive financial predictions

## User Experience Considerations
- Clear labeling of prediction uncertainty
- Educational tooltips explaining how predictions work
- Warning indicators for concerning trends
- Easy-to-understand visualizations

## Future Enhancements
- Machine learning for improved accuracy
- Integration with bank APIs for real-time balance
- Goal-based predictions (saving targets)
- What-if scenario planning tools
- Email alerts for prediction milestones
- Integration with investment portfolio data
- Seasonal spending pattern recognition