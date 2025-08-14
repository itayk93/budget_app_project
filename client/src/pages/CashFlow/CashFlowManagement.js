import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import api from '../../utils/api';
import './CashFlowManagement.css';

const CashFlowManagement = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [newFlow, setNewFlow] = useState({
    name: '',
    description: '',
    currency: 'ILS',
    is_monthly: true,
    is_investment_account: false,
    is_default: false
  });
  const queryClient = useQueryClient();

  // Fetch cash flows
  const { data: cashFlows, isLoading, error } = useQuery(
    'cashFlows',
    async () => {
      const response = await api.get('/cashflows');
      return response.data;
    }
  );

  // Create cash flow mutation
  const createMutation = useMutation(
    (flowData) => api.post('/cashflows', flowData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('cashFlows');
        setShowCreateForm(false);
        resetForm();
      }
    }
  );

  // Update cash flow mutation
  const updateMutation = useMutation(
    ({ id, data }) => api.put(`/cashflows/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('cashFlows');
        setEditingFlow(null);
      }
    }
  );

  // Delete cash flow mutation
  const deleteMutation = useMutation(
    (id) => {
      console.log('🗑️ [CLIENT] Making DELETE request to /cashflows/' + id);
      return api.delete(`/cashflows/${id}`);
    },
    {
      onSuccess: (data) => {
        console.log('🗑️ [CLIENT] Delete successful:', data);
        queryClient.invalidateQueries('cashFlows');
      },
      onError: (error) => {
        console.error('🗑️ [CLIENT] Delete failed:', error);
        alert('שגיאה במחיקת התזרים: ' + (error.response?.data?.error || error.message));
      }
    }
  );

  // Set as default mutation
  const setDefaultMutation = useMutation(
    (id) => api.put(`/cashflows/${id}/set-default`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('cashFlows');
      }
    }
  );

  const resetForm = () => {
    setNewFlow({
      name: '',
      description: '',
      currency: 'ILS',
      is_monthly: true,
      is_investment_account: false,
      is_default: false
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingFlow) {
      updateMutation.mutate({ id: editingFlow.id, data: newFlow });
    } else {
      createMutation.mutate(newFlow);
    }
  };

  const handleEdit = (flow) => {
    setEditingFlow(flow);
    setNewFlow({
      name: flow.name,
      description: flow.description || '',
      currency: flow.currency,
      is_monthly: flow.is_monthly,
      is_investment_account: flow.is_investment_account,
      is_default: flow.is_default
    });
    setShowCreateForm(true);
  };

  const handleDelete = (flow) => {
    console.log('🗑️ [CLIENT] handleDelete called for flow:', flow);
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את התזרים "${flow.name}"?`)) {
      console.log('🗑️ [CLIENT] User confirmed deletion, calling deleteMutation.mutate with ID:', flow.id);
      deleteMutation.mutate(flow.id);
    } else {
      console.log('🗑️ [CLIENT] User cancelled deletion');
    }
  };

  const handleSetDefault = (flow) => {
    if (!flow.is_default) {
      setDefaultMutation.mutate(flow.id);
    }
  };

  const getCurrencySymbol = (currency) => {
    const symbols = {
      'ILS': '₪',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };
    return symbols[currency] || currency;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('he-IL');
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>שגיאה בטעינת תזרימי המזומנים: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="cash-flow-management">
      <div className="page-header">
        <h1>ניהול תזרימי מזומנים</h1>
        <p className="page-description">
          נהל את כל תזרימי המזומנים שלך - חשבונות בנק, חשבונות השקעות ועוד
        </p>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setShowCreateForm(true);
            setEditingFlow(null);
            resetForm();
          }}
        >
          תזרים חדש +
        </button>
      </div>

      {(showCreateForm || editingFlow) && (
        <div className="create-form-container">
          <div className="form-header">
            <h2>{editingFlow ? 'עריכת תזרים' : 'יצירת תזרים חדש'}</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="cash-flow-form">
            <div className="form-group">
              <label htmlFor="name">שם התזרים *</label>
              <input
                type="text"
                id="name"
                value={newFlow.name}
                onChange={(e) => setNewFlow({ ...newFlow, name: e.target.value })}
                required
                placeholder="למשל: חשבון עו״ש, תיק השקעות..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">תיאור</label>
              <textarea
                id="description"
                value={newFlow.description}
                onChange={(e) => setNewFlow({ ...newFlow, description: e.target.value })}
                placeholder="תיאור אופציונלי של התזרים"
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="currency">מטבע</label>
                <select
                  id="currency"
                  value={newFlow.currency}
                  onChange={(e) => setNewFlow({ ...newFlow, currency: e.target.value })}
                >
                  <option value="ILS">שקל ישראלי (₪)</option>
                  <option value="USD">דולר אמריקאי ($)</option>
                  <option value="EUR">יורו (€)</option>
                  <option value="GBP">פאונד בריטי (£)</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={createMutation.isLoading || updateMutation.isLoading}
              >
                {createMutation.isLoading || updateMutation.isLoading ? 'שומר...' : 
                 editingFlow ? 'עדכן תזרים' : 'צור תזרים'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingFlow(null);
                  resetForm();
                }}
              >
                ביטול
              </button>
            </div>

            <div className="form-checkboxes">
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="is_monthly"
                  checked={newFlow.is_monthly}
                  onChange={(e) => setNewFlow({ ...newFlow, is_monthly: e.target.checked })}
                />
                <label htmlFor="is_monthly">תזרים חודשי</label>
              </div>

              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="is_investment_account"
                  checked={newFlow.is_investment_account}
                  onChange={(e) => setNewFlow({ ...newFlow, is_investment_account: e.target.checked })}
                />
                <label htmlFor="is_investment_account">חשבון השקעות</label>
              </div>

              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={newFlow.is_default}
                  onChange={(e) => setNewFlow({ ...newFlow, is_default: e.target.checked })}
                />
                <label htmlFor="is_default">תזרים ברירת מחדל</label>
              </div>
            </div>

          </form>
        </div>
      )}

      <div className="cash-flows-grid">
        {cashFlows && cashFlows.length > 0 ? (
          cashFlows.map(flow => (
            <div key={flow.id} className={`cash-flow-card ${flow.is_default ? 'default' : ''}`}>
              <div className="card-header">
                <h3 className="flow-name">{flow.name}</h3>
                <div className="flow-badges">
                  {flow.is_default && <span className="badge default">ברירת מחדל</span>}
                  {flow.is_investment_account && <span className="badge investment">השקעות</span>}
                  <span className="badge currency">{getCurrencySymbol(flow.currency)}</span>
                </div>
              </div>

              {flow.description && (
                <p className="flow-description">{flow.description}</p>
              )}

              <div className="flow-details">
                <div className="detail-item">
                  <span className="label">סוג:</span>
                  <span className="value">
                    {flow.is_investment_account ? 'חשבון השקעות' : 
                     flow.is_monthly ? 'תזרים חודשי' : 'תזרים רגיל'}
                  </span>
                </div>
                
                <div className="detail-item">
                  <span className="label">נוצר:</span>
                  <span className="value">{formatDate(flow.created_at)}</span>
                </div>

                {flow.updated_at !== flow.created_at && (
                  <div className="detail-item">
                    <span className="label">עודכן:</span>
                    <span className="value">{formatDate(flow.updated_at)}</span>
                  </div>
                )}
              </div>

              <div className="card-actions">
                <button
                  className="btn btn-small btn-secondary"
                  onClick={() => handleEdit(flow)}
                >
                  ערוך
                </button>
                
                {!flow.is_default && (
                  <button
                    className="btn btn-small btn-primary"
                    onClick={() => handleSetDefault(flow)}
                    disabled={setDefaultMutation.isLoading}
                  >
                    הגדר כברירת מחדל
                  </button>
                )}
                
                <button
                  className="btn btn-small btn-danger"
                  onClick={() => handleDelete(flow)}
                  disabled={deleteMutation.isLoading}
                >
                  מחק
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <h3>אין תזרימי מזומנים</h3>
            <p>צור תזרים ראשון כדי להתחיל לנהל את הכספים שלך</p>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setShowCreateForm(true);
                setEditingFlow(null);
                resetForm();
              }}
            >
              צור תזרים ראשון
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashFlowManagement;