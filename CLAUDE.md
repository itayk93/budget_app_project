# Claude Development Guidelines

## CRITICAL: Process Management Rules

### End-of-Session Checklist
1. **Kill all running processes**: Check and terminate background processes, servers, and shells
2. **Update documentation**: Update README, API docs, or project notes if needed
3. **Free ports**: `lsof -i :5001; lsof -i :4000` then `kill -9 <PID>` for each process
4. **Auto-commit changes**: Commit all work with meaningful commit messages
5. **Update git log**: Update "git_commits_log.xlsx" if the file exists


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