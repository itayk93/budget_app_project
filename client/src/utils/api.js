import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// BudgetLens comparison API
export const uploadBudgetLensFile = async (formData) => {
  const token = localStorage.getItem('token');
  const response = await axios.post('/api/budgetlens/compare', formData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export default api;
