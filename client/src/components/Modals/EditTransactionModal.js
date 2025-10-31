import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal';
import CategoryDropdown from '../Upload/CategoryDropdown';
import { transactionsAPI } from '../../services/api';
import './EditTransactionModal.css';

const EditTransactionModal = ({ 
  isOpen, 
  onClose, 
  transaction,
  onSave,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    business_name: '',
    amount: '',
    payment_date: '',
    category_name: '',
    payment_method: 'credit_card',
    notes: '',
    currency: 'ILS'
  });
  const [isExpense, setIsExpense] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && transaction) {
      setFormData({
        business_name: transaction.business_name || '',
        amount: Math.abs(transaction.amount || 0).toString(),
        payment_date: (transaction.payment_date || '').split('T')[0],
        category_name: transaction.category_name || '',
        payment_method: transaction.payment_method || 'credit_card',
        notes: transaction.notes || '',
        currency: transaction.currency || 'ILS'
      });
      setIsExpense((transaction.amount || 0) < 0);
      setError('');
    }
  }, [isOpen, transaction]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.business_name.trim()) {
      setError('אנא הזן שם עסק');
      return;
    }

    if (!formData.amount || isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
      setError('אנא הזן סכום תקין');
      return;
    }

    if (!formData.payment_date) {
      setError('אנא בחר תאריך');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const rawAmount = Math.abs(parseFloat(formData.amount));
      const updatedTransaction = {
        ...transaction,
        business_name: formData.business_name.trim(),
        amount: isExpense ? -Math.abs(rawAmount) : Math.abs(rawAmount),
        payment_date: formData.payment_date,
        category_name: formData.category_name || null,
        payment_method: formData.payment_method || 'credit_card',
        notes: formData.notes.trim(),
        currency: formData.currency
      };

      if (onSave) {
        await onSave(transaction.id, updatedTransaction);
      } else {
        await transactionsAPI.update(transaction.id, updatedTransaction);
      }
      if (typeof onSuccess === 'function') {
        try { onSuccess(); } catch(e) { /* no-op */ }
      }
      onClose();
    } catch (error) {
      setError('שגיאה בשמירת העסקה. אנא נסה שוב.');
      console.error('Error saving transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !transaction) return null;

  const modalFooter = (
    <div className="modal-footer">
      <button 
        className="btn btn-secondary" 
        onClick={onClose}
        disabled={isLoading}
      >
        ביטול
      </button>
      
      <button 
        className="btn btn-primary" 
        onClick={handleSave}
        disabled={isLoading || !formData.business_name.trim() || !formData.amount}
      >
        {isLoading ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            שומר...
          </>
        ) : (
          <>
            <i className="fas fa-save"></i>
            שמור שינויים
          </>
        )}
      </button>
    </div>
  );

  return (
    <Modal 
      isOpen={isOpen}
      onClose={onClose}
      title="עריכת תנועה"
      footer={modalFooter}
      className="transactions-modal"
      size="medium"
      closeOnBackdrop={true}
    >
      <div className="modal-body">
        {/* Type Toggle */}
        <div className="form-group">
          <label className="form-label">סוג תנועה</label>
          <div className="type-toggle">
            <button type="button" className={`toggle-btn ${isExpense ? 'active' : ''}`} onClick={() => setIsExpense(true)} disabled={isLoading}>הוצאה</button>
            <button type="button" className={`toggle-btn ${!isExpense ? 'active' : ''}`} onClick={() => setIsExpense(false)} disabled={isLoading}>הכנסה</button>
          </div>
        </div>

        {/* Row: Business + Amount */}
        <div className="form-row two-cols">
          <div className="form-group">
            <label className="form-label">שם העסק</label>
            <input
              type="text"
              className="form-input"
              value={formData.business_name}
              onChange={(e) => handleChange('business_name', e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">סכום</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-input"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value.replace(/-/g, ''))}
              onKeyDown={(e) => { if (e.key === '-' || e.key === 'Subtract') e.preventDefault(); }}
              disabled={isLoading}
              required
            />
          </div>
        </div>

        {/* Row: Date + Category */}
        <div className="form-row two-cols">
          <div className="form-group">
            <label className="form-label">תאריך</label>
            <input
              type="date"
              className="form-input"
              value={formData.payment_date}
              onChange={(e) => handleChange('payment_date', e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">קטגוריה</label>
            <CategoryDropdown
              value={formData.category_name}
              onChange={(categoryName) => handleChange('category_name', categoryName)}
              placeholder="בחר קטגוריה..."
            />
          </div>
        </div>

        {/* Payment Method */}
        <div className="form-group">
          <label className="form-label">אמצעי תשלום</label>
          <select
            className="form-select"
            value={formData.payment_method}
            onChange={(e) => handleChange('payment_method', e.target.value)}
            disabled={isLoading}
          >
            <option value="credit_card">כרטיס אשראי</option>
            <option value="debit_card">כרטיס חיוב</option>
            <option value="cash">מזומן</option>
            <option value="bank_transfer">העברה בנקאית</option>
            <option value="check">צ'ק</option>
          </select>
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="form-label">תיאור</label>
          <textarea
            className="form-textarea"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows="3"
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="form-error">
            <i className="fas fa-exclamation-triangle"></i>
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EditTransactionModal;
