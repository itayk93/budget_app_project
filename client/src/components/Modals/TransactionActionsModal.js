import React from 'react';
import Modal from '../Common/Modal';
import './TransactionActionsModal.css';

const TransactionActionsModal = ({ isOpen, onClose, transaction, categoryName, onAction }) => {
  if (!isOpen || !transaction) return null;

  const handleAction = (actionType) => {
    console.log('🔍 [TransactionActionsModal] Action clicked:', actionType, 'for transaction:', transaction?.id);
    onAction(actionType, transaction);
    console.log('🔍 [TransactionActionsModal] Closing actions modal after action:', actionType);
    onClose();
  };

  const handleBackdropClick = (e) => {
    // Only close if clicking on the backdrop itself, not on any child elements
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="transaction-actions-modal" size="small">
      <div className="modal-header">
        <h3>פעולות עבור: {transaction.business_name || transaction.description || 'עסקה ללא שם'}</h3>
        <button className="close-btn" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      <div className="modal-body">
        <div className="transaction-info">
          <div className="amount">{Math.abs(parseFloat(transaction.amount || 0)).toFixed(1)} ₪</div>
          <div className="date">{transaction.payment_date}</div>
          {transaction.payment_number && transaction.total_payments && (
            <div className="payment-info">תשלום {transaction.payment_number}/{transaction.total_payments}</div>
          )}
        </div>
        <div className="actions-grid">
          <button className="action-item" onClick={() => handleAction('edit')}>
            <i className="fas fa-edit"></i>
            <span>עריכת עסקה</span>
          </button>
          <button className="action-item" onClick={() => handleAction('category')}>
            <i className="fas fa-tag"></i>
            <span>שינוי קטגוריה</span>
          </button>
          <button className="action-item" onClick={() => handleAction('copy')}>
            <i className="fas fa-copy"></i>
            <span>העתקה כהכנסה/הוצאה</span>
          </button>
          <button className="action-item" onClick={() => handleAction('split')}>
            <i className="fas fa-cut"></i>
            <span>פיצול עסקה</span>
          </button>
          <button className="action-item" onClick={() => handleAction('month')}>
            <i className="fas fa-calendar-alt"></i>
            <span>העברה לחודש אחר</span>
          </button>
          {transaction.currency === 'USD' && 
           parseFloat(transaction.amount) < 0 &&
           transaction.business_name === 'הפקדה לחשבון השקעות' && (
            <button className="action-item" onClick={() => handleAction('link')}>
              <i className="fas fa-link"></i>
              <span>קישור להפקדה</span>
            </button>
          )}
          <button className="action-item danger" onClick={() => handleAction('delete')}>
            <i className="fas fa-trash"></i>
            <span>מחיקת עסקה</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TransactionActionsModal;
