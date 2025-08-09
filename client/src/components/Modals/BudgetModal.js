import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal';
import './BudgetModal.css';

const BudgetModal = ({ 
  isOpen, 
  onClose, 
  categoryName, 
  currentBudget = 0, 
  onSave,
  onDelete 
}) => {
  const [budgetAmount, setBudgetAmount] = useState(currentBudget);
  const [averages, setAverages] = useState({ months3: 0, months12: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && categoryName) {
      setBudgetAmount(currentBudget);
      setError('');
      loadCategoryAverages();
    }
  }, [isOpen, categoryName, currentBudget]);

  const loadCategoryAverages = async () => {
    try {
      // TODO: Implement API call to get category averages
      // For now, setting dummy data
      setAverages({
        months3: Math.round(Math.random() * 1000),
        months12: Math.round(Math.random() * 800)
      });
    } catch (error) {
      console.error('Error loading averages:', error);
    }
  };

  const handleSave = async () => {
    if (!budgetAmount || budgetAmount <= 0) {
      setError('אנא הזן סכום תקין גדול מ-0');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onSave(categoryName, budgetAmount);
      onClose();
    } catch (error) {
      setError('שגיאה בשמירת היעד. אנא נסה שוב.');
      console.error('Error saving budget:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את היעד עבור "${categoryName}"?`)) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onDelete(categoryName);
      onClose();
    } catch (error) {
      setError('שגיאה במחיקת היעד. אנא נסה שוב.');
      console.error('Error deleting budget:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatCurrency = (amount) => {
    // Handle null, undefined, or invalid amounts
    if (amount === null || amount === undefined || isNaN(amount)) {
      amount = 0;
    }
    
    // Ensure amount is a number
    const numericAmount = Number(amount);
    
    return `${Math.round(numericAmount)} ₪`;
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
      
      {currentBudget > 0 && (
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
              מחק יעד
            </>
          )}
        </button>
      )}
      
      <button 
        className="btn btn-primary" 
        onClick={handleSave}
        disabled={isLoading || !budgetAmount}
      >
        {isLoading ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            שומר...
          </>
        ) : (
          <>
            <i className="fas fa-save"></i>
            שמור יעד
          </>
        )}
      </button>
    </div>
  );

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="הגדרת יעד לקטגוריה"
      footer={modalFooter}
      className="budget-modal"
      size="medium"
    >
      <div className="modal-body">
        {/* Category Info */}
        <div className="category-info-section">
          <h4>קטגוריה: <span className="category-name">{categoryName}</span></h4>
        </div>

        {/* Budget Input */}
        <div className="budget-input-section">
          <label htmlFor="budget-amount">יעד חודשי (₪)</label>
          <input
            id="budget-amount"
            type="number"
            value={budgetAmount}
            onChange={(e) => setBudgetAmount(Number(e.target.value))}
            placeholder="הזן סכום יעד חודשי"
            disabled={isLoading}
            min="0"
            step="1"
          />
        </div>

        {/* Averages Info */}
        <div className="averages-info-section">
          <div className="info-card">
            <h5>מידע סטטיסטי</h5>
            <div className="averages-grid">
              <div className="average-item">
                <span className="average-label">ממוצע 3 חודשים אחרונים:</span>
                <span className="average-value">{formatCurrency(averages.months3)}</span>
              </div>
              <div className="average-item">
                <span className="average-label">ממוצע 12 חודשים אחרונים:</span>
                <span className="average-value">{formatCurrency(averages.months12)}</span>
              </div>
            </div>
            
            <div className="suggestion-buttons">
              <button 
                type="button" 
                className="btn btn-outline btn-sm"
                onClick={() => setBudgetAmount(averages.months3)}
                disabled={isLoading}
              >
                <i className="fas fa-calculator"></i>
                השתמש בממוצע 3 חודשים
              </button>
              <button 
                type="button" 
                className="btn btn-outline btn-sm"
                onClick={() => setBudgetAmount(averages.months12)}
                disabled={isLoading}
              >
                <i className="fas fa-calendar-alt"></i>
                השתמש בממוצע 12 חודשים
              </button>
            </div>

            <div className="chart-section">
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  // TODO: Implement chart modal
                  console.log('Show history chart for:', categoryName);
                }}
                disabled={isLoading}
              >
                <i className="fas fa-chart-line"></i>
                הצג גרף היסטוריה
              </button>
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

export default BudgetModal;