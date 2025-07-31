
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import { uploadAPI } from '../../services/api';
import LoadingSpinner from '../Common/LoadingSpinner';
import './DuplicateReview.css';

const DuplicateReview = ({ tempId, duplicates: passedDuplicates, onComplete, onBack }) => {
  const [decisions, setDecisions] = useState({});
  const [bulkActionInProgress, setBulkActionInProgress] = useState('');
  const [bulkActionCompleted, setBulkActionCompleted] = useState('');

  // Fetch duplicates data if we have tempId, otherwise use passed duplicates
  const { data: duplicatesData, isLoading, error } = useQuery(
    ['duplicates', tempId],
    () => uploadAPI.getDuplicates(tempId),
    {
      enabled: !!tempId,
      retry: 2
    }
  );
  
  // Use either fetched data or passed duplicates
  const finalDuplicatesData = tempId ? duplicatesData : { duplicates: passedDuplicates || [] };

  // Handle duplicates decisions
  const handleDecisionsMutation = useMutation(
    (data) => uploadAPI.handleDuplicates(data),
    {
      onSuccess: (result) => {
        onComplete(result);
      },
      onError: (error) => {
        console.error('Error processing duplicates:', error);
        alert('שגיאה בעיבוד הכפילויות: ' + (error.response?.data?.message || error.message));
      }
    }
  );

  const handleDecisionChange = (duplicateId, shouldImport) => {
    setDecisions(prev => ({
      ...prev,
      [duplicateId]: shouldImport
    }));
  };

  const handleSubmitDecisions = () => {
    if (tempId) {
      // New flow with tempId - convert decisions to resolutions format
      const resolutions = {};
      Object.entries(decisions).forEach(([hash, shouldImport]) => {
        resolutions[hash] = shouldImport ? 'import' : 'skip';
      });
      
      handleDecisionsMutation.mutate({
        tempId: tempId,
        resolutions: resolutions,
        cashFlowId: null // Will be set by backend
      });
    } else {
      // Legacy flow - convert decisions to array format
      const decisionsArray = Object.entries(decisions).map(([id, shouldImport]) => ({
        id,
        import: shouldImport
      }));

      handleDecisionsMutation.mutate({
        decisions: decisionsArray
      });
    }
  };

  const handleImportAll = () => {
    setBulkActionInProgress('import');
    setBulkActionCompleted('');
    
    const duplicates = finalDuplicatesData?.duplicates || [];
    const allImportDecisions = {};
    
    duplicates.forEach(duplicate => {
      const duplicateId = tempId ? duplicate.transaction_hash : (duplicate.new?.id || duplicate.id);
      if (duplicateId) {
        allImportDecisions[duplicateId] = true;
      }
    });
    
    // Simulate processing time for visual feedback
    setTimeout(() => {
      console.log('🔍 Setting import decisions:', allImportDecisions);
      setDecisions(allImportDecisions);
      setBulkActionInProgress('');
      setBulkActionCompleted('import');
      
      // Clear completed state after 2 seconds
      setTimeout(() => {
        setBulkActionCompleted('');
      }, 2000);
    }, 300);
  };

  const handleSkipAll = () => {
    setBulkActionInProgress('skip');
    setBulkActionCompleted('');
    
    const duplicates = finalDuplicatesData?.duplicates || [];
    const allSkipDecisions = {};
    
    duplicates.forEach(duplicate => {
      const duplicateId = tempId ? duplicate.transaction_hash : (duplicate.new?.id || duplicate.id);
      if (duplicateId) {
        allSkipDecisions[duplicateId] = false;
      }
    });
    
    // Simulate processing time for visual feedback
    setTimeout(() => {
      console.log('🔍 Setting skip decisions:', allSkipDecisions);
      setDecisions(allSkipDecisions);
      setBulkActionInProgress('');
      setBulkActionCompleted('skip');
      
      // Clear completed state after 2 seconds
      setTimeout(() => {
        setBulkActionCompleted('');
      }, 2000);
    }, 300);
  };

  const formatCurrency = (amount, currency = 'ILS') => {
    const symbols = {
      'ILS': '₪',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };
    
    const symbol = symbols[currency] || currency;
    const formattedAmount = parseFloat(amount || 0).toFixed(2);
    
    return `${formattedAmount} ${symbol}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'לא זמין';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'לא זמין';
      return date.toLocaleDateString('he-IL');
    } catch (error) {
      console.error('Date formatting error:', error);
      return dateStr; // fallback to original string
    }
  };

  if (tempId && isLoading) {
    return (
      <div className="duplicate-review-container">
        <LoadingSpinner size="large" text="טוען נתוני כפילויות..." />
      </div>
    );
  }

  if (tempId && error) {
    return (
      <div className="duplicate-review-container">
        <div className="error-card">
          <h3>שגיאה בטעינת נתונים</h3>
          <p>{error.response?.data?.error || error.message}</p>
          <button className="btn btn-primary" onClick={onBack}>
            חזור
          </button>
        </div>
      </div>
    );
  }

  const duplicates = finalDuplicatesData?.duplicates || [];
  const decidedCount = Object.keys(decisions).length;

  return (
    <div className="duplicate-review-container">
      <div className="review-header">
        <h1>סקירת עסקאות כפולות</h1>
        <div className="header-summary">
          <div className="summary-info">
            נמצאו {duplicates.length} עסקאות כפולות. בחר אילו עסקאות לייבא למערכת
          </div>
          <div className="summary-stats">
            החלטת על {decidedCount} מתוך {duplicates.length}
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <button 
          className={`btn ${
            bulkActionCompleted === 'import' ? 'btn-success' : 
            bulkActionInProgress === 'import' ? 'btn-primary loading' : 
            'btn-primary'
          }`}
          onClick={handleImportAll}
          disabled={bulkActionInProgress !== ''}
        >
          {bulkActionInProgress === 'import' ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              מייבא...
            </>
          ) : bulkActionCompleted === 'import' ? (
            <>
              <i className="fas fa-check"></i>
              הושלם! ייבא את כל העסקאות
            </>
          ) : (
            <>
              <i className="fas fa-check-double"></i>
              ייבא את כל העסקאות
            </>
          )}
        </button>
        <button 
          className={`btn ${
            bulkActionCompleted === 'skip' ? 'btn-danger' : 
            bulkActionInProgress === 'skip' ? 'btn-outline loading' : 
            'btn-outline'
          }`}
          onClick={handleSkipAll}
          disabled={bulkActionInProgress !== ''}
        >
          {bulkActionInProgress === 'skip' ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              מדלג...
            </>
          ) : bulkActionCompleted === 'skip' ? (
            <>
              <i className="fas fa-check"></i>
              הושלם! דלג על כל העסקאות
            </>
          ) : (
            <>
              <i className="fas fa-times-circle"></i>
              דלג על כל העסקאות
            </>
          )}
        </button>
      </div>

      <div className="duplicates-container">
        {duplicates.map((duplicate, index) => {
          const duplicateId = tempId ? duplicate.transaction_hash : (duplicate.new?.id || duplicate.id);
          const decision = decisions[duplicateId];
          
          return (
            <div 
              key={duplicateId || index} 
              className={`duplicate-card ${decision !== undefined ? 'decided' : ''} ${
                decision === true ? 'decided-import' : ''
              } ${decision === false ? 'decided-skip' : ''}`}
            >
              <div className="card-header">
                <div>עסקה #{index + 1} מתוך {duplicates.length}</div>
                <div className="decision-status">
                  {decision === true && (
                    <span className="decision-indicator import">ייבוא</span>
                  )}
                  {decision === false && (
                    <span className="decision-indicator skip">דילוג</span>
                  )}
                </div>
              </div>
              
              <div className="card-body">
                <div className="transaction-comparison">
                  <div className="transaction-column existing">
                    <div className="column-header">
                      <span className="column-title">עסקה קיימת במערכת</span>
                      <span className="column-badge existing-badge">קיים</span>
                    </div>
                    <div className="transaction-card-compact">
                      <div className="transaction-summary">
                        <div className="transaction-main-info">
                          <div className="transaction-description-compact">
                            {duplicate.existing?.business_name || 
                             duplicate.existing?.description || 
                             'ללא תיאור'}
                          </div>
                          <div className="transaction-amount-compact">
                            {duplicate.existing?.amount !== undefined && duplicate.existing?.amount !== null ? 
                              formatCurrency(duplicate.existing.amount, duplicate.existing?.currency) : 
                              '0.00 ₪'
                            }
                          </div>
                        </div>
                        <div className="transaction-meta-info">
                          <span className="date-compact">{formatDate(duplicate.existing?.payment_date)}</span>
                          <span className="category-compact">{duplicate.existing?.category_name || 'לא מוגדר'}</span>
                        </div>
                        {duplicate.existing?.notes && (
                          <div className="notes-compact">{duplicate.existing.notes}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="comparison-divider">
                    <div className="vs-indicator">VS</div>
                  </div>
                  
                  <div className="transaction-column new">
                    <div className="column-header">
                      <span className="column-title">עסקה חדשה מהקובץ</span>
                      <span className="column-badge new-badge">חדש</span>
                    </div>
                    <div className="transaction-card-compact">
                      <div className="transaction-summary">
                        <div className="transaction-main-info">
                          <div className="transaction-description-compact">
                            {duplicate.new?.business_name || 'לא זמין'}
                          </div>
                          <div className="transaction-amount-compact">
                            {formatCurrency(
                              duplicate.new?.amount, 
                              duplicate.new?.currency
                            )}
                          </div>
                        </div>
                        <div className="transaction-meta-info">
                          <span className="date-compact">{formatDate(duplicate.new?.payment_date)}</span>
                          <span className="category-compact">{duplicate.new?.category_name || 'לא מוגדר'}</span>
                        </div>
                        {duplicate.new?.notes && (
                          <div className="notes-compact">{duplicate.new.notes}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="decision-buttons">
                  <button
                    className={`decision-btn import-btn ${decision === true ? 'selected' : ''}`}
                    onClick={() => handleDecisionChange(duplicateId, true)}
                  >
                    <i className="fas fa-download"></i>
                    ייבא
                  </button>
                  <button
                    className={`decision-btn skip-btn ${decision === false ? 'selected' : ''}`}
                    onClick={() => handleDecisionChange(duplicateId, false)}
                  >
                    <i className="fas fa-times"></i>
                    דלג
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="review-footer">
        <div className="action-buttons">
          <button
            className="btn btn-secondary"
            onClick={onBack}
            disabled={handleDecisionsMutation.isLoading}
          >
            חזור
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSubmitDecisions}
            disabled={handleDecisionsMutation.isLoading}
          >
            {handleDecisionsMutation.isLoading ? (
              <>
                <LoadingSpinner size="small" />
                שומר...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                שמור החלטות וחזור לתנועות
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateReview;
