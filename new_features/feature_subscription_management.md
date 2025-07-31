# Feature Specification: Subscription Management (AI-Powered)

## Feature Description
An AI-powered system to automatically detect recurring charges (subscriptions) and present them to users in a centralized management interface.

## Requirements

### Functional Requirements
1. **Automatic Detection**: Background process to identify recurring transactions using AI analysis
2. **Centralized Management**: Dedicated page for managing detected subscriptions
3. **Dashboard Integration**: Widget summarizing monthly subscription expenses
4. **User Control**: Allow users to confirm, reject, or edit detected subscriptions

### Technical Requirements
- **AI Model**: Use OpenAI gpt-4o-mini exclusively
- **API Key**: Load from OPENAI_API_KEY environment variable
- **Security**: Ensure .env file is in .gitignore
- **Processing**: Daily cron job for detection
- **Real-time**: Immediate UI updates for user actions

## Technical Specifications

### Backend Components

#### 1. Background Process (Cron Job)
- **Frequency**: Daily execution
- **Function**: Analyze transaction descriptions using gpt-4o-mini
- **Detection Criteria**: 
  - Similar business names
  - Near-identical amounts
  - Regular frequency patterns
- **Action**: Create records in `subscriptions` table with `pending_approval` status

#### 2. API Endpoints
- `GET /api/subscriptions` - Retrieve user's subscriptions
- `POST /api/subscriptions/{id}/confirm` - Confirm subscription
- `POST /api/subscriptions/{id}/reject` - Reject subscription
- `PUT /api/subscriptions/{id}` - Edit subscription details
- `DELETE /api/subscriptions/{id}` - Cancel subscription

### Frontend Components

#### 1. New Page: Subscription Management (/subscriptions)
- **Navigation**: Add "מנויים" link to main navigation
- **Layout**: Card-based display grouped by status:
  - Active subscriptions
  - Pending approval
  - Cancelled subscriptions
- **Card Content**:
  - Service name
  - Amount and currency
  - Billing frequency
  - Next billing date
  - Category
- **Actions**: Confirm, reject, edit, cancel buttons

#### 2. Dashboard Widget
- **Location**: Add to existing dashboard (/dashboard)
- **Content**: 
  - Monthly subscription total
  - Number of active subscriptions
  - Quick link to subscriptions page
- **Design**: Consistent with existing dashboard widgets

### Database Schema

#### New Table: subscriptions
```sql
CREATE TABLE subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ILS',
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    next_billing_date DATE,
    status TEXT NOT NULL DEFAULT 'pending_approval' 
        CHECK (status IN ('active', 'pending_approval', 'cancelled')),
    category_id BIGINT REFERENCES categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

## Implementation Plan

### Phase 1: Database Setup
1. Create subscriptions table
2. Add necessary indexes
3. Set up database migrations

### Phase 2: Backend Development
1. Implement AI detection service using OpenAI API
2. Create cron job for daily processing
3. Develop REST API endpoints
4. Add subscription business logic

### Phase 3: Frontend Development
1. Create subscription management page
2. Implement subscription cards and actions
3. Add dashboard widget
4. Integrate with existing navigation

### Phase 4: Testing & Integration
1. Test AI detection accuracy
2. Verify user workflows
3. Performance testing for background processes
4. Integration testing with existing features

## AI Integration Details

### Detection Logic
```
Input: Transaction description, amount, date
Process: Send to gpt-4o-mini with prompt to identify subscription patterns
Output: Confidence score and subscription details
Threshold: Only create subscription records for high-confidence detections
```

### Error Handling
- API rate limiting for OpenAI calls
- Fallback mechanisms for AI service downtime
- User notification for detection failures

## Security Considerations
- Validate all user inputs
- Sanitize AI responses before storing
- Implement proper authorization for subscription management
- Audit logging for subscription changes

## Performance Considerations
- Batch process transactions for efficiency
- Cache AI responses for similar transactions
- Optimize database queries with proper indexing
- Implement pagination for subscription lists

## Future Enhancements
- Machine learning model training on user feedback
- Integration with bank APIs for real-time detection
- Subscription cost optimization suggestions
- Reminder notifications for upcoming charges