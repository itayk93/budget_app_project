/**
 * Category Service for Supabase Operations
 * Extracted from supabaseService.js - Category management operations
 * ~300 lines - Handles all category-related database operations
 */

const { adminClient, createUserClient } = require('../../config/supabase');
const SharedUtilities = require('./SharedUtilities');

class CategoryService {

  // ===== CATEGORY RETRIEVAL =====
  
  static async getCategories(userId = null, userClient = null) {
    try {
      const logger = require('../../utils/logger');
      logger.debug('CATEGORY SERVICE', 'Getting categories for user', { userId });
      const client = userClient || adminClient;
      
      // TEMP FIX: Get categories from category_order instead of category table
      if (userId) {
        logger.debug('CATEGORY SERVICE', 'Using category_order table as temp fix...');
        const { data: categoryOrder, error } = await client
          .from('category_order')
          .select('*')
          .eq('user_id', userId)
          .order('display_order');
          
        if (error) {
          console.error('🔍 [CATEGORY SERVICE] category_order error:', error);
          throw error;
        }
        
        logger.debug('CATEGORY SERVICE', 'Category order results', { count: categoryOrder?.length || 0 });
        
        // Convert category_order to category format - include ALL fields for hierarchy
        const categories = categoryOrder?.map(order => ({
          id: order.id,
          name: order.category_name,
          category_name: order.category_name,
          user_id: order.user_id,
          created_at: order.created_at,
          updated_at: order.updated_at,
          category_type: 'variable_expense',
          color: '#2196F3',
          is_default: false,
          display_order: order.display_order,
          // Include hierarchy fields for dropdown grouping
          shared_category: order.shared_category,
          use_shared_category: order.use_shared_category,
          icon: order.icon || '📝',
          // Include weekly display field
          weekly_display: order.weekly_display,
          show_in_weekly_view: order.weekly_display
        })) || [];
        
        logger.debug('CATEGORY SERVICE', 'Converted categories', { count: categories.length });
        return SharedUtilities.createSuccessResponse(categories);
      }

      // Initialize category order if user is provided
      if (userId) {
        await this.initializeCategoryOrder(userId, client);
      }

      let query = client
        .from('category')
        .select('*');

      if (userId) {
        // Get categories for specific user
        query = query.eq('user_id', userId);
      }

      logger.debug('CATEGORY SERVICE', 'Executing query...');
      const { data: categories, error } = await query.order('name');
      logger.debug('CATEGORY SERVICE', 'Raw categories from DB', { count: categories?.length || 0 });
      if (error) {
        console.error('🔍 [CATEGORY SERVICE] DB Error:', error);
        throw error;
      }

      // Ensure each category has required fields
      const processedCategories = categories.map(category => ({
        ...category,
        category_type: category.category_type || 'variable_expense',
        color: category.color || SharedUtilities.getCategoryColor(category.name),
        is_default: category.is_default || false
      }));

      // Apply user's preferred category order if user_id is provided
      if (userId) {
        logger.debug('CATEGORY SERVICE', 'Getting user category order...');
        const preferredOrder = await this.getUserCategoryOrder(userId, client);
        logger.debug('CATEGORY SERVICE', 'Preferred order count', { count: preferredOrder?.length || 0 });
        if (preferredOrder && preferredOrder.length > 0) {
          const categoryMap = {};
          processedCategories.forEach(cat => {
            categoryMap[cat.name] = cat;
          });

          const orderedCategories = [];
          
          // Add categories in the preferred order first
          preferredOrder.forEach(orderItem => {
            if (categoryMap[orderItem.category_name]) {
              orderedCategories.push(categoryMap[orderItem.category_name]);
            }
          });
          
          // Then add any remaining categories
          processedCategories.forEach(cat => {
            if (!preferredOrder.some(item => item.category_name === cat.name)) {
              orderedCategories.push(cat);
            }
          });
          
          return SharedUtilities.createSuccessResponse(orderedCategories);
        }
      }

      return SharedUtilities.createSuccessResponse(processedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      
      // Fallback categories if database fetch fails
      const fallbackCategories = [
        { id: 'variable_expenses', name: 'הוצאות משתנות', category_type: 'variable_expense', color: '#2196F3' },
        { id: 'fixed_expenses', name: 'הוצאות קבועות', category_type: 'fixed_expense', color: '#9C27B0' },
        { id: 'income', name: 'הכנסות', category_type: 'income', color: '#4CAF50' }
      ];
      return SharedUtilities.createSuccessResponse(fallbackCategories);
    }
  }

  static async getCategoriesByType(userId, categoryType, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      const { data, error } = await client
        .from('category')
        .select('*')
        .eq('user_id', userId)
        .eq('category_type', categoryType)
        .order('name');

      if (error) throw error;

      const processedCategories = data.map(category => ({
        ...category,
        color: category.color || SharedUtilities.getCategoryColor(category.name)
      }));

      return SharedUtilities.createSuccessResponse(processedCategories);
    } catch (error) {
      console.error('Error fetching categories by type:', error);
      return SharedUtilities.handleSupabaseError(error, 'fetch categories by type');
    }
  }

