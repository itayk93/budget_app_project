import React, { useState } from 'react';
import Modal from '../Common/Modal';
import './BudgetModal.css';

const DeleteTransactionModal = ({ 
  isOpen, 
  onClose, 
  transaction,
  onDelete 
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);

    try {
      await onDelete(transaction.id);
      onClose();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      // Could add error handling here
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
        className="btn btn-danger" 
        onClick={handleDelete}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            מוחק...
          </>
        ) : (
          <>
            <i className="fas fa-trash"></i>
            מחק עסקה
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
      title="מחיקת עסקה"
      footer={modalFooter}
      className="delete-transaction-modal"
      size="medium"
    >
      <div className="modal-body">
        {/* Warning Message */}
        <div className="warning-section">
          <div className="danger-alert">
            <div className="alert-icon">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <div className="alert-content">
              <h4>האם אתה בטוח שברצונך למחוק את העסקה הזו?</h4>
              <p><strong>פעולה זו לא ניתנת לביטול!</strong></p>
            </div>
          </div>
        </div>

        {/* Transaction Info */}
        <div className="transaction-info-section">
          <h4>פרטי העסקה</h4>
          <div className="transaction-details-card delete-card">
            <div className="detail-row">
              <span className="detail-label">עסק:</span>
              <span className="detail-value">{transaction.business_name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">סכום:</span>
              <span className="detail-value">{Math.abs(transaction.amount)} ₪</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">תאריך:</span>
              <span className="detail-value">{transaction.payment_date}</span>
            </div>
            {transaction.category_name && (
              <div className="detail-row">
                <span className="detail-label">קטגוריה:</span>
                <span className="detail-value">{transaction.category_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Impact Warning */}
        <div className="impact-warning">
          <div className="warning-card">
            <h5>
              <i className="fas fa-info-circle"></i>
              השפעת המחיקה
            </h5>
            <ul>
              <li>העסקה תוסר מחישובי התקציב החודשי</li>
              <li>המאזן החודשי יעודכן בהתאם</li>
              <li>אם יש קשר לקטגוריות או יעדים, הם יעודכנו</li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteTransactionModal;