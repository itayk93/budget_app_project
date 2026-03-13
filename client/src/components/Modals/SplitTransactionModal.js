import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../Common/Modal';
import CategoryDropdown from '../Upload/CategoryDropdown';
import { transactionsAPI } from '../../services/api';
import './SplitTransactionModal.css';

const SplitTransactionModal = ({ 
  isOpen, 
  onClose, 
  transaction,
  onSplit 
}) => {
  const [splits, setSplits] = useState([
    { amount: '', category: '', description: '', month: '', notes: '' },
    { amount: '', category: '', description: '', month: '', notes: '' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);

  const loadCategories = useCallback(async () => {
    try {
      console.log('🔍 [SplitTransactionModal] Starting to load categories...');
      const response = await transactionsAPI.getUniqueCategories();
      console.log('🔍 [SplitTransactionModal] Categories API response:', response);
      
      if (response && response.categories) {
        console.log('✅ [SplitTransactionModal] Categories loaded successfully:', response.categories.length, 'categories');
        setCategories(response.categories);
      } else if (response && Array.isArray(response)) {
        console.log('✅ [SplitTransactionModal] Categories loaded as array:', response.length, 'categories');
        setCategories(response);
      } else {
        console.warn('⚠️ [SplitTransactionModal] No categories found in response');
        setCategories([]);
      }
    } catch (error) {
      console.error('❌ Error loading categories:', error);
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    if (isOpen && transaction) {
      const originalAmount = Math.abs(transaction.amount || 0);
      const currentMonth = transaction.flow_month || new Date().toISOString().slice(0, 7);
      
      setSplits([
        { 
          amount: originalAmount.toFixed(1), 
          category: transaction.category || '', 
          description: transaction.business_name || '', 
          month: currentMonth,
          notes: transaction.description || '',
          isOriginal: true
        }
      ]);
      setError('');
      
      // טען קטגוריות
      loadCategories();
    }
  }, [isOpen, transaction, loadCategories]);

  const handleSplitChange = (index, field, value) => {
    const newSplits = [...splits];
    newSplits[index][field] = value;
    
    // אם יש רק 2 פיצולים ומעדכנים פיצול שאינו הראשון, עדכן אוטומטית את הראשון
    if (field === 'amount' && newSplits.length === 2 && index === 1) {
      const originalAmount = Math.abs(transaction?.amount || 0);
      const secondAmount = parseFloat(value) || 0;
      const firstAmount = originalAmount - secondAmount;
      
      if (firstAmount >= 0) {
        newSplits[0].amount = firstAmount.toFixed(1);
      }
    }
    
    setSplits(newSplits);
  };

  const addSplit = () => {
    const currentMonth = transaction.flow_month || new Date().toISOString().slice(0, 7);
    setSplits([...splits, { 
      amount: '0', 
      category: transaction.category || '', 
      description: transaction.business_name || '', 
      month: currentMonth,
      notes: ''
    }]);
  };

  const removeSplit = (index) => {
    if (splits.length > 1 && index !== 0) { // לא ניתן למחוק את השורה הראשונה
      const newSplits = splits.filter((_, i) => i !== index);
      setSplits(newSplits);
    }
  };

  const getTotalSplitAmount = () => {
    return splits.reduce((total, split) => {
      const amount = parseFloat(split.amount) || 0;
      return total + amount;
    }, 0);
  };

  const getOriginalAmount = () => {
    return Math.abs(transaction?.amount || 0);
  };

  const validateSplits = () => {
    // בדוק שיש לפחות 2 פיצולים
    if (splits.length < 2) {
      return 'חייב להיות לפחות 2 פיצולים כדי לפצל עסקה';
    }

    // Check if all splits have required fields
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      
      // בדיקה מפורטת של כל שדה
      if (!split.amount || split.amount === '' || split.amount === '0') {
        return `חסר סכום עבור ${i === 0 ? 'רשומה מקורית' : `פיצול ${i}`}`;
      }
      if (!split.category || split.category === '') {
        return `חסרה קטגוריה עבור ${i === 0 ? 'רשומה מקורית' : `פיצול ${i}`}`;
      }
      if (!split.description || split.description === '') {
        return `חסר תיאור עבור ${i === 0 ? 'רשומה מקורית' : `פיצול ${i}`}`;
      }
      if (!split.month || split.month === '') {
        return `חסר חודש תזרים עבור ${i === 0 ? 'רשומה מקורית' : `פיצול ${i}`}`;
      }
      if (isNaN(split.amount) || parseFloat(split.amount) <= 0) {
        return `סכום לא תקין עבור ${i === 0 ? 'רשומה מקורית' : `פיצול ${i}`} (${split.amount})`;
      }
    }

    // Check if total matches original amount
    const totalSplit = getTotalSplitAmount();
    const originalAmount = getOriginalAmount();
    const TOLERANCE = 0.05; // tolerate small rounding differences (0.05₪)
    const difference = Math.abs(totalSplit - originalAmount);
    
    if (difference > TOLERANCE) {
      return `סך הפיצולים (${totalSplit.toFixed(1)} ₪) חייב להיות שווה לסכום המקורי (${originalAmount.toFixed(1)} ₪). הפרש נוכחי: ${difference.toFixed(2)} ₪`;
    }

    return null;
  };

  const handleSplit = async () => {
    const validationError = validateSplits();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('🔄 Starting split process...');
      
      const splitData = {
        originalTransactionId: transaction.id,
        splits: splits.map(split => ({
          amount: transaction.amount < 0 ? -Math.abs(parseFloat(split.amount)) : Math.abs(parseFloat(split.amount)),
          category: split.category,
          business_name: split.description,
          flow_month: split.month,
          payment_date: transaction.payment_date,
          currency: transaction.currency || 'ILS',
          description: split.notes || ''
        }))
      };

      console.log('🔄 Split data:', splitData);
      
      const result = await onSplit(splitData);
      console.log('✅ Split successful:', result);
      
      // הצגת הודעת הצלחה לפני סגירה
      alert('העסקה פוצלה בהצלחה!');
      onClose();
      
    } catch (err) {
      console.error('❌ Split error:', err);
      
      // הצגת הודעת שגיאה מפורטת
      const errorMessage = err.response?.data?.error || err.message || 'שגיאה לא ידועה';
      setError('שגיאה בפיצול העסקה: ' + errorMessage);
      
      // אם זה היה נכשל, הצג התראה חשובה
      if (errorMessage.includes('preserved') || errorMessage.includes('Original transaction')) {
        alert('שגיאה בפיצול! העסקה המקורית נשמרה. אנא נסה שוב.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // אפס את המודל לרשומה מקורית בלבד
    if (transaction) {
      const originalAmount = Math.abs(transaction.amount || 0);
      const currentMonth = transaction.flow_month || new Date().toISOString().slice(0, 7);
      
      setSplits([
        { 
          amount: originalAmount.toFixed(1), 
          category: transaction.category || '', 
          description: transaction.business_name || '', 
          month: currentMonth,
          notes: transaction.description || '',
          isOriginal: true
        }
      ]);
    }
    setError('');
    onClose();
  };

  if (!transaction) return null;

  // Totals and tolerance handling
  const originalAmount = getOriginalAmount();
  const totalSplit = getTotalSplitAmount();
  const TOLERANCE = 0.05; // allow minor rounding (< 5 agorot)
  const differenceAbs = Math.abs(totalSplit - originalAmount);
  const withinTolerance = differenceAbs <= TOLERANCE;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="פיצול עסקה" className="split-modal" style={{ zIndex: 10001 }}>
      <div className="split-modal-content">
        <div className="transaction-info">
          <div><strong>עסקה מקורית:</strong> {transaction.business_name}</div>
          <div><strong>סכום מקורי:</strong> {originalAmount.toFixed(1)} ₪</div>
          <div><strong>תאריך:</strong> {transaction.payment_date}</div>
        </div>

        <div className="splits-container">
          <h4>{splits.length === 1 ? 'הרשומה המקורית:' : 'פיצול העסקה:'}</h4>
          
          {splits.map((split, index) => (
            <div key={index} className="split-item">
              <div className="split-item-header">
                <h5>{index === 0 ? 'רשומה מקורית' : `פיצול ${index}`}</h5>
                {splits.length > 1 && index !== 0 && (
                  <button 
                    type="button" 
                    onClick={() => removeSplit(index)}
                    className="remove-split-btn"
                  >
                    הסר
                  </button>
                )}
              </div>
              
              <div className="split-fields">
                <div className="split-field">
                  <label>סכום (₪): <span style={{color: '#f44336'}}>*</span></label>
                  <input
                    type="number"
                    step="0.1"
                    value={split.amount}
                    onChange={(e) => handleSplitChange(index, 'amount', e.target.value)}
                    onWheel={(e) => {
                      // Prevent mouse wheel from changing the number value when focused
                      e.currentTarget.blur();
                    }}
                    className="input-field"
                    placeholder="0.0"
                  />
                </div>
                
                <div className="split-field">
                  <label>תיאור: <span style={{color: '#f44336'}}>*</span></label>
                  <input
                    type="text"
                    value={split.description}
                    onChange={(e) => handleSplitChange(index, 'description', e.target.value)}
                    className="input-field"
                    placeholder="תיאור העסקה"
                  />
                </div>
                
                <div className="split-field">
                  <label>קטגוריה: <span style={{color: '#f44336'}}>*</span></label>
                  <CategoryDropdown
                    value={split.category}
                    onChange={(category) => handleSplitChange(index, 'category', category)}
                    categories={categories}
                    placeholder="בחר קטגוריה"
                  />
                </div>
                
                <div className="split-field">
                  <label>חודש תזרים: <span style={{color: '#f44336'}}>*</span></label>
                  <input
                    type="month"
                    value={split.month}
                    onChange={(e) => handleSplitChange(index, 'month', e.target.value)}
                    className="input-field"
                  />
                </div>
                
                <div className="split-field" style={{ gridColumn: '1 / -1' }}>
                  <label>הסבר (אופציונלי):</label>
                  <input
                    type="text"
                    value={split.notes}
                    onChange={(e) => handleSplitChange(index, 'notes', e.target.value)}
                    className="input-field"
                    placeholder="הסבר נוסף על הפיצול..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <button 
            type="button" 
            onClick={addSplit}
            className="add-split-btn"
          >
            {splits.length === 1 ? 'התחל פיצול' : 'הוסף פיצול נוסף'}
          </button>
        </div>

        <div className={`totals-summary ${withinTolerance ? '' : 'warning'}`}>
          <div><strong>סכום מקורי:</strong> {originalAmount.toFixed(1)} ₪</div>
          <div><strong>סך פיצולים:</strong> {totalSplit.toFixed(1)} ₪</div>
          {!withinTolerance && (
            <div style={{ color: '#856404' }}>
              <strong>הפרש:</strong> {differenceAbs.toFixed(2)} ₪
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}
        
        {/* כפתור בדיקה מה חסר */}
        <div style={{ marginBottom: '16px' }}>
          <button 
            type="button"
            onClick={() => {
              const validationError = validateSplits();
              if (validationError) {
                setError(validationError);
              } else {
                setError('');
                alert('הכל מוכן! ניתן לפצל את העסקה');
              }
            }}
            style={{
              background: '#17a2b8',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            בדוק מה חסר
          </button>
        </div>
        
        {/* Debug info - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ background: '#f0f0f0', padding: '10px', margin: '10px 0', fontSize: '12px' }}>
            <div><strong>Debug Info:</strong></div>
            <div>Splits length: {splits.length}</div>
            <div>Total split: {getTotalSplitAmount().toFixed(1)}</div>
            <div>Original: {getOriginalAmount().toFixed(1)}</div>
            <div>Difference: {(getTotalSplitAmount() - getOriginalAmount()).toFixed(1)}</div>
            <div>Categories loaded: {categories.length}</div>
            {splits.map((split, i) => (
              <div key={i}>
                Split {i}: amount={split.amount}, category="{split.category}", desc="{split.description}", month="{split.month}"
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button 
            onClick={handleClose} 
            className="btn-secondary"
            disabled={isLoading}
          >
            ביטול
          </button>
          <button 
            onClick={handleSplit} 
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'מפצל...' : 'פצל עסקה'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SplitTransactionModal;