  // ===== CATEGORY ORDER MANAGEMENT =====

  static async getUserCategoryOrder(userId, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      const { data, error } = await client
        .from('category_order')
        .select('*')
        .eq('user_id', userId)
        .order('display_order');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting category order:', error);
      return [];
    }
  }

  static async initializeCategoryOrder(userId, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      // Check if user already has category order
      const existingOrder = await this.getUserCategoryOrder(userId, client);
      if (existingOrder.length > 0) {
        return SharedUtilities.createSuccessResponse(true, 'Category order already initialized');
      }

      // Get all available categories
      const categoriesResult = await this.getCategories(userId, client);
      const categories = categoriesResult.success ? categoriesResult.data : [];
      
      // Initialize order for each category
      const orderData = categories.map((category, index) => ({
        user_id: userId,
        category_name: category.name,
        display_order: index + 1,
        created_at: new Date().toISOString()
      }));

      if (orderData.length > 0) {
        const { error } = await client
          .from('category_order')
          .insert(orderData);

        if (error) throw error;
      }

      return SharedUtilities.createSuccessResponse(true, 'Category order initialized successfully');
    } catch (error) {
      console.error('Error initializing category order:', error);
      return SharedUtilities.handleSupabaseError(error, 'initialize category order');
    }
  }

  static async saveCategoryOrder(userId, categoryOrder, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      if (!Array.isArray(categoryOrder)) {
        return SharedUtilities.createErrorResponse('Category order must be an array');
      }

      // Delete existing order
      const { error: deleteError } = await client
        .from('category_order')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Insert new order
      const orderData = categoryOrder.map((item, index) => ({
        user_id: userId,
        category_name: typeof item === 'string' ? item : item.category_name,
        display_order: index + 1,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await client
        .from('category_order')
        .insert(orderData);

      if (insertError) throw insertError;

      return SharedUtilities.createSuccessResponse(true, 'Category order saved successfully');
    } catch (error) {
      console.error('Error saving category order:', error);
      return SharedUtilities.handleSupabaseError(error, 'save category order');
    }
  }

  static async reorderCategory(userId, categoryId, direction, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      if (!['up', 'down'].includes(direction)) {
        return SharedUtilities.createErrorResponse('Direction must be "up" or "down"');
      }

      const currentOrder = await this.getUserCategoryOrder(userId, client);
      if (!currentOrder || currentOrder.length === 0) {
        return SharedUtilities.createErrorResponse('No category order found');
      }

      // Find the category to move
      const categoryIndex = currentOrder.findIndex(item => 
        item.category_name === categoryId || item.id === categoryId
      );

      if (categoryIndex === -1) {
        return SharedUtilities.createErrorResponse('Category not found in order');
      }

      // Calculate new position
      let newIndex;
      if (direction === 'up' && categoryIndex > 0) {
        newIndex = categoryIndex - 1;
      } else if (direction === 'down' && categoryIndex < currentOrder.length - 1) {
        newIndex = categoryIndex + 1;
      } else {
        return SharedUtilities.createErrorResponse('Cannot move category in that direction');
      }

      // Swap positions
      const newOrder = [...currentOrder];
      [newOrder[categoryIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[categoryIndex]];

      // Save the new order
      return await this.saveCategoryOrder(userId, newOrder.map(item => item.category_name), client);
    } catch (error) {
      console.error('Error reordering category:', error);
      return SharedUtilities.handleSupabaseError(error, 'reorder category');
    }
  }

  // ===== CATEGORY CREATION AND MANAGEMENT =====

  static async createCategory(userId, categoryData, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      const { name, category_type, color, is_default = false } = categoryData;

      if (!name || !category_type) {
        return SharedUtilities.createErrorResponse('Category name and type are required');
      }

      // Check if category already exists for this user
      const { data: existingCategory, error: checkError } = await client
        .from('category')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingCategory) {
        return SharedUtilities.createErrorResponse('Category already exists');
      }

      const categoryToInsert = {
        user_id: userId,
        name,
        category_type,
        color: color || SharedUtilities.getCategoryColor(name),
        is_default,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from('category')
        .insert([categoryToInsert])
        .select()
        .single();

      if (error) throw error;

      // Add to category order
      const currentOrder = await this.getUserCategoryOrder(userId, client);
      const newOrderItem = {
        user_id: userId,
        category_name: name,
        display_order: currentOrder.length + 1,
        created_at: new Date().toISOString()
      };

      await client
        .from('category_order')
        .insert([newOrderItem]);

      return SharedUtilities.createSuccessResponse(data, 'Category created successfully');
    } catch (error) {
      console.error('Error creating category:', error);
      return SharedUtilities.handleSupabaseError(error, 'create category');
    }
  }

  static async updateCategory(userId, categoryId, updateData, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      if (!categoryId) {
        return SharedUtilities.createErrorResponse('Category ID is required');
      }

      const processedUpdateData = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from('category')
        .update(processedUpdateData)
        .eq('id', categoryId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return SharedUtilities.createSuccessResponse(data, 'Category updated successfully');
    } catch (error) {
      console.error('Error updating category:', error);
      return SharedUtilities.handleSupabaseError(error, 'update category');
    }
  }

  static async deleteCategory(userId, categoryId, userClient = null) {
    try {
      SharedUtilities.validateUserId(userId);
      const client = userClient || adminClient;

      if (!categoryId) {
        return SharedUtilities.createErrorResponse('Category ID is required');
      }

      // First get the category to get its name for order cleanup
      const { data: categoryData, error: fetchError } = await client
        .from('category')
        .select('name')
        .eq('id', categoryId)
        .eq('user_id', userId)
        .single();

      if (fetchError) throw fetchError;

      // Delete the category
      const { data, error } = await client
        .from('category')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      // Remove from category order
      if (categoryData) {
        await client
          .from('category_order')
          .delete()
          .eq('user_id', userId)
          .eq('category_name', categoryData.name);
      }

      return SharedUtilities.createSuccessResponse(data, 'Category deleted successfully');
    } catch (error) {
      console.error('Error deleting category:', error);
      return SharedUtilities.handleSupabaseError(error, 'delete category');
    }
  }

  // ===== BUSINESS-CATEGORY MAPPING =====

  static async getMostFrequentCategoryForBusiness(businessName, userId = null, userClient = null) {
    try {
      if (!businessName) {
        return null;
      }
      const client = userClient || adminClient;
      const logger = require('../../utils/logger');
      logger.debug('CATEGORY', 'Searching for business frequency', { businessName, userId });

      let query = client
        .from('transactions')
        .select('category_name')
        .eq('business_name', businessName)
        .not('category_name', 'is', null);
        // Using category_name directly - no need for category_id

      // Add user filter if provided
      if (userId) {
        query = query.eq('user_id', userId);
        logger.debug('CATEGORY', 'Added userId filter', { userId });
      } else {
        logger.warn('CATEGORY', 'No userId provided - searching across all users');
      }

      const { data, error } = await query;

      if (error) throw error;

      logger.debug('CATEGORY', 'Query result count', { count: data ? data.length : 0 });

      if (!data || data.length === 0) {
        logger.debug('CATEGORY', 'No transactions found for business', { businessName });
        return null;
      }

      // Count frequency of each category
      const categoryFrequency = {};
      data.forEach(transaction => {
        const category = transaction.category_name;
        if (category) {
          categoryFrequency[category] = (categoryFrequency[category] || 0) + 1;
        }
      });

      logger.debug('CATEGORY', 'Category frequency', { businessName, categoryFrequency });

      // Find most frequent category
      let mostFrequentCategory = null;
      let maxCount = 0;

      for (const [category, count] of Object.entries(categoryFrequency)) {
        if (count > maxCount) {
          maxCount = count;
          mostFrequentCategory = category;
        }
      }

      logger.debug('CATEGORY', 'Most frequent category', { businessName, mostFrequentCategory, count: maxCount });
      return mostFrequentCategory;
    } catch (error) {
      console.error('Error getting most frequent category for business:', error);
      return null;
    }
  }

  static async getAutoCategoryForBusiness(businessName, amount, sourceType = null, userId = null, userClient = null) {
    try {
      if (!businessName) {
        return null;
      }
      const client = userClient || adminClient;

      // First try to get the most frequent category for this business
      const frequentCategory = await this.getMostFrequentCategoryForBusiness(businessName, userId, client);
      
      if (frequentCategory) {
        const logger = require('../../utils/logger');
        logger.debug('AUTO-CATEGORY', 'Found frequent category', { businessName, frequentCategory });
        return frequentCategory;
      } else {
        const logger = require('../../utils/logger');
        logger.debug('AUTO-CATEGORY', 'No frequent category found, using patterns', { businessName });
      }

      // If no frequent category found, use business name patterns or amount-based logic
      const businessLower = businessName.toLowerCase();
      
      // Common business patterns
      const categoryPatterns = {
        'הוצאות קבועות': ['ביט', 'בזק', 'חברת חשמל', 'מי אביבים', 'ארנונה', 'ביטוח'],
        'הוצאות משתנות': ['שופרסל', 'רמי לוי', 'טיב טעם', 'מגה', 'סופר'],
        'בילויים ואוכל': ['מקדונלד', 'בורגר', 'פיצה', 'קפה', 'מסעדה'],
        'תחבורה': ['דלק', 'בזין', 'חניה', 'מוניות', 'אוטובוס']
      };

      for (const [category, patterns] of Object.entries(categoryPatterns)) {
        if (patterns.some(pattern => businessLower.includes(pattern))) {
          return category;
        }
      }

      // Default fallback based on amount
      if (amount && parseFloat(amount) > 1000) {
        return 'הוצאות קבועות';
      }

      return 'הוצאות משתנות'; // Default category
    } catch (error) {
      console.error('Error getting auto category for business:', error);
      return 'הוצאות משתנות'; // Default fallback
    }
  }
}

module.exports = CategoryService;
