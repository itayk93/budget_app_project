import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal';
import './BudgetModal.css';

const ChangeMonthModal = ({ 
  isOpen, 
  onClose, 
  transaction,
  onChangeMonth 
}) => {
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const hebrewMonths = [
    { value: 1, label: 'ינואר' },
    { value: 2, label: 'פברואר' },
    { value: 3, label: 'מרץ' },
    { value: 4, label: 'אפריל' },
    { value: 5, label: 'מאי' },
    { value: 6, label: 'יוני' },
    { value: 7, label: 'יולי' },
    { value: 8, label: 'אוגוסט' },
    { value: 9, label: 'ספטמבר' },
    { value: 10, label: 'אוקטובר' },
    { value: 11, label: 'נובמבר' },
    { value: 12, label: 'דצמבר' }
  ];

  const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear - 5; year <= currentYear + 2; year++) {
      years.push(year);
    }
    return years;
  };

  useEffect(() => {
    if (isOpen && transaction) {
      // Initialize with transaction's current flow month instead of current date
      if (transaction.flow_month) {
        const [year, month] = transaction.flow_month.split('-');
        setSelectedYear(year);
        setSelectedMonth(parseInt(month));
      } else {
        const currentDate = new Date();
        setSelectedYear(currentDate.getFullYear().toString());
        setSelectedMonth(currentDate.getMonth() + 1);
      }
      setError('');
    }
  }, [isOpen, transaction]);

  const handleChangeMonth = async () => {
    if (!selectedYear || !selectedMonth) {
      setError('אנא בחר שנה וחודש');
      return;
    }

    const newFlowMonth = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
    
    // Check if it's the same month
    if (transaction.flow_month === newFlowMonth) {
      setError('זהו החודש הנוכחי של העסקה');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onChangeMonth(transaction.id, newFlowMonth);
      onClose();
    } catch (error) {
      setError('שגיאה בהעברת העסקה. אנא נסה שוב.');
      console.error('Error changing month:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getCurrentMonthLabel = () => {
    if (!transaction?.flow_month) return 'לא מוגדר';
    
    const [year, month] = transaction.flow_month.split('-');
    const monthLabel = hebrewMonths.find(m => m.value === parseInt(month))?.label || month;
    return `${monthLabel} ${year}`;
  };

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
        onClick={handleChangeMonth}
        disabled={isLoading || !selectedYear || !selectedMonth}
      >
        {isLoading ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            מעביר...
          </>
        ) : (
          <>
            <i className="fas fa-calendar-alt"></i>
            העבר לחודש
          </>
        )}
      </button>
    </div>
  );

  if (!isOpen || !transaction) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="העברה לחודש אחר"
      footer={modalFooter}
      className="change-month-modal"
      size="medium"
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
              <span className="detail-label">חודש נוכחי:</span>
              <span className="detail-value">{getCurrentMonthLabel()}</span>
            </div>
          </div>
        </div>

        {/* Month Selection */}
        <div className="month-selection-section">
          <h4>בחר חודש יעד</h4>
          
          <div className="date-selectors">
            <div className="date-input-section">
              <label htmlFor="year-select">שנה</label>
              <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={isLoading}
                className="form-select"
              >
                <option value="">-- בחר שנה --</option>
                {generateYears().map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="date-input-section">
              <label htmlFor="month-select">חודש</label>
              <select
                id="month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                disabled={isLoading}
                className="form-select"
              >
                <option value="">-- בחר חודש --</option>
                {hebrewMonths.map(month => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Warning Message */}
        <div className="warning-section">
          <div className="warning-card">
            <h5>
              <i className="fas fa-info-circle"></i>
              הערה חשובה
            </h5>
            <p>העברת העסקה לחודש אחר תשפיע על חישובי התקציב והמאזן של שני החודשים.</p>
          </div>
        </div>

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

export default ChangeMonthModal;