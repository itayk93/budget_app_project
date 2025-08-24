# Claude Development Guidelines

## CRITICAL: Process Management Rules

### End-of-Session Checklist
1. **Kill all running processes**: Check and terminate background processes, servers, and shells
2. **Update documentation**: Update README, API docs, or project notes if needed
3. **Free ports**: `lsof -i :5001; lsof -i :4000` then `kill -9 <PID>` for each process
4. **Auto-commit changes**: Commit all work with meaningful commit messages
5. **📋 MANDATORY: Update feature documentation** (see AUTOMATIC DOCUMENTATION section below)


### Server and Development Process Management
**⚠️ ALWAYS CLOSE ALL RUNNING PROCESSES BEFORE FINISHING TASKS ⚠️**

When working with servers, development tools, or background processes:

1. **Before Ending Session**: Always kill all running Node.js processes, servers, and background tasks
2. **Check Running Processes**: Use `lsof -i :<port>` to identify processes on specific ports
3. **Kill Processes**: Use `kill -9 <PID>` or KillBash tool to terminate background processes
4. **Verify Cleanup**: Confirm all ports are cleared before ending the session
5. **User Will Restart**: The user will manually restart servers when needed - DO NOT leave them running

**Example Cleanup Commands:**
```bash
# Check what's running on ports
lsof -i :4000
lsof -i :5001

# Kill specific processes
kill -9 <PID>

# Use KillBash for background shells
KillBash bash_1
```

**WHY**: Leaving processes running can cause port conflicts, memory leaks, and system instability.

# ⚠️⚠️⚠️ AUTOMATIC DOCUMENTATION - CRITICAL REQUIREMENT ⚠️⚠️⚠️

## 📋 MANDATORY: Feature Completion Documentation

**🚨 EVERY TIME A FEATURE IS COMPLETED OR MAJOR BUG IS FIXED, YOU MUST AUTOMATICALLY UPDATE THE DOCUMENTATION FILES 🚨**

### When to Update Documentation
- ✅ **After completing any new feature**
- ✅ **After fixing major bugs or critical issues**  
- ✅ **After making significant code changes**
- ✅ **After refactoring important components**
- ✅ **At the end of any development session**

### Required Documentation Update Process

#### Step 1: Create Python Script (if not exists)
```python
# Create update_git_log.py with the following content:
#!/usr/bin/env python3
import csv, os, subprocess
from datetime import datetime

def get_latest_commit_info():
    result = subprocess.run([
        'git', 'log', '-1', '--pretty=format:%H|%ad|%s', '--date=short'
    ], capture_output=True, text=True, cwd=os.path.dirname(__file__))
    
    if result.returncode == 0:
        commit_info = result.stdout.strip().split('|', 2)
        if len(commit_info) >= 3:
            return {
                'hash': commit_info[0][:8],
                'date': commit_info[1], 
                'message': commit_info[2]
            }
    return None

def update_documentation():
    commit_info = get_latest_commit_info()
    if not commit_info:
        return False
        
    # Update CSV log
    csv_path = "docs/git-logs/git_commits_log.csv"
    
    # Read existing data
    rows = []
    existing_commits = set()
    if os.path.exists(csv_path):
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)
                if 'Commit Hash' in row:
                    existing_commits.add(row['Commit Hash'])
    
    # Add new commit if not exists
    if commit_info['hash'] not in existing_commits:
        new_row = {
            'Date': commit_info['date'],
            'Commit Hash': commit_info['hash'],
            'Message': commit_info['message'],
            'Description': input("📝 Enter Hebrew description of changes: ")
        }
        rows.append(new_row)
        
        # Write back to CSV
        fieldnames = ['Date', 'Commit Hash', 'Message', 'Description']
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    
    return True
```

#### Step 2: Automatic Execution Commands
```bash
# MUST RUN THESE COMMANDS AFTER EVERY FEATURE COMPLETION:

# 1. Create/update the documentation
cd /Users/itaykarkason/Python\ Projects/budget_app_project
python3 -c "
import csv, os, subprocess
from datetime import datetime

def get_latest_commit_info():
    result = subprocess.run(['git', 'log', '-1', '--pretty=format:%H|%ad|%s', '--date=short'], capture_output=True, text=True)
    if result.returncode == 0:
        commit_info = result.stdout.strip().split('|', 2)
        if len(commit_info) >= 3:
            return {'hash': commit_info[0][:8], 'date': commit_info[1], 'message': commit_info[2]}
    return None

# Add your documentation logic here
print('Documentation updated!')
"

# 2. Convert CSV to Excel (if needed)
python3 -c "
import pandas as pd
try:
    df = pd.read_csv('docs/git-logs/git_commits_log.csv')
    df.to_excel('docs/git-logs/git_commits_log.xlsx', index=False, engine='xlsxwriter')
    print('✅ Excel file updated!')
except: pass
"
```

#### Step 3: Required Documentation Content
For each feature completion, document:

1. **📅 Date** - When the feature was completed
2. **🔗 Commit Hash** - Git commit reference
3. **📝 Message** - Brief commit message
4. **📋 Description (Hebrew)** - Detailed explanation including:
   - מה השתנה (What changed)
   - למה השתנה (Why it changed) 
   - איך זה עובד עכשיו (How it works now)
   - בעיות שנפתרו (Issues resolved)
   - שיפורים שנעשו (Improvements made)

### File Locations
- **CSV Log**: `docs/git-logs/git_commits_log.csv`
- **Excel Log**: `docs/git-logs/git_commits_log.xlsx`  
- **Summary**: `docs/git-logs/git_log_summary.txt`

### 🚨 CRITICAL REMINDERS
- **NEVER SKIP** documentation updates
- **ALWAYS** write descriptions in Hebrew
- **ALWAYS** include technical details
- **ALWAYS** explain user impact
- Files are in `docs/` folder (excluded from git)
- Keep local documentation comprehensive

### Example Documentation Entry
```csv
Date,Commit Hash,Message,Description
2025-08-24,8aee52c,Fix Bank Scraper duplicate detection system,"תיקון מערכת זיהוי הכפילויות של Bank Scraper:

🔧 שינויים טכניים:
• יצירת endpoint מיוחד /api/upload/check-duplicates לעסקאות Bank Scraper
• תיקון סדר הפרמטרים בקריאה לפונקציית getTransactionsByHash  
• עדכון הקליינט להשתמש ב-JSON payload במקום FormData מזויף
• הוספת לוגים מפורטים לדיבוג זיהוי כפילויות
• הסתרת לוגים של CategoryDropdown להפחתת רעש בקונסול

✅ תוצאות:
• זיהוי כפילויות עובד כעת עבור עסקאות Bank Scraper
• עסקאות קיימות מוצגות בצהוב במודל הסקירה  
• שמירה על לוגיקת OR query עבור עסקאות ישנות (cash_flow_id: null)
• ביצועים משופרים וקוד נקי יותר"
```

---

## Code Refactoring Best Practices

### Incremental Refactoring Approach
When refactoring large files or complex components, follow these guidelines to maintain system stability:

#### 1. Pre-Refactoring Assessment
- **Measure Twice, Cut Once**: Thoroughly analyze the current code structure before making changes
- **Identify Core Dependencies**: Map out all external dependencies, API calls, and state management
- **Document Current Functionality**: Ensure you understand what the code does before changing it
- **Test Current State**: Verify the existing code works as expected

#### 2. Incremental Refactoring Strategy
- **Small Steps**: Break refactoring into small, testable chunks
- **One Module at a Time**: Extract one logical module at a time, not multiple simultaneously
- **Test After Each Step**: Ensure each extracted module works before proceeding
- **Maintain Backward Compatibility**: Keep the original interface working during transition

#### 3. Testing at Each Stage
- **Build Verification**: Run `npm run build` after each module extraction
- **Functional Testing**: Test the actual functionality, not just compilation
- **Integration Testing**: Ensure new modules integrate properly with existing code
- **Performance Testing**: Watch for performance regressions or infinite loops

#### 4. Rollback Strategy
- **Keep Original Files**: Always backup original working files before refactoring
- **Version Control**: Commit working states before major changes
- **Quick Rollback**: Be prepared to revert quickly if issues arise
- **Document Issues**: Note what went wrong for future reference

### Example: TransactionReviewModal Refactoring Lesson

**What Went Wrong:**
- Attempted to split 1,291 line file into 5 modules simultaneously
- Broke authentication flow and caused infinite API loops
- Lost core functionality while pursuing code organization

**What Should Have Been Done:**
1. **Phase 1**: Extract utility functions only (formatAmount, detectForeignCurrency)
2. **Phase 2**: Extract one service (e.g., CategoryService) while keeping others inline
3. **Phase 3**: Test thoroughly, ensure all functionality works
4. **Phase 4**: Extract next service only after Phase 3 succeeds
5. **Continue incrementally** until refactoring is complete

### Key Principles

#### Working Code > Perfect Structure
- A large, working file is better than broken modular code
- Functionality should never be sacrificed for code organization
- Users don't see code structure, they see features working

#### Gradual Over Revolutionary
- Prefer gradual improvements over complete rewrites
- Each change should leave the system in a working state
- Revolutionary changes should be done in branches with extensive testing

#### Test-Driven Refactoring
- Write tests for existing functionality before refactoring
- Ensure tests pass after each refactoring step
- Use automated testing to catch regressions early

## Project-Specific Guidelines

### Frontend (React) Development
- Always test file upload and modal functionality after changes
- Verify API calls and authentication flows work correctly
- Check for infinite re-render loops in useEffect hooks
- Test both desktop and mobile views

### Backend (Node.js) Development
- Ensure server starts without port conflicts
- Test all API endpoints after changes
- Verify database connections and queries work
- Check authentication middleware functionality

### Build and Deployment
- Always run `npm run build` before committing
- Fix ESLint warnings to maintain code quality
- Verify no broken imports or missing dependencies
- Test production build functionality

## Emergency Procedures

### When Refactoring Goes Wrong
1. **Stop Immediately**: Don't continue if core functionality breaks
2. **Assess Damage**: Identify what's broken and why
3. **Quick Rollback**: Restore working version from backup/git
4. **Document Issues**: Note what caused the problem
5. **Plan Alternative**: Consider different refactoring approach
6. **Test Rollback**: Ensure rolled-back version works properly

### Debugging Broken Refactoring
- Check console for infinite loops or repeated API calls
- Verify all imports and exports are correct
- Ensure state management isn't broken
- Test authentication and authorization flows
- Check for missing dependencies or circular imports

## Conclusion

Remember: **The goal is to improve code while maintaining functionality**. If refactoring breaks core features, it's not an improvement - it's technical debt. Always prioritize working software over perfect code structure.

> "Make it work, make it right, make it fast" - Kent Beck

In this project, "make it work" is the highest priority. Only pursue "make it right" if it doesn't compromise "make it work".

# 🚨🚨🚨 FINAL REMINDER: DOCUMENTATION IS MANDATORY 🚨🚨🚨

**EVERY DEVELOPMENT SESSION MUST END WITH:**

1. ✅ **Git commits** with clear messages
2. ✅ **Documentation update** in `docs/git-logs/` files  
3. ✅ **Hebrew descriptions** of all changes made
4. ✅ **Process cleanup** (kill servers, free ports)

**NO EXCEPTIONS - THIS IS REQUIRED FOR PROJECT CONTINUITY!**

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

⚠️⚠️⚠️ **CRITICAL ADDITION**: ⚠️⚠️⚠️
**ALWAYS UPDATE FEATURE DOCUMENTATION** after completing any feature or bug fix:
- Update docs/git-logs/git_commits_log.csv with Hebrew descriptions
- Convert to Excel if possible (docs/git-logs/git_commits_log.xlsx)
- Create summary file (docs/git-logs/git_log_summary.txt)
- This is MANDATORY and must not be skipped!