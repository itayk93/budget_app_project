import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal';
import './BudgetModal.css';

const CopyTransactionModal = ({ 
  isOpen, 
  onClose, 
  transaction,
  onCopy 
}) => {
  const [copyType, setCopyType] = useState('expense'); // 'income' or 'expense'
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && transaction) {
      const originalAmount = Math.abs(transaction.amount || 0);
      setAmount(originalAmount.toString());
      setDescription(transaction.business_name || '');
      setDate(new Date().toISOString().split('T')[0]); // Today's date
      setCopyType(transaction.amount < 0 ? 'expense' : 'income');
      setError('');
    }
  }, [isOpen, transaction]);

  const handleCopy = async () => {
    if (!amount || !description) {
      setError('אנא מלא את כל השדות הנדרשים');
      return;
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
      setError('אנא הזן סכום תקין');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const newTransaction = {
        business_name: description,
        amount: copyType === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
        payment_date: date,
        currency: 'ILS',
        copy_of: transaction.id
      };

      await onCopy(newTransaction);
      onClose();
    } catch (error) {
      setError('שגיאה בהעתקת העסקה. אנא נסה שוב.');
      console.error('Error copying transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
        onClick={handleCopy}
        disabled={isLoading || !amount || !description}
      >
        {isLoading ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            מעתיק...
          </>
        ) : (
          <>
            <i className="fas fa-copy"></i>
            העתק עסקה
          </>
        )}
      </button>
    </div>
  );

  if (!isOpen || !transaction) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="העתקת עסקה"
      footer={modalFooter}
      className="copy-transaction-modal"
      size="medium"
    >
      <div className="modal-body">
        {/* Original Transaction Info */}
        <div className="transaction-info-section">
          <h4>עסקה מקורית</h4>
          <div className="transaction-details-card">
            <div className="detail-row">
              <span className="detail-label">עסק:</span>
              <span className="detail-value">{transaction.business_name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">סכום מקורי:</span>
              <span className="detail-value">{Math.abs(transaction.amount)} ₪</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">תאריך:</span>
              <span className="detail-value">{transaction.payment_date}</span>
            </div>
          </div>
        </div>

        {/* Copy Type Selection */}
        <div className="copy-type-section">
          <label>סוג העסקה החדשה</label>
          <div className="transaction-type-options">
            <label className="type-option expense-option">
              <input
                type="radio"
                name="copyType"
                value="expense"
                checked={copyType === 'expense'}
                onChange={(e) => setCopyType(e.target.value)}
                disabled={isLoading}
              />
              <div className="type-content">
                <i className="fas fa-minus-circle"></i>
                <span>הוצאה</span>
              </div>
            </label>
            <label className="type-option income-option">
              <input
                type="radio"
                name="copyType"
                value="income"
                checked={copyType === 'income'}
                onChange={(e) => setCopyType(e.target.value)}
                disabled={isLoading}
              />
              <div className="type-content">
                <i className="fas fa-plus-circle"></i>
                <span>הכנסה</span>
              </div>
            </label>
          </div>
        </div>

        {/* Amount Input */}
        <div className="input-section">
          <label htmlFor="copy-amount">סכום (₪)</label>
          <input
            id="copy-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="הזן סכום"
            disabled={isLoading}
            min="0"
            step="0.01"
            className="form-input"
          />
        </div>

        {/* Description Input */}
        <div className="input-section">
          <label htmlFor="copy-description">תיאור</label>
          <input
            id="copy-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="הזן תיאור לעסקה"
            disabled={isLoading}
            className="form-input"
          />
        </div>

        {/* Date Input */}
        <div className="input-section">
          <label htmlFor="copy-date">תאריך</label>
          <input
            id="copy-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={isLoading}
            className="form-input"
          />
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

export default CopyTransactionModal;