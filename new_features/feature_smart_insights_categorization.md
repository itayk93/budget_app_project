# Feature Specification: Smart Insights and Auto-Categorization (AI)

## Feature Description
An AI-powered module that enhances categorization capabilities and provides proactive insights, including duplicate charge detection with push notifications.

## Requirements

### Functional Requirements
1. **Smart Categorization**: AI-powered category suggestions for new transactions
2. **Anomaly Detection**: Identify unusual spending patterns and duplicate charges
3. **Push Notifications**: Real-time alerts for duplicate charges with quick actions
4. **Insights Dashboard**: Proactive insights widget on main dashboard
5. **User Feedback**: Allow users to accept/reject AI suggestions

### Technical Requirements
- **AI Model**: Use OpenAI gpt-4o-mini exclusively
- **API Key**: Load from OPENAI_API_KEY environment variable
- **Real-time Processing**: Immediate categorization on transaction creation
- **Background Analysis**: Periodic analysis for insights and anomalies
- **Push Notifications**: Native mobile/web notifications

## Technical Specifications

### Backend Components

#### 1. Smart Categorization Service
- **Trigger**: On transaction creation/edit
- **Process**: Send transaction description to gpt-4o-mini
- **Response**: Suggested category with confidence score
- **Integration**: Pre-populate category field in transaction forms

#### 2. Insights Engine (Background Process)
- **Frequency**: Hourly analysis
- **Functions**:
  - Compare spending to historical averages
  - Detect spending anomalies
  - Identify duplicate charges
  - Generate insight messages using AI

#### 3. Duplicate Charge Detection
- **Criteria**:
  - Identical or near-identical descriptions
  - Amount variance within ±1%
  - Time window: 48 hours
- **Action**: Create insight record and trigger push notification

#### 4. API Endpoints
- `POST /api/transactions/suggest-category` - Get category suggestion
- `GET /api/insights` - Retrieve user insights
- `POST /api/insights/{id}/mark-read` - Mark insight as read
- `DELETE /api/transactions/{id}/duplicate` - Quick delete duplicate charge
- `POST /api/insights/{id}/dismiss` - Dismiss insight

### Frontend Components

#### 1. Enhanced Transaction Form
- **Location**: Transaction creation/edit pages
- **Enhancement**: Auto-populated category suggestions
- **UI**: Show suggested category with confidence indicator
- **Interaction**: User can accept, modify, or override suggestion

#### 2. Dashboard Insights Widget
- **Location**: Main dashboard (/dashboard)
- **Content**:
  - Recent insights summary
  - Actionable recommendations
  - Quick action buttons
- **Design**: Card-based layout with icons and priority indicators

#### 3. Push Notification System
- **Duplicate Charge Notification**:
  - Title: "זיהינו חיוב כפול אפשרי"
  - Message: "{business_name} בסך {amount}. האם תרצה לבדוק ולמחוק?"
  - Actions:
    - "בדוק" - Open app to specific transaction
    - "מחק כפילות" - API call to delete duplicate immediately

### Database Schema

#### New Table: insights
```sql
CREATE TABLE insights (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    insight_type TEXT NOT NULL CHECK (insight_type IN (
        'unusual_spending', 
        'duplicate_charge', 
        'savings_opportunity',
        'category_suggestion',
        'spending_trend'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_data JSONB,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_insights_user_id ON insights(user_id);
CREATE INDEX idx_insights_type ON insights(insight_type);
CREATE INDEX idx_insights_priority ON insights(priority);
CREATE INDEX idx_insights_created_at ON insights(created_at);
```

#### Related Data Structure Examples
```json
// For duplicate_charge type
{
  "original_transaction_id": 123,
  "duplicate_transaction_id": 456,
  "confidence_score": 0.95,
  "amount_difference": 0.50
}

// For unusual_spending type
{
  "category": "מסעדות",
  "current_amount": 800,
  "average_amount": 400,
  "percentage_increase": 100
}

// For category_suggestion type
{
  "transaction_id": 789,
  "suggested_category": "תחבורה",
  "confidence_score": 0.88,
  "alternative_categories": ["דלק", "חנייה"]
}
```

## Implementation Plan

### Phase 1: Core AI Integration
1. Set up OpenAI API client
2. Implement categorization service
3. Create insights database schema
4. Develop basic insight generation

### Phase 2: Duplicate Detection
1. Implement duplicate detection algorithm
2. Create insight generation for duplicates
3. Set up background processing
4. Test detection accuracy

### Phase 3: Push Notifications
1. Implement notification service
2. Create notification templates
3. Add quick action handlers
4. Test notification delivery

### Phase 4: Frontend Integration
1. Enhance transaction forms with AI suggestions
2. Create insights dashboard widget
3. Implement notification UI
4. Add user feedback mechanisms

### Phase 5: Advanced Insights
1. Implement spending pattern analysis
2. Add savings opportunity detection
3. Create trend analysis
4. Optimize AI prompts based on user feedback

## AI Integration Details

### Categorization Prompts
```
System: You are a financial transaction categorizer for a Hebrew budget app.
User: Categorize this transaction: "{description}" amount: {amount} {currency}
Available categories: {category_list}
Respond with: {"category": "category_name", "confidence": 0.0-1.0}
```

### Insight Generation Prompts
```
System: You are a financial advisor creating insights for budget app users.
User: Analyze this spending data: {spending_summary}
Create a helpful insight message in Hebrew (max 100 characters).
Focus on actionable advice.
```

### Duplicate Detection Logic
1. **Text Similarity**: Compare transaction descriptions using fuzzy matching
2. **Amount Matching**: Check if amounts are within 1% variance
3. **Time Window**: Ensure transactions are within 48 hours
4. **AI Verification**: Use gpt-4o-mini to confirm if transactions are likely duplicates

## Security Considerations
- Sanitize all AI inputs and outputs
- Implement rate limiting for OpenAI API calls
- Validate notification payloads
- Secure storage of insight data
- User consent for AI processing

## Performance Considerations
- Cache category suggestions for common descriptions
- Batch process insights generation
- Optimize duplicate detection queries
- Implement efficient notification delivery
- Rate limit AI API calls

## Privacy Considerations
- Anonymize data sent to AI services
- User control over AI features
- Transparent data usage policies
- Option to disable AI processing

## Monitoring and Analytics
- Track AI suggestion accuracy
- Monitor user acceptance rates
- Measure insight engagement
- Alert on API errors or rate limits
- Performance metrics for background processes

## Future Enhancements
- Learning from user corrections
- Personalized insight preferences
- Integration with financial news for context
- Predictive spending alerts
- Custom insight rules creation