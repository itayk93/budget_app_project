# Claude AI Assistant Instructions for Budget App Project

## Project Overview
This is a comprehensive full-stack budget management application built with Node.js/Express.js backend, React.js frontend, and Supabase (PostgreSQL) database. The system includes expense tracking, income management, budget planning, stock portfolio management, financial analytics, and advanced features like Excel import/export and bank statement processing.

**Always refer to `PROJECT_DOCUMENTATION.md` for complete API routes and endpoints documentation.**

## Project Architecture
- **Backend**: Node.js with Express.js server (Port 5001)
- **Frontend**: React.js application (Port 4000)  
- **Database**: Supabase (PostgreSQL) - cloud-hosted
- **Authentication**: JWT tokens with secure session management
- **External APIs**: Alpha Vantage, Yahoo Finance, Brevo Email
- **File Processing**: Excel import/export, Bank statement OCR (Blink integration)

## Key Project Files Structure

### Backend (`/server/`)
- `index.js` - Express server entry point
- `config/supabase.js` - Supabase client configuration
- `middleware/auth.js` - Authentication middleware
- `routes/` - API endpoint handlers (15 route files)
- `services/` - Business logic services (12 service files)
- `utils/logger.js` - Application logging

### Frontend (`/client/`)
- `src/App.js` - Main React application
- `src/components/` - React components (20+ components)
- `src/utils/api.js` - API communication utilities
- `package.json` - Frontend dependencies

### Database & Migrations
- `sql/` - Database schema files and migrations (12 SQL files)
- `database_migrations/` - Additional migration scripts
- `budget_db.sqlite` - **LEGACY FILE** (not used - project uses Supabase)

### Documentation & Configuration
- `PROJECT_DOCUMENTATION.md` - **CRITICAL** - Complete API documentation
- `FEATURES.md` - Feature specifications
- `project_structure.md` - Project file structure overview
- `.env` - Environment variables (includes Supabase credentials)
- `package.json` - Server-side dependencies

## Development Guidelines

### Core Development Principles
1. **English Comments Only**: All code comments must be in English
2. **Supabase Only**: Never use SQLite - project exclusively uses Supabase
3. **API Documentation**: Always update `PROJECT_DOCUMENTATION.md` with any endpoint changes
4. **Git Tracking**: Maintain detailed commit logs and auto-commit at session end
5. **Dependency Management**: Update package.json when adding new dependencies

### When Adding New Features

#### Pre-Implementation (MANDATORY)
1. **Create Feature Documentation**: 
   - Create detailed specification in `/new_features/feature_[name].md`
   - Include: description, requirements, technical specs, implementation plan
   - Reference existing feature files for template

2. **Plan Database Changes**:
   - Create SQL migration files in `/sql/` directory
   - Test schema changes on Supabase first
   - Document new tables/columns in PROJECT_DOCUMENTATION.md

#### Implementation Process
1. **Backend Development**:
   - Add routes in appropriate `/server/routes/` file
   - Create/update services in `/server/services/`
   - Use existing patterns from supabaseService.js
   - Implement proper error handling and validation
   - Add authentication middleware where needed

2. **Frontend Development**:
   - Create/update React components in `/client/src/components/`
   - Update API calls in `/client/src/utils/api.js`
   - Follow existing component patterns and styling
   - Implement proper state management

3. **Testing & Validation**:
   - Test all new endpoints with Postman or similar
   - Verify frontend-backend integration
   - Test authentication and permissions
   - Validate database operations

#### Post-Implementation (MANDATORY)
1. **Update Documentation**:
   - **CRITICAL**: Update `PROJECT_DOCUMENTATION.md` with:
     - New API endpoints (HTTP methods, parameters, responses)
     - Authentication requirements
     - Request/response examples
     - English explanations of functionality
   
2. **Update Dependencies**:
   - Backend: Update `/package.json` if new NPM packages added
   - Frontend: Update `/client/package.json` if new packages added
   - Run `npm install` to ensure clean installs

3. **Git Management**:
   - Commit changes with descriptive English messages
   - Update git commits tracking (see Git Guidelines below)
   - Push to repository if requested

