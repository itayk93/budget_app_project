
import React from 'react';
import './CurrencySelection.css';

const CurrencySelection = ({ currencyGroups, onCurrencySelect, onBack }) => {
  const handleSelect = (currency) => {
    if (window.confirm(`האם אתה בטוח שברצונך לבחור ${currency} ולמחוק את השאר?`)) {
      onCurrencySelect(currency);
    }
  };

  return (
    <div className="currency-selection">
      <div className="card">
        <div className="card-header">
          <h3>🌍 בחירת מטבע לייבוא</h3>
          <p className="text-muted">נמצאו מספר מטבעות בקובץ. בחר את המטבע הרצוי לייבוא - שאר המטבעות יימחקו.</p>
        </div>
        <div className="card-body">
          <div className="currency-note">
            <div className="note-card">
              <i className="fas fa-info-circle"></i>
              <div className="note-content">
                <strong>שים לב:</strong> בחירת מטבע תמחק את כל העסקאות במטבעות האחרים. וודא שאתה בוחר את המטבע הנכון.
              </div>
            </div>
          </div>
          
          <div className="currency-groups">
            {Object.entries(currencyGroups).map(([currency, currencyData]) => {
              // Handle both old format (direct array) and new format (object with transactions array)
              const transactions = Array.isArray(currencyData) ? currencyData : currencyData.transactions || [];
              const totalAmount = Array.isArray(currencyData) ? 0 : (currencyData.totalAmount || 0);
              
              return (
                <div key={currency} className="currency-card" onClick={() => handleSelect(currency)}>
                  <div className="selection-indicator">✓</div>
                  
                  <div className="currency-header">
                    <div className="currency-symbol">
                      {currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency.charAt(0)}
                    </div>
                    <div className="currency-info">
                      <h4>{currency || 'לא ידוע'}</h4>
                      <p>{transactions.length} עסקאות נמצאו</p>
                    </div>
                  </div>
                  
                  <div className="currency-stats">
                    <div className="stat-item">
                      <span className="stat-label">מספר עסקאות</span>
                      <span className="stat-value">{transactions.length.toLocaleString()}</span>
                    </div>
                    {totalAmount > 0 && (
                      <div className="stat-item">
                        <span className="stat-label">סכום כולל</span>
                        <span className="stat-value">{totalAmount.toLocaleString()} {currency}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="sample-transactions">
                    <h5>🏪 דוגמאות עסקאות</h5>
                    <div className="transactions-list">
                      {transactions.slice(0, 3).map((t, index) => (
                        <div key={index} className="sample-transaction">
                          <span className="transaction-description">
                            {t.business_name || t.description || 'ללא תיאור'}
                          </span>
                          <span className="transaction-amount">
                            {Math.abs(t.amount || 0).toLocaleString()} {currency}
                          </span>
                        </div>
                      ))}
                      {transactions.length > 3 && (
                        <div className="more-transactions">
                          ועוד {(transactions.length - 3).toLocaleString()} עסקאות...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="card-footer">
          <div className="action-buttons">
            <button className="btn btn-secondary" onClick={onBack}>
              ⬅️ חזור
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrencySelection;
