/**
 * Modular Supabase Service - Main Entry Point
 * Replaces the monolithic supabaseService.js (2994 lines)
 * This file combines all modular services into a single interface
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
 * Main SupabaseService class that provides a unified interface
 * to all the modular services while maintaining backward compatibility
 */
class SupabaseService {
  
  // ===== SHARED UTILITIES =====
  static testConnection = SharedUtilities.testConnection;
  static getCurrencySymbol = SharedUtilities.getCurrencySymbol;
  static formatCurrency = SharedUtilities.formatCurrency;
  static getCategoryColor = SharedUtilities.getCategoryColor;
  static validateUserId = SharedUtilities.validateUserId;
  static validateAmount = SharedUtilities.validateAmount;
  static validateDateString = SharedUtilities.validateDateString;
  static handleSupabaseError = SharedUtilities.handleSupabaseError;
  static createSuccessResponse = SharedUtilities.createSuccessResponse;
  static createErrorResponse = SharedUtilities.createErrorResponse;

  // ===== USER MANAGEMENT =====
  static createUser = UserService.createUser;
  static getUserByEmail = UserService.getUserByEmail;
  static getUserByUsername = UserService.getUserByUsername;
  static getUserById = UserService.getUserById;
  static updateUserLastLogin = UserService.updateUserLastLogin;
  static updateUser = UserService.updateUser;
  static verifyPassword = UserService.verifyPassword;
  static verifyFlaskPassword = UserService.verifyFlaskPassword;
  static validateUserExists = UserService.validateUserExists;
  static isEmailTaken = UserService.isEmailTaken;
  static isUsernameTaken = UserService.isUsernameTaken;

  // ===== TRANSACTION MANAGEMENT =====
  static generateTransactionHash = TransactionService.generateTransactionHash;
  static checkTransactionExists = TransactionService.checkTransactionExists;
  static getTransactionByHash = TransactionService.getTransactionByHash;
  static getExistingHashesBatch = TransactionService.getExistingHashesBatch;
  static getTransactions = TransactionService.getTransactions;
  static getTransactionById = TransactionService.getTransactionById;
  static getLatestTransactionMonth = TransactionService.getLatestTransactionMonth;
  static createTransaction = TransactionService.createTransaction;
  static updateTransaction = TransactionService.updateTransaction;
  static updateTransactionFlowMonth = TransactionService.updateTransactionFlowMonth;
  static deleteTransaction = TransactionService.deleteTransaction;

  // ===== CATEGORY MANAGEMENT =====
  static getCategories = CategoryService.getCategories;
  static getCategoriesByType = CategoryService.getCategoriesByType;
  static getUserCategoryOrder = CategoryService.getUserCategoryOrder;
  static initializeCategoryOrder = CategoryService.initializeCategoryOrder;
  static saveCategoryOrder = CategoryService.saveCategoryOrder;
  static reorderCategory = CategoryService.reorderCategory;
  static createCategory = CategoryService.createCategory;
  static updateCategory = CategoryService.updateCategory;
  static deleteCategory = CategoryService.deleteCategory;
  static getBusinessCategoryDefault = CategoryService.getBusinessCategoryDefault;
  static getMostFrequentCategoryForBusiness = CategoryService.getMostFrequentCategoryForBusiness;
  static getAutoCategoryForBusiness = CategoryService.getAutoCategoryForBusiness;

  // ===== CASH FLOW MANAGEMENT =====
  static getCashFlows = CashFlowService.getCashFlows;
  static getCashFlow = CashFlowService.getCashFlow;
  static getDefaultCashFlow = CashFlowService.getDefaultCashFlow;
  static createCashFlow = CashFlowService.createCashFlow;
  static updateCashFlow = CashFlowService.updateCashFlow;
  static setDefaultCashFlow = CashFlowService.setDefaultCashFlow;
  static deleteCashFlow = CashFlowService.deleteCashFlow;
  static validateCashFlowAccess = CashFlowService.validateCashFlowAccess;
  static getCashFlowStatistics = CashFlowService.getCashFlowStatistics;

  // ===== BUDGET MANAGEMENT =====
  static getMonthlyBudgets = BudgetService.getMonthlyBudgets;
  static createMonthlyBudget = BudgetService.createMonthlyBudget;
  static updateMonthlyBudget = BudgetService.updateMonthlyBudget;
  static deleteMonthlyBudget = BudgetService.deleteMonthlyBudget;
  static getMonthlySavings = BudgetService.getMonthlySavings;
  static getMonthlyGoal = BudgetService.getMonthlyGoal;
  static saveMonthlyGoal = BudgetService.saveMonthlyGoal;
  static deleteMonthlyGoal = BudgetService.deleteMonthlyGoal;
  static addGoalAsExpense = BudgetService.addGoalAsExpense;
  static removeGoalExpense = BudgetService.removeGoalExpense;
  static addGoalAsFutureIncome = BudgetService.addGoalAsFutureIncome;
  static removeGoalIncome = BudgetService.removeGoalIncome;
  static updateCategoryMonthlyTarget = BudgetService.updateCategoryMonthlyTarget;
  static getCategoryMonthlyTarget = BudgetService.getCategoryMonthlyTarget;
  static getBudgetAnalysis = BudgetService.getBudgetAnalysis;

  // ===== MISSING METHODS (ADDED FOR FULL COMPATIBILITY) =====
  static createTransactionsBatch = MissingMethods.createTransactionsBatch;
  static getTransactionsByHashes = MissingMethods.getTransactionsByHashes;
  static getTransactionsByHash = MissingMethods.getTransactionsByHash;
  static processTransactionsByCategory = MissingMethods.processTransactionsByCategory;
  static groupCategoriesByShared = MissingMethods.groupCategoriesByShared;
  static calculateMonthlyAverage = MissingMethods.calculateMonthlyAverage;
  static getSharedCategoryMonthlySpending = MissingMethods.getSharedCategoryMonthlySpending;
  static getLatestTransactionDate = MissingMethods.getLatestTransactionDate;

  // ===== ADDITIONAL CRITICAL METHODS =====
  static getDashboardData = AdditionalMethods.getDashboardData;
  static getUserPreference = AdditionalMethods.getUserPreference;
  static setUserPreference = AdditionalMethods.setUserPreference;
  static getSharedCategoryTarget = AdditionalMethods.getSharedCategoryTarget;
  static updateSharedCategoryTarget = AdditionalMethods.updateSharedCategoryTarget;
  static setUseSharedTarget = AdditionalMethods.setUseSharedTarget;
  static getCategoryMonthlySpending = AdditionalMethods.getCategoryMonthlySpending;
  static getCategorySpendingHistory = AdditionalMethods.getCategorySpendingHistory;
  static calculateWeeklyTarget = AdditionalMethods.calculateWeeklyTarget;
  static shouldRefreshMonthlyTargets = AdditionalMethods.shouldRefreshMonthlyTargets;
  static refreshMonthlyTargetsForNewMonth = AdditionalMethods.refreshMonthlyTargetsForNewMonth;
  static calculateAndUpdateSharedCategoryTargets = AdditionalMethods.calculateAndUpdateSharedCategoryTargets;

  // ===== SERVICE ACCESS =====
  // Provide direct access to service modules for advanced usage
  static get Services() {
    return {
      SharedUtilities,
      UserService,
      TransactionService,
      CategoryService,
      CashFlowService,
      BudgetService
    };
  }

  // ===== MIGRATION UTILITY =====
  static isMigrated() {
    return true; // This modular version indicates successful migration
  }

  static getModuleInfo() {
    return {
      totalModules: 6,
      modules: [
        { name: 'SharedUtilities', purpose: 'Common utilities and validation' },
        { name: 'UserService', purpose: 'User authentication and management' },
        { name: 'TransactionService', purpose: 'Transaction CRUD operations' },
        { name: 'CategoryService', purpose: 'Category management and ordering' },
        { name: 'CashFlowService', purpose: 'Cash flow management' },
        { name: 'BudgetService', purpose: 'Budget and goal management' }
      ],
      originalSize: '2994 lines',
      newSize: '~1600 lines across 6 modules',
      benefits: [
        'Better maintainability',
        'Easier testing',
        'Clear separation of concerns',
        'Improved team collaboration',
        'Reduced memory footprint per operation'
      ]
    };
  }
}

module.exports = SupabaseService;
