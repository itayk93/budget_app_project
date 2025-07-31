import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal';
import './BudgetModal.css';

const EditTransactionModal = ({ 
  isOpen, 
  onClose, 
  transaction,
  onSave 
}) => {
  const [formData, setFormData] = useState({
    business_name: '',
    amount: '',
    payment_date: '',
    notes: '',
    currency: 'ILS'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && transaction) {
      setFormData({
        business_name: transaction.business_name || '',
        amount: Math.abs(transaction.amount || 0).toString(),
        payment_date: transaction.payment_date || '',
        notes: transaction.notes || '',
        currency: transaction.currency || 'ILS'
      });
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
      const updatedTransaction = {
        ...transaction,
        business_name: formData.business_name.trim(),
        amount: transaction.amount < 0 ? -Math.abs(parseFloat(formData.amount)) : Math.abs(parseFloat(formData.amount)),
        payment_date: formData.payment_date,
        notes: formData.notes.trim(),
        currency: formData.currency
      };

      await onSave(transaction.id, updatedTransaction);
      onClose();
    } catch (error) {
      setError('שגיאה בשמירת העסקה. אנא נסה שוב.');
      console.error('Error saving transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !transaction) return null;

  const isExpense = transaction.amount < 0;

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
      title="עריכת עסקה"
      footer={modalFooter}
      className="edit-transaction-modal"
      size="medium"
      closeOnBackdrop={true}
    >
      <div className="modal-body">
        {/* Transaction Type Info */}
        <div className="transaction-type-section">
          <h4>סוג העסקה</h4>
          <div className={`type-badge ${isExpense ? 'expense' : 'income'}`}>
            <i className={`fas ${isExpense ? 'fa-minus-circle' : 'fa-plus-circle'}`}></i>
            {isExpense ? 'הוצאה' : 'הכנסה'}
          </div>
        </div>

        {/* Business Name */}
        <div className="input-section">
          <label htmlFor="edit-business-name">שם העסק/התיאור</label>
          <input
            id="edit-business-name"
            type="text"
            value={formData.business_name}
            onChange={(e) => handleChange('business_name', e.target.value)}
            placeholder="הזן שם עסק או תיאור"
            disabled={isLoading}
            className="form-input"
          />
        </div>

        {/* Amount */}
        <div className="input-section">
          <label htmlFor="edit-amount">סכום</label>
          <div className="currency-input-group">
            <input
              id="edit-amount"
              type="number"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              placeholder="הזן סכום"
              disabled={isLoading}
              min="0"
              step="0.01"
              className="form-input"
            />
            <select
              value={formData.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              disabled={isLoading}
              className="currency-select"
            >
              <option value="ILS">₪ (שקל)</option>
              <option value="USD">$ (דולר)</option>
              <option value="EUR">€ (יורו)</option>
              <option value="GBP">£ (לירה)</option>
            </select>
          </div>
        </div>

        {/* Payment Date */}
        <div className="input-section">
          <label htmlFor="edit-date">תאריך תשלום</label>
          <input
            id="edit-date"
            type="date"
            value={formData.payment_date}
            onChange={(e) => handleChange('payment_date', e.target.value)}
            disabled={isLoading}
            className="form-input"
          />
        </div>

        {/* Notes */}
        <div className="input-section">
          <label htmlFor="edit-notes">הערות (אופציונלי)</label>
          <textarea
            id="edit-notes"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="הזן הערות נוספות"
            disabled={isLoading}
            rows="3"
            className="form-textarea"
          />
        </div>

        {/* Original Transaction Info */}
        <div className="original-info-section">
          <h4>מידע מקורי</h4>
          <div className="original-info-card">
            <div className="detail-row">
              <span className="detail-label">תאריך מקורי:</span>
              <span className="detail-value">{transaction.payment_date}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">סכום מקורי:</span>
              <span className="detail-value">{Math.abs(transaction.amount)} {transaction.currency || 'ILS'}</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i>
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EditTransactionModal;