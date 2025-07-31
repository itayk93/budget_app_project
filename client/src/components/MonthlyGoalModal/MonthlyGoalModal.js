import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal';
import './MonthlyGoalModal.css';

const MonthlyGoalModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  currentGoal = null,
  cashFlowId,
  year,
  month 
}) => {
  const [goalAmount, setGoalAmount] = useState('');
  const [includeInNextMonth, setIncludeInNextMonth] = useState(false);
  const [includeInSpecificMonth, setIncludeInSpecificMonth] = useState(false);
  const [specificYear, setSpecificYear] = useState(new Date().getFullYear());
  const [specificMonth, setSpecificMonth] = useState(new Date().getMonth() + 1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && currentGoal) {
      setGoalAmount(currentGoal.amount?.toString() || '');
      setIncludeInNextMonth(currentGoal.include_in_next_month || false);
      setIncludeInSpecificMonth(currentGoal.include_in_specific_month || false);
      setSpecificYear(currentGoal.specific_year || new Date().getFullYear());
      setSpecificMonth(currentGoal.specific_month || new Date().getMonth() + 1);
    } else if (isOpen) {
      // Reset form for new goal
      setGoalAmount('');
      setIncludeInNextMonth(false);
      setIncludeInSpecificMonth(false);
      setSpecificYear(new Date().getFullYear());
      setSpecificMonth(new Date().getMonth() + 1);
    }
  }, [isOpen, currentGoal]);

  const handleSave = async () => {
    if (!goalAmount || parseFloat(goalAmount) <= 0) {
      alert('אנא הזן סכום חיובי למטרה החודשית');
      return;
    }

    setSaving(true);
    try {
      const goalData = {
        amount: parseFloat(goalAmount),
        cash_flow_id: cashFlowId,
        year: year,
        month: month,
        include_in_next_month: includeInNextMonth,
        include_in_specific_month: includeInSpecificMonth,
        specific_year: includeInSpecificMonth ? specificYear : null,
        specific_month: includeInSpecificMonth ? specificMonth : null
      };

      await onSave(goalData);
      onClose();
    } catch (error) {
      console.error('Error saving monthly goal:', error);
      alert('אירעה שגיאה בשמירת המטרה החודשית');
    } finally {
      setSaving(false);
    }
  };

  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  const getCurrentMonthName = () => {
    return monthNames[month - 1];
  };

  const getNextMonthName = () => {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${monthNames[nextMonth - 1]} ${nextYear}`;
  };

  const footer = (
    <div className="monthly-goal-modal-footer">
      <button 
        className="btn btn-secondary" 
        onClick={onClose}
        disabled={saving}
      >
        ביטול
      </button>
      <button 
        className="btn btn-primary" 
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? (
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
      title={`הגדרת יעד חודשי - ${getCurrentMonthName()} ${year}`}
      footer={footer}
      size="medium"
      className="monthly-goal-modal"
    >
      <div className="monthly-goal-form">
        <div className="form-group">
          <label className="form-label">
            כמה כסף אתה רוצה להשאיר בצד בסוף החודש?
          </label>
          <div className="goal-amount-input">
            <input
              type="number"
              className="form-input"
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
              placeholder="הזן סכום"
              min="0"
              step="0.01"
            />
            <span className="currency-symbol">₪</span>
          </div>
        </div>

        <div className="form-section">
          <h4>מה לעשות עם הכסף שחסכתי?</h4>
          
          <div className="option-group">
            <label className="option-item">
              <input
                type="radio"
                name="savingsOption"
                checked={!includeInNextMonth && !includeInSpecificMonth}
                onChange={() => {
                  setIncludeInNextMonth(false);
                  setIncludeInSpecificMonth(false);
                }}
              />
              <div className="option-content">
                <span className="option-title">לא להכניס לתזרים עתידי</span>
                <span className="option-description">הכסף יישאר כחיסכון ולא יתווסף לחודשים הבאים</span>
              </div>
            </label>

            <label className="option-item">
              <input
                type="radio"
                name="savingsOption"
                checked={includeInNextMonth}
                onChange={() => {
                  setIncludeInNextMonth(true);
                  setIncludeInSpecificMonth(false);
                }}
              />
              <div className="option-content">
                <span className="option-title">הוסף לחודש הבא כהכנסה</span>
                <span className="option-description">הכסף יתווסף ל{getNextMonthName()} כהכנסה</span>
              </div>
            </label>

            <label className="option-item">
              <input
                type="radio"
                name="savingsOption"
                checked={includeInSpecificMonth}
                onChange={() => {
                  setIncludeInNextMonth(false);
                  setIncludeInSpecificMonth(true);
                }}
              />
              <div className="option-content">
                <span className="option-title">הוסף לחודש ספציפי כהכנסה</span>
                <span className="option-description">בחר חודש ושנה שבהם הכסף יתווסף כהכנסה</span>
              </div>
            </label>
          </div>

          {includeInSpecificMonth && (
            <div className="specific-month-selector">
              <div className="date-inputs">
                <div className="form-group">
                  <label className="form-label">חודש</label>
                  <select
                    className="form-select"
                    value={specificMonth}
                    onChange={(e) => setSpecificMonth(parseInt(e.target.value))}
                  >
                    {monthNames.map((monthName, index) => (
                      <option key={index + 1} value={index + 1}>
                        {monthName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">שנה</label>
                  <input
                    type="number"
                    className="form-input"
                    value={specificYear}
                    onChange={(e) => setSpecificYear(parseInt(e.target.value))}
                    min={new Date().getFullYear()}
                    max={new Date().getFullYear() + 10}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="info-section">
          <div className="info-item">
            <i className="fas fa-info-circle"></i>
            <span>
              הסכום שתגדיר יופחת מהתזרים החודשי שלך (יוצג כהוצאה) ויעזור לך לעקוב אחר יעדי החיסכון
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MonthlyGoalModal;