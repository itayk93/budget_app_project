import { categoriesAPI } from '../../../services/api';

export class CategoryService {
  constructor() {
    this.categoriesData = [];
    this.isLoading = false;
    this.error = null;
  }

  async loadCategories() {
    if (this.isLoading) return this.categoriesData;
    
    this.isLoading = true;
    this.error = null;

    try {
      console.log('🔍 [CATEGORIES] Starting to load categories...');
      console.log('🔍 [CATEGORIES] Token exists:', !!localStorage.getItem('token'));
      console.log('🔍 [CATEGORIES] Token preview:', localStorage.getItem('token')?.substring(0, 20) + '...');
      
      const result = await categoriesAPI.getAll();
      
      console.log('🔍 [CATEGORIES] Raw API response:', result);
      console.log('🔍 [CATEGORIES] Is array?', Array.isArray(result));
      console.log('🔍 [CATEGORIES] Length:', result?.length || 'N/A');
      
      if (result && result.length > 0) {
        console.log('🔍 [CATEGORIES] First category structure:', result[0]);
      }
      
      this.categoriesData = result || [];
      return this.categoriesData;
    } catch (error) {
      console.error('❌ [CATEGORIES] Error loading categories:', error);
      console.error('❌ [CATEGORIES] Error status:', error.response?.status);
      console.error('❌ [CATEGORIES] Error message:', error.response?.data);
      console.error('❌ [CATEGORIES] Error headers:', error.response?.headers);
      
      this.error = error;
      this.categoriesData = [];
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  buildCategoryHierarchy(categories) {
    console.log('🔍 [HIERARCHY] Building hierarchy from categories:', categories);
    
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      console.log('⚠️ [HIERARCHY] No categories provided');
      return [];
    }
    
    const hierarchicalCategories = [];
    const processedCategories = new Set();
    
    // First, group categories by shared_category
    const sharedGroups = {};
    const standaloneCategories = [];
    
    categories.forEach(category => {
      const categoryName = typeof category === 'string' ? category : (category.name || category.category_name || '');
      const sharedCategory = typeof category === 'object' ? category.shared_category : null;
      const useSharedTarget = typeof category === 'object' ? category.use_shared_target : false;
      
      if (sharedCategory && useSharedTarget) {
        if (!sharedGroups[sharedCategory]) {
          sharedGroups[sharedCategory] = [];
        }
        sharedGroups[sharedCategory].push(category);
      } else {
        standaloneCategories.push(category);
      }
    });
    
    // Add shared category groups first
    Object.entries(sharedGroups).forEach(([sharedCategoryName, groupCategories]) => {
      // Add the shared category as parent
      hierarchicalCategories.push({
        name: sharedCategoryName,
        isParent: true,
        level: 0
      });
      
      // Add children categories
      groupCategories.forEach(category => {
        const categoryName = typeof category === 'string' ? category : (category.name || category.category_name || '');
        hierarchicalCategories.push({
          name: categoryName,
          isChild: true,
          level: 1,
          parent: sharedCategoryName
        });
        processedCategories.add(categoryName);
      });
    });
    
    // Add standalone categories
    standaloneCategories.forEach(category => {
      const categoryName = typeof category === 'string' ? category : (category.name || category.category_name || '');
      if (!processedCategories.has(categoryName)) {
        hierarchicalCategories.push({
          name: categoryName,
          isStandalone: true,
          level: 0
        });
      }
    });
    
    console.log('✅ [HIERARCHY] Built hierarchy:', hierarchicalCategories);
    return hierarchicalCategories;
  }

  filterCategories(categories, showNonCashFlowOnly) {
    if (showNonCashFlowOnly) {
      return categories.filter(category => {
        const categoryName = typeof category === 'string' ? category : (category.name || category.category_name || '');
        return categoryName.includes('לא תזרימיות');
      });
    }
    return categories;
  }

  getCategories() {
    return this.categoriesData;
  }

  getError() {
    return this.error;
  }

  getLoadingState() {
    return this.isLoading;
  }
}

const categoryServiceInstance = new CategoryService();
export default categoryServiceInstance;