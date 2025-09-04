import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal';
import CategoryAutocomplete from '../Common/CategoryAutocomplete';
import './BudgetModal.css'; // Using same CSS styles
import './CategoryChangeModal.css'; // Custom styles for category change modal

const CategoryTransferModal = ({ 
  isOpen, 
  onClose, 
  transaction,
  onTransfer 
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryField, setShowNewCategoryField] = useState(false);
  const [autocompleteValue, setAutocompleteValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');


  useEffect(() => {
    if (isOpen) {
      setNewCategoryName('');
      setShowNewCategoryField(false);
      setAutocompleteValue('');
      setError('');
    }
  }, [isOpen]);


  const handleAutocompleteChange = (value) => {
    setAutocompleteValue(value);
    // If user selects "הוסף קטגוריה חדשה" we'll handle it in the transfer
    if (value === '➕ הוסף קטגוריה חדשה') {
      setShowNewCategoryField(true);
    } else {
      setShowNewCategoryField(false);
      setNewCategoryName('');
    }
  };

  const handleTransfer = async () => {
    let categoryToUse;
    
    if (showNewCategoryField) {
      categoryToUse = newCategoryName.trim();
    } else if (autocompleteValue === '➕ הוסף קטגוריה חדשה') {
      setError('אנא הזן שם לקטגוריה החדשה');
      return;
    } else {
      categoryToUse = autocompleteValue.trim();
    }
    
    if (!categoryToUse) {
      setError('אנא בחר קטגוריה או הזן שם קטגוריה חדשה');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onTransfer(transaction.id, categoryToUse);
      onClose();
    } catch (error) {
      setError('שגיאה בשינוי הקטגוריה. אנא נסה שוב.');
      console.error('Error transferring category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !transaction) {
    return null;
  }

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
        onClick={handleTransfer}
        disabled={isLoading || (!autocompleteValue.trim() && !newCategoryName.trim())}
      >
        {isLoading ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            מעביר...
          </>
        ) : (
          'העבר קטגוריה'
        )}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="שינוי קטגוריה"
      footer={modalFooter}
      className="category-change-modal"
    >
      <div className="modal-body">
          {/* Transaction Info */}
          <div className="transaction-info-section">
            <h4>פרטי העסקה</h4>
            <div className="transaction-details-card">
              <div className="detail-row">
                <span className="detail-label">עסק:</span>
                <span className="detail-value">{transaction.business_name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">סכום:</span>
                <span className="detail-value">{Math.abs(transaction.amount)} ₪</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">קטגוריה נוכחית:</span>
                <span className="detail-value">{transaction.category_name || 'ללא קטגוריה'}</span>
              </div>
            </div>
          </div>

          {/* Category Selection */}
          <div className="category-selection-section">
            <label htmlFor="category-autocomplete">בחר או הקלד קטגוריה חדשה</label>
            <CategoryAutocomplete
              value={autocompleteValue}
              onChange={handleAutocompleteChange}
              placeholder="הקלד לחיפוש קטגוריה או הזן קטגוריה חדשה..."
              disabled={isLoading}
              autoFocus={true}
            />
            
            {/* Option to add new category */}
            {autocompleteValue && !showNewCategoryField && (
              <div className="new-category-option">
                <button
                  type="button"
                  className="btn-link-style"
                  onClick={() => {
                    setShowNewCategoryField(true);
                    setNewCategoryName(autocompleteValue);
                    setAutocompleteValue('➕ הוסף קטגוריה חדשה');
                  }}
                  disabled={isLoading}
                >
                  ➕ הוסף "{autocompleteValue}" כקטגוריה חדשה
                </button>
              </div>
            )}
          </div>

          {/* New Category Field */}
          {showNewCategoryField && (
            <div className="new-category-section">
              <label htmlFor="new-category-name">שם הקטגוריה החדשה</label>
              <input
                id="new-category-name"
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="הכנס שם קטגוריה חדשה..."
                disabled={isLoading}
                autoFocus
                maxLength="50"
              />
            </div>
          )}

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

export default CategoryTransferModal;