### When Modifying Existing Code
1. **Review Current Documentation**: Check `PROJECT_DOCUMENTATION.md` for existing endpoint details
2. **Maintain API Compatibility**: Preserve existing URL patterns and response formats
3. **Update Supabase Service**: Use existing patterns in `supabaseService.js`
4. **Test Thoroughly**: Verify no breaking changes to existing functionality
5. **Update Documentation**: Reflect any changes in `PROJECT_DOCUMENTATION.md`

## Git Management & Commit Tracking

### Auto-Commit Process (MANDATORY)
**At the end of EVERY session**, automatically commit all changes:

```bash
git add .
git commit -m "[Brief description of changes in ENGLISH] - Deploy: $(date '+%Y-%m-%d %H:%M')"
```

### Git Commits Tracking
Maintain detailed Excel log of all Git commits in `git_commits_log.xlsx`:

#### Excel Structure:
- **Column A**: Date & Time (YYYY-MM-DD HH:MM)
- **Column B**: Commit Hash (first 7 characters)
- **Column C**: Commit Message (English description)
- **Column D**: Files Changed (count)
- **Column E**: Additions (+)
- **Column F**: Deletions (-)
- **Column G**: Session Description (what was accomplished)
- **Column H**: Status (Pushed/Local)

#### Update Process:
1. Create Excel file if doesn't exist with headers
2. After each commit, add new row with all details
3. Use `git log --oneline -1` for commit info
4. Use `git show --stat HEAD` for change statistics
5. Save Excel file after each update

### Commit Message Format
Always use English commit messages with this format:
```
[Feature/Fix/Update]: Brief description - Deploy: YYYY-MM-DD HH:MM
```

Examples:
- `[Feature]: Add stock portfolio alerts system - Deploy: 2025-01-31 14:30`
- `[Fix]: Resolve transaction category validation bug - Deploy: 2025-01-31 15:45`
- `[Update]: Enhance budget chart visualization - Deploy: 2025-01-31 16:20`

## Code Quality & Standards

### Code Style Guidelines
1. **JavaScript/Node.js**:
   - Use ES6+ syntax (arrow functions, destructuring, async/await)
   - Follow camelCase for variables and functions
   - Use meaningful variable names in English
   - Add English comments for complex logic

2. **React Components**:
   - Use functional components with hooks
   - Follow existing component structure patterns
   - Implement proper prop validation
   - Use descriptive component and prop names

3. **Database Operations**:
   - Always use Supabase client methods
   - Implement proper error handling
   - Use transactions for complex operations
   - Follow existing patterns in supabaseService.js

### Security Considerations
- All protected routes use JWT authentication middleware
- Validate all user inputs and sanitize data
- Use environment variables for sensitive configuration
- Implement proper CORS settings
- Never expose Supabase service key in frontend code
- Use HTTPS in production environments

## External Integrations

### Supabase Database
- **Connection**: Via `server/config/supabase.js`
- **Service Layer**: `server/services/supabaseService.js`
- **Tables**: Users, transactions, categories, budgets, stocks, alerts, etc.
- **Features**: Real-time subscriptions, RLS policies, automatic backups

### API Integrations
- **Alpha Vantage**: Stock market data (`server/services/alphaVantageService.js`)
- **Yahoo Finance**: Additional financial data (`server/services/yahooFinanceService.js`)
- **Brevo Email**: Email notifications (`server/services/emailService.js`)
- **Blink OCR**: Bank statement processing (`server/services/blinkProcessor.js`)

### File Processing
- **Excel Import/Export**: Multiple service files for different Excel formats
- **Bank Statements**: Screenshot processing and data extraction
- **Financial Reports**: PDF generation and email delivery

## Testing & Deployment

### Development Testing
1. **Backend Testing**:
   ```bash
   cd /Users/itaykarkason/Python\ Projects/budget_app_project
   npm start  # Starts server on port 5001
   ```

2. **Frontend Testing**:
   ```bash
   cd /Users/itaykarkason/Python\ Projects/budget_app_project/client
   npm start  # Starts React app on port 4000
   ```

3. **Database Testing**:
   - Verify Supabase connection in server logs
   - Test API endpoints with authentication
   - Check data integrity after operations

### Pre-Deployment Checklist
1. Run `npm test` (if tests exist)
2. Verify all environment variables are set
3. Check Supabase connection and permissions
4. Test critical user flows end-to-end
5. Update documentation if changes made
6. Commit all changes with proper message

## Common Development Tasks

### Adding New API Endpoint
1. Choose appropriate route file in `/server/routes/`
2. Implement endpoint with proper authentication
3. Add business logic in corresponding service file
4. Test endpoint thoroughly
5. Update `PROJECT_DOCUMENTATION.md` with full documentation
6. Add frontend API call if needed

### Database Schema Changes
1. Create SQL migration file in `/sql/` directory
2. Run migration on Supabase dashboard or via service
3. Update Supabase service methods if needed
4. Update frontend models/interfaces if applicable
5. Document changes in `PROJECT_DOCUMENTATION.md`

### Adding New React Component
1. Create component file in `/client/src/components/`
2. Follow existing component patterns and styling
3. Import and use in appropriate parent component
4. Add necessary API calls via `/client/src/utils/api.js`
5. Test component functionality and responsive design

### Integrating External API
1. Add service file in `/server/services/`
2. Add API keys to `.env` file
3. Implement error handling and rate limiting
4. Add configuration options if needed
5. Document API usage and limitations

## Important File Locations

### Configuration Files
- `.env` - Environment variables (Supabase, API keys, email config)
- `server/config/supabase.js` - Database connection configuration
- `client/package.json` - Frontend dependencies and scripts
- `package.json` - Backend dependencies and scripts

### Key Service Files
- `server/services/supabaseService.js` - **MAIN DATABASE SERVICE**
- `server/services/emailService.js` - Email notifications (Brevo)
- `server/services/stockService.js` - Stock portfolio management
- `server/services/excelService.js` - Excel import/export functionality

### Documentation Files
- `PROJECT_DOCUMENTATION.md` - **SINGLE SOURCE OF TRUTH** for API documentation
- `FEATURES.md` - Feature specifications and status
- `project_structure.md` - Complete file structure overview
- `/new_features/` - Feature specification templates

## Current Feature Status
- ✅ User authentication and authorization (JWT)
- ✅ Transaction management (CRUD operations)
- ✅ Category management with custom categories
- ✅ Budget planning and tracking
- ✅ Income tracking and management
- ✅ Stock portfolio management with real-time data
- ✅ Stock price alerts and notifications
- ✅ Financial reports and analytics
- ✅ Excel import/export functionality
- ✅ Bank statement processing (OCR)
- ✅ Email notifications (Brevo integration)
- ✅ Monthly goals and targets
- ✅ Cash flow tracking and projections
- ✅ Dashboard with comprehensive analytics
- ✅ Mobile-responsive React frontend

## Critical Reminders

### ALWAYS Required Actions:
1. **Update `PROJECT_DOCUMENTATION.md`** when adding/modifying endpoints
2. **Use English comments** in all code
3. **Use Supabase only** - never SQLite
4. **Update package.json** when adding dependencies
5. **Auto-commit at session end** with English commit message
6. **Update git_commits_log.xlsx** with commit details
7. **Create feature documentation** before implementing new features

### NEVER Do:
- Use SQLite database (project uses Supabase exclusively)
- Write comments in Hebrew (English only)
- Skip documentation updates
- Push code without testing
- Modify authentication middleware without thorough testing
- Expose sensitive keys in frontend code

## Session End Checklist
1. ✅ Test all modified functionality
2. ✅ Update `PROJECT_DOCUMENTATION.md` if endpoints changed
3. ✅ Update package.json if dependencies added
4. ✅ Commit changes with English message and timestamp
5. ✅ Update `git_commits_log.xlsx` with commit details
6. ✅ Verify Supabase connection is working
7. ✅ Clean up any temporary files or logs

Remember: This project serves as a comprehensive financial management system. Always maintain high code quality, proper documentation, and thorough testing to ensure reliability for users managing their financial data.