# Duplicate Handling Improvement Plan

## Overview
This plan outlines the implementation of an improved duplicate handling mechanism that allows creating true duplicate transactions while maintaining proper tracking and linking between them.

## Current State Analysis
- Transactions have a `transaction_hash` field for duplicate detection
- Upload modal shows duplicate detection with checkboxes for replace/create options  
- When checkbox is unchecked, system should create duplicate but currently may not handle properly

## Requirements
1. **Duplicate Creation**: When checkbox is unchecked, create true duplicate transaction
2. **Hash Differentiation**: Add sequential numbering to notes field (e.g., "כפילות 1", "כפילות 2") to ensure unique hashes
3. **Parent Tracking**: New database column to track which transaction this is a duplicate of
4. **Chain Tracking**: Support multiple levels of duplication (200+ duplicates)

## Implementation Plan

### Phase 1: Database Schema Update
- [ ] Add `duplicate_parent_id` column to `transactions` table
- [ ] Create SQL migration script
- [ ] Update Supabase schema

### Phase 2: Backend Logic Updates
- [ ] Analyze current duplicate detection in `server/routes/upload.js`
- [ ] Analyze current duplicate handling in `server/services/excelService.js`
- [ ] Update duplicate creation logic to:
  - Add sequential numbering to notes field
  - Set `duplicate_parent_id` to reference original/previous duplicate
  - Ensure unique hash generation
- [ ] Update hash generation to include duplicate numbering

### Phase 3: Frontend Updates
- [ ] Update upload modal UI logic in `client/src/pages/Upload/Upload.js`
- [ ] Ensure proper handling when duplicate checkbox is unchecked
- [ ] Update API calls to support new duplicate creation flow

### Phase 4: Testing & Validation
- [ ] Test single duplicate creation
- [ ] Test multiple duplicate chains (1→2→3→4...)
- [ ] Verify hash uniqueness
- [ ] Verify parent-child relationships
- [ ] Test with actual upload scenario

## Technical Details

### Database Schema Change
```sql
ALTER TABLE transactions 
ADD COLUMN duplicate_parent_id UUID REFERENCES transactions(id);
```

### Duplicate Chain Logic
- **Original Transaction**: `duplicate_parent_id = NULL`
- **First Duplicate**: `duplicate_parent_id = original_transaction_id`, notes += " כפילות 1"
- **Second Duplicate**: `duplicate_parent_id = first_duplicate_id`, notes += " כפילות 2"
- **Third Duplicate**: `duplicate_parent_id = second_duplicate_id`, notes += " כפילות 3"

### Hash Modification Strategy
- Original transaction hash remains unchanged
- Duplicate transactions get modified notes field before hash calculation
- This ensures unique hashes while maintaining duplicate relationship

## Key Files to Modify
1. **Backend**:
   - `server/routes/upload.js` - Upload handling logic
   - `server/services/excelService.js` - Excel processing and transaction creation
   - `server/services/supabaseService.js` - Database operations (if needed)

2. **Frontend**:
   - `client/src/pages/Upload/Upload.js` - Upload modal UI and logic

3. **Database**:
   - New SQL migration file for schema update

## Success Criteria
- [x] Current state committed to git
- [ ] Database schema updated successfully
- [ ] Duplicate transactions created with proper parent linkage
- [ ] Unique hashes generated for all duplicates
- [ ] Chain of duplicates properly linked (1→2→3→...)
- [ ] Upload modal correctly handles unchecked duplicate options
- [ ] All functionality tested and working

## Rollback Plan
- Git commit current state before any changes
- If issues arise, revert database changes and code modifications
- Restore from backup if necessary

## Timeline
- **Phase 1**: Database schema update (~30 minutes)
- **Phase 2**: Backend logic implementation (~1-2 hours)
- **Phase 3**: Frontend updates (~30 minutes)
- **Phase 4**: Testing and validation (~30 minutes)

**Total Estimated Time**: 2.5-3 hours

## Notes
- All commit messages will be in English
- Documentation will be updated in PROJECT_DOCUMENTATION.md
- Changes will be tested thoroughly before finalization
- SQL migration script will be provided for manual execution if needed