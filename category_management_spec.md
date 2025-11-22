# Technical Specification: Categories Management Screen

## Overview
The Categories Management Screen allows users to manage their financial categories including reordering, setting shared categories, and configuring display options. This screen provides a comprehensive interface for users to customize how their categories are organized and displayed throughout the application.

## Features

### 1. Category Ordering
- **Drag-and-drop interface** for reordering categories
- **Arrow buttons** for moving categories:
  - Move to top (⬆️⬆️)
  - Move up (⬆️)
  - Move down (⬇️)
  - Move to bottom (⬇️⬇️)
- **Specific position** option (📍) to move a category to a specific position
- Automatic **saving with debounce** (800ms delay) to reduce API calls
- Visual indicators showing the current position (#1, #2, etc.)

### 2. Category Information Display
- **Category name** (category_name)
- **Position number** (display_order)
- **Transaction count** for each category
- **Shared category** indicator if applicable
- Visual indication when no categories exist

### 3. Shared Category Management
- **Dropdown selector** to assign a category to an existing shared category
- **Custom category** option to create a new shared category
- **List of existing shared categories** displayed at the top of the screen
- Ability to remove shared category assignment (clear to empty)

### 4. Weekly Display Configuration
- **Checkbox toggle** to enable/disable weekly view display for each category
- When enabled, the category will be displayed with weekly breakdown instead of monthly view
- Visual feedback when the setting is changed

### 5. Real-time Status
- **Saving indicator** showing when changes are being saved
- **Last saved timestamp** showing when the last successful save occurred
- **Success/error alerts** for user actions
- **Debounced saving** to prevent excessive API calls

## Technical Implementation

### Frontend Components
- **React component**: CategoryOrder.js
- **State management**:
  - categories: Array of category objects
  - sharedCategories: Array of shared category names
  - loading/error states
  - saving status
  - last saved timestamp
- **API integration** via fetch calls with authentication
- **Debounced saving** using setTimeout for performance optimization

### Backend API Endpoints
- **GET /api/categories/order**: Retrieve user's category order and settings
- **POST /api/categories/reorder**: Update display order of categories
- **POST /api/categories/order**: Create new category in category_order table
- **POST /api/categories/update-shared-category**: Update shared category assignment
- **POST /api/categories/update-weekly-display**: Update weekly display setting

### Database Schema
The categories management uses the `category_order` table with the following structure:
- `id`: UUID, primary key
- `user_id`: UUID, foreign key to user
- `category_name`: VARCHAR(255), the category name
- `display_order`: INTEGER, the display order (0-based index)
- `shared_category`: VARCHAR(255), optional shared category grouping
- `weekly_display`: BOOLEAN, whether to show in weekly view (default: false)
- `monthly_target`: DECIMAL(10,2), monthly spending target (nullable)
- `created_at`: TIMESTAMPTZ, creation timestamp
- `updated_at`: TIMESTAMPTZ, update timestamp

### Authentication & Security
- **JWT token authentication** required for all endpoints
- **Row-level security (RLS)** policies ensure users can only access their own category data
- **Input validation** on all API endpoints
- **CSRF protection** through token verification

## User Experience

### Loading States
- Initial loading screen with spinner
- Error state with retry option
- Saving indicators during operations

### Error Handling
- Network error detection and user notification
- Validation error handling
- Graceful degradation when API calls fail
- Alert messages for successful operations and errors

### Responsive Design
- Works on mobile, tablet, and desktop
- Responsive grid layout that adapts to screen size
- Touch-friendly controls for mobile devices

## Future Enhancements

### Potential Additions
- Bulk category operations (multi-select for moving, grouping, etc.)
- Category color coding
- Category icons
- Category templates for new users
- Advanced filtering options
- Export/import category configurations
- Category hierarchy (parent-child relationships)

### Performance Considerations
- Pagination for users with many categories
- Virtual scrolling for large category lists
- Optimistic updates for better UX

## Project Files

### Frontend Files
- **`client/src/pages/CategoryOrder/CategoryOrder.js`**: Main React component for the categories management screen
- **`client/src/App.js`**: Route configuration for the category order page
- **`client/src/services/api.js`**: API service functions related to category management

### Backend Files
- **`server/routes/categories/categoriesOrder.js`**: API routes for category management (order, shared categories, weekly display)
- **`server/services/supabase-modules/CategoryService.js`**: Business logic for category operations
- **`server/services/supabase-modules/AdditionalMethods.js`**: Additional methods for category processing
- **`server/services/supabase-modules/index.js`**: Module exports for category services
- **`server/middleware/auth.js`**: Authentication middleware used by category endpoints

### Database Files
- **`sql/create_category_order_table.sql`**: Initial table creation for category_order
- **`sql/add_weekly_display_column.sql`**: Adds weekly_display column to category_order table
- **`sql/add_monthly_target_column.sql`**: Adds monthly_target column to category_order table
- **`sql/enable_rls_security.sql`**: Row-level security policies for category_order table
- **`sql/initialize_monthly_targets.sql`**: Initializes monthly targets for categories

### Additional Related Files
- **`server/services/supabaseService.js`**: Main Supabase service that may include category-related methods
- **`server/services/supabase-modules/BackwardCompatibilityWrapper.js`**: Wrapper for backward compatibility of category methods

## Dependencies
- React 17+ for frontend components
- Supabase for database operations
- Express.js for backend API
- Tailwind CSS for styling
- JWT for authentication

## API Response Format
```javascript
{
  "categories": [
    {
      "id": "uuid",
      "category_name": "string",
      "display_order": "integer",
      "shared_category": "string or null",
      "weekly_display": "boolean",
      "monthly_target": "decimal or null",
      "transaction_count": "integer"
    }
  ],
  "total_count": "integer",
  "sharedCategories": ["string"]
}
```