import React, { useState, useEffect } from 'react';
import { categoriesAPI } from '../../services/api';
import Modal from '../Common/Modal';
import './MonthlyTargetModal.css';

const MonthlyTargetModal = ({ 
  isOpen, 
  onClose, 
  categoryName, 
  currentTarget,
  formatCurrency,
  onTargetUpdated,
  isIncome,
  isSharedTarget = false,
  sharedCategoryName 
}) => {
  const [targetAmount, setTargetAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showHistogram, setShowHistogram] = useState(false);
  const [spendingHistory, setSpendingHistory] = useState([]);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  useEffect(() => {
    // Don't reset target amount if we're in the middle of auto-saving
    if (isAutoSaving) {
      console.log('🚫 [MODAL] Skipping useEffect reset because auto-save is in progress');
      return;
    }
    
    if (isOpen && currentTarget !== null && currentTarget !== undefined) {
      setTargetAmount(currentTarget.toString());
    } else if (isOpen) {
      setTargetAmount('');
    }
    setError('');
    setSuccessMessage('');
  }, [isOpen, currentTarget, isAutoSaving]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const amount = parseFloat(targetAmount);
      if (isNaN(amount) || amount < 0) {
        throw new Error('אנא הכנס סכום תקף');
      }

      if (isSharedTarget) {
        await categoriesAPI.updateSharedTarget({
          shared_category_name: sharedCategoryName,
          monthly_target: amount
        });
      } else {
        await categoriesAPI.updateMonthlyTarget({
          categoryName: categoryName,
          target: amount
        });
      }

      if (onTargetUpdated) {
        onTargetUpdated(amount);
      }
      onClose();
    } catch (err) {
      console.error('Error updating monthly target:', err);
      setError(err.response?.data?.error || err.message || 'שגיאה בעדכון היעד החודשי');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAndSetTarget = async (months) => {
    console.log('🚀 [MODAL] calculateAndSetTarget called with months:', months);
    console.log('🚀 [MODAL] categoryName:', categoryName);
    
    setIsLoading(true);
    setError('');

    if (!categoryName) {
      console.error('❌ [MODAL] No category name provided');
      setError('שם הקטגוריה לא נמצא');
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔄 [MODAL] Making API call for category:', categoryName, 'months:', months);
      const response = await categoriesAPI.calculateMonthlyTarget({
        category_name: categoryName,
        months: months
      });

      console.log('✅ [MODAL] API Response received:', JSON.stringify(response, null, 2));
      console.log('🎯 [MODAL] Monthly target from response:', response.monthly_target);
      console.log('💬 [MODAL] Message from response:', response.message);

      if (response && response.monthly_target !== undefined) {
        const targetValue = response.monthly_target.toString();
        console.log('📝 [MODAL] Setting target amount to:', targetValue);
        setTargetAmount(targetValue);
        
        // Auto-save the calculated target
        console.log('💾 [MODAL] Auto-saving calculated target...');
        setIsAutoSaving(true);
        try {
          await categoriesAPI.updateMonthlyTarget({
            categoryName: categoryName,
            target: response.monthly_target
          });
          console.log('✅ [MODAL] Target auto-saved successfully');
          
          // Call onTargetUpdated after successful save
          if (onTargetUpdated) {
            console.log('🔄 [MODAL] Calling onTargetUpdated after successful save:', response.monthly_target);
            onTargetUpdated(response.monthly_target);
          }
        } catch (saveError) {
          console.error('❌ [MODAL] Error auto-saving target:', saveError);
          setError('שגיאה בשמירת היעד: ' + (saveError.response?.data?.error || saveError.message));
        } finally {
          // Reset auto-saving flag after a short delay to allow parent state to update
          setTimeout(() => {
            console.log('🔄 [MODAL] Resetting auto-saving flag');
            setIsAutoSaving(false);
          }, 500);
        }
        
        // Show message if available
        if (response.message) {
          console.log('📢 [MODAL] Setting success message:', response.message);
          setSuccessMessage(response.message + ' (נשמר אוטומטית)');
          setTimeout(() => {
            console.log('🧹 [MODAL] Clearing success message');
            setSuccessMessage('');
          }, 8000);
        }
      } else {
        console.error('❌ [MODAL] Invalid response structure:', response);
        setError('תגובה לא תקינה מהשרת');
      }
    } catch (err) {
      console.error('❌ [MODAL] Error calculating monthly target:', err);
      console.error('❌ [MODAL] Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: err.config
      });
      setError(err.response?.data?.error || err.message || 'שגיאה בחישוב היעד החודשי');
    } finally {
      console.log('🏁 [MODAL] calculateAndSetTarget finished, setting loading to false');
      setIsLoading(false);
    }
  };

  const calculateSharedForecast = async () => {
    setIsLoading(true);
    setError('');

    try {
      console.log('Calculating shared forecast for shared category:', sharedCategoryName);
      
      // Call the new endpoint to calculate shared category targets
      const response = await categoriesAPI.calculateSharedTargets({
        force: true
      });

      console.log('Shared targets calculation response:', response);

      // Get the updated shared target for this specific category
      if (sharedCategoryName) {
        try {
          const sharedTargetResponse = await categoriesAPI.getSharedTarget(sharedCategoryName);
          if (sharedTargetResponse.target) {
            const newTarget = sharedTargetResponse.target.monthly_target;
            setTargetAmount(newTarget.toString());
            
            if (onTargetUpdated) {
              onTargetUpdated(newTarget);
            }
            
            console.log(`Updated shared forecast for ${sharedCategoryName}: ${newTarget}`);
          }
        } catch (targetError) {
          console.error('Error getting updated shared target:', targetError);
          // Even if we can't get the specific target, the calculation was successful
          if (response.results && response.results.length > 0) {
            const relevantResult = response.results.find(r => r.sharedCategory === sharedCategoryName);
            if (relevantResult && relevantResult.newTarget) {
              setTargetAmount(relevantResult.newTarget.toString());
              if (onTargetUpdated) {
                onTargetUpdated(relevantResult.newTarget);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error calculating shared forecast:', err);
      setError(err.response?.data?.error || err.message || 'שגיאה בחישוב הצפי המשותף');
    } finally {
      setIsLoading(false);
    }
  };

  const showSpendingHistogram = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await categoriesAPI.getSpendingHistory(categoryName, 12);
      const historyData = response.spending_history || [];
      
      // Ensure it's always an array
      if (Array.isArray(historyData)) {
        setSpendingHistory(historyData);
      } else {
        console.warn('Spending history is not an array:', historyData);
        setSpendingHistory([]);
      }
      
      setShowHistogram(true);
    } catch (err) {
      console.error('Error loading spending history:', err);
      setError(err.response?.data?.error || err.message || 'שגיאה בטעינת היסטוריית ההוצאות');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  if (showHistogram) {
    const histogramFooter = (
      <div className="modal-footer">
        <button 
          type="button" 
          className="btn btn-secondary"
          onClick={() => setShowHistogram(false)}
          disabled={isLoading}
        >
          <i className="fas fa-times"></i>
          סגור
        </button>
      </div>
    );

    return (
      <Modal
        isOpen={showHistogram}
        onClose={() => setShowHistogram(false)}
        title={`היסטוריית הוצאות - ${categoryName}`}
        footer={histogramFooter}
        className="monthly-target-modal histogram-modal"
        size="large"
      >
        <div className="modal-body">
          <div className="histogram-container">
            {spendingHistory.map((item, index) => {
              const maxAmount = Math.max(...spendingHistory.map(h => h.amount));
              const barHeight = maxAmount > 0 ? (item.amount / maxAmount) * 200 : 0;
              
              return (
                <div key={index} className="histogram-bar-container">
                  <div className="histogram-bar-wrapper">
                    <div 
                      className="histogram-bar"
                      style={{ height: `${barHeight}px` }}
                    />
                    <div className="histogram-amount">
                      {formatCurrency(item.amount)}
                    </div>
                  </div>
                  <div className="histogram-label">
                    {item.monthName}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    );
  }

  const modalFooter = (
    <div className="modal-footer">
      <button 
        type="button" 
        className="btn btn-secondary"
        onClick={onClose}
        disabled={isLoading}
      >
        ביטול
      </button>
      <button 
        type="submit" 
        className="btn btn-primary"
        disabled={isLoading}
        form="monthly-target-form"
      >
        {isLoading ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            שומר...
          </>
        ) : (
          <>
            <i className="fas fa-save"></i>
            שמור
          </>
        )}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`עריכת ${isIncome ? 'צפי' : 'יעד'} חודשי${isSharedTarget ? ' משותף' : ''} - ${categoryName}`}
      footer={modalFooter}
      className="monthly-target-modal"
      size="medium"
    >
      <form id="monthly-target-form" onSubmit={handleSubmit}>
        <div className="modal-body">
          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-triangle"></i>
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="success-message">
              <i className="fas fa-check-circle"></i>
              {successMessage}
            </div>
          )}
          
          <div className="target-input-section">
            <label htmlFor="targetAmount">{isIncome ? 'צפי' : 'יעד'} חודשי (₪)</label>
            <input
              type="number"
              id="targetAmount"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="הכנס סכום"
              min="0"
              step="0.01"
              required
              disabled={isLoading}
            />
          </div>

          <div className="quick-actions">
            <h4>חישוב אוטומטי</h4>
            <div className="quick-action-buttons">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => calculateAndSetTarget(3)}
                disabled={isLoading}
              >
                <i className="fas fa-calculator"></i>
                ממוצע 3 חודשים
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => calculateAndSetTarget(12)}
                disabled={isLoading}
              >
                <i className="fas fa-calendar-alt"></i>
                ממוצע 12 חודשים
              </button>
              {sharedCategoryName && isIncome && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm shared-forecast-btn"
                  onClick={calculateSharedForecast}
                  disabled={isLoading}
                  title="חישוב צפי חכם המתבסס על הכנסות קבועות (חודש אחרון) ומשתנות (ממוצע 3 חודשים)"
                >
                  <i className="fas fa-magic"></i>
                  חישוב צפי חכם משותף
                </button>
              )}
            </div>
          </div>

          <div className="history-section">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={showSpendingHistogram}
              disabled={isLoading}
            >
              <i className="fas fa-chart-bar"></i>
              הצג היסטוריית הוצאות
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default MonthlyTargetModal;