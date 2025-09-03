import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal';
import './BudgetModal.css'; // Using same CSS styles
import './CategoryChangeModal.css'; // Custom styles for category change modal

const CategoryTransferModal = ({ 
  isOpen, 
  onClose, 
  transaction,
  onTransfer 
}) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryField, setShowNewCategoryField] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Organized categories with groups
  const categoryGroups = {
    'הכנסות': {
      icon: '💰',
      categories: [
        'הכנסות קבועות',
        'הכנסות משתנות', 
        'משכורת',
        'עבודה נוספת',
        'השקעות',
        'מתנות',
        'החזרי מס',
        'אחר (הכנסות)'
      ]
    },
    'דיור': {
      icon: '🏠',
      categories: [
        'תשלום משכנתא',
        'שכר דירה',
        'ארנונה',
        'חשמל',
        'גז',
        'מים',
        'אינטרנט',
        'טלפון',
        'ביטוח דירה',
        'ועד בית',
        'תיקונים ותחזוקה'
      ]
    },
    'הוצאות משתנות': {
      icon: '🛒',
      categories: [
        'הוצאות משתנות',
        'סופר',
        'אוכל בחוץ',
        'בגדים ונעליים',
        'קניות',
        'קוסמטיקה'
      ]
    },
    'תחבורה': {
      icon: '🚗',
      categories: [
        'תחבורה',
        'דלק',
        'ביטוח רכב',
        'תחזוקת רכב',
        'חנייה',
        'תחבורה ציבורית',
        'רכב ותחבורה ציבורית'
      ]
    },
    'בריאות': {
      icon: '🏥',
      categories: [
        'בריאות',
        'רופא',
        'רופא שיניים',
        'תרופות',
        'פארמה',
        'ביטוח בריאות'
      ]
    },
    'פנאי ובידור': {
      icon: '🎭',
      categories: [
        'פנאי ובידור',
        'קולנוע',
        'מסעדות',
        'ספורט',
        'חופשות',
        'טיסות לחו״ל',
        'נופש'
      ]
    },
    'דיגיטל': {
      icon: '💻',
      categories: [
        'דיגיטל',
        'נטפליקס',
        'ספוטיפיי',
        'משחקים',
        'אפליקציות'
      ]
    },
    'חינוך': {
      icon: '🎓',
      categories: [
        'חינוך',
        'לימודים',
        'ספרים',
        'קורסים'
      ]
    },
    'חסכון והשקעות': {
      icon: '💎',
      categories: [
        'חסכון קבוע',
        'חסכון חד פעמי',
        'השקעות',
        'קרן פנסיה',
        'ביטוח חיים'
      ]
    },
    'אחר': {
      icon: '📝',
      categories: [
        'מתנות',
        'צדקה',
        'עמלות',
        'עמלות בנק',
        'עמלות כרטיס אשראי',
        'שונות',
        'הוצאות לא תזרימיות',
        'אחר'
      ]
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedCategory('');
      setNewCategoryName('');
      setShowNewCategoryField(false);
      setError('');
    }
  }, [isOpen]);

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    setSelectedCategory(value);
    
    if (value === '__new_category__') {
      setShowNewCategoryField(true);
    } else {
      setShowNewCategoryField(false);
      setNewCategoryName('');
    }
  };

  const handleTransfer = async () => {
    const categoryToUse = showNewCategoryField ? newCategoryName.trim() : selectedCategory;
    
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
    console.log('🔍 [CategoryTransferModal] Not rendering:', { isOpen, hasTransaction: !!transaction });
    return null;
  }
  
  console.log('🔍 [CategoryTransferModal] Rendering modal for transaction:', transaction?.id);

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
        disabled={isLoading || (!selectedCategory && !newCategoryName.trim())}
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
            <label htmlFor="category-select">בחר קטגוריה חדשה</label>
            <select
              id="category-select"
              value={selectedCategory}
              onChange={handleCategoryChange}
              disabled={isLoading}
            >
              <option value="">-- בחר קטגוריה --</option>
              {Object.entries(categoryGroups).map(([groupName, groupData]) => (
                <optgroup key={groupName} label={`${groupData.icon} ${groupName}`}>
                  {groupData.categories.map((category, index) => (
                    <option key={`${groupName}-${index}`} value={category}>
                      {category}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option 
                value="__new_category__" 
                style={{
                  borderTop: '2px solid #e9ecef', 
                  marginTop: '8px', 
                  paddingTop: '8px', 
                  fontWeight: '600', 
                  color: '#323E4B'
                }}
              >
                ➕ הוסף קטגוריה חדשה
              </option>
            </select>
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