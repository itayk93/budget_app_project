import React, { useState, useEffect } from 'react';
import './ProgressTracking.css';
import axios from 'axios';

const ProgressTracking = ({ uploadId, onComplete, onError }) => {
  const [progress, setProgress] = useState({
    stage: 'initializing',
    percentage: 0,
    message: 'מתחיל עיבוד...',
    details: null
  });
  const [maxRetries] = useState(10);

  useEffect(() => {
    if (!uploadId) return;

    let intervalId;
    let isActive = true;
    let currentRetryCount = 0;

    // Polling function to check progress
    const pollProgress = async () => {
      try {
        const token = localStorage.getItem('token');
        const baseURL = process.env.NODE_ENV === 'production' 
          ? '/api' 
          : 'http://localhost:5001/api';
        
        const response = await axios.get(`${baseURL}/upload/progress/${uploadId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = response.data;
        
        // Only update state if component is still active
        if (isActive) {
          setProgress(data);

          // Check if upload is complete or needs user interaction
          if (data.stage === 'completed' || data.stage === 'needs_currency_selection' || data.stage === 'needs_duplicates_review' || data.stage === 'needs_transaction_review') {
            if (intervalId) clearInterval(intervalId);
            onComplete(data.result);
          } else if (data.stage === 'error') {
            if (intervalId) clearInterval(intervalId);
            onError(data.error);
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
        
        // Increment retry count and stop if exceeded max retries
        currentRetryCount++;
        
        if (currentRetryCount >= maxRetries) {
          console.error('Max retries exceeded, stopping polling');
          if (intervalId) clearInterval(intervalId);
          if (isActive) {
            onError('שגיאה בתקשורת עם השרת - נסה שוב מאוחר יותר');
          }
          return;
        }
        
        // For network errors, wait longer before next retry
        if (error.code === 'ERR_INSUFFICIENT_RESOURCES' || error.code === 'ERR_NETWORK') {
          console.warn(`Network error (attempt ${currentRetryCount}/${maxRetries}), backing off...`);
          return; // Don't fail immediately, let the interval continue with backoff
        }
      }
    };

    // Start polling with adaptive timing based on retry count
    const getPollingInterval = () => {
      return 5000 + (currentRetryCount * 2000); // Increase delay after each retry
    };
    
    intervalId = setInterval(pollProgress, getPollingInterval());

    // Initial call after a short delay
    setTimeout(pollProgress, 1000);

    // Cleanup on unmount
    return () => {
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [uploadId, onComplete, onError, maxRetries]);

  const getStageIcon = (stage) => {
    const icons = {
      'initializing': 'fas fa-play-circle',
      'reading_file': 'fas fa-file-excel',
      'detecting_format': 'fas fa-search',
      'processing_data': 'fas fa-cogs',
      'detecting_currency': 'fas fa-coins',
      'checking_duplicates': 'fas fa-copy',
      'saving_data': 'fas fa-save',
      'completed': 'fas fa-check-circle',
      'error': 'fas fa-exclamation-circle'
    };
    return icons[stage] || 'fas fa-spinner';
  };

  const getStageMessage = (stage) => {
    const messages = {
      'initializing': 'מתחיל עיבוד הקובץ...',
      'reading_file': 'קורא את הקובץ...',
      'detecting_format': 'מזהה פורמט הקובץ...',
      'processing_data': 'מעבד את הנתונים...',
      'detecting_currency': 'מזהה מטבעות...',
      'checking_duplicates': 'בודק כפילויות...',
      'saving_data': 'שומר נתונים...',
      'completed': 'העיבוד הושלם בהצלחה!',
      'error': 'אירעה שגיאה בעיבוד'
    };
    return messages[stage] || progress.message;
  };

  const isAnimated = ['initializing', 'reading_file', 'detecting_format', 'processing_data', 'detecting_currency', 'checking_duplicates', 'saving_data'].includes(progress.stage);

  return (
    <div className="progress-tracking">
      <div className="card">
        <div className="card-header">
          <h3>
            <i className="fas fa-upload" style={{marginLeft: '8px'}}></i>
            מעבד קובץ...
          </h3>
        </div>

        <div className="card-body">
          <div className="progress-container">
            <div className="progress-icon">
              <i className={`${getStageIcon(progress.stage)} ${isAnimated ? 'spinning' : ''}`}></i>
            </div>

            <div className="progress-info">
              <div className="progress-stage">
                {getStageMessage(progress.stage)}
              </div>
              
              {progress.details && (
                <div className="progress-details">
                  {progress.details}
                </div>
              )}

              <div className="progress-bar-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{width: `${progress.percentage}%`}}
                  ></div>
                </div>
                <div className="progress-percentage">
                  {Math.round(progress.percentage)}%
                </div>
              </div>
            </div>
          </div>

          {/* Stage indicators */}
          <div className="stage-indicators">
            <div className={`stage-item ${progress.stage === 'reading_file' || progress.percentage > 10 ? 'completed' : progress.stage === 'initializing' ? 'active' : 'pending'}`}>
              <i className="fas fa-file-excel"></i>
              <span>קריאת קובץ</span>
            </div>
            <div className={`stage-item ${progress.stage === 'detecting_format' || progress.percentage > 20 ? 'completed' : progress.stage === 'reading_file' ? 'active' : 'pending'}`}>
              <i className="fas fa-search"></i>
              <span>זיהוי פורמט</span>
            </div>
            <div className={`stage-item ${progress.stage === 'processing_data' || progress.percentage > 40 ? 'completed' : progress.stage === 'detecting_format' ? 'active' : 'pending'}`}>
              <i className="fas fa-cogs"></i>
              <span>עיבוד נתונים</span>
            </div>
            <div className={`stage-item ${progress.stage === 'detecting_currency' || progress.percentage > 60 ? 'completed' : progress.stage === 'processing_data' ? 'active' : 'pending'}`}>
              <i className="fas fa-coins"></i>
              <span>זיהוי מטבעות</span>
            </div>
            <div className={`stage-item ${progress.stage === 'checking_duplicates' || progress.percentage > 80 ? 'completed' : progress.stage === 'detecting_currency' ? 'active' : 'pending'}`}>
              <i className="fas fa-copy"></i>
              <span>בדיקת כפילויות</span>
            </div>
            <div className={`stage-item ${progress.stage === 'completed' ? 'completed' : progress.stage === 'saving_data' ? 'active' : 'pending'}`}>
              <i className="fas fa-check-circle"></i>
              <span>השלמה</span>
            </div>
          </div>

          {/* Statistics */}
          {progress.details && typeof progress.details === 'object' && (
            <div className="progress-stats">
              <div className="stats-title">סטטיסטיקות עיבוד:</div>
              <div className="stats-grid">
                {progress.details.totalRows && (
                  <div className="stat-item">
                    <span className="stat-label">סך הכל שורות:</span>
                    <span className="stat-value">{progress.details.totalRows}</span>
                  </div>
                )}
                {progress.details.processedRows && (
                  <div className="stat-item">
                    <span className="stat-label">שורות מעובדות:</span>
                    <span className="stat-value">{progress.details.processedRows}</span>
                  </div>
                )}
                {progress.details.validTransactions && (
                  <div className="stat-item">
                    <span className="stat-label">עסקאות תקינות:</span>
                    <span className="stat-value success">{progress.details.validTransactions}</span>
                  </div>
                )}
                {progress.details.duplicatesFound && (
                  <div className="stat-item">
                    <span className="stat-label">כפילויות:</span>
                    <span className="stat-value warning">{progress.details.duplicatesFound}</span>
                  </div>
                )}
                {progress.details.errors && (
                  <div className="stat-item">
                    <span className="stat-label">שגיאות:</span>
                    <span className="stat-value error">{progress.details.errors}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Processing notes */}
          <div className="processing-notes">
            <div className="note-item">
              <i className="fas fa-info-circle"></i>
              <span>עיבוד קבצים גדולים (500K+ רשומות) יכול לקחת עד 15-20 דקות</span>
            </div>
            <div className="note-item">
              <i className="fas fa-clock"></i>
              <span>אנא המתן בסבלנות - המערכת מעבדת את הנתונים ברצועות לייעול הביצועים</span>
            </div>
            <div className="note-item">
              <i className="fas fa-shield-alt"></i>
              <span>הנתונים מעובדים בצורה מאובטחת ולא נשמרים ללא אישורך</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressTracking;