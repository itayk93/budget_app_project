
import React from 'react';
import './CurrencySelection.css';

const CurrencySelection = ({ currencyGroups, onCurrencySelect, onBack }) => {
  const handleSelect = (currency) => {
    if (window.confirm(`האם אתה בטוח שברצונך לבחור ${currency} ולמחוק את השאר?`)) {
      onCurrencySelect(currency);
    }
  };

  return (
    <div className="currency-selection-container">
      <div className="card">
        <div className="card-header">
          <h3>בחירת מטבע</h3>
          <p>נמצאו מספר מטבעות בקובץ. בחר את המטבע הרצוי לייבוא.</p>
        </div>
        <div className="card-body">
          <div className="currency-groups">
            {Object.entries(currencyGroups).map(([currency, transactions]) => (
              <div key={currency} className="currency-group-card">
                <div className="currency-header">
                  <h4>{currency || 'לא ידוע'}</h4>
                  <p>{transactions.length} תנועות</p>
                </div>
                <div className="currency-transactions">
                  <ul>
                    {transactions.slice(0, 5).map((t, index) => (
                      <li key={index}>
                        <span>{t.description}</span>
                        <span className="transaction-amount">{t.amount.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  {transactions.length > 5 && <p>...ועוד {transactions.length - 5} תנועות</p>}
                </div>
                <div className="currency-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleSelect(currency)}
                  >
                    בחר במטבע זה
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card-footer">
          <button className="btn btn-secondary" onClick={onBack}>
            חזור
          </button>
        </div>
      </div>
    </div>
  );
};

export default CurrencySelection;
