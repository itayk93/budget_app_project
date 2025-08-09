/**
 * Backward Compatibility Wrapper
 * This wrapper ensures our modular services return the exact same format as the original
 */

const SharedUtilities = require('./SharedUtilities');
const UserService = require('./UserService');
const TransactionService = require('./TransactionService');
const CategoryService = require('./CategoryService');
const CashFlowService = require('./CashFlowService');
const BudgetService = require('./BudgetService');
const MissingMethods = require('./MissingMethods');
const AdditionalMethods = require('./AdditionalMethods');

/**
 * Helper function to unwrap our standard response format to match original behavior
 */
function unwrapResponse(responsePromise, defaultValue = null) {
  if (typeof responsePromise === 'function') {
    return async function(...args) {
      const result = await responsePromise.apply(this, args);
      
      // If it's our standard response format, unwrap it
      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success) {
          return result.data !== undefined ? result.data : defaultValue;
        } else {
          // For error cases, return the default value or throw
          if (defaultValue !== null) {
            return defaultValue;
          } else {
            throw new Error(result.error || 'Operation failed');
          }
        }
      }
      
      // If it's not our format, return as is
      return result;
    };
  }
  
  return responsePromise;
}

/**
 * Backward Compatible SupabaseService
 * All methods return the same format as the original service
 */
class BackwardCompatibleSupabaseService {
  
  // ===== SHARED UTILITIES (return raw values) =====
  static testConnection = unwrapResponse(SharedUtilities.testConnection, false);
  static getCurrencySymbol = SharedUtilities.getCurrencySymbol;
  static formatCurrency = SharedUtilities.formatCurrency;
  static getCategoryColor = SharedUtilities.getCategoryColor;
  static validateUserId = SharedUtilities.validateUserId;
  static validateAmount = SharedUtilities.validateAmount;
  static validateDateString = SharedUtilities.validateDateString;
  static handleSupabaseError = SharedUtilities.handleSupabaseError;
  static createSuccessResponse = SharedUtilities.createSuccessResponse;
  static createErrorResponse = SharedUtilities.createErrorResponse;

  // ===== USER MANAGEMENT (unwrap responses) =====
  static createUser = unwrapResponse(UserService.createUser, null);
  static getUserByEmail = unwrapResponse(UserService.getUserByEmail, null);
  static getUserByUsername = unwrapResponse(UserService.getUserByUsername, null);
  static getUserById = unwrapResponse(UserService.getUserById, null);
  static updateUserLastLogin = unwrapResponse(UserService.updateUserLastLogin, false);
  static updateUser = unwrapResponse(UserService.updateUser, null);
  static verifyPassword = UserService.verifyPassword; // Already returns boolean
  static verifyFlaskPassword = UserService.verifyFlaskPassword; // Already returns boolean
  static validateUserExists = UserService.validateUserExists;
  static isEmailTaken = UserService.isEmailTaken;
  static isUsernameTaken = UserService.isUsernameTaken;

  // ===== TRANSACTION MANAGEMENT (unwrap responses) =====
  static generateTransactionHash = TransactionService.generateTransactionHash;
  static checkTransactionExists = TransactionService.checkTransactionExists;
  static getTransactionByHash = unwrapResponse(TransactionService.getTransactionByHash, null);
  static getTransactionsByHash = TransactionService.getTransactionsByHash; // Returns array - no unwrapping needed
  static getExistingHashesBatch = TransactionService.getExistingHashesBatch;
  static getTransactions = unwrapResponse(TransactionService.getTransactions, { transactions: [], totalCount: 0 });
  static getTransactionById = unwrapResponse(TransactionService.getTransactionById, null);
  static getLatestTransactionMonth = unwrapResponse(TransactionService.getLatestTransactionMonth, null);
  static createTransaction = async function(...args) {
    try {
      const result = await TransactionService.createTransaction(...args);
      console.log(`[BackwardCompatibilityWrapper] createTransaction result:`, result);
      return result;
    } catch (error) {
      console.error(`[BackwardCompatibilityWrapper] createTransaction error:`, error);
      return { success: false, error: error.message };
    }
  };
  static updateTransaction = unwrapResponse(TransactionService.updateTransaction, null);
  static updateTransactionFlowMonth = unwrapResponse(TransactionService.updateTransactionFlowMonth, null);
  static deleteTransaction = unwrapResponse(TransactionService.deleteTransaction, null);

  // ===== CATEGORY MANAGEMENT (unwrap responses) =====
  static getCategories = unwrapResponse(CategoryService.getCategories, []);
  static getCategoriesByType = unwrapResponse(CategoryService.getCategoriesByType, []);
  static getUserCategoryOrder = CategoryService.getUserCategoryOrder; // Already returns array
  static initializeCategoryOrder = unwrapResponse(CategoryService.initializeCategoryOrder, true);
  static saveCategoryOrder = unwrapResponse(CategoryService.saveCategoryOrder, true);
  static reorderCategory = unwrapResponse(CategoryService.reorderCategory, null);
  static createCategory = unwrapResponse(CategoryService.createCategory, null);
  static updateCategory = unwrapResponse(CategoryService.updateCategory, null);
  static deleteCategory = unwrapResponse(CategoryService.deleteCategory, null);
  static getMostFrequentCategoryForBusiness = CategoryService.getMostFrequentCategoryForBusiness;
  static getAutoCategoryForBusiness = CategoryService.getAutoCategoryForBusiness;

  // ===== CASH FLOW MANAGEMENT (unwrap responses) =====
  static getCashFlows = unwrapResponse(CashFlowService.getCashFlows, []);
  static getCashFlow = unwrapResponse(CashFlowService.getCashFlow, null);
  static getDefaultCashFlow = unwrapResponse(CashFlowService.getDefaultCashFlow, null);
  static createCashFlow = unwrapResponse(CashFlowService.createCashFlow, null);
  static updateCashFlow = unwrapResponse(CashFlowService.updateCashFlow, null);
  static setDefaultCashFlow = unwrapResponse(CashFlowService.setDefaultCashFlow, null);
  static deleteCashFlow = unwrapResponse(CashFlowService.deleteCashFlow, false);
  static validateCashFlowAccess = unwrapResponse(CashFlowService.validateCashFlowAccess, false);
  static getCashFlowStatistics = unwrapResponse(CashFlowService.getCashFlowStatistics, null);

  // ===== BUDGET MANAGEMENT (unwrap responses) =====
  static getMonthlyBudgets = unwrapResponse(BudgetService.getMonthlyBudgets, []);
  static createMonthlyBudget = unwrapResponse(BudgetService.createMonthlyBudget, null);
  static updateMonthlyBudget = unwrapResponse(BudgetService.updateMonthlyBudget, null);
  static deleteMonthlyBudget = unwrapResponse(BudgetService.deleteMonthlyBudget, null);
  static getMonthlySavings = unwrapResponse(BudgetService.getMonthlySavings, 0);
  static getMonthlyGoal = unwrapResponse(BudgetService.getMonthlyGoal, null);
  static saveMonthlyGoal = unwrapResponse(BudgetService.saveMonthlyGoal, null);
  static deleteMonthlyGoal = unwrapResponse(BudgetService.deleteMonthlyGoal, null);
  static addGoalAsExpense = unwrapResponse(BudgetService.addGoalAsExpense, null);
  static removeGoalExpense = unwrapResponse(BudgetService.removeGoalExpense, null);
  static addGoalAsFutureIncome = unwrapResponse(BudgetService.addGoalAsFutureIncome, null);
  static removeGoalIncome = unwrapResponse(BudgetService.removeGoalIncome, null);
  static updateCategoryMonthlyTarget = unwrapResponse(BudgetService.updateCategoryMonthlyTarget, null);
  static getCategoryMonthlyTarget = unwrapResponse(BudgetService.getCategoryMonthlyTarget, null);
  static getBudgetAnalysis = unwrapResponse(BudgetService.getBudgetAnalysis, null);

  // ===== MISSING METHODS (unwrap responses) =====
  static createTransactionsBatch = MissingMethods.createTransactionsBatch; // Already returns correct format
  static getTransactionsByHashes = unwrapResponse(MissingMethods.getTransactionsByHashes, []);
  static getTransactionsByHash = unwrapResponse(MissingMethods.getTransactionsByHash, []);
  static processTransactionsByCategory = unwrapResponse(MissingMethods.processTransactionsByCategory, null);
  static groupCategoriesByShared = unwrapResponse(MissingMethods.groupCategoriesByShared, null);
  static calculateMonthlyAverage = unwrapResponse(MissingMethods.calculateMonthlyAverage, null);
  static getSharedCategoryMonthlySpending = unwrapResponse(MissingMethods.getSharedCategoryMonthlySpending, null);
  static getLatestTransactionDate = unwrapResponse(MissingMethods.getLatestTransactionDate, null);

  // ===== ADDITIONAL CRITICAL METHODS (unwrap responses) =====
  static getDashboardData = unwrapResponse(AdditionalMethods.getDashboardData, null);
  static getUserPreference = unwrapResponse(AdditionalMethods.getUserPreference, null);
  static setUserPreference = unwrapResponse(AdditionalMethods.setUserPreference, null);
  static inferCategoryType = AdditionalMethods.inferCategoryType; // Static method, no unwrapping needed
  static getSharedCategoryTarget = unwrapResponse(AdditionalMethods.getSharedCategoryTarget, null);
  static updateSharedCategoryTarget = unwrapResponse(AdditionalMethods.updateSharedCategoryTarget, null);
  static setUseSharedTarget = unwrapResponse(AdditionalMethods.setUseSharedTarget, null);
  static getCategoryMonthlySpending = unwrapResponse(AdditionalMethods.getCategoryMonthlySpending, null);
  static getCategorySpendingHistory = unwrapResponse(AdditionalMethods.getCategorySpendingHistory, null);
  static calculateWeeklyTarget = unwrapResponse(AdditionalMethods.calculateWeeklyTarget, null);
  static shouldRefreshMonthlyTargets = unwrapResponse(AdditionalMethods.shouldRefreshMonthlyTargets, true);
  static refreshMonthlyTargetsForNewMonth = unwrapResponse(AdditionalMethods.refreshMonthlyTargetsForNewMonth, null);
  static calculateAndUpdateSharedCategoryTargets = unwrapResponse(AdditionalMethods.calculateAndUpdateSharedCategoryTargets, null);

  // ===== SERVICE ACCESS =====
  static get Services() {
    return {
      SharedUtilities,
      UserService,
      TransactionService,
      CategoryService,
      CashFlowService,
      BudgetService,
      MissingMethods,
      AdditionalMethods
    };
  }

  // ===== MIGRATION UTILITY =====
  static isMigrated() {
    return true;
  }

  static getModuleInfo() {
    return {
      totalModules: 8,
      modules: [
        { name: 'SharedUtilities', purpose: 'Common utilities and validation' },
        { name: 'UserService', purpose: 'User authentication and management' },
        { name: 'TransactionService', purpose: 'Transaction CRUD operations' },
        { name: 'CategoryService', purpose: 'Category management and ordering' },
        { name: 'CashFlowService', purpose: 'Cash flow management' },
        { name: 'BudgetService', purpose: 'Budget and goal management' },
        { name: 'MissingMethods', purpose: 'Additional compatibility methods' },
        { name: 'AdditionalMethods', purpose: 'Dashboard and preference methods' }
      ],
      originalSize: '2994 lines',
      newSize: '~2500 lines across 8 modules',
      benefits: [
        'Better maintainability',
        'Easier testing',
        'Clear separation of concerns',
        'Improved team collaboration',
        'Reduced memory footprint per operation',
        'Full backward compatibility'
      ]
    };
  }
}

module.exports = BackwardCompatibleSupabaseService;