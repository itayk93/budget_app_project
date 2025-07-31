import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import { uploadAPI, cashFlowsAPI } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';
import './CurrencyGroupsReview.css';

const CurrencyGroupsReview = ({ tempId, onComplete, onBack }) => {
  const [decisions, setDecisions] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);

  // Fetch currency groups data
  const { data: currencyData, isLoading: loadingCurrency, error: currencyError } = useQuery(
    ['currencyGroups', tempId],
    () => uploadAPI.getCurrencyGroups(tempId),
    {
      enabled: !!tempId,
      retry: 2
    }
  );

  // Fetch cash flows for selection
  const { data: cashFlows } = useQuery('cashFlows', cashFlowsAPI.getAll);

  // Handle currency groups decisions
  const handleDecisionsMutation = useMutation(
    (data) => uploadAPI.handleCurrencyGroups(data),
    {
      onSuccess: (result) => {
        if (result.has_duplicates) {
          // Redirect to duplicates review
          onComplete({
            ...result,
            redirect_to: 'duplicates',
            temp_duplicates_id: result.temp_duplicates_id
          });
        } else {
          // Complete the process
          onComplete({
            ...result,
            redirect_to: 'transactions'
          });
        }
      },
      onError: (error) => {
        console.error('Error processing currency groups:', error);
        alert('שגיאה בעיבוד קבוצות המטבע: ' + (error.response?.data?.message || error.message));
        setIsProcessing(false);
      }
    }
  );

  const handleCurrencyDecision = (currency, action, cashFlowId = null) => {
    setDecisions(prev => ({
      ...prev,
      [currency]: {
        currency,
        action,
        cash_flow_id: cashFlowId
      }
    }));
  };

  const handleSubmitDecisions = () => {
    // Validate decisions
    const currencyGroups = currencyData?.currency_data || {};
    const missingDecisions = [];

    for (const currency of Object.keys(currencyGroups)) {
      if (!decisions[currency]) {
        missingDecisions.push(currency);
      } else if (decisions[currency].action === 'import' && !decisions[currency].cash_flow_id) {
        missingDecisions.push(`${currency} (missing cash flow)`);
      }
    }

    if (missingDecisions.length > 0) {
      alert(`אנא השלם החלטות עבור: ${missingDecisions.join(', ')}`);
      return;
    }

    setIsProcessing(true);

    // Submit decisions
    handleDecisionsMutation.mutate({
      temp_id: tempId,
      decisions
    });
  };

  const formatCurrencySymbol = (currency) => {
    const symbols = {
      'ILS': '₪',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };
    return symbols[currency] || currency;
  };

  const renderProgress = () => {
    if (!isProcessing) return null;

    return (
      <div className="processing-overlay">
        <div className="processing-card">
          <div className="processing-header">
            <h3>מעבד את העסקאות...</h3>
            <LoadingSpinner size="small" />
          </div>
          
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress?.progress || 0}%` }}
            />
          </div>
          
          <div className="progress-status">
            {progress?.status || 'מתחיל עיבוד...'}
          </div>
          
          {progress && (
            <div className="progress-stats">
              <span>יובאו: {progress.imported || 0}</span>
              <span>דולגו: {progress.skipped || 0}</span>
              <span>כפילויות: {progress.duplicates || 0}</span>
              <span>שגיאות: {progress.errors || 0}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loadingCurrency) {
    return (
      <div className="currency-groups-review">
        <LoadingSpinner size="large" text="טוען נתוני מטבעות..." />
      </div>
    );
  }

  if (currencyError) {
    return (
      <div className="currency-groups-review">
        <div className="error-card">
          <h3>שגיאה בטעינת נתונים</h3>
          <p>{currencyError.response?.data?.error || currencyError.message}</p>
          <button className="btn btn-primary" onClick={onBack}>
            חזור
          </button>
        </div>
      </div>
    );
  }

  const currencyGroups = currencyData?.currency_data || {};
  const userCashFlows = cashFlows || [];

  return (
    <div className="currency-groups-review">
      {renderProgress()}
      
      <div className="review-header">
        <h1>התאמת מטבעות</h1>
        <div className="header-summary">
          <div className="summary-info">
            קובץ עם מטבעות שונים - נמצאו קבוצות של עסקאות במטבעות שונים. 
            אנא בחר לאיזה תזרים לייבא כל קבוצה
          </div>
          <div className="summary-stats">
            קבוצות: {Object.keys(currencyGroups).length}
          </div>
        </div>
      </div>

      <div className="currency-groups-container">
        {Object.entries(currencyGroups).map(([currency, data]) => {
          const decision = decisions[currency];
          const transactionCount = data.count || data.transactions?.length || 0;
          
          return (
            <div 
              key={currency} 
              className={`currency-card ${decision ? 'decided' : ''} ${
                decision?.action === 'import' ? 'decided-import' : ''
              } ${decision?.action === 'skip' ? 'decided-skip' : ''}`}
            >
              <div className="card-header">
                <div className="currency-info">
                  <span className="currency-symbol">
                    {formatCurrencySymbol(currency)}
                  </span>
                  <span className="currency-text">
                    {currency} - {transactionCount} עסקאות
                  </span>
                </div>
                <div className="decision-display">
                  {decision?.action === 'import' && (
                    <span className="decision-indicator import">ייבוא</span>
                  )}
                  {decision?.action === 'skip' && (
                    <span className="decision-indicator skip">דילוג</span>
                  )}
                </div>
              </div>

              <div className="card-body">
                <p>קבוצה זו מכילה {transactionCount} עסקאות במטבע {currency}.</p>
                
                {data.primary && (
                  <div className="alert alert-success">
                    <i className="fas fa-check-circle"></i>
                    זהו המטבע של תזרים המקור שנבחר
                  </div>
                )}

                <div className="cash-flow-selector">
                  <label className="form-label">בחר תזרים:</label>
                  <select
                    className="form-select"
                    value={decision?.cash_flow_id || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleCurrencyDecision(currency, 'import', e.target.value);
                      }
                    }}
                  >
                    <option value="">-- בחר תזרים --</option>
                    {userCashFlows.map(cf => (
                      <option 
                        key={cf.id} 
                        value={cf.id}
                        selected={cf.currency === currency}
                      >
                        {cf.name} ({formatCurrencySymbol(cf.currency)} {cf.currency})
                      </option>
                    ))}
                  </select>
                </div>

                {data.files && data.files.length > 0 && (
                  <div className="file-info">
                    <div className="file-info-title">עסקאות מהקבצים הבאים:</div>
                    <div className="file-list">
                      {data.files.map((file, index) => (
                        <div key={index} className="file-item">
                          <span>{file}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="transactions-preview">
                  <div className="preview-title">דוגמאות לעסקאות בקבוצה זו:</div>
                  {(data.transactions || []).slice(0, 5).map((transaction, index) => (
                    <div key={index} className="transaction-item">
                      <div>{transaction.business_name}</div>
                      <div>{transaction.amount} {currency}</div>
                    </div>
                  ))}
                  {transactionCount > 5 && (
                    <div className="text-center">
                      <span className="more-text">...ועוד {transactionCount - 5} עסקאות</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card-footer">
                <div className="action-buttons">
                  <button
                    className="btn btn-outline skip-btn"
                    onClick={() => handleCurrencyDecision(currency, 'skip')}
                  >
                    <i className="fas fa-ban"></i>
                    דלג
                  </button>
                  <button
                    className="btn btn-primary import-btn"
                    onClick={() => {
                      if (decision?.cash_flow_id) {
                        handleCurrencyDecision(currency, 'import', decision.cash_flow_id);
                      } else {
                        alert('אנא בחר תזרים מזומנים קודם');
                      }
                    }}
                  >
                    <i className="fas fa-file-import"></i>
                    ייבא
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="review-footer">
        <div className="decision-summary">
          <h3>סיכום החלטות</h3>
          <div className="summary-stats">
            <div className="stat-card">
              <div className="number">
                {Object.values(decisions).filter(d => d.action === 'import').length}
              </div>
              <div className="label">עסקאות לייבוא</div>
            </div>
            <div className="stat-card">
              <div className="number">
                {Object.values(decisions).filter(d => d.action === 'skip').length}
              </div>
              <div className="label">עסקאות לדילוג</div>
            </div>
            <div className="stat-card">
              <div className="number">
                {Object.keys(currencyGroups).length - Object.keys(decisions).length}
              </div>
              <div className="label">קבוצות ממתינות</div>
            </div>
          </div>
        </div>

        <div className="action-buttons">
          <button
            className="btn btn-secondary"
            onClick={onBack}
            disabled={isProcessing}
          >
            בטל וחזור למסך העלאה
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSubmitDecisions}
            disabled={
              isProcessing || 
              Object.keys(decisions).length !== Object.keys(currencyGroups).length ||
              handleDecisionsMutation.isLoading
            }
          >
            {isProcessing || handleDecisionsMutation.isLoading ? (
              <>
                <LoadingSpinner size="small" />
                מעבד...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                שמור החלטות וייבא עסקאות
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CurrencyGroupsReview;