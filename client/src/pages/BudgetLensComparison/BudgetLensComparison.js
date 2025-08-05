import React, { useState } from 'react';
import { uploadBudgetLensFile } from '../../utils/api';
import './BudgetLensComparison.css';

const BudgetLensComparison = () => {
  const [file, setFile] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setError('');
    } else {
      setError('אנא בחר קובץ CSV בלבד');
      setFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form submitted!', { file, startDate, endDate });
    
    if (!file) {
      setError('אנא בחר קובץ CSV');
      return;
    }
    
    if (!startDate || !endDate) {
      setError('אנא בחר טווח תאריכים');
      return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      setError('תאריך התחלה חייב להיות לפני תאריך הסיום');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('budgetlensFile', file);
      formData.append('startDate', startDate);
      formData.append('endDate', endDate);
      
      console.log('Sending request to API...');
      const response = await uploadBudgetLensFile(formData);
      console.log('API response:', response);
      setResults(response);
      console.log('Results state updated!', response);
    } catch (err) {
      console.error('Error comparing BudgetLens data:', err);
      setError(err.response?.data?.error || 'שגיאה בהשוואת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS'
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('he-IL');
  };

  return (
    <div className="budgetlens-comparison">
      <div className="page-header">
        <h1>השוואת קובץ BudgetLens</h1>
        <p>העלה קובץ CSV מ-BudgetLens כדי לזהות עסקאות חסרות במערכת</p>
      </div>

      <div className="comparison-form-card">
        <form onSubmit={handleSubmit} className="comparison-form">
          <div className="form-group">
            <label htmlFor="budgetlens-file">קובץ BudgetLens (CSV)</label>
            <input
              type="file"
              id="budgetlens-file"
              accept=".csv"
              onChange={handleFileChange}
              className="file-input"
            />
            {file && (
              <div className="file-info">
                <span className="file-name">📄 {file.name}</span>
                <span className="file-size">({Math.round(file.size / 1024)} KB)</span>
              </div>
            )}
          </div>

          <div className="date-range-group">
            <div className="form-group">
              <label htmlFor="start-date">תאריך התחלה</label>
              <input
                type="date"
                id="start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="date-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="end-date">תאריך סיום</label>
              <input
                type="date"
                id="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="date-input"
              />
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="compare-btn"
            disabled={loading || !file || !startDate || !endDate}
          >
            {loading ? 'מבצע השוואה...' : 'השווה נתונים'}
          </button>
        </form>
      </div>

      {results && (
        <>
          {console.log('🔍 Rendering results:', results)}
          <div className="results-section">
          <div className="results-summary">
            <h2>תוצאות ההשוואה</h2>
            <div className="summary-stats">
              <div className="stat-card">
                <div className="stat-number">{results.csvTransactionsCount}</div>
                <div className="stat-label">עסקאות בקובץ BudgetLens</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{results.existingTransactionsCount}</div>
                <div className="stat-label">עסקאות במערכת</div>
              </div>
              <div className="stat-card missing">
                <div className="stat-number">{results.missingTransactions.length}</div>
                <div className="stat-label">עסקאות חסרות</div>
              </div>
              <div className="stat-card duplicate">
                <div className="stat-number">{results.duplicateTransactions.length}</div>
                <div className="stat-label">כפילויות אפשריות</div>
              </div>
            </div>
            <div className="date-range-info">
              טווח תאריכים: {formatDate(results.dateRange.startDate)} - {formatDate(results.dateRange.endDate)}
            </div>
          </div>

          {results.missingTransactions.length > 0 && (
            <div className="missing-transactions">
              <h3>עסקאות חסרות במערכת ({results.missingTransactions.length})</h3>
              <div className="transactions-table">
                <div className="table-header">
                  <div>תאריך</div>
                  <div>שם העסק</div>
                  <div>סכום</div>
                  <div>קטגוריה</div>
                  <div>הערות</div>
                </div>
                {results.missingTransactions.map((transaction, index) => (
                  <div key={index} className="table-row">
                    <div>{formatDate(transaction.date)}</div>
                    <div className="business-name">{transaction.businessName}</div>
                    <div className={`amount ${transaction.amount < 0 ? 'negative' : 'positive'}`}>
                      {formatCurrency(transaction.amount)}
                    </div>
                    <div>{transaction.category}</div>
                    <div className="notes">{transaction.notes}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.duplicateTransactions.length > 0 && (
            <div className="duplicate-transactions">
              <h3>כפילויות אפשריות ({results.duplicateTransactions.length})</h3>
              <div className="duplicates-list">
                {results.duplicateTransactions.map((duplicate, index) => (
                  <div key={index} className="duplicate-group">
                    <div className="csv-transaction">
                      <h4>עסקה בקובץ BudgetLens:</h4>
                      <div className="transaction-details">
                        <span>{formatDate(duplicate.csvTransaction.date)}</span>
                        <span>{duplicate.csvTransaction.businessName}</span>
                        <span className={`amount ${duplicate.csvTransaction.amount < 0 ? 'negative' : 'positive'}`}>
                          {formatCurrency(duplicate.csvTransaction.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="db-matches">
                      <h5>התאמות במערכת:</h5>
                      {duplicate.dbMatches.map((match, matchIndex) => (
                        <div key={matchIndex} className="transaction-details">
                          <span>{formatDate(match.date)}</span>
                          <span>{match.businessName}</span>
                          <span className={`amount ${match.amount < 0 ? 'negative' : 'positive'}`}>
                            {formatCurrency(match.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.missingTransactions.length === 0 && results.duplicateTransactions.length === 0 && (
            <div className="no-issues">
              <div className="success-icon">✅</div>
              <h3>כל העסקאות תקינות!</h3>
              <p>לא נמצאו עסקאות חסרות או כפילויות בטווח התאריכים שנבחר.</p>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
};

export default BudgetLensComparison;