import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  timeout: 600000, // 10 minutes for large file processing
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create separate axios instance for auth calls (without interceptors to prevent infinite loops)
const authAxios = axios.create({
  baseURL: 'http://localhost:5001/api',
  timeout: 30000, // 30 seconds for auth calls
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to auth requests
authAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for auth axios to extract data (same as main api)
authAxios.interceptors.response.use(
  (response) => response.data,
  (error) => {
    return Promise.reject(error);
  }
);

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to verify token using separate auth instance (prevents infinite loop)
        await authAxios.get('/auth/verify');
        // Get the new token
        const newToken = localStorage.getItem('token');
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API (uses separate instance to prevent infinite loops)
export const authAPI = {
  login: (credentials) => authAxios.post('/auth/login', credentials),
  register: (userData) => authAxios.post('/auth/register', userData),
  logout: () => authAxios.post('/auth/logout'),
  verifyToken: () => authAxios.get('/auth/verify'),
  getCurrentUser: () => authAxios.get('/auth/me'),
};

// Users API
export const usersAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/password', data),
  deleteAccount: (data) => api.delete('/users/account', { data }),
  
  // User Preferences
  getUserPreferences: () => api.get('/users/preferences'),
  getUserPreference: (key) => api.get(`/users/preferences/${key}`),
  setUserPreference: (key, value) => api.put(`/users/preferences/${key}`, { value }),
};

// Categories API
export const categoriesAPI = {
  getAll: () => {
    console.log('🔍 [Categories API] Making getAll request...');
    return api.get('/categories').then(result => {
      console.log('🔍 [Categories API] getAll response:', result);
      console.log('🔍 [Categories API] response type:', typeof result);
      console.log('🔍 [Categories API] is array?', Array.isArray(result));
      console.log('🔍 [Categories API] length:', result?.length);
      return result;
    }).catch(error => {
      console.error('❌ [Categories API] getAll error:', error);
      console.error('❌ [Categories API] error status:', error.response?.status);
      console.error('❌ [Categories API] error data:', error.response?.data);
      throw error;
    });
  },
  getByType: (type) => api.get(`/categories/type/${type}`),
  getDefault: () => api.get('/categories/default'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
  getTransactions: (id, params) => api.get(`/categories/${id}/transactions`, { params }),
  
  // Category order and display APIs
  getOrder: () => api.get('/categories/order'),
  reorder: (data) => api.post('/categories/reorder', data),
  updateSharedCategory: (data) => api.post('/categories/update-shared-category', data),
  updateWeeklyDisplay: (data) => api.post('/categories/update-weekly-display', data),
  
  // Monthly target APIs
  calculateMonthlyTarget: (data) => api.post('/categories/calculate-monthly-target', data),
  updateMonthlyTarget: (data) => api.post('/categories/update-monthly-target', data),
  getMonthlySpending: (categoryName, year = null, month = null) => {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;
    
    return api.get(`/categories/monthly-spending/${encodeURIComponent(categoryName)}`, { params });
  },
  getSpendingHistory: (categoryName, months = 12) => api.get(`/categories/spending-history/${encodeURIComponent(categoryName)}`, { params: { months } }),
  
  // Monthly targets refresh APIs
  shouldRefreshTargets: () => api.get('/categories/should-refresh-targets'),
  refreshMonthlyTargets: () => api.post('/categories/refresh-monthly-targets'),
  
  // Shared category targets APIs
  getSharedTarget: (sharedCategoryName) => api.get(`/categories/shared-target/${encodeURIComponent(sharedCategoryName)}`),
  updateSharedTarget: (data) => api.post('/categories/update-shared-target', data),
  getSharedSpending: (sharedCategoryName, year = null, month = null) => {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;
    
    return api.get(`/categories/shared-spending/${encodeURIComponent(sharedCategoryName)}`, { params });
  },
  setUseSharedTarget: (data) => api.post('/categories/set-use-shared-target', data),
  calculateSharedTargets: (data) => api.post('/categories/calculate-shared-targets', data),
  
  // Business mappings
  getBusinessMappings: (params) => api.get('/categories/business-mappings', { params }),
  importMappings: (data) => api.post('/categories/import-mappings', data),
};

// Transactions API
export const transactionsAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
  createTransfer: (data) => api.post('/transactions/transfer', data),
  batchUpdate: (data) => api.put('/transactions/batch', data),
  getAnalyticsByCategory: (params) => api.get('/transactions/analytics/by-category', { params }),
  getStats: (params) => api.get('/transactions/analytics/stats', { params }),
  getDuplicates: (params) => api.get('/transactions/duplicates', { params }),
  
  // Business details for specific transaction
  getBusinessDetails: (id) => api.get(`/transactions/${id}/business-details`),
  
  // Additional API endpoints for frontend compatibility
  recordAsIncome: (data) => api.post('/transactions/api/transactions/record-as-income', data),
  getUniqueCategories: async () => {
    console.log('🔍 [Transactions API] Making getUniqueCategories request...');
    try {
      const result = await api.get('/transactions/api/transactions/unique_categories');
      console.log('🔍 [Transactions API] getUniqueCategories response:', result);
      return result;
    } catch (error) {
      console.error('❌ [Transactions API] getUniqueCategories error:', error);
      throw error;
    }
  },
  batchCategorize: (data) => api.post('/transactions/api/transactions/batch_categorize', data),
  deleteAllByCashFlow: (data) => api.post('/transactions/api/transactions/delete_by_cash_flow', data),
  
  // Split transaction
  split: (data) => api.post('/transactions/split', data),
  unsplit: (data) => api.post('/transactions/unsplit', data),
};

// Budgets API
export const budgetsAPI = {
  getAll: () => api.get('/budgets'),
  getMonthly: (year, month) => api.get(`/budgets/monthly/${year}/${month}`),
  create: (data) => api.post('/budgets', data),
  createMonthly: (data) => api.post('/budgets/monthly', data),
  getByCategory: (categoryId) => api.get(`/budgets/category/${categoryId}`),
  getMonthlyByCategory: (year, month, categoryId) => 
    api.get(`/budgets/monthly/${year}/${month}/${categoryId}`),
  delete: (id) => api.delete(`/budgets/${id}`),
  deleteMonthly: (id) => api.delete(`/budgets/monthly/${id}`),
  getAverage: (categoryId, year, month) => 
    api.get(`/budgets/category/${categoryId}/average/${year}/${month}`),
};

// Cash Flows API
export const cashFlowsAPI = {
  getAll: () => api.get('/cashflows'),
  getDefault: () => api.get('/cashflows/default'),
  create: (data) => api.post('/cashflows', data),
  update: (id, data) => api.put(`/cashflows/${id}`, data),
  setDefault: (id) => api.put(`/cashflows/${id}/default`),
  delete: (id) => api.delete(`/cashflows/${id}`),
  getLatestTransactionDate: (id, fileSource = null) => {
    const params = fileSource ? { file_source: fileSource } : {};
    return api.get(`/cashflows/${id}/latest-transaction-date`, { params });
  },
};

// Reports API
export const reportsAPI = {
  getMonthly: (year, month, params) => 
    api.get(`/reports/monthly/${year}/${month}`, { params }),
  getYearly: (year, params) => 
    api.get(`/reports/yearly/${year}`, { params }),
  getCategoryTrends: (categoryId, params) => 
    api.get(`/reports/category-trends/${categoryId}`, { params }),
  getCashFlowComparison: (year, month) => 
    api.get(`/reports/cash-flows-comparison/${year}/${month}`),
};

// Upload API
export const uploadAPI = {
  // Legacy single-step upload
  uploadTransactions: (formData) => api.post('/upload/transactions', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 300000, // 5 minutes for file upload processing
  }),
  
  // Multi-step upload process
  initiateUpload: (formData) => api.post('/upload/initiate', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 300000, // 5 minutes for file upload processing
  }),
  
  checkDuplicates: (data) => api.post('/upload/check-duplicates', data),
  
  finalizeImport: (data) => api.post('/upload/finalize', data),
  
  getProgress: (uploadId) => api.get(`/upload/progress/${uploadId}`),
  
  // Currency Groups API
  getCurrencyGroups: (tempId) => api.get(`/upload/review_currency_groups/${tempId}`),
  
  handleCurrencyGroups: (data) => api.post('/upload/handle_currency_groups', data),
  
  getCurrencyGroupsProgress: (tempId) => api.get(`/upload/currency_groups_progress/${tempId}`),
  
  // Create EventSource for currency groups progress (SSE)
  createCurrencyGroupsProgressStream: (tempId) => {
    // Note: EventSource doesn't support custom headers, so we need to handle auth differently
    // For now, we'll use the polling endpoint instead
    return null;
  },
  
  // Duplicates API
  getDuplicates: (tempId) => api.get(`/upload/duplicates/${tempId}`),
  
  handleDuplicates: (data) => api.post('/upload/handle-duplicates', data),
  
  checkDuplicateFileStatus: (data) => api.post('/upload/api/check_duplicate_file_status', data),
  
  // Other upload endpoints
  getFormats: () => api.get('/upload/formats'),
  getTemplates: (bank) => api.get(`/upload/templates/${bank}`),
  exportTransactions: (params) => api.get('/upload/export/transactions', {
    params,
    responseType: 'blob',
  }),
  getHistory: (params) => api.get('/upload/history', { params }),
};

// Monthly Goals API
export const monthlyGoalsAPI = {
  get: (year, month, cashFlowId) => api.get(`/monthly-goals/${year}/${month}`, {
    params: { cash_flow_id: cashFlowId }
  }),
  save: (data) => api.post('/monthly-goals', data),
  delete: (year, month, cashFlowId) => api.delete(`/monthly-goals/${year}/${month}`, {
    params: { cash_flow_id: cashFlowId }
  }),
};

// Stocks API (placeholder)
export const stocksAPI = {
  getPortfolio: () => api.get('/stocks/portfolio'),
  addStock: (data) => api.post('/stocks/portfolio', data),
  getPrices: () => api.get('/stocks/prices'),
  updatePrices: () => api.post('/stocks/prices/update'),
};

// Health check
export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